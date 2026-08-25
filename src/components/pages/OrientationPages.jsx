import React, { useState } from 'react'
import ChoiceList from '../common/ChoiceList.jsx'
import STUDY_COPY, { bonusSentence } from '../../config/studyCopy.js'

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
          <p>
            This study looks at how people make inventory decisions when an AI system
            recommends a number. You will see real historical sales data for a store and
            product category, decide how much stock to hold or order, then see what the AI
            recommends and give a final answer.
          </p>
          <ul>
            <li><strong>Duration:</strong> about {STUDY_COPY.estimatedDuration}.</li>
            <li>
              <strong>Task:</strong> twelve decisions, each in four short steps — your own
              estimate, the AI&rsquo;s recommendation, a quick check of it, then your final
              answer — followed by a closing questionnaire.
            </li>
            <li>
              <strong>Payment:</strong>{' '}
              {STUDY_COPY.compensation.baseAmount
                ? <>{STUDY_COPY.compensation.baseAmount} for completing the study, plus {bonusSentence()}.</>
                : <>[payment terms — see src/config/studyCopy.js]</>}
              {STUDY_COPY.compensation.payoutMethod ? ` Paid by ${STUDY_COPY.compensation.payoutMethod}.` : ''}
            </li>
          </ul>

          {/*
            §5.10 — the cost asymmetry is stated QUALITATIVELY and to BOTH groups.
            It belongs here rather than in the novice training module: it is the
            incentive, not decision-logic teaching, so experts must see it too or
            knowing the asymmetry becomes confounded with expertise. The ratio and
            the formula are never disclosed.
          */}
          <p>
            One thing worth knowing before you start: the two ways of being wrong do not cost
            the same. <strong>Running short and losing sales costs the business more than
            holding some extra stock.</strong> Your bonus reflects that — being under is
            penalised more heavily than being over by the same amount.
          </p>

          <h2>What taking part involves</h2>
          <p>
            There are no known risks beyond the mild tiredness of concentrating for
            {' '}{STUDY_COPY.estimatedDuration}. There are no right answers you are expected to
            know in advance, and you are not being tested — we are studying the interface, not
            you. Some questions ask how demanding you found the task; answer them honestly,
            including if the answer is &ldquo;very&rdquo;.
          </p>

          <h2>Your rights and your data</h2>
          <p>
            Taking part is voluntary. You may stop at any point by closing the tab, without
            giving a reason and without any penalty. Nobody at your university or employer is
            told whether you took part or how you performed.
          </p>
          <p>
            We do not ask for your name, email address, or any other direct identifier.
            Responses are stored under a random study code
            {STUDY_COPY.dataStorageLocation ? ` ${STUDY_COPY.dataStorageLocation}` : ''} and kept
            {' '}{STUDY_COPY.dataRetentionPeriod || '[retention period]'}. Results are published
            only in aggregate; no individual is identifiable.
          </p>
          <p>
            After finishing you will be given a session code. You can have your data deleted
            within {STUDY_COPY.withdrawalWindow || '[withdrawal window]'} by emailing that code
            to <strong>{STUDY_COPY.contactEmail || '[contact email]'}</strong>. Your payment is
            unaffected.
          </p>
          <p>
            <strong>{STUDY_COPY.principalInvestigator || '[principal investigator]'}</strong>
            {STUDY_COPY.institution ? `, ${STUDY_COPY.institution}` : ''}
            {' '}&middot; {STUDY_COPY.contactEmail || '[contact email]'}
            <br />
            Approved by {STUDY_COPY.ethicsCommittee || '[ethics committee]'}
            {STUDY_COPY.ethicsApprovalRef ? ` (${STUDY_COPY.ethicsApprovalRef})` : ''}. To raise a
            concern with someone independent of the research team, contact
            {' '}{STUDY_COPY.ethicsContactEmail || '[ethics contact]'}.
          </p>
          <p className="field-note">
            There is one more thing we will tell you about the study once you have finished.
            It does not affect your payment or what you are asked to do.
          </p>
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

export function ParticipantTypeSelect({ onSelect, isAssigning = false, assignmentError = null, onRetry }) {
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
        <p className="lede">Your answer determines which version of the task you receive.</p>
        <ChoiceList options={options} selected={selected} onSelect={setSelected} />

        {assignmentError && (
          <div
            role="alert"
            style={{
              margin: '4px 0 16px', padding: '12px 14px', borderRadius: 6,
              border: '1px solid #b45309', background: '#fdf6ec', color: '#7c3f06', fontSize: 13.5,
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>Could not start your session</strong>
            {assignmentError}
          </div>
        )}

        <button
          className="button primary"
          type="button"
          disabled={!selected || isAssigning}
          onClick={() => (assignmentError && onRetry ? onRetry() : onSelect(selected))}
        >
          {isAssigning
            ? 'Setting up your session…'
            : assignmentError ? <>Try again <span>↻</span></> : <>Continue <span>→</span></>}
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
        {/*
          §5.7 requires this module to stay neutral: no statement that the AI is
          often wrong, and no instruction to scrutinise it. A global instruction
          to scrutinise suppresses reliance in every cell and compresses the
          C0–C3 contrast the study exists to measure. Deception disclosure
          belongs in the debrief (§5.11).
        */}
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
        {/* Same neutrality requirement as the novice module (§5.7). */}
        <button className="button primary" onClick={onContinue}>
          Begin practice round <span>→</span>
        </button>
      </section>
    </main>
  )
}

// NOTE: a one-item inline comprehension check previously lived here. It was
// unreferenced (CheckPage renders the 4-item Appendix C.1 instrument from
// components/training/ComprehensionCheck.jsx) and its feedback copy told
// participants the AI "is not always accurate", which §5.7 forbids. Removed.
