import { connectToDatabase } from '../lib/mongodb.js'
import ParticipantMode from '../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../lib/models/ParticipantTrialPlan.js'
import ModeCounter from '../lib/models/ModeCounter.js'
import { getScenarioById } from '../src/scenarios/index.js'
import { generateParticipantTrialPlan, CORRECTNESS_SCHEDULES } from '../src/utils/counterbalance.js'
import { CONFIG } from '../src/config/index.js'

export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']
export const PARTICIPANT_TYPES = ['novice', 'expert']
export const SCHEDULE_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']

/**
 * 2×4 Between-Subjects Balanced Condition & Counterbalanced Trial Plan Assignment API
 *
 * GET  /api/assign-mode?participantId=P-XXXXX
 *   Idempotent lookup — returns the assigned condition, participantType, and 12-trial plan.
 *
 * POST /api/assign-mode  { participantId: "P-XXXXX", participantType: "novice" | "expert" }
 *   1. Atomically assigns a condition (c0, c1, c2, c3) using min-count balancing within the
 *      participant's own expertise group (Novice vs. Expert), breaking ties uniformly at random.
 *   2. Atomically assigns a counterbalanced 12-trial correctness schedule (s0 to s7) using
 *      min-count balancing within the participant's own expertise group, breaking ties uniformly at random.
 *   3. Snapshots the exact stimulus text, values, ground truth, and content hash into ParticipantTrialPlan.
 *   4. Persists both ParticipantMode (status: 'assigned') and ParticipantTrialPlan in MongoDB atomically.
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

      const planDoc = await ParticipantTrialPlan.findOne({ participantId }).lean()

      return res.status(200).json({
        condition,
        surveyMode: condition,
        participantType,
        participantId,
        status: existing.status || 'assigned',
        trialPlan: planDoc ? planDoc.trials : null,
      })
    } catch (error) {
      console.error('[assign-mode GET error]', error)
      return res.status(500).json({ error: 'Internal Server Error', message: error.message })
    }
  }

  // ── POST: assign condition & 12-trial plan within expertise group ──────────
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
      const planDoc = await ParticipantTrialPlan.findOne({ participantId }).lean()
      return res.status(200).json({
        condition,
        surveyMode: condition,
        participantType: type,
        participantId,
        status: existing.status || 'assigned',
        trialPlan: planDoc ? planDoc.trials : null,
        alreadyAssigned: true,
      })
    }

    // ── Step 2: Read current 2×4 counter document ───────────────────────────
    let counter = await ModeCounter.findById('global').lean()
    if (!counter || !counter[group]) {
      await ModeCounter.findOneAndUpdate(
        { _id: 'global' },
        {
          $setOnInsert: {
            novice: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
            expert: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
          },
        },
        { upsert: true, new: true }
      )
      counter = {
        novice: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
        expert: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
      }
    }

    const groupCounts = counter[group] || {}

    // ── Step 3A: Min-Count Condition Selection (Ties broken uniformly at random) ──
    const condCounts = {
      c0: groupCounts.c0 ?? 0,
      c1: groupCounts.c1 ?? 0,
      c2: groupCounts.c2 ?? 0,
      c3: groupCounts.c3 ?? 0,
    }
    const minCondCount = Math.min(...CONDITIONS.map((c) => condCounts[c]))
    const tiedConditions = CONDITIONS.filter((c) => condCounts[c] === minCondCount)
    const chosenCondition = tiedConditions[Math.floor(Math.random() * tiedConditions.length)]

    // ── Step 3B: Min-Count Schedule Selection (Ties broken uniformly at random) ──
    const schedCounts = {}
    for (const sk of SCHEDULE_KEYS) {
      schedCounts[sk] = groupCounts[sk] ?? 0
    }
    const minSchedCount = Math.min(...SCHEDULE_KEYS.map((sk) => schedCounts[sk]))
    const tiedSchedules = SCHEDULE_KEYS.filter((sk) => schedCounts[sk] === minSchedCount)
    const chosenSchedKey = tiedSchedules[Math.floor(Math.random() * tiedSchedules.length)]
    const scheduleIndex = parseInt(chosenSchedKey.replace('s', ''), 10)

    // ── Step 4: Atomically increment both condition & schedule counters ───────
    await ModeCounter.findOneAndUpdate(
      { _id: 'global' },
      {
        $inc: {
          [`${group}.${chosenCondition}`]: 1,
          [`${group}.${chosenSchedKey}`]: 1,
        },
      },
      { upsert: true }
    )

    // ── Step 5: Generate & Persist Participant Trial Plan with Stimulus Snapshot ──
    const trialsPlan = generateParticipantTrialPlan(scheduleIndex, getScenarioById, chosenCondition)

    await ParticipantTrialPlan.findOneAndUpdate(
      { participantId },
      {
        $setOnInsert: {
          participantId,
          participantType: group,
          condition: chosenCondition,
          scheduleIndex,
          protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
          applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
          trials: trialsPlan,
          assignedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )

    // ── Step 6: Persist participant mode record (status: 'assigned') ──────────
    const record = await ParticipantMode.findOneAndUpdate(
      { participantId },
      {
        $setOnInsert: {
          participantId,
          participantType: group,
          condition: chosenCondition,
          status: 'assigned',
          protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
          applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
          assignedAt: new Date(),
          lastActiveAt: new Date(),
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
      status: 'assigned',
      scheduleIndex,
      trialPlan: trialsPlan,
    })
  } catch (error) {
    console.error('[assign-mode error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
