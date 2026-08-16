import React from 'react'
import { NUMERACY_ITEMS } from '../../config/numeracyScale.js'

export default function NumeracyScale({ values, onChange }) {
  function handleTextChange(id, val) {
    onChange({ ...values, [id]: val })
  }

  function handleLikertChange(id, score) {
    onChange({ ...values, [id]: Number(score) })
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {NUMERACY_ITEMS.map((item) => {
        const currentVal = values[item.id] ?? ''

        if (item.type === 'likert') {
          return (
            <div
              key={item.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '18px 20px',
              }}
            >
              <strong style={{ display: 'block', fontSize: 15, marginBottom: 6, color: 'var(--ink)' }}>
                {item.label}
              </strong>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
                {item.prompt}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                  const isSelected = currentVal === num
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleLikertChange(item.id, num)}
                      style={{
                        height: 42,
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                        background: isSelected ? 'var(--accent)' : 'var(--surface)',
                        color: isSelected ? '#fff' : 'var(--ink)',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontFamily: 'var(--mono)',
                        cursor: 'pointer',
                        transition: '.15s ease',
                      }}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontFamily: 'var(--sans)',
                  color: 'var(--muted)',
                }}
              >
                <span>{item.lowLabel}</span>
                <span>{item.highLabel}</span>
              </div>
            </div>
          )
        }

        return (
          <div
            key={item.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '18px 20px',
            }}
          >
            <strong style={{ display: 'block', fontSize: 15, marginBottom: 6, color: 'var(--ink)' }}>
              {item.label}
            </strong>
            <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
              {item.prompt}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 360 }}>
              <input
                type="text"
                value={currentVal}
                onChange={(e) => handleTextChange(item.id, e.target.value)}
                placeholder={item.placeholder}
                style={{
                  flex: 1,
                  height: 44,
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: '0 12px',
                  fontSize: 15,
                  fontFamily: 'var(--mono)',
                  background: 'var(--surface)',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {item.unit}
              </span>
            </div>
            {item.hint && (
              <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                {item.hint}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
