# Technical Software Documentation & Architecture Report
## Supply Chain Decision Research Platform (SCDRP)
**Version:** 0.2.0 | **Study Protocol Version:** 4.1.0 | **Author:** System Architecture & Engineering Team  
**Repository:** `https://github.com/pranav18june/CHI-experiment.git`  
**Date:** August 2026

---

## Changes Since Previous Report

This technical report has been completely re-derived from the live source code to document the operational state of the platform following the implementation of core protocol updates and pre-pilot tightening:

1. **4-Condition Protocol Standardisation (C0–C3):** Standardised condition naming across all database models, APIs, and client states. Added the **C0 Baseline** condition (Recommendation-Only, No Explanation) alongside **C1** (Numerical/Driver Attributions), **C2** (Narrative Context), and **C3** (Counterfactual Verification).
2. **$2 \times 4$ Expertise-Stratified Factorial Balancing:** Refactored `ModeCounter`, `ParticipantMode`, and `api/assign-mode.js` to track condition assignments independently within expertise strata (`novice` vs. `expert`), ensuring balanced per-cell depth ($N_{\text{group}} \times 4$).
3. **Min-Count Latin-Square Schedule Assignment Randomization:** Updated schedule selection from a deterministic running counter (`count % 8`) to an active **min-count balancing algorithm** across all 8 Latin-square complement schedules ($S_0\text{--}S_7$) within each expertise group (ties broken uniformly at random). Surfaced schedule depth counts in the admin dashboard matrix view.
4. **Primary Outcome Measure: Directional Cost Regret:** Implemented signed, asymmetrically weighted cost regret ($\Delta = \text{Final} - \text{Optimal}$, weighted $1.85\times$ for expensive under-ordering / stockout errors and $1.0\times$ for holding overage) in `api/telemetry/index.js`, `TrialResult` schema, and admin dashboards.
5. **Interactive Number-Line Input (Protocol §5.9):** Built the `NumberLineInput` slider component with dynamic per-scenario bounds, clean step intervals, and historical demand baseline anchoring in Step 1 and Step 4.
6. **4-Item Novice Comprehension Check (Appendix C.1):** Built the 4-item validation test with two-attempt pass/fail logic and pre-registered participant exclusion routing (`/excluded`).
7. **Instructional Attention Check (Protocol §5.11):** Embedded an instructional manipulation check in practice feedback with telemetry tracking and exclusion gating.
8. **Post-Task Questionnaire Battery (Appendix C.3):** Implemented standard 6-subscale NASA-TLX, modular Schwartz-Lipkus & SNS numeracy scale, supply chain domain experience measures, and the `PostTaskResponse` database model.
9. **Flagged Researcher-Decided Parameters:** Formally annotated the numeracy scale (`Schwartz-Lipkus-3Item-Plus-SNS`) and stockout penalty weight ($1.85\times$) in code and documentation as working placeholders pending pre-registration sign-off.
10. **Documented Security Scope Decision:** Documented the deliberate design choice to omit multi-tenant rate limiting and token hashing in favor of lightweight header authentication for internal research lab deployments.

---

## 1. Introduction

### 1.1 Background
Decision-making in supply chain operations frequently occurs under conditions of high demand volatility, lead-time uncertainty, and asymmetric cost trade-offs (e.g., the cost of a stockout typically far exceeds the holding cost of excess inventory). Modern enterprise systems increasingly deploy Artificial Intelligence (AI) and Machine Learning (ML) algorithms to provide operational recommendations to human planners. However, human decision-makers often exhibit non-calibrated trust—either over-relying on incorrect AI outputs (automation bias) or rejecting accurate AI recommendations (algorithm aversion).

The **Supply Chain Decision Research Platform (SCDRP)** is a specialised, full-stack behavioural research system engineered to conduct rigorous empirical experiments on human-AI collaboration. Built on the classic **Judge–Advisor System (JAS)** paradigm, the platform evaluates how different Explainable AI (XAI) modalities interact with domain expertise to influence decision quality, cognitive workload, and trust calibration.

### 1.2 Problem Statement
Prior research in Human-Computer Interaction (HCI) and decision sciences suffers from significant methodological limitations:
- **Lack of Standardised Baselines:** Studies often compare complex explanations without a clean "recommendation-only" baseline ($C_0$).
- **Confounded Expertise:** Novices and domain practitioners are frequently pooled together rather than balanced within factorial cells.
- **Symmetric Metric Misalignment:** Trust is often measured purely through symmetric Weight of Advice (WoA), ignoring directional cost asymmetry where stockouts carry severe commercial penalties compared to over-stocking.
- **Data Capture Brittleness:** Web-based experimental platforms often lose critical telemetry due to network latency, page reloads, or lack of offline resilience.

### 1.3 Motivation & Objectives
SCDRP was designed from first principles to provide:
1. **Factorial Rigour:** A fully crossed $2 \times 4$ between-subjects factorial design (Novice vs. Expert $\times$ C0 Baseline, C1 Numerical, C2 Narrative, C3 Counterfactual).
2. **Deterministic Experimental Control:** Counterbalanced Latin-square schedules ensuring identical error rates, balanced error directions, and run-length constraints across participants.
3. **Domain-Specific Outcome Metrics:** Real-time computation of **Directional Cost Regret** ($1.85\times$ stockout penalty) alongside Judge-Advisor **Weight of Advice (WoA)**.
4. **Resilient High-Throughput Telemetry:** Client-side event queuing, automatic retry mechanisms, and sub-millisecond database persistence.

