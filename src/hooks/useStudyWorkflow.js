import { useState, useMemo, useEffect } from 'react'
import { trials, practiceTrials, studyTypes } from '../studyData.js'
import telemetry, { EventType } from '../telemetry.js'
import CONFIG from '../config/index.js'
import { normalizeNumericInput } from '../services/validationService.js'

const AUTOSAVE_STORAGE_KEY = 'study-session-autosave-v1'
const MAX_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000 // 24-hour single-session resume window

/**
 * Custom hook encapsulating the study state machine, workflow progression,
 * secure fetch-on-demand AI advice resolution, and session guardrails.
 */
export function useStudyWorkflow() {
  const [participantId] = useState(() => telemetry.sessionMetadata.participantId || telemetry._loadOrInitSession().participantId)
  const [participantType, setParticipantType] = useState(null)
  const [phase, setPhase] = useState('consent')

  // Experimental condition — assigned once
  const [condition] = useState(() => {
    const options = CONFIG.CONDITIONS
    return options[Math.floor(Math.random() * options.length)]
  })

  // Trial tracking
  const [isPractice, setIsPractice] = useState(true)
  const [trialIndex, setTrialIndex] = useState(0)
  const [trialStep, setTrialStep] = useState(1)

  // Step data collection — NEVER pre-filled (no default values, no initial anchors)
  const [initialEstimate, setInitialEstimate] = useState('')
  const [initialConfidence, setInitialConfidence] = useState(null)
  const [verificationResponse, setVerificationResponse] = useState(null)
  const [finalEstimate, setFinalEstimate] = useState('')
  const [finalConfidence, setFinalConfidence] = useState(null)
  const [cognitiveLoad, setCognitiveLoad] = useState(null)

  // SECURE ANCHORING FIX: AI advice is fetched ONLY after Stage 1 submission
  const [fetchedAdvice, setFetchedAdvice] = useState(null)
  const [fetchedExplanation, setFetchedExplanation] = useState(null)
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false)

  const [startedAt, setStartedAt] = useState(Date.now())

  // Derived values
  const currentTrials = isPractice ? practiceTrials : trials
  const trial = currentTrials[trialIndex] ?? null
  const type = trial ? (studyTypes[trial.scenarioType || trial.type] || trial) : null
  const totalTrials = currentTrials.length
  const trialNumber = trialIndex + 1
  const isLastTrial = trialIndex === totalTrials - 1
  const progress = Math.round((trialIndex / totalTrials) * 100)

  // Derived explanation fallback
  const explanation = useMemo(() => {
    if (fetchedExplanation !== null) return fetchedExplanation
    if (!trial || condition === 'c0') return null
    if (trial.explanations) return trial.explanations[condition] ?? null
    return trial[condition] ?? null
  }, [condition, trial, fetchedExplanation])

  // ── AUTOSAVE & SINGLE-SITTING RESUME RECOVERY ──────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const elapsed = Date.now() - (parsed.savedAt || 0)
        // Allow same-day resume window (under 24 hours); discard expired sessions
        if (elapsed < MAX_RESUME_WINDOW_MS && parsed.participantId === participantId) {
          if (parsed.participantType) setParticipantType(parsed.participantType)
          if (parsed.phase && parsed.phase !== 'complete') setPhase(parsed.phase)
          if (typeof parsed.isPractice === 'boolean') setIsPractice(parsed.isPractice)
          if (typeof parsed.trialIndex === 'number') setTrialIndex(parsed.trialIndex)
          if (typeof parsed.trialStep === 'number') setTrialStep(parsed.trialStep)
          if (parsed.initialEstimate) setInitialEstimate(parsed.initialEstimate)
          if (parsed.initialConfidence) setInitialConfidence(parsed.initialConfidence)
        }
      }
    } catch (e) {
      // Storage error fallback
    }
  }, [participantId])

  useEffect(() => {
    try {
      const autosaveData = {
        participantId,
        participantType,
        phase,
        condition,
        isPractice,
        trialIndex,
        trialStep,
        initialEstimate,
        initialConfidence,
        savedAt: Date.now(),
      }
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(autosaveData))
    } catch (e) {
      // Storage save fallback
    }
  }, [participantId, participantType, phase, condition, isPractice, trialIndex, trialStep, initialEstimate, initialConfidence])

  // ── BEFOREUNLOAD EXIT WARNING ─────────────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (phase === 'practice' || phase === 'scored') {
        const message = 'You have an active decision study session. If you leave, your progress may be reset.'
        e.preventDefault()
        e.returnValue = message
        return message
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  // ── HARD BACK-NAVIGATION LOCK ─────────────────────────────────────────────
  // Disables browser back/forward buttons during active trial stages to prevent WOA contamination
  useEffect(() => {
    if (phase === 'practice' || phase === 'scored') {
      window.history.pushState(null, '', window.location.href)
      function handlePopState(e) {
        window.history.pushState(null, '', window.location.href)
      }
      window.addEventListener('popstate', handlePopState)
      return () => window.removeEventListener('popstate', handlePopState)
    }
  }, [phase, trialIndex, trialStep])

  // ── TELEMETRY & SCREEN TRACKING ───────────────────────────────────────────
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

  // ── HANDLERS ──────────────────────────────────────────────────────────────
  function handleConsentSubmit(demographics) {
    telemetry.recordConsent(demographics)
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

  // ── STEP 1: INDEPENDENT ESTIMATE SUBMISSION & ADVICE FETCHING ─────────────
  async function submitInitialEstimate(e) {
    e?.preventDefault()

    // Accept typed numbers loosely (commas, dollar signs, decimals)
    const normalizedVal = normalizeNumericInput(initialEstimate)
    if (Number.isNaN(normalizedVal) || initialConfidence === null) return

    const dwellMs = Date.now() - startedAt

    // Log independent estimate telemetry BEFORE AI advice is fetched
    telemetry.recordStep1InitialEstimate({
      trialId: trial.id,
      isPractice,
      initialEstimate: normalizedVal,
      initialConfidence,
      dwellMs,
    })

    // Update state to normalized string value
    setInitialEstimate(String(normalizedVal))

    // SECURE ANCHORING FIX: Fetch AI advice from server ONLY after Stage 1 submission
    setIsFetchingAdvice(true)
    setTrialStep(2)
    setStartedAt(Date.now())

    try {
      const response = await fetch(`/api/telemetry?trialId=${encodeURIComponent(trial.id)}&condition=${encodeURIComponent(condition)}`)
      if (response.ok) {
        const data = await response.json()
        setFetchedAdvice(data.recommendation)
        setFetchedExplanation(data.explanation)
      } else {
        // Fallback to client object if offline/standalone
        const fallback = typeof trial.recommendation === 'object' ? (trial.recommendation.active ?? trial.recommendation.correct) : trial.recommendation
        setFetchedAdvice(fallback)
      }
    } catch {
      const fallback = typeof trial.recommendation === 'object' ? (trial.recommendation.active ?? trial.recommendation.correct) : trial.recommendation
      setFetchedAdvice(fallback)
    } finally {
      setIsFetchingAdvice(false)
    }
  }

  // ── STEP 2: AI REVEAL ACKNOWLEDGMENT ─────────────────────────────────────
  function acknowledgeAI() {
    const dwellMs = Date.now() - startedAt
    telemetry.recordStep2AIReveal({
      trialId: trial.id,
      isPractice,
      condition,
      explanationViewed: condition !== 'c0',
      dwellMs,
    })

    setTrialStep(3)
    setStartedAt(Date.now())
  }

  // ── STEP 3: VERIFICATION CHECK ───────────────────────────────────────────
  function submitVerification() {
    if (!verificationResponse) return

    const dwellMs = Date.now() - startedAt
    telemetry.recordStep3Verification({
      trialId: trial.id,
      isPractice,
      verificationResponse,
      dwellMs,
    })

    setTrialStep(4)
    setStartedAt(Date.now())
  }

  // ── STEP 4: FINAL ESTIMATE & RATING SUBMISSION ───────────────────────────
  function submitFinalEstimate(e) {
    e?.preventDefault()

    const normalizedVal = normalizeNumericInput(finalEstimate)
    if (Number.isNaN(normalizedVal) || !finalConfidence || !cognitiveLoad) return

    const step4DwellMs = Date.now() - startedAt
    telemetry.recordStep4FinalEstimate({
      trialId: trial.id,
      scenario: trial,
      isPractice,
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
      try {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY)
      } catch (e) {}
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

  return {
    // State
    participantId,
    participantType,
    phase,
    condition,
    isPractice,
    trialIndex,
    trialStep,
    trial,
    type,
    totalTrials,
    trialNumber,
    isLastTrial,
    progress,
    explanation,
    fetchedAdvice,
    isFetchingAdvice,
    // Step state
    initialEstimate, setInitialEstimate,
    initialConfidence, setInitialConfidence,
    verificationResponse, setVerificationResponse,
    finalEstimate, setFinalEstimate,
    finalConfidence, setFinalConfidence,
    cognitiveLoad, setCognitiveLoad,
    // Handlers
    setPhase,
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
}

