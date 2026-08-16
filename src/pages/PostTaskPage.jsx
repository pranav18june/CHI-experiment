import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import PostTaskForm from '../components/pages/PostTaskForm.jsx'

/**
 * PostTaskPage — Global post-experimental questionnaires (Protocol §5.11 / §6 / Appendix C.3).
 *
 * Implements:
 *   1. Full standard NASA-TLX 6-dimension workload battery
 *   2. Validated Numeracy battery (Schwartz-Lipkus 3-Item + Subjective Numeracy)
 *   3. Supply Chain Domain Experience measure
 */
export default function PostTaskPage() {
  const { participantId, handlePostTaskComplete } = useStudyContext()

  return (
    <PostTaskForm
      participantId={participantId}
      onComplete={handlePostTaskComplete}
    />
  )
}