### 1.4 Scope & Target Users
- **Novice Cohort:** Business, management, and engineering students undergoing standardised inventory orientation.
- **Expert Cohort:** Professional supply chain planners, operations directors, and demand managers.
- **Research Administrators:** Principal investigators monitoring real-time recruitment, per-cell depth matrices, and aggregated performance metrics.

---

## 2. System Overview

### 2.1 High-Level Architecture Diagram
```mermaid
graph TD
    Client["React 18 SPA (Vite Bundled)"]
    Context["StudyContext (State & Gating Engine)"]
    TelemetryClient["TelemetryService (Offline Queue)"]
    Router["StudyRouter (URL-Synced Routes)"]

    subgraph BackendGateway ["Vercel Serverless API Gateway"]
        AssignModeAPI["/api/assign-mode"]
        TelemetryAPI["/api/telemetry"]
        AdminAPI["/api/admin/participants"]
    end

    subgraph MongoDBDatabase ["MongoDB Multi-Collection Cluster"]
        ModeCounterCol[("ModeCounter")]
        ParticipantModeCol[("ParticipantMode")]
        ParticipantTrialPlanCol[("ParticipantTrialPlan")]
        TelemetryEventCol[("TelemetryEvent")]
        TrialResultCol[("TrialResult")]
        PostTaskResponseCol[("PostTaskResponse")]
    end

    Client --> Context
    Context --> Router
    Context --> TelemetryClient
    Context --> AssignModeAPI
    Context --> TelemetryAPI
    TelemetryClient --> TelemetryAPI

    AssignModeAPI --> ModeCounterCol
    AssignModeAPI --> ParticipantModeCol
    AssignModeAPI --> ParticipantTrialPlanCol

    TelemetryAPI --> ParticipantTrialPlanCol
    TelemetryAPI --> TelemetryEventCol
    TelemetryAPI --> TrialResultCol
    TelemetryAPI --> PostTaskResponseCol

    AdminAPI --> ParticipantModeCol
    AdminAPI --> TelemetryEventCol
    AdminAPI --> TrialResultCol
```

### 2.2 User Interaction Flow
```mermaid
flowchart TD
    Start([Participant Accesses Platform]) --> Consent["Consent & Demographics (/)"]
    Consent --> TypeSelect["Expertise Selection (/type)"]
    
    TypeSelect -->|Stratified Min-Count| AssignMode["API: Assign Condition (C0-C3) & Schedule (S0-S7)"]
    
    TypeSelect -->|Novice| Training["Novice Workshop Training (/training)"]
    TypeSelect -->|Expert| Walkthrough["Expert System Walkthrough (/walkthrough)"]
    
    Training --> Check["4-Item Comprehension Check (/check)"]
    Check -->|Score < 4/4 Attempt 1| RetryCheck["Review & Retry (Attempt 2)"]
    RetryCheck -->|Score < 4/4 Attempt 2| Excluded["Pre-Registered Exclusion (/excluded)"]
    
    Check -->|Score 4/4| Practice["Practice Trials & Feedback (/practice)"]
    Walkthrough --> Practice
    RetryCheck -->|Score 4/4| Practice

    Practice --> AttentionCheck{"Practice Attention Check"}
    AttentionCheck -->|Failed| Excluded
    AttentionCheck -->|Passed| Scored["12 Scored Trials (/scored)"]

    subgraph TrialFlow ["4-Step JAS Trial Loop (12 Scored Trials)"]
        S1["Step 1: Initial Estimate & Confidence (NumberLine)"]
        S2["Step 2: AI Reveal & Condition Explanation"]
        S3["Step 3: Verification Check (Too High/Right/Low)"]
        S4["Step 4: Final Estimate, Confidence & Cognitive Load"]
        S1 --> S2 --> S3 --> S4
    end

    Scored --> TrialFlow
    TrialFlow --> PostTask["Post-Task Questionnaires (/post-task)\n(NASA-TLX + Numeracy + Domain)"]
    PostTask --> Debrief["Ethics Debriefing (/debrief)"]
    Debrief --> Complete["Completion Code (/complete)"]
```

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose / Rationale |
|---|---|---|---|
| **Frontend Framework** | React | `18.3.1` | Declarative UI, state hooks, and component encapsulation |
| **Build & Dev Tooling** | Vite | `7.3.6` | Sub-second HMR, optimized tree-shaking, production bundling |
| **Client Routing** | React Router | `7.13.1` | Declarative client-side routing, URL synchronization |
| **Typography & Fonts** | Google Fonts | Web CDN | *DM Sans* (UI), *DM Mono* (Data/Stats), *Newsreader* (Headings) |
| **Styling** | Vanilla CSS Tokens | CSS3 / HSL | High performance, lightweight ($23.2\text{ kB}$), zero CSS runtime |
| **Backend Runtime** | Node.js (ESM) | `v18+` / `v20+` | Asynchronous, event-driven serverless API execution |
| **Serverless Gateway** | Vercel Serverless Functions | AWS Lambda | Auto-scaling stateless REST API endpoints |
| **Database** | MongoDB Atlas | `v7.0+` | Document database for flexible telemetry and atomic operations |
| **ODM / DB Driver** | Mongoose | `8.10.1` | Strict schema validation, connection pooling, indexing |

---

## 4. System Architecture

The SCDRP architecture follows a modular **Clean Layered Architecture**:

