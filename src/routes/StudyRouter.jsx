import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStudyContext, PHASE_TO_PATH } from '../context/StudyContext.jsx'
import { GuardedRoute } from './GuardedRoute.jsx'

import ConsentPage        from '../pages/ConsentPage.jsx'
import ParticipantTypePage from '../pages/ParticipantTypePage.jsx'
import TrainingPage        from '../pages/TrainingPage.jsx'
import WalkthroughPage     from '../pages/WalkthroughPage.jsx'
import CheckPage           from '../pages/CheckPage.jsx'
import PracticePage        from '../pages/PracticePage.jsx'
import ScoredPage          from '../pages/ScoredPage.jsx'
import PostTaskPage        from '../pages/PostTaskPage.jsx'
import DebriefPage         from '../pages/DebriefPage.jsx'
import CompletePage        from '../pages/CompletePage.jsx'
import AdminPage           from '../pages/AdminPage.jsx'

/**
 * StudyRouter — declarative route table for the research study platform.
 *
 * Route design principles:
 *  - Each logical step in the study has its own URL and page component.
 *  - Every route beyond consent is wrapped with <GuardedRoute> so participants
 *    cannot skip ahead by typing a URL or clicking browser Back.
 *  - Phase-to-path mapping is centralised in StudyContext (PHASE_TO_PATH).
 *  - The wildcard catch-all redirects any unknown URL to the participant's
 *    current position in the study.
 */
export function StudyRouter() {
  const { phase } = useStudyContext()

  return (
    <Routes>
      {/* ── Consent (entry point, always accessible) ── */}
      <Route path="/" element={<ConsentPage />} />

      {/* ── Onboarding ── */}
      <Route path="/type" element={
        <GuardedRoute allowedPhases={['participant-type']}>
          <ParticipantTypePage />
        </GuardedRoute>
      } />
      <Route path="/training" element={
        <GuardedRoute allowedPhases={['training']}>
          <TrainingPage />
        </GuardedRoute>
      } />
      <Route path="/walkthrough" element={
        <GuardedRoute allowedPhases={['walkthrough']}>
          <WalkthroughPage />
        </GuardedRoute>
      } />
      <Route path="/check" element={
        <GuardedRoute allowedPhases={['check']}>
          <CheckPage />
        </GuardedRoute>
      } />

      {/* ── Trials ── */}
      <Route path="/practice" element={
        <GuardedRoute allowedPhases={['practice', 'practice-feedback']}>
          <PracticePage />
        </GuardedRoute>
      } />
      <Route path="/scored" element={
        <GuardedRoute allowedPhases={['scored']}>
          <ScoredPage />
        </GuardedRoute>
      } />

      {/* ── Post-study ── */}
      <Route path="/post-task" element={
        <GuardedRoute allowedPhases={['post-task']}>
          <PostTaskPage />
        </GuardedRoute>
      } />
      <Route path="/debrief" element={
        <GuardedRoute allowedPhases={['debrief']}>
          <DebriefPage />
        </GuardedRoute>
      } />
      <Route path="/complete" element={
        <GuardedRoute allowedPhases={['complete']}>
          <CompletePage />
        </GuardedRoute>
      } />

      {/* ── Admin dashboard (independent of study phase, no guard) ── */}
      <Route path="/admin" element={<AdminPage />} />

      {/* ── Catch-all: redirect any unknown URL to current phase ── */}
      <Route path="*" element={<Navigate to={PHASE_TO_PATH[phase] ?? '/'} replace />} />
    </Routes>
  )
}

export default StudyRouter
