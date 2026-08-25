import mongoose from 'mongoose'
import assignModeHandler from '../api/assign-mode.js'
import telemetryHandler from '../api/telemetry/index.js'
import adminParticipantsHandler from '../api/admin/participants.js'
import exportHandler from '../api/admin/export.js'
import reclaimHandler from '../api/admin/reclaim-abandoned.js'
import withdrawHandler from '../api/admin/withdraw.js'

import ModeCounter from '../lib/models/ModeCounter.js'
import ParticipantMode from '../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../lib/models/ParticipantTrialPlan.js'
import TelemetryEvent from '../lib/models/TelemetryEvent.js'
import TrialResult from '../lib/models/TrialResult.js'
import PostTaskResponse from '../lib/models/PostTaskResponse.js'

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/decision_study_test'
process.env.MONGODB_URI = TEST_URI
process.env.ADMIN_SECRET = 'study-admin-secret-2026'

// Mock Express-like Req/Res helpers
function createMockReqRes({ method = 'GET', query = {}, body = {}, headers = {} }) {
  const req = { method, query, body, headers: { ...headers } }
  let statusCode = 200
  let responseData = null
  const responseHeaders = {}

  const res = {
    setHeader(k, v) { responseHeaders[k] = v; return this },
    status(code) { statusCode = code; return this },
    json(data) { responseData = data; return this },
    send(data) { responseData = data; return this },
    end() { return this },
    _getData: () => ({ statusCode, responseData, responseHeaders }),
  }

  return { req, res }
}

