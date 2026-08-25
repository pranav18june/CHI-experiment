import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { trials, practiceTrials, studyTypes } from '../studyData.js'
import telemetry, { EventType } from '../telemetry.js'
import CONFIG from '../config/index.js'
import { normalizeNumericInput } from '../services/validationService.js'
import { getScenarioById, getExplanation as lookupExplanation } from '../scenarios/index.js'

// ── Storage Keys ──────────────────────────────────────────────────────────────
const AUTOSAVE_STORAGE_KEY = 'study-session-autosave-v1'
const MAX_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000 // 24-hour single-session resume window

// ── 2×4 Factorial Design Constants ───────────────────────────────────────────
export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']
export const PARTICIPANT_TYPES = ['novice', 'expert']

/**
 * Researcher-only URL overrides (?condition=, ?trial=).
 *
 * These override the between-subjects manipulation, so they are gated behind an
 * explicit build flag and are OFF in the participant-facing build. Any session
 * that uses one is stamped `previewOverride` so it can never be mistaken for
 * collected data.
 */
const ALLOW_URL_OVERRIDES = import.meta.env?.VITE_ALLOW_URL_OVERRIDES === 'true'

// Server assignment must succeed. These govern how hard the client tries before
// telling the participant something is wrong — it never invents an assignment.
// Trials themselves need no network: they render from the plan issued here.
const ASSIGNMENT_TIMEOUT_MS = 12000
const ASSIGNMENT_MAX_ATTEMPTS = 4

/**
 * Maps each study phase to its canonical URL path.
 */
export const PHASE_TO_PATH = {
  'consent':            '/',
  'participant-type':   '/type',
  'training':           '/training',
  'walkthrough':        '/walkthrough',
  'check':              '/check',
  'practice':           '/practice',
  'practice-feedback':  '/practice',
  'scored':             '/scored',
  'post-task':          '/post-task',
  'debrief':            '/debrief',
  'complete':           '/complete',
  'excluded':           '/excluded',
}

/**
 * Reverse mapping from URL path to phase.
 */
export const PATH_TO_PHASE = {
  '/':            'consent',
  '/type':        'participant-type',
  '/training':    'training',
  '/walkthrough': 'walkthrough',
  '/check':       'check',
  '/practice':    'practice',
  '/scored':      'scored',
  '/post-task':   'post-task',
  '/debrief':     'debrief',
  '/complete':    'complete',
  '/excluded':    'excluded',
}

/**
 * Which phases may legitimately render each route (Protocol §5.11 ordering).
 * Enforced by GuardedRoute; participants cannot skip forward by URL or reach a
 * completed phase again with the back button.
 */
