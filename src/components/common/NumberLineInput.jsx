import React, { useId, useMemo, useState, useEffect } from 'react'
import { formatCurrency } from '../../utils/formatters.js'
import { normalizeNumericInput } from '../../services/validationService.js'
import { getScenarioScaleBounds } from '../../utils/numberLine.js'

export { getScenarioScaleBounds }

/**
 * NumberLineInput — Interactive Protocol §5.9 Number-Line & Slider Input
 *
 * Full WCAG 2.1 AA Accessible component:
 *   - Keyboard accessible (Arrow keys, Home, End, PageUp, PageDown)
 *   - ARIA labelled, valuetext formatted, and described by historical baseline
 *   - Synchronized direct numeric text input with inputMode="numeric"
 *
 * Props:
 *   - id: Element ID
 *   - value: Current string or numeric value
 *   - onChange: Callback invoked with string representation of the number
 *   - scenario: The current trial scenario object
 *   - placeholder: Placeholder for direct numeric input
 *   - autoFocus: Whether to auto-focus
 */
export default function NumberLineInput({
  id,
  value,
  onChange,
  scenario,
  placeholder = 'Select or enter estimate',
  autoFocus = false,
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const sliderId = `${inputId}-slider`
  const anchorDescId = `${inputId}-anchor-desc`

  const { min, max, step, anchor } = useMemo(() => getScenarioScaleBounds(scenario), [scenario])

  // Normalized numeric representation
  const numericVal = useMemo(() => {
    const num = normalizeNumericInput(value)
    return Number.isFinite(num) ? num : null
  }, [value])

  const [hasInteracted, setHasInteracted] = useState(numericVal !== null)

  useEffect(() => {
    if (numericVal !== null) {
      setHasInteracted(true)
    }
  }, [numericVal])

  // Slider position (percentage 0 to 100)
  const currentPct = useMemo(() => {
    if (numericVal === null) return 50
    const clamped = Math.max(min, Math.min(max, numericVal))
    return Math.round(((clamped - min) / (max - min)) * 100)
  }, [numericVal, min, max])

  function handleSliderChange(e) {
    setHasInteracted(true)
    const val = Number(e.target.value)
    onChange(String(val))
  }

  function handleTextChange(e) {
    setHasInteracted(true)
    onChange(e.target.value)
  }

  // Keyboard navigation enhancement
  function handleKeyDown(e) {
    let current = numericVal ?? min + (max - min) / 2
    let next = null

    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = Math.max(min, current - step)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = Math.min(max, current + step)
    } else if (e.key === 'PageDown') {
      next = Math.max(min, current - step * 5)
    } else if (e.key === 'PageUp') {
      next = Math.min(max, current + step * 5)
    } else if (e.key === 'Home') {
      next = min
    } else if (e.key === 'End') {
      next = max
    }

    if (next !== null) {
      e.preventDefault()
      setHasInteracted(true)
      onChange(String(next))
    }
  }

  // Generate 5 evenly spaced tick marks for the scale
  const ticks = useMemo(() => {
    const count = 5
    const list = []
    for (let i = 0; i < count; i++) {
      const v = min + Math.round(((max - min) * i) / (count - 1))
      list.push({ val: v, pct: Math.round((i / (count - 1)) * 100) })
    }
    return list
  }, [min, max])

  const formattedValueText = numericVal !== null
    ? `$${numericVal.toLocaleString()}`
    : 'No estimate set'

  return (
    <div className="number-line-component">
      {/* ── Direct Numeric Input Row ── */}
      <div className="number-line-header">
        <div className="money-input" style={{ width: '100%' }}>
          <span aria-hidden="true">$</span>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            value={value || ''}
            onChange={handleTextChange}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            aria-label="Direct numeric input for decision estimate"
            aria-describedby={anchor !== null ? anchorDescId : undefined}
          />
        </div>
      </div>

      {/* ── Screen-reader Baseline Description ── */}
      {anchor !== null && (
        <span id={anchorDescId} className="sr-only" style={{ display: 'none' }}>
          Historical baseline for this product is {formatCurrency(anchor)}.
        </span>
      )}

      {/* ── Interactive Number Line Track ── */}
      <div className="number-line-track-wrap">
        <div className="number-line-track">
          {/* Active Fill Bar */}
          {hasInteracted && numericVal !== null && (
            <div
              className="number-line-fill"
              style={{ width: `${Math.max(0, Math.min(100, currentPct))}%` }}
              aria-hidden="true"
            />
          )}

          {/* Historical Baseline Marker */}
          {anchor !== null && (
            <div
              className="number-line-anchor"
              style={{ left: `${((anchor - min) / (max - min)) * 100}%` }}
              title={`Historical baseline: ${formatCurrency(anchor)}`}
              aria-hidden="true"
            >
              <span className="number-line-anchor-label">Baseline</span>
            </div>
          )}

          {/* Fully Accessible Native Range Slider */}
          <input
            id={sliderId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={numericVal ?? min + (max - min) / 2}
            onChange={handleSliderChange}
            onKeyDown={handleKeyDown}
            className="number-line-slider"
            role="slider"
            aria-label="Interactive decision estimate number-line slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={numericVal ?? min + (max - min) / 2}
            aria-valuetext={formattedValueText}
            aria-describedby={anchor !== null ? anchorDescId : undefined}
          />
        </div>

        {/* ── Ticks and Bounds Labels ── */}
        <div className="number-line-ticks" aria-hidden="true">
          {ticks.map((t, idx) => (
            <div
              key={idx}
              className="number-line-tick"
              style={{ left: `${t.pct}%` }}
            >
              <span className="tick-mark" />
              <span className="tick-label">{formatCurrency(t.val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
