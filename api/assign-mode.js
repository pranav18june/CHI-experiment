import { connectToDatabase } from '../lib/mongodb.js'
import ParticipantMode from '../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../lib/models/ParticipantTrialPlan.js'
import ModeCounter from '../lib/models/ModeCounter.js'
import { getScenarioById } from '../src/scenarios/index.js'
import { generateParticipantTrialPlan, validateTrialPlan, toClientTrialPlan } from '../src/utils/counterbalance.js'
import { CONFIG } from '../src/config/index.js'
import { applyCors } from '../lib/http.js'
import {
  CONDITIONS,
  SCHEDULE_KEYS,
  assignmentForSequence,
  createServerParticipantId,
} from '../lib/assignment.js'

export { CONDITIONS, SCHEDULE_KEYS }
export const PARTICIPANT_TYPES = ['novice', 'expert']

/**
 * 2×4 Between-Subjects Balanced Condition & Counterbalanced Trial Plan Assignment API
 *
 * GET  /api/assign-mode?participantId=P-XXXXX
 *   Idempotent lookup — returns the assigned condition, participantType, and 12-trial plan.
 *
 * POST /api/assign-mode  { participantType: "novice" | "expert", priorParticipantId?: "P-XXXXX" }
 *   1. Issues the canonical, server-generated participantId.
 *   2. Atomically increments the expertise group's assignment sequence and derives
 *      the condition (permuted blocks of 4) and correctness schedule (blocks of 8)
 *      from it — see lib/assignment.js. No read-then-write race.
 *   3. Snapshots the exact stimulus text, values, ground truth, and content hash
 *      into ParticipantTrialPlan.
 *   4. Persists ParticipantMode (status: 'assigned') and ParticipantTrialPlan.
 *
 * `priorParticipantId` is the id the client used for its pre-assignment events
 * (session start, consent). It is recorded so those events can be re-linked; it
 * is never trusted as an identity.
 */
export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'GET,OPTIONS,POST' })) return

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
        participantId,
        condition,
        surveyMode: condition,
        participantType,
        status: existing.status || 'assigned',
        trialPlan: planDoc ? toClientTrialPlan(planDoc.trials) : null,
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

  const body = req.body || {}
  const group = body.participantType === 'expert' ? 'expert' : 'novice'
  const priorParticipantId = typeof body.priorParticipantId === 'string' ? body.priorParticipantId : null

  try {
    await connectToDatabase()

    // ── Idempotency ─────────────────────────────────────────────────────────
    // A retried POST (network hiccup, double submit) must not consume a second
    // slot in the sequence. If this browser already holds an assignment, return it.
    if (priorParticipantId) {
      const already = await ParticipantMode.findOne({
        $or: [{ participantId: priorParticipantId }, { priorParticipantId }],
      }).lean()
      if (already) {
        const planDoc = await ParticipantTrialPlan.findOne({ participantId: already.participantId }).lean()
        return res.status(200).json({
          participantId: already.participantId,
          condition: already.condition,
          surveyMode: already.condition,
          participantType: already.participantType || group,
          status: already.status || 'assigned',
          trialPlan: planDoc ? toClientTrialPlan(planDoc.trials) : null,
          alreadyAssigned: true,
        })
      }
    }

    // ── Atomic sequence increment (the whole race fix) ───────────────────────
    const counter = await ModeCounter.findOneAndUpdate(
      { _id: 'global' },
      { $inc: { [`${group}.seq`]: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()

    const seq = counter?.[group]?.seq ?? 1
    const { condition, planIndex, orderIndex, scheduleIndex, scheduleKey } = assignmentForSequence(group, seq)

    const participantId = createServerParticipantId()

    // ── Persist the plan before the mode record ─────────────────────────────
    // If the process dies between the two writes, an orphan plan is harmless;
    // an orphan mode record without a plan is not (advice would fall back).
    const trialsPlan = generateParticipantTrialPlan(planIndex, getScenarioById, condition)

    // Fail closed: a plan that violates a §5.6 constraint must never be served.
    const planCheck = validateTrialPlan(trialsPlan)
    if (!planCheck.valid) {
      console.error('[assign-mode] generated plan failed validation', planCheck.problems)
      return res.status(500).json({ error: 'Trial plan validation failed', problems: planCheck.problems })
    }

    await ParticipantTrialPlan.findOneAndUpdate(
      { participantId },
      {
        $setOnInsert: {
          participantId,
          participantType: group,
          condition,
          planIndex,
          orderIndex,
          scheduleIndex,
          protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
          applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
          trials: trialsPlan,
          assignedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )

    const record = await ParticipantMode.findOneAndUpdate(
      { participantId },
      {
        $setOnInsert: {
          participantId,
          priorParticipantId,
          participantType: group,
          condition,
          assignmentSeq: seq,
          planIndex,
          orderIndex,
          scheduleIndex,
          status: 'assigned',
          protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
          applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
          assignedAt: new Date(),
          lastActiveAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )

    // Descriptive counts for the admin dashboard. Not the assignment authority
    // (that is `seq` + ParticipantMode), but awaited so the live dashboard does
    // not under-report: fire-and-forget drifts because the lambda can freeze
    // before the write lands. A failure here must never fail the assignment.
    try {
      await ModeCounter.updateOne(
        { _id: 'global' },
        { $inc: { [`${group}.${condition}`]: 1, [`${group}.${scheduleKey}`]: 1 } }
      )
    } catch (err) {
      console.warn('[assign-mode] descriptive counter update failed', err.message)
    }

    return res.status(200).json({
      participantId,
      condition: record.condition || condition,
      surveyMode: record.condition || condition,
      participantType: group,
      status: 'assigned',
      planIndex,
      orderIndex,
      scheduleIndex,
      assignmentSeq: seq,
      trialPlan: toClientTrialPlan(trialsPlan),
    })
  } catch (error) {
    console.error('[assign-mode error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
