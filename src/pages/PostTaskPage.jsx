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
 *   4. Expert-only reliance item (Appendix C.3) — company rules of thumb vs.
 *      the on-screen information
 */
export default function PostTaskPage() {
  const { participantId, participantType, handlePostTaskComplete } = useStudyContext()

  return (
    <PostTaskForm
      participantId={participantId}
      participantType={participantType}
      onComplete={handlePostTaskComplete}
    />
  )
}
