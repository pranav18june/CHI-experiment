import React from 'react'
import { formatCurrency } from '../../utils/formatters.js'

// TODO_PRACTICE_FEEDBACK_TEXT: Educational feedback copy for practice mode.
export function PracticeFeedback({ response, optimal, onNext, isLast }) {
  const difference = Math.abs(response - optimal)
  const isExact = difference === 0
  const side = response > optimal ? 'over-ordering' : 'under-ordering'

  return (
    <section className="feedback-card">
      <p className="eyebrow">Practice feedback</p>
      <h1>Here&rsquo;s how your decision compared.</h1>
      <div className="feedback-values">
        <div><span>Cost-optimal value</span><strong>{formatCurrency(optimal)}</strong></div>
        <i />
        <div><span>Your entered value</span><strong>{formatCurrency(response)}</strong></div>
      </div>
      <p className="feedback-copy">
        The cost-optimal value for this decision was {formatCurrency(optimal)}. Your entered value was {formatCurrency(response)} — {isExact ? 'an exact match!' : `a difference of ${formatCurrency(difference)}${side ? `, on the ${side} side.` : '.'}`}
      </p>
      <div className="feedback-note">
        <span>ⓘ</span>
        <p>This feedback reports distance from optimal, not a verdict on the AI. Feedback is only shown during practice rounds.</p>
      </div>
      <button className="button primary" type="button" onClick={onNext}>
        {isLast ? 'Begin scored trials' : 'Next practice trial'} <span>→</span>
      </button>
    </section>
  )
}

// TODO_GLOBAL_QUESTIONNAIRES: Post-task questionnaire container placeholder (NASA-TLX, numeracy scale, domain experience).
export function PostTask({ participantId, onComplete }) {
  function handleSubmit(e) {
    e.preventDefault()
    onComplete({})
  }

  return (
    <main className="welcome-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="welcome-card consent-page">
        <p className="eyebrow">Almost done</p>
        <h1>Post-task questions</h1>
        <p className="lede">Please answer a few short questions about your experience.</p>
        <div className="consent-placeholder">
          <strong>TODO_GLOBAL_QUESTIONNAIRES</strong>
          <span>
            The post-task questionnaire will appear here. This placeholder will be replaced with
            the full instrument (e.g. NASA-TLX, numeracy scale, domain experience items) once
            the questionnaire design is finalised.
          </span>
        </div>
        <form onSubmit={handleSubmit}>
          <button className="button primary full" type="submit">
            Continue to debrief <span>→</span>
          </button>
        </form>
        <p className="participant-code">Session code: {participantId}</p>
      </section>
    </main>
  )
}

export function Debrief({ participantId, onComplete }) {
  return (
    <main className="welcome-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="welcome-card">
        <p className="eyebrow">Study information</p>
        <h1>Thank you for participating.</h1>
        <p className="lede">Now that you have completed all decision rounds, we can share more about the study.</p>
        <div className="consent-placeholder">
          <strong>TODO_DEBRIEF_TEXT</strong>
          <span>
            Ethics-approved debrief text will appear here. This will disclose that some AI
            recommendations were intentionally inaccurate, explain the study purpose, and
            provide researcher contact details and withdrawal rights.
          </span>
        </div>
        <button className="button primary full" type="button" onClick={onComplete}>
          Finish <span>→</span>
        </button>
        <p className="participant-code">Session code: {participantId}</p>
      </section>
    </main>
  )
}

export function Complete({ participantId }) {
  return (
    <main className="welcome-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="welcome-card completion">
        <div className="checkmark">✓</div>
        <p className="eyebrow">Study complete</p>
        <h1>Thank you for your time.</h1>
        <p className="lede">Your responses have been recorded for this session.</p>
        <div className="consent-placeholder">
          <strong>TODO_COMPLETION_INSTRUCTIONS</strong>
          <span>
            Participant compensation, course-credit redemption, or next-step instructions
            will appear here.
          </span>
        </div>
        <p className="participant-code">Session code: {participantId}</p>
      </section>
    </main>
  )
}