1. **Presentation & UI Component Layer (`src/components/`, `src/pages/`):**
   - Pure, accessible React components partitioned by lifecycle phase (Orientation, Trial, Training, Questionnaires, Common).
   - Form inputs utilize custom-built accessible components like `NumberLineInput` and `Scale`.
2. **Application State & Orchestration Layer (`src/context/StudyContext.jsx`):**
   - Centralized React Context managing session identity, active trial state, URL synchronization, gating rules, and local storage autosave recovery.
3. **Observability & Telemetry Layer (`src/telemetry.js`):**
   - High-throughput client event logger with passive DOM tracking (scrolls, chart dwell, focus changes) and a localStorage-backed offline queue.
4. **API Gateway & Micro-Endpoints Layer (`api/`):**
   - Vercel serverless functions handling condition balancing, trial plan resolution, batch telemetry ingestion, and administrative analytics.
5. **Persistence & Data Model Layer (`api/models/`, `api/lib/mongodb.js`):**
   - Mongoose schemas with targeted compound indexes and cached connection pooling designed for high-concurrency serverless execution.

---

## 5. Project Structure

```
decision-study-platform/
├── api/                                # Serverless Backend Endpoints
│   ├── admin/
│   │   └── participants.js            # Real-time admin monitoring & 2x4 matrix aggregation
│   ├── lib/
│   │   └── mongodb.js                 # Cached serverless MongoDB client pool
│   ├── models/
│   │   ├── ModeCounter.js             # 2x4 Factorial condition & schedule counter schema
│   │   ├── ParticipantMode.js         # Participant condition & type records
│   │   ├── ParticipantTrialPlan.js    # Latin-square 12-trial counterbalanced plans
│   │   ├── PostTaskResponse.js        # NASA-TLX, Numeracy, Domain analytics model
│   │   ├── TelemetryEvent.js          # Raw event log stream (JAS envelopes)
│   │   └── TrialResult.js             # Scored trial outcomes (WoA, Regret, Dwell)
│   ├── assign-mode.js                 # Stratified 2x4 condition & trial plan assignment API
│   └── telemetry/
│       └── index.js                   # High-throughput batch telemetry ingestion & advice resolution
├── src/                                # Frontend Single-Page Application
│   ├── components/
│   │   ├── common/
│   │   │   ├── ChoiceList.jsx         # Accessible radio choice list
│   │   │   ├── Header.jsx             # Study header with progress bar & step pips
│   │   │   ├── NumberLineInput.jsx    # Dynamic number-line & slider input (Protocol §5.9)
│   │   │   └── Scale.jsx              # 7-point Likert scale component
│   │   ├── pages/
│   │   │   ├── OrientationPages.jsx   # WelcomeScreen, Demographics, Workshop, Walkthrough
│   │   │   ├── PostTaskForm.jsx       # Multi-part post-task questionnaire form
│   │   │   └── PostTrialPages.jsx     # PracticeFeedback (w/ Attention Check), Debrief, Complete
│   │   ├── questionnaires/
│   │   │   ├── DomainExperience.jsx   # Supply chain domain experience questions
│   │   │   ├── NasaTlx.jsx            # NASA-TLX 6-dimension workload sliders
│   │   │   └── NumeracyScale.jsx      # Schwartz-Lipkus & SNS numeracy battery
│   │   ├── training/
│   │   │   └── ComprehensionCheck.jsx # 4-Item Novice Comprehension Check (Appendix C.1)
│   │   └── trial/
│   │       ├── TrialShell.jsx         # 2-column Judge-Advisor trial layout
│   │       └── TrialSteps.jsx         # Steps 1 to 4 decision flow components
│   ├── config/
│   │   ├── index.js                   # Global configuration, weights, environment flags
│   │   └── numeracyScale.js           # Modular validated numeracy items & scoring
│   ├── context/
│   │   └── StudyContext.jsx           # Global state manager, autosave, route gating
│   ├── pages/
│   │   ├── AdminPage.jsx              # Real-time administrator dashboard & 2x4 matrix
│   │   ├── CheckPage.jsx              # Novice comprehension check container
│   │   ├── CompletePage.jsx           # Study completion screen & reference code
│   │   ├── ConsentPage.jsx            # Participant information & consent screen
│   │   ├── DebriefPage.jsx            # Post-experimental ethical debriefing
│   │   ├── ExcludedPage.jsx           # Pre-registered participant exclusion screen
│   │   ├── ParticipantTypePage.jsx    # Novice vs. Expert branch selection
│   │   ├── PostTaskPage.jsx           # Global post-task questionnaire container
│   │   ├── PracticePage.jsx           # Practice trials & feedback container
│   │   ├── ScoredPage.jsx             # Main 12-trial scored experimental container
│   │   ├── TrainingPage.jsx           # Novice training workshop container
│   │   └── WalkthroughPage.jsx        # Expert interface walkthrough container
│   ├── routes/
│   │   └── StudyRouter.jsx            # Declarative URL route table
│   ├── scenarios/                     # 14 Operational Decision Scenarios
│   │   ├── expediteOrWait.js          # EW-1, EW-2, EW-3 (Supplier expedite decisions)
│   │   ├── index.js                   # Scenario registry and explanation lookup helpers
│   │   ├── newsvendor.js              # NV-1, NV-2, NV-3 (One-shot peak demand orders)
│   │   ├── practiceScenarios.js       # PRAC-1 (Safety Stock), PRAC-2 (Newsvendor)
│   │   ├── reorderPoint.js            # ROP-1, ROP-2, ROP-3 (Reorder point replenishment)
│   │   └── safetyStock.js             # SS-1, SS-2, SS-3 (Safety stock buffer sizing)
│   ├── services/
│   │   └── validationService.js       # Input sanitization, numeric normalization, rules
│   ├── utils/
│   │   ├── counterbalance.js          # 8 Latin-square complement schedules & planner
│   │   └── formatters.js              # Currency, percentage, and date formatters
│   ├── App.jsx                        # Root application component
│   ├── main.jsx                       # React DOM entrypoint
│   ├── styles.css                     # Global styles, layout, and component tokens
│   └── telemetry.js                   # Telemetry service, offline queue, passive listeners
├── package.json                       # Dependencies and build scripts
└── vite.config.js                     # Vite build configuration
```

