import { connectToDatabase } from '../../lib/mongodb.js'
import TelemetryEvent from '../../lib/models/TelemetryEvent.js'
import TrialResult from '../../lib/models/TrialResult.js'
import ParticipantMode from '../../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../../lib/models/ParticipantTrialPlan.js'
import { applyCors, rejectUnauthorizedAdmin } from '../../lib/http.js'

const SCORED_TRIAL_TOTAL = 12

/**
 * Admin Participants API
 *
 * GET /api/admin/participants
 * Header: x-admin-secret: <ADMIN_SECRET env var — required, 16+ chars, no default>
 *
 * Returns an aggregated summary of all participants for the research admin dashboard:
 *   - 2×4 Factorial breakdown (Novice vs Expert × C0/C1/C2/C3)
 *   - Latin-Square Correctness Schedule depth breakdown (S0 to S7)
 *   - Primary outcome measure: Directional Cost Regret (asymmetrically weighted)
 *   - Secondary outcome measures: Weight of Advice (WoA), Confidence, Cognitive Load
 */
export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'GET,OPTIONS,POST' })) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  // ── SECURITY & AUTHENTICATION SCOPE DECISION ──────────────────────────────
  // DELIBERATE SCOPE DECISION: Rate limiting and complex JWT/hashed token-based
  // authentication are intentionally omitted here. This platform is an internal-only
  // behavioural research platform deployed within research lab environments for
  // proctors and principal investigators, not a public-facing multi-tenant SaaS application.
  // The header-based secret check (x-admin-secret) provides a sufficient, lightweight
  // access boundary for internal study monitoring without adding operational overhead.
  if (rejectUnauthorizedAdmin(req, res)) return

  try {
    await connectToDatabase()

    // ── 1. Condition & Type assignments from ParticipantMode ─────────────────
    const modeRecords = await ParticipantMode
      .find({}, 'participantId priorParticipantId condition participantType status planIndex orderIndex assignmentSeq isThinkAloud')
      .lean()
    const modeMap = {}
    for (const r of modeRecords) {
      modeMap[r.participantId] = {
        // Never defaulted to 'c0': an unassigned participant showing as c0
        // silently inflates that cell in the live balance table.
        condition: r.condition || r.surveyMode || null,
        participantType: r.participantType || null,
        status: r.status || 'assigned',
        planIndex: r.planIndex ?? null,
        orderIndex: r.orderIndex ?? null,
        assignmentSeq: r.assignmentSeq ?? null,
        isThinkAloud: Boolean(r.isThinkAloud),
      }
    }

    // ── 1B. Trial plans from ParticipantTrialPlan for schedule depth ─────────
    // Projection matters here: the dashboard needs three integers per
    // participant, but each plan document carries the full 12-trial stimulus
    // snapshot (~6-10 KB). Without this the endpoint pulled ~5 MB on every
    // refresh at n=500, for data it then discarded.
    const planRecords = await ParticipantTrialPlan
      .find({}, 'participantId scheduleIndex orderIndex planIndex')
      .lean()
    const planMap = {}
    for (const pl of planRecords) {
      planMap[pl.participantId] = {
        scheduleIndex: pl.scheduleIndex,
        orderIndex: pl.orderIndex ?? null,
        planIndex: pl.planIndex ?? null,
      }
    }

    // ── 2. Session info per participant from TelemetryEvent ──────────────────
    const sessionAgg = await TelemetryEvent.aggregate([
      {
        $group: {
          _id: '$participantId',
          sessionStarted:  { $min: '$timestamp' },
          lastSeen:        { $max: '$timestamp' },
          condition:       { $first: '$condition' },
          participantType: { $first: '$participantType' },
        },
      },
    ])

    // Most recent screen viewed per participant
    const screenAgg = await TelemetryEvent.aggregate([
      { $match: { eventType: 'SCREEN_VIEWED' } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$participantId',
          currentPhase: { $first: '$screen' },
        },
      },
    ])
    const screenMap = {}
    for (const s of screenAgg) screenMap[s._id] = s.currentPhase

    // ── 3. Trial completion stats & outcome measures from TrialResult ────────
    const trialAgg = await TrialResult.aggregate([
      { $match: { isPractice: false } },
      {
        $group: {
          _id:                      '$participantId',
          trialsCompleted:          { $sum: 1 },
          avgWoA:                   { $avg: '$weightOfAdvice' },
          avgConfidence:            { $avg: '$finalConfidence' },
          avgCognitiveLoad:         { $avg: '$cognitiveLoad' },
          avgDirectionalCostRegret: { $avg: '$directionalCostRegret' },
          avgCostRegret:            { $avg: '$costRegret' },
          // Data-quality signals surfaced live, so a bad run is visible while it
          // is still running rather than at analysis time.
          flaggedTrials:            { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$integrityFlags', []] } }, 0] }, 1, 0] } },
          fastTrials:               { $sum: { $cond: ['$belowTimeFloor', 1, 0] } },
          avgTrialSeconds:          { $avg: { $divide: [{ $ifNull: ['$totalTrialDwellMs', 0] }, 1000] } },
        },
      },
    ])
    const trialMap = {}
    for (const t of trialAgg) trialMap[t._id] = t

    // ── 4. Build participant list ─────────────────────────────────────────────
    // Pre-assignment events (session start, consent) are recorded under the
    // browser's provisional id, which is later superseded by the server-issued
    // one. Those provisional ids must NOT appear as separate participants —
    // they would show up as phantom "unassigned" rows and inflate the total.
    const provisionalIds = new Set(
      modeRecords.map((r) => r.priorParticipantId).filter(Boolean)
    )

    const allIds = new Set([
      ...modeRecords.map((r) => r.participantId),
      ...sessionAgg.map((s) => s._id),
      ...planRecords.map((pl) => pl.participantId),
    ].filter((id) => !provisionalIds.has(id)))

    const participants = []
    let sumWoA = 0, countWoA = 0
    let sumRegret = 0, countRegret = 0

    // Map lookup, not a linear scan per participant — the previous
    // sessionAgg.find() inside this loop was O(n^2) over the whole cohort.
    const sessionMap = new Map(sessionAgg.map((s) => [s._id, s]))

    for (const pid of allIds) {
      const modeRec = modeMap[pid] || {}
      const session = sessionMap.get(pid) || {}
      const trial   = trialMap[pid] || {}
      const tc      = trial.trialsCompleted || 0
      const phase   = screenMap[pid] || session.currentPhase || 'unknown'
      const cond    = modeRec.condition || session.condition || null
      const type    = modeRec.participantType || session.participantType || null
      const planRec = planMap[pid] || {}
      const sIdx    = planRec.scheduleIndex ?? null

      if (trial.avgWoA != null) {
        sumWoA += trial.avgWoA
        countWoA++
      }
      if (trial.avgDirectionalCostRegret != null) {
        sumRegret += trial.avgDirectionalCostRegret
        countRegret++
      }

      participants.push({
        participantId:            pid,
        condition:                cond,
        participantType:          type,
        status:                   modeRec.status || (phase === 'complete' ? 'completed' : (phase === 'excluded' ? 'excluded' : (tc > 0 ? 'in_progress' : 'assigned'))),
        scheduleIndex:            sIdx,
        orderIndex:               planRec.orderIndex ?? modeRec.orderIndex ?? null,
        planIndex:                planRec.planIndex ?? modeRec.planIndex ?? null,
        assignmentSeq:            modeRec.assignmentSeq ?? null,
        isThinkAloud:             Boolean(modeRec.isThinkAloud),
        flaggedTrials:            trial.flaggedTrials || 0,
        fastTrials:               trial.fastTrials || 0,
        avgTrialSeconds:          trial.avgTrialSeconds != null ? Math.round(trial.avgTrialSeconds) : null,
        sessionStarted:           session.sessionStarted  || null,
        lastSeen:                 session.lastSeen        || null,
        currentPhase:             phase,
        trialsCompleted:          tc,
        totalTrials:              SCORED_TRIAL_TOTAL,
        progress:                 Math.round((tc / SCORED_TRIAL_TOTAL) * 100),
        // Lifecycle status is authoritative; the last screen viewed is only a
        // hint (and is absent for a participant whose screen events have not
        // flushed yet).
        isComplete:               (modeRec.status || '') === 'completed' || phase === 'complete',
        avgWoA:                   trial.avgWoA != null ? Math.round(trial.avgWoA * 1000) / 1000 : null,
        avgConfidence:            trial.avgConfidence != null ? Math.round(trial.avgConfidence * 10) / 10 : null,
        avgCognitiveLoad:         trial.avgCognitiveLoad != null ? Math.round(trial.avgCognitiveLoad * 10) / 10 : null,
        avgDirectionalCostRegret: trial.avgDirectionalCostRegret != null ? Math.round(trial.avgDirectionalCostRegret) : null,
        avgCostRegret:            trial.avgCostRegret != null ? Math.round(trial.avgCostRegret) : null,
      })
    }

    // Sort newest first
    participants.sort((a, b) => new Date(b.sessionStarted) - new Date(a.sessionStarted))

    // ── 5. Compute 2×4 Factorial Matrix & Schedule Depth stats ────────────────
    const conditions = { c0: 0, c1: 0, c2: 0, c3: 0, unassigned: 0 }
    const schedules  = { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }
    const orders     = {}
    const types      = { novice: 0, expert: 0, unassigned: 0 }
    const matrix     = {
      novice: { c0: 0, c1: 0, c2: 0, c3: 0 },
      expert: { c0: 0, c1: 0, c2: 0, c3: 0 },
    }
    const scheduleMatrix = {
      novice: { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
      expert: { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
    }

    let completed = 0
    let inProgress = 0

    let flaggedParticipants = 0
    let fastTrialTotal = 0
    let excluded = 0

    for (const p of participants) {
      const assigned = p.condition != null && p.participantType != null
      const g = p.participantType === 'expert' ? 'expert' : (p.participantType === 'novice' ? 'novice' : null)
      const c = p.condition && ['c0', 'c1', 'c2', 'c3'].includes(p.condition) ? p.condition : null

      if (p.flaggedTrials > 0) flaggedParticipants++
      fastTrialTotal += p.fastTrials || 0

      if (!assigned || !g || !c) {
        types.unassigned++
        conditions.unassigned++
        continue
      }

      types[g]++
      conditions[c]++
      matrix[g][c]++

      if (p.scheduleIndex != null) {
        const sKey = `s${p.scheduleIndex}`
        if (schedules[sKey] !== undefined) { schedules[sKey]++; scheduleMatrix[g][sKey]++ }
      }
      if (p.orderIndex != null) orders[`o${p.orderIndex}`] = (orders[`o${p.orderIndex}`] || 0) + 1

      if (p.isComplete || p.status === 'completed') completed++
      else if (p.status === 'excluded') excluded++
      else if (p.trialsCompleted > 0 || (p.currentPhase && p.currentPhase !== 'consent')) inProgress++
    }

    const stats = {
      total:                      participants.length,
      types,
      conditions,
      schedules,
      orders,
      matrix,
      scheduleMatrix,
      flaggedParticipants,
      fastTrialTotal,
      completed,
      inProgress,
      excluded,
      notStarted:                 Math.max(0, participants.length - completed - inProgress - excluded),
      globalAvgWoA:               countWoA > 0 ? Math.round((sumWoA / countWoA) * 1000) / 1000 : null,
      globalAvgDirectionalRegret: countRegret > 0 ? Math.round(sumRegret / countRegret) : null,
    }

    return res.status(200).json({ stats, participants })
  } catch (error) {
    console.error('[Admin API error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
