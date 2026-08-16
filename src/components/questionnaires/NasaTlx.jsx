import React from 'react'

export const NASA_TLX_DIMENSIONS = [
  {
    id: 'mentalDemand',
    title: 'Mental Demand',
    prompt: 'How mentally demanding was the decision task (e.g. thinking, deciding, calculating, remembering, searching)?',
    low: 'Very Low (0)',
    high: 'Very High (100)',
  },
  {
    id: 'physicalDemand',
    title: 'Physical Demand',
    prompt: 'How physically demanding was the task (e.g. clicking, typing, turning, navigating)?',
    low: 'Very Low (0)',
    high: 'Very High (100)',
  },
  {
    id: 'temporalDemand',
    title: 'Temporal Demand',
    prompt: 'How hurried or rushed was the pace of the decision task?',
    low: 'Very Low (0)',
    high: 'Very High (100)',
  },
  {
    id: 'performance',
    title: 'Self-Rated Performance',
    prompt: 'How successful do you think you were in accomplishing the goals of the decision tasks?',
    low: 'Poor (0)',
    high: 'Good / Perfect (100)',
  },
  {
    id: 'effort',
    title: 'Overall Effort',
    prompt: 'How hard did you have to work (mentally and physically) to accomplish your level of performance?',
    low: 'Very Low (0)',
    high: 'Very High (100)',
  },
  {
    id: 'frustration',
    title: 'Frustration Level',
    prompt: 'How insecure, discouraged, irritated, stressed, or annoyed did you feel during the tasks?',
    low: 'Very Low (0)',
    high: 'Very High (100)',
  },
]

export default function NasaTlx({ values, onChange }) {
  function handleSlider(dimId, val) {
    onChange({ ...values, [dimId]: Number(val) })
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {NASA_TLX_DIMENSIONS.map((dim) => {
        const current = values[dim.id] ?? 50
        const isTouched = values[dim.id] != null

        return (
          <div
            key={dim.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 15, color: 'var(--ink)' }}>{dim.title}</strong>
              <span
                style={{
                  font: '600 13px var(--mono)',
                  color: isTouched ? 'var(--accent-dark)' : 'var(--muted)',
                  background: isTouched ? 'var(--accent-light)' : 'var(--soft)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                {isTouched ? current : '—'}
              </span>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
              {dim.prompt}
            </p>

            <div style={{ position: 'relative', padding: '0 4px' }}>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={current}
                onChange={(e) => handleSlider(dim.id, e.target.value)}
                style={{
                  width: '100%',
                  height: 8,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 6,
                  fontSize: 11,
                  fontFamily: 'var(--mono)',
                  color: 'var(--muted)',
                }}
              >
                <span>{dim.low}</span>
                <span>50</span>
                <span>{dim.high}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
