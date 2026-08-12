import mongoose from 'mongoose'

const TelemetryEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    sessionId: { type: String, required: true, index: true },
    participantId: { type: String, required: true, index: true },
    condition: { type: String, default: null, index: true },
    participantType: { type: String, default: null, index: true },
    screen: { type: String, default: 'unknown' },
    trialId: { type: String, default: null, index: true },
    applicationVersion: { type: String, default: '0.2.0' },
    studyVersion: { type: String, default: '4.1.0' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
)

// Compound index for fast queries and analytics aggregation
TelemetryEventSchema.index({ participantId: 1, eventType: 1 })
TelemetryEventSchema.index({ trialId: 1, eventType: 1 })

export default mongoose.models.TelemetryEvent || mongoose.model('TelemetryEvent', TelemetryEventSchema)
