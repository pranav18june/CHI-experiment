/**
 * Centralized Study Configuration & Environment Flags
 */

// ==============================================================================
// PLACEHOLDER PENDING RESEARCHER SIGN-OFF:
// Asymmetric Regret Cost Weight Constants (Protocol Primary Outcome Measure)
// The stockout penalty weight (default ~1.85x) is currently an empirical placeholder
// pending final formal sign-off from the study's pre-registration. It is NOT a finalized
// protocol decision and can be overridden via process.env.STOCKOUT_PENALTY_WEIGHT or
// import.meta.env.VITE_STOCKOUT_PENALTY_WEIGHT.
// ==============================================================================
const envStockout = typeof process !== 'undefined' && process?.env?.STOCKOUT_PENALTY_WEIGHT
  ? Number(process.env.STOCKOUT_PENALTY_WEIGHT)
  : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STOCKOUT_PENALTY_WEIGHT
      ? Number(import.meta.env.VITE_STOCKOUT_PENALTY_WEIGHT)
      : 1.85)

const envHolding = typeof process !== 'undefined' && process?.env?.HOLDING_PENALTY_WEIGHT
  ? Number(process.env.HOLDING_PENALTY_WEIGHT)
  : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HOLDING_PENALTY_WEIGHT
      ? Number(import.meta.env.VITE_HOLDING_PENALTY_WEIGHT)
      : 1.0)

export const STOCKOUT_PENALTY_WEIGHT = Number.isFinite(envStockout) ? envStockout : 1.85
export const HOLDING_PENALTY_WEIGHT = Number.isFinite(envHolding) ? envHolding : 1.0

export const CONFIG = {
  APPLICATION_VERSION: '0.2.0',
  STUDY_VERSION: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STUDY_VERSION) || '4.1.0',
  API_BASE_URL: (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_STUDY_API_ENDPOINT)) || '',

  // Protocol Primary Outcome Weight Constants
  STOCKOUT_PENALTY_WEIGHT,
  HOLDING_PENALTY_WEIGHT,

  // Feature Flags
  FEATURE_FLAGS: {
    ENABLE_PRACTICE_MODE: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_PRACTICE_MODE !== 'false'),
    ENABLE_TELEMETRY: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_TELEMETRY !== 'false'),
    DEBUG_MODE: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_MODE === 'true'),
    ENABLE_POST_TASK_QUESTIONNAIRES: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_POST_TASK === 'true'),
  },

  // ==========================================================================
  // PLACEHOLDER PENDING RESEARCHER SIGN-OFF (§9, §12 item 15):
  // Minimum plausible time on a scored trial. §9 pre-registers exclusion for
  // "per-trial time below a pilot-set floor". Trials faster than this are
  // flagged (`belowTimeFloor`) at write time — never silently dropped — so the
  // exclusion stays a documented analysis decision. Set from the pilot.
  // ==========================================================================
  MIN_TRIAL_DURATION_MS: Number(
    (typeof process !== 'undefined' && process?.env?.MIN_TRIAL_DURATION_MS) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIN_TRIAL_DURATION_MS) ||
    8000
  ),

  // Likert scale configuration
  SCALE_RANGE: [1, 2, 3, 4, 5, 6, 7],

  // Conditions
  CONDITIONS: ['c0', 'c1', 'c2', 'c3'],

  // Verification Options
  VERIFICATION_OPTIONS: [
    { value: 'too_high', label: 'Too High' },
    { value: 'about_right', label: 'About Right' },
    { value: 'too_low', label: 'Too Low' },
  ],
}

export default CONFIG
