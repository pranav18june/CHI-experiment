import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { ExpertWalkthrough } from '../components/pages/OrientationPages.jsx'
import { expertWalkthrough } from '../studyData.js'

/**
 * WalkthroughPage — interface overview shown to expert participants.
 * Skips the comprehension check and goes directly to the practice round.
 */
export default function WalkthroughPage() {
  const { handleWalkthroughComplete } = useStudyContext()

  return <ExpertWalkthrough items={expertWalkthrough} onContinue={handleWalkthroughComplete} />
}
