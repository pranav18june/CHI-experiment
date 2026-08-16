import { connectToDatabase } from '../../lib/mongodb.js'
import ParticipantMode from '../../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../../lib/models/ParticipantTrialPlan.js'
import ModeCounter from '../../lib/models/ModeCounter.js'

export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']
export const SCHEDULE_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']

/**
 * Reclaim Abandoned Participants & Reconcile ModeCounter API
 *
 * POST /api/admin/reclaim-abandoned
 * Header: x-admin-secret: <ADMIN_SECRET>
 * Body: {
 *   abandonmentHours: 2,   // Optional: default 2 hours
 *   forceReconcile: true   // If true, recalculates ModeCounter directly from active participants
 * }
 *
 * Finds participants whose lifecycle status is 'assigned' with no subsequent activity
 * after N hours, marks them as 'abandoned', and reconciles ModeCounter to prevent
 * per-cell depth drift in the min-count balancing algorithm.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const secret = process.env.ADMIN_SECRET || 'study-admin'
  const provided = req.headers['x-admin-secret']
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await connectToDatabase()

    const body = req.body || {}
    const abandonmentHours = Number(body.abandonmentHours || req.query.abandonmentHours || 2)
    const cutoffTime = new Date(Date.now() - abandonmentHours * 3600 * 1000)

    // 1. Find assigned participants inactive beyond the cutoff threshold
    const abandonedCandidates = await ParticipantMode.find({
      status: 'assigned',
      assignedAt: { $lt: cutoffTime },
    }).lean()

    let reclaimedCount = 0
    if (abandonedCandidates.length > 0) {
      const abandonedIds = abandonedCandidates.map((p) => p.participantId)
      const updateResult = await ParticipantMode.updateMany(
        { participantId: { $in: abandonedIds }, status: 'assigned' },
        { $set: { status: 'abandoned', lastActiveAt: new Date() } }
      )
      reclaimedCount = updateResult.modifiedCount || abandonedCandidates.length
    }

    // 2. Perform ground-truth counter reconciliation from active/completed participants
    const activeParticipants = await ParticipantMode.find({
      status: { $in: ['assigned', 'in_progress', 'completed'] },
    }).lean()

    const activePlans = await ParticipantTrialPlan.find({}).lean()
    const planMap = {}
    for (const pl of activePlans) {
      planMap[pl.participantId] = pl.scheduleIndex
    }

    const reconciledCounts = {
      novice: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
      expert: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
    }

    for (const p of activeParticipants) {
      const group = p.participantType === 'expert' ? 'expert' : 'novice'
      const cond = p.condition && reconciledCounts[group][p.condition] !== undefined ? p.condition : 'c0'
      const sIdx = planMap[p.participantId] != null ? planMap[p.participantId] : 0
      const sKey = `s${sIdx % 8}`

      reconciledCounts[group][cond]++
      reconciledCounts[group][sKey]++
    }

    // Update ModeCounter document atomically
    await ModeCounter.findOneAndUpdate(
      { _id: 'global' },
      {
        $set: {
          novice: reconciledCounts.novice,
          expert: reconciledCounts.expert,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return res.status(200).json({
      status: 'ok',
      abandonmentHoursThreshold: abandonmentHours,
      reclaimedCount,
      activeParticipantsCount: activeParticipants.length,
      reconciledCounts,
    })
  } catch (error) {
    console.error('[Reclaim API Error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
