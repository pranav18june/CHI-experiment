import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { trials, practiceTrials, studyTypes } from '../studyData.js'
import telemetry, { EventType } from '../telemetry.js'
import CONFIG from '../config/index.js'
import { normalizeNumericInput } from '../services/validationService.js'

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
}

/**
 * Client-side offline fallback balancer across all 4 conditions (c0–c3)
 * independently within each expertise group (novice vs. expert).
 */
function assignConditionFallback(participantType = 'novice') {
  const group = participantType === 'expert' ? 'expert' : 'novice'
  try {
    const raw = localStorage.getItem(CONDITION_COUNTER_KEY)
    const counts = raw ? JSON.parse(raw) : {
      novice: { c0: 0, c1: 0, c2: 0, c3: 0 },
      expert: { c0: 0, c1: 0, c2: 0, c3: 0 },
    }
    if (!counts[group]) counts[group] = { c0: 0, c1: 0, c2: 0, c3: 0 }
    const groupCounts = counts[group]
    const minCount = Math.min(...CONDITIONS.map((c) => groupCounts[c] ?? 0))
    const tied = CONDITIONS.filter((c) => (groupCounts[c] ?? 0) === minCount)
    const chosen = tied[Math.floor(Math.random() * tied.length)]
    counts[group][chosen] = (groupCounts[chosen] ?? 0) + 1
    localStorage.setItem(CONDITION_COUNTER_KEY, JSON.stringify(counts))
    return chosen
  } catch {
    return CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)]
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

  // ── Phase derived directly from current URL path ────────────────────────────
  const currentPathPhase = PATH_TO_PHASE[location.pathname] || 'consent'
  const [phase, setPhaseState] = useState(currentPathPhase)

  // Sync phase with URL when URL changes
  useEffect(() => {
    const matched = PATH_TO_PHASE[location.pathname]
    if (matched && matched !== phase) {
      setPhaseState(matched)
      if (matched === 'scored') {
        setIsPractice(false)
      } else if (matched === 'practice') {
        setIsPractice(true)
      }
    }
  }, [location.pathname])

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

  // ── Step data ──────────────────────────────────────────────────────────────
  const [initialEstimate, setInitialEstimate] = useState('')
  const [initialConfidence, setInitialConfidence] = useState(null)
  const [verificationResponse, setVerificationResponse] = useState(null)
  const [finalEstimate, setFinalEstimate] = useState('')
  const [finalConfidence, setFinalConfidence] = useState(null)
  const [cognitiveLoad, setCognitiveLoad] = useState(null)

  const [fetchedAdvice, setFetchedAdvice] = useState(null)
  const [fetchedExplanation, setFetchedExplanation] = useState(null)
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
    if (trial.explanations) return trial.explanations[condition] ?? null
    return trial[condition] ?? null
  }, [condition, trial, fetchedExplanation])

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
        participantId, participantType, phase, condition,
        isPractice, trialIndex, trialStep, initialEstimate, initialConfidence,
        savedAt: Date.now(),
      }))
    } catch {}
  }, [participantId, participantType, phase, condition,
      isPractice, trialIndex, trialStep, initialEstimate, initialConfidence])

  // ── Telemetry ──────────────────────────────────────────────────────────────
  useEffect(() => {
    telemetry.recordEvent(EventType.SCREEN_VIEWED, { screen: phase })
  }, [phase])

  useEffect(() => {
    if ((phase === 'practice' || phase === 'scored') && trial && trialStep === 1) {
      setFetchedAdvice(null)
      setFetchedExplanation(null)
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
  }

  /**
   * Fetches condition assignment balanced within the participant's own expertise group.
   */
  async function fetchConditionForGroup(pid, groupType) {
    try {
      const response = await fetch('/api/assign-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: pid, participantType: groupType }),
      })
      if (response.ok) {
        const data = await response.json()
        const assignedCond = data.condition || data.surveyMode
        if (CONDITIONS.includes(assignedCond)) {
          setCondition(assignedCond)
          telemetry.setSessionIdentity({ condition: assignedCond, participantType: groupType })
          return assignedCond
        }
      }
    } catch {}
    const fallback = assignConditionFallback(groupType)
    setCondition(fallback)
    telemetry.setSessionIdentity({ condition: fallback, participantType: groupType })
    return fallback
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
    // 2x4 balancing: assign condition within Novice vs Expert group
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

  function handleCheckComplete() {
    beginPractice()
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

    try {
      const response = await fetch(
        `/api/telemetry?trialId=${encodeURIComponent(trial.id)}&condition=${encodeURIComponent(condition)}`
      )
      if (response.ok) {
        const data = await response.json()
        setFetchedAdvice(data.recommendation)
        setFetchedExplanation(data.explanation)
      } else {
        const fallback = typeof trial.recommendation === 'object'
          ? (trial.recommendation.active ?? trial.recommendation.correct)
          : trial.recommendation
        setFetchedAdvice(fallback)
      }
    } catch {
      const fallback = typeof trial.recommendation === 'object'
        ? (trial.recommendation.active ?? trial.recommendation.correct)
        : trial.recommendation
      setFetchedAdvice(fallback)
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
      trialId: trial.id, scenario: trial, isPractice,
      initialEstimate: normalizeNumericInput(initialEstimate),
      finalEstimate: normalizedVal, finalConfidence, cognitiveLoad, verificationResponse,
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
      beginScoredTrials()
    } else {
      setTrialIndex((i) => i + 1)
      setTrialStep(1)
      resetStepData()
      setStartedAt(Date.now())
      setPhase('practice')
    }
  }

  function handlePostTaskComplete(responses) {
    telemetry.recordQuestionnaire('POST_TASK', responses)
    setPhase('debrief')
  }

  const value = {
    participantId, participantType, condition,
    surveyMode: condition,
    phase, setPhase,
    isPractice, trialIndex, trialStep,
    trial, type, totalTrials, trialNumber, isLastTrial, progress,
    explanation, fetchedAdvice, isFetchingAdvice,
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
    handleCheckComplete,
    submitInitialEstimate,
    acknowledgeAI,
    submitVerification,
    submitFinalEstimate,
    handleNextPracticeTrial,
    handlePostTaskComplete,
  }

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}
