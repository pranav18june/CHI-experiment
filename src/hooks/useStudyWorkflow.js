import { useState, useMemo, useEffect } from 'react'
import { trials, practiceTrials, studyTypes } from '../studyData.js'
import telemetry, { EventType } from '../telemetry.js'
import CONFIG from '../config/index.js'

/**
 * Custom hook encapsulating the study state machine and workflow progression.
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

  // Step data collection
  const [initialEstimate, setInitialEstimate] = useState('')
  const [initialConfidence, setInitialConfidence] = useState(null)
  const [verificationResponse, setVerificationResponse] = useState(null)
  const [finalEstimate, setFinalEstimate] = useState('')
  const [finalConfidence, setFinalConfidence] = useState(null)
  const [cognitiveLoad, setCognitiveLoad] = useState(null)

  const [startedAt, setStartedAt] = useState(Date.now())

  // Derived values
  const currentTrials = isPractice ? practiceTrials : trials
  const trial = currentTrials[trialIndex] ?? null
  const type = trial ? (studyTypes[trial.scenarioType || trial.type] || trial) : null
  const totalTrials = currentTrials.length
  const trialNumber = trialIndex + 1
  const isLastTrial = trialIndex === totalTrials - 1
  const progress = Math.round((trialIndex / totalTrials) * 100)

  const explanation = useMemo(() => {
    if (!trial || condition === 'c0') return null
    if (trial.explanations) return trial.explanations[condition] ?? null
    return trial[condition] ?? null
  }, [condition, trial])

  // Screen view telemetry
  useEffect(() => {
    telemetry.recordEvent(EventType.SCREEN_VIEWED, { screen: phase })
  }, [phase])

  // Trial start telemetry
  useEffect(() => {
    if ((phase === 'practice' || phase === 'scored') && trial && trialStep === 1) {
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
  }

  // Navigation methods
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

  function submitInitialEstimate(e) {
    e?.preventDefault()
    const value = Number(initialEstimate)
    if (!Number.isFinite(value) || value < 0 || initialConfidence === null) return

    const dwellMs = Date.now() - startedAt
    telemetry.recordStep1InitialEstimate({
      trialId: trial.id,
      isPractice,
      initialEstimate: value,
      initialConfidence,
      dwellMs,
    })

    setTrialStep(2)
    setStartedAt(Date.now())
  }

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

  function submitFinalEstimate(e) {
    e?.preventDefault()
    const value = Number(finalEstimate)
    if (!Number.isFinite(value) || value < 0 || !finalConfidence || !cognitiveLoad) return

    const step4DwellMs = Date.now() - startedAt
    telemetry.recordStep4FinalEstimate({
      trialId: trial.id,
      scenario: trial,
      isPractice,
      initialEstimate: Number(initialEstimate),
      finalEstimate: value,
      finalConfidence,
      cognitiveLoad,
      verificationResponse,
      dwellMs: step4DwellMs,
    })

    if (isPractice) {
      setPhase('practice-feedback')
    } else {
      advanceScoredTrial()
    }
  }

  function advanceScoredTrial() {
    if (isLastTrial) {
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
