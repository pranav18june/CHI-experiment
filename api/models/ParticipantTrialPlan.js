import mongoose from 'mongoose'

/**
 * Stores the counterbalanced 12-trial plan for each participant.
 *
 * Guaranteed constraints:
 *   - Exactly 6 correct and 6 incorrect trials across the 12 scored scenarios.
 *   - Exactly 3 High (+30-35%) and 3 Low (-30-35%) error directions among incorrect trials.
 *   - Maximum of 2 consecutive trials sharing the same correctness label.
 *   - Counterbalanced Latin-square complement schedules guaranteeing 50% sample-wide
 *     correctness per scenario instance.
 */
const TrialPlanItemSchema = new mongoose.Schema(
  {
    trialId:        { type: String, required: true },
    orderIndex:     { type: Number, required: true },
    isCorrect:      { type: Boolean, required: true },
    errorDirection: { type: String, enum: ['high', 'low', 'na'], required: true },
    recommendation: { type: Number, required: true },
  },
  { _id: false }
)

const ParticipantTrialPlanSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, unique: true, index: true },
    participantType: { type: String, required: true, enum: ['novice', 'expert'], index: true },
    condition:       { type: String, required: true, enum: ['c0', 'c1', 'c2', 'c3'], index: true },
    scheduleIndex:   { type: Number, required: true },
    trials:          { type: [TrialPlanItemSchema], required: true },
    assignedAt:      { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.ParticipantTrialPlan || mongoose.model('ParticipantTrialPlan', ParticipantTrialPlanSchema)
