import mongoose from 'mongoose'

/**
 * Stores the survey mode assigned to each participant.
 *
 * Created once when the participant begins their session. Never overwritten —
 * subsequent assignment requests for the same participantId return the
 * existing record unchanged, guaranteeing consistency across page refreshes
 * and multi-device sessions.
 */
const ParticipantModeSchema = new mongoose.Schema(
  {
    participantId: { type: String, required: true, unique: true, index: true },
    surveyMode:    { type: String, required: true, enum: ['T', 'N', 'C'] },
    assignedAt:    { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.ParticipantMode || mongoose.model('ParticipantMode', ParticipantModeSchema)
