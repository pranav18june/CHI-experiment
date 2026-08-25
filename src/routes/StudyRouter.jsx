import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import GuardedRoute        from './GuardedRoute.jsx'
import { ROUTE_ALLOWED_PHASES } from '../context/StudyContext.jsx'
import ConsentPage         from '../pages/ConsentPage.jsx'
import ParticipantTypePage  from '../pages/ParticipantTypePage.jsx'
import TrainingPage         from '../pages/TrainingPage.jsx'
import WalkthroughPage      from '../pages/WalkthroughPage.jsx'
import CheckPage            from '../pages/CheckPage.jsx'
import PracticePage         from '../pages/PracticePage.jsx'
import ScoredPage           from '../pages/ScoredPage.jsx'
import PostTaskPage         from '../pages/PostTaskPage.jsx'
import DebriefPage          from '../pages/DebriefPage.jsx'
import CompletePage         from '../pages/CompletePage.jsx'
import ExcludedPage         from '../pages/ExcludedPage.jsx'
import AdminPage            from '../pages/AdminPage.jsx'

/**
 * StudyRouter — declarative route table for the research study platform.
 *
 * Each study phase and administrative screen has a dedicated URL:
 *   /            → Consent & Demographics
 *   /type        → Participant Type Selection
 *   /training    → Novice Workshop / Training
 *   /walkthrough → Expert Walkthrough
 *   /check       → 4-Item Novice Comprehension Check
 *   /practice    → Practice Trials & Feedback (Gated)
 *   /scored      → Scored 12-Trial Protocol (Gated)
 *   /post-task   → Post-Task Questionnaire
 *   /debrief     → Study Debrief
 *   /complete    → Completion Code
 *   /excluded    → Pre-registered Exclusion Screen
 *   /admin       → Real-time Monitoring Dashboard
 */
/** Applies the phase allow-list declared for a route path. */
function Guard({ path, children }) {
  return <GuardedRoute allowedPhases={ROUTE_ALLOWED_PHASES[path]}>{children}</GuardedRoute>
}

export function StudyRouter() {
  return (
    <Routes>
      {/*
        Every study route is phase-guarded (§5.11 ordering). Without this a
        participant can type /scored, skip consent and training, or use the back
        button to re-enter a completed phase — and an excluded participant can
        reach the scored block. /admin is outside the participant flow.
      */}
      <Route path="/"            element={<Guard path="/"><ConsentPage /></Guard>} />
      <Route path="/type"        element={<Guard path="/type"><ParticipantTypePage /></Guard>} />
      <Route path="/training"    element={<Guard path="/training"><TrainingPage /></Guard>} />
      <Route path="/walkthrough" element={<Guard path="/walkthrough"><WalkthroughPage /></Guard>} />
      <Route path="/check"       element={<Guard path="/check"><CheckPage /></Guard>} />
      <Route path="/practice"    element={<Guard path="/practice"><PracticePage /></Guard>} />
      <Route path="/scored"      element={<Guard path="/scored"><ScoredPage /></Guard>} />
      <Route path="/post-task"   element={<Guard path="/post-task"><PostTaskPage /></Guard>} />
      <Route path="/debrief"     element={<Guard path="/debrief"><DebriefPage /></Guard>} />
      <Route path="/complete"    element={<Guard path="/complete"><CompletePage /></Guard>} />
      <Route path="/excluded"    element={<Guard path="/excluded"><ExcludedPage /></Guard>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default StudyRouter
