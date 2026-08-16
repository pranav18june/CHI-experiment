import { connectToDatabase } from '../lib/mongodb.js'
import TelemetryEvent from '../models/TelemetryEvent.js'
import TrialResult from '../models/TrialResult.js'
import ParticipantTrialPlan from '../models/ParticipantTrialPlan.js'
import { getScenarioById, getExplanation } from '../../src/scenarios/index.js'

/**
 * Helper to compute Weight of Advice (WoA).
 * WoA = (Final - Initial) / (Advice - Initial)
 */
function calculateWoA(initial, advice, final) {
  if (advice === initial) return null
  const woa = (final - initial) / (advice - initial)
  return Number.isFinite(woa) ? Math.round(woa * 10000) / 10000 : null
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
  // Resolves AI advice and explanation based on participant's assigned counterbalanced plan
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

      // If this event is a completed trial decision (FINAL_ESTIMATE_SUBMITTED), extract analytical row
      if (ev.eventType === 'FINAL_ESTIMATE_SUBMITTED' && ev.payload && ev.trialId) {
        const p = ev.payload
        const woa = calculateWoA(p.initialEstimate, p.aiRecommendation, p.finalEstimate)

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
    }

    // Bulk insert events for extreme high-throughput performance
    if (eventDocs.length > 0) {
      await TelemetryEvent.insertMany(eventDocs, { ordered: false })
    }

    // Bulk upsert TrialResult analytical records
    if (trialResultsToUpsert.length > 0) {
      await TrialResult.bulkWrite(trialResultsToUpsert, { ordered: false })
    }

    return res.status(200).json({
      status: 'ok',
      eventsLogged: eventDocs.length,
      trialsRecorded: trialResultsToUpsert.length,
    })
  } catch (error) {
    console.error('[Telemetry API POST Error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
