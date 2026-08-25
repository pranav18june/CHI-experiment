# Deployment Readiness — Remaining Work

Audit of `decision-study-platform` against **Study Protocol v4.1**, scoped to experiment
design, data-collection integrity, and a single 500-concurrent-user production run.

**Design fixed at 12 scored trials + 2 practice trials.**

> **Status.** Category A (5 blocking defects), P0, P1, P2, and now **O-1, O-2, O-3 and
> E-4** are implemented and verified. The deployment checklist below is executable:
> `npm run preflight` machine-checks §5.1 and §5.3. **Two items remain, both
> ethics copy that only the research team can write (E-1, E-2).** Preflight fails on
> them by design.

---

## 1. What was verified this pass

Against a **real MongoDB** driving the **real API handlers**, plus a browser session
against that same stack.

| Area | Result |
| --- | --- |
| Counterbalancing | 56 valid (order, schedule) pairs; all satisfy every §5.6 constraint |
| Order variation | Each instance now occupies **12/12 distinct positions** (was exactly 1) |
| Correctness balance | Each instance incorrect to exactly **50%**; every serial position incorrect exactly **50%** |
| Client honours order | Browser session assigned `NV-2 ROP-3 EW-1 …` rendered trial 1 = NV-2 (Store 4), trial 2 = ROP-3, trial 3 = EW-1 |
| Chart binding (E-4) | NV-2 in position 1 still loads `/graphs/5.png` with its own statistic and scale band |
| 500 concurrent starts | 500/500 in ~350 ms, zero sequence collisions, cells balanced (novice 100/101/100/100 over n=401; expert 25/25/25/25), 12 distinct orders in use |
| Integrity | Tampered payload fully overridden by the server plan and flagged |
| Dedup | Batch re-sent twice → event count unchanged |
| Admin panel | Login, KPIs, 2×4 matrix, filters, participant table, CSV/JSON export all render live data |
| Export | 74 columns, per-participant trial orders visible, pseudonymised |
| Admin auth | Missing secret → 401; **secret in query string → 401** (header only now) |
| Index bootstrap | `npm run db:bootstrap` creates all indexes and asserts the unique `eventId` |
| Repo suite | `npm run test:db` — 15 checks, no failures |

---

## 2. Implemented this pass

### O-1 · Presentation order is now counterbalanced — **done**
Previously every participant saw the identical fixed sequence, making trial position
collinear with scenario instance and blocking each decision type into consecutive slots.

The new design ([src/utils/counterbalance.js](src/utils/counterbalance.js)) keeps correctness
**position-based** (the existing complementary Latin-square schedules already guarantee
6/6 and max-run-2) and counterbalances **order** separately, offering only
(order, schedule) pairs whose incorrect slots hold exactly 3 high- and 3 low-direction
instances. Guaranteed by construction for every participant:

- all 12 instances exactly once;
- **no two consecutive trials share a decision type** (three rounds of four, one per type);
- 6 correct / 6 incorrect, no more than 2 consecutive same-label;
- among the 6 incorrect, exactly 3 high / 3 low;
- the valid set is **complement-closed**, so each instance *and* each position is
  incorrect for exactly half of a full cycle.

`validateTrialPlan()` enforces all of it, and `assign-mode` **fails closed (500)** rather
than serve a plan that violates a constraint. The client now walks the plan's order instead
of the static array.

> **Why the schedule-index marginal is intentionally uneven.** Schedules are drawn as part
> of valid pairs, so s4/s5 appear in 5 pairs and s2/s3/s6/s7 in 8. This is harmless and
> deliberate: complementary pairs are always *equally* represented, which is the mechanism
> that produces the exact 50% guarantees above. Preflight asserts complement closure and
> position-level balance rather than the raw index marginal.

### E-4 · Chart assets bound to the instance — **done**
Each scenario carries `chartImage`; the trial screen no longer looks the image up by array
position, which would have shown the wrong chart under a permuted order. Dead
`TODO_CHART_DATA` placeholders (never read by any component) were removed.

### O-2 · Index bootstrap — **done**
`npm run db:bootstrap` ([scripts/bootstrap-indexes.js](scripts/bootstrap-indexes.js)) syncs
all six models and explicitly asserts the unique `TelemetryEvent.eventId` index that makes
retries idempotent. `autoIndex` is now **off in production**, so index builds no longer
happen implicitly on hundreds of concurrent cold starts, and a failed unique-index build
can no longer pass silently.