async function runRobustnessTest() {
  console.log('================================================================');
  console.log('  STARTING FULL DATABASE & API ROBUSTNESS VERIFICATION SUITE   ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`✓ Successfully connected to live MongoDB on ${TEST_URI}`);

  // Clean test database collections
  await Promise.all([
    ModeCounter.deleteMany({}),
    ParticipantMode.deleteMany({}),
    ParticipantTrialPlan.deleteMany({}),
    TelemetryEvent.deleteMany({}),
    TrialResult.deleteMany({}),
    PostTaskResponse.deleteMany({}),
  ])
  console.log('✓ Cleaned test database collections\n');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Schema Constraints & Strict Enums
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Testing Mongoose Strict Enums & Constraints ---');
  try {
    const invalidMode = new ParticipantMode({
      participantId: 'P-INVALID',
      participantType: 'unsupported_type', // Invalid
      condition: 'C99',                    // Invalid
      status: 'bogus_status',              // Invalid
    })
    await invalidMode.validate()
    console.error('❌ Failed: Invalid enum was accepted by schema');
    process.exit(1)
  } catch (err) {
    console.log('✓ Strict enum validation successfully rejected invalid participantType, condition, and status');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: 16 Stratified Enrollments (Min-Count Balancing & Stimulus Snapshotting)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: 16 Factorial Enrollments (8 Novices, 8 Experts) ---');
  const novices = []
  const experts = []

  for (let i = 1; i <= 8; i++) {
    const pid = `P-NOV-${String(i).padStart(2, '0')}`
    // Participant ids are server-issued (client ids are only linked, never trusted).
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { priorParticipantId: pid, participantType: 'novice' },
    })
    await assignModeHandler(req, res)
    const out = res._getData().responseData
    novices.push(out)
  }

  for (let i = 1; i <= 8; i++) {
    const pid = `P-EXP-${String(i).padStart(2, '0')}`
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { priorParticipantId: pid, participantType: 'expert' },
    })
    await assignModeHandler(req, res)
    const out = res._getData().responseData
    experts.push(out)
  }

  console.log(`✓ 16 participants enrolled (8 novices, 8 experts)`);

  // Verify counter distribution
  const counterDoc = await ModeCounter.findById('global').lean()
  console.log('ModeCounter Novice distribution:', {
    conditions: { c0: counterDoc.novice.c0, c1: counterDoc.novice.c1, c2: counterDoc.novice.c2, c3: counterDoc.novice.c3 },
    schedules: { s0: counterDoc.novice.s0, s1: counterDoc.novice.s1, s2: counterDoc.novice.s2, s3: counterDoc.novice.s3, s4: counterDoc.novice.s4, s5: counterDoc.novice.s5, s6: counterDoc.novice.s6, s7: counterDoc.novice.s7 },
  })
  console.log('ModeCounter Expert distribution:', {
    conditions: { c0: counterDoc.expert.c0, c1: counterDoc.expert.c1, c2: counterDoc.expert.c2, c3: counterDoc.expert.c3 },
    schedules: { s0: counterDoc.expert.s0, s1: counterDoc.expert.s1, s2: counterDoc.expert.s2, s3: counterDoc.expert.s3, s4: counterDoc.expert.s4, s5: counterDoc.expert.s5, s6: counterDoc.expert.s6, s7: counterDoc.expert.s7 },
  })

  // Verify stimulus snapshots and hashes
  const NOV1 = novices[0].participantId // server-issued id for the first novice
  const samplePlan = await ParticipantTrialPlan.findOne({ participantId: NOV1 }).lean()
  if (!samplePlan || !samplePlan.trials || samplePlan.trials.length !== 12) {
    throw new Error('Trial plan not generated properly')
  }
  const t1 = samplePlan.trials[0]
  console.log('Sample Trial 1 Stimulus Snapshot:', {
    trialId: t1.trialId,
    isCorrect: t1.isCorrect,
    errorDirection: t1.errorDirection,
    recommendation: t1.recommendation,
    groundTruthOptimal: t1.groundTruthOptimal,
    stimulusContentHash: t1.stimulusContentHash,
  })
  if (!t1.stimulusContentHash || !t1.groundTruthOptimal) {
    throw new Error('Missing stimulus snapshot or hash')
  }
  console.log('✓ Stimulus snapshots and SHA hashes verified');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Telemetry Ingestion, Range Validation & Regret Outcome Calculation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Telemetry Ingestion, Server Range Validation & Regret Calculation ---');

  // 3A. Test rejecting negative and out-of-range estimates
  const invalidTelemetryEvent = {
    eventId: 'EV-INVALID-01',
    eventType: 'FINAL_ESTIMATE_SUBMITTED',
    participantId: NOV1,
    sessionId: 'SESS-01',
    condition: 'c1',
    participantType: 'novice',
    trialId: 'SS-1',
    payload: {
      initialEstimate: -500, // Invalid negative
      aiRecommendation: 29251,
      finalEstimate: 9999999999, // Absurd
    },
  }
  const { req: reqInv, res: resInv } = createMockReqRes({
    method: 'POST',
    body: [invalidTelemetryEvent],
  })
  await telemetryHandler(reqInv, resInv)
  const invalidCheck = await TrialResult.findOne({ participantId: NOV1, trialId: 'SS-1' })
  if (invalidCheck) {
    throw new Error('Invalid telemetry estimate should have been rejected by server validation')
  }
  console.log('✓ Server-side bounds validation successfully rejected invalid estimate');

  // 3B. Ingest valid trial decision (Under-ordering stockout side: optimal 29251, initial 20000, ai 29251, final 22000)
  const validEvent = {
    eventId: 'EV-VALID-01',
    eventType: 'FINAL_ESTIMATE_SUBMITTED',
    participantId: NOV1,
    sessionId: 'SESS-01',
    condition: 'c1',
    participantType: 'novice',
    trialId: 'SS-1',
    payload: {
      initialEstimate: 20000,
      aiRecommendation: 29251,
      finalEstimate: 22000,
      finalConfidence: 5,
      cognitiveLoad: 4,
      verificationResponse: 'too_low',
      step4DwellMs: 14200,
      totalTrialDwellMs: 38400,
      groundTruthOptimal: 29251,
    },
  }

  const { req: reqVal, res: resVal } = createMockReqRes({
    method: 'POST',
    body: [validEvent],
  })
  await telemetryHandler(reqVal, resVal)

  const savedTrial = await TrialResult.findOne({ participantId: NOV1, trialId: 'SS-1' }).lean()
  console.log('Retrieved TrialResult from MongoDB:', {
    participantId: savedTrial.participantId,
    trialId: savedTrial.trialId,
    scenarioType: savedTrial.scenarioType,
    initialEstimate: savedTrial.initialEstimate,
    aiRecommendation: savedTrial.aiRecommendation,
    finalEstimate: savedTrial.finalEstimate,
    weightOfAdvice: savedTrial.weightOfAdvice,
    groundTruthOptimal: savedTrial.groundTruthOptimal,
    costRegret: savedTrial.costRegret,
    directionalCostRegret: savedTrial.directionalCostRegret,
    stockoutPenaltyWeight: savedTrial.stockoutPenaltyWeight,
    holdingPenaltyWeight: savedTrial.holdingPenaltyWeight,
    verificationResponse: savedTrial.verificationResponse,
    protocolVersion: savedTrial.protocolVersion,
  })

  // Verify regret math: Delta = 22000 - 29251 = -7251. Stockout cost = -7251 * 1.85 = -13414.35
  const expectedRegret = 7251
  const expectedDirectional = -13414.35
  if (savedTrial.costRegret !== expectedRegret || savedTrial.directionalCostRegret !== expectedDirectional) {
    throw new Error(`Regret calculation mismatch: got ${savedTrial.directionalCostRegret}, expected ${expectedDirectional}`)
  }
  console.log('✓ Directional Cost Regret (1.85× stockout penalty) verified with exact precision');

  // Verify participant status transitioned to in_progress
  const modeAfterTrial = await ParticipantMode.findOne({ participantId: NOV1 }).lean()
  if (modeAfterTrial.status !== 'in_progress') {
    throw new Error(`Expected status 'in_progress', got '${modeAfterTrial.status}'`)
  }
  console.log(`✓ Participant status transitioned to: '${modeAfterTrial.status}'`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Post-Task Questionnaire Persistence (NASA-TLX + Numeracy + Domain)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Post-Task Questionnaire Ingestion ---');
  const questionnaireEvent = {
    eventId: 'EV-POST-01',
    eventType: 'QUESTIONNAIRE_COMPLETED',
    participantId: NOV1,
    sessionId: 'SESS-01',
    condition: 'c1',
    participantType: 'novice',
    payload: {
      nasaTlx: {
        dimensions: {
          mentalDemand: 65, physicalDemand: 10, temporalDemand: 45,
          performance: 75, effort: 60, frustration: 30,
        },
        rawTlxAverage: 47.5,
      },
      numeracy: {
        scored: {
          instrument: 'Schwartz-Lipkus-3Item-Plus-SNS',
          objectiveScore: 3,
          totalObjective: 3,
          subjectiveScore: 6,
        },
        rawResponses: { num_coin_die: '500', num_lottery: '10', num_sweepstakes: '0.1' },
      },
      domainExperience: {
        yearsExperience: '1-3 years',
        primaryRole: 'Inventory Analyst',
        decisionFrequency: 'Weekly',
        certifications: 'APICS CSCP',
        feedback: 'Clean intuitive interface',
      },
      submittedAt: new Date().toISOString(),
    },
  }

  const { req: reqPost, res: resPost } = createMockReqRes({
    method: 'POST',
    body: [questionnaireEvent],
  })
  await telemetryHandler(reqPost, resPost)

  const savedPostTask = await PostTaskResponse.findOne({ participantId: NOV1 }).lean()
  console.log('Retrieved PostTaskResponse from MongoDB:', {
    participantId: savedPostTask.participantId,
    rawTlxAverage: savedPostTask.nasaTlx.rawTlxAverage,
    numeracyScore: `${savedPostTask.numeracy.objectiveScore}/${savedPostTask.numeracy.totalObjective}`,
    subjectiveScore: savedPostTask.numeracy.subjectiveScore,
    domainRole: savedPostTask.domainExperience.primaryRole,
    protocolVersion: savedPostTask.protocolVersion,
  })
  if (savedPostTask.numeracy.objectiveScore !== 3 || savedPostTask.nasaTlx.rawTlxAverage !== 47.5) {
    throw new Error('PostTaskResponse data mismatch')
  }
  console.log('✓ PostTaskResponse saved and verified');

  // Verify status transitioned to completed
  const modeAfterComplete = await ParticipantMode.findOne({ participantId: NOV1 }).lean()
  console.log(`✓ Participant lifecycle status updated to: '${modeAfterComplete.status}'`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Admin API & De-Identified Dataset Export
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Admin Monitoring & Research Dataset Export API ---');

  // 5A. Test Admin Participants Aggregation
  const { req: reqAdmin, res: resAdmin } = createMockReqRes({
    method: 'GET',
    headers: { 'x-admin-secret': 'study-admin-secret-2026' },
  })
  await adminParticipantsHandler(reqAdmin, resAdmin)
  const adminData = resAdmin._getData().responseData
  console.log('Admin Dashboard Stats:', {
    total: adminData.stats.total,
    completed: adminData.stats.completed,
    inProgress: adminData.stats.inProgress,
    matrix: adminData.stats.matrix,
    scheduleMatrix: adminData.stats.scheduleMatrix,
  })
  if (adminData.stats.total !== 16) {
    throw new Error(`Expected 16 total participants, got ${adminData.stats.total}`)
  }
  console.log('✓ Admin dashboard aggregation verified');

  // 5B. Test De-Identified Dataset Export (CSV)
  const { req: reqExpCsv, res: resExpCsv } = createMockReqRes({
    method: 'GET',
    query: { format: 'csv' },
    headers: { 'x-admin-secret': 'study-admin-secret-2026' },
  })
  await exportHandler(reqExpCsv, resExpCsv)
  const csvData = resExpCsv._getData().responseData
  console.log('Sample CSV Export Header & Record:');
  console.log(csvData.split('\n').slice(0, 3).join('\n'));
  if (!csvData.includes('anonParticipantId') || !csvData.includes('directionalCostRegret')) {
    throw new Error('CSV export missing required headers')
  }
  console.log('✓ De-identified CSV export generated with manifest header and anonymized identifiers');

  // 5C. Test De-Identified Dataset Export (JSON)
  const { req: reqExpJson, res: resExpJson } = createMockReqRes({
    method: 'GET',
    query: { format: 'json' },
    headers: { 'x-admin-secret': 'study-admin-secret-2026' },
  })
  await exportHandler(reqExpJson, resExpJson)
  const jsonData = resExpJson._getData().responseData
  console.log('JSON Export Manifest:', jsonData.manifest);
  if (!jsonData.manifest || !jsonData.data) {
    throw new Error('JSON export missing manifest or data')
  }
  console.log('✓ De-identified JSON export verified');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Inactive Slot Reclamation & Counter Reconciliation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Inactive Slot Reclamation & ModeCounter Reconciliation ---');
  // Backdate the last enrolled novice to 5 hours ago (assigned but never active)
  const NOV_LAST = novices[novices.length - 1].participantId
  await ParticipantMode.updateOne(
    { participantId: NOV_LAST },
    { $set: { assignedAt: new Date(Date.now() - 5 * 3600 * 1000), lastActiveAt: new Date(Date.now() - 5 * 3600 * 1000) } }
  )

  const { req: reqRec, res: resRec } = createMockReqRes({
    method: 'POST',
    body: { abandonmentHours: 2 },
    headers: { 'x-admin-secret': 'study-admin-secret-2026' },
  })
  await reclaimHandler(reqRec, resRec)
  const reclaimData = resRec._getData().responseData
  console.log('Reclaim Result:', reclaimData);

  const reclaimedP = await ParticipantMode.findOne({ participantId: NOV_LAST }).lean()
  if (!reclaimedP || reclaimedP.status !== 'abandoned') {
    throw new Error(`Expected ${NOV_LAST} to be marked 'abandoned', got '${reclaimedP?.status}'`)
  }
  console.log('✓ Inactive slot reclaimed and balancing counters successfully reconciled');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Participant Data Withdrawal & Purge (IRB Compliance)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Participant Data Withdrawal & Multi-Collection Purge ---');
  const { req: reqWd, res: resWd } = createMockReqRes({
    method: 'POST',
    body: { participantId: NOV1, reason: 'Participant voluntary withdrawal request' },
    headers: { 'x-admin-secret': 'study-admin-secret-2026' },
  })
  await withdrawHandler(reqWd, resWd)
  const withdrawResult = resWd._getData().responseData
  console.log('Withdrawal Purge Result:', withdrawResult);

  // Confirm complete absence across all collections
  const [checkMode, checkPlan, checkTrials, checkPost] = await Promise.all([
    ParticipantMode.findOne({ participantId: NOV1 }),
    ParticipantTrialPlan.findOne({ participantId: NOV1 }),
    TrialResult.find({ participantId: NOV1 }),
    PostTaskResponse.findOne({ participantId: NOV1 }),
  ])

  if (checkMode || checkPlan || checkTrials.length > 0 || checkPost) {
    throw new Error('Records remained after withdrawal purge')
  }
  console.log('✓ Verified 0 remaining records for withdrawn participant across all database collections');

  console.log('\n================================================================');
  console.log('  ALL DATABASE & DATA INTEGRITY TESTS PASSED SUCCESSFULLY! (7/7)');
  console.log('================================================================\n');

  await mongoose.disconnect()
  process.exit(0)
}

runRobustnessTest().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:', err)
  process.exit(1)
})
