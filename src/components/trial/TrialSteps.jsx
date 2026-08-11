import React from 'react'
import Scale from '../common/Scale.jsx'

// TODO_NUMBERLINE_INPUT: Future iterations of the study protocol may replace the numeric text input with an interactive number line / slider input component.
export function Step1({ type, initialEstimate, onInitialEstimate, initialConfidence, onInitialConfidence, onSubmit }) {
  const parsed = Number(initialEstimate)
  const canSubmit = initialEstimate !== '' && Number.isFinite(parsed) && parsed >= 0 && initialConfidence !== null

  return (
    <form className="decision-form" onSubmit={onSubmit}>
      <label htmlFor="initial-decision">{type.initialPrompt}</label>
      <div className="money-input">
        <span>$</span>
        <input
          id="initial-decision"
          inputMode="numeric"
          min="0"
          type="number"
          value={initialEstimate}
          onChange={(e) => onInitialEstimate(e.target.value)}
          placeholder="Enter an amount"
          autoFocus
        />
      </div>
      <p className="field-note">Enter a whole dollar amount. The AI recommendation is not yet visible.</p>
      <Scale
        label="How confident are you in this estimate?"
        low="Not at all confident"
        high="Very confident"
        selected={initialConfidence}
        onSelect={onInitialConfidence}
      />
      <button className="button primary full" type="submit" disabled={!canSubmit}>
        See AI recommendation <span>→</span>
      </button>
    </form>
  )
}

export function Step2({ condition, explanation, onContinue }) {
  return (
    <>
      {explanation && (
        <section className="card explanation">
          <p className="eyebrow">
            {condition === 'c3' ? 'What would change this' : 'Context'}
          </p>
          <p>{explanation}</p>
        </section>
      )}
      {condition === 'c0' && (
        <p className="field-note" style={{ margin: '0 0 4px' }}>
          Review the chart and the AI recommendation above before continuing.
        </p>
      )}
      <button className="button primary full" type="button" onClick={onContinue}>
        Continue <span>→</span>
      </button>
    </>
  )
}

// TODO_VERIFICATION_COPY: Prompt copy for the verification check is based on protocol v4.1 section 4.3 ("Compared with the historical information, the AI recommendation appears: Too High / About Right / Too Low").
const VERIFICATION_OPTIONS = [
  { value: 'too_high',    label: 'Too High' },
  { value: 'about_right', label: 'About Right' },
  { value: 'too_low',     label: 'Too Low' },
]

export function Step3({ verificationResponse, onVerification, onSubmit }) {
  return (
    <section className="card verification-card">
      <p className="eyebrow">Verification</p>
      <h2>Compared with the historical information, the AI recommendation appears:</h2>
      <div className="choice-list">
        {VERIFICATION_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={verificationResponse === value ? 'choice selected' : 'choice'}
            onClick={() => onVerification(value)}
          >
            <span>{label[0]}</span>
            {label}
          </button>
        ))}
      </div>
      <button
        className="button primary full"
        type="button"
        disabled={!verificationResponse}
        onClick={onSubmit}
        style={{ marginTop: '14px' }}
      >
        Continue <span>→</span>
      </button>
    </section>
  )
}

export function Step4({
  type,
  finalEstimate, onFinalEstimate,
  finalConfidence, onFinalConfidence,
  cognitiveLoad, onCognitiveLoad,
  onSubmit,
}) {
  const parsed = Number(finalEstimate)
  const canSubmit = finalEstimate !== '' && Number.isFinite(parsed) && parsed >= 0
    && finalConfidence !== null && cognitiveLoad !== null

  return (
    <form className="decision-form" onSubmit={onSubmit}>
      <label htmlFor="final-decision">{type.decisionPrompt}</label>
      <div className="money-input">
        <span>$</span>
        <input
          id="final-decision"
          inputMode="numeric"
          min="0"
          type="number"
          value={finalEstimate}
          onChange={(e) => onFinalEstimate(e.target.value)}
          placeholder="Enter an amount"
          autoFocus
        />
      </div>
      <p className="field-note">You may use or adjust the AI recommendation.</p>
      <Scale
        label="How confident are you in your final decision?"
        low="Not at all confident"
        high="Very confident"
        selected={finalConfidence}
        onSelect={onFinalConfidence}
      />
      <Scale
        label="How mentally demanding was this decision?"
        low="Not demanding"
        high="Very demanding"
        selected={cognitiveLoad}
        onSelect={onCognitiveLoad}
      />
      <button className="button primary full" type="submit" disabled={!canSubmit}>
        Continue <span>→</span>
      </button>
    </form>
  )
}
