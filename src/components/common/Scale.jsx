import React from 'react'

/**
 * Reusable Likert rating scale (1 to 7).
 * Ensures buttons have type="button" and proper aria labels.
 */
export function Scale({ label, low, high, selected, onSelect }) {
  return (
    <div className="scale">
      <h2>{label}</h2>
      <div className="scale-values" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected === n}
            aria-label={`${n} out of 7`}
            className={selected === n ? 'active' : ''}
            onClick={() => onSelect(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale-labels">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

export default Scale
