import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { trials, practiceTrials, studyTypes } from '../studyData.js'
import telemetry, { EventType } from '../telemetry.js'
import CONFIG from '../config/index.js'
import { normalizeNumericInput } from '../services/validationService.js'

// ── Storage Keys ──────────────────────────────────────────────────────────────
const AUTOSAVE_STORAGE_KEY = 'study-session-autosave-v1'
const MAX_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000 // 24-hour single-session resume window

// ── Survey Mode (T / N / C) ───────────────────────────────────────────────────
const SURVEY_MODES = ['T', 'N', 'C']
const MODE_COUNTER_KEY = 'study-mode-counter-v1' // local fallback counter

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

function assignModeFallback() {
  try {
    const raw = localStorage.getItem(MODE_COUNTER_KEY)
    const counts = raw ? JSON.parse(raw) : { T: 0, N: 0, C: 0 }
    const minCount = Math.min(...SURVEY_MODES.map((m) => counts[m] ?? 0))
    const tied = SURVEY_MODES.filter((m) => (counts[m] ?? 0) === minCount)
    const chosen = tied[Math.floor(Math.random() * tied.length)]
    counts[chosen] = (counts[chosen] ?? 0) + 1
    localStorage.setItem(MODE_COUNTER_KEY, JSON.stringify(counts))
    return chosen
  } catch {
    return SURVEY_MODES[Math.floor(Math.random() * SURVEY_MODES.length)]
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
  const [surveyMode, setSurveyMode] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.surveyMode) return parsed.surveyMode
      }
    } catch {}
    return 'T' // default fallback mode for direct page preview
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

  // ── Experimental condition ─────────────────────────────────────────────────
  const [condition] = useState(() => {
    const options = CONFIG.CONDITIONS
    return options[Math.floor(Math.random() * options.length)]
  })

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
          if (parsed.surveyMode) setSurveyMode(parsed.surveyMode)
          if (typeof parsed.isPractice === 'boolean') setIsPractice(parsed.isPractice)
          if (typeof parsed.trialIndex === 'number') setTrialIndex(parsed.trialIndex)
          if (typeof parsed.trialStep === 'number') setTrialStep(parsed.trialStep)
          if (parsed.initialEstimate) setInitialEstimate(parsed.initialEstimate)
          if (parsed.initialConfidence) setInitialConfidence(parsed.initialConfidence)

          // Only resume path if participant is visiting the root page '/'
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
        participantId, participantType, phase, condition, surveyMode,
        isPractice, trialIndex, trialStep, initialEstimate, initialConfidence,
        savedAt: Date.now(),
      }))
    } catch {}
  }, [participantId, participantType, phase, condition, surveyMode,
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

  async function fetchSurveyMode(pid) {
    try {
      const response = await fetch('/api/assign-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: pid }),
      })
      if (response.ok) {
        const data = await response.json()
        if (SURVEY_MODES.includes(data.surveyMode)) {
          setSurveyMode(data.surveyMode)
          return data.surveyMode
        }
      }
    } catch {}
    const fallback = assignModeFallback()
    setSurveyMode(fallback)
    return fallback
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleConsentSubmit(demographics) {
    telemetry.recordConsent(demographics)
    await fetchSurveyMode(participantId)
    setPhase('participant-type')
  }

  function handleParticipantTypeSelect(selectedType) {
    setParticipantType(selectedType)
    telemetry.recordParticipantType(selectedType, condition)
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
    participantId, participantType, surveyMode, condition,
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
