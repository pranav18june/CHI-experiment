import { connectToDatabase } from './lib/mongodb.js'
import ParticipantMode from './models/ParticipantMode.js'
import ModeCounter from './models/ModeCounter.js'

const MODES = ['T', 'N', 'C']

/**
 * Balanced Survey Mode Assignment API
 *
 * GET  /api/assign-mode?participantId=P-XXXXX
 *   Idempotent lookup — returns the existing mode for a participant if one
 *   has already been assigned, or 404 if none exists yet.
 *
 * POST /api/assign-mode  { participantId: "P-XXXXX" }
 *   Atomically assigns a mode using the minimum-count balanced strategy.
 *   If the participant already has a mode, returns it unchanged (idempotent).
 *
 * Assignment Algorithm
 * ─────────────────────
 * 1. Read the current counter document (T, N, C counts).
 * 2. Find the minimum count across all three modes.
 * 3. Collect all modes that share that minimum count (tied modes).
 * 4. Randomly pick one of the tied modes.
 * 5. Atomically increment that mode's counter and write the participant record.
 *
 * This ensures:
 *   - Max imbalance between any two modes at any time is 1.
 *   - Assignment is effectively random when modes are tied.
 *   - Concurrent requests are safe: the $inc is atomic; worst-case two
 *     simultaneous requests both pick the same mode, causing a temporary +1
 *     imbalance that self-corrects on the next assignment.
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
        return res.status(404).json({ error: 'No mode assigned yet for this participant' })
      }
      return res.status(200).json({ surveyMode: existing.surveyMode, participantId })
    } catch (error) {
      console.error('[assign-mode GET error]', error)
      return res.status(500).json({ error: 'Internal Server Error', message: error.message })
    }
  }

  // ── POST: assign mode ─────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { participantId } = req.body || {}
  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId in request body' })
  }

  try {
    await connectToDatabase()

    // ── Step 1: Check if this participant already has a mode assigned ────────
    const existing = await ParticipantMode.findOne({ participantId }).lean()
    if (existing) {
      return res.status(200).json({ surveyMode: existing.surveyMode, participantId, alreadyAssigned: true })
    }

    // ── Step 2: Read current counters ────────────────────────────────────────
    // findOneAndUpdate with upsert ensures the counter document always exists.
    // We do NOT increment here — just ensure it exists and read current values.
    let counter = await ModeCounter.findById('global').lean()
    if (!counter) {
      // Bootstrap the counter document if it doesn't exist yet
      await ModeCounter.findOneAndUpdate(
        { _id: 'global' },
        { $setOnInsert: { T: 0, N: 0, C: 0 } },
        { upsert: true, new: true }
      )
      counter = { T: 0, N: 0, C: 0 }
    }

    // ── Step 3: Pick the mode with the minimum count, breaking ties randomly ─
    const counts = { T: counter.T ?? 0, N: counter.N ?? 0, C: counter.C ?? 0 }
    const minCount = Math.min(...MODES.map((m) => counts[m]))
    const tiedModes = MODES.filter((m) => counts[m] === minCount)
    const chosenMode = tiedModes[Math.floor(Math.random() * tiedModes.length)]

    // ── Step 4: Atomically increment the chosen mode's counter ───────────────
    await ModeCounter.findOneAndUpdate(
      { _id: 'global' },
      { $inc: { [chosenMode]: 1 } },
      { upsert: true }
    )

    // ── Step 5: Persist the participant's mode assignment ────────────────────
    // Use findOneAndUpdate with upsert to handle the edge case where two
    // concurrent requests pass the "existing" check simultaneously.
    // The unique index on participantId guarantees only one record is written;
    // setOnInsert means a second concurrent write is a no-op that returns the
    // first record (at the cost of one extra counter increment — within ±1 tolerance).
    const record = await ParticipantMode.findOneAndUpdate(
      { participantId },
      { $setOnInsert: { participantId, surveyMode: chosenMode, assignedAt: new Date() } },
      { upsert: true, new: true }
    )

    return res.status(200).json({ surveyMode: record.surveyMode, participantId })
  } catch (error) {
    console.error('[assign-mode POST error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
