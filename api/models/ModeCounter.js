import mongoose from 'mongoose'

/**
 * 2×4 Between-Subjects Factorial Assignment Counter.
 *
 * Tracks the running count of participants assigned to each condition (c0, c1, c2, c3)
 * independently within each expertise group (novice vs. expert).
 *
 * Factor A: Participant Expertise (Novice vs. Expert)
 * Factor B: AI Explanation Condition (c0, c1, c2, c3)
 *
 * Stored as a single document (_id: 'global') and updated atomically via findOneAndUpdate.
 */
const ModeCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    novice: {
      c0: { type: Number, default: 0 },
      c1: { type: Number, default: 0 },
      c2: { type: Number, default: 0 },
      c3: { type: Number, default: 0 },
    },
    expert: {
      c0: { type: Number, default: 0 },
      c1: { type: Number, default: 0 },
      c2: { type: Number, default: 0 },
      c3: { type: Number, default: 0 },
    },
  },
  {
    _id: false,
    timestamps: true,
  }
)

export default mongoose.models.ModeCounter || mongoose.model('ModeCounter', ModeCounterSchema)
