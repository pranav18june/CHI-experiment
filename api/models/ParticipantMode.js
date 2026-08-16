import mongoose from 'mongoose'

/**
 * Stores the experimental condition and expertise group assigned to each participant.
 *
 * 2×4 Factorial Assignment:
 *   - participantType: 'novice' | 'expert'
 *   - condition: 'c0' | 'c1' | 'c2' | 'c3'
 */
const ParticipantModeSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, unique: true, index: true },
    participantType: { type: String, required: true, enum: ['novice', 'expert'], default: 'novice', index: true },
    condition:       { type: String, required: true, enum: ['c0', 'c1', 'c2', 'c3'], index: true },
    assignedAt:      { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.ParticipantMode || mongoose.model('ParticipantMode', ParticipantModeSchema)
