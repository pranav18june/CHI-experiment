import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { Debrief } from '../components/pages/PostTrialPages.jsx'

/**
 * DebriefPage — discloses the study purpose, AI inaccuracies, and withdrawal
 * rights after all scored trials and post-task questionnaires are complete.
 */
export default function DebriefPage() {
  const { participantId, handleDebriefComplete } = useStudyContext()

  return (
    <Debrief
      participantId={participantId}
      onComplete={handleDebriefComplete}
    />
  )
}
