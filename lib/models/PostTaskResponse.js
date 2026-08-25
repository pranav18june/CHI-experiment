import mongoose from 'mongoose'

/**
 * PostTaskResponse Model
 *
 * Persists post-experimental questionnaires for statistical analysis:
 *   - NASA-TLX dimensions & raw workload average
 *   - Objective & Subjective Numeracy scores
 *   - Domain Experience & quantitative background
 *   - Version stamps (protocol and application versions)
 */
const PostTaskResponseSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, unique: true, index: true },
    sessionId:       { type: String, required: true },
    condition:       { type: String, enum: ['c0', 'c1', 'c2', 'c3', null], default: null, index: true },
    participantType: { type: String, enum: ['novice', 'expert', null], default: null, index: true },

    // NASA-TLX
    nasaTlx: {
      mentalDemand:   { type: Number, default: null },
      physicalDemand: { type: Number, default: null },
      temporalDemand: { type: Number, default: null },
      performance:    { type: Number, default: null },
      effort:         { type: Number, default: null },
      frustration:    { type: Number, default: null },
      rawTlxAverage:  { type: Number, default: null },
    },

    // Numeracy Scale
    numeracy: {
      instrument:      { type: String, default: 'Schwartz-Lipkus-3Item-Plus-SNS' },
      objectiveScore:  { type: Number, default: null },
      totalObjective:  { type: Number, default: null },
      subjectiveScore: { type: Number, default: null },
      rawResponses:    { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // Domain Experience
    domainExperience: {
      yearsExperience:   { type: String, default: null },
      primaryRole:       { type: String, default: null },
      decisionFrequency: { type: String, default: null },
      certifications:    { type: String, default: null },
      feedback:          { type: String, default: null },
    },

    // Expert-only reliance item (Appendix C.3 / §11): how far the participant
    // leaned on their own company's rules of thumb vs. the on-screen information.
    // Null for novices.
    expertReliance: {
      relianceOnOwnHeuristics: { type: Number, default: null },
      taskRealism:             { type: Number, default: null },
      heuristicDescription:    { type: String, default: null },
    },

    // Version Stamps
    protocolVersion:    { type: String, default: '4.1.0' },
    applicationVersion: { type: String, default: '0.2.0' },

    submittedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.PostTaskResponse || mongoose.model('PostTaskResponse', PostTaskResponseSchema)
