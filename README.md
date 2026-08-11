# Supply Chain Decision Research Platform

A single-page React 19 + Vite application designed for controlled behavioural research in supply chain inventory decision-making under AI assistance (Judge–Advisor paradigm).

---

## 🔬 Study Overview

- **Protocol Version:** 4.1.0
- **Paradigm:** Judge–Advisor (Initial Estimate → AI Reveal → Verification → Final Estimate)
- **Experimental Conditions:** 4 (`c0` Recommendation Only, `c1` Numerical, `c2` Narrative, `c3` Counterfactual)
- **Decision Families:** 4 (Safety Stock, Newsvendor, Reorder Point, Expedite or Wait)
- **Scored Scenarios:** 12 total scenarios across the 4 decision families
- **Participant Branches:** Novice (Training + Check) vs. Expert (Walkthrough)

---

## 🛠️ Tech Stack & Architecture

- **Core:** React 19, Vite, Vanilla CSS design system
- **State Management:** Custom hook architecture (`useStudyWorkflow`)
- **Telemetry:** Resilient client-side queueing (`localStorage`) + REST API abstraction with keepalive transport
- **Deployment:** GitHub repository compatible with Vercel SPA hosting

---

## 📁 Project Structure

```
src/
├── components/
│   ├── common/         # Reusable UI controls (Header, Scale, ChoiceList)
│   ├── trial/          # Trial shell and step-specific renderers (Step1-4)
│   └── pages/          # Full-page orientation & post-trial screens
├── config/             # Study configuration, feature flags, constants
├── hooks/              # Custom hooks (useStudyWorkflow state machine)
├── scenarios/          # Scenario Engine data definitions & index registry
│   ├── safetyStock.js
│   ├── newsvendor.js
│   ├── reorderPoint.js
│   ├── expediteOrWait.js
│   ├── practiceScenarios.js
│   └── index.js
├── services/           # Business logic & form validation rules
├── telemetry.js        # Centralized Telemetry & Data Capture Service
├── studyData.js        # Re-export manifest & orientation cards
├── utils/              # Formatters, logger, math helpers
├── styles.css          # Design system stylesheet
├── App.jsx             # Root orchestrator controller
└── main.jsx            # Application entry point
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## 🌐 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Telemetry backend endpoint URL | `""` |
| `VITE_STUDY_VERSION` | Study protocol version | `"4.1.0"` |
| `VITE_LOG_LEVEL` | Logging level (`development`, `production`, `silent`) | `"development"` |
| `VITE_ENABLE_PRACTICE_MODE` | Feature flag to enable/disable practice round | `"true"` |

---

## 📜 Deployment

The project builds static assets into the `dist/` directory, optimized for zero-configuration hosting on **Vercel** or **GitHub Pages**.
