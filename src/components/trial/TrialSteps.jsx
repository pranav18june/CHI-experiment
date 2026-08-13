import React, { useState } from 'react'
import Scale from '../common/Scale.jsx'
import { validateNumericEstimate, validateVerificationResponse } from '../../services/validationService.js'

// TODO_NUMBERLINE_INPUT: Future iterations of the study protocol may replace the numeric text input with an interactive number line component.
export function Step1({ type, initialEstimate, onInitialEstimate, initialConfidence, onInitialConfidence, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const validation = validateNumericEstimate(initialEstimate)
  const canSubmit = validation.isValid && initialConfidence !== null && !isSubmitting

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    onSubmit(e)
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit}>
      <label htmlFor="initial-decision">{type.initialPrompt}</label>
      <div className="money-input">
        <span>$</span>
        <input
          id="initial-decision"
          type="text"
          inputMode="numeric"
          value={initialEstimate}
          onChange={(e) => onInitialEstimate(e.target.value)}
          placeholder="Enter your estimate"
          autoComplete="off"
          autoFocus
        />
      </div>
      <p className="field-note">Enter a dollar amount (e.g. 15,000 or $15000). The AI recommendation is not yet visible.</p>
      <Scale
        label="How confident are you in this estimate?"
        low="Not at all confident"
        high="Very confident"
        selected={initialConfidence}
        onSelect={onInitialConfidence}
      />
      <button className="button primary full" type="submit" disabled={!canSubmit}>
        {isSubmitting ? 'Loading AI recommendation...' : 'See AI recommendation →'}
      </button>
    </form>
  )
}

export function Step2({ condition, explanation, onContinue, isFetchingAdvice }) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleContinue() {
    if (isSubmitting || isFetchingAdvice) return
    setIsSubmitting(true)
    onContinue()
  }

  return (
    <>
      {isFetchingAdvice ? (
        <section className="card explanation">
          <p className="eyebrow">Loading</p>
          <p>Fetching AI recommendation...</p>
        </section>
      ) : (
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
        </>
      )}
      <button
        className="button primary full"
        type="button"
        disabled={isSubmitting || isFetchingAdvice}
        onClick={handleContinue}
      >
        {isSubmitting ? 'Saving...' : 'Continue →'}
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isValid = validateVerificationResponse(verificationResponse)

  function handleSubmit() {
    if (!isValid || isSubmitting) return
    setIsSubmitting(true)
    onSubmit()
  }

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
        disabled={!isValid || isSubmitting}
        onClick={handleSubmit}
        style={{ marginTop: '14px' }}
      >
        {isSubmitting ? 'Saving...' : 'Continue →'}
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const validation = validateNumericEstimate(finalEstimate)
  const canSubmit = validation.isValid && finalConfidence !== null && cognitiveLoad !== null && !isSubmitting

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    onSubmit(e)
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit}>
      <label htmlFor="final-decision">{type.decisionPrompt}</label>
      <div className="money-input">
        <span>$</span>
        <input
          id="final-decision"
          type="text"
          inputMode="numeric"
          value={finalEstimate}
          onChange={(e) => onFinalEstimate(e.target.value)}
          placeholder="Enter your final decision"
          autoComplete="off"
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
        {isSubmitting ? 'Submitting...' : 'Continue →'}
      </button>
    </form>
  )
}
