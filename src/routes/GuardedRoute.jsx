import React from 'react'
import { Navigate } from 'react-router-dom'
import { useStudyContext, PHASE_TO_PATH } from '../context/StudyContext.jsx'

/**
 * GuardedRoute — protects a route from being accessed out of sequence.
 *
 * Each route declares which phase(s) allow access to it via `allowedPhases`.
 * If the participant's current phase is not in that list, they are redirected
 * to the URL that corresponds to their actual current phase.
 *
 * This prevents:
 *  - Manually typing /scored into the URL during consent
 *  - Using the browser back button to revisit earlier phases
 *  - Bookmarking and returning to a mid-study URL after session expiry
 *
 * @param {string[]} allowedPhases - Phase values that are permitted on this route
 * @param {React.ReactNode} children - The page component to render if access is allowed
 */
export function GuardedRoute({ allowedPhases, children }) {
  const { phase, isExcluded, isPreviewOverride } = useStudyContext()

  // Researcher preview (VITE_ALLOW_URL_OVERRIDES) bypasses sequencing on purpose;
  // those sessions are stamped and are not collected data.
  if (isPreviewOverride) return children

  // A pre-registered exclusion outranks the phase table: nothing but /excluded.
  if (isExcluded) {
    return allowedPhases?.includes('excluded') ? children : <Navigate to="/excluded" replace />
  }

  if (!allowedPhases || !allowedPhases.includes(phase)) {
    const redirectPath = PHASE_TO_PATH[phase] ?? '/'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

export default GuardedRoute
