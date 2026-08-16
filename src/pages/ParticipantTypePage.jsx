import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { ParticipantTypeSelect } from '../components/pages/OrientationPages.jsx'

/**
 * ParticipantTypePage — novice vs. expert self-identification.
 * Routes novices to /training and experts to /walkthrough.
 */
export default function ParticipantTypePage() {
  const { handleParticipantTypeSelect } = useStudyContext()

  return <ParticipantTypeSelect onSelect={handleParticipantTypeSelect} />
}