### O-3 · Ingest and access hardening — **done**
[lib/http.js](lib/http.js) centralises three things that were previously permissive per handler:

- **CORS**: an allow-list from `STUDY_ALLOWED_ORIGINS`; no more `*` on any endpoint.
- **Admin auth**: fails closed (503) when `ADMIN_SECRET` is unset or under 16 chars — the
  `study-admin` default is gone; header-only (query strings leak into logs and history);
  length-independent comparison.
- **Ingest limits**: batch count and payload bytes capped before any database work.

### Admin panel fixes — **done**
Found and fixed while testing the full data flow:

- **Phantom participants.** Pre-assignment events carry the browser's provisional id, so
  every consenting participant appeared *twice* — once real, once as an "unassigned" row.
  With 8 seeded participants the dashboard read `total: 22, unassigned: 8`. Provisional ids
  are now folded into their canonical participant.
- **`completed` was always 0.** Completion was inferred from the last screen viewed rather
  than the lifecycle status, so finished participants never counted. Now status-driven,
  with a separate `excluded` count.
- **`/admin` was unreachable** with a stale participant session in the same browser — the
  autosave restore bounced the researcher into the participant flow. Route realignment now
  applies to study routes only.
- **Missing conditions no longer default to `c0`** (they inflated that cell), and a
  per-participant `O(n²)` scan became a map lookup.
- **New data-quality KPI row**: integrity flags, below-time-floor trials, unassigned
  participants, and presentation-order coverage — the signals that decide whether a run is
  analysable, visible while it is still running.

### Supporting tooling — **added**
| Command | Purpose |
| --- | --- |
| `npm run preflight` | Machine-checks §5.1/§5.3: env, bundle, counterbalancing, stimuli, DB indexes |
| `npm run db:bootstrap` | One-off index creation; asserts the unique `eventId` |
| `npm run predeploy` | `build` + `preflight` |
| `npm run test:db` | Repo integration suite against a live MongoDB |
| [.env.example](.env.example) | Every variable, server and client, with the safe default called out |

---

## 3. Still open — blocking

Both are participant-facing copy that only the research team can write. **Preflight fails
on both**, deliberately.

### E-1 · Debrief is a placeholder — `P0 for IRB`
**§5.11, §11.** The debrief screen renders `TODO_DEBRIEF_TEXT`. It must disclose that some
recommendations were deliberately incorrect, and give researcher contact, withdrawal
rights, and non-identifiability to the employer for the Lowe's India cell. **A deception
study cannot run without this.**
`src/components/pages/PostTrialPages.jsx`

### E-2 · Consent / incentive / completion copy — `P0 for IRB`
**§5.10, §11.** `TODO_INCENTIVE_COPY`, `TODO_ETHICS_COPY`, `TODO_COMPLETION_COPY`.

Beneath the copy, two substantive gaps:
- §5.10's performance-contingent bonus does not exist in any form.
- **No screen tells participants qualitatively that running short costs more than
  overstocking.** That statement is the operationalisation of the cost-asymmetry thesis;
  without it participants have no reason to hedge directionally and **H2 has no incentive
  behind it**. This is a design gap, not just copy.

Also re-check the advertised "20–25 minutes" against pilot timings.
`src/components/pages/OrientationPages.jsx`, `src/components/pages/PostTrialPages.jsx`

---

## 4. Still open — non-blocking

| ID | Item | Notes |
| --- | --- | --- |
| E-3 | Withdrawal is admin-only | API works (purge verified across all five collections); no participant-facing route, and consent gives no contact address. Export pseudonymises with a reversible non-cryptographic hash. |
| E-4b | Expertise self-declared | §5.2 wants an objective screener, role list, and years threshold. The chart-binding half of E-4 is done; the screener is a research decision (F-3). |
| — | Chart-revisit scroll path | The interaction path is verified. The visibility path could not be exercised in automation (`IntersectionObserver` receives no callbacks in the headless pane). Confirm manually on a laptop viewport. |
| — | No participant-level export | Everything is trial-level; participant attributes repeat across 12 rows. Fine for mixed models, mildly awkward for descriptives. |

### Research decisions — engineering cannot resolve

