import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { WelcomeScreen } from '../components/pages/OrientationPages.jsx'

/**
 * ConsentPage — the study entry point.
 * Collects demographics and consent declarations, then triggers
 * survey mode assignment and advances to participant type selection.
 */
export default function ConsentPage() {
  const { participantId, handleConsentSubmit } = useStudyContext()

  return (
    <WelcomeScreen
      participantId={participantId}
      onStart={handleConsentSubmit}
    />
  )
}