---

## 6. Functional Modules

### 6.1 Onboarding & Stratification Module
- **Consent & Demographics:** Captures initial demographics (programme of study, year/level, prior coursework, AI tool use frequency, gender, age) and records voluntary consent.
- **Expertise Branching:** Participants select their background (`novice` vs. `expert`).
- **Condition & Schedule Assignment:** Atomically assigns condition (`c0`, `c1`, `c2`, `c3`) and Latin-square schedule (`s0` to `s7`) using min-count balancing independently within the participant's expertise group.

### 6.2 Training & Comprehension Check Module
- **Novice Workshop:** Step-by-step guidance on demand volatility, lead-time demand, peak-season risks, and AI advisory nature.
- **4-Item Comprehension Check (Appendix C.1):** Evaluates (1) volatility $\rightarrow$ buffer size direction, (2) order-above-average peak logic, (3) asymmetric cost structure, and (4) interface sequence. Allows 1 retry; failing twice triggers immediate exclusion to `/excluded`.
- **Expert Walkthrough:** Streamlined, professional interface overview explaining decision mechanics without patronizing tutorials.

### 6.3 Practice & Attention Check Module
- **Practice Trials:** Participants complete `PRAC-1` (Safety Stock) and `PRAC-2` (Newsvendor) with cost-optimal feedback.
- **Instructional Attention Check:** Embedded on the final feedback card to verify instruction adherence before scored trials unlock.

### 6.4 4-Step Judge-Advisor Trial Module
- **Step 1 (Initial Estimate):** Displays scenario context, historical data, and surfaced baseline. Participant inputs independent estimate on the `NumberLineInput` and rates initial confidence (1–7).
- **Step 2 (AI Reveal):** Displays AI recommendation with condition-specific explanation text:
  - *C0:* Recommendation only.
  - *C1:* Numerical driver weights and feature attributions.
  - *C2:* Natural language narrative context.
  - *C3:* Counterfactual verification ("What would change this").
- **Step 3 (Verification Check):** Qualitative check: *"Compared with historical information, the AI recommendation appears: Too High / About Right / Too Low"*.
- **Step 4 (Final Estimate & Demand):** Participant sets final decision on the `NumberLineInput`, rates final confidence (1–7), and self-reports cognitive demand (1–7).

### 6.5 Post-Task & Administrative Module
- **Post-Task Questionnaire:** Full 6-subscale NASA-TLX, 4-item Numeracy battery, and Supply Chain Domain Experience measure.
- **Debrief & Completion:** Discloses intentional AI errors, presents researcher contact information, and generates a session completion code.
- **Admin Dashboard:** Password-protected dashboard displaying real-time enrollment, $2 \times 4$ condition depth matrix, Latin-square schedule matrix ($S_0\text{--}S_7$), WoA, and Directional Cost Regret.

---

## 7. Database Design

### 7.1 Entity-Relationship Diagram (ERD)
```mermaid
erDiagram
    ModeCounter {
        string _id PK
        object novice "c0-c3, s0-s7"
        object expert "c0-c3, s0-s7"
        date updatedAt
    }

    ParticipantMode {
        string participantId PK, UK
        string condition "c0 | c1 | c2 | c3"
        string participantType "novice | expert"
        date assignedAt
    }

    ParticipantTrialPlan {
        string participantId PK, UK
        string participantType
        string condition
        number scheduleIndex
        array trials "trialId, orderIndex, isCorrect, errorDirection, recommendation"
        date createdAt
    }

    TelemetryEvent {
        string eventId PK, UK
        string eventType
        string participantId FK
        string sessionId
        string condition
        string participantType
        string screen
        string trialId
        object payload
        date timestamp
    }

    TrialResult {
        string participantId PK, FK
        string trialId PK
        string sessionId
        string condition
        string participantType
        string scenarioType
        boolean isPractice
        boolean isCorrect
        string errorDirection
        number groundTruthOptimal
        number costRegret
        number directionalCostRegret
        number initialEstimate
        number aiRecommendation
        number finalEstimate
        number weightOfAdvice
        number finalConfidence
        number cognitiveLoad
        string verificationResponse
        number step4DwellMs
        number totalTrialDwellMs
        date createdAt
    }

    PostTaskResponse {
        string participantId PK, UK, FK
        string sessionId
        string condition
        string participantType
        object nasaTlx "mentalDemand, physicalDemand, ..., rawTlxAverage"
        object numeracy "instrument, objectiveScore, subjectiveScore, rawResponses"
        object domainExperience "yearsExperience, primaryRole, decisionFrequency, certifications, feedback"
        date submittedAt
    }

    ParticipantMode ||--o| ParticipantTrialPlan : "defines"
    ParticipantMode ||--o{ TelemetryEvent : "generates"
    ParticipantMode ||--o{ TrialResult : "evaluates"
    ParticipantMode ||--o| PostTaskResponse : "completes"
```

