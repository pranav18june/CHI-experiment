import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { ParticipantTypeSelect } from '../components/pages/OrientationPages.jsx'

/**
 * ParticipantTypePage — novice vs. expert self-identification.
 *
 * Selecting a group triggers server-side assignment of the experimental cell
 * and the counterbalanced trial plan (§5.1, §5.6). Assignment is authoritative:
 * if the server cannot be reached the participant waits and retries rather than
 * proceeding on a locally-invented condition.
 */
export default function ParticipantTypePage() {
  const {
    handleParticipantTypeSelect,
    isAssigning,
    assignmentError,
    retryAssignment,
  } = useStudyContext()

  return (
    <ParticipantTypeSelect
      onSelect={handleParticipantTypeSelect}
      isAssigning={isAssigning}
      assignmentError={assignmentError}
      onRetry={retryAssignment}
    />
  )
}
