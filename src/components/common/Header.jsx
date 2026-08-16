import React from 'react'

/**
 * Reusable Study Progress Header.
 */
export function Header({ trialNumber, totalTrials, progress, isPractice, trialStep, condition, surveyMode }) {
  const activeCondition = condition || surveyMode

  return (
    <header className="study-header">
      <div className="wordmark">
        <span className="mark" />Decision Study
      </div>
      <div className="trial-status">
        {isPractice && <span className="practice-label">Practice</span>}
        <span>
          {isPractice ? 'Practice' : 'Decision'} {trialNumber} of {totalTrials}
        </span>
        <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
          <i style={{ width: `${progress}%` }} />
        </div>
        {trialStep != null && (
          <div className="step-pip-row" aria-label={`Step ${trialStep} of 4`}>
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`step-pip${s === trialStep ? ' active' : s < trialStep ? ' done' : ''}`}
              />
            ))}
          </div>
        )}
      </div>
      {activeCondition ? (
        <span className="mode-badge" aria-label={`Condition ${activeCondition}`}>
          Condition: {String(activeCondition).toUpperCase()}
        </span>
      ) : (
        <button className="quiet-button" type="button" title="Study support placeholder">
          Need help?
        </button>
      )}
    </header>
  )
}

export default Header
