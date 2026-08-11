/**
 * Centralized Study Configuration & Environment Flags
 */

export const CONFIG = {
  APPLICATION_VERSION: '0.2.0',
  STUDY_VERSION: import.meta.env.VITE_STUDY_VERSION || '4.1.0',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_STUDY_API_ENDPOINT || '',

  // Feature Flags
  FEATURE_FLAGS: {
    ENABLE_PRACTICE_MODE: import.meta.env.VITE_ENABLE_PRACTICE_MODE !== 'false',
    ENABLE_TELEMETRY: import.meta.env.VITE_ENABLE_TELEMETRY !== 'false',
    DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
    ENABLE_POST_TASK_QUESTIONNAIRES: import.meta.env.VITE_ENABLE_POST_TASK === 'true',
  },

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
