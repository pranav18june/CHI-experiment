import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { Workshop } from '../components/pages/OrientationPages.jsx'
import { workshop } from '../studyData.js'

/**
 * TrainingPage — orientation workshop shown to novice participants.
 * Presented before the comprehension check and practice round.
 */
export default function TrainingPage() {
  const { handleTrainingComplete } = useStudyContext()

  return <Workshop items={workshop} onContinue={handleTrainingComplete} />
}
