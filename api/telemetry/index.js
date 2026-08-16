import { connectToDatabase } from '../lib/mongodb.js'
import TelemetryEvent from '../models/TelemetryEvent.js'
import TrialResult from '../models/TrialResult.js'
import PostTaskResponse from '../models/PostTaskResponse.js'
import ParticipantMode from '../models/ParticipantMode.js'
import ParticipantTrialPlan from '../models/ParticipantTrialPlan.js'
import { getScenarioById, getExplanation } from '../../src/scenarios/index.js'
import { STOCKOUT_PENALTY_WEIGHT, HOLDING_PENALTY_WEIGHT, CONFIG } from '../../src/config/index.js'

/**
 * Helper to compute Weight of Advice (WoA).
 * WoA = (Final - Initial) / (Advice - Initial)
 */
function calculateWoA(initial, advice, final) {
  if (advice === initial) return null
  const woa = (final - initial) / (advice - initial)
  return Number.isFinite(woa) ? Math.round(woa * 10000) / 10000 : null
}

/**
 * Server-Side Range / Plausibility Validation (Item 3)
 * Enforces scenario-specific bounds to reject non-finite, negative, or absurd values.
 */
function validateEstimateBounds(trialId, value) {
  if (value == null) return { valid: false, reason: 'Value is null/undefined' }
  const num = Number(value)
  if (!Number.isFinite(num)) return { valid: false, reason: 'Value is non-finite' }
  if (num < 0) return { valid: false, reason: 'Value cannot be negative' }

  const scenario = getScenarioById(trialId)
  if (!scenario) return { valid: true, sanitized: num }

  const baseline = scenario.historicalDemand?.mean || scenario.groundTruthOptimal || 10000
  const maxPlausible = Math.max(baseline * 5, 2000000) // Hard plausible ceiling

  if (num > maxPlausible) {
    return { valid: false, reason: `Value ${num} exceeds maximum plausible threshold ${maxPlausible}` }
  }

  return { valid: true, sanitized: num }
}

/**
 * Protocol Primary Outcome Measure: Directional Cost Regret
 */
function calculateRegret(
  finalEstimate,
  groundTruthOptimal,
  stockoutWeight = STOCKOUT_PENALTY_WEIGHT,
  holdingWeight = HOLDING_PENALTY_WEIGHT
) {
  if (finalEstimate == null || groundTruthOptimal == null) {
    return { costRegret: null, directionalCostRegret: null }
  }
  const finalNum = Number(finalEstimate)
  const optNum = Number(groundTruthOptimal)
  if (!Number.isFinite(finalNum) || !Number.isFinite(optNum)) {
    return { costRegret: null, directionalCostRegret: null }
  }

  const signedDiff = finalNum - optNum
  const costRegret = Math.abs(signedDiff)

  const weightedDiff = signedDiff < 0
    ? signedDiff * stockoutWeight
    : signedDiff * holdingWeight

  return {
    costRegret: Math.round(costRegret * 100) / 100,
    directionalCostRegret: Math.round(weightedDiff * 100) / 100,
  }
}

