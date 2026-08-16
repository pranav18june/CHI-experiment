import { connectToDatabase } from '../../lib/mongodb.js'
import ParticipantMode from '../../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../../lib/models/ParticipantTrialPlan.js'
import TrialResult from '../../lib/models/TrialResult.js'
import PostTaskResponse from '../../lib/models/PostTaskResponse.js'
import { CONFIG, STOCKOUT_PENALTY_WEIGHT, HOLDING_PENALTY_WEIGHT } from '../../src/config/index.js'

function pseudonymizeId(pid) {
  if (!pid) return 'ANON_UNKNOWN'
  let hash = 0
  for (let i = 0; i < pid.length; i++) {
    hash = ((hash << 5) - hash) + pid.charCodeAt(i)
    hash |= 0
  }
  return `ANON_${Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6).toUpperCase()}`
}

function escapeCsvCell(val) {
  if (val == null) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * De-Identified Data Export API
 *
 * GET /api/admin/export?format=csv|json
 * Header: x-admin-secret: <ADMIN_SECRET>
 *
 * Produces a research-ready, de-identified export joining TrialResult, ParticipantMode,
 * ParticipantTrialPlan, and PostTaskResponse with an immutable manifest header.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-secret')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const secret = process.env.ADMIN_SECRET || 'study-admin'
  const provided = req.headers['x-admin-secret'] || req.query.secret
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await connectToDatabase()

    const format = (req.query.format || 'json').toLowerCase()
    const includePractice = req.query.includePractice === 'true'

    // Fetch all trial results
    const trialQuery = includePractice ? {} : { isPractice: false }
    const trials = await TrialResult.find(trialQuery).sort({ participantId: 1, createdAt: 1 }).lean()

    // Fetch participant modes
    const modes = await ParticipantMode.find({}).lean()
    const modeMap = {}
    for (const m of modes) modeMap[m.participantId] = m

    // Fetch trial plans for scheduleIndex & stimulusContentHash
    const plans = await ParticipantTrialPlan.find({}).lean()
    const planMap = {}
    for (const pl of plans) {
      const trialHashLookup = {}
      if (pl.trials) {
        for (const t of pl.trials) {
          trialHashLookup[t.trialId] = t.stimulusContentHash || null
        }
      }
      planMap[pl.participantId] = {
        scheduleIndex: pl.scheduleIndex,
        trialHashLookup,
      }
    }

    // Fetch post-task responses
    const postTasks = await PostTaskResponse.find({}).lean()
    const postTaskMap = {}
    for (const pt of postTasks) postTaskMap[pt.participantId] = pt

    // Join and de-identify records
    const exportRows = trials.map((t) => {
      const pid = t.participantId
      const mode = modeMap[pid] || {}
      const plan = planMap[pid] || { scheduleIndex: null, trialHashLookup: {} }
      const post = postTaskMap[pid] || {}

      return {
        // De-identified identifiers
        anonParticipantId: pseudonymizeId(pid),
        condition: t.condition || mode.condition || 'c0',
        participantType: t.participantType || mode.participantType || 'novice',
        scheduleIndex: plan.scheduleIndex,
        trialId: t.trialId,
        scenarioType: t.scenarioType,
        isPractice: t.isPractice,

        // Correctness & Error Direction
        isCorrect: t.isCorrect,
        errorDirection: t.errorDirection,

        // Primary & Secondary Outcome Measures
        groundTruthOptimal: t.groundTruthOptimal,
        initialEstimate: t.initialEstimate,
        aiRecommendation: t.aiRecommendation,
        finalEstimate: t.finalEstimate,
        weightOfAdvice: t.weightOfAdvice,
        costRegret: t.costRegret,
        directionalCostRegret: t.directionalCostRegret,
        finalConfidence: t.finalConfidence,
        cognitiveLoad: t.cognitiveLoad,
        verificationResponse: t.verificationResponse,

        // Dwell Times
        step4DwellMs: t.step4DwellMs,
        totalTrialDwellMs: t.totalTrialDwellMs,

        // Post-Task Measures (De-identified)
        nasaTlxRawAverage: post.nasaTlx?.rawTlxAverage ?? null,
        nasaMentalDemand: post.nasaTlx?.mentalDemand ?? null,
        nasaPhysicalDemand: post.nasaTlx?.physicalDemand ?? null,
        nasaTemporalDemand: post.nasaTlx?.temporalDemand ?? null,
        nasaPerformance: post.nasaTlx?.performance ?? null,
        nasaEffort: post.nasaTlx?.effort ?? null,
        nasaFrustration: post.nasaTlx?.frustration ?? null,
        numeracyObjectiveScore: post.numeracy?.objectiveScore ?? null,
        numeracyTotalObjective: post.numeracy?.totalObjective ?? 3,
        numeracySubjectiveScore: post.numeracy?.subjectiveScore ?? null,
        domainYearsExperience: post.domainExperience?.yearsExperience ?? null,
        domainPrimaryRole: post.domainExperience?.primaryRole ?? null,
        domainDecisionFrequency: post.domainExperience?.decisionFrequency ?? null,
        domainCertifications: post.domainExperience?.certifications ?? null,

        // Versioning & Stimulus Traceability
        stimulusContentHash: plan.trialHashLookup[t.trialId] || null,
        protocolVersion: t.protocolVersion || CONFIG.STUDY_VERSION || '4.1.0',
        applicationVersion: t.applicationVersion || CONFIG.APPLICATION_VERSION || '0.2.0',
        stockoutPenaltyWeight: t.stockoutPenaltyWeight || STOCKOUT_PENALTY_WEIGHT,
        holdingPenaltyWeight: t.holdingPenaltyWeight || HOLDING_PENALTY_WEIGHT,
        recordedAt: t.createdAt ? t.createdAt.toISOString() : null,
      }
    })

    const manifest = {
      exportTimestamp: new Date().toISOString(),
      exportFormat: format,
      protocolVersion: CONFIG.STUDY_VERSION || '4.1.0',
      applicationVersion: CONFIG.APPLICATION_VERSION || '0.2.0',
      stockoutPenaltyWeight: STOCKOUT_PENALTY_WEIGHT,
      holdingPenaltyWeight: HOLDING_PENALTY_WEIGHT,
      numeracyInstrument: 'Schwartz-Lipkus-3Item-Plus-SNS',
      totalParticipants: modes.length,
      totalTrialResults: trials.length,
      totalPostTaskResponses: postTasks.length,
      exportRowsCount: exportRows.length,
    }

    // Return CSV
    if (format === 'csv') {
      if (exportRows.length === 0) {
        return res.status(200).send('No data available to export.')
      }
      const headers = Object.keys(exportRows[0])
      const csvLines = [
        `# Manifest: Protocol ${manifest.protocolVersion} | Exported: ${manifest.exportTimestamp} | StockoutWeight: ${manifest.stockoutPenaltyWeight}`,
        headers.join(','),
        ...exportRows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(',')),
      ]
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="scdrp_deidentified_export_${Date.now()}.csv"`)
      return res.status(200).send(csvLines.join('\n'))
    }

    // Return JSON
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ manifest, data: exportRows })
  } catch (error) {
    console.error('[Export API Error]', error)
    return res.status(500).json({ error: 'Internal Server Error', message: error.message })
  }
}