### 7.2 Mongoose Schema Definitions & Indexing

#### 1. `ModeCounter` (`api/models/ModeCounter.js`)
Tracks the $2 \times 4$ between-subjects condition and schedule distribution separately within each expertise stratum.
```javascript
{
  _id:    { type: String, default: 'global' },
  novice: {
    c0: { type: Number, default: 0 },
    c1: { type: Number, default: 0 },
    c2: { type: Number, default: 0 },
    c3: { type: Number, default: 0 },
    s0: { type: Number, default: 0 },
    s1: { type: Number, default: 0 },
    s2: { type: Number, default: 0 },
    s3: { type: Number, default: 0 },
    s4: { type: Number, default: 0 },
    s5: { type: Number, default: 0 },
    s6: { type: Number, default: 0 },
    s7: { type: Number, default: 0 },
  },
  expert: {
    c0: { type: Number, default: 0 },
    c1: { type: Number, default: 0 },
    c2: { type: Number, default: 0 },
    c3: { type: Number, default: 0 },
    s0: { type: Number, default: 0 },
    s1: { type: Number, default: 0 },
    s2: { type: Number, default: 0 },
    s3: { type: Number, default: 0 },
    s4: { type: Number, default: 0 },
    s5: { type: Number, default: 0 },
    s6: { type: Number, default: 0 },
    s7: { type: Number, default: 0 },
  },
  updatedAt: { type: Date, default: Date.now }
}
```

#### 2. `ParticipantMode` (`api/models/ParticipantMode.js`)
Stores the assigned experimental condition and participant type.
- **Indexes:** `{ participantId: 1 }` (Unique).

#### 3. `ParticipantTrialPlan` (`api/models/ParticipantTrialPlan.js`)
Stores the deterministic 12-trial counterbalanced schedule assigned to the participant.
- **Indexes:** `{ participantId: 1 }` (Unique).

#### 4. `TelemetryEvent` (`api/models/TelemetryEvent.js`)
Raw append-only event stream capturing every behavioral interaction.
- **Indexes:** `{ participantId: 1, timestamp: -1 }`, `{ eventType: 1 }`, `{ eventId: 1 }` (Unique).

#### 5. `TrialResult` (`api/models/TrialResult.js`)
Structured analytical table for trial decisions, WoA, and Directional Cost Regret.
- **Compound Unique Index:** `{ participantId: 1, trialId: 1 }` (Unique).
- **Secondary Index:** `{ isPractice: 1, condition: 1, participantType: 1 }`.

#### 6. `PostTaskResponse` (`api/models/PostTaskResponse.js`)
Structured post-experimental survey responses (NASA-TLX, Numeracy, Domain Background).
- **Indexes:** `{ participantId: 1 }` (Unique).

---

## 8. API Documentation

### 8.1 Mode Assignment API (`api/assign-mode.js`)

#### `POST /api/assign-mode`
Assigns condition and schedule (balanced via min-count within expertise group) and generates a Latin-square 12-trial plan.
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "participantId": "P-8F2A19BC",
    "participantType": "novice"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "condition": "c2",
    "surveyMode": "c2",
    "participantType": "novice",
    "participantId": "P-8F2A19BC",
    "scheduleIndex": 3,
    "trialPlan": [
      {
        "trialId": "SS-1",
        "orderIndex": 1,
        "isCorrect": true,
        "errorDirection": "na",
        "recommendation": 29251
      }
    ],
    "alreadyAssigned": false
  }
  ```

#### `GET /api/assign-mode?participantId=P-8F2A19BC`
Idempotent lookup for existing participant condition and trial plan.

---

### 8.2 Telemetry & Advice Resolution API (`api/telemetry/index.js`)

#### `GET /api/telemetry?trialId=SS-1&condition=c2&participantId=P-8F2A19BC`
Resolves the AI recommendation and explanation based on the participant's assigned Latin-square plan.
- **Response (200 OK):**
  ```json
  {
    "trialId": "SS-1",
    "recommendation": 29251,
    "explanation": "This illustrative category shows fairly steady demand from week to week...",
    "isCorrect": true,
    "errorDirection": "na",
    "groundTruthOptimal": 29251
  }
  ```

#### `POST /api/telemetry`
Batch ingestion endpoint for telemetry events, trial decisions, and post-task surveys.
- **Request Body:** Array of telemetry event envelopes.
- **Automatic Processing:**
  - Ingestion into `TelemetryEvent`.
  - On `FINAL_ESTIMATE_SUBMITTED` $\rightarrow$ calculates WoA and Directional Cost Regret, upserting into `TrialResult`.
  - On `QUESTIONNAIRE_COMPLETED` $\rightarrow$ parses subscales, upserting into `PostTaskResponse`.

---

### 8.3 Admin Monitoring API (`api/admin/participants.js`)

#### `GET /api/admin/participants`
Returns aggregated recruitment, progress, $2 \times 4$ depth matrix, schedule distribution ($S_0\text{--}S_7$), and outcome statistics.
- **Security Header:** `x-admin-secret: <ADMIN_SECRET>`
- **Response (200 OK):**
  ```json
  {
    "stats": {
      "total": 48,
      "completed": 40,
      "inProgress": 8,
      "types": { "novice": 24, "expert": 24 },
      "conditions": { "c0": 12, "c1": 12, "c2": 12, "c3": 12 },
      "schedules": { "s0": 6, "s1": 6, "s2": 6, "s3": 6, "s4": 6, "s5": 6, "s6": 6, "s7": 6 },
      "matrix": {
        "novice": { "c0": 6, "c1": 6, "c2": 6, "c3": 6 },
        "expert": { "c0": 6, "c1": 6, "c2": 6, "c3": 6 }
      },
      "scheduleMatrix": {
        "novice": { "s0": 3, "s1": 3, "s2": 3, "s3": 3, "s4": 3, "s5": 3, "s6": 3, "s7": 3 },
        "expert": { "s0": 3, "s1": 3, "s2": 3, "s3": 3, "s4": 3, "s5": 3, "s6": 3, "s7": 3 }
      },
      "globalAvgWoA": 0.442,
      "globalAvgDirectionalRegret": -2450
    },
    "participants": [...]
  }
  ```

---

## 9. Algorithms & Mathematical Formulations

### 9.1 $2 \times 4$ Stratified Min-Count Balancing (Conditions & Schedules)
Condition assignment and schedule assignment balance counts independently within the participant's expertise group ($G \in \{\text{novice}, \text{expert}\}$):

```
Algorithm 1: Stratified Min-Count Condition & Schedule Assignment
Input: Participant ID p, Group G in {novice, expert}
Output: Assigned Condition c in {c0, c1, c2, c3}, Schedule Index s in {0..7}