export default async function handler(req, res) {
  // CORS Headers for cross-origin research deployments
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // ── SERVER-SIDE ADVICE RESOLUTION (LATIN-SQUARE TRIAL PLAN RESOLUTION) ──────
  if (req.method === 'GET') {
    const { trialId, condition, participantId } = req.query
    if (!trialId) {
      return res.status(400).json({ error: 'Missing trialId parameter' })
    }

    const scenario = getScenarioById(trialId)
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }

    let isCorrect = false
    let errorDirection = 'na'
    let recAmount = null
    let explanationText = null

    // Check participant's persisted trial plan if participantId provided
    if (participantId && !scenario.isPractice) {
      try {
        await connectToDatabase()
        const planDoc = await ParticipantTrialPlan.findOne({ participantId }).lean()
        if (planDoc && planDoc.trials) {
          const item = planDoc.trials.find((t) => t.trialId === trialId)
          if (item) {
            isCorrect = item.isCorrect
            errorDirection = item.errorDirection
            recAmount = item.recommendation
            explanationText = item.explanation
          }
        }
      } catch (err) {
        console.warn('[telemetry GET] Could not load ParticipantTrialPlan:', err.message)
      }
    }

    // Default fallback if not found in plan
    if (recAmount == null) {
      if (scenario.isPractice) {
        isCorrect = true
        errorDirection = 'na'
        recAmount = typeof scenario.recommendation === 'object'
          ? (scenario.recommendation.correct ?? scenario.recommendation.optimal)
          : scenario.recommendation
      } else {
        recAmount = typeof scenario.recommendation === 'object'
          ? (isCorrect ? scenario.recommendation.correct : (scenario.recommendation.incorrect ?? scenario.recommendation.active))
          : scenario.recommendation
      }
    }

    if (explanationText === undefined || explanationText === null) {
      explanationText = getExplanation(scenario, condition || 'c0', isCorrect)
    }

    return res.status(200).json({
      trialId,
      recommendation: recAmount,
      explanation: condition === 'c0' ? null : explanationText,
      isCorrect,
      errorDirection,
      groundTruthOptimal: scenario.groundTruthOptimal ?? (typeof scenario.recommendation === 'object' ? (scenario.recommendation.correct ?? scenario.recommendation.optimal) : null),
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    await connectToDatabase()

    const body = req.body
    const eventsToProcess = Array.isArray(body) ? body : [body]

    if (eventsToProcess.length === 0) {
      return res.status(400).json({ error: 'Empty event payload' })
    }

    // Process all incoming event envelopes
    const eventDocs = []
    const trialResultsToUpsert = []
    const postTaskResponsesToUpsert = []
    const participantStatusUpdates = new Map() // participantId -> newStatus

    for (const ev of eventsToProcess) {
      if (!ev.eventId || !ev.eventType || !ev.participantId) {
        continue // Skip invalid envelopes safely
      }

      eventDocs.push({
        eventId: ev.eventId,
        eventType: ev.eventType,
        timestamp: ev.timestamp ? new Date(ev.timestamp) : new Date(),
        sessionId: ev.sessionId || 'unknown',
        participantId: ev.participantId,
        condition: ev.condition || null,
        participantType: ev.participantType || null,
        screen: ev.screen || 'unknown',
        trialId: ev.trialId || null,
        applicationVersion: ev.applicationVersion || CONFIG.APPLICATION_VERSION || '0.2.0',
        studyVersion: ev.studyVersion || CONFIG.STUDY_VERSION || '4.1.0',
        payload: ev.payload || {},
      })

      // Lifecycle status tracking
      if (ev.eventType === 'PARTICIPANT_EXCLUDED') {
        participantStatusUpdates.set(ev.participantId, 'excluded')
      } else if (ev.eventType === 'QUESTIONNAIRE_COMPLETED' || ev.eventType === 'STUDY_COMPLETED') {
        if (participantStatusUpdates.get(ev.participantId) !== 'excluded') {
          participantStatusUpdates.set(ev.participantId, 'completed')
        }
      } else if (
        ev.eventType === 'INITIAL_ESTIMATE_SUBMITTED' ||
        ev.eventType === 'FINAL_ESTIMATE_SUBMITTED' ||
        ev.eventType === 'COMPREHENSION_CHECK_PASSED'
      ) {
        if (!participantStatusUpdates.has(ev.participantId)) {
          participantStatusUpdates.set(ev.participantId, 'in_progress')
        }
      }

      // 1. Analytical extraction for completed trial decisions (Idempotent & Range-Validated)
      if (ev.eventType === 'FINAL_ESTIMATE_SUBMITTED' && ev.payload && ev.trialId) {
        const p = ev.payload

        // Server-Side Range Validation
        const valInitial = validateEstimateBounds(ev.trialId, p.initialEstimate)
        const valFinal = validateEstimateBounds(ev.trialId, p.finalEstimate)

        if (!valInitial.valid || !valFinal.valid) {
          console.warn(`[telemetry validation reject] Invalid estimates for participant ${ev.participantId} trial ${ev.trialId}:`, { valInitial, valFinal })
          continue
        }

        const scenario = getScenarioById(ev.trialId)
        const groundTruthOptimal = p.groundTruthOptimal != null
          ? Number(p.groundTruthOptimal)
          : (scenario?.groundTruthOptimal ?? scenario?.recommendation?.correct ?? scenario?.recommendation?.optimal ?? null)

        const sanitizedInitial = valInitial.sanitized
        const sanitizedFinal = valFinal.sanitized
        const sanitizedAI = Number(p.aiRecommendation)

        const woa = calculateWoA(sanitizedInitial, sanitizedAI, sanitizedFinal)
        const { costRegret, directionalCostRegret } = calculateRegret(sanitizedFinal, groundTruthOptimal)

        // Strict scenario type mapping
        let scenarioType = 'unknown'
        if (ev.trialId.startsWith('SS-') || ev.trialId === 'PRAC-1') scenarioType = 'safety_stock'
        else if (ev.trialId.startsWith('NV-') || ev.trialId === 'PRAC-2') scenarioType = 'newsvendor'
        else if (ev.trialId.startsWith('ROP-')) scenarioType = 'reorder_point'
        else if (ev.trialId.startsWith('EW-')) scenarioType = 'expedite_or_wait'

        trialResultsToUpsert.push({
          updateOne: {
            filter: { participantId: ev.participantId, trialId: ev.trialId },
            update: {
              $set: {
                participantId: ev.participantId,
                sessionId: ev.sessionId,
                condition: ev.condition,
                participantType: ev.participantType || null,
                trialId: ev.trialId,
                scenarioType,
                isPractice: Boolean(p.isPractice),
                isCorrect: p.isCorrect != null ? Boolean(p.isCorrect) : null,
                errorDirection: p.errorDirection || null,
                groundTruthOptimal,
                costRegret,
                directionalCostRegret,
                stockoutPenaltyWeight: STOCKOUT_PENALTY_WEIGHT,
                holdingPenaltyWeight: HOLDING_PENALTY_WEIGHT,
                initialEstimate: sanitizedInitial,
                aiRecommendation: sanitizedAI,
                finalEstimate: sanitizedFinal,
                weightOfAdvice: woa,
                finalConfidence: p.finalConfidence ? Number(p.finalConfidence) : null,
                cognitiveLoad: p.cognitiveLoad ? Number(p.cognitiveLoad) : null,
                verificationResponse: p.verificationResponse || null,
                step4DwellMs: p.step4DwellMs || 0,
                totalTrialDwellMs: p.totalTrialDwellMs || 0,
                protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
                applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
              },
            },
            upsert: true,
          },
        })
      }

      // 2. Analytical extraction for completed post-task questionnaires
      if (ev.eventType === 'QUESTIONNAIRE_COMPLETED' && ev.payload) {
        const p = ev.payload.responses || ev.payload
        if (p.nasaTlx || p.numeracy || p.domainExperience) {
          postTaskResponsesToUpsert.push({
            updateOne: {
              filter: { participantId: ev.participantId },
              update: {
                $set: {
                  participantId: ev.participantId,
                  sessionId: ev.sessionId,
                  condition: ev.condition,
                  participantType: ev.participantType || null,
                  nasaTlx: {
                    mentalDemand:   p.nasaTlx?.dimensions?.mentalDemand ?? null,
                    physicalDemand: p.nasaTlx?.dimensions?.physicalDemand ?? null,
                    temporalDemand: p.nasaTlx?.dimensions?.temporalDemand ?? null,
                    performance:    p.nasaTlx?.dimensions?.performance ?? null,
                    effort:         p.nasaTlx?.dimensions?.effort ?? null,
                    frustration:    p.nasaTlx?.dimensions?.frustration ?? null,
                    rawTlxAverage:  p.nasaTlx?.rawTlxAverage ?? null,
                  },
                  numeracy: {
                    instrument:      p.numeracy?.scored?.instrument ?? 'Schwartz-Lipkus-3Item-Plus-SNS',
                    objectiveScore:  p.numeracy?.scored?.objectiveScore ?? null,
                    totalObjective:  p.numeracy?.scored?.totalObjective ?? 3,
                    subjectiveScore: p.numeracy?.scored?.subjectiveScore ?? null,
                    rawResponses:    p.numeracy?.rawResponses ?? {},
                  },
                  domainExperience: {
                    yearsExperience:   p.domainExperience?.yearsExperience ?? null,
                    primaryRole:       p.domainExperience?.primaryRole ?? null,
                    decisionFrequency: p.domainExperience?.decisionFrequency ?? null,
                    certifications:    p.domainExperience?.certifications ?? null,
                    feedback:          p.domainExperience?.feedback ?? null,
                  },
                  protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
                  applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
                  submittedAt: p.submittedAt ? new Date(p.submittedAt) : new Date(),
                },
              },
              upsert: true,
            },
          })
        }
      }
    }

    // Bulk insert events for high-throughput performance (Idempotent: ignore duplicate eventId)
    if (eventDocs.length > 0) {
      try {
        await TelemetryEvent.insertMany(eventDocs, { ordered: false })
      } catch (insertErr) {
        // MongoBulkWriteError on duplicate eventId is safely ignored for idempotency
        if (insertErr.code !== 11000) {
          console.warn('[Telemetry insertMany warning]:', insertErr.message)
        }
      }
    }

    // Bulk upsert TrialResult records
    if (trialResultsToUpsert.length > 0) {
      await TrialResult.bulkWrite(trialResultsToUpsert, { ordered: false })
    }

    // Bulk upsert PostTaskResponse records
    if (postTaskResponsesToUpsert.length > 0) {
      await PostTaskResponse.bulkWrite(postTaskResponsesToUpsert, { ordered: false })
    }

    // Update participant status & lastActiveAt in ParticipantMode
    for (const [pid, newStatus] of participantStatusUpdates.entries()) {
      await ParticipantMode.updateOne(
        { participantId: pid },
        { $set: { status: newStatus, lastActiveAt: new Date() } }
      ).catch((err) => console.warn(`[ParticipantMode status update error for ${pid}]`, err.message))
    }

    return res.status(200).json({
      status: 'ok',
      eventsLogged: eventDocs.length,
      trialsRecorded: trialResultsToUpsert.length,
      postTasksRecorded: postTaskResponsesToUpsert.length,
    })
  } catch (error) {
    console.error('[Telemetry API POST Error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
