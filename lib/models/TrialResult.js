import mongoose from 'mongoose'

/**
 * Analytical Trial Result Model
 *
 * Captures per-trial participant decisions, Judge-Advisor Weight of Advice (WoA),
 * ground truth parameters, protocol version stamps, and the primary outcome measure:
 * Directional Cost Regret (asymmetrically weighted).
 */
const TrialResultSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, index: true },
    sessionId:       { type: String, required: true, index: true },
    // Resolved server-side from ParticipantMode / ParticipantTrialPlan, not from
    // the client envelope. Null means no server assignment was found — see
    // integrityFlags: 'NO_SERVER_PLAN'.
    condition:       { type: String, enum: ['c0', 'c1', 'c2', 'c3', null], default: null, index: true },
    participantType: { type: String, enum: ['novice', 'expert', null], default: null, index: true },
    trialId:         { type: String, required: true, index: true },
    scenarioType:    {
      type: String,
      required: true,
      enum: ['safety_stock', 'newsvendor', 'reorder_point', 'expedite_or_wait', 'unknown'],
      index: true,
    },
    isPractice:      { type: Boolean, default: false },

    // §7 fixed effect: serial position of this trial within the scored block
    // (1-12), resolved from the server plan. Required to model order effects
    // separately from the scenario random intercept.
    trialPosition:   { type: Number, default: null, index: true },

    // Ground-Truth Correctness & Error Direction
    isCorrect:      { type: Boolean, default: null },
    errorDirection: { type: String, enum: ['high', 'low', 'na', null], default: null },

    // Ground Truth & Regret Metrics (Primary Outcome Measure)
    groundTruthOptimal:    { type: Number, default: null },
    costRegret:            { type: Number, default: null }, // Unsigned: |Final - Optimal|
    directionalCostRegret: { type: Number, default: null }, // Signed & asymmetrically weighted

    // Weight Multipliers Applied (Prevents mid-study parameter drift confusion)
    stockoutPenaltyWeight: { type: Number, default: 1.85 },
    holdingPenaltyWeight:  { type: Number, default: 1.00 },

    // Judge-Advisor values & Weight of Advice
    initialEstimate:  { type: Number, required: true },
    aiRecommendation: { type: Number, required: true },
    finalEstimate:    { type: Number, required: true },
    weightOfAdvice:   { type: Number, default: null },

    // Ratings & Verification
    finalConfidence:      { type: Number, default: null },
    cognitiveLoad:        { type: Number, default: null },
    verificationResponse: {
      type: String,
      enum: ['too_high', 'about_right', 'too_low', null],
      default: null,
    },

    // Dwell Times — per step (Appendix C.4)
    step1DwellMs:      { type: Number, default: 0 },
    step2DwellMs:      { type: Number, default: 0 },
    step3DwellMs:      { type: Number, default: 0 },
    step4DwellMs:      { type: Number, default: 0 },
    totalTrialDwellMs: { type: Number, default: 0 },

    // Dwell net of time the tab was hidden or unfocused. Raw dwell cannot tell
    // deliberation apart from distraction; §7 models dwell, so both are kept.
    step1ActiveDwellMs: { type: Number, default: 0 },
    step2ActiveDwellMs: { type: Number, default: 0 },
    step3ActiveDwellMs: { type: Number, default: 0 },
    step4ActiveDwellMs: { type: Number, default: 0 },
    totalActiveDwellMs: { type: Number, default: 0 },
    totalAwayMs:        { type: Number, default: 0 },

    // Behavioural log (Appendix C.4)
    scrollDepthPct:    { type: Number, default: 0 }, // deepest % of page reached this trial
    chartRevisitCount: { type: Number, default: 0 }, // times the chart re-entered view / was interacted with
    interactionCount:  { type: Number, default: 0 }, // clicks, key commits, slider commits

    // Pre-registered exclusion support (§9, Appendix C.2)
    belowTimeFloor:      { type: Boolean, default: false, index: true },
    minTrialDurationMs:  { type: Number, default: null },
    isThinkAloud:        { type: Boolean, default: false, index: true },

    // Integrity: what the client claimed, where it disagreed with the server.
    // Populated rows are analysable; flagged rows are auditable.
    integrityFlags:                    { type: [String], default: [] },
    clientReportedCondition:           { type: String, default: null },
    clientReportedAiRecommendation:    { type: Number, default: null },

    // Version Stamps
    protocolVersion:    { type: String, default: '4.1.0' },
    applicationVersion: { type: String, default: '0.2.0' },
  },
  {
    timestamps: true,
  }
)

TrialResultSchema.index({ participantId: 1, trialId: 1 }, { unique: true })
TrialResultSchema.index({ isPractice: 1, condition: 1, participantType: 1 })
// The export reads every scored row ordered by participant. Without this the
// sort runs in memory, which MongoDB caps at 32 MB — survivable at this study's
// size, but the index removes the SORT stage entirely and costs almost nothing.
TrialResultSchema.index({ isPractice: 1, participantId: 1, createdAt: 1 })

export default mongoose.models.TrialResult || mongoose.model('TrialResult', TrialResultSchema)
