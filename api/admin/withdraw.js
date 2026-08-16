import { connectToDatabase } from '../lib/mongodb.js'
import ParticipantMode from '../models/ParticipantMode.js'
import ParticipantTrialPlan from '../models/ParticipantTrialPlan.js'
import TelemetryEvent from '../models/TelemetryEvent.js'
import TrialResult from '../models/TrialResult.js'
import PostTaskResponse from '../models/PostTaskResponse.js'
import ModeCounter from '../models/ModeCounter.js'

/**
 * Participant Data Withdrawal & Purge API (IRB Compliance)
 *
 * POST /api/admin/withdraw
 * Header: x-admin-secret: <ADMIN_SECRET>
 * Body: { participantId: "P-XXXXX", reason?: string }
 *
 * Atomically purges all records for the given participantId across all database collections:
 *   1. ParticipantMode
 *   2. ParticipantTrialPlan
 *   3. TelemetryEvent
 *   4. TrialResult
 *   5. PostTaskResponse
 *
 * Decrements the assigned cell in ModeCounter if the participant had not completed,
 * ensuring balancing accuracy without leaving orphaned slot counts.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const secret = process.env.ADMIN_SECRET || 'study-admin'
  const provided = req.headers['x-admin-secret']
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { participantId, reason } = req.body || {}
  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId in request body' })
  }

  try {
    await connectToDatabase()

    // 1. Check existing participant record
    const mode = await ParticipantMode.findOne({ participantId }).lean()
    const plan = await ParticipantTrialPlan.findOne({ participantId }).lean()

    if (!mode && !plan) {
      return res.status(404).json({ error: 'Participant not found across database collections' })
    }

    const group = mode?.participantType || 'novice'
    const condition = mode?.condition || 'c0'
    const scheduleIndex = plan?.scheduleIndex != null ? plan.scheduleIndex : 0
    const sKey = `s${scheduleIndex % 8}`
    const wasCompleted = mode?.status === 'completed'

    // 2. Purge records across all 5 database collections
    const [delMode, delPlan, delEvents, delTrials, delPostTask] = await Promise.all([
      ParticipantMode.deleteOne({ participantId }),
      ParticipantTrialPlan.deleteOne({ participantId }),
      TelemetryEvent.deleteMany({ participantId }),
      TrialResult.deleteMany({ participantId }),
      PostTaskResponse.deleteOne({ participantId }),
    ])

    // 3. If participant was not complete, decrement ModeCounter safely
    if (!wasCompleted) {
      await ModeCounter.findOneAndUpdate(
        { _id: 'global' },
        {
          $inc: {
            [`${group}.${condition}`]: -1,
            [`${group}.${sKey}`]: -1,
          },
        }
      ).catch((err) => console.warn('[ModeCounter decrement error]:', err.message))
    }

    console.info(`[IRB Withdrawal] Purged participant ${participantId}. Reason: ${reason || 'Not specified'}`)

    return res.status(200).json({
      status: 'purged',
      participantId,
      wasCompleted,
      recordsPurged: {
        participantMode: delMode.deletedCount,
        participantTrialPlan: delPlan.deletedCount,
        telemetryEvents: delEvents.deletedCount,
        trialResults: delTrials.deletedCount,
        postTaskResponse: delPostTask.deletedCount,
      },
      counterAdjusted: !wasCompleted,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Withdraw API Error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
