import React from 'react'

/**
 * Reusable Choice List Selector for single-select option buttons.
 */
export function ChoiceList({ options, selected, onSelect }) {
  return (
    <div className="choice-list" role="radiogroup">
      {options.map(({ value, label, subtext }, idx) => {
        const letter = String.fromCharCode(65 + idx)
        const isSelected = selected === value

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={isSelected ? 'choice selected' : 'choice'}
            onClick={() => onSelect(value)}
          >
            <span>{letter}</span>
            <div>
              <strong>{label}</strong>
              {subtext && (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)', fontWeight: 400 }}>
                  {subtext}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ChoiceList
