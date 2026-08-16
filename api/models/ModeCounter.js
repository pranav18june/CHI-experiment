import mongoose from 'mongoose'

/**
 * Global mode assignment counter.
 *
 * A single document (id: 'global') tracks the running count of participants
 * assigned to each survey mode. Used exclusively via atomic findOneAndUpdate
 * operations to prevent race conditions under concurrent session starts.
 */
const ModeCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    T: { type: Number, default: 0 },
    N: { type: Number, default: 0 },
    C: { type: Number, default: 0 },
  },
  {
    _id: false, // We use a custom string _id
    timestamps: true,
  }
)

export default mongoose.models.ModeCounter || mongoose.model('ModeCounter', ModeCounterSchema)
