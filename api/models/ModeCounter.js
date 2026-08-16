import mongoose from 'mongoose'

/**
 * 2×4 Between-Subjects Factorial Assignment & Latin-Square Schedule Counter.
 *
 * Tracks:
 *   1. Condition counts (c0, c1, c2, c3) independently within each expertise group (novice vs. expert).
 *   2. Latin-Square Schedule counts (s0 to s7) independently within each expertise group for min-count randomized assignment.
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
      s0: { type: Number, default: 0 },
      s1: { type: Number, default: 0 },
      s2: { type: Number, default: 0 },
      s3: { type: Number, default: 0 },
      s4: { type: Number, default: 0 },
      s5: { type: Number, default: 0 },
      s6: { type: Number, default: 0 },
      s7: { type: Number, default: 0 },
    },
    expert: {
      c0: { type: Number, default: 0 },
      c1: { type: Number, default: 0 },
      c2: { type: Number, default: 0 },
      c3: { type: Number, default: 0 },
      s0: { type: Number, default: 0 },
      s1: { type: Number, default: 0 },
      s2: { type: Number, default: 0 },
      s3: { type: Number, default: 0 },
      s4: { type: Number, default: 0 },
      s5: { type: Number, default: 0 },
      s6: { type: Number, default: 0 },
      s7: { type: Number, default: 0 },
    },
  },
  {
    _id: false,
    timestamps: true,
  }
)

export default mongoose.models.ModeCounter || mongoose.model('ModeCounter', ModeCounterSchema)