export const ROUTE_ALLOWED_PHASES = {
  '/':            ['consent'],
  '/type':        ['participant-type'],
  '/training':    ['training'],
  '/walkthrough': ['walkthrough'],
  '/check':       ['check'],
  '/practice':    ['practice', 'practice-feedback'],
  '/scored':      ['scored'],
  '/post-task':   ['post-task'],
  '/debrief':     ['debrief'],
  '/complete':    ['complete'],
  '/excluded':    ['excluded'],
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ── Context Definition ────────────────────────────────────────────────────────
const StudyContext = createContext(null)

export function useStudyContext() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudyContext must be used within <StudyProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function StudyProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  // ── Session identity ───────────────────────────────────────────────────────
  // Provisional until assignment: the server issues the canonical id and the
  // client adopts it (see handleParticipantTypeSelect).
  const [participantId, setParticipantId] = useState(() =>
    telemetry.sessionMetadata.participantId || telemetry._loadOrInitSession().participantId
  )
  const [participantType, setParticipantType] = useState('novice')

  // ── Novice Comprehension Check & Exclusion State (Appendix C.1) ─────────────
  const [comprehensionPassed, setComprehensionPassed] = useState(false)
  const [isExcluded, setIsExcluded] = useState(false)

  // ── Assignment lifecycle ───────────────────────────────────────────────────
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignmentError, setAssignmentError] = useState(null)
  const [adviceError, setAdviceError] = useState(null)

  const queryParams = new URLSearchParams(location.search)
  const requestedCondition = ALLOW_URL_OVERRIDES ? queryParams.get('condition') : null
  const requestedTrialId = ALLOW_URL_OVERRIDES ? (queryParams.get('trial') || queryParams.get('trialId')) : null

  // Appendix C.2 — think-aloud sessions are flagged at recruitment so their
  // timing measures can be excluded from the dwell analyses.
  const isThinkAloud = queryParams.get('thinkAloud') === '1'

  const availableTrials = location.pathname === '/practice' ? practiceTrials : trials
  const requestedTrialNumber = Number.parseInt(requestedTrialId, 10)
  const requestedTrialIndex = Number.isInteger(requestedTrialNumber) && requestedTrialNumber > 0
    ? requestedTrialNumber - 1
    : availableTrials.findIndex((item) => item.id === requestedTrialId)
  const hasValidDirectTrial = requestedTrialIndex >= 0 && requestedTrialIndex < availableTrials.length
  const directTrialIndex = hasValidDirectTrial ? requestedTrialIndex : 0
  const hasDirectTrial = (location.pathname === '/practice' || location.pathname === '/scored') && hasValidDirectTrial
  const isPreviewOverride = ALLOW_URL_OVERRIDES && (hasDirectTrial || CONDITIONS.includes(requestedCondition))

  // ── Condition (c0 / c1 / c2 / c3) — assigned by the server at /type ────────
  const [condition, setCondition] = useState(() => {
    if (ALLOW_URL_OVERRIDES && CONDITIONS.includes(requestedCondition)) return requestedCondition
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.condition && CONDITIONS.includes(parsed.condition)) {
          return parsed.condition
        }
      }
    } catch {}
    return null // null until the server assigns — never a default cell
  })

  // ── Server-assigned counterbalanced 12-trial plan ──────────────────────────
  const [trialPlan, setTrialPlan] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.trialPlan && Array.isArray(parsed.trialPlan)) {
          return parsed.trialPlan
        }
      }
    } catch {}
    return null
  })

  // ── Phase is authoritative state, NOT derived from the URL ─────────────────
  //
  // Deriving phase from location.pathname made the route guard meaningless:
  // typing /scored set phase to 'scored', so the guard then found the phase
  // allowed and rendered the scored block. Phase advances only through
  // setPhase(); the URL follows it, and GuardedRoute redirects anything else.
  const [phase, setPhaseState] = useState(() => {
    if (ALLOW_URL_OVERRIDES && PATH_TO_PHASE[location.pathname]) {
      return PATH_TO_PHASE[location.pathname] // researcher preview only
    }
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const elapsed = Date.now() - (parsed.savedAt || 0)
        if (elapsed < MAX_RESUME_WINDOW_MS && parsed.phase && PHASE_TO_PATH[parsed.phase]) {
          return parsed.phase
        }
      }
    } catch {}
    return 'consent'
  })

  useEffect(() => {
    // Researcher preview may select a condition without running assignment.
    if (ALLOW_URL_OVERRIDES && CONDITIONS.includes(requestedCondition) && condition !== requestedCondition) {
      setCondition(requestedCondition)
      telemetry.setSessionIdentity({ condition: requestedCondition })
    }

    // Exclusion lock: a pre-registered exclusion is terminal. No route escapes it.
    if (isExcluded && location.pathname !== '/excluded') {
      navigate('/excluded', { replace: true })
    }
  }, [location.pathname, location.search, isExcluded, condition, navigate, requestedCondition])

  const setPhase = useCallback((nextPhase) => {
    setPhaseState(nextPhase)
    if (nextPhase === 'scored') {
      setIsPractice(false)
    } else if (nextPhase === 'practice' || nextPhase === 'practice-feedback') {
      setIsPractice(true)
    }
    const targetPath = PHASE_TO_PATH[nextPhase]
    if (targetPath && location.pathname !== targetPath) {
      navigate(targetPath)
    }
  }, [navigate, location.pathname])

  // ── Trial tracking ─────────────────────────────────────────────────────────
  const [isPractice, setIsPractice] = useState(() => phase === 'practice' || phase === 'practice-feedback')
  const [trialIndex, setTrialIndex] = useState(() => (
    requestedTrialId ? directTrialIndex : 0
  ))
  const [trialStep, setTrialStep] = useState(1)

  // ── Step data ────────────────────────────────────────────────────────────
  const [initialEstimate, setInitialEstimate] = useState('')
  const [initialConfidence, setInitialConfidence] = useState(null)
  const [verificationResponse, setVerificationResponse] = useState(null)
  const [finalEstimate, setFinalEstimate] = useState('')
  const [finalConfidence, setFinalConfidence] = useState(null)
  const [cognitiveLoad, setCognitiveLoad] = useState(null)

  const [fetchedAdvice, setFetchedAdvice] = useState(null)
  const [fetchedExplanation, setFetchedExplanation] = useState(null)
  const [currentIsCorrect, setCurrentIsCorrect] = useState(null)
  const [currentErrorDirection, setCurrentErrorDirection] = useState(null)
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false)

  const [startedAt, setStartedAt] = useState(Date.now())

  // ── Derived values ─────────────────────────────────────────────────────────
  //
  // Scored trials follow the participant's own presentation order from the
  // server-issued plan (§5.11). Walking the static `trials` array instead would
  // show every participant the same fixed sequence, which is exactly the
  // confound the counterbalancing removes.
  const orderedScoredTrials = useMemo(() => {
    if (!trialPlan || !Array.isArray(trialPlan) || trialPlan.length === 0) return trials
    const resolved = trialPlan
      .map((item) => getScenarioById(item.trialId))
      .filter(Boolean)
    return resolved.length === trialPlan.length ? resolved : trials
  }, [trialPlan])

  const currentTrials = isPractice ? practiceTrials : orderedScoredTrials
  const trial = currentTrials[trialIndex] ?? currentTrials[0] ?? null
  const type = trial ? (studyTypes[trial.scenarioType || trial.type] || trial) : null
  const totalTrials = currentTrials.length
  const trialNumber = trialIndex + 1
  const isLastTrial = trialIndex === totalTrials - 1
  const progress = Math.round((trialIndex / totalTrials) * 100)

  const explanation = useMemo(() => {
    if (fetchedExplanation !== null) return fetchedExplanation
    if (!trial || condition === 'c0' || !condition) return null
    // Scored trials take their explanation from the server-issued plan only.
    // Falling back to a local lookup here would have to guess correctness, and
    // guessing wrong serves the opposite version's text — the exact
    // cross-correctness swap the separate stimulus banks exist to prevent.
    if (!isPractice) return null
    return lookupExplanation(trial, condition, currentIsCorrect ?? false)
  }, [condition, trial, fetchedExplanation, currentIsCorrect, isPractice])

  // ── Chart preloading ───────────────────────────────────────────────────────
  //
  // The chart is the primary stimulus and each PNG is ~160 KB (1.9 MB across the
  // bank). Fetched lazily at trial render, its arrival lands inside the Step-1
  // dwell window: the timer runs while the stimulus is still downloading, so
  // dwell picks up network latency that varies by connection, and on a slow link
  // a participant can commit an estimate before the chart paints. Warming the
  // cache during training/practice — where nothing is timed — moves that cost
  // off the measured path.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!['training', 'walkthrough', 'check', 'practice', 'practice-feedback'].includes(phase)) return

    const sources = (trialPlan && trialPlan.length
      ? trialPlan.map((item) => getScenarioById(item.trialId)?.chartImage)
      : trials.map((t) => t.chartImage)
    ).filter(Boolean)

    const images = sources.map((src) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      return img
    })
    return () => { for (const img of images) img.src = '' }
  }, [phase, trialPlan])

  // ── Session start (Protocol §6 lifecycle) ─────────────────────────────────
  const sessionStartRecorded = useRef(false)
  useEffect(() => {
    if (sessionStartRecorded.current) return
    sessionStartRecorded.current = true
    try {
      telemetry.recordSessionStart(participantId)
    } catch (err) {
      console.error('[telemetry] session start failed', err)
    }
  }, [participantId])

  // ── Autosave recovery (only restores if on root '/' and active session exists) ─
  //
  // The write effect below must not run until the restored values have actually
  // landed. Both effects fire in the same mount commit, and the restore's
  // setState calls only take effect on the NEXT render — so a write gated on a
  // synchronous ref still persists the DEFAULT state over the restored session.
  // This has to be state: flipping it forces a re-render, and only then does the
  // write see the restored values.
  //
  // The bug it prevents: an expert who refreshed mid-study was written back as a
  // novice, which hid the expert-only post-task section (Appendix C.3).
  const [hasRestored, setHasRestored] = useState(false)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const elapsed = Date.now() - (parsed.savedAt || 0)
        if (elapsed < MAX_RESUME_WINDOW_MS && parsed.participantId === participantId) {
          if (parsed.participantType) setParticipantType(parsed.participantType)
          if (!requestedCondition && parsed.condition && CONDITIONS.includes(parsed.condition)) setCondition(parsed.condition)
          if (parsed.trialPlan) setTrialPlan(parsed.trialPlan)
          if (typeof parsed.comprehensionPassed === 'boolean') setComprehensionPassed(parsed.comprehensionPassed)
          if (typeof parsed.isExcluded === 'boolean') setIsExcluded(parsed.isExcluded)
          if (!hasDirectTrial && typeof parsed.isPractice === 'boolean') setIsPractice(parsed.isPractice)
          if (!hasDirectTrial && typeof parsed.trialIndex === 'number') setTrialIndex(parsed.trialIndex)
          if (!hasDirectTrial && typeof parsed.trialStep === 'number') setTrialStep(parsed.trialStep)
          if (parsed.initialEstimate) setInitialEstimate(parsed.initialEstimate)
          if (parsed.initialConfidence) setInitialConfidence(parsed.initialConfidence)

          // Phase itself was restored in the useState initialiser above; here we
          // only align the URL with it — and only for participant routes. /admin
          // is not part of the study flow, so a stale participant session in the
          // same browser must not bounce a researcher out of the dashboard.
          const path = PHASE_TO_PATH[parsed.phase]
          const onStudyRoute = PATH_TO_PHASE[location.pathname] !== undefined
          if (path && onStudyRoute && parsed.phase !== 'complete' && location.pathname !== path) {
            navigate(path, { replace: true })
          }
        }
      }
    } catch {}
    setHasRestored(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasRestored) return
    try {
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify({
        participantId, participantType, phase, condition, trialPlan,
        comprehensionPassed, isExcluded,
        isPractice, trialIndex, trialStep, initialEstimate, initialConfidence,
        savedAt: Date.now(),
      }))
    } catch {}
  }, [hasRestored, participantId, participantType, phase, condition, trialPlan,
      comprehensionPassed, isExcluded,
      isPractice, trialIndex, trialStep, initialEstimate, initialConfidence])

  // ── Telemetry ──────────────────────────────────────────────────────────────
  useEffect(() => {
    telemetry.recordEvent(EventType.SCREEN_VIEWED, { screen: phase })
  }, [phase])

  useEffect(() => {
    if ((phase === 'practice' || phase === 'scored') && trial && trialStep === 1) {
      setFetchedAdvice(null)
      setFetchedExplanation(null)
      setCurrentIsCorrect(null)
      setCurrentErrorDirection(null)
        const planItem = trialPlan?.find((t) => t.trialId === trial.id) || null
      telemetry.recordTrialStart({
        trialId: trial.id,
        scenarioType: trial.scenarioType || trial.type,
        isPractice,
        orderIndex: trialIndex + 1,
        scenario: trial,
        isCorrect: isPractice ? plannedPracticeCorrectness(trial) : planItem?.isCorrect ?? null,
        errorDirection: isPractice ? practiceErrorDirection(trial) : planItem?.errorDirection ?? null,
      })
    }
  }, [phase, isPractice, trialIndex, trialStep, trial]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────
  function resetStepData() {
    setInitialEstimate('')
    setInitialConfidence(null)
    setVerificationResponse(null)
    setFinalEstimate('')
    setFinalConfidence(null)
    setCognitiveLoad(null)
    setFetchedAdvice(null)
    setFetchedExplanation(null)
    setCurrentIsCorrect(null)
    setCurrentErrorDirection(null)
    setAdviceError(null)
  }

  /**
   * Requests the participant's cell and 12-trial plan from the server.
   *
   * There is deliberately no local fallback. A per-device counter cannot balance
   * anything across participants, so assigning locally would silently unbalance
   * the 2×4 design with no record that it happened. On failure the participant
   * waits and retries; the study never proceeds on a guessed assignment.
   */
  async function requestAssignment(groupType) {
    setIsAssigning(true)
    setAssignmentError(null)

    for (let attempt = 1; attempt <= ASSIGNMENT_MAX_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), ASSIGNMENT_TIMEOUT_MS)

        const response = await fetch('/api/assign-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantType: groupType,
            priorParticipantId: participantId,
            isThinkAloud,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          const assignedCond = data.condition || data.surveyMode
          if (CONDITIONS.includes(assignedCond) && Array.isArray(data.trialPlan)) {
            const canonicalId = telemetry.adoptServerParticipantId(data.participantId) || participantId
            setParticipantId(canonicalId)
            setCondition(assignedCond)
            setTrialPlan(data.trialPlan)
            telemetry.setSessionIdentity({ condition: assignedCond, participantType: groupType })
            setIsAssigning(false)
            return { condition: assignedCond, trialPlan: data.trialPlan }
          }
        }
      } catch {
        // fall through to retry
      }

      if (attempt < ASSIGNMENT_MAX_ATTEMPTS) {
        await sleep(Math.min(4000, 500 * 2 ** (attempt - 1)))
      }
    }

    setIsAssigning(false)
    setAssignmentError(
      'We could not reach the study server to set up your session. Please check your connection and try again.'
    )
    return null
  }

  // Practice correctness comes from the scenario definition (§5.8): practice is
  // where a wrong AI can be shown safely, because feedback follows.
  function plannedPracticeCorrectness(practiceTrial) {
    if (!practiceTrial || typeof practiceTrial.recommendation !== 'object') return true
    const { active, correct, optimal } = practiceTrial.recommendation
    const shown = active ?? correct
    return shown === (correct ?? optimal)
  }

  function practiceErrorDirection(practiceTrial) {
    if (plannedPracticeCorrectness(practiceTrial)) return 'na'
    const { active, correct, optimal } = practiceTrial.recommendation
    const truth = correct ?? optimal
    return (active ?? truth) > truth ? 'high' : 'low'
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Step 1: Consent submitted on '/' -> Advance to '/type' (condition not yet assigned)
  function handleConsentSubmit(demographics) {
    telemetry.recordConsent(demographics)
    setPhase('participant-type')
  }

  // Step 2: Expertise selected on '/type' -> Server assigns the cell.
  async function handleParticipantTypeSelect(selectedType) {
    setParticipantType(selectedType)
    if (selectedType === 'expert') {
      setComprehensionPassed(true) // Experts bypass the novice check
    }

    const assignment = await requestAssignment(selectedType)
    if (!assignment) return // stay on /type; the page surfaces the retry

    telemetry.recordParticipantType(selectedType, assignment.condition)
    setPhase(selectedType === 'novice' ? 'training' : 'walkthrough')
  }

  function retryAssignment() {
    return handleParticipantTypeSelect(participantType)
  }

  function handleTrainingComplete() {
    telemetry.recordEvent(EventType.TRAINING_COMPLETED, { participantType })
    setPhase('check')
  }

  function handleWalkthroughComplete() {
    telemetry.recordEvent(EventType.TRAINING_COMPLETED, { participantType })
    beginPractice()
  }

  // ── Comprehension Check Handlers (Protocol Appendix C.1) ───────────────────
  function handleComprehensionPass(results) {
    setComprehensionPassed(true)
    telemetry.recordEvent(EventType.COMPREHENSION_CHECK_PASSED, {
      attempt: results.attempt,
      score: results.score,
      total: results.total,
      threshold: results.threshold,
      answers: results.answers,
    })
    beginPractice()
  }

  function handleComprehensionFail(results) {
    telemetry.recordEvent(EventType.COMPREHENSION_CHECK_FAILED, {
      attempt: results.attempt,
      score: results.score,
      total: results.total,
      threshold: results.threshold,
      answers: results.answers,
    })
  }

  function handleComprehensionExclude(results) {
    setIsExcluded(true)
    telemetry.recordEvent(EventType.PARTICIPANT_EXCLUDED, {
      reason: 'COMPREHENSION_CHECK_FAILED_TWICE',
      attempt: 2,
      finalScore: results.score,
      total: results.total,
      threshold: results.threshold,
      answers: results.answers,
    })
    setPhase('excluded')
  }

  function beginPractice() {
    setIsPractice(true)
    setTrialIndex(0)
    setTrialStep(1)
    resetStepData()
    setStartedAt(Date.now())
    telemetry.recordEvent(EventType.PRACTICE_STARTED)
    setPhase('practice')
  }

  function beginScoredTrials() {
    setIsPractice(false)
    setTrialIndex(0)
    setTrialStep(1)
    resetStepData()
    setStartedAt(Date.now())
    telemetry.recordEvent(EventType.PRACTICE_COMPLETED)
    setPhase('scored')
  }

  async function submitInitialEstimate(e) {
    e?.preventDefault()
    const normalizedVal = normalizeNumericInput(initialEstimate)
    if (Number.isNaN(normalizedVal) || initialConfidence === null) return

    const dwellMs = Date.now() - startedAt
    // Telemetry must never block progression: a logging fault costs one event,
    // not the participant's session.
    try {
      telemetry.recordStep1InitialEstimate({
        trialId: trial.id, isPractice, initialEstimate: normalizedVal, initialConfidence, dwellMs,
      })
    } catch (err) {
      console.error('[telemetry] step 1 record failed', err)
    }
    setInitialEstimate(String(normalizedVal))
    setIsFetchingAdvice(true)
    setTrialStep(2)
    setStartedAt(Date.now())

    // Practice trials resolve in memory, honouring the scenario's own
    // correctness so the practice round can demonstrate a wrong AI (§5.8).
    if (isPractice) {
      const isCorr = plannedPracticeCorrectness(trial)
      const recAmount = typeof trial.recommendation === 'object'
        ? (isCorr
            ? (trial.recommendation.correct ?? trial.recommendation.optimal)
            : (trial.recommendation.incorrect ?? trial.recommendation.active))
        : trial.recommendation
      setFetchedAdvice(recAmount)
      setCurrentIsCorrect(isCorr)
      setCurrentErrorDirection(practiceErrorDirection(trial))
      setFetchedExplanation(lookupExplanation(trial, condition, isCorr))
      setIsFetchingAdvice(false)
      return
    }

    // Scored trials render from the server-issued plan the client already holds.
    //
    // There was previously a per-trial GET here that re-fetched exactly this
    // data: 12 extra round trips per participant, each a lambda invocation and a
    // Mongo query at peak load, adding ~1s of dead time to the critical path and
    // one more way for a trial to fail. The plan is issued and validated by the
    // server at assignment, so reading it from cache is not a fallback — it is
    // the same authority, just without the round trip. Correctness and ground
    // truth are resolved server-side at write time (see the D-4 change), so the
    // browser never needs them.
    const planItem = trialPlan?.find((t) => t.trialId === trial.id) || null
    if (!planItem) {
      setAdviceError('We could not load this decision. Please check your connection and retry.')
      setIsFetchingAdvice(false)
      return
    }

    setFetchedAdvice(planItem.recommendation)
    setFetchedExplanation(planItem.explanation ?? null)
    setIsFetchingAdvice(false)
  }

  function retryAdvice() {
    setAdviceError(null)
    setTrialStep(1)
  }

  function acknowledgeAI() {
    const dwellMs = Date.now() - startedAt
    try {
      telemetry.recordStep2AIReveal({
        trialId: trial.id, isPractice, condition, explanationViewed: condition !== 'c0', dwellMs,
      })
    } catch (err) {
      console.error('[telemetry] step 2 record failed', err)
    }
    setTrialStep(3)
    setStartedAt(Date.now())
  }

  function submitVerification() {
    if (!verificationResponse) return
    const dwellMs = Date.now() - startedAt
    try {
      telemetry.recordStep3Verification({ trialId: trial.id, isPractice, verificationResponse, dwellMs })
    } catch (err) {
      console.error('[telemetry] step 3 record failed', err)
    }
    setTrialStep(4)
    setStartedAt(Date.now())
  }

  function submitFinalEstimate(e) {
    e?.preventDefault()
    const normalizedVal = normalizeNumericInput(finalEstimate)
    if (Number.isNaN(normalizedVal) || !finalConfidence || !cognitiveLoad) return

    const step4DwellMs = Date.now() - startedAt
    try {
      telemetry.recordStep4FinalEstimate({
        trialId: trial.id,
        scenario: trial,
        isPractice,
        aiRecommendation: fetchedAdvice,
        isCorrect: currentIsCorrect,
        errorDirection: currentErrorDirection,
        groundTruthOptimal: trial.groundTruthOptimal ?? (trial.recommendation?.correct ?? trial.recommendation?.optimal),
        initialEstimate: normalizeNumericInput(initialEstimate),
        finalEstimate: normalizedVal,
        finalConfidence,
        cognitiveLoad,
        verificationResponse,
        dwellMs: step4DwellMs,
      })
    } catch (err) {
      console.error('[telemetry] step 4 record failed', err)
    }
    setFinalEstimate(String(normalizedVal))

    if (isPractice) {
      setPhase('practice-feedback')
    } else {
      advanceScoredTrial()
    }
  }

  function advanceScoredTrial() {
    if (isLastTrial) {
      // Autosave is NOT cleared here — the post-task battery still has to be
      // completed, and losing it would discard a finished 12-trial block.
      setPhase('post-task')
    } else {
      setTrialIndex((i) => i + 1)
      setTrialStep(1)
      resetStepData()
      setStartedAt(Date.now())
    }
  }

  function handleNextPracticeTrial() {
    if (isLastTrial) {
      telemetry.recordEvent(EventType.ATTENTION_CHECK_PASSED, { round: 'practice', passed: true })
      beginScoredTrials()
    } else {
      setTrialIndex((i) => i + 1)
      setTrialStep(1)
      resetStepData()
      setStartedAt(Date.now())
      setPhase('practice')
    }
  }

  function handleAttentionCheckFail(selectedResponse) {
    setIsExcluded(true)
    telemetry.recordEvent(EventType.ATTENTION_CHECK_FAILED, {
      round: 'practice',
      reason: 'ATTENTION_CHECK_FAILED',
      selectedResponse,
    })
    telemetry.recordEvent(EventType.PARTICIPANT_EXCLUDED, {
      reason: 'ATTENTION_CHECK_FAILED',
      round: 'practice',
      selectedResponse,
    })
    setPhase('excluded')
  }

  function handlePostTaskComplete(responses) {
    telemetry.recordQuestionnaire('POST_TASK', responses)
    // The battery is in; the session can no longer be resumed mid-trial.
    try { localStorage.removeItem(AUTOSAVE_STORAGE_KEY) } catch {}
    setPhase('debrief')
  }

  function handleDebriefComplete() {
    try {
      telemetry.recordDebriefViewed()
      telemetry.recordSessionComplete()
    } catch (err) {
      console.error('[telemetry] session completion failed', err)
    }
    setPhase('complete')
  }

  function restartSession() {
    try {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY)
    } catch {}
    setIsExcluded(false)
    setComprehensionPassed(false)
    setPhaseState('consent')
    navigate('/', { replace: true })
  }

  const value = {
    participantId, participantType, condition, trialPlan,
    comprehensionPassed, isExcluded,
    isThinkAloud, isPreviewOverride,
    surveyMode: condition,
    phase, setPhase,
    isAssigning, assignmentError, retryAssignment,
    adviceError, retryAdvice,
    isPractice, trialIndex, trialStep,
    trial, type, totalTrials, trialNumber, isLastTrial, progress,
    explanation, fetchedAdvice, isFetchingAdvice,
    currentIsCorrect, currentErrorDirection,
    initialEstimate, setInitialEstimate,
    initialConfidence, setInitialConfidence,
    verificationResponse, setVerificationResponse,
    finalEstimate, setFinalEstimate,
    finalConfidence, setFinalConfidence,
    cognitiveLoad, setCognitiveLoad,
    handleConsentSubmit,
    handleParticipantTypeSelect,
    handleTrainingComplete,
    handleWalkthroughComplete,
    handleComprehensionPass,
    handleComprehensionFail,
    handleComprehensionExclude,
    handleAttentionCheckFail,
    submitInitialEstimate,
    acknowledgeAI,
    submitVerification,
    submitFinalEstimate,
    handleNextPracticeTrial,
    handlePostTaskComplete,
    handleDebriefComplete,
    restartSession,
  }

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}
