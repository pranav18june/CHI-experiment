import React from 'react'

/**
 * Reusable Study Progress Header.
 */
export function Header({ trialNumber, totalTrials, progress, isPractice, trialStep }) {
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
      {/*
        The condition label is deliberately NOT shown. It named the participant's
        experimental cell on every trial screen, which is a manipulation cue in a
        between-subjects design. It remains in the telemetry and the admin
        dashboard, where it belongs.
      */}
    </header>
  )
}

export default Header
