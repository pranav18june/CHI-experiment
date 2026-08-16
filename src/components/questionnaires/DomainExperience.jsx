import React from 'react'

export default function DomainExperience({ values, onChange }) {
  function handleChange(field, val) {
    onChange({ ...values, [field]: val })
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Years of Experience */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          1. Years of Relevant Experience
        </label>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          Total years of professional or academic experience in supply chain, inventory control, demand planning, or logistics.
        </p>
        <select
          value={values.yearsExperience || ''}
          onChange={(e) => handleChange('yearsExperience', e.target.value)}
          style={{ width: '100%', height: 42, border: '1px solid var(--line)', borderRadius: 6, padding: '0 10px', background: 'var(--surface)' }}
        >
          <option value="">Select experience level…</option>
          <option value="0">0 years (No prior experience)</option>
          <option value="<1">Less than 1 year</option>
          <option value="1-2">1 to 2 years</option>
          <option value="3-5">3 to 5 years</option>
          <option value="6-10">6 to 10 years</option>
          <option value=">10">More than 10 years</option>
        </select>
      </div>

      {/* Primary Role */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          2. Primary Professional or Academic Role
        </label>
        <select
          value={values.primaryRole || ''}
          onChange={(e) => handleChange('primaryRole', e.target.value)}
          style={{ width: '100%', height: 42, border: '1px solid var(--line)', borderRadius: 6, padding: '0 10px', background: 'var(--surface)' }}
        >
          <option value="">Select primary role…</option>
          <option value="student_undergrad">Undergraduate Student</option>
          <option value="student_grad">Graduate / Master's / MBA Student</option>
          <option value="analyst_planner">Supply Chain Analyst / Demand Planner</option>
          <option value="manager_director">Inventory / Operations / Supply Chain Manager</option>
          <option value="executive">Director / VP / Executive</option>
          <option value="academic_researcher">Academic Researcher / Professor</option>
          <option value="other">Other Professional Role</option>
        </select>
      </div>

      {/* Decision Frequency */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          3. Real-World Decision Frequency
        </label>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          How frequently do you make or review quantitative inventory, replenishment, or order-quantity decisions in your daily work or studies?
        </p>
        <select
          value={values.decisionFrequency || ''}
          onChange={(e) => handleChange('decisionFrequency', e.target.value)}
          style={{ width: '100%', height: 42, border: '1px solid var(--line)', borderRadius: 6, padding: '0 10px', background: 'var(--surface)' }}
        >
          <option value="">Select frequency…</option>
          <option value="never">Never</option>
          <option value="rarely">A few times a year</option>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="daily">Daily or almost daily</option>
        </select>
      </div>

      {/* Certifications */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          4. Professional Certifications
        </label>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          Do you hold or are you currently pursuing any formal operations or supply chain certifications (e.g. APICS CSCP, CPIM, CLTD, Lean Six Sigma)?
        </p>
        <select
          value={values.certifications || ''}
          onChange={(e) => handleChange('certifications', e.target.value)}
          style={{ width: '100%', height: 42, border: '1px solid var(--line)', borderRadius: 6, padding: '0 10px', background: 'var(--surface)' }}
        >
          <option value="">Select certification status…</option>
          <option value="none">No formal certifications</option>
          <option value="in_progress">Currently in progress / studying</option>
          <option value="certified">Certified (Hold one or more active credentials)</option>
        </select>
      </div>

      {/* Open Qualitative Feedback */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '18px 20px' }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          5. General Observations &amp; Feedback (Optional)
        </label>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          Any additional thoughts about the AI recommendations, explanations, or decision tasks?
        </p>
        <textarea
          rows={3}
          value={values.feedback || ''}
          onChange={(e) => handleChange('feedback', e.target.value)}
          placeholder="Enter any optional comments or impressions here…"
          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13.5, fontFamily: 'var(--sans)', background: 'var(--surface)' }}
        />
      </div>
    </div>
  )
}
