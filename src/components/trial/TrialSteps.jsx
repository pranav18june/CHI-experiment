import React, { useState } from 'react'
import Scale from '../common/Scale.jsx'
import NumberLineInput from '../common/NumberLineInput.jsx'
import { validateNumericEstimate, validateVerificationResponse } from '../../services/validationService.js'
import { getScenarioScaleBounds } from '../../utils/numberLine.js'
import { getDecisionPrompt } from '../../scenarios/index.js'

/**
 * Resolves the Step-1 / Step-4 decision question for a trial.
 *
 * Every scored decision family is covered here. The scenario's own
 * `decisionPrompt` is the final fallback so no trial can ever render an
 * empty question heading.
 */
function getDecisionQuestion(trial, step) {
  const location = `${trial.title || trial.store}, ${trial.category || trial.department}`

  if (trial.scenarioType === 'safetyStock') {
    return step === 1
      ? `How large a safety stock buffer should ${location} hold, to absorb normal week-to-week swings in demand?`
      : `Given everything you've seen, what's your final safety stock buffer for ${location}?`
  }

  if (trial.scenarioType === 'newsvendor') {
    return step === 1
      ? `How much should ${location} order for the upcoming peak week, given the risk of running short?`
      : `Given everything you've seen, what's your final order quantity for ${location}'s upcoming peak week?`
  }

  if (trial.scenarioType === 'reorderPoint') {
    return step === 1
      ? `At what inventory level should ${location} trigger a replenishment order, given how long the supplier takes to deliver?`
      : `Given everything you've seen, what's your final reorder point for ${location}?`
  }

  if (trial.scenarioType === 'expediteOrWait') {
    return step === 1
      ? `How much should ${location} pay to expedite this shipment, given the risk of it arriving late?`
      : `Given everything you've seen, what's your final expedite payment for ${location}?`
  }

  return getDecisionPrompt(trial, step === 1 ? 1 : 4) || null
}

/**
 * Step 1 — Initial independent participant estimate (before AI reveal).
 * Interactive Protocol §5.9 Number-Line & Slider Input anchored to historical baseline.
 */
export function Step1({ type, trial, initialEstimate, onInitialEstimate, initialConfidence, onInitialConfidence, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const band = getScenarioScaleBounds(trial)
  const validation = validateNumericEstimate(initialEstimate, band)
  const showRangeError = initialEstimate !== '' && !validation.isValid
  const canSubmit = validation.isValid && initialConfidence !== null && !isSubmitting

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    onSubmit(e)
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit}>
      <h2>{getDecisionQuestion(trial, 1) || type.initialPrompt}</h2>
      {getDecisionQuestion(trial, 1) && (
        <p className="field-note">Enter a dollar amount using the scale or the input box.</p>
      )}
      {showRangeError && <p className="field-error" role="alert">{validation.error}</p>}
      
      <NumberLineInput
        id="initial-decision"
        value={initialEstimate}
        onChange={onInitialEstimate}
        scenario={trial}
        placeholder="Select or enter your estimate"
        autoFocus
      />

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
export function Step2({ condition, explanation, onContinue, isFetchingAdvice, adviceError, onRetryAdvice }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const explanationFactors = explanation?.factors || []
  const explanationText = typeof explanation === 'string' ? explanation : null

  function handleContinue() {
    if (isSubmitting || isFetchingAdvice) return
    setIsSubmitting(true)
    onContinue()
  }

  // The recommendation could not be resolved and there is no server-issued plan
  // to fall back on. Showing a guessed value here would fabricate the
  // correctness manipulation, so the trial stops and offers a retry instead.
  if (adviceError) {
    return (
      <section className="card explanation" role="alert">
        <p className="eyebrow">Connection problem</p>
        <p>{adviceError}</p>
        <button className="button primary full" type="button" onClick={onRetryAdvice} style={{ marginTop: 14 }}>
          Retry <span>↻</span>
        </button>
      </section>
    )
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
          {condition === 'c1' && (explanationFactors.length > 0 || explanationText) && (
            <section className="card explanation">
              <p className="eyebrow">Key factors</p>
              {explanationFactors.length > 0 ? (
                <div className="driver-list">
                  {explanationFactors.map(({ label, value }) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              ) : <p>{explanationText}</p>}
            </section>
          )}
          {(condition === 'c2' || condition === 'c3') && explanationText && (
            <section className="card explanation">
              <p className="eyebrow">
                {condition === 'c3' ? 'Verification' : 'Context'}
              </p>
              <p>{explanationText}</p>
            </section>
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
  const band = getScenarioScaleBounds(trial)
  const validation = validateNumericEstimate(finalEstimate, band)
  const showRangeError = finalEstimate !== '' && !validation.isValid
  const canSubmit = validation.isValid && finalConfidence !== null && cognitiveLoad !== null && !isSubmitting

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    onSubmit(e)
  }

  return (
    <form className="decision-form" onSubmit={handleSubmit}>
      <h2>{getDecisionQuestion(trial, 4) || type.decisionPrompt}</h2>
      
      <NumberLineInput
        id="final-decision"
        value={finalEstimate}
        onChange={onFinalEstimate}
        scenario={trial}
        placeholder="Select or enter your final decision"
        autoFocus
      />

      {showRangeError && <p className="field-error" role="alert">{validation.error}</p>}

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
