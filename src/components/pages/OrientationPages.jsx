import React, { useState } from 'react'
import ChoiceList from '../common/ChoiceList.jsx'

export function WelcomeScreen({ participantId, onStart }) {
  const [demographics, setDemographics] = useState({
    programme: '',
    studyYear: '',
    supplyChainExperience: '',
    aiUse: '',
    gender: '',
    age: '',
  })
  const [consents, setConsents] = useState({ information: false, voluntary: false, dataUse: false })
  const isComplete = Object.values(demographics).every(Boolean) && Object.values(consents).every(Boolean)

  function updateDemographic(event) {
    setDemographics((values) => ({ ...values, [event.target.name]: event.target.value }))
  }

  function submitConsent(event) {
    event.preventDefault()
    if (isComplete) onStart(demographics)
  }

  return (
    <main className="welcome-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <form className="welcome-card consent-page" onSubmit={submitConsent}>
        <p className="eyebrow">Supply chain decision research</p>
        <h1>Participant information &amp; consent</h1>
        <p className="lede">Please read carefully before proceeding.</p>
        <section className="consent-copy">
          <h2>About this study</h2>
          <p>This study investigates how people make supply chain inventory decisions when presented with AI recommendations in different formats. You will review historical sales information and choose the inventory amount you would set.</p>
          <ul>
            <li><strong>Duration:</strong> approximately 20–25 minutes.</li>
            <li><strong>Task:</strong> twelve inventory decisions across four scenario types, with confidence and effort ratings after each decision.</li>
            <li><strong>Incentive:</strong> [TODO_INCENTIVE_COPY: participant compensation or course-credit information will appear here.]</li>
          </ul>
          <h2>Your rights</h2>
          <p>Participation is voluntary. You may stop at any time before submitting your responses, without penalty. The decision task does not ask for your name, email address, or other direct identifier; responses are linked only to a study code.</p>
          <p>[TODO_ETHICS_COPY: approved data-use, retention, withdrawal, study-contact, and ethics-review information will appear here.]</p>
        </section>
        <section className="demographics-section">
          <h2>Background information</h2>
          <p className="section-intro">These questions help us understand the range of experience represented in the study. Choose &ldquo;Prefer not to say&rdquo; where available.</p>
          <div className="demographics-grid">
            <Field label="Programme of study">
              <select name="programme" value={demographics.programme} onChange={updateDemographic} required>
                <option value="">Select…</option>
                <option>Business / management</option>
                <option>Engineering / operations</option>
                <option>Data / computer science</option>
                <option>Other programme</option>
              </select>
            </Field>
            <Field label="Year or level of study">
              <select name="studyYear" value={demographics.studyYear} onChange={updateDemographic} required>
                <option value="">Select…</option>
                <option>First year</option>
                <option>Second year</option>
                <option>Third year</option>
                <option>Fourth year or above</option>
                <option>Postgraduate</option>
                <option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Prior supply chain coursework">
              <select name="supplyChainExperience" value={demographics.supplyChainExperience} onChange={updateDemographic} required>
                <option value="">Select…</option>
                <option>None</option>
                <option>Introductory course</option>
                <option>More than one course</option>
                <option>Professional experience</option>
                <option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Frequency of AI tool use">
              <select name="aiUse" value={demographics.aiUse} onChange={updateDemographic} required>
                <option value="">Select…</option>
                <option>Never</option>
                <option>Less than monthly</option>
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Daily or almost daily</option>
                <option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Gender">
              <select name="gender" value={demographics.gender} onChange={updateDemographic} required>
                <option value="">Select…</option>
                <option>Woman</option>
                <option>Man</option>
                <option>Non-binary</option>
                <option>Self-describe</option>
                <option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Age">
              <input name="age" type="number" inputMode="numeric" min="16" max="120" value={demographics.age} onChange={updateDemographic} required placeholder="Enter age" />
            </Field>
          </div>
        </section>
        <fieldset className="consent-declaration">
          <legend>Consent declaration</legend>
          <label>
            <input type="checkbox" checked={consents.information} onChange={(e) => setConsents((v) => ({ ...v, information: e.target.checked }))} />
            I have read and understood the participant information above.
          </label>
          <label>
            <input type="checkbox" checked={consents.voluntary} onChange={(e) => setConsents((v) => ({ ...v, voluntary: e.target.checked }))} />
            I understand that participation is voluntary and that I may stop at any time before submitting my responses.
          </label>
          <label>
            <input type="checkbox" checked={consents.dataUse} onChange={(e) => setConsents((v) => ({ ...v, dataUse: e.target.checked }))} />
            I consent to my anonymised responses being used for academic research.
          </label>
        </fieldset>
        <button className="button primary full" type="submit" disabled={!isComplete}>
          I consent — begin study <span>→</span>
        </button>
        <p className="participant-code">Session code: {participantId}</p>
      </form>
      <p className="quiet-footer">Your responses are recorded under a study code, not your name.</p>
    </main>
  )
}

