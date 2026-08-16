import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { Complete } from '../components/pages/PostTrialPages.jsx'

/**
 * CompletePage — terminal screen shown once the study is fully finished.
 * Displays the session code and compensation / next-step instructions.
 */
export default function CompletePage() {
  const { participantId } = useStudyContext()

  return <Complete participantId={participantId} />
}
