import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { Header } from '../components/common/Header.jsx'
import { TrialShell } from '../components/trial/TrialShell.jsx'
import { PracticeFeedback } from '../components/pages/PostTrialPages.jsx'

/**
 * PracticePage — handles both the practice trial flow and the inter-trial
 * feedback screen. Both sub-states share the /practice URL; the phase value
 * ('practice' vs 'practice-feedback') controls which view is rendered.
 */
export default function PracticePage() {
  const {
    phase, surveyMode,
    trialNumber, totalTrials, progress, trialStep,
    trial, type, condition, explanation, fetchedAdvice, isFetchingAdvice,
    initialEstimate, setInitialEstimate,
    initialConfidence, setInitialConfidence,
    verificationResponse, setVerificationResponse,
    finalEstimate, setFinalEstimate,
    finalConfidence, setFinalConfidence,
    cognitiveLoad, setCognitiveLoad,
    submitInitialEstimate, acknowledgeAI, submitVerification, submitFinalEstimate,
    handleNextPracticeTrial,
  } = useStudyContext()

  if (!trial || !type) return null

  return (
    <main className="study-shell">
      <Header
        trialNumber={trialNumber}
        totalTrials={totalTrials}
        progress={progress}
        isPractice={true}
        trialStep={trialStep}
        surveyMode={surveyMode}
      />

      {phase === 'practice' && (
        <TrialShell
          trial={trial}
          type={type}
          trialStep={trialStep}
          condition={condition}
          explanation={explanation}
          fetchedAdvice={fetchedAdvice}
          isFetchingAdvice={isFetchingAdvice}
          initialEstimate={initialEstimate}
          onInitialEstimate={setInitialEstimate}
          initialConfidence={initialConfidence}
          onInitialConfidence={setInitialConfidence}
          onSubmitStep1={submitInitialEstimate}
          onAcknowledgeAI={acknowledgeAI}
          verificationResponse={verificationResponse}
          onVerification={setVerificationResponse}
          onSubmitStep3={submitVerification}
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
          optimal={
            typeof trial.recommendation === 'object'
              ? (trial.recommendation.optimal ?? trial.recommendation.correct)
              : trial.optimal
          }
          onNext={handleNextPracticeTrial}
          isLast={trialNumber === totalTrials}
        />
      )}
    </main>
  )
}
