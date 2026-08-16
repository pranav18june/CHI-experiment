import { connectToDatabase } from '../lib/mongodb.js'
import TelemetryEvent from '../models/TelemetryEvent.js'
import TrialResult from '../models/TrialResult.js'
import PostTaskResponse from '../models/PostTaskResponse.js'
import ParticipantTrialPlan from '../models/ParticipantTrialPlan.js'
import { getScenarioById, getExplanation } from '../../src/scenarios/index.js'
import { STOCKOUT_PENALTY_WEIGHT, HOLDING_PENALTY_WEIGHT } from '../../src/config/index.js'

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

    const explanation = getExplanation(scenario, condition || 'c0', isCorrect)

    return res.status(200).json({
      trialId,
      recommendation: recAmount,
      explanation: condition === 'c0' ? null : explanation,
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
        applicationVersion: ev.applicationVersion || '0.2.0',
        studyVersion: ev.studyVersion || '4.1.0',
        payload: ev.payload || {},
      })

      // 1. Analytical extraction for completed trial decisions
      if (ev.eventType === 'FINAL_ESTIMATE_SUBMITTED' && ev.payload && ev.trialId) {
        const p = ev.payload
        const scenario = getScenarioById(ev.trialId)
        const groundTruthOptimal = p.groundTruthOptimal != null
          ? Number(p.groundTruthOptimal)
          : (scenario?.groundTruthOptimal ?? scenario?.recommendation?.correct ?? scenario?.recommendation?.optimal ?? null)

        const woa = calculateWoA(p.initialEstimate, p.aiRecommendation, p.finalEstimate)
        const { costRegret, directionalCostRegret } = calculateRegret(p.finalEstimate, groundTruthOptimal)

        trialResultsToUpsert.push({
          updateOne: {
            filter: { participantId: ev.participantId, trialId: ev.trialId },
            update: {
              $set: {
                participantId: ev.participantId,
                sessionId: ev.sessionId,
                condition: ev.condition,
                participantType: ev.participantType,
                trialId: ev.trialId,
                scenarioType: p.scenarioType || 'unknown',
                isPractice: Boolean(p.isPractice),
                isCorrect: p.isCorrect != null ? Boolean(p.isCorrect) : null,
                errorDirection: p.errorDirection || null,
                groundTruthOptimal,
                costRegret,
                directionalCostRegret,
                initialEstimate: Number(p.initialEstimate),
                aiRecommendation: Number(p.aiRecommendation),
                finalEstimate: Number(p.finalEstimate),
                weightOfAdvice: woa,
                finalConfidence: p.finalConfidence ? Number(p.finalConfidence) : null,
                cognitiveLoad: p.cognitiveLoad ? Number(p.cognitiveLoad) : null,
                verificationResponse: p.verificationResponse || null,
                step4DwellMs: p.step4DwellMs || 0,
                totalTrialDwellMs: p.totalTrialDwellMs || 0,
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
                  participantType: ev.participantType,
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
                  submittedAt: p.submittedAt ? new Date(p.submittedAt) : new Date(),
                },
              },
              upsert: true,
            },
          })
        }
      }
    }

    // Bulk insert events for high-throughput performance
    if (eventDocs.length > 0) {
      await TelemetryEvent.insertMany(eventDocs, { ordered: false })
    }

    // Bulk upsert TrialResult records
    if (trialResultsToUpsert.length > 0) {
      await TrialResult.bulkWrite(trialResultsToUpsert, { ordered: false })
    }

    // Bulk upsert PostTaskResponse records
    if (postTaskResponsesToUpsert.length > 0) {
      await PostTaskResponse.bulkWrite(postTaskResponsesToUpsert, { ordered: false })
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
