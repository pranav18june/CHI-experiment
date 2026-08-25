/**
 * The "AI" optimizers (Protocol §5.4, Appendix B.3).
 *
 * Every stimulus value in the bank is an output of one of these functions, and
 * every incorrect recommendation is the same function evaluated with exactly one
 * biased input (B.4). Keeping the formulas here — rather than as numbers typed
 * into the scenario files — is what makes the pipeline auditable: the preflight
 * check re-runs each optimizer against each scenario's stored parameters and
 * asserts it reproduces the stored value.
 *
 * Constants are disclosed to reviewers, never to participants (§5.10).
 */

/** Safety stock. Z = 1.645 (95% service level), lead time in weeks. */
export function safetyStock({ demandStd, zScore = 1.645, leadTimeWeeks = 2 }) {
  return zScore * demandStd * Math.sqrt(leadTimeWeeks)
}

/** Newsvendor order-up-to level. z = Φ⁻¹(0.65) ≈ 0.385 for a 0.65 critical ratio. */
export function newsvendor({ peakWeekDemandMean, peakWeekDemandStd, zScore = 0.385 }) {
  return peakWeekDemandMean + zScore * peakWeekDemandStd
}

/**
 * Reorder point with combined demand and lead-time variability.
 * σ_DL = √(L̄·σ_d² + d̄²·σ_L²) — the standard result when both vary.
 */
export function reorderPoint({
  dailyDemandMean, dailyDemandStd, leadTimeMeanDays, leadTimeStdDays, zScore = 1.645,
}) {
  const sigmaDL = Math.sqrt(
    leadTimeMeanDays * dailyDemandStd ** 2 + dailyDemandMean ** 2 * leadTimeStdDays ** 2
  )
  return dailyDemandMean * leadTimeMeanDays + zScore * sigmaDL
}

/**
 * Expedite payment: the expected cost avoided by pulling a shipment forward.
 *
 * Assumes a day out of stock forfeits that day's revenue (sales lost, not
 * deferred) — stated in the scenario metadata as `costAssumption`, because the
 * source data records prices but not margins.
 */
export function expeditePayment({
  lateDeliveryProbability, delayDaysWhenLate, revenueLostPerStockoutDay,
}) {
  return lateDeliveryProbability * delayDaysWhenLate * revenueLostPerStockoutDay
}

/**
 * Recomputes a scenario's cost-optimal value from its own stored parameters.
 * Returns null when the scenario does not carry a reproducible parameter set.
 */
export function optimumFor(scenario) {
  const m = scenario?.metadata
  if (!m || m.reproducible !== true) return null
  switch (scenario.scenarioType) {
    case 'safetyStock':
      return safetyStock({
        demandStd: m.demandStd ?? m.demandStdDev,
        zScore: m.zScore, leadTimeWeeks: m.leadTimeWeeks,
      })
    case 'newsvendor':
      return newsvendor({
        peakWeekDemandMean: m.peakWeekDemandMean ?? m.holidayWeekMean,
        peakWeekDemandStd: m.peakWeekDemandStd ?? m.holidayWeekStdDev,
        zScore: m.zScore,
      })
    case 'reorderPoint':
      return reorderPoint(m)
    case 'expediteOrWait':
      return expeditePayment(m)
    default:
      return null
  }
}

/**
 * Recomputes the incorrect recommendation: the same optimizer with the single
 * biased input named by `perturbedParameter` substituted in.
 */
export function perturbedFor(scenario) {
  const m = scenario?.metadata
  if (!m || m.reproducible !== true || !m.perturbedParameter) return null
  const biased = { ...m, [m.perturbedParameter]: m.perturbedValue }
  return optimumFor({ ...scenario, metadata: biased })
}
