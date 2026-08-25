/**
 * Research Telemetry & Data Capture Service
 *
 * Provides a resilient, structured telemetry layer for controlled behavioural research.
 * Implements the Judge–Advisor paradigm schema, capturing all variables required for:
 *   - Weight of Advice (WoA) calculation
 *   - Verification accuracy / Error detection analysis
 *   - Linear mixed-effects modeling (LMM / ANOVA)
 *   - Per-step dwell, scroll depth, chart revisits, interaction counts (Appendix C.4)
 *   - Novice vs. Expert behavioural comparisons
 *   - Offline event queueing & batched retry transport
 *
 * Transport (Protocol run at ~500 concurrent participants):
 *   Events are queued locally and flushed in batches on an interval, on page
 *   hide via sendBeacon, and immediately for a small set of critical events.
 *   One HTTP request per event does not survive the target concurrency.
 */

// ── Environment & Config ──────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_STUDY_API_ENDPOINT || '/api/telemetry'
const APPLICATION_VERSION = '0.2.0'
const STUDY_VERSION = '4.1.0' // Study Protocol v4.1

// Batching policy
const FLUSH_INTERVAL_MS = 5000   // periodic batch flush
const MAX_BATCH_SIZE = 40        // envelopes per request
const MAX_QUEUE_LENGTH = 2000    // hard cap; oldest non-critical events shed first

// Events that must not wait for the next interval — they carry the primary DVs
// or mark an irreversible lifecycle transition.
const CRITICAL_EVENTS = new Set([
  'FINAL_ESTIMATE_SUBMITTED',
  'QUESTIONNAIRE_COMPLETED',
  'PARTICIPANT_EXCLUDED',
  'SESSION_COMPLETED',
])

// ── Local Storage Keys ────────────────────────────────────────────────────────
const QUEUE_STORAGE_KEY = 'study-telemetry-queue-v2'
const SESSION_STORAGE_KEY = 'study-session-metadata-v2'

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
  ATTENTION_CHECK_PASSED: 'ATTENTION_CHECK_PASSED',
  ATTENTION_CHECK_FAILED: 'ATTENTION_CHECK_FAILED',
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

function emptyTrialMetrics() {
  return {
    scrollDepthPct: 0,
    chartRevisitCount: 0,
    interactionCount: 0,
    focusChanges: 0,
    windowBlurEvents: 0,
    windowResumeEvents: 0,
    trialStartedAt: null,
    stepDwellMs: { 1: 0, 2: 0, 3: 0, 4: 0 },
    // Time the trial was open but the participant was NOT looking at it (tab
    // hidden or window unfocused). Raw dwell cannot distinguish "deliberated for
    // 90s" from "left the tab for 80s and decided in 10s", and dwell is a §6
    // measure the §7 models use — so away-time is accumulated and reported
    // alongside, letting an active-dwell measure be derived.
    stepActiveDwellMs: { 1: 0, 2: 0, 3: 0, 4: 0 },
    awayMs: 0,
    awaySince: null,
    stepAwayBaseline: 0,
  }
}

// ── Telemetry Service Class ───────────────────────────────────────────────────
class TelemetryService {
  constructor() {
    this.sessionMetadata = this._loadOrInitSession()
    this.trialMetrics = emptyTrialMetrics()
    // Kept under the old name so existing call sites keep working.
    this.passiveMetrics = this.trialMetrics
    this.isFlushing = false
    this.flushTimer = null

    this._initPassiveListeners()
    this._scheduleFlush()
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

  /**
   * Switches this session onto the canonical, server-issued participant id.
   *
   * Events recorded before assignment (session start, consent) carry the
   * provisional client id, so they are re-stamped here and the old id is kept
   * as `priorParticipantId` for linkage.
   */
  adoptServerParticipantId(serverParticipantId) {
    if (!serverParticipantId) return null
    const priorParticipantId = this.sessionMetadata.participantId
    if (priorParticipantId === serverParticipantId) return serverParticipantId

    this.sessionMetadata.priorParticipantId = priorParticipantId || null
    this.setSessionIdentity({ participantId: serverParticipantId })

    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
      let changed = false
      for (const envelope of queue) {
        if (!envelope.participantId || envelope.participantId === priorParticipantId) {
          envelope.participantId = serverParticipantId
          envelope.priorParticipantId = priorParticipantId || null
          changed = true
        }
      }
      if (changed) localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
    } catch {
      // Queue re-stamp is best-effort; the server also stores priorParticipantId.
    }

    return serverParticipantId
  }

