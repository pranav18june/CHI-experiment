import mongoose from 'mongoose'

/**
 * PostTaskResponse Model
 *
 * Persists post-experimental questionnaires for statistical analysis:
 *   - NASA-TLX dimensions & raw workload average
 *   - Objective & Subjective Numeracy scores
 *   - Domain Experience & quantitative background
 */
const PostTaskResponseSchema = new mongoose.Schema(
  {
    participantId:   { type: String, required: true, unique: true, index: true },
    sessionId:       { type: String, required: true },
    condition:       { type: String, default: null },
    participantType: { type: String, default: null },

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
      instrument:      { type: String, default: null },
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

    submittedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.PostTaskResponse || mongoose.model('PostTaskResponse', PostTaskResponseSchema)
