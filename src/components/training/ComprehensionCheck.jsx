import React, { useState } from 'react'

/**
 * Protocol Appendix C.1 — 4-Item Novice Comprehension Check
 *
 * Items:
 *   1. Volatility → Buffer size direction
 *   2. Order-above-average for cost-asymmetric peak orders
 *   3. Asymmetric cost structure (stockout costs > overstock costs)
 *   4. Interface item identifying when/where AI recommendation appears
 *
 * Rules:
 *   - Must score 4/4 to pass.
 *   - Attempt 1 failure: Allow exactly 1 retry with review feedback (Attempt 2 of 2).
 *   - Attempt 2 failure: Pre-registered exclusion (routes to exclusion screen).
 */
export const COMPREHENSION_ITEMS = [
  {
    id: 'q1_volatility',
    number: '01',
    topic: 'Demand Volatility & Buffer Size',
    question:
      'When demand volatility (the size and frequency of unpredictable demand swings) increases for a product category, how should the safety stock buffer change?',
    options: [
      {
        value: 'increase',
        label: 'The buffer should increase (be set higher) to protect against larger unexpected swings.',
      },
      {
        value: 'decrease',
        label: 'The buffer should decrease (be set lower) because volatility reduces stockout risk.',
      },
      {
        value: 'no_change',
        label: 'The buffer should remain unchanged because volatility does not affect buffer requirements.',
      },
    ],
    correctValue: 'increase',
    explanation:
      'Higher demand volatility means larger swings, requiring a larger buffer to safeguard against stockouts.',
  },
  {
    id: 'q2_peak_order',
    number: '02',
    topic: 'One-Shot Peak-Week Orders',
    question:
      'In a peak-week ordering decision where customer demand is uncertain and profit margins on holiday sales are high, how should the optimal order quantity compare to average historical demand?',
    options: [
      {
        value: 'above_avg',
        label: 'It should generally be set higher than the historical average demand to capture profitable holiday sales.',
      },
      {
        value: 'below_avg',
        label: 'It should always be set strictly below historical average demand to avoid any risk of leftover inventory.',
      },
      {
        value: 'exact_min',
        label: 'It must always equal the lowest historical demand observation.',
      },
    ],
    correctValue: 'above_avg',
    explanation:
      'When holiday margins are high and stockouts are costly, the cost-optimal order is above average demand.',
  },
  {
    id: 'q3_asymmetric_cost',
    number: '03',
    topic: 'Cost Asymmetry: Stockouts vs. Excess Inventory',
    question:
      'Under the supply chain inventory economics used in this study, which type of decision error is more costly to the business?',
    options: [
      {
        value: 'stockout_costly',
        label: 'Running out of stock (under-ordering / under-buffering) is more costly than holding moderate excess inventory.',
      },
      {
        value: 'holding_costly',
        label: 'Holding excess inventory is far more costly than losing sales due to stockouts.',
      },
      {
        value: 'equal_cost',
        label: 'Both errors carry identical symmetric costs in all situations.',
      },
    ],
    correctValue: 'stockout_costly',
    explanation:
      'Stockouts and lost sales carry an asymmetric penalty (~1.85×) compared to moderate holding costs.',
  },
  {
    id: 'q4_interface_sequence',
    number: '04',
    topic: 'Decision Sequence & AI Advice',
    question:
      'During each decision trial, when and where does the AI recommendation and explanation appear on screen?',
    options: [
      {
        value: 'step2_after_initial',
        label: 'In Step 2 on the right-hand panel, only after you enter and submit your initial independent estimate.',
      },
      {
        value: 'step1_before_data',
        label: 'In Step 1 before you inspect any charts or historical statistics.',
      },
      {
        value: 'post_study_only',
        label: 'Only at the very end of the study after all 12 scored trials are completed.',
      },
    ],
    correctValue: 'step2_after_initial',
    explanation:
      'You will always form an initial independent estimate in Step 1 before the AI advice is revealed in Step 2.',
  },
]