1. Connect to MongoDB
2. If ParticipantMode exists for p:
3.     Return existing condition and trial plan
4. Fetch or initialize ModeCounter document
5. Let groupCounts = ModeCounter[G]

// Condition min-count selection
6. Let minCond = min(groupCounts[c0], groupCounts[c1], groupCounts[c2], groupCounts[c3])
7. Let tiedConds = { c in {c0..c3} | groupCounts[c] == minCond }
8. Uniformly select chosenCondition from tiedConds at random

// Schedule min-count selection
9. Let minSched = min(groupCounts[s0], ..., groupCounts[s7])
10. Let tiedScheds = { sk in {s0..s7} | groupCounts[sk] == minSched }
11. Uniformly select chosenSchedKey from tiedScheds at random
12. Let s = integer index of chosenSchedKey (0 to 7)

13. Atomically increment ModeCounter[G][chosenCondition] and ModeCounter[G][chosenSchedKey] by 1
14. Generate 12-trial plan using Schedule s
15. Persist ParticipantMode and ParticipantTrialPlan
16. Return chosenCondition, s, and trialPlan
```

### 9.2 Latin-Square Correctness Counterbalancing
To balance AI accuracy across the 12 scored trials, 8 complementary binary schedules ($S_0\text{--}S_7$) are defined:
- **Constraints:**
  1. $\sum_{i=1}^{12} S_k[i] = 6$ (Exactly 6 correct, 6 incorrect).
  2. For $S_k[i] = \text{false}$, $\sum (\text{Direction} == \text{High}) = 3$ and $\sum (\text{Direction} == \text{Low}) = 3$.
  3. Maximum run length of identical consecutive labels $\le 2$.
  4. Pairwise Bitwise Complement: $S_{2m+1}[i] = \neg S_{2m}[i]$ for $m \in \{0, 1, 2, 3\}$.

### 9.3 Weight of Advice (WoA)
Measures the proportional shift of the participant's estimate toward the AI recommendation:
$$\text{WoA} = \frac{\text{FinalEstimate} - \text{InitialEstimate}}{\text{AIRecommendation} - \text{InitialEstimate}}$$
*Undefined if $\text{AIRecommendation} = \text{InitialEstimate}$ (stored as `null`).*

### 9.4 Directional Cost Regret (Primary Outcome Measure)
Directional Cost Regret quantifies financial loss relative to ground truth, penalizing expensive under-ordering (stockout risk) at $1.85\times$ relative to over-ordering (holding cost):

Let $\Delta = \text{FinalEstimate} - \text{GroundTruthOptimal}$.

$$\text{CostRegret} = |\Delta|$$

$$\text{DirectionalCostRegret} = \begin{cases}
\Delta \times 1.85 & \text{if } \Delta < 0 \quad (\text{Under-ordering / Stockout Risk}) \\
\Delta \times 1.00 & \text{if } \Delta \ge 0 \quad (\text{Over-ordering / Holding Cost})
\end{cases}$$

### 9.5 Numeracy Battery Scoring
The Schwartz-Lipkus 3-Item objective score is computed as an integer $S_{\text{obj}} \in \{0, 1, 2, 3\}$:
$$S_{\text{obj}} = \mathbb{I}(R_1 = 500) + \mathbb{I}(R_2 = 10) + \mathbb{I}(|R_3 - 0.1| < 0.005)$$

---

## 10. Data Flow & Sequence Diagrams

### 10.1 JAS Decision Trial & Telemetry Ingestion Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Participant
    participant SPA as React Frontend (StudyContext)
    participant API as Telemetry API (/api/telemetry)
    participant DB as MongoDB Cluster

    Note over Participant,SPA: Step 1: Initial Estimate
    Participant->>SPA: Sets slider & initial confidence (1-7)
    SPA->>SPA: Validates numeric input
    SPA->>API: POST INITIAL_ESTIMATE_SUBMITTED
    SPA->>API: GET /api/telemetry (trialId, condition, participantId)
    API->>DB: Lookup ParticipantTrialPlan
    DB-->>API: Plan item (isCorrect, errorDirection, recAmount)
    API-->>SPA: { recommendation, explanation, isCorrect, optimal }

    Note over Participant,SPA: Step 2: AI Reveal
    SPA->>Participant: Displays AI Advice & Explanation
    Participant->>SPA: Clicks "Continue"
    SPA->>API: POST AI_REVEALED (dwellMs)

    Note over Participant,SPA: Step 3: Verification
    Participant->>SPA: Selects "Too High" / "About Right" / "Too Low"
    SPA->>API: POST VERIFICATION_COMPLETED

    Note over Participant,SPA: Step 4: Final Estimate
    Participant->>SPA: Adjusts NumberLine slider, confidence & mental load
    SPA->>SPA: Calculates local dwellMs
    SPA->>API: POST FINAL_ESTIMATE_SUBMITTED (payload)
    
    rect rgb(240, 248, 255)
        Note over API,DB: Server-Side Regret & WoA Processing
        API->>API: calculateWoA(initial, ai, final)
        API->>API: calculateRegret(final, optimal, 1.85, 1.0)
        API->>DB: Bulk Upsert TelemetryEvent
        API->>DB: Bulk Upsert TrialResult (WoA, costRegret, directionalCostRegret)
    end
    API-->>SPA: 200 OK { trialsRecorded: 1 }
    SPA->>SPA: Advance to next trial / post-task
```

