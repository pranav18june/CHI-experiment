import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { trials, practiceTrials, studyTypes } from '../studyData.js'
import telemetry, { EventType } from '../telemetry.js'
import CONFIG from '../config/index.js'
import { normalizeNumericInput } from '../services/validationService.js'
import { generateParticipantTrialPlan } from '../utils/counterbalance.js'
import { getScenarioById, getExplanation as lookupExplanation } from '../scenarios/index.js'

// ── Storage Keys ──────────────────────────────────────────────────────────────
const AUTOSAVE_STORAGE_KEY = 'study-session-autosave-v1'
const MAX_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000 // 24-hour single-session resume window

// ── 2×4 Factorial Design Constants ───────────────────────────────────────────
export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']
export const PARTICIPANT_TYPES = ['novice', 'expert']
const CONDITION_COUNTER_KEY = 'study-condition-counter-v2' // local 2x4 offline counter

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

const SCHEDULE_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']

/**
 * Client-side offline fallback balancer across all 4 conditions (c0–c3)
 * and 8 Latin-square correctness schedules (s0–s7) independently within
 * each expertise group (novice vs. expert) via min-count selection.
 */
function assignConditionFallback(participantType = 'novice') {
  const group = participantType === 'expert' ? 'expert' : 'novice'
  try {
    const raw = localStorage.getItem(CONDITION_COUNTER_KEY)
    const counts = raw ? JSON.parse(raw) : {
      novice: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
      expert: { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
    }
    if (!counts[group]) {
      counts[group] = { c0: 0, c1: 0, c2: 0, c3: 0, s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }
    }
    const groupCounts = counts[group]

    // Condition min-count
    const minCondCount = Math.min(...CONDITIONS.map((c) => groupCounts[c] ?? 0))
    const tiedConds = CONDITIONS.filter((c) => (groupCounts[c] ?? 0) === minCondCount)
    const chosenCond = tiedConds[Math.floor(Math.random() * tiedConds.length)]
    counts[group][chosenCond] = (groupCounts[chosenCond] ?? 0) + 1

    // Schedule min-count
    const minSchedCount = Math.min(...SCHEDULE_KEYS.map((s) => groupCounts[s] ?? 0))
    const tiedScheds = SCHEDULE_KEYS.filter((s) => (groupCounts[s] ?? 0) === minSchedCount)
    const chosenSchedKey = tiedScheds[Math.floor(Math.random() * tiedScheds.length)]
    const scheduleIndex = parseInt(chosenSchedKey.replace('s', ''), 10)
    counts[group][chosenSchedKey] = (groupCounts[chosenSchedKey] ?? 0) + 1

    localStorage.setItem(CONDITION_COUNTER_KEY, JSON.stringify(counts))
    return { condition: chosenCond, scheduleIndex }
  } catch {
    return {
      condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
      scheduleIndex: Math.floor(Math.random() * 8),
    }
  }
}

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
  const [participantId] = useState(() =>
    telemetry.sessionMetadata.participantId || telemetry._loadOrInitSession().participantId
  )
  const [participantType, setParticipantType] = useState('novice')

  // ── Novice Comprehension Check & Exclusion State (Appendix C.1) ─────────────
  const [comprehensionPassed, setComprehensionPassed] = useState(false)
  const [isExcluded, setIsExcluded] = useState(false)

  // ── Condition (c0 / c1 / c2 / c3) — assigned at participant-type stage ────
  const [condition, setCondition] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.condition && CONDITIONS.includes(parsed.condition)) {
          return parsed.condition
        }
      }
    } catch {}
    return 'c0' // default fallback for direct route preview
  })

  // ── Pre-assigned Counterbalanced 12-Trial Plan ─────────────────────────────
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
    return generateParticipantTrialPlan(0, getScenarioById)
  })

  // ── Phase derived directly from current URL path ────────────────────────────
  const currentPathPhase = PATH_TO_PHASE[location.pathname] || 'consent'
  const [phase, setPhaseState] = useState(currentPathPhase)

  // Sync phase with URL when URL changes & enforce comprehension gating
  useEffect(() => {
    const matched = PATH_TO_PHASE[location.pathname]

    // Gating 1: If excluded, lock to /excluded
    if (isExcluded) {
      if (location.pathname !== '/excluded') {
        navigate('/excluded', { replace: true })
      }
      return
    }

    // Gating 2: If novice has not passed comprehension check, block /practice and /scored
    if (participantType === 'novice' && !comprehensionPassed && (location.pathname === '/practice' || location.pathname === '/scored')) {
      navigate('/check', { replace: true })
      setPhaseState('check')
      return
    }

    if (matched && matched !== phase) {
      setPhaseState(matched)
      if (matched === 'scored') {
        setIsPractice(false)
      } else if (matched === 'practice') {
        setIsPractice(true)
      }
    }
  }, [location.pathname, isExcluded, comprehensionPassed, participantType, phase, navigate])

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
  const [isPractice, setIsPractice] = useState(() => location.pathname !== '/scored')
  const [trialIndex, setTrialIndex] = useState(0)
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
  const currentTrials = isPractice ? practiceTrials : trials
  const trial = currentTrials[trialIndex] ?? currentTrials[0] ?? null
  const type = trial ? (studyTypes[trial.scenarioType || trial.type] || trial) : null
  const totalTrials = currentTrials.length
  const trialNumber = trialIndex + 1
  const isLastTrial = trialIndex === totalTrials - 1
  const progress = Math.round((trialIndex / totalTrials) * 100)

  const explanation = useMemo(() => {
    if (fetchedExplanation !== null) return fetchedExplanation
    if (!trial || condition === 'c0') return null
    return lookupExplanation(trial, condition, currentIsCorrect ?? false)
  }, [condition, trial, fetchedExplanation, currentIsCorrect])

  // ── Autosave recovery (only restores if on root '/' and active session exists) ─
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const elapsed = Date.now() - (parsed.savedAt || 0)
        if (elapsed < MAX_RESUME_WINDOW_MS && parsed.participantId === participantId) {
          if (parsed.participantType) setParticipantType(parsed.participantType)
          if (parsed.condition && CONDITIONS.includes(parsed.condition)) setCondition(parsed.condition)
          if (parsed.trialPlan) setTrialPlan(parsed.trialPlan)
          if (typeof parsed.comprehensionPassed === 'boolean') setComprehensionPassed(parsed.comprehensionPassed)
          if (typeof parsed.isExcluded === 'boolean') setIsExcluded(parsed.isExcluded)
          if (typeof parsed.isPractice === 'boolean') setIsPractice(parsed.isPractice)
          if (typeof parsed.trialIndex === 'number') setTrialIndex(parsed.trialIndex)
          if (typeof parsed.trialStep === 'number') setTrialStep(parsed.trialStep)
          if (parsed.initialEstimate) setInitialEstimate(parsed.initialEstimate)
          if (parsed.initialConfidence) setInitialConfidence(parsed.initialConfidence)

          if (location.pathname === '/' && parsed.phase && parsed.phase !== 'consent' && parsed.phase !== 'complete') {
            setPhaseState(parsed.phase)
            const path = PHASE_TO_PATH[parsed.phase]
            if (path) navigate(path, { replace: true })
          }
        }
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify({
        participantId, participantType, phase, condition, trialPlan,
        comprehensionPassed, isExcluded,
        isPractice, trialIndex, trialStep, initialEstimate, initialConfidence,
        savedAt: Date.now(),
      }))
    } catch {}
  }, [participantId, participantType, phase, condition, trialPlan,
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
      telemetry.recordTrialStart({
        trialId: trial.id,
        scenarioType: trial.scenarioType || trial.type,
        isPractice,
        orderIndex: trialIndex + 1,
        scenario: trial,
      })
    }
  }, [phase, isPractice, trialIndex, trialStep, trial])

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
  }

  /**
   * Fetches condition assignment and 12-trial plan balanced within the participant's own expertise group.
   */
  async function fetchConditionForGroup(pid, groupType) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)

      const response = await fetch('/api/assign-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: pid, participantType: groupType }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const assignedCond = data.condition || data.surveyMode
        if (CONDITIONS.includes(assignedCond)) {
          setCondition(assignedCond)
          if (data.trialPlan && Array.isArray(data.trialPlan)) {
            setTrialPlan(data.trialPlan)
          }
          telemetry.setSessionIdentity({ condition: assignedCond, participantType: groupType })
          return assignedCond
        }
      }
    } catch {}
    const fallback = assignConditionFallback(groupType)
    setCondition(fallback.condition)
    const localPlan = generateParticipantTrialPlan(fallback.scheduleIndex, getScenarioById)
    setTrialPlan(localPlan)
    telemetry.setSessionIdentity({ condition: fallback.condition, participantType: groupType })
    return fallback.condition
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  // Step 1: Consent submitted on '/' -> Advance to '/type' (condition not yet assigned)
  function handleConsentSubmit(demographics) {
    telemetry.recordConsent(demographics)
    setPhase('participant-type')
  }

  // Step 2: Expertise selected on '/type' -> Assign condition balanced WITHIN group
  async function handleParticipantTypeSelect(selectedType) {
    setParticipantType(selectedType)
    if (selectedType === 'expert') {
      setComprehensionPassed(true) // Experts bypass novice check
    }
    // 2x4 balancing & counterbalanced trial plan assignment
    const assignedCondition = await fetchConditionForGroup(participantId, selectedType)
    telemetry.recordParticipantType(selectedType, assignedCondition)
    setPhase(selectedType === 'novice' ? 'training' : 'walkthrough')
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
      total: 4,
      answers: results.answers,
    })
    beginPractice()
  }

  function handleComprehensionFail(results) {
    telemetry.recordEvent(EventType.COMPREHENSION_CHECK_FAILED, {
      attempt: results.attempt,
      score: results.score,
      total: 4,
      answers: results.answers,
    })
  }

  function handleComprehensionExclude(results) {
    setIsExcluded(true)
    telemetry.recordEvent(EventType.PARTICIPANT_EXCLUDED, {
      reason: 'COMPREHENSION_CHECK_FAILED_TWICE',
      attempt: 2,
      finalScore: results.score,
      total: 4,
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
    telemetry.recordStep1InitialEstimate({
      trialId: trial.id, isPractice, initialEstimate: normalizedVal, initialConfidence, dwellMs,
    })
    setInitialEstimate(String(normalizedVal))
    setIsFetchingAdvice(true)
    setTrialStep(2)
    setStartedAt(Date.now())

    // Practice trials resolve instantly in memory (0ms network delay)
    if (isPractice) {
      const recAmount = typeof trial.recommendation === 'object'
        ? (trial.recommendation.correct ?? trial.recommendation.optimal)
        : trial.recommendation
      setFetchedAdvice(recAmount)
      setCurrentIsCorrect(true)
      setCurrentErrorDirection('na')
      setFetchedExplanation(lookupExplanation(trial, condition, true))
      setIsFetchingAdvice(false)
      return
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1500)

      const response = await fetch(
        `/api/telemetry?trialId=${encodeURIComponent(trial.id)}&condition=${encodeURIComponent(condition)}&participantId=${encodeURIComponent(participantId)}`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setFetchedAdvice(data.recommendation)
        setFetchedExplanation(data.explanation)
        setCurrentIsCorrect(data.isCorrect)
        setCurrentErrorDirection(data.errorDirection)
      } else {
        throw new Error('API non-200')
      }
    } catch {
      const planItem = !isPractice && trialPlan ? trialPlan.find((t) => t.trialId === trial.id) : null
      const isCorr = isPractice ? true : (planItem ? planItem.isCorrect : false)
      const errDir = isPractice ? 'na' : (planItem ? planItem.errorDirection : 'high')
      const fallback = isCorr
        ? (trial.recommendation.correct ?? trial.recommendation.optimal)
        : (trial.recommendation.incorrect ?? trial.recommendation.active)
      setFetchedAdvice(fallback)
      setCurrentIsCorrect(isCorr)
      setCurrentErrorDirection(errDir)
      setFetchedExplanation(lookupExplanation(trial, condition, isCorr))
    } finally {
      setIsFetchingAdvice(false)
    }
  }

  function acknowledgeAI() {
    const dwellMs = Date.now() - startedAt
    telemetry.recordStep2AIReveal({
      trialId: trial.id, isPractice, condition, explanationViewed: condition !== 'c0', dwellMs,
    })
    setTrialStep(3)
    setStartedAt(Date.now())
  }

  function submitVerification() {
    if (!verificationResponse) return
    const dwellMs = Date.now() - startedAt
    telemetry.recordStep3Verification({ trialId: trial.id, isPractice, verificationResponse, dwellMs })
    setTrialStep(4)
    setStartedAt(Date.now())
  }

  function submitFinalEstimate(e) {
    e?.preventDefault()
    const normalizedVal = normalizeNumericInput(finalEstimate)
    if (Number.isNaN(normalizedVal) || !finalConfidence || !cognitiveLoad) return

    const step4DwellMs = Date.now() - startedAt
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
    setFinalEstimate(String(normalizedVal))

    if (isPractice) {
      setPhase('practice-feedback')
    } else {
      advanceScoredTrial()
    }
  }

  function advanceScoredTrial() {
    if (isLastTrial) {
      try { localStorage.removeItem(AUTOSAVE_STORAGE_KEY) } catch {}
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
    setPhase('debrief')
  }

  function resetExclusionAndProceed() {
    setIsExcluded(false)
    setComprehensionPassed(true)
    beginPractice()
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
    surveyMode: condition,
    phase, setPhase,
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
    resetExclusionAndProceed,
    restartSession,
  }

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}