function Field({ label, children }) {
  return <label className="demographic-field"><span>{label}</span>{children}</label>
}

export function ParticipantTypeSelect({ onSelect }) {
  const [selected, setSelected] = useState(null)

  const options = [
    {
      value: 'novice',
      label: 'Student / Learner',
      subtext: 'I am studying supply chain management, operations, or a related subject.',
    },
    {
      value: 'expert',
      label: 'Supply chain professional',
      subtext: 'I work in supply chain, logistics, inventory management, or a related field.',
    },
  ]

  return (
    <main className="intro-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="check-card">
        <p className="eyebrow">Before we begin</p>
        <h1>What best describes you?</h1>
        <p className="lede">This helps us personalise the study experience.</p>
        <ChoiceList options={options} selected={selected} onSelect={setSelected} />
        <button
          className="button primary"
          type="button"
          disabled={!selected}
          onClick={() => onSelect(selected)}
        >
          Continue <span>→</span>
        </button>
      </section>
    </main>
  )
}

export function Workshop({ onContinue, items }) {
  return (
    <main className="intro-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="intro-content">
        <p className="eyebrow">Before you begin</p>
        <h1>A quick orientation</h1>
        <p className="lede">This walkthrough explains what you will see. It does not teach a formula or a correct way to decide.</p>
        <div className="workshop-grid">
          {items.map(([title, body], index) => (
            <article className="workshop-card" key={title}>
              <span>0{index + 1}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <aside className="tip">
          <span>✦</span>
          <p><strong>A note on AI advice</strong> The recommendation is one source of information. Across the study, some recommendations may not be accurate.</p>
        </aside>
        <button className="button primary" onClick={onContinue}>
          Continue to practice check <span>→</span>
        </button>
      </section>
    </main>
  )
}

export function ExpertWalkthrough({ onContinue, items }) {
  return (
    <main className="intro-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="intro-content">
        <p className="eyebrow">Interface overview</p>
        <h1>How this study works</h1>
        <p className="lede">A brief overview before you begin the practice round.</p>
        <div className="workshop-grid">
          {items.map(([title, body], index) => (
            <article className="workshop-card" key={title}>
              <span>0{index + 1}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <aside className="tip">
          <span>✦</span>
          <p><strong>AI recommendations</strong> Some recommendations in this study are intentionally inaccurate. Apply your professional judgment.</p>
        </aside>
        <button className="button primary" onClick={onContinue}>
          Begin practice round <span>→</span>
        </button>
      </section>
    </main>
  )
}

export function ComprehensionCheck({ onContinue }) {
  const [selected, setSelected] = useState(null)
  const isCorrect = selected === 'own'

  const options = [
    { value: 'own', label: 'I should use the historical information, the AI recommendation, and my own judgment.' },
    { value: 'formula', label: 'I should look for a formula and calculate the one correct answer.' },
    { value: 'follow', label: 'I should always use the AI recommendation as my answer.' },
  ]

  return (
    <main className="intro-shell">
      <div className="wordmark"><span className="mark" />Decision Study</div>
      <section className="check-card">
        <p className="eyebrow">Quick check</p>
        <h1>What should guide your decision?</h1>
        <p className="lede">Choose the statement that best reflects the task.</p>
        <ChoiceList options={options} selected={selected} onSelect={setSelected} />
        {selected && !isCorrect && (
          <p className="inline-message">Not quite. The study asks for your own judgment; the recommendation is not always accurate.</p>
        )}
        <button className="button primary" type="button" disabled={!isCorrect} onClick={onContinue}>
          Start practice round <span>→</span>
        </button>
      </section>
    </main>
  )
}
