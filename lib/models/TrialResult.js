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
    condition:       { type: String, required: true, enum: ['c0', 'c1', 'c2', 'c3'], index: true },
    participantType: { type: String, enum: ['novice', 'expert', null], default: null, index: true },
    trialId:         { type: String, required: true, index: true },
    scenarioType:    {
      type: String,
      required: true,
      enum: ['safety_stock', 'newsvendor', 'reorder_point', 'expedite_or_wait', 'unknown'],
      index: true,
    },
    isPractice:      { type: Boolean, default: false },

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

    // Dwell Times
    step4DwellMs:      { type: Number, default: 0 },
    totalTrialDwellMs: { type: Number, default: 0 },

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

export default mongoose.models.TrialResult || mongoose.model('TrialResult', TrialResultSchema)
