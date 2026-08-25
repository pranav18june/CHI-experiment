import React, { useState } from 'react'
import NasaTlx, { NASA_TLX_DIMENSIONS } from '../questionnaires/NasaTlx.jsx'
import NumeracyScale from '../questionnaires/NumeracyScale.jsx'
import DomainExperience from '../questionnaires/DomainExperience.jsx'
import ExpertReliance from '../questionnaires/ExpertReliance.jsx'
import { scoreNumeracy, NUMERACY_ITEMS } from '../../config/numeracyScale.js'

const BASE_SECTIONS = [
  { id: 'tlx', title: 'Task Workload (NASA-TLX)', subtitle: 'Assess mental workload across the completed trials' },
  { id: 'numeracy', title: 'Quantitative Assessment', subtitle: 'A short validated numerical reasoning battery' },
  { id: 'domain', title: 'Domain Experience', subtitle: 'Background in supply chain and quantitative decision-making' },
]

// Appendix C.3 — experts additionally report how far they leaned on their own
// company's rules of thumb rather than the on-screen information.
const EXPERT_SECTION = {
  id: 'reliance',
  title: 'Basis for Your Decisions',
  subtitle: 'How you weighed your own experience against the on-screen information',
}

export default function PostTaskForm({ participantId, participantType = 'novice', onComplete }) {
  const isExpert = participantType === 'expert'
  const SECTIONS = isExpert ? [...BASE_SECTIONS, EXPERT_SECTION] : BASE_SECTIONS

  const [activeTab, setActiveTab] = useState('tlx')

  // NASA-TLX starts UNSET on every subscale. Seeding the sliders with plausible
  // values let a participant submit the instrument without touching it, and made
  // untouched responses indistinguishable from deliberate ones in the payload —
  // biasing the H5 workload means toward the seed values.
  const [tlxValues, setTlxValues] = useState({})
  const [numeracyValues, setNumeracyValues] = useState({})
  const [domainValues, setDomainValues] = useState({
    yearsExperience: '',
    primaryRole: '',
    decisionFrequency: '',
    certifications: '',
    feedback: '',
  })
  const [relianceValues, setRelianceValues] = useState({
    relianceOnOwnHeuristics: null,
    taskRealism: null,
    heuristicDescription: '',
  })

  // Validation
  const tlxComplete = NASA_TLX_DIMENSIONS.every((d) => tlxValues[d.id] != null)
  const numeracyComplete = NUMERACY_ITEMS.every((item) => {
    const val = numeracyValues[item.id]
    return val !== undefined && val !== ''
  })
  const domainComplete = Boolean(domainValues.yearsExperience && domainValues.primaryRole && domainValues.decisionFrequency)
  const relianceComplete = !isExpert || (
    relianceValues.relianceOnOwnHeuristics != null && relianceValues.taskRealism != null
  )

  const canSubmitAll = tlxComplete && numeracyComplete && domainComplete && relianceComplete

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmitAll) return

    const scoredNum = scoreNumeracy(numeracyValues)
    const tlxScores = { ...tlxValues }
    const rawTlxScore = Math.round(
      (tlxValues.mentalDemand +
        tlxValues.physicalDemand +
        tlxValues.temporalDemand +
        (100 - tlxValues.performance) + // Inverted so higher = more workload
        tlxValues.effort +
        tlxValues.frustration) /
        6
    )

    const payload = {
      nasaTlx: {
        dimensions: tlxScores,
        rawTlxAverage: rawTlxScore,
      },
      numeracy: {
        rawResponses: numeracyValues,
        scored: scoredNum,
      },
      domainExperience: domainValues,
      expertReliance: isExpert ? relianceValues : null,
      participantType,
      submittedAt: new Date().toISOString(),
    }

    onComplete(payload)
  }

  return (
    <main className="welcome-shell">
      <div className="wordmark">
        <span className="mark" />Decision Study
      </div>

      <div className="welcome-card consent-page" style={{ maxWidth: 840, padding: '24px 0 60px' }}>
        <p className="eyebrow">Protocol §5.11 &amp; Appendix C.3</p>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', marginBottom: 12 }}>
          Post-Task Questionnaire
        </h1>
        <p className="lede" style={{ marginBottom: 28 }}>
          Please complete the final workload, quantitative reasoning, and background questions below.
        </p>

        {/* Section Navigation Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${SECTIONS.length}, 1fr)`,
            gap: 8,
            marginBottom: 28,
          }}
        >
          {SECTIONS.map((sec, idx) => {
            const isActive = activeTab === sec.id
            let isSectionDone = false
            if (sec.id === 'tlx') isSectionDone = tlxComplete
            if (sec.id === 'numeracy') isSectionDone = numeracyComplete
            if (sec.id === 'domain') isSectionDone = domainComplete
            if (sec.id === 'reliance') isSectionDone = relianceComplete

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveTab(sec.id)}
                style={{
                  border: isActive ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: isActive ? '#fafbf7' : 'var(--surface)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: '600 11px var(--mono)', color: isActive ? 'var(--accent-dark)' : 'var(--muted)' }}>
                    Part {idx + 1}
                  </span>
                  {isSectionDone && (
                    <span style={{ color: '#15803d', font: '600 11px var(--mono)' }}>✓ Done</span>
                  )}
                </div>
                <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{sec.title}</strong>
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ── Section 1: NASA-TLX ── */}
          {activeTab === 'tlx' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>NASA Task Load Index (NASA-TLX)</h2>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Rate your overall experience across the 12 decision trials on each of the six workload subscales (0 to 100).
                </p>
              </div>
              <NasaTlx values={tlxValues} onChange={setTlxValues} />
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setActiveTab('numeracy')}
                >
                  Continue to Part 2: Numeracy →
                </button>
              </div>
            </div>
          )}

          {/* ── Section 2: Numeracy Scale ── */}
          {activeTab === 'numeracy' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>Quantitative Reasoning Assessment</h2>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Please answer each of the following mathematical and probabilistic questions to the best of your ability.
                </p>
              </div>
              <NumeracyScale values={numeracyValues} onChange={setNumeracyValues} />
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => setActiveTab('tlx')}
                >
                  ← Back to NASA-TLX
                </button>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setActiveTab('domain')}
                >
                  Continue to Part 3: Experience →
                </button>
              </div>
            </div>
          )}

          {/* ── Section 3: Domain Experience ── */}
          {activeTab === 'domain' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>Domain Experience &amp; Professional Background</h2>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Information regarding your background in supply chain management and operations research.
                </p>
              </div>
              <DomainExperience values={domainValues} onChange={setDomainValues} />
              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => setActiveTab('numeracy')}
                >
                  ← Back to Numeracy
                </button>
                {isExpert ? (
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => setActiveTab('reliance')}
                    style={{ minWidth: 220 }}
                  >
                    Continue to Part 4: Your Decisions →
                  </button>
                ) : (
                  <button
                    className="button primary"
                    type="submit"
                    disabled={!canSubmitAll}
                    style={{ minWidth: 220 }}
                  >
                    Submit &amp; Proceed to Debrief →
                  </button>
                )}
              </div>
            </div>
          )}
          {/* ── Section 4: Expert reliance (Appendix C.3, experts only) ── */}
          {isExpert && activeTab === 'reliance' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>Basis for Your Decisions</h2>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  These last questions ask how you approached the task as a practitioner.
                </p>
              </div>
              <ExpertReliance values={relianceValues} onChange={setRelianceValues} />
              <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => setActiveTab('domain')}
                >
                  ← Back to Experience
                </button>
                <button
                  className="button primary"
                  type="submit"
                  disabled={!canSubmitAll}
                  style={{ minWidth: 220 }}
                >
                  Submit &amp; Proceed to Debrief →
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="participant-code" style={{ marginTop: 32 }}>
          Participant Code: {participantId}
        </p>
      </div>
    </main>
  )
}
