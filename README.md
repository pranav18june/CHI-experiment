# Supply Chain Decision Research Platform (SCDRP)

A controlled behavioural research platform engineered for experimental human-AI interaction in supply chain inventory decision-making under the Judge–Advisor System (JAS) paradigm.

---

## ⚠️ PENDING RESEARCHER SIGN-OFF

The following empirical parameters were implemented as working placeholders and are **pending formal sign-off from the study pre-registration** before final pilot data collection:

1. **Validated Numeracy Instrument (`src/config/numeracyScale.js`):**
   - *Current Implementation:* Schwartz et al. (1997) / Lipkus et al. (2001) 3-Item Objective Battery + Weller et al. Subjective Numeracy Scale (SNS) fractions item.
   - *Status:* Working placeholder. Can be swapped for the Berlin Numeracy Test (BNT) or full Weller 8-item SNS directly in `src/config/numeracyScale.js` without code changes.
2. **Directional Cost Regret Stockout Penalty Weight (`src/config/index.js`):**
   - *Current Implementation:* Default asymmetric multiplier of **`1.85×`** for under-estimation / stockout errors versus `1.00×` for holding excess inventory.
   - *Status:* Working placeholder. Configurable via environment variable `STOCKOUT_PENALTY_WEIGHT` or `VITE_STOCKOUT_PENALTY_WEIGHT`.

---

## 🔬 Study Design & Protocol Specifications

- **Protocol Version:** 4.1.0 (Study v0.2.0)
- **Experimental Design:** $2 \times 4$ Between-Subjects Factorial (Novice vs. Expert $\times$ C0 Baseline, C1 Numerical, C2 Narrative, C3 Counterfactual)
- **Paradigm:** 4-Step Judge–Advisor System (Step 1 Initial Estimate $\rightarrow$ Step 2 AI Reveal $\rightarrow$ Step 3 Verification $\rightarrow$ Step 4 Final Estimate)
- **Decision Families:** 4 (Safety Stock, Newsvendor, Reorder Point, Expedite or Wait)
- **Scored Scenarios:** 12 total scenarios counterbalanced via 8 Latin-square complement schedules ($S_0\text{--}S_7$)
- **Primary Outcome Measure:** Directional Cost Regret (Signed distance from cost-optimal, asymmetrically weighted)
- **Secondary Outcome Measures:** Weight of Advice (WoA), Verification Accuracy, Final Confidence, NASA-TLX Cognitive Load

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 18, React Router 7, Vite 7, Accessible Vanilla CSS token system ($<24\text{ kB}$)
- **Backend:** Node.js Serverless Functions (Vercel API Gateway)
- **Database:** MongoDB Atlas with Mongoose ODM (Strict schemas: `ModeCounter`, `ParticipantMode`, `ParticipantTrialPlan`, `TelemetryEvent`, `TrialResult`, `PostTaskResponse`)
- **Telemetry & Resilience:** Client-side queue (`localStorage`) with keepalive transport, server-side range validation, idempotent `$set` bulk upserts, and stimulus content snapshotting

---

## 📁 Project Structure

```
decision-study-platform/
├── api/                        # Serverless backend endpoints (6 functions)
│   ├── admin/
│   │   ├── export.js           # De-identified CSV/JSON dataset export API with manifest
│   │   ├── participants.js     # Real-time admin monitoring & 2x4 matrix aggregation
│   │   ├── reclaim-abandoned.js# Inactive slot reclamation & ModeCounter reconciler
│   │   └── withdraw.js         # IRB-compliant participant data purge API
│   ├── assign-mode.js          # Min-count stratified condition & schedule assignment
│   └── telemetry/index.js      # Server-side validation, advice resolution, & bulk ingestion
├── lib/                        # Serverless helper modules (not compiled as Vercel functions)
│   ├── mongodb.js              # Cached MongoDB connection pool
│   └── models/                 # Mongoose schema definitions with strict enums
│       ├── ModeCounter.js      # 2x4 Factorial condition & schedule counter
│       ├── ParticipantMode.js  # Participant condition records & lifecycle status
│       ├── ParticipantTrialPlan.js # Latin-square trial plans with stimulus snapshots
│       ├── PostTaskResponse.js # Post-task questionnaire responses & version stamps
│       ├── TelemetryEvent.js   # Raw interaction event stream
│       └── TrialResult.js      # Scored trial outcomes (WoA, Regret, Enums)
├── src/                        # React client SPA
│   ├── components/
│   │   ├── common/             # NumberLineInput (WCAG AA), Scale, ChoiceList, Header
│   │   ├── pages/              # Orientation, PostTaskForm, PostTrialPages
│   │   ├── questionnaires/     # NasaTlx, NumeracyScale, DomainExperience
│   │   ├── training/           # 4-Item Novice ComprehensionCheck (Appendix C.1)
│   │   └── trial/              # TrialShell, TrialSteps (Steps 1-4)
│   ├── config/                 # Central config, numeracy scale, weights
│   ├── context/StudyContext.jsx# State engine, autosave, route gating
│   ├── pages/                  # Route containers (Consent, Scored, PostTask, Admin, Excluded)
│   ├── routes/StudyRouter.jsx  # URL routing table
│   ├── scenarios/              # 14 Scenario definitions & ground truth
│   ├── services/               # Validation rules & input normalizers
│   ├── utils/                  # Counterbalance planner, formatters, hash generator
│   └── telemetry.js            # Client-side telemetry service & offline queue
├── package.json
└── vite.config.js
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Run production build validation
npm run build
```

---

## 🔐 Security & Data Governance

- **Internal Laboratory Scope:** Rate limiting and complex multi-tenant JWT auth are omitted by design as an internal academic tool. Header-based secret verification (`x-admin-secret`) provides the administrative boundary.
- **De-Identified Data Export (`/api/admin/export`):** Provides reproducible CSV/JSON research dumps with an immutable manifest header, stripping identifiable parameters.
- **Participant Withdrawal Path (`/api/admin/withdraw`):** Complies with IRB standards by purging records across all 5 database collections and adjusting active cell counters.
- **MongoDB Atlas Backup & PITR Policy:** Production Atlas deployments require **Continuous Cloud Backups with 7-Day Point-in-Time Recovery (PITR)** and 30-day daily snapshot retention to ensure data durability across the study lifecycle.
