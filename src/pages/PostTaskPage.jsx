import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { PostTask } from '../components/pages/PostTrialPages.jsx'

/**
 * PostTaskPage — global questionnaire placeholder shown after all scored trials.
 * Will be replaced with the full instrument (NASA-TLX, numeracy scale, etc.)
 * once the questionnaire design is finalised.
 */
export default function PostTaskPage() {
  const { participantId, handlePostTaskComplete } = useStudyContext()

  return (
    <PostTask
      participantId={participantId}
      onComplete={handlePostTaskComplete}
    />
  )
}
