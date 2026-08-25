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
    decisionPrompt:     { type: mongoose.Schema.Types.Mixed, default: '' },
    context:            { type: String, default: '' },
    // String for C2/C3 narrative and counterfactual text; object ({ factors: [...] })
    // for C1 feature attributions; null for the C0 baseline.
    explanation:        { type: mongoose.Schema.Types.Mixed, default: null },
    stimulusContentHash:{ type: String, default: '' },
  },
  { _id: false }
)

const ParticipantTrialPlanSchema = new mongoose.Schema(
  {
    participantId:      { type: String, required: true, unique: true, index: true },
    participantType:    { type: String, required: true, enum: ['novice', 'expert'], index: true },
    condition:          { type: String, required: true, enum: ['c0', 'c1', 'c2', 'c3'], index: true },
    // Counterbalancing provenance (§5.6, §5.11): planIndex selects the
    // (presentation order, correctness schedule) pair; both are stored so a plan
    // can be regenerated and audited.
    planIndex:          { type: Number, default: null },
    orderIndex:         { type: Number, default: null },
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
