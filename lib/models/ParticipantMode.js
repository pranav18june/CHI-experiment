import mongoose from 'mongoose'

/**
 * Stores the experimental condition, expertise group, lifecycle status,
 * and protocol version assigned to each participant.
 *
 * 2×4 Factorial Assignment:
 *   - participantType: 'novice' | 'expert'
 *   - condition: 'c0' | 'c1' | 'c2' | 'c3'
 *   - status: 'assigned' | 'in_progress' | 'completed' | 'abandoned' | 'excluded'
 */
const ParticipantModeSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, unique: true, index: true },

    // The client-generated id used for pre-assignment events (session start,
    // consent). Recorded so those events can be re-linked to the canonical
    // server-issued id; never trusted as an identity.
    priorParticipantId: { type: String, default: null, index: true },
    participantType: {
      type: String,
      required: true,
      enum: ['novice', 'expert'],
      default: 'novice',
      index: true,
    },
    condition: {
      type: String,
      required: true,
      enum: ['c0', 'c1', 'c2', 'c3'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['assigned', 'in_progress', 'completed', 'abandoned', 'excluded'],
      default: 'assigned',
      index: true,
    },
    // Permuted-block assignment provenance (lib/assignment.js). Recomputing
    // assignmentForSequence(participantType, assignmentSeq) must reproduce
    // condition + scheduleIndex exactly — this is the audit trail.
    assignmentSeq: { type: Number, default: null },
    planIndex:     { type: Number, default: null },
    orderIndex:    { type: Number, default: null },
    scheduleIndex: { type: Number, default: null },

    // Appendix C.2 — think-aloud sessions are excluded from timing analyses.
    isThinkAloud: { type: Boolean, default: false, index: true },

    protocolVersion:    { type: String, default: '4.1.0' },
    applicationVersion: { type: String, default: '0.2.0' },
    assignedAt:         { type: Date, default: Date.now },
    lastActiveAt:       { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.ParticipantMode || mongoose.model('ParticipantMode', ParticipantModeSchema)