export default function ComprehensionCheck({ onPass, onFail, onExclude }) {
  const [answers, setAnswers] = useState({})
  const [attempt, setAttempt] = useState(1)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  const allAnswered = COMPREHENSION_ITEMS.every((item) => answers[item.id] != null)

  function handleSelect(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function handleSubmit() {
    if (!allAnswered) return

    let correctCount = 0
    for (const item of COMPREHENSION_ITEMS) {
      if (answers[item.id] === item.correctValue) {
        correctCount++
      }
    }

    setScore(correctCount)
    setHasSubmitted(true)

    if (correctCount === COMPREHENSION_ITEMS.length) {
      // 4/4 Correct -> Passed!
      onPass({ attempt, score: correctCount, answers })
    } else {
      // Allow retry or review without blocking
      onFail({ attempt, score: correctCount, answers })
    }
  }

  function handleRetry() {
    setAttempt((prev) => prev + 1)
    setAnswers({})
    setHasSubmitted(false)
    setScore(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="intro-shell">
      <div className="wordmark">
        <span className="mark" />Decision Study
      </div>

      <section className="check-card" style={{ width: 'min(100%, 740px)', padding: '36px 0' }}>
        <p className="eyebrow">Comprehension Check · Protocol Appendix C.1</p>
        <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', marginBottom: 8 }}>
          Understanding the Task
        </h1>
        <p className="lede" style={{ marginBottom: 28 }}>
          Please answer all 4 questions below to verify key concepts before proceeding to the practice round.
        </p>

        {/* Banner if Attempt 1 was missed */}
        {hasSubmitted && score < COMPREHENSION_ITEMS.length && attempt === 1 && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 28,
              color: '#92400e',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 15 }}>
              Score: {score} / {COMPREHENSION_ITEMS.length} correct
            </strong>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              Review the questions below. You can try again or proceed to the practice tasks.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button
                className="button primary"
                type="button"
                onClick={handleRetry}
                style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }}
              >
                Try Again ↺
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => onPass({ attempt, score, answers })}
                style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }}
              >
                Proceed to Practice Tasks →
              </button>
            </div>
          </div>
        )}

        {/* Banner if Attempt 2+ was missed */}
        {hasSubmitted && score < COMPREHENSION_ITEMS.length && attempt >= 2 && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 28,
              color: '#1e40af',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4, fontSize: 15 }}>
              Score: {score} / {COMPREHENSION_ITEMS.length}
            </strong>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              Review the questions below. You can proceed directly to the practice tasks now.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button
                className="button primary"
                type="button"
                onClick={() => onPass({ attempt, score, answers })}
                style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }}
              >
                Proceed to Practice Tasks →
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={handleRetry}
                style={{ minHeight: 40, padding: '0 16px', fontSize: 13 }}
              >
                Try Again ↺
              </button>
            </div>
          </div>
        )}

        {/* ── Question Items ── */}
        <div style={{ display: 'grid', gap: 28 }}>
          {COMPREHENSION_ITEMS.map((item) => {
            const selectedVal = answers[item.id]
            const isMissedOnSubmit = hasSubmitted && selectedVal !== item.correctValue

            return (
              <article
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: isMissedOnSubmit ? '1.5px solid #f87171' : '1px solid var(--line)',
                  borderRadius: 9,
                  padding: '22px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      font: '600 11px var(--mono)',
                      color: 'var(--accent-dark)',
                      background: 'var(--accent-light)',
                      padding: '2px 7px',
                      borderRadius: 4,
                    }}
                  >
                    Question {item.number}
                  </span>
                  <span style={{ font: '500 12px var(--sans)', color: 'var(--muted)' }}>
                    {item.topic}
                  </span>
                </div>

                <h2 style={{ fontSize: 16, lineHeight: 1.45, margin: '0 0 16px', color: 'var(--ink)' }}>
                  {item.question}
                </h2>

                <div className="choice-list" style={{ margin: 0, gap: 8 }}>
                  {item.options.map((opt) => {
                    const isSelected = selectedVal === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={isSelected ? 'choice selected' : 'choice'}
                        onClick={() => handleSelect(item.id, opt.value)}
                        disabled={hasSubmitted && score === COMPREHENSION_ITEMS.length}
                        style={{ padding: '12px 14px', fontSize: 13.5 }}
                      >
                        <span style={{ width: 22, height: 22, fontSize: 10 }}>
                          {isSelected ? '✓' : ''}
                        </span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>

        {/* Submit Action */}
        {(!hasSubmitted || attempt === 2) && (
          <div style={{ marginTop: 32 }}>
            <button
              className="button primary full"
              type="button"
              disabled={!allAnswered}
              onClick={handleSubmit}
            >
              Submit Comprehension Check →
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
