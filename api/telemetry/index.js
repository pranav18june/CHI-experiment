import { connectToDatabase } from '../../lib/mongodb.js'
import TelemetryEvent from '../../lib/models/TelemetryEvent.js'
import TrialResult from '../../lib/models/TrialResult.js'
import PostTaskResponse from '../../lib/models/PostTaskResponse.js'
import ParticipantMode from '../../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../../lib/models/ParticipantTrialPlan.js'
import { getScenarioById, getExplanation } from '../../src/scenarios/index.js'
import { STOCKOUT_PENALTY_WEIGHT, HOLDING_PENALTY_WEIGHT, CONFIG } from '../../src/config/index.js'
import { applyCors, checkIngestLimits } from '../../lib/http.js'

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
  if (!scenario) return { valid: true, sanitized: num, inBand: true }

  // Plausibility is the scenario's own declared response band (§5.9) — the same
  // range the number line offers. The previous rule was
  // `Math.max(baseline * 5, 2000000)`, which should have been a `Math.min`:
  // every scenario's baseline*5 is under 2,000,000, so the per-scenario bound
  // never bound anything and every trial had a flat 2M ceiling. A typed
  // 1,999,999 on SS-1 (band 0–70,000, optimum 29,251) passed, and one such row
  // would dominate mean directional regret — the primary DV.
  const band = scenario.numberLine
  if (!band || !Number.isFinite(band.max)) return { valid: true, sanitized: num, inBand: true }

  // A small tolerance above the band absorbs rounding at the top of the scale
  // without admitting an order-of-magnitude typo.
  const ceiling = band.max * 1.05
  const floor = Math.max(0, (band.min ?? 0) - band.max * 0.05)

  return {
    valid: true,
    sanitized: num,
    inBand: num >= floor && num <= ceiling,
    band: { min: band.min ?? 0, max: band.max },
  }
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
  if (applyCors(req, res, { methods: 'GET,OPTIONS,POST' })) return

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

    if (recAmount == null) {
      if (scenario.isPractice) {
        // Practice correctness is a property of the scenario itself (§5.8) —
        // PRAC-2 deliberately shows a wrong AI so the feedback can teach
        // verification.
        const rec = typeof scenario.recommendation === 'object' ? scenario.recommendation : {}
        const truth = rec.correct ?? rec.optimal
        const shown = rec.active ?? truth
        isCorrect = shown === truth
        errorDirection = isCorrect ? 'na' : (shown > truth ? 'high' : 'low')
        recAmount = shown ?? scenario.recommendation
      } else {
        // A scored trial with no plan entry must NOT be answered with a guess.
        // The previous default silently served the incorrect version with
        // errorDirection 'high', fabricating the correctness manipulation.
        return res.status(409).json({
          error: 'No assignment found for this participant and trial',
          code: 'NO_SERVER_PLAN',
        })
      }
    }

    if (explanationText === undefined || explanationText === null) {
      explanationText = getExplanation(scenario, condition || 'c0', isCorrect)
    }

    // Correctness and ground truth are deliberately NOT returned: the browser
    // does not need them to render, and the server resolves both from its own
    // plan when the trial is written.
    return res.status(200).json({
      trialId,
      recommendation: recAmount,
      explanation: condition === 'c0' ? null : explanationText,
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

    // Reject oversized batches before touching the database.
    const limitRejection = checkIngestLimits(eventsToProcess)
    if (limitRejection) {
      return res.status(limitRejection.status).json(limitRejection.body)
    }

    // ── Load the authoritative assignment for every participant in this batch ──
    // The client's copies of condition / correctness / ground truth are NOT
    // trusted: a stale autosave, a URL override, or an edited payload would
    // otherwise write an authoritative-looking row. ParticipantTrialPlan and
    // ParticipantMode are the authority; client values are kept only so a
    // mismatch can be detected and flagged.
    const participantIds = [...new Set(
      eventsToProcess
        .filter((ev) => ev?.eventType === 'FINAL_ESTIMATE_SUBMITTED' && ev.participantId)
        .map((ev) => ev.participantId)
    )]

    const planByParticipant = new Map()
    const modeByParticipant = new Map()
    if (participantIds.length > 0) {
      const [plans, modes] = await Promise.all([
        ParticipantTrialPlan.find({ participantId: { $in: participantIds } }).lean(),
        ParticipantMode.find({ participantId: { $in: participantIds } }).lean(),
      ])
      for (const plan of plans) {
        const byTrial = new Map()
        for (const t of plan.trials || []) byTrial.set(t.trialId, t)
        planByParticipant.set(plan.participantId, { doc: plan, byTrial })
      }
      for (const m of modes) modeByParticipant.set(m.participantId, m)
    }

    // Process all incoming event envelopes
    const eventDocs = []
    const trialResultsToUpsert = []
    const postTaskResponsesToUpsert = []
    const participantStatusUpdates = new Map() // participantId -> newStatus
    let skippedEnvelopes = 0

    for (const ev of eventsToProcess) {
      if (!ev.eventId || !ev.eventType || !ev.participantId) {
        // Never silent: an envelope without a participantId is unattributable,
        // and this path once discarded every consent event (and so all
        // demographics) without a trace.
        console.warn('[telemetry] dropped unattributable envelope', {
          eventId: ev?.eventId, eventType: ev?.eventType, participantId: ev?.participantId,
        })
        skippedEnvelopes++
        continue
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
      } else if (
        ev.eventType === 'QUESTIONNAIRE_COMPLETED' ||
        ev.eventType === 'STUDY_COMPLETED' ||
        ev.eventType === 'SESSION_COMPLETED'
      ) {
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

        // Only a value that cannot be represented at all is dropped (non-finite
        // or negative — the UI cannot produce either). An implausible-but-real
        // number is RECORDED AND FLAGGED, never discarded: `continue` here used
        // to delete the whole trial on a console.warn nobody reads, which is
        // silent data loss. Excluding an out-of-band trial is an analysis
        // decision, and it can only be made if the row exists.
        if (!valInitial.valid || !valFinal.valid) {
          console.warn(
            `[telemetry] unrepresentable estimate for ${ev.participantId} trial ${ev.trialId} — row not written:`,
            { valInitial, valFinal }
          )
          continue
        }

        const scenario = getScenarioById(ev.trialId)
        const isPractice = Boolean(p.isPractice)

        // ── Authoritative resolution ────────────────────────────────────────
        // Scored trials take condition, correctness, error direction, AI value
        // and ground truth from the server-side plan. Practice trials have no
        // plan entry and fall back to the scenario definition.
        const plan = planByParticipant.get(ev.participantId)
        const planItem = isPractice ? null : plan?.byTrial.get(ev.trialId)
        const mode = modeByParticipant.get(ev.participantId)

        const condition = mode?.condition ?? plan?.doc?.condition ?? ev.condition ?? null
        const participantType = mode?.participantType ?? plan?.doc?.participantType ?? ev.participantType ?? null

        const isCorrect = planItem
          ? Boolean(planItem.isCorrect)
          : (isPractice ? (p.isCorrect != null ? Boolean(p.isCorrect) : null) : null)
        const errorDirection = planItem
          ? planItem.errorDirection
          : (isPractice ? (p.errorDirection || 'na') : null)

        const groundTruthOptimal = planItem?.groundTruthOptimal
          ?? scenario?.groundTruthOptimal
          ?? scenario?.recommendation?.correct
          ?? scenario?.recommendation?.optimal
          ?? null

        const authoritativeAI = planItem?.recommendation ?? (
          scenario && typeof scenario.recommendation === 'object'
            ? (isCorrect === false
                ? (scenario.recommendation.incorrect ?? scenario.recommendation.active)
                : (scenario.recommendation.correct ?? scenario.recommendation.optimal))
            : null
        )

        const sanitizedInitial = valInitial.sanitized
        const sanitizedFinal = valFinal.sanitized
        const clientAI = Number(p.aiRecommendation)
        const sanitizedAI = Number.isFinite(Number(authoritativeAI)) ? Number(authoritativeAI) : clientAI

        // Integrity flags — recorded, never silently corrected, so a tampered or
        // diverged session is visible in the export rather than invisible in it.
        const integrityFlags = []
        if (!isPractice && !planItem) integrityFlags.push('NO_SERVER_PLAN')
        if (Number.isFinite(clientAI) && Number.isFinite(Number(authoritativeAI)) && clientAI !== Number(authoritativeAI)) {
          integrityFlags.push('AI_VALUE_MISMATCH')
        }
        if (ev.condition && condition && ev.condition !== condition) integrityFlags.push('CONDITION_MISMATCH')
        if (valInitial.inBand === false) integrityFlags.push('INITIAL_ESTIMATE_OUT_OF_BAND')
        if (valFinal.inBand === false) integrityFlags.push('FINAL_ESTIMATE_OUT_OF_BAND')
        if (p.isCorrect != null && isCorrect != null && Boolean(p.isCorrect) !== isCorrect) {
          integrityFlags.push('CORRECTNESS_MISMATCH')
        }

        // §9 — per-trial time floor. Flagged at write time; the exclusion itself
        // stays an explicit analysis decision.
        const trialDurationMs = Number(p.totalTrialDwellMs) || 0
        const belowTimeFloor = trialDurationMs > 0 && trialDurationMs < (CONFIG.MIN_TRIAL_DURATION_MS || 0)

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
                condition,
                participantType,
                trialId: ev.trialId,
                scenarioType,
                isPractice,
                trialPosition: planItem?.orderIndex ?? (Number(p.orderIndex) || null),
                isCorrect,
                errorDirection,
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

                // Per-step dwell (Appendix C.4)
                step1DwellMs: Number(p.step1DwellMs) || 0,
                step2DwellMs: Number(p.step2DwellMs) || 0,
                step3DwellMs: Number(p.step3DwellMs) || 0,
                step4DwellMs: Number(p.step4DwellMs) || 0,
                totalTrialDwellMs: trialDurationMs,
                step1ActiveDwellMs: Number(p.step1ActiveDwellMs) || 0,
                step2ActiveDwellMs: Number(p.step2ActiveDwellMs) || 0,
                step3ActiveDwellMs: Number(p.step3ActiveDwellMs) || 0,
                step4ActiveDwellMs: Number(p.step4ActiveDwellMs) || 0,
                totalActiveDwellMs: Number(p.totalActiveDwellMs) || 0,
                totalAwayMs:        Number(p.totalAwayMs) || 0,

                // Behavioural log (Appendix C.4)
                scrollDepthPct: Number(p.scrollDepthPct) || 0,
                chartRevisitCount: Number(p.chartRevisitCount) || 0,
                interactionCount: Number(p.interactionCount) || 0,

                // Integrity & exclusion flags
                belowTimeFloor,
                minTrialDurationMs: CONFIG.MIN_TRIAL_DURATION_MS || null,
                integrityFlags,
                clientReportedCondition: ev.condition || null,
                clientReportedAiRecommendation: Number.isFinite(clientAI) ? clientAI : null,
                isThinkAloud: Boolean(mode?.isThinkAloud),

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
        if (p.nasaTlx || p.numeracy || p.domainExperience || p.expertReliance) {
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
                  expertReliance: {
                    relianceOnOwnHeuristics: p.expertReliance?.relianceOnOwnHeuristics ?? null,
                    taskRealism:             p.expertReliance?.taskRealism ?? null,
                    heuristicDescription:    p.expertReliance?.heuristicDescription ?? null,
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
      skippedEnvelopes,
      trialsRecorded: trialResultsToUpsert.length,
      postTasksRecorded: postTaskResponsesToUpsert.length,
    })
  } catch (error) {
    console.error('[Telemetry API POST Error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
