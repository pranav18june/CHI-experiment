import mongoose from 'mongoose'

const TrialResultSchema = new mongoose.Schema(
  {
    participantId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    condition: { type: String, required: true, index: true },
    participantType: { type: String, default: null },
    trialId: { type: String, required: true, index: true },
    scenarioType: { type: String, required: true },
    isPractice: { type: Boolean, default: false },

    // Judge-Advisor values & Weight of Advice
    initialEstimate: { type: Number, required: true },
    aiRecommendation: { type: Number, required: true },
    finalEstimate: { type: Number, required: true },
    weightOfAdvice: { type: Number, default: null },

    // Ratings & Verification
    finalConfidence: { type: Number, default: null },
    cognitiveLoad: { type: Number, default: null },
    verificationResponse: { type: String, default: null }, // 'too_high' | 'about_right' | 'too_low'

    // Dwell Times
    step4DwellMs: { type: Number, default: 0 },
    totalTrialDwellMs: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
)

TrialResultSchema.index({ participantId: 1, trialId: 1 }, { unique: true })

export default mongoose.models.TrialResult || mongoose.model('TrialResult', TrialResultSchema)
