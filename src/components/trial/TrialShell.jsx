import React, { useEffect, useRef } from 'react'
import { Step1, Step2, Step3, Step4 } from './TrialSteps.jsx'
import { formatCurrency } from '../../utils/formatters.js'
import telemetry from '../../telemetry.js'

/**
 * Counts chart revisits (Appendix C.4).
 *
 * A "revisit" is the chart re-entering view after having left it, plus any
 * direct interaction with it. The first appearance is not a revisit.
 */
function useChartRevisitTracking(trialId) {
  const chartRef = useRef(null)
  const wasVisible = useRef(false)
  const hasAppearedOnce = useRef(false)

  useEffect(() => {
    const node = chartRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    // Reset per trial: revisits are counted within a trial, not across the session.
    wasVisible.current = false
    hasAppearedOnce.current = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0.4
        const returned = visible && !wasVisible.current

        if (returned) {
          if (hasAppearedOnce.current) {
            telemetry.recordChartRevisit({ trialId })
          } else {
            hasAppearedOnce.current = true // the first appearance is not a revisit
          }
        }
        wasVisible.current = visible
      },
      { threshold: [0, 0.4, 1] }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [trialId])

  return chartRef
}

export function TrialShell({
  trial, type, trialStep, condition, explanation, fetchedAdvice, isFetchingAdvice,
  adviceError, onRetryAdvice,
  // Step 1
  initialEstimate, onInitialEstimate, initialConfidence, onInitialConfidence, onSubmitStep1,
  // Step 2
  onAcknowledgeAI,
  // Step 3
  verificationResponse, onVerification, onSubmitStep3,
  // Step 4
  finalEstimate, onFinalEstimate, finalConfidence, onFinalConfidence,
  cognitiveLoad, onCognitiveLoad, onSubmitStep4,
}) {
  // SECURE ANCHORING FIX: AI recommendation is ONLY rendered when trialStep >= 2 AND fetchedAdvice is available.
  const showRecommendation = trialStep >= 2 && fetchedAdvice != null && !adviceError

  const title = trial.title || trial.store
  const category = trial.category || trial.department
  const profile = trial.description || trial.profile
  const chartHint = trial.chart?.hint || trial.chartHint
  const recAmount = fetchedAdvice ?? (typeof trial.recommendation === 'object' ? (trial.recommendation.active ?? trial.recommendation.correct) : trial.recommendation)
  const chartRef = useChartRevisitTracking(trial.id)

  return (
    <section className="trial-layout">
      <div className="trial-title">
        <div>
          <p className="eyebrow">{type.shortLabel || trial.shortLabel}</p>
          <h1>{title} · {category}</h1>
        </div>
        <span className="profile-pill">{profile}</span>
      </div>

      <div className="trial-grid">
        {/* Left Column: Historical Data */}
        <div className="data-area">
          <section className="card chart-card">
            <div className="card-heading">
              <div>
                <h2>{type.chartLabel || trial.chart?.label}</h2>
                <p>Store and product category</p>
              </div>
              <span className="data-source">Historical data</span>
            </div>
            <div
              className="chart-placeholder"
              ref={chartRef}
              onPointerDown={() => telemetry.recordChartRevisit({ trialId: trial.id, via: 'interaction' })}
            >
              <div className="axis y"><span>higher</span><span>lower</span></div>
              <div className="grid-lines"><i /><i /><i /><i /><i /></div>
              {/* Chart asset resolved from the scenario itself (see chartImage). */}
              {
                (() => {
                  const imageSrc = trial.chartImage || null
                  if (imageSrc) {
                    return (
                      <img
                        src={imageSrc}
                        alt={`Historical data for ${title}`}
                        className="chart-image"
                      />
                    )
                  }
                  return (
                    <div className="placeholder-pulse">
                      <span>Data visualization</span>
                      <p>{chartHint}</p>
                    </div>
                  )
                })()
              }
              <div className="axis x"><span>Earlier</span><span>Most recent</span></div>
            </div>
          </section>

          {trial.historicalStatistic && (
            <section className="card surfaced-statistic-card">
              <span className="stat-label">{trial.historicalStatistic.label}</span>
              <strong className="stat-value">{trial.historicalStatistic.value}</strong>
            </section>
          )}

          {/*
            C1's driver attributions are an explanation layer, not base information:
            §5.9 reveals the AI recommendation and the condition's explanation only at
            Step 2. They render in the decision column (see Step2) so the Step-1
            independent estimate stays independent — and comparable to C0/C2/C3.
          */}
        </div>

        {/* Right Column: Decision Flow */}
        <aside className="decision-area">
          {showRecommendation && (
            <section className="recommendation">
              <p className="eyebrow">AI recommendation</p>
              <p className="amount">{formatCurrency(recAmount)}</p>
              <p>The suggested {(type.decisionLabel || trial.decisionLabel || '').toLowerCase()} for this scenario.</p>
            </section>
          )}

          {trialStep === 1 && (
            <Step1
              type={type}
              trial={trial}
              initialEstimate={initialEstimate}
              onInitialEstimate={onInitialEstimate}
              initialConfidence={initialConfidence}
              onInitialConfidence={onInitialConfidence}
              onSubmit={onSubmitStep1}
            />
          )}

          {trialStep === 2 && (
            <Step2
              condition={condition}
              explanation={explanation}
              onContinue={onAcknowledgeAI}
              isFetchingAdvice={isFetchingAdvice}
              adviceError={adviceError}
              onRetryAdvice={onRetryAdvice}
            />
          )}

          {trialStep === 3 && (
            <Step3
              verificationResponse={verificationResponse}
              onVerification={onVerification}
              onSubmit={onSubmitStep3}
            />
          )}

          {trialStep === 4 && (
            <Step4
              type={type}
              trial={trial}
              finalEstimate={finalEstimate}
              onFinalEstimate={onFinalEstimate}
              finalConfidence={finalConfidence}
              onFinalConfidence={onFinalConfidence}
              cognitiveLoad={cognitiveLoad}
              onCognitiveLoad={onCognitiveLoad}
              onSubmit={onSubmitStep4}
            />
          )}
        </aside>
      </div>
    </section>
  )
}

export default TrialShell
