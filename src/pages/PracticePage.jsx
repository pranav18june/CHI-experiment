import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { Header } from '../components/common/Header.jsx'
import { TrialShell } from '../components/trial/TrialShell.jsx'
import { PracticeFeedback } from '../components/pages/PostTrialPages.jsx'

/**
 * PracticePage — handles both the practice trial flow and the inter-trial
 * feedback screen. On the final practice trial, embeds an attention check
 * that routes to the pre-registered exclusion path upon failure (Protocol §5.11).
 */
export default function PracticePage() {
  const {
    phase, condition,
    trialNumber, totalTrials, progress, trialStep,
    trial, type, explanation, fetchedAdvice, isFetchingAdvice,
    adviceError, retryAdvice,
    initialEstimate, setInitialEstimate,
    initialConfidence, setInitialConfidence,
    verificationResponse, setVerificationResponse,
    finalEstimate, setFinalEstimate,
    finalConfidence, setFinalConfidence,
    cognitiveLoad, setCognitiveLoad,
    submitInitialEstimate, acknowledgeAI, submitVerification, submitFinalEstimate,
    handleNextPracticeTrial,
    handleAttentionCheckFail,
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
        adviceError={adviceError}
        onRetryAdvice={retryAdvice}
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
          onAttentionFail={handleAttentionCheckFail}
          isLast={trialNumber === totalTrials}
        />
      )}
    </main>
  )
}
