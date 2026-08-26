import React, { useState } from 'react'
import { formatCurrency } from '../../utils/formatters.js'
import STUDY_COPY from '../../config/studyCopy.js'

const ATTENTION_CHOICES = [
  { value: 'strongly_disagree', label: 'Strongly Disagree' },
  { value: 'disagree',          label: 'Disagree' },
  { value: 'neutral',           label: 'Neutral' },
  { value: 'agree',             label: 'Agree' },
  { value: 'strongly_agree',    label: 'Strongly Agree' },
]

/**
 * PracticeFeedback — Educational feedback component with embedded Attention Check (Protocol §5.11)
 */
export function PracticeFeedback({ response, optimal, onNext, onAttentionFail, isLast }) {
  const difference = Math.abs(response - optimal)
  const isExact = difference === 0
  const side = response > optimal ? 'over-ordering' : 'under-ordering'
  const [attentionResponse, setAttentionResponse] = useState(null)

  function handleContinue() {
    if (isLast) {
      if (!attentionResponse) return
      if (attentionResponse === 'strongly_agree') {
        onNext()
      } else {
        onAttentionFail(attentionResponse)
      }
    } else {
      onNext()
    }
  }

  const canContinue = !isLast || attentionResponse !== null

  return (
    <section className="feedback-card" style={{ maxWidth: 680 }}>
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

      {isLast && (
        <div style={{ marginTop: 24, padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ font: '600 11px var(--mono)', color: 'var(--accent-dark)', background: 'var(--accent-light)', padding: '2px 7px', borderRadius: 4 }}>
              Protocol Attention Check
            </span>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            To confirm you are reading task instructions and feedback carefully before beginning the 12 scored trials,
            please select <strong>&ldquo;Strongly Agree&rdquo;</strong> for this statement regardless of your actual opinion:
            <br />
            <em style={{ display: 'block', marginTop: 4, color: 'var(--muted)' }}>
              &ldquo;I understand that cost feedback is only provided during practice rounds and will not be displayed during the scored trials.&rdquo;
            </em>
          </p>
          <div className="choice-list" style={{ margin: 0, gap: 6 }}>
            {ATTENTION_CHOICES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={attentionResponse === opt.value ? 'choice selected' : 'choice'}
                onClick={() => setAttentionResponse(opt.value)}
                style={{ padding: '10px 14px', fontSize: 13 }}
              >
                <span style={{ width: 20, height: 20, fontSize: 10 }}>
                  {attentionResponse === opt.value ? '✓' : ''}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="button primary full"
        type="button"
        disabled={!canContinue}
        onClick={handleContinue}
        style={{ marginTop: 24 }}
      >
        {isLast ? 'Begin scored trials' : 'Next practice trial'} <span>→</span>
      </button>
    </section>
  )
}

export { default as PostTask } from './PostTaskForm.jsx'

export function Debrief({ participantId, onComplete }) {
  const c = STUDY_COPY
  return (
    <main className="welcome-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="welcome-card consent-page">
        <p className="eyebrow">Study information</p>
        <h1>Thank you — and one thing we need to tell you.</h1>

        <section className="consent-copy">
          {/*
            §5.11 requires the debrief to disclose the deception. It comes first,
            in plain words, before any explanation of the science — a participant
            should not have to read three paragraphs to find out they were misled.
          */}
          <h2>Some of the AI recommendations were deliberately wrong</h2>
          <p>
            Half of the twelve recommendations you saw were incorrect on purpose. They were
            produced by feeding the forecasting model a deliberately mistaken assumption —
            for example, telling it that demand swung more widely than it really did — so the
            number it produced was genuinely too high or too low.
          </p>
          <p>
            We did not tell you this beforehand, and we are sorry for the deception. If you
            had known that some recommendations were wrong, you would have checked all of them
            differently, and the study could not have measured what we needed it to measure.
            Nothing you did was wrong, and there was no way to score badly by trusting the AI.
          </p>

          <h2>What we were actually studying</h2>
          <p>
            We are testing whether the <em>way</em> an AI explains its recommendation changes
            how well people catch its mistakes. Different participants saw the same
            recommendations with different kinds of explanation: some saw none, some saw the
            factors behind the number, some a written summary, and some a statement of the
            assumption the AI had made.
          </p>
          <p>
            The question is whether one of those formats helps someone without a supply chain
            background make decisions as sound as an experienced planner's — particularly
            avoiding the expensive kind of error. If it does, explanation design becomes a way
            of putting expertise within reach of people who do not yet have it.
          </p>

          <h2>Your data</h2>
          <p>
            Your responses are stored under a study code, not your name. They are kept
            {c.dataStorageLocation ? ` ${c.dataStorageLocation}` : ''} for
            {' '}{c.dataRetentionPeriod || 'the duration of research analysis'}, and reported only in
            aggregate — no individual participant is identifiable in anything we publish.
          </p>
          <p>
            You may withdraw your data{c.withdrawalWindow ? ` within ${c.withdrawalWindow}` : ''},
            with no reason needed and no effect on your compensation. Email
            {' '}<strong>{c.contactEmail || 'pranav18june@gmail.com'}</strong> quoting the session code
            below and we will delete everything associated with it.
          </p>

          <h2>Questions or concerns</h2>
          <p>
            {c.principalInvestigator || 'Indo-Swiss Grant on AI for Public Good Team'}
            {c.institution ? `, ${c.institution}` : ''} — {c.contactEmail || 'pranav18june@gmail.com'}
          </p>
          {c.ethicsCommittee ? (
            <p>
              This study was approved by {c.ethicsCommittee}
              {c.ethicsApprovalRef ? ` (reference ${c.ethicsApprovalRef})` : ''}.
              {c.ethicsContactEmail ? ` Contact: ${c.ethicsContactEmail}.` : ''}
            </p>
          ) : null}
          <p>
            Please do not describe the task to anyone who may take part later — knowing in
            advance that some recommendations are wrong would change how they respond.
          </p>
        </section>

        <button className="button primary full" type="button" onClick={onComplete}>
          Finish <span>→</span>
        </button>
        <p className="participant-code">Session code: {participantId}</p>
      </section>
    </main>
  )
}

export function Complete({ participantId }) {
  const c = STUDY_COPY
  return (
    <main className="welcome-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="welcome-card completion">
        <div className="checkmark">✓</div>
        <p className="eyebrow">Study complete</p>
        <h1>Thank you for your time.</h1>
        <p className="lede">
          Your responses have been recorded. {c.compensation.payoutMethod
            ? `Payment will be made by ${c.compensation.payoutMethod}.`
            : ''}
        </p>

        {c.creditNote && <p className="lede">{c.creditNote}</p>}

        <p className="lede">
          Keep the code below. You will need it if you later want your data removed
          {c.withdrawalWindow ? ` (within ${c.withdrawalWindow})` : ''} — email
          {' '}{c.contactEmail || '[contact email]'}.
        </p>

        {c.redirectUrl && (
          <a className="button primary full" href={c.redirectUrl}>
            {c.redirectLabel || 'Continue'} <span>→</span>
          </a>
        )}

        <p className="participant-code">Confirmation code: {participantId}</p>
      </section>
    </main>
  )
}
