import mongoose from 'mongoose'

/**
 * Stores the counterbalanced 12-trial plan for each participant, including
 * an immutable snapshot of the exact stimulus text, values, and SHA-256 hash
 * served to the participant during the study.
 */
const TrialPlanItemSchema = new mongoose.Schema(
  {
    trialId:            { type: String, required: true },
    orderIndex:         { type: Number, required: true },
    isCorrect:          { type: Boolean, required: true },
    errorDirection:     { type: String, enum: ['high', 'low', 'na'], required: true },
    recommendation:     { type: Number, required: true },
    groundTruthOptimal: { type: Number, required: true },

    // Stimulus Snapshot (ensures exact stimulus reproducibility)
    title:              { type: String, default: '' },
    decisionPrompt:     { type: String, default: '' },
    context:            { type: String, default: '' },
    explanation:        { type: String, default: null }, // Null for C0 baseline
    stimulusContentHash:{ type: String, default: '' },
  },
  { _id: false }
)

const ParticipantTrialPlanSchema = new mongoose.Schema(
  {
    participantId:      { type: String, required: true, unique: true, index: true },
    participantType:    { type: String, required: true, enum: ['novice', 'expert'], index: true },
    condition:          { type: String, required: true, enum: ['c0', 'c1', 'c2', 'c3'], index: true },
    scheduleIndex:      { type: Number, required: true },
    protocolVersion:    { type: String, default: '4.1.0' },
    applicationVersion: { type: String, default: '0.2.0' },
    trials:             { type: [TrialPlanItemSchema], required: true },
    assignedAt:         { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.ParticipantTrialPlan || mongoose.model('ParticipantTrialPlan', ParticipantTrialPlanSchema)
