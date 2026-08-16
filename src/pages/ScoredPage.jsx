import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { Header } from '../components/common/Header.jsx'
import { TrialShell } from '../components/trial/TrialShell.jsx'

/**
 * ScoredPage — the main experimental trial phase.
 * Renders the full four-step Judge-Advisor trial for each scored scenario.
 */
export default function ScoredPage() {
  const {
    surveyMode,
    trialNumber, totalTrials, progress, trialStep,
    trial, type, condition, explanation, fetchedAdvice, isFetchingAdvice,
    initialEstimate, setInitialEstimate,
    initialConfidence, setInitialConfidence,
    verificationResponse, setVerificationResponse,
    finalEstimate, setFinalEstimate,
    finalConfidence, setFinalConfidence,
    cognitiveLoad, setCognitiveLoad,
    submitInitialEstimate, acknowledgeAI, submitVerification, submitFinalEstimate,
  } = useStudyContext()

  if (!trial || !type) return null

  return (
    <main className="study-shell">
      <Header
        trialNumber={trialNumber}
        totalTrials={totalTrials}
        progress={progress}
        isPractice={false}
        trialStep={trialStep}
        surveyMode={surveyMode}
      />

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
    </main>
  )
}
