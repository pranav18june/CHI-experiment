import React from 'react'
import { Step1, Step2, Step3, Step4 } from './TrialSteps.jsx'
import { formatCurrency } from '../../utils/formatters.js'
import { scenarios } from '../../scenarios/index.js'

export function TrialShell({
  trial, type, trialStep, condition, explanation, fetchedAdvice, isFetchingAdvice,
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
  const showDrivers = condition === 'c1'
  // SECURE ANCHORING FIX: AI recommendation is ONLY rendered when trialStep >= 2 AND fetchedAdvice is available.
  const showRecommendation = trialStep >= 2 && fetchedAdvice != null

  const title = trial.title || trial.store
  const category = trial.category || trial.department
  const profile = trial.description || trial.profile
  const chartHint = trial.chart?.hint || trial.chartHint
  const recAmount = fetchedAdvice ?? (typeof trial.recommendation === 'object' ? (trial.recommendation.active ?? trial.recommendation.correct) : trial.recommendation)

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
            <div className="chart-placeholder">
              <div className="axis y"><span>higher</span><span>lower</span></div>
              <div className="grid-lines"><i /><i /><i /><i /><i /></div>
              {/* Show per-scenario image when available (user-supplied images named 1.png..12.png) */}
              {
                (() => {
                  const idx = scenarios.findIndex((s) => s.id === trial.id)
                  const imageOrder = idx >= 0 ? idx + 1 : null
                  const imageSrc = imageOrder ? `/graphs/${imageOrder}.png` : null
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
            <p className="chart-footnote">The final study will display the real historical series supplied by the research dataset.</p>
          </section>

          {trial.historicalStatistic && (
            <section className="card surfaced-statistic-card">
              <span className="stat-label">{trial.historicalStatistic.label}</span>
              <strong className="stat-value">{trial.historicalStatistic.value}</strong>
            </section>
          )}

          {showDrivers && trial.drivers && trial.drivers.length > 0 && (
            <section className="card drivers-card">
              <div className="card-heading">
                <div>
                  <h2>Factors historically associated with sales</h2>
                  <p>Observed correlations, not a predictive model</p>
                </div>
              </div>
              <div className="driver-list">
                {trial.drivers.map((driver, idx) => {
                  const name = Array.isArray(driver) ? driver[0] : driver.name
                  const value = Array.isArray(driver) ? driver[1] : driver.weight
                  return (
                    <div key={name || idx}>
                      <span>{name}</span>
                      <strong>{value}</strong>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
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
