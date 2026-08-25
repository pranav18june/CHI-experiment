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
  institution: '',            // e.g. 'Indian Institute of Technology Bombay'
  department: '',             // e.g. 'Department of Industrial Engineering'
  principalInvestigator: '',  // full name of the responsible researcher
  researchTeam: '',           // e.g. 'A. Sharma and B. Müller' — optional but preferred

  // Where a participant writes with a question, a concern, or to withdraw.
  // A monitored address. Not a personal inbox that stops being read in March.
  contactEmail: '',           // REQUIRED

  // The independent body that approved this study, and its reference number.
  // A participant must be able to complain to someone who is not you.
  ethicsCommittee: '',        // REQUIRED  e.g. 'IIT Bombay Institute Ethics Committee'
  ethicsApprovalRef: '',      // REQUIRED  e.g. 'IITB-IEC/2026/041'
  ethicsContactEmail: '',     // REQUIRED  independent of contactEmail where possible

  // ── Money (§5.10, open item F-7) ──────────────────────────────────── REQUIRED
  // The bonus decreases with accumulated cost regret and weights stockout-side
  // error more heavily. Participants are told this QUALITATIVELY only — the
  // ratio and the formula are never disclosed (§5.10).
  compensation: {
    // Novice / student participants
    baseAmount: '',           // REQUIRED  e.g. '₹250'
    bonusMaximum: '',         // REQUIRED  e.g. '₹150'
    bonusDescription:
      'a performance bonus of up to {bonusMaximum}, based on how close your ' +
      'decisions come to the cost-optimal answer',
    payoutMethod: '',         // REQUIRED  e.g. 'UPI transfer within 14 days'

    // Experts may be compensated differently — honorarium or a company
    // arrangement rather than the same bonus (§5.10, §11). Leave blank to show
    // novices' terms to everyone.
    expertArrangement: '',    // e.g. 'an honorarium of ₹2,000 paid to you directly'
  },

  // ── Data handling (§11) ───────────────────────────────────────────── REQUIRED
  dataRetentionPeriod: '',    // REQUIRED  e.g. 'five years after publication'
  dataStorageLocation: '',    // REQUIRED  e.g. 'encrypted servers in the EU'
  withdrawalWindow: '',       // REQUIRED  e.g. '30 days after you take part'

  // ── Completion (§5.11) ────────────────────────────────────────────────────
  // Where participants go afterwards. Leave redirectUrl blank to simply show
  // the confirmation code.
  redirectUrl: '',            // e.g. 'https://app.prolific.com/submissions/complete?cc=XXXX'
  redirectLabel: '',          // e.g. 'Return to Prolific'
  creditNote: '',             // e.g. 'Course credit is recorded automatically.'

  // ── Duration ──────────────────────────────────────────────────────────────
  // Twelve four-step decisions plus training, practice and the closing
  // questionnaire. Measure this in the pilot and correct it — an advertised
  // figure that is half the real one is its own consent problem.
  estimatedDuration: '35–45 minutes',
}

/** Fields that must be non-empty before the study may run. */
const REQUIRED_PATHS = [
  'institution', 'principalInvestigator', 'contactEmail',
  'ethicsCommittee', 'ethicsApprovalRef', 'ethicsContactEmail',
  'compensation.baseAmount', 'compensation.bonusMaximum', 'compensation.payoutMethod',
  'dataRetentionPeriod', 'dataStorageLocation', 'withdrawalWindow',
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
  return copy.compensation.bonusDescription.replace('{bonusMaximum}', copy.compensation.bonusMaximum || '—')
}

export default STUDY_COPY
