import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

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
import AdminPage            from '../pages/AdminPage.jsx'

/**
 * StudyRouter — declarative route table for the research study platform.
 *
 * Each study phase and administrative screen has a dedicated, direct URL:
 *   /            → Consent & Demographics
 *   /type        → Participant Type Selection
 *   /training    → Novice Workshop / Training
 *   /walkthrough → Expert Walkthrough
 *   /check       → Comprehension Check
 *   /practice    → Practice Trials & Feedback
 *   /scored      → Scored 12-Trial Protocol
 *   /post-task   → Post-Task Questionnaire
 *   /debrief     → Study Debrief
 *   /complete    → Completion Code
 *   /admin       → Real-time Monitoring Dashboard
 */
export function StudyRouter() {
  return (
    <Routes>
      <Route path="/" element={<ConsentPage />} />
      <Route path="/type" element={<ParticipantTypePage />} />
      <Route path="/training" element={<TrainingPage />} />
      <Route path="/walkthrough" element={<WalkthroughPage />} />
      <Route path="/check" element={<CheckPage />} />
      <Route path="/practice" element={<PracticePage />} />
      <Route path="/scored" element={<ScoredPage />} />
      <Route path="/post-task" element={<PostTaskPage />} />
      <Route path="/debrief" element={<DebriefPage />} />
      <Route path="/complete" element={<CompletePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default StudyRouter