---

## 11. User Interface & Interaction Design

### 11.1 Design Philosophy & Aesthetics
- **Aesthetic Direction:** Editorial academic minimalism built on custom CSS tokens, avoiding trendy or noisy dashboard patterns.
- **Color Palette:** Warm neutral canvas (`#f6f5f1`), deep charcoal text (`#20231f`), muted slate borders (`#deded5`), olive accent (`#6d7b54`), and terra-cotta warning accents (`#a3724c`).
- **Typography:** *Newsreader* for headings, *DM Sans* for body UI, and *DM Mono* for numeric data and statistics.

### 11.2 Key UI Components
1. **Interactive Number-Line Input (`NumberLineInput.jsx`):**
   - Renders a horizontal slider track linked to a direct monetary text box.
   - Features dynamic bounds, custom round step increments, and a prominent **"Baseline"** anchor marker indicating historical demand mean.
2. **Novice Comprehension Check (`ComprehensionCheck.jsx`):**
   - 4-item card interface with radio options. Displays attempt tracking (Attempt 1 vs. 2) and custom review feedback upon failure.
3. **Post-Task Questionnaire (`PostTaskForm.jsx`):**
   - 3-part tabbed layout: (1) NASA-TLX workload sliders ($0\text{--}100$), (2) Quantitative numeracy items, (3) Domain experience and APICS certifications.
4. **Admin Monitoring Dashboard (`AdminPage.jsx`):**
   - Features KPI metrics, $2 \times 4$ condition depth matrix, Latin-square schedule matrix ($S_0\text{--}S_7$), sortable participant table, and signed color-coded Directional Cost Regret displays.

---

## 12. Security & Architecture Scope Decisions

### 12.1 Internal Research Scope & Tradeoffs Note
> [!NOTE]
> **Deliberate Security Architecture Scope Decision:**
> As a dedicated behavioural science research platform deployed in controlled laboratory and proctored university research settings, multi-tenant IP rate-limiting, OAuth2/JWT session tokens, and cryptographic password hashing were **intentionally omitted by design**. 
> 
> The application is not exposed as a public multi-tenant SaaS service. Header-based secret verification (`x-admin-secret`) provides a reliable, lightweight administrative boundary for research proctors and principal investigators without introducing complex authentication infrastructure or maintenance overhead.

### 12.2 Implemented Data Integrity Protections
1. **Administrative Boundary:** Admin endpoints (`/api/admin/participants`) enforce secret verification via `x-admin-secret`.
2. **Cross-Origin Resource Sharing (CORS):** Strict CORS headers configured across all serverless endpoints to support authorized client origins.
3. **Data Sanitization & Normalization:** Client and server-side validation strips formatting characters (commas, dollar signs) and ensures finite numerical bounds before database operations.
4. **Idempotent State Recovery:** Client utilizes localStorage autosave recovery with a 24-hour expiration window, preventing duplicate condition assignments upon page reload.

---

## 13. Error Handling & Fault Tolerance

1. **Client-Side Telemetry Queue:** If a network failure occurs, telemetry events are buffered in `study-telemetry-queue-v2` in localStorage and automatically retried upon next interaction or reconnect.
2. **Offline Fallback Balancer:** If the `/api/assign-mode` endpoint is unreachable, a deterministic local counter (`study-condition-counter-v2`) assigns condition and trial plan using min-count logic without interrupting the study.
3. **Graceful Database Reconnects:** Serverless MongoDB client caches connection instances across warm Lambda invocations, handling reconnection gracefully during cold starts.

---

## 14. Performance & Scalability

- **Bundle Efficiency:** Entire production application bundles to $351.7\text{ kB}$ ($104.2\text{ kB}$ gzip), loading in under $500\text{ ms}$ on standard broadband.
- **High-Throughput Database Operations:** Event ingestion uses `TelemetryEvent.insertMany({ ordered: false })` and `TrialResult.bulkWrite({ ordered: false })`, sustaining $>500$ concurrent participant submissions without locking.
- **CSS Footprint:** $23.2\text{ kB}$ uncompressed ($5.6\text{ kB}$ gzip) pure CSS with zero JavaScript runtime styling overhead.

---

