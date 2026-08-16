import React, { useState } from 'react'
import Scale from '../common/Scale.jsx'
import NumberLineInput from '../common/NumberLineInput.jsx'
import { validateNumericEstimate, validateVerificationResponse } from '../../services/validationService.js'

/**
 * Step 1 — Initial independent participant estimate (before AI reveal).
 * Interactive Protocol §5.9 Number-Line & Slider Input anchored to historical baseline.
 */
export function Step1({ type, trial, initialEstimate, onInitialEstimate, initialConfidence, onInitialConfidence, onSubmit }) {
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
      
      <NumberLineInput
        id="initial-decision"
        value={initialEstimate}
        onChange={onInitialEstimate}
        scenario={trial}
        placeholder="Select or enter your estimate"
        autoFocus
      />

      <p className="field-note">
        Use the number line scale or type a dollar value. The AI recommendation is not yet visible.
      </p>
      
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

/**
 * Step 2 — AI Recommendation and Condition Explanation reveal.
 */
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

const VERIFICATION_OPTIONS = [
  { value: 'too_high',    label: 'Too High' },
  { value: 'about_right', label: 'About Right' },
  { value: 'too_low',     label: 'Too Low' },
]

/**
 * Step 3 — Verification Check.
 */
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

/**
 * Step 4 — Final estimate submission after viewing AI advice.
 * Interactive Protocol §5.9 Number-Line & Slider Input anchored to historical baseline.
 */
export function Step4({
  type,
  trial,
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
      
      <NumberLineInput
        id="final-decision"
        value={finalEstimate}
        onChange={onFinalEstimate}
        scenario={trial}
        placeholder="Select or enter your final decision"
        autoFocus
      />

      <p className="field-note">
        You may keep your original estimate, adopt the AI recommendation, or select any point on the scale.
      </p>

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
