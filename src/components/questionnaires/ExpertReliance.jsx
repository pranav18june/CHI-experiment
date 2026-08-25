import React from 'react'

/**
 * Expert reliance item (Protocol Appendix C.3, §11)
 *
 * "For experts, an item measuring how much they relied on their own company's
 * rules of thumb vs. the on-screen information."
 *
 * §11 names this as the measure for the deferred expert-engagement risk: whether
 * practising planners take the task premise seriously or fall back on company
 * heuristics. Shown to the expert group only — asking novices about company
 * rules of thumb would be meaningless and would not be comparable.
 */
export const EXPERT_RELIANCE_SCALE = [
  { value: 1, label: 'Entirely my own / my company’s rules of thumb' },
  { value: 2, label: 'Mostly my own rules of thumb' },
  { value: 3, label: 'Somewhat more my own rules of thumb' },
  { value: 4, label: 'An even mix of both' },
  { value: 5, label: 'Somewhat more the on-screen information' },
  { value: 6, label: 'Mostly the on-screen information' },
  { value: 7, label: 'Entirely the on-screen information' },
]

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '18px 20px',
}

export default function ExpertReliance({ values, onChange }) {
  function handleChange(field, val) {
    onChange({ ...values, [field]: val })
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={CARD}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          1. Basis for your decisions
        </label>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)' }}>
          Across the decisions you just made, how much did you rely on the rules of thumb you use in
          your own work, compared with the information shown on screen?
        </p>
        <div className="choice-list" style={{ margin: 0, gap: 6 }}>
          {EXPERT_RELIANCE_SCALE.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={values.relianceOnOwnHeuristics === opt.value ? 'choice selected' : 'choice'}
              onClick={() => handleChange('relianceOnOwnHeuristics', opt.value)}
              style={{ padding: '10px 14px', fontSize: 13 }}
            >
              <span style={{ width: 20, height: 20, fontSize: 10 }}>
                {values.relianceOnOwnHeuristics === opt.value ? '✓' : ''}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          2. Resemblance to your real work
        </label>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)' }}>
          How closely did these decisions resemble the buffer and order decisions you make in practice?
        </p>
        <div className="choice-list" style={{ margin: 0, gap: 6 }}>
          {[
            { value: 1, label: 'Not at all like my work' },
            { value: 2, label: 'Slightly like my work' },
            { value: 3, label: 'Somewhat like my work' },
            { value: 4, label: 'Quite like my work' },
            { value: 5, label: 'Very much like my work' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={values.taskRealism === opt.value ? 'choice selected' : 'choice'}
              onClick={() => handleChange('taskRealism', opt.value)}
              style={{ padding: '10px 14px', fontSize: 13 }}
            >
              <span style={{ width: 20, height: 20, fontSize: 10 }}>
                {values.taskRealism === opt.value ? '✓' : ''}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          3. The rule you applied (optional)
        </label>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          If you applied a specific rule of thumb from your own work, please describe it briefly.
        </p>
        <textarea
          rows={3}
          value={values.heuristicDescription || ''}
          onChange={(e) => handleChange('heuristicDescription', e.target.value)}
          placeholder="e.g. we hold two weeks of cover on this category…"
          style={{
            width: '100%', border: '1px solid var(--line)', borderRadius: 6,
            padding: '8px 10px', fontSize: 13.5, fontFamily: 'var(--sans)', background: 'var(--surface)',
          }}
        />
      </div>
    </div>
  )
}
