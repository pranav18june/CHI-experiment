import React, { useState, useEffect, useCallback, useMemo } from 'react'

// ── Constants ────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 60_000

const PHASE_LABELS = {
  consent:            'Consent',
  'participant-type': 'Type Selection',
  training:           'Training',
  walkthrough:        'Walkthrough',
  check:              'Comprehension Check',
  practice:           'Practice',
  'practice-feedback':'Practice Feedback',
  scored:             'Scored Trials',
  'post-task':        'Post-Task',
  debrief:            'Debrief',
  complete:           'Complete',
  excluded:           'Excluded',
  unknown:            '—',
}

const CONDITION_LABELS = {
  c0: 'C0 – Baseline (No Explanation)',
  c1: 'C1 – Driver Attributions (Numerical)',
  c2: 'C2 – Narrative (Verbal Explanation)',
  c3: 'C3 – Counterfactual (Verification)',
}

const CONDITION_SHORT = {
  c0: 'C0 · Baseline',
  c1: 'C1 · Drivers',
  c2: 'C2 · Narrative',
  c3: 'C3 · Counterfactual',
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso) {
  if (!iso) return '—'
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function fmtRegret(val) {
  if (val == null) return '—'
  const sign = val < 0 ? '−$' : '+$'
  return `${sign}${Math.abs(val).toLocaleString()}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConditionBadge({ condition }) {
  if (!condition) return <span className="adm-badge adm-badge--neutral">—</span>
  const key = condition.toLowerCase()
  const label = CONDITION_SHORT[key] || condition.toUpperCase()
  return <span className={`adm-badge adm-badge--${key}`}>{label}</span>
}

function StatusBadge({ phase, isComplete }) {
  if (isComplete)
    return <span className="adm-badge adm-badge--complete">Complete</span>
  if (phase === 'excluded')
    return <span className="adm-badge" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Excluded</span>
  if (phase === 'consent' || phase === 'unknown')
    return <span className="adm-badge adm-badge--neutral">Not started</span>
  return <span className="adm-badge adm-badge--active">In progress</span>
}

function ProgressBar({ value }) {
  return (
    <div className="adm-progress-wrap" title={`${value}%`}>
      <div className="adm-progress-track">
        <div className="adm-progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="adm-progress-label">{value}%</span>
    </div>
  )
}

function KpiCard({ label, value, sub }) {
  return (
    <div className="adm-kpi">
      <span className="adm-kpi__value">{value}</span>
      <span className="adm-kpi__label">{label}</span>
      {sub && <span className="adm-kpi__sub">{sub}</span>}
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span className="adm-sort-icon">↕</span>
  return <span className="adm-sort-icon adm-sort-icon--active">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, error }) {
  const [pw, setPw] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onLogin(pw)
  }

  return (
    <main className="adm-login-shell">
      <div className="adm-login-card">
        <div className="wordmark" style={{ marginBottom: 28 }}>
          <span className="mark" />Decision Study
        </div>
        <p className="eyebrow">Admin access</p>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 28, fontSize: 14 }}>
          Enter the admin secret to access the participant dashboard.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <input
            id="admin-password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Admin secret"
            autoFocus
            autoComplete="current-password"
            style={{
              width: '100%', height: 48, border: '1px solid var(--line)',
              borderRadius: 7, padding: '0 14px', fontSize: 15,
              background: 'var(--surface)', fontFamily: 'var(--mono)',
            }}
          />
          {error && (
            <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>
              Incorrect secret. Please try again.
            </p>
          )}
          <button className="button primary full" type="submit" disabled={!pw}>
            Access dashboard →
          </button>
        </form>
      </div>
    </main>
  )
}

// ── Main Admin Dashboard ──────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem('adm-secret') || '')
  const [authError, setAuthError] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  // Table controls
  const [sortField, setSortField] = useState('sessionStarted')
  const [sortDir, setSortDir] = useState('desc')
  const [filterType, setFilterType] = useState('all')
  const [filterCondition, setFilterCondition] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (sk) => {
    const usedSecret = sk ?? secret
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/participants', {
        headers: { 'x-admin-secret': usedSecret },
      })
      if (res.status === 401) {
        setAuthError(true)
        setIsAuthed(false)
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastRefreshed(new Date())
      setIsAuthed(true)
      setAuthError(false)
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setLoading(false)
    }
  }, [secret])

  function handleLogin(pw) {
    setSecret(pw)
    sessionStorage.setItem('adm-secret', pw)
    fetchData(pw)
  }

  // Auto-refresh
  useEffect(() => {
    if (!isAuthed) return
    const id = setInterval(() => fetchData(), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isAuthed, fetchData])

  // ── Sorting & filtering ─────────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!data?.participants) return []
    let list = [...data.participants]

    if (filterType !== 'all')      list = list.filter((p) => p.participantType === filterType)
    if (filterCondition !== 'all') list = list.filter((p) => p.condition === filterCondition)
    if (filterStatus === 'complete')   list = list.filter((p) => p.isComplete)
    if (filterStatus === 'active')     list = list.filter((p) => !p.isComplete && p.trialsCompleted > 0)
    if (filterStatus === 'not-started')list = list.filter((p) => p.trialsCompleted === 0 && !p.isComplete)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.participantId?.toLowerCase().includes(q))
    }

    list.sort((a, b) => {
      let av = a[sortField], bv = b[sortField]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return list
  }, [data, filterType, filterCondition, filterStatus, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  if (!isAuthed) {
    return <LoginScreen onLogin={handleLogin} error={authError} />
  }

  const { stats } = data || {}
  const matrix = stats?.matrix || {
    novice: { c0: 0, c1: 0, c2: 0, c3: 0 },
    expert: { c0: 0, c1: 0, c2: 0, c3: 0 },
  }
  const schedMatrix = stats?.scheduleMatrix || {
    novice: { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
    expert: { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 },
  }

  return (
    <div className="adm-shell">
      {/* ── Top bar ── */}
      <header className="adm-topbar">
        <div className="wordmark">
          <span className="mark" />Decision Study
          <span className="adm-topbar__tag">Admin</span>
        </div>
        <div className="adm-topbar__right">
          {loading && <span className="adm-loading-dot" title="Refreshing…" />}
          {lastRefreshed && (
            <span className="adm-last-refresh">
              Updated {timeAgo(lastRefreshed)}
            </span>
          )}
          <button
            className="button"
            style={{ minHeight: 32, padding: '0 12px', fontSize: 13 }}
            onClick={() => fetchData()}
            disabled={loading}
          >
            ↻ Refresh
          </button>
          <button
            className="quiet-button"
            onClick={() => { sessionStorage.removeItem('adm-secret'); setIsAuthed(false) }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="adm-content">
        {fetchError && (
          <div className="adm-error-banner">⚠ Could not fetch data: {fetchError}</div>
        )}

        {/* ── KPI row ── */}
        {stats && (
          <section className="adm-kpi-row">
            <KpiCard
              label="Total participants"
              value={stats.total}
              sub={`${stats.completed} complete · ${stats.inProgress} active`}
            />
            <KpiCard
              label="Directional Cost Regret"
              value={stats.globalAvgDirectionalRegret != null ? fmtRegret(stats.globalAvgDirectionalRegret) : '—'}
              sub="Primary outcome (1.85× stockout penalty)"
            />
            <KpiCard
              label="Avg Weight of Advice"
              value={stats.globalAvgWoA != null ? stats.globalAvgWoA.toFixed(3) : '—'}
              sub="Judge-Advisor WoA metric"
            />
            <KpiCard
              label="Completion rate"
              value={stats.total ? `${Math.round((stats.completed / stats.total) * 100)}%` : '—'}
              sub={`${stats.completed} of ${stats.total} finished`}
            />
          </section>
        )}

        {/* ── 2×4 Factorial Design Matrix ── */}
        {stats && (
          <section className="adm-matrix-section">
            <div className="adm-matrix-header">
              <span className="adm-dist-label" style={{ margin: 0 }}>
                2×4 Factorial Condition Depth Matrix (Expertise × Condition)
              </span>
              <span className="adm-matrix-badge">Min-Count Balanced</span>
            </div>
            <div className="adm-matrix-table-wrap">
              <table className="adm-matrix-table">
                <thead>
                  <tr>
                    <th>Expertise Group</th>
                    <th>C0 (Baseline)</th>
                    <th>C1 (Numerical)</th>
                    <th>C2 (Narrative)</th>
                    <th>C3 (Counterfactual)</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="adm-matrix-type"><strong>Novice</strong> (Students)</td>
                    <td><span className="adm-matrix-num">{matrix.novice.c0}</span></td>
                    <td><span className="adm-matrix-num">{matrix.novice.c1}</span></td>
                    <td><span className="adm-matrix-num">{matrix.novice.c2}</span></td>
                    <td><span className="adm-matrix-num">{matrix.novice.c3}</span></td>
                    <td className="adm-matrix-total">
                      {matrix.novice.c0 + matrix.novice.c1 + matrix.novice.c2 + matrix.novice.c3}
                    </td>
                  </tr>
                  <tr>
                    <td className="adm-matrix-type"><strong>Expert</strong> (Practitioners)</td>
                    <td><span className="adm-matrix-num">{matrix.expert.c0}</span></td>
                    <td><span className="adm-matrix-num">{matrix.expert.c1}</span></td>
                    <td><span className="adm-matrix-num">{matrix.expert.c2}</span></td>
                    <td><span className="adm-matrix-num">{matrix.expert.c3}</span></td>
                    <td className="adm-matrix-total">
                      {matrix.expert.c0 + matrix.expert.c1 + matrix.expert.c2 + matrix.expert.c3}
                    </td>
                  </tr>
                  <tr className="adm-matrix-footer-row">
                    <td><strong>Total</strong></td>
                    <td><strong>{stats.conditions?.c0 ?? 0}</strong></td>
                    <td><strong>{stats.conditions?.c1 ?? 0}</strong></td>
                    <td><strong>{stats.conditions?.c2 ?? 0}</strong></td>
                    <td><strong>{stats.conditions?.c3 ?? 0}</strong></td>
                    <td><strong>{stats.total}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Latin-Square Schedule Depth Matrix ── */}
        {stats && (
          <section className="adm-matrix-section" style={{ marginTop: 20 }}>
            <div className="adm-matrix-header">
              <span className="adm-dist-label" style={{ margin: 0 }}>
                Latin-Square Correctness Schedule Depth Matrix (Expertise × S0–S7)
              </span>
              <span className="adm-matrix-badge">Min-Count Randomized</span>
            </div>
            <div className="adm-matrix-table-wrap">
              <table className="adm-matrix-table">
                <thead>
                  <tr>
                    <th>Expertise Group</th>
                    <th title="Schedule Pair 1">S0</th>
                    <th title="Schedule Pair 1 (Complement)">S1</th>
                    <th title="Schedule Pair 2">S2</th>
                    <th title="Schedule Pair 2 (Complement)">S3</th>
                    <th title="Schedule Pair 3">S4</th>
                    <th title="Schedule Pair 3 (Complement)">S5</th>
                    <th title="Schedule Pair 4">S6</th>
                    <th title="Schedule Pair 4 (Complement)">S7</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="adm-matrix-type"><strong>Novice</strong> (Students)</td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s0}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s1}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s2}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s3}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s4}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s5}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s6}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.novice.s7}</span></td>
                    <td className="adm-matrix-total">
                      {Object.values(schedMatrix.novice).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="adm-matrix-type"><strong>Expert</strong> (Practitioners)</td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s0}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s1}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s2}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s3}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s4}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s5}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s6}</span></td>
                    <td><span className="adm-matrix-num">{schedMatrix.expert.s7}</span></td>
                    <td className="adm-matrix-total">
                      {Object.values(schedMatrix.expert).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr className="adm-matrix-footer-row">
                    <td><strong>Total</strong></td>
                    <td><strong>{stats.schedules?.s0 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s1 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s2 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s3 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s4 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s5 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s6 ?? 0}</strong></td>
                    <td><strong>{stats.schedules?.s7 ?? 0}</strong></td>
                    <td><strong>{stats.total}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Filters ── */}
        <section className="adm-filters" style={{ marginTop: 24 }}>
          <input
            id="adm-search"
            className="adm-filter-input"
            type="search"
            placeholder="Search participant ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            id="adm-filter-type"
            className="adm-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All expertise types</option>
            <option value="novice">Novice</option>
            <option value="expert">Expert</option>
          </select>
          <select
            id="adm-filter-condition"
            className="adm-filter-select"
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
          >
            <option value="all">All conditions</option>
            <option value="c0">C0 – Baseline (No explanation)</option>
            <option value="c1">C1 – Drivers (Numerical)</option>
            <option value="c2">C2 – Narrative (Verbal)</option>
            <option value="c3">C3 – Counterfactual (Verification)</option>
          </select>
          <select
            id="adm-filter-status"
            className="adm-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="complete">Complete</option>
            <option value="active">In progress</option>
            <option value="not-started">Not started</option>
          </select>
          <span className="adm-row-count">{rows.length} participant{rows.length !== 1 ? 's' : ''}</span>
        </section>

        {/* ── Table ── */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('participantId')} className="adm-th--sortable">
                  Participant <SortIcon field="participantId" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('condition')} className="adm-th--sortable">
                  Condition <SortIcon field="condition" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('participantType')} className="adm-th--sortable">
                  Type <SortIcon field="participantType" sortField={sortField} sortDir={sortDir} />
                </th>
                <th>Status</th>
                <th onClick={() => toggleSort('progress')} className="adm-th--sortable">
                  Progress <SortIcon field="progress" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('avgDirectionalCostRegret')} className="adm-th--sortable" title="Signed distance from cost-optimal, asymmetrically weighted">
                  Avg Regret <SortIcon field="avgDirectionalCostRegret" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('avgWoA')} className="adm-th--sortable">
                  Avg WoA <SortIcon field="avgWoA" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('avgConfidence')} className="adm-th--sortable">
                  Confidence <SortIcon field="avgConfidence" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('sessionStarted')} className="adm-th--sortable">
                  Started <SortIcon field="sessionStarted" sortField={sortField} sortDir={sortDir} />
                </th>
                <th onClick={() => toggleSort('lastSeen')} className="adm-th--sortable">
                  Last seen <SortIcon field="lastSeen" sortField={sortField} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="adm-empty">
                    {loading ? 'Loading…' : 'No participants match the current filters.'}
                  </td>
                </tr>
              ) : rows.map((p) => (
                <tr key={p.participantId} className={p.isComplete ? 'adm-row--complete' : ''}>
                  <td>
                    <span className="adm-pid">{p.participantId}</span>
                    <span className="adm-phase">{PHASE_LABELS[p.currentPhase] || p.currentPhase}</span>
                  </td>
                  <td><ConditionBadge condition={p.condition} /></td>
                  <td>
                    <span className="adm-type">{p.participantType || '—'}</span>
                  </td>
                  <td><StatusBadge phase={p.currentPhase} isComplete={p.isComplete} /></td>
                  <td>
                    <ProgressBar value={p.progress} />
                    <span className="adm-trial-count">{p.trialsCompleted}/{p.totalTrials}</span>
                  </td>
                  <td className="adm-num" style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                    {p.avgDirectionalCostRegret != null ? (
                      <span style={{ color: p.avgDirectionalCostRegret < 0 ? '#b91c1c' : '#0369a1' }}>
                        {fmtRegret(p.avgDirectionalCostRegret)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="adm-num">{p.avgWoA != null ? p.avgWoA.toFixed(3) : '—'}</td>
                  <td className="adm-num">{p.avgConfidence != null ? p.avgConfidence.toFixed(1) : '—'}</td>
                  <td className="adm-date">{fmtDate(p.sessionStarted)}</td>
                  <td className="adm-date">{timeAgo(p.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="adm-footer">
          Auto-refreshes every 60 s · Data from MongoDB · 2×4 Factorial between-subjects design
        </p>
      </div>
    </div>
  )
}