| ID | Open item | Currently |
| --- | --- | --- |
| B-1 | ROP/EW stimuli are constructed, not derived from a real dataset (§5.5) | Internally consistent, marked `modelReproducible: false` |
| F-1 | Asymmetric weight (§5.10) | 1.85 / 1.0, env-overridable |
| F-2 | Numeracy instrument (§5.2) | Schwartz–Lipkus 3-item + 1 SNS item |
| F-3 | Expert inclusion criterion (§5.2) | None |
| F-4 | Perturbation magnitudes (§5.6) | 28–35%, needs pilot validation |
| F-5 | Number-line width (§5.9) | Declared per scenario, pilot-settable |
| F-6 | Comprehension threshold | 4/4, single constant, env-overridable |
| F-7 | Payment and bonus (§5.10) | Not implemented — see E-2 |

Plus, from §12 and not represented in code: equivalence bounds (#13), target N per cell
(#14), pilot sample (#15), go/no-go on the novice–expert gap (#16), OSF vs AsPredicted and
stopping rule (#17), ₹ translation assumptions (#18), demand-model detrending (#19),
blind-rating of linguistic certainty (#5), think-aloud subset size (#9).

---

## 5. Deployment checklist

### 5.1 Before deploying — ✅ automated
Run `npm run predeploy`. It builds and then machine-checks:

- ✅ `MONGODB_URI` and `ADMIN_SECRET` set, secret ≥16 chars and not the old default
- ✅ `VITE_ALLOW_URL_OVERRIDES` not `true` in the participant build
- ✅ regret weights numeric and reported
- ✅ no stimulus TODO placeholders in the built bundle
- ✅ 56 valid plans, all §5.6 constraints, instance and position balance, complement closure, condition/plan independence
- ✅ 12 scored + 2 practice stimuli clean — no TODOs, no leakage, charts and scales bound
- ✅ indexes present, including the unique `eventId`
- ❌ **fails on `TODO_DEBRIEF_TEXT` and the consent TODO copy** (E-1, E-2) — as intended

Then, manually: set env vars from [.env.example](.env.example) in Vercel, run
`npm run db:bootstrap` once against the production database, and confirm the six
serverless functions are within your plan's limit.

### 5.2 Database sizing — ✅ addressed in code, ⚠️ sizing is yours
- ✅ `maxPoolSize` is configurable (`MONGODB_MAX_POOL_SIZE`, default 10) and documented as
  **per lambda instance** — size the Atlas tier for *concurrent connections*, not data volume
- ✅ `autoIndex` off in production
- ⚠️ Volume is small (~500 participants ≈ 6 k trial rows, ~30 k events); **connections are
  the constraint**. A shared/M0 tier will hit the ceiling under a 500-user burst
- ⚠️ Enable backups / point-in-time recovery before recruitment

### 5.3 Dry run — ✅ mostly automated
- ✅ Full session verified end to end against the real backend (novice path)
- ✅ Admin dashboard verified against live data
- ✅ CSV export verified: 74 columns, demographics populated, orders varying
- ⚠️ Run one **expert** session on the deployed URL (the 4-part battery with the reliance item)
- ⚠️ Load-test the assignment path at target concurrency **against real Atlas** — the ~350 ms
  figure above is local MongoDB, which removes network latency
- ⚠️ Manually confirm chart-revisit counting on a laptop viewport

### 5.4 During the run — ✅ instrumented
The dashboard now surfaces each of these directly:

- ✅ **Integrity flags** — client/server disagreement
- ✅ **Below time floor** — §9 exclusion candidates
- ✅ **Unassigned** — assignment failures (should stay 0)
- ✅ **Presentation orders** — counterbalancing coverage
- ✅ 2×4 matrix for live cell balance
- ⚠️ Watch for `CLIENT_RESOLVED_ADVICE` in the export (participants who lost the server
  mid-trial and fell back to their cached plan)
- ⚠️ Compress the expert data-collection window (§11 contamination control)

---

## 6. Suggested order

1. **E-1 and E-2** — the only blockers. Preflight goes green when the copy lands.
   E-2 also needs the qualitative cost-asymmetry statement, which H2 depends on.
2. **Pilot** — settles F-1, F-2, F-4, F-5, F-6 and the §8 go/no-go on the novice–expert gap.
3. **Set env vars, `npm run db:bootstrap`, `npm run predeploy`**, then the manual items in
   §5.2/§5.3.
4. Open recruitment.

---

*Verified against `Study_Protocol_v4.1` (17 pp.). Backend results come from the real API
handlers against a live MongoDB; client behaviour from a browser session against that same
stack. Line references were current at the time of review.*