  // ── Passive Event Listeners ───────────────────────────────────────────────
  _initPassiveListeners() {
    if (typeof window === 'undefined') return

    window.addEventListener('blur', () => {
      this.trialMetrics.windowBlurEvents += 1
      this._beginAway()
    })

    window.addEventListener('focus', () => {
      this.trialMetrics.windowResumeEvents += 1
      this.trialMetrics.focusChanges += 1
      this._endAway()
    })

    // Scroll DEPTH, not scroll event count: the deepest proportion of the
    // document the participant actually reached during this trial.
    window.addEventListener('scroll', () => {
      const doc = document.documentElement
      const scrollable = (doc.scrollHeight || 0) - (window.innerHeight || 0)
      const pct = scrollable > 0
        ? Math.round(Math.min(100, ((window.scrollY || 0) / scrollable) * 100))
        : 0
      if (pct > this.trialMetrics.scrollDepthPct) this.trialMetrics.scrollDepthPct = pct
    }, { passive: true })

    // Interaction count: every deliberate commit the participant makes.
    window.addEventListener('pointerdown', () => { this.trialMetrics.interactionCount += 1 }, { passive: true })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) {
        this.trialMetrics.interactionCount += 1
      }
    }, { passive: true })

    // Flush on hide — the reliable moment to get the tail of a session out.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this._beginAway()
        this.flushQueue({ beacon: true })
      } else {
        this._endAway()
      }
    })
    window.addEventListener('pagehide', () => this.flushQueue({ beacon: true }))
  }

  /** Starts an away interval (tab hidden or window blurred), if not already away. */
  _beginAway() {
    if (this.trialMetrics.awaySince == null) this.trialMetrics.awaySince = Date.now()
  }

  /** Closes an away interval and adds it to the trial's away total. */
  _endAway() {
    const since = this.trialMetrics.awaySince
    if (since == null) return
    this.trialMetrics.awayMs += Math.max(0, Date.now() - since)
    this.trialMetrics.awaySince = null
  }

  /** Away time accumulated so far, including an interval still open. */
  _awayMsNow() {
    const m = this.trialMetrics
    const open = m.awaySince == null ? 0 : Math.max(0, Date.now() - m.awaySince)
    return m.awayMs + open
  }

  /** Called when the participant returns attention to the chart (Appendix C.4). */
  recordChartRevisit(context = {}) {
    this.trialMetrics.chartRevisitCount += 1
    return this.trialMetrics.chartRevisitCount
  }

  resetTrialPassiveMetrics() {
    this.trialMetrics = emptyTrialMetrics()
    this.trialMetrics.trialStartedAt = Date.now()
    this.passiveMetrics = this.trialMetrics
  }

  /**
   * Accumulates per-step dwell so Step 4 can report the full four-step profile,
   * both raw and net of time the participant spent away from the tab.
   */
  recordStepDwell(step, dwellMs) {
    const n = Number(dwellMs)
    if (!Number.isFinite(n) || n < 0) return
    const m = this.trialMetrics
    m.stepDwellMs[step] = (m.stepDwellMs[step] || 0) + n

    const awayNow = this._awayMsNow()
    const awayThisStep = Math.max(0, awayNow - m.stepAwayBaseline)
    m.stepActiveDwellMs[step] = (m.stepActiveDwellMs[step] || 0) + Math.max(0, n - awayThisStep)
    m.stepAwayBaseline = awayNow
  }

  // ── Primary Dispatch Method ───────────────────────────────────────────────
  /**
   * Dispatches a structured, non-blocking telemetry event.
   */
  recordEvent(eventType, payload = {}, metadata = {}) {
    const timestamp = new Date().toISOString()
    const eventId = `EV-${Math.random().toString(36).substring(2, 11)}-${Date.now().toString(36)}`

    // Construct standard Envelope (No metadata duplication inside payload)
    const eventEnvelope = {
      eventId,
      eventType,
      timestamp,
      sessionId: this.sessionMetadata.sessionId,
      participantId: metadata.participantId || this.sessionMetadata.participantId,
      priorParticipantId: this.sessionMetadata.priorParticipantId || null,
      condition: metadata.condition || this.sessionMetadata.condition,
      participantType: metadata.participantType || this.sessionMetadata.participantType,
      screen: metadata.screen || payload.screen || 'unknown',
      trialId: metadata.trialId || payload.trialId || null,
      applicationVersion: APPLICATION_VERSION,
      studyVersion: STUDY_VERSION,
      payload: this._sanitizePayload(payload),
    }

    this._queueEvent(eventEnvelope)

    // Critical events go out now; everything else rides the next batch.
    if (CRITICAL_EVENTS.has(eventType)) {
      this.flushQueue()
    }

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
  _readQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }

  _writeQueue(queue) {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
    } catch (e) {
      console.warn('[Telemetry] Storage write failed', e)
    }
  }

  _queueEvent(eventEnvelope) {
    const queue = this._readQueue()
    queue.push(eventEnvelope)

    // Under a hard cap, shed the oldest non-critical events rather than losing
    // the newest — the primary DVs are always the most recent writes.
    if (queue.length > MAX_QUEUE_LENGTH) {
      const kept = queue.filter((e) => CRITICAL_EVENTS.has(e.eventType))
      const rest = queue.filter((e) => !CRITICAL_EVENTS.has(e.eventType))
      this._writeQueue([...kept, ...rest.slice(-(MAX_QUEUE_LENGTH - kept.length))])
      return
    }

    this._writeQueue(queue)
  }

  _scheduleFlush() {
    if (typeof window === 'undefined' || this.flushTimer) return
    this.flushTimer = setInterval(() => this.flushQueue(), FLUSH_INTERVAL_MS)
  }

  /**
   * Sends queued envelopes in batches. Only envelopes confirmed by the server
   * are removed, so a failed flush is retried on the next interval.
   *
   * The server de-duplicates on a unique `eventId`, so a re-sent batch is safe.
   */
  async flushQueue({ beacon = false } = {}) {
    if (!API_BASE_URL) return
    const queue = this._readQueue()
    if (queue.length === 0) return

    // sendBeacon is fire-and-forget and survives page unload, but gives no
    // confirmation — the queue is only cleared on a confirmed fetch.
    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(queue.slice(0, MAX_BATCH_SIZE))], { type: 'application/json' })
        navigator.sendBeacon(API_BASE_URL, blob)
      } catch {
        // Nothing further to try during unload.
      }
      return
    }

    if (this.isFlushing) return
    this.isFlushing = true

    try {
      const batch = queue.slice(0, MAX_BATCH_SIZE)
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      })

      if (response.ok) {
        const sent = new Set(batch.map((e) => e.eventId))
        this._writeQueue(this._readQueue().filter((e) => !sent.has(e.eventId)))
      }
    } catch {
      // Network failure — envelopes remain queued for the next interval.
    } finally {
      this.isFlushing = false
    }
  }

  // ── High-Level Domain Telemetry API ────────────────────────────────────────

  recordSessionStart(participantId) {
    if (participantId) this.setSessionIdentity({ participantId })
    return this.recordEvent(EventType.SESSION_STARTED, {
      timezone: this.sessionMetadata.timezone,
      language: this.sessionMetadata.language,
      screenResolution: this.sessionMetadata.screenResolution,
      startedAt: this.sessionMetadata.createdAt,
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

  recordTrialStart({ trialId, scenarioType, isPractice, orderIndex, scenario, isCorrect, errorDirection }) {
    this.resetTrialPassiveMetrics()

    const recObj = typeof scenario.recommendation === 'object' ? scenario.recommendation : {}

    return this.recordEvent(EventType.TRIAL_STARTED, {
      trialId,
      scenarioType,
      isPractice,
      orderIndex,
      // Assigned correctness comes from the plan; the scenario object alone
      // cannot tell which version this participant is about to see.
      isRecommendationCorrect: isCorrect != null ? Boolean(isCorrect) : null,
      errorDirection: errorDirection || null,
      correctRecommendation: recObj.correct ?? null,
      incorrectRecommendation: recObj.incorrect ?? null,
      historicalStatisticLabel: scenario.historicalStatistic?.label || null,
      historicalStatisticValue: scenario.historicalStatistic?.value || null,
      driversCount: scenario.drivers ? scenario.drivers.length : 0,
    }, { trialId })
  }

  recordStep1InitialEstimate({ trialId, isPractice, initialEstimate, initialConfidence, dwellMs, editCount = 1 }) {
    this.recordStepDwell(1, dwellMs)
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
    this.recordStepDwell(2, dwellMs)
    return this.recordEvent(EventType.AI_REVEALED, {
      trialId,
      isPractice,
      condition,
      explanationViewed: Boolean(explanationViewed),
      dwellMs,
    }, { trialId })
  }

  recordStep3Verification({ trialId, isPractice, verificationResponse, dwellMs }) {
    this.recordStepDwell(3, dwellMs)
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
    isPractice,
    isCorrect,
    errorDirection,
    groundTruthOptimal: customOptimal,
    initialEstimate,
    finalEstimate,
    finalConfidence,
    cognitiveLoad,
    verificationResponse,
    dwellMs,
  }) {
    this.recordStepDwell(4, dwellMs)

    const recObj = typeof scenario.recommendation === 'object' ? scenario.recommendation : {}
    const displayedRec = customAiRec ?? (recObj.active ?? scenario.recommendation)
    const optimal = customOptimal ?? (scenario.groundTruthOptimal ?? recObj.correct ?? recObj.optimal)

    const m = this.trialMetrics
    const totalTrialDwellMs = m.trialStartedAt ? Date.now() - m.trialStartedAt : 0

    const event = this.recordEvent(EventType.FINAL_ESTIMATE_SUBMITTED, {
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
      // Timings (Appendix C.4)
      step1DwellMs: m.stepDwellMs[1] || 0,
      step2DwellMs: m.stepDwellMs[2] || 0,
      step3DwellMs: m.stepDwellMs[3] || 0,
      step4DwellMs: dwellMs,
      totalTrialDwellMs,
      // Dwell net of time the tab was hidden or unfocused (§6 behavioural log)
      step1ActiveDwellMs: m.stepActiveDwellMs[1] || 0,
      step2ActiveDwellMs: m.stepActiveDwellMs[2] || 0,
      step3ActiveDwellMs: m.stepActiveDwellMs[3] || 0,
      step4ActiveDwellMs: m.stepActiveDwellMs[4] || 0,
      totalAwayMs: this._awayMsNow(),
      totalActiveDwellMs: Math.max(0, totalTrialDwellMs - this._awayMsNow()),
      // Behavioural log (Appendix C.4)
      scrollDepthPct: m.scrollDepthPct,
      chartRevisitCount: m.chartRevisitCount,
      interactionCount: m.interactionCount,
      focusChanges: m.focusChanges,
    }, { trialId })

    this.recordEvent(EventType.TRIAL_COMPLETED, {
      trialId,
      isPractice,
      totalTrialDwellMs,
    }, { trialId })

    return event
  }

  recordQuestionnaire(instrumentId, responses) {
    return this.recordEvent(EventType.QUESTIONNAIRE_COMPLETED, {
      instrumentId, // e.g. 'NASA_TLX', 'NUMERACY_SCALE', 'DOMAIN_EXPERIENCE', 'POST_TASK'
      responses,
    })
  }

  recordDebriefViewed() {
    return this.recordEvent(EventType.DEBRIEF_VIEWED, {
      viewedAt: new Date().toISOString(),
    })
  }

  recordSessionComplete() {
    const event = this.recordEvent(EventType.SESSION_COMPLETED, {
      totalDurationMs: new Date() - new Date(this.sessionMetadata.createdAt),
      completedAt: new Date().toISOString(),
    })
    this.flushQueue()
    return event
  }
}

// Export singleton telemetry service instance
export const telemetry = new TelemetryService()
export default telemetry

// Re-export createParticipantId for backward compatibility with App.jsx
export { createParticipantId as legacyCreateParticipantId }
