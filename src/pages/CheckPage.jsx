import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import { ComprehensionCheck } from '../components/pages/OrientationPages.jsx'

/**
 * CheckPage — one-question comprehension check for novice participants.
 * Must answer correctly before the practice round begins.
 */
export default function CheckPage() {
  const { handleCheckComplete } = useStudyContext()

  return <ComprehensionCheck onContinue={handleCheckComplete} />
}
