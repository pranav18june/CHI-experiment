import { connectToDatabase } from '../lib/mongodb.js'
import TelemetryEvent from '../models/TelemetryEvent.js'
import TrialResult from '../models/TrialResult.js'
import ParticipantMode from '../models/ParticipantMode.js'
import ParticipantTrialPlan from '../models/ParticipantTrialPlan.js'

const SCORED_TRIAL_TOTAL = 12

/**
 * Admin Participants API
 *
 * GET /api/admin/participants
 * Header: x-admin-secret: <ADMIN_SECRET env var, default: "study-admin">
 *
 * Returns an aggregated summary of all participants for the research admin dashboard:
 *   - 2×4 Factorial breakdown (Novice vs Expert × C0/C1/C2/C3)
 *   - Latin-Square Correctness Schedule depth breakdown (S0 to S7)
 *   - Primary outcome measure: Directional Cost Regret (asymmetrically weighted)
 *   - Secondary outcome measures: Weight of Advice (WoA), Confidence, Cognitive Load
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  // ── SECURITY & AUTHENTICATION SCOPE DECISION ──────────────────────────────
  // DELIBERATE SCOPE DECISION: Rate limiting and complex JWT/hashed token-based
  // authentication are intentionally omitted here. This platform is an internal-only
  // behavioural research platform deployed within research lab environments for
  // proctors and principal investigators, not a public-facing multi-tenant SaaS application.
  // The header-based secret check (x-admin-secret) provides a sufficient, lightweight
  // access boundary for internal study monitoring without adding operational overhead.
  const secret = process.env.ADMIN_SECRET || 'study-admin'
  const provided = req.headers['x-admin-secret']
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await connectToDatabase()

    // ── 1. Condition & Type assignments from ParticipantMode ─────────────────
    const modeRecords = await ParticipantMode.find({}).lean()
    const modeMap = {}
    for (const r of modeRecords) {
      modeMap[r.participantId] = {
        condition: r.condition || r.surveyMode || 'c0',
        participantType: r.participantType || 'novice',
      }
    }

    // ── 1B. Trial plans from ParticipantTrialPlan for schedule depth ─────────
    const planRecords = await ParticipantTrialPlan.find({}).lean()
    const planMap = {}
    for (const pl of planRecords) {
      planMap[pl.participantId] = pl.scheduleIndex
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
        },
      },
    ])
    const trialMap = {}
    for (const t of trialAgg) trialMap[t._id] = t

    // ── 4. Build participant list ─────────────────────────────────────────────
    const allIds = new Set([
      ...modeRecords.map((r) => r.participantId),
      ...sessionAgg.map((s) => s._id),
      ...planRecords.map((pl) => pl.participantId),
    ])

    const participants = []
    let sumWoA = 0, countWoA = 0
    let sumRegret = 0, countRegret = 0

    for (const pid of allIds) {
      const modeRec = modeMap[pid] || {}
      const session = sessionAgg.find((s) => s._id === pid) || {}
      const trial   = trialMap[pid] || {}
      const tc      = trial.trialsCompleted || 0
      const phase   = screenMap[pid] || session.currentPhase || 'unknown'
      const cond    = modeRec.condition || session.condition || 'c0'
      const type    = modeRec.participantType || session.participantType || 'novice'
      const sIdx    = planMap[pid] != null ? planMap[pid] : null

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
        scheduleIndex:            sIdx,
        sessionStarted:           session.sessionStarted  || null,
        lastSeen:                 session.lastSeen        || null,
        currentPhase:             phase,
        trialsCompleted:          tc,
        totalTrials:              SCORED_TRIAL_TOTAL,
        progress:                 Math.round((tc / SCORED_TRIAL_TOTAL) * 100),
        isComplete:               phase === 'complete',
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
    const conditions = { c0: 0, c1: 0, c2: 0, c3: 0 }
    const schedules  = { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }
    const types      = { novice: 0, expert: 0 }
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

    for (const p of participants) {
      const g = p.participantType === 'expert' ? 'expert' : 'novice'
      const c = p.condition && conditions[p.condition] !== undefined ? p.condition : 'c0'
      const sKey = p.scheduleIndex != null ? `s${p.scheduleIndex % 8}` : 's0'

      types[g]++
      conditions[c]++
      schedules[sKey]++
      matrix[g][c]++
      scheduleMatrix[g][sKey]++

      if (p.isComplete) completed++
      else if (p.trialsCompleted > 0 || (p.currentPhase && p.currentPhase !== 'consent')) inProgress++
    }

    const stats = {
      total:                      participants.length,
      types,
      conditions,
      schedules,
      matrix,
      scheduleMatrix,
      completed,
      inProgress,
      notStarted:                 participants.length - completed - inProgress,
      globalAvgWoA:               countWoA > 0 ? Math.round((sumWoA / countWoA) * 1000) / 1000 : null,
      globalAvgDirectionalRegret: countRegret > 0 ? Math.round(sumRegret / countRegret) : null,
    }

    return res.status(200).json({ stats, participants })
  } catch (error) {
    console.error('[Admin API error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
