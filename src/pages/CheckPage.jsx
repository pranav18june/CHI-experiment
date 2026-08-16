import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'
import ComprehensionCheck from '../components/training/ComprehensionCheck.jsx'

/**
 * CheckPage — 4-Item Novice Comprehension Check (Protocol Appendix C.1).
 *
 * Novices must pass all 4 items to unlock the practice round.
 * Exactly 1 retry is permitted; failing twice results in pre-registered exclusion.
 */
export default function CheckPage() {
  const {
    handleComprehensionPass,
    handleComprehensionFail,
    handleComprehensionExclude,
  } = useStudyContext()

  return (
    <ComprehensionCheck
      onPass={handleComprehensionPass}
      onFail={handleComprehensionFail}
      onExclude={handleComprehensionExclude}
    />
  )
}
