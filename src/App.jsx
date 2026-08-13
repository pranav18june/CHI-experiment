import React from 'react'
import { workshop, expertWalkthrough } from './studyData.js'
import { Header } from './components/common/Header.jsx'
import { TrialShell } from './components/trial/TrialShell.jsx'
import {
  WelcomeScreen,
  ParticipantTypeSelect,
  Workshop,
  ExpertWalkthrough,
  ComprehensionCheck,
} from './components/pages/OrientationPages.jsx'
import {
  PracticeFeedback,
  PostTask,
  Debrief,
  Complete,
} from './components/pages/PostTrialPages.jsx'
import { useStudyWorkflow } from './hooks/useStudyWorkflow.js'

/**
 * Root Controller Component
 * Clean, lightweight orchestrator delegating presentation to sub-components
 * and state logic to the useStudyWorkflow custom hook.
 */
function App() {
  const {
    participantId,
    phase,
    condition,
    isPractice,
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
  } = useStudyWorkflow()

  // Full-page screen routing
  if (phase === 'consent')
    return <WelcomeScreen participantId={participantId} onStart={handleConsentSubmit} />

  if (phase === 'participant-type')
    return <ParticipantTypeSelect onSelect={handleParticipantTypeSelect} />

  if (phase === 'training')
    return <Workshop items={workshop} onContinue={handleTrainingComplete} />

  if (phase === 'walkthrough')
    return <ExpertWalkthrough items={expertWalkthrough} onContinue={handleWalkthroughComplete} />

  if (phase === 'check')
    return <ComprehensionCheck onContinue={handleCheckComplete} />

  if (phase === 'post-task')
    return <PostTask participantId={participantId} onComplete={handlePostTaskComplete} />

  if (phase === 'debrief')
    return <Debrief participantId={participantId} onComplete={() => setPhase('complete')} />

  if (phase === 'complete')
    return <Complete participantId={participantId} />

  // Safety guard
  if (!trial || !type) return null

  // Trial views (Practice & Scored)
  return (
    <main className="study-shell">
      <Header
        trialNumber={trialNumber}
        totalTrials={totalTrials}
        progress={progress}
        isPractice={isPractice}
        trialStep={trialStep}
      />

      {(phase === 'practice' || phase === 'scored') && (
        <TrialShell
          trial={trial}
          type={type}
          trialStep={trialStep}
          condition={condition}
          explanation={explanation}
          fetchedAdvice={fetchedAdvice}
          isFetchingAdvice={isFetchingAdvice}
          // Step 1
          initialEstimate={initialEstimate}
          onInitialEstimate={setInitialEstimate}
          initialConfidence={initialConfidence}
          onInitialConfidence={setInitialConfidence}
          onSubmitStep1={submitInitialEstimate}
          // Step 2
          onAcknowledgeAI={acknowledgeAI}
          // Step 3
          verificationResponse={verificationResponse}
          onVerification={setVerificationResponse}
          onSubmitStep3={submitVerification}
          // Step 4
          finalEstimate={finalEstimate}
          onFinalEstimate={setFinalEstimate}
          finalConfidence={finalConfidence}
          onFinalConfidence={setFinalConfidence}
          cognitiveLoad={cognitiveLoad}
          onCognitiveLoad={setCognitiveLoad}
          onSubmitStep4={submitFinalEstimate}
        />
      )}

      {phase === 'practice-feedback' && (
        <PracticeFeedback
          response={Number(finalEstimate)}
          optimal={typeof trial.recommendation === 'object' ? (trial.recommendation.optimal ?? trial.recommendation.correct) : trial.optimal}
          onNext={handleNextPracticeTrial}
          isLast={isLastTrial}
        />
      )}
    </main>
  )
}

export default App
