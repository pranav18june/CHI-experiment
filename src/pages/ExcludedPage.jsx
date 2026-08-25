import React from 'react'
import { useStudyContext } from '../context/StudyContext.jsx'

/**
 * ExcludedPage — Pre-registered Participant Ineligibility / Exclusion Screen
 *
 * Rendered when a novice participant fails the 4-item comprehension check on both attempts.
 */
export default function ExcludedPage() {
  const { participantId } = useStudyContext()

  return (
    <main className="welcome-shell">
      <div className="wordmark">
        <span className="mark" />Decision Study
      </div>

      <div className="welcome-card" style={{ maxWidth: 580 }}>
        <p className="eyebrow" style={{ color: '#b45309' }}>Session Concluded</p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', marginBottom: 16 }}>
          Thank you for your time
        </h1>
        <p className="lede" style={{ lineHeight: 1.6, marginBottom: 24 }}>
          Based on the responses to the task comprehension check, you do not meet the pre-registered criteria
          required for this specific experimental session.
        </p>

        <section className="consent-copy" style={{ margin: '0 0 24px', background: 'var(--surface)' }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            Per the study protocol approved by the institutional research board, participant data collection for this
            session has ended. No further tasks or decisions are required.
          </p>
        </section>

        {/*
          A pre-registered exclusion (§5.11, §9) is terminal. There is deliberately
          no bypass and no restart control: either would let an excluded participant
          re-enter the scored block and land in TrialResult beside valid sessions.
        */}

        <p className="participant-code" style={{ marginBottom: 0 }}>
          Session reference ID: <strong>{participantId}</strong>
        </p>
      </div>

      <footer className="quiet-footer">
        Decision Study Platform · Institutional Research Protocol
      </footer>
    </main>
  )
}
