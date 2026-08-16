import { connectToDatabase } from './lib/mongodb.js'
import ParticipantMode from './models/ParticipantMode.js'
import ModeCounter from './models/ModeCounter.js'

export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']
export const PARTICIPANT_TYPES = ['novice', 'expert']

/**
 * 2×4 Between-Subjects Balanced Condition Assignment API
 *
 * GET  /api/assign-mode?participantId=P-XXXXX
 *   Idempotent lookup — returns the assigned condition and participantType.
 *
 * POST /api/assign-mode  { participantId: "P-XXXXX", participantType: "novice" | "expert" }
 *   Atomically assigns a condition (c0, c1, c2, c3) balanced within the participant's
 *   own expertise group (Novice vs. Expert).
 *
 * Design: 2×4 Fully Crossed Factorial Design
 *   - Factor 1: Expertise [Novice, Expert]
 *   - Factor 2: Explanation Condition [c0, c1, c2, c3]
 *
 * Balancing Algorithm (Within-Group Min-Count)
 * ─────────────────────────────────────────────
 * 1. Identify participant group: type = participantType === 'expert' ? 'expert' : 'novice'.
 * 2. Read current counter for that group: { c0, c1, c2, c3 }.
 * 3. Find minCount = min(c0, c1, c2, c3) within that group.
 * 4. Collect all conditions in that group where count === minCount.
 * 5. Uniformly pick one condition from the tied pool.
 * 6. Atomically increment that group's condition counter: $inc: { [`${type}.${chosen}`]: 1 }.
 * 7. Upsert ParticipantMode record with $setOnInsert (idempotent).
 *
 * Ensures:
 *   - Separate balance across all 4 conditions for Novices (max delta ≤ 1).
 *   - Separate balance across all 4 conditions for Experts (max delta ≤ 1).
 *   - Adequate per-cell statistical depth across all 8 cells in the 2×4 matrix.
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // ── GET: idempotent lookup ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { participantId } = req.query
    if (!participantId) {
      return res.status(400).json({ error: 'Missing participantId parameter' })
    }

    try {
      await connectToDatabase()
      const existing = await ParticipantMode.findOne({ participantId }).lean()
      if (!existing) {
        return res.status(404).json({ error: 'No condition assigned yet for this participant' })
      }
      const condition = existing.condition || existing.surveyMode
      const participantType = existing.participantType || 'novice'
      return res.status(200).json({ condition, surveyMode: condition, participantType, participantId })
    } catch (error) {
      console.error('[assign-mode GET error]', error)
      return res.status(500).json({ error: 'Internal Server Error', message: error.message })
    }
  }

  // ── POST: assign condition within expertise group ─────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { participantId, participantType } = req.body || {}
  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId in request body' })
  }

  const group = participantType === 'expert' ? 'expert' : 'novice'

  try {
    await connectToDatabase()

    // ── Step 1: Check if already assigned ───────────────────────────────────
    const existing = await ParticipantMode.findOne({ participantId }).lean()
    if (existing) {
      const condition = existing.condition || existing.surveyMode
      const type = existing.participantType || group
      return res.status(200).json({ condition, surveyMode: condition, participantType: type, participantId, alreadyAssigned: true })
    }

    // ── Step 2: Read current 2×4 counter document ───────────────────────────
    let counter = await ModeCounter.findById('global').lean()
    if (!counter || !counter[group]) {
      await ModeCounter.findOneAndUpdate(
        { _id: 'global' },
        {
          $setOnInsert: {
            novice: { c0: 0, c1: 0, c2: 0, c3: 0 },
            expert: { c0: 0, c1: 0, c2: 0, c3: 0 },
          },
        },
        { upsert: true, new: true }
      )
      counter = {
        novice: { c0: 0, c1: 0, c2: 0, c3: 0 },
        expert: { c0: 0, c1: 0, c2: 0, c3: 0 },
      }
    }

    // ── Step 3: Pick minimum-count condition within the participant's group ──
    const groupCounts = counter[group] || {}
    const counts = {
      c0: groupCounts.c0 ?? 0,
      c1: groupCounts.c1 ?? 0,
      c2: groupCounts.c2 ?? 0,
      c3: groupCounts.c3 ?? 0,
    }

    const minCount = Math.min(...CONDITIONS.map((c) => counts[c]))
    const tiedConditions = CONDITIONS.filter((c) => counts[c] === minCount)
    const chosenCondition = tiedConditions[Math.floor(Math.random() * tiedConditions.length)]

    // ── Step 4: Atomically increment within that group ───────────────────────
    await ModeCounter.findOneAndUpdate(
      { _id: 'global' },
      { $inc: { [`${group}.${chosenCondition}`]: 1 } },
      { upsert: true }
    )

    // ── Step 5: Persist participant record ───────────────────────────────────
    const record = await ParticipantMode.findOneAndUpdate(
      { participantId },
      {
        $setOnInsert: {
          participantId,
          participantType: group,
          condition: chosenCondition,
          assignedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )

    const assigned = record.condition || chosenCondition
    return res.status(200).json({
      condition: assigned,
      surveyMode: assigned,
      participantType: group,
      participantId,
    })
  } catch (error) {
    console.error('[assign-mode POST error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
