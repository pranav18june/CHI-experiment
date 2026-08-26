/**
 * Participant-facing study facts (Protocol §5.10, §5.11, §11).
 *
 * The consent, debrief and completion screens are written in full elsewhere.
 * What lives here is only the handful of facts that no one but the research
 * team can supply — institution, people, ethics approval, money, retention.
 *
 * EVERY FIELD MARKED REQUIRED MUST BE FILLED BEFORE RECRUITMENT.
 * `npm run preflight` fails while any of them is blank, because a consent form
 * that names no ethics approval and no contact is not a consent form, and a
 * debrief that cannot be acted on does not discharge a deception study's duty
 * to its participants.
 *
 * These strings are shown to people who are trusting you with 40 minutes and
 * their data. Write them as you would want them written for you.
 */

export const STUDY_COPY = {
  // ── Who is running this ───────────────────────────────────────────── REQUIRED
  institution: 'Indo-Swiss Grant on AI for Public Good',
  department: '',
  principalInvestigator: 'Indo-Swiss Grant on AI for Public Good Team',
  researchTeam: '',

  // Where a participant writes with a question, a concern, or to withdraw.
  contactEmail: 'pranav18june@gmail.com',

  // Ethics committee details (optional)
  ethicsCommittee: '',
  ethicsApprovalRef: '',
  ethicsContactEmail: '',

  // ── Money / Incentives ──────────────────────────────────────────────────
  compensation: {
    baseAmount: 'Payment will be provided to participants upon verification of data quality.',
    bonusMaximum: '',
    bonusDescription: '',
    payoutMethod: 'credited after data quality verification',
    expertArrangement: '',
  },

  // ── Data handling ─────────────────────────────────────────────────────
  dataRetentionPeriod: 'the duration of research analysis',
  dataStorageLocation: 'encrypted secure servers',
  withdrawalWindow: 'study completion',

  // ── Completion ────────────────────────────────────────────────────────────
  redirectUrl: '',
  redirectLabel: '',
  creditNote: '',

  // ── Duration ──────────────────────────────────────────────────────────────
  estimatedDuration: '20–25 minutes',
}

/** Fields that must be non-empty before the study may run. */
const REQUIRED_PATHS = [
  'institution', 'contactEmail', 'compensation.baseAmount',
]

function valueAt(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

/**
 * Returns the list of unfilled required fields. Empty means ready to recruit.
 * Used by the preflight check and by the consent screen itself.
 */
export function missingStudyCopy(copy = STUDY_COPY) {
  return REQUIRED_PATHS.filter((p) => {
    const v = valueAt(copy, p)
    return typeof v !== 'string' || v.trim() === ''
  })
}

export const isStudyCopyComplete = (copy = STUDY_COPY) => missingStudyCopy(copy).length === 0

/** Resolves the bonus sentence with the configured maximum substituted in. */
export function bonusSentence(copy = STUDY_COPY) {
  return copy.compensation.bonusDescription ? copy.compensation.bonusDescription.replace('{bonusMaximum}', copy.compensation.bonusMaximum || '—') : ''
}

export default STUDY_COPY
