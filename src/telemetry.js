/**
 * Research Telemetry & Data Capture Service
 *
 * Provides a resilient, structured telemetry layer for controlled behavioural research.
 * Implements the Judge–Advisor paradigm schema, capturing all variables required for:
 *   - Weight of Advice (WoA) calculation
 *   - Verification accuracy / Error detection analysis
 *   - Linear mixed-effects modeling (LMM / ANOVA)
 *   - Dwell-time / Dwell-step analytics
 *   - Novice vs. Expert behavioural comparisons
 *   - Offline event queueing & retry transport
 *
 * Supports future statistical analysis without requiring any frontend modifications.
 */

// ── Environment & Config ──────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_STUDY_API_ENDPOINT || '/api/telemetry'
const APPLICATION_VERSION = '0.2.0'
const STUDY_VERSION = '4.1.0' // Study Protocol v4.1

// TODO_STUDY_VERSIONING: Maintain compatibility with protocol updates via environment or config manifest.
// TODO_BACKEND_AUTH: Add authorization headers / HMAC signing token for backend API endpoints.
// TODO_SESSION_RECOVERY_POLICY: Define exact session re-hydration behavior on browser refresh.
// TODO_EVENT_RETENTION: Define client-side queue flush & max retention policies.
// TODO_ANALYTICS_EXPORT: Provide CSV/JSON export helper for offline research deployments.

// ── Local Storage Keys ────────────────────────────────────────────────────────
const QUEUE_STORAGE_KEY = 'study-telemetry-queue-v2'
const SESSION_STORAGE_KEY = 'study-session-metadata-v2'
const STATE_RECOVERY_KEY = 'study-state-recovery-v2'

// ── Helper: Random UUID / Participant ID Generation ───────────────────────────
export function createParticipantId() {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 10)
  return `P-${uuid.slice(0, 8).toUpperCase()}`
}

export function createSessionId() {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 10)
  return `S-${uuid.slice(0, 12).toUpperCase()}`
}

// ── Event Types Registry ──────────────────────────────────────────────────────
export const EventType = {
  // Session & Flow
  SESSION_STARTED: 'SESSION_STARTED',
  CONSENT_COMPLETED: 'CONSENT_COMPLETED',
  PARTICIPANT_TYPE_SELECTED: 'PARTICIPANT_TYPE_SELECTED',
  TRAINING_STARTED: 'TRAINING_STARTED',
  TRAINING_COMPLETED: 'TRAINING_COMPLETED',
  COMPREHENSION_CHECK_PASSED: 'COMPREHENSION_CHECK_PASSED',
  COMPREHENSION_CHECK_FAILED: 'COMPREHENSION_CHECK_FAILED',
  PARTICIPANT_EXCLUDED: 'PARTICIPANT_EXCLUDED',
  PRACTICE_STARTED: 'PRACTICE_STARTED',
  PRACTICE_COMPLETED: 'PRACTICE_COMPLETED',

  // Judge-Advisor Trial Sequence
  TRIAL_STARTED: 'TRIAL_STARTED',
  INITIAL_ESTIMATE_SUBMITTED: 'INITIAL_ESTIMATE_SUBMITTED', // Step 1
  AI_REVEALED: 'AI_REVEALED',                               // Step 2
  VERIFICATION_COMPLETED: 'VERIFICATION_COMPLETED',         // Step 3
  FINAL_ESTIMATE_SUBMITTED: 'FINAL_ESTIMATE_SUBMITTED',     // Step 4
  TRIAL_COMPLETED: 'TRIAL_COMPLETED',

  // Questionnaires & Completion
  QUESTIONNAIRE_COMPLETED: 'QUESTIONNAIRE_COMPLETED',
  DEBRIEF_VIEWED: 'DEBRIEF_VIEWED',
  SESSION_COMPLETED: 'SESSION_COMPLETED',

  // Passive & UX Observability
  SCREEN_VIEWED: 'SCREEN_VIEWED',
  BUTTON_CLICKED: 'BUTTON_CLICKED',
  SCROLL_EVENT: 'SCROLL_EVENT',
  CHART_INTERACTION: 'CHART_INTERACTION',

  // Resilience & Technical
  APPLICATION_ERROR: 'APPLICATION_ERROR',
  NETWORK_FAILURE: 'NETWORK_FAILURE',
  OFFLINE_QUEUE: 'OFFLINE_QUEUE',
}

// ── Telemetry Service Class ───────────────────────────────────────────────────
class TelemetryService {
  constructor() {
    this.sessionMetadata = this._loadOrInitSession()
    this.passiveMetrics = {
      scrollCount: 0,
      chartInteractions: 0,
      focusChanges: 0,
      windowBlurEvents: 0,
      windowResumeEvents: 0,
    }
    this.isFlushing = false

    this._initPassiveListeners()
    // Attempt initial queue flush on load
    setTimeout(() => this.flushQueue(), 1000)
  }

