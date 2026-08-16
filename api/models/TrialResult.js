import mongoose from 'mongoose'

/**
 * Analytical Trial Result Model
 *
 * Captures per-trial participant decisions, Judge-Advisor Weight of Advice (WoA),
 * and the protocol's primary outcome measure: Directional Cost Regret (asymmetrically weighted).
 */
const TrialResultSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, index: true },
    sessionId:       { type: String, required: true, index: true },
    condition:       { type: String, required: true, index: true },
    participantType: { type: String, default: null, index: true },
    trialId:         { type: String, required: true, index: true },
    scenarioType:    { type: String, required: true },
    isPractice:      { type: Boolean, default: false },

    // Ground-Truth Correctness & Error Direction
    isCorrect:      { type: Boolean, default: null },
    errorDirection: { type: String, enum: ['high', 'low', 'na', null], default: null },

    // Ground Truth & Regret Metrics (Primary Outcome Measure)
    groundTruthOptimal:    { type: Number, default: null },
    costRegret:            { type: Number, default: null }, // Unsigned: |Final - Optimal|
    directionalCostRegret: { type: Number, default: null }, // Signed & asymmetrically weighted

    // Judge-Advisor values & Weight of Advice
    initialEstimate:  { type: Number, required: true },
    aiRecommendation: { type: Number, required: true },
    finalEstimate:    { type: Number, required: true },
    weightOfAdvice:   { type: Number, default: null },

    // Ratings & Verification
    finalConfidence:      { type: Number, default: null },
    cognitiveLoad:        { type: Number, default: null },
    verificationResponse: { type: String, default: null }, // 'too_high' | 'about_right' | 'too_low'

    // Dwell Times
    step4DwellMs:      { type: Number, default: 0 },
    totalTrialDwellMs: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
)

TrialResultSchema.index({ participantId: 1, trialId: 1 }, { unique: true })

export default mongoose.models.TrialResult || mongoose.model('TrialResult', TrialResultSchema)
