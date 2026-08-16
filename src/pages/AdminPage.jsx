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
  }, [data, filterCondition, filterStatus, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  if (!isAuthed) {
    return <LoginScreen onLogin={handleLogin} error={authError} />
  }

  const { stats } = data || {}

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
              sub={`${stats.completed} complete · ${stats.inProgress} in progress`}
            />
            <KpiCard
              label="Conditions C0 · C1 · C2 · C3"
              value={`${stats.conditions.c0} · ${stats.conditions.c1} · ${stats.conditions.c2} · ${stats.conditions.c3}`}
              sub="Baseline · Drivers · Narrative · Counterfactual"
            />
            <KpiCard
              label="Active Sessions"
              value={stats.inProgress}
              sub={`${stats.notStarted} not yet started`}
            />
            <KpiCard
              label="Completion rate"
              value={stats.total ? `${Math.round((stats.completed / stats.total) * 100)}%` : '—'}
              sub={`${stats.completed} of ${stats.total} finished`}
            />
          </section>
        )}

        {/* ── 4-Way Condition distribution bar ── */}
        {stats && stats.total > 0 && (
          <section className="adm-dist-section">
            <p className="adm-dist-label">Condition Distribution (4-Way Balance)</p>
            <div className="adm-dist-bar">
              {['c0', 'c1', 'c2', 'c3'].map((c) => {
                const count = stats.conditions[c] ?? 0
                const pct = Math.round((count / stats.total) * 100)
                const short = c.toUpperCase()
                return (
                  <div
                    key={c}
                    className={`adm-dist-segment adm-dist-segment--${c}`}
                    style={{ width: `${pct}%` }}
                    title={`${CONDITION_LABELS[c]}: ${count} (${pct}%)`}
                  >
                    {pct >= 8 ? `${short} (${count})` : ''}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Filters ── */}
        <section className="adm-filters">
          <input
            id="adm-search"
            className="adm-filter-input"
            type="search"
            placeholder="Search participant ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                  <td colSpan={9} className="adm-empty">
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
          Auto-refreshes every 60 s · Data from MongoDB · Admin session not persisted across tabs
        </p>
      </div>
    </div>
  )
}
