import { connectToDatabase } from '../../lib/mongodb.js'
import ParticipantMode from '../../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../../lib/models/ParticipantTrialPlan.js'
import TrialResult from '../../lib/models/TrialResult.js'
import PostTaskResponse from '../../lib/models/PostTaskResponse.js'
import { CONFIG, STOCKOUT_PENALTY_WEIGHT, HOLDING_PENALTY_WEIGHT } from '../../src/config/index.js'
import { getScenarioById } from '../../src/scenarios/index.js'
import TelemetryEvent from '../../lib/models/TelemetryEvent.js'
import { applyCors, rejectUnauthorizedAdmin } from '../../lib/http.js'

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
  if (applyCors(req, res, { methods: 'GET,OPTIONS,POST' })) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  if (rejectUnauthorizedAdmin(req, res)) return

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

    // Demographics (§6) are captured at consent — before assignment — so they
    // carry the provisional client id. ParticipantMode.priorParticipantId is the
    // link back to the canonical id; without this join the demographics never
    // reach the analyst.
    const consentEvents = await TelemetryEvent.find({ eventType: 'CONSENT_COMPLETED' })
      .sort({ timestamp: 1 }).lean()
    const demographicsMap = {}
    for (const ce of consentEvents) {
      if (ce.participantId) demographicsMap[ce.participantId] = ce.payload || {}
    }
    // Re-key anything filed under a provisional id onto the canonical one.
    for (const m of modes) {
      if (m.priorParticipantId && demographicsMap[m.priorParticipantId] && !demographicsMap[m.participantId]) {
        demographicsMap[m.participantId] = demographicsMap[m.priorParticipantId]
      }
    }

    // Join and de-identify records
    const exportRows = trials.map((t) => {
      const pid = t.participantId
      const mode = modeMap[pid] || {}
      const plan = planMap[pid] || { scheduleIndex: null, trialHashLookup: {} }
      const post = postTaskMap[pid] || {}
      const meta = getScenarioById(t.trialId)?.metadata || {}
      const demo = demographicsMap[pid] || demographicsMap[mode.priorParticipantId] || {}

      return {
        // De-identified identifiers
        anonParticipantId: pseudonymizeId(pid),
        // Never defaulted: a missing condition is a data-integrity fact, not a 'c0'.
        condition: t.condition ?? mode.condition ?? null,
        participantType: t.participantType ?? mode.participantType ?? null,
        assignmentSeq: mode.assignmentSeq ?? null,
        scheduleIndex: plan.scheduleIndex,
        trialId: t.trialId,
        trialPosition: t.trialPosition ?? null,
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

        // Dwell Times (Appendix C.4)
        step1DwellMs: t.step1DwellMs ?? null,
        step2DwellMs: t.step2DwellMs ?? null,
        step3DwellMs: t.step3DwellMs ?? null,
        step4DwellMs: t.step4DwellMs,
        totalTrialDwellMs: t.totalTrialDwellMs,
        step1ActiveDwellMs: t.step1ActiveDwellMs ?? null,
        step2ActiveDwellMs: t.step2ActiveDwellMs ?? null,
        step3ActiveDwellMs: t.step3ActiveDwellMs ?? null,
        step4ActiveDwellMs: t.step4ActiveDwellMs ?? null,
        totalActiveDwellMs: t.totalActiveDwellMs ?? null,
        totalAwayMs: t.totalAwayMs ?? null,

        // Behavioural log (Appendix C.4)
        scrollDepthPct: t.scrollDepthPct ?? null,
        chartRevisitCount: t.chartRevisitCount ?? null,
        interactionCount: t.interactionCount ?? null,

        // Pre-registered exclusion support (§9, Appendix C.2)
        belowTimeFloor: t.belowTimeFloor ?? false,
        minTrialDurationMs: t.minTrialDurationMs ?? null,
        isThinkAloud: t.isThinkAloud ?? mode.isThinkAloud ?? false,

        // Integrity audit — empty means the row agreed with the server throughout
        integrityFlags: Array.isArray(t.integrityFlags) ? t.integrityFlags.join('|') : '',
        clientReportedCondition: t.clientReportedCondition ?? null,
        clientReportedAiRecommendation: t.clientReportedAiRecommendation ?? null,

        // §7 sensitivity analysis — the model inputs behind groundTruthOptimal,
        // so regret can be recomputed under alternative constants.
        modelDerivation: meta.derivation ?? null,
        modelReproducible: meta.reproducible ?? null,
        modelDemandMean: meta.demandMean ?? meta.peakWeekDemandMean ?? meta.demandMeanPerDay ?? null,
        modelDemandStd: meta.demandStd ?? meta.peakWeekDemandStd ?? null,
        modelServiceLevel: meta.serviceLevel ?? null,
        modelZScore: meta.zScore ?? null,
        modelLeadTimeWeeks: meta.leadTimeWeeks ?? null,
        modelLeadTimeDays: meta.averageLeadTimeDays ?? null,
        modelCriticalRatio: meta.criticalRatio ?? null,
        perturbedParameter: meta.perturbedParameter ?? null,
        perturbedValue: meta.perturbedValue ?? null,

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

        // Demographics (§6), joined from the consent event
        demoProgramme: demo.programme ?? null,
        demoStudyYear: demo.studyYear ?? null,
        demoPriorSupplyChain: demo.supplyChainExperience ?? null,
        demoAiUse: demo.aiUse ?? null,
        demoGender: demo.gender ?? null,
        demoAge: demo.age ?? null,

        // Expert-only reliance item (Appendix C.3)
        expertRelianceOnOwnHeuristics: post.expertReliance?.relianceOnOwnHeuristics ?? null,
        expertTaskRealism: post.expertReliance?.taskRealism ?? null,

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
      minTrialDurationMs: CONFIG.MIN_TRIAL_DURATION_MS ?? null,
      flaggedRows: exportRows.filter((r) => r.integrityFlags).length,
      belowTimeFloorRows: exportRows.filter((r) => r.belowTimeFloor).length,
      totalParticipants: modes.length,
      totalTrialResults: trials.length,
      totalPostTaskResponses: postTasks.length,
      rowsMissingDemographics: exportRows.filter((r) => r.demoAge == null).length,
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
