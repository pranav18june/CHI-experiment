/**
 * Central Scenario Registry & Engine Helper API
 *
 * Imports all 4 decision families:
 *   - Safety Stock (3)
 *   - Newsvendor (3)
 *   - Reorder Point (3)
 *   - Expedite or Wait (3)
 * Plus Practice Scenarios (2)
 *
 * Exports normalized registries and lookup functions so UI components never
 * hardcode scenario text or business logic.
 */

import { safetyStockScenarios } from './safetyStock.js'
import { newsvendorScenarios } from './newsvendor.js'
import { reorderPointScenarios } from './reorderPoint.js'
import { expediteOrWaitScenarios } from './expediteOrWait.js'
import { practiceScenarios } from './practiceScenarios.js'

// ── Decision Family / Type definitions ────────────────────────────────────────
export const decisionFamilies = {
  safetyStock: {
    id: 'safetyStock',
    label: 'Safety stock',
    shortLabel: 'Safety stock buffer',
    decisionLabel: 'Safety stock level',
    chartLabel: 'Weekly sales history',
  },
  newsvendor: {
    id: 'newsvendor',
    label: 'Peak-week order',
    shortLabel: 'Newsvendor',
    decisionLabel: 'Order amount',
    chartLabel: 'Historical peak-week sales',
  },
  reorderPoint: {
    id: 'reorderPoint',
    label: 'Reorder point',
    shortLabel: 'Reorder point',
    decisionLabel: 'Reorder point',
    chartLabel: 'Historical demand and lead-time data',
  },
  expediteOrWait: {
    id: 'expediteOrWait',
    label: 'Expedite or wait',
    shortLabel: 'Expedite decision',
    decisionLabel: 'Expedite payment',
    chartLabel: 'Historical delay and demand data',
  },
}

// ── Grouped scenarios ─────────────────────────────────────────────────────────
export const scenariosGrouped = {
  safetyStock:    safetyStockScenarios,
  newsvendor:     newsvendorScenarios,
  reorderPoint:   reorderPointScenarios,
  expediteOrWait: expediteOrWaitScenarios,
}

// ── Scored scenarios (12 total) ───────────────────────────────────────────────
export const scenarios = [
  ...safetyStockScenarios,
  ...newsvendorScenarios,
  ...reorderPointScenarios,
  ...expediteOrWaitScenarios,
]

// ── Practice scenarios (2 total) ──────────────────────────────────────────────
export { practiceScenarios }

// ── Scenario Engine Helper Functions ──────────────────────────────────────────

/**
 * Returns a scenario by ID.
 */
export function getScenarioById(id) {
  return [...scenarios, ...practiceScenarios].find((s) => s.id === id) || null
}

/**
 * Returns explanation text for a scenario, condition, and correctness version.
 *
 * @param {object} scenario - Scenario object
 * @param {string} conditionKey - 'c0' | 'c1' | 'c2' | 'c3'
 * @param {boolean} [isCorrect=false] - Whether this trial is assigned the cost-optimal version
 */
export function getExplanation(scenario, conditionKey, isCorrect = false) {
  if (!scenario || conditionKey === 'c0') return null

  // Correct and incorrect trials draw from separate stimulus banks, and never
  // fall back to each other — serving the opposite version's text would silently
  // swap the correctness manipulation.
  const bank = isCorrect ? scenario.correctExplanations : scenario.explanations
  return bank?.[conditionKey] ?? null
}

/**
 * Resolves prompt string for initial vs final decision step.
 */
export function getDecisionPrompt(scenario, step) {
  if (!scenario || !scenario.decisionPrompt) return ''
  if (typeof scenario.decisionPrompt === 'string') return scenario.decisionPrompt
  return step === 1 ? scenario.decisionPrompt.initial : scenario.decisionPrompt.final
}