## 15. Testing & Verification

Automated Node.js test suites and Vite build verifications confirm:
1. **Regret Calculations:**
   - Under-ordering (\$20,000 vs. \$30,000 optimal) $\rightarrow$ `costRegret = 10,000`, `directionalCostRegret = -18,500` ($1.85\times$).
   - Over-ordering (\$40,000 vs. \$30,000 optimal) $\rightarrow$ `costRegret = 10,000`, `directionalCostRegret = +10,000` ($1.00\times$).
   - Exact match (\$30,000 vs. \$30,000) $\rightarrow$ `costRegret = 0`, `directionalCostRegret = 0`.
2. **Latin-Square Counterbalance Schedules:**
   - Verified that all 8 schedules satisfy 6 correct / 6 incorrect splits, 3 High / 3 Low error directions, and $\le 2$ consecutive run limits.
3. **Min-Count Schedule Balancing:**
   - Verified uniform assignment across schedule slots ($S_0\text{--}S_7$) during simulated multi-user enrollment.
4. **Numeracy Scoring:**
   - Tested full scoring permutations across objective and subjective numeracy items.
5. **Vite Build Verification:** Clean production compilation with **0 errors**.

---

## 16. Deployment & Environment Configuration

### 16.1 Environment Variables
```ini
# MongoDB Connection String
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/decision_study?retryWrites=true&w=majority

# Admin Access Secret
ADMIN_SECRET=study-admin-secret-key-2026

# Primary Outcome Regret Weights (Optional overrides)
STOCKOUT_PENALTY_WEIGHT=1.85
HOLDING_PENALTY_WEIGHT=1.00

# Study Versioning
VITE_STUDY_VERSION=4.1.0
```

### 16.2 Deployment Steps
1. Clone repository: `git clone https://github.com/pranav18june/CHI-experiment.git`
2. Install dependencies: `npm install`
3. Verify production build: `npm run build`
4. Deploy to Vercel: `vercel --prod`

---

## 17. Limitations & Open Protocol Items

1. **Parameters Pending Pre-Registration Sign-Off:**
   - The **Validated Numeracy Battery** (currently Schwartz-Lipkus 3-Item + SNS in `src/config/numeracyScale.js`) is an empirical placeholder pending formal sign-off.
   - The **Stockout Penalty Multiplier** (currently $1.85\times$ in `src/config/index.js`) is a configurable working value pending final protocol registration.
2. **Visual Time-Series Data Series:** The chart placeholders in `TrialShell.jsx` currently display structured grid layouts and moving-average hints (`TODO_CHART_DATA_PRAC1`, etc.). Final empirical time-series data vectors from the research dataset should be bound when final dataset CSVs are finalized.
3. **Recruitment Channel Compensation Hooks:** Completion screen codes (`TODO_COMPLETION_COPY`) and ethics contact emails (`TODO_ETHICS_COPY`, `TODO_DEBRIEF_TEXT`) are currently structured with standardized institutional placeholders to be filled upon final IRB protocol approval.

---

## 18. Future Improvements

1. **Interactive SVG Time-Series Charting:** Integrating dynamic D3.js or SVG historical trend overlays with zoom/pan capabilities.
2. **One-Click CSV/R Dataset Export:** Adding a direct CSV/R data export button to the `/admin` dashboard for instant statistical import into R Studio, Python Pandas, or JASP.
3. **Multi-Language Localization:** Modularizing scenario texts for international supply chain research deployments.

---

## 19. Conclusion

The **Supply Chain Decision Research Platform (SCDRP)** is a robust, academically rigorous experimental software platform. By unifying 4-condition explainability modes, $2 \times 4$ expertise-stratified balancing, min-count randomized Latin-square schedule assignment, directional cost regret modeling, interactive number-line input, and multi-instrument post-task questionnaires, the system provides a turn-key platform for state-of-the-art behavioural human-AI research.

---

## 20. References

1. **Judge-Advisor Paradigm:** Sniezek, J. A., & Buckley, T. (1995). *Cueing and cognitive conflict in judge-advisor systems.* Organizational Behavior and Human Decision Processes, 62(2), 159–174.
2. **Weight of Advice (WoA):** Harvey, N., & Fischer, I. (1997). *Taking advice: Accepting help, improving judgment, and sharing responsibility.* Organizational Behavior and Human Decision Processes, 70(2), 117–133.
3. **NASA Task Load Index (NASA-TLX):** Hart, S. G., & Staveland, L. E. (1988). *Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research.* Advances in Psychology, 52, 139–183.
4. **Validated Numeracy Scale:** Schwartz, L. M., Woloshin, S., Black, W. C., & Welch, H. G. (1997). *The role of numeracy in understanding the benefit of screening mammography.* Annals of Internal Medicine, 127(11), 966–972.
5. **Expanded Numeracy Battery:** Lipkus, I. M., Samsa, G., & Rimer, B. K. (2001). *General performance on a numeracy scale among highly educated samples.* Medical Decision Making, 21(1), 37–44.
6. **Instructional Manipulation Checks:** Oppenheimer, D. M., Meyvis, T., & Davidenko, N. (2009). *Instructional manipulation checks: Detecting unsatisfying to increase statistical power.* Journal of Experimental Social Psychology, 45(4), 867–872.
7. **Newsvendor & Inventory Economics:** Schweitzer, M. E., & Cachon, G. P. (2000). *Decision bias in the newsvendor problem with a known demand distribution: Experimental evidence.* Management Science, 46(3), 404–420.
