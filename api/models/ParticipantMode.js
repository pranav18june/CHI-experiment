import mongoose from 'mongoose'

/**
 * Stores the experimental condition assigned to each participant.
 *
 * Conditions:
 *   c0: Baseline (recommendation-only, no explanation)
 *   c1: Numerical (driver attributions)
 *   c2: Narrative (verbal explanation)
 *   c3: Counterfactual (what-if verification explanation)
 *
 * Created once when the participant begins their session. Immutable after creation.
 */
const ParticipantModeSchema = new mongoose.Schema(
  {
    participantId: { type: String, required: true, unique: true, index: true },
    condition:     { type: String, required: true, enum: ['c0', 'c1', 'c2', 'c3'] },
    assignedAt:    { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.ParticipantMode || mongoose.model('ParticipantMode', ParticipantModeSchema)
