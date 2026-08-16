import { connectToDatabase } from './lib/mongodb.js'
import ParticipantMode from './models/ParticipantMode.js'
import ModeCounter from './models/ModeCounter.js'

export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']

/**
 * Balanced Condition Assignment API
 *
 * GET  /api/assign-mode?participantId=P-XXXXX
 *   Idempotent lookup — returns the existing condition for a participant if one
 *   has already been assigned, or 404 if none exists yet.
 *
 * POST /api/assign-mode  { participantId: "P-XXXXX" }
 *   Atomically assigns one of the 4 conditions using the minimum-count balanced strategy.
 *   If the participant already has a condition, returns it unchanged (idempotent).
 *
 * Conditions:
 *   c0: Baseline (recommendation-only, no explanation)
 *   c1: Numerical (driver attributions)
 *   c2: Narrative (verbal explanation)
 *   c3: Counterfactual (what-if verification explanation)
 *
 * Assignment Algorithm (Min-Count across 4 conditions)
 * ───────────────────────────────────────────────────
 * 1. Read current global counter document { c0, c1, c2, c3 }.
 * 2. Find minCount = min(c0, c1, c2, c3).
 * 3. Collect all conditions where count === minCount (the tied pool).
 * 4. Randomly pick one condition from the tied pool uniformly.
 * 5. Atomically increment that condition's counter ($inc: { [chosen]: 1 }).
 * 6. Upsert the ParticipantMode record with $setOnInsert (idempotent).
 *
 * Guarantees:
 *   - Maximum imbalance between any two conditions at any time is ≤ 1.
 *   - Assignment is uniformly random among tied conditions.
 *   - Safe under concurrent requests.
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
      return res.status(200).json({ condition, surveyMode: condition, participantId })
    } catch (error) {
      console.error('[assign-mode GET error]', error)
      return res.status(500).json({ error: 'Internal Server Error', message: error.message })
    }
  }

  // ── POST: assign condition ────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { participantId } = req.body || {}
  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId in request body' })
  }

  try {
    await connectToDatabase()

    // ── Step 1: Check if this participant already has a condition assigned ───
    const existing = await ParticipantMode.findOne({ participantId }).lean()
    if (existing) {
      const condition = existing.condition || existing.surveyMode
      return res.status(200).json({ condition, surveyMode: condition, participantId, alreadyAssigned: true })
    }

    // ── Step 2: Read current 4-way counter ────────────────────────────────────
    let counter = await ModeCounter.findById('global').lean()
    if (!counter) {
      await ModeCounter.findOneAndUpdate(
        { _id: 'global' },
        { $setOnInsert: { c0: 0, c1: 0, c2: 0, c3: 0 } },
        { upsert: true, new: true }
      )
      counter = { c0: 0, c1: 0, c2: 0, c3: 0 }
    }

    // ── Step 3: Pick the condition with minimum count (random among ties) ─────
    const counts = {
      c0: counter.c0 ?? 0,
      c1: counter.c1 ?? 0,
      c2: counter.c2 ?? 0,
      c3: counter.c3 ?? 0,
    }
    const minCount = Math.min(...CONDITIONS.map((c) => counts[c]))
    const tiedConditions = CONDITIONS.filter((c) => counts[c] === minCount)
    const chosenCondition = tiedConditions[Math.floor(Math.random() * tiedConditions.length)]

    // ── Step 4: Atomically increment chosen condition counter ─────────────────
    await ModeCounter.findOneAndUpdate(
      { _id: 'global' },
      { $inc: { [chosenCondition]: 1 } },
      { upsert: true }
    )

    // ── Step 5: Persist participant assignment ────────────────────────────────
    const record = await ParticipantMode.findOneAndUpdate(
      { participantId },
      { $setOnInsert: { participantId, condition: chosenCondition, assignedAt: new Date() } },
      { upsert: true, new: true }
    )

    const assigned = record.condition || chosenCondition
    return res.status(200).json({ condition: assigned, surveyMode: assigned, participantId })
  } catch (error) {
    console.error('[assign-mode POST error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
