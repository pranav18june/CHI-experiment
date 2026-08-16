import mongoose from 'mongoose'

/**
 * Global condition assignment counter.
 *
 * A single document (_id: 'global') tracks the running count of participants
 * assigned to each of the 4 experimental conditions:
 *   c0: Baseline (recommendation-only, no explanation)
 *   c1: Numerical / Driver attributions
 *   c2: Narrative explanation
 *   c3: Counterfactual explanation
 *
 * Used exclusively via atomic findOneAndUpdate operations to guarantee
 * balanced allocation under concurrent session starts.
 */
const ModeCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    c0:  { type: Number, default: 0 },
    c1:  { type: Number, default: 0 },
    c2:  { type: Number, default: 0 },
    c3:  { type: Number, default: 0 },
  },
  {
    _id: false, // Use custom string _id
    timestamps: true,
  }
)

export default mongoose.models.ModeCounter || mongoose.model('ModeCounter', ModeCounterSchema)