  // ── Session Initialization & Persistence ──────────────────────────────────
  _loadOrInitSession() {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {
      // Ignore storage errors
    }

    const metadata = {
      sessionId: createSessionId(),
      participantId: null,
      condition: null,
      participantType: null,
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      screenResolution: typeof window !== 'undefined' ? `${window.screen?.width}x${window.screen?.height}` : 'unknown',
      createdAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(metadata))
    } catch {
      // Storage fallback
    }
    return metadata
  }

  setSessionIdentity({ participantId, condition, participantType }) {
    if (participantId) this.sessionMetadata.participantId = participantId
    if (condition) this.sessionMetadata.condition = condition
    if (participantType) this.sessionMetadata.participantType = participantType

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionMetadata))
    } catch {
      // Storage error
    }
  }

  // ── Passive Event Listeners ───────────────────────────────────────────────
  _initPassiveListeners() {
    if (typeof window === 'undefined') return

    window.addEventListener('blur', () => {
      this.passiveMetrics.windowBlurEvents += 1
      this.recordEvent(EventType.SCREEN_VIEWED, { action: 'window_blur' })
    })

    window.addEventListener('focus', () => {
      this.passiveMetrics.windowResumeEvents += 1
      this.passiveMetrics.focusChanges += 1
      this.recordEvent(EventType.SCREEN_VIEWED, { action: 'window_focus' })
    })

    window.addEventListener('scroll', () => {
      this.passiveMetrics.scrollCount += 1
    }, { passive: true })
  }

  resetTrialPassiveMetrics() {
    this.passiveMetrics = {
      scrollCount: 0,
      chartInteractions: 0,
      focusChanges: 0,
      windowBlurEvents: 0,
      windowResumeEvents: 0,
    }
  }

  // ── Primary Dispatch Method ───────────────────────────────────────────────
  /**
   * Dispatches a structured, non-blocking telemetry event.
   */
  recordEvent(eventType, payload = {}, metadata = {}) {
    const timestamp = new Date().toISOString()
    const eventId = `EV-${Math.random().toString(36).substring(2, 11)}`

    // Construct standard Envelope (No metadata duplication inside payload)
    const eventEnvelope = {
      eventId,
      eventType,
      timestamp,
      sessionId: this.sessionMetadata.sessionId,
      participantId: metadata.participantId || this.sessionMetadata.participantId,
      condition: metadata.condition || this.sessionMetadata.condition,
      participantType: metadata.participantType || this.sessionMetadata.participantType,
      screen: metadata.screen || payload.screen || 'unknown',
      trialId: metadata.trialId || payload.trialId || null,
      applicationVersion: APPLICATION_VERSION,
      studyVersion: STUDY_VERSION,
      payload: this._sanitizePayload(payload),
    }

    // Persist locally in queue asynchronously
    this._queueEvent(eventEnvelope)

    // Attempt non-blocking HTTP dispatch
    this._sendEvent(eventEnvelope)

    return eventEnvelope
  }

  _sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload
    // Strip any sensitive properties if passed accidentally
    const copy = { ...payload }
    delete copy.name
    delete copy.email
    delete copy.phone
    delete copy.ip
    return copy
  }

  // ── Queue & Transport Layer ───────────────────────────────────────────────
  _queueEvent(eventEnvelope) {
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
      queue.push(eventEnvelope)
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
    } catch (e) {
      // LocalStorage quota fallback
      console.warn('[Telemetry] Storage write failed', e)
    }
  }

  async _sendEvent(eventEnvelope) {
    if (!API_BASE_URL) return

    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventEnvelope),
        keepalive: true,
      })

      if (response.ok) {
        this._removeFromQueue(eventEnvelope.eventId)
      }
    } catch {
      // Network failure — envelope remains queued safely in LocalStorage
    }
  }

  _removeFromQueue(eventId) {
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
      const updated = queue.filter((item) => item.eventId !== eventId)
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Queue update fallback
    }
  }

  async flushQueue() {
    if (this.isFlushing || !API_BASE_URL) return
    this.isFlushing = true

    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
      if (queue.length === 0) {
        this.isFlushing = false
        return
      }

      // Send pending events in batch
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queue),
        keepalive: true,
      })

      if (response.ok) {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([]))
      }
    } catch {
      // Retry on next trigger
    } finally {
      this.isFlushing = false
    }
  }

  // ── High-Level Domain Telemetry API ────────────────────────────────────────

  recordSessionStart(participantId) {
    this.setSessionIdentity({ participantId })
    return this.recordEvent(EventType.SESSION_STARTED, {
      timezone: this.sessionMetadata.timezone,
      language: this.sessionMetadata.language,
      screenResolution: this.sessionMetadata.screenResolution,
    })
  }

  recordConsent(demographics) {
    return this.recordEvent(EventType.CONSENT_COMPLETED, {
      programme: demographics.programme,
      studyYear: demographics.studyYear,
      supplyChainExperience: demographics.supplyChainExperience,
      aiUse: demographics.aiUse,
      gender: demographics.gender,
      age: Number(demographics.age),
    })
  }

  recordParticipantType(participantType, condition) {
    this.setSessionIdentity({ participantType, condition })
    return this.recordEvent(EventType.PARTICIPANT_TYPE_SELECTED, {
      participantType,
      condition,
    })
  }

  recordTrialStart({ trialId, scenarioType, isPractice, orderIndex, scenario }) {
    this.resetTrialPassiveMetrics()

    // Determine recommendation correctness classification (never shown to participant)
    const recObj = typeof scenario.recommendation === 'object' ? scenario.recommendation : {}
    const displayedRec = recObj.active ?? scenario.recommendation
    const correctRec = recObj.correct ?? scenario.optimal
    const incorrectRec = recObj.incorrect ?? null
    const isCorrectRec = displayedRec === correctRec

    return this.recordEvent(EventType.TRIAL_STARTED, {
      trialId,
      scenarioType,
      isPractice,
      orderIndex,
      displayedRecommendation: displayedRec,
      correctRecommendation: correctRec,
      incorrectRecommendation: incorrectRec,
      isRecommendationCorrect: isCorrectRec,
      historicalStatisticLabel: scenario.historicalStatistic?.label || null,
      historicalStatisticValue: scenario.historicalStatistic?.value || null,
      driversCount: scenario.drivers ? scenario.drivers.length : 0,
    }, { trialId })
  }

  recordStep1InitialEstimate({ trialId, isPractice, initialEstimate, initialConfidence, dwellMs, editCount = 1 }) {
    return this.recordEvent(EventType.INITIAL_ESTIMATE_SUBMITTED, {
      trialId,
      isPractice,
      initialEstimate: Number(initialEstimate),
      initialConfidence: Number(initialConfidence),
      dwellMs,
      editCount,
    }, { trialId })
  }

  recordStep2AIReveal({ trialId, isPractice, condition, explanationViewed, dwellMs }) {
    return this.recordEvent(EventType.AI_REVEALED, {
      trialId,
      isPractice,
      condition,
      explanationViewed: Boolean(explanationViewed),
      dwellMs,
    }, { trialId })
  }

  recordStep3Verification({ trialId, isPractice, verificationResponse, dwellMs }) {
    return this.recordEvent(EventType.VERIFICATION_COMPLETED, {
      trialId,
      isPractice,
      verificationResponse, // 'too_high' | 'about_right' | 'too_low'
      dwellMs,
    }, { trialId })
  }

  recordStep4FinalEstimate({
    trialId,
    scenario,
    aiRecommendation: customAiRec,
    isCorrect,
    errorDirection,
    groundTruthOptimal: customOptimal,
    finalEstimate,
    finalConfidence,
    cognitiveLoad,
    verificationResponse,
    dwellMs,
    totalTrialDwellMs,
  }) {
    const recObj = typeof scenario.recommendation === 'object' ? scenario.recommendation : {}
    const displayedRec = customAiRec ?? (recObj.active ?? scenario.recommendation)
    const optimal = customOptimal ?? (scenario.groundTruthOptimal ?? recObj.correct ?? recObj.optimal)

    return this.recordEvent(EventType.FINAL_ESTIMATE_SUBMITTED, {
      trialId,
      scenarioType: scenario.scenarioType || scenario.type,
      isPractice,
      isCorrect: isCorrect != null ? Boolean(isCorrect) : null,
      errorDirection: errorDirection || 'na',
      groundTruthOptimal: optimal != null ? Number(optimal) : null,
      // Required variables for Weight of Advice (WoA) calculation
      initialEstimate: Number(initialEstimate),
      aiRecommendation: Number(displayedRec),
      finalEstimate: Number(finalEstimate),
      // Ratings & Verification
      finalConfidence: Number(finalConfidence),
      cognitiveLoad: Number(cognitiveLoad),
      verificationResponse,
      // Timings & Observability
      step4DwellMs: dwellMs,
      totalTrialDwellMs,
      scrollCount: this.passiveMetrics.scrollCount,
      chartInteractions: this.passiveMetrics.chartInteractions,
      focusChanges: this.passiveMetrics.focusChanges,
    }, { trialId })
  }

  recordQuestionnaire(instrumentId, responses) {
    return this.recordEvent(EventType.QUESTIONNAIRE_COMPLETED, {
      instrumentId, // e.g. 'NASA_TLX', 'NUMERACY_SCALE', 'DOMAIN_EXPERIENCE', 'POST_TASK'
      responses,
    })
  }

  recordSessionComplete() {
    return this.recordEvent(EventType.SESSION_COMPLETED, {
      totalDurationMs: new Date() - new Date(this.sessionMetadata.createdAt),
    })
  }
}

// Export singleton telemetry service instance
export const telemetry = new TelemetryService()
export default telemetry

// Re-export createParticipantId for backward compatibility with App.jsx
export { createParticipantId as legacyCreateParticipantId }
