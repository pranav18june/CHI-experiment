/**
 * Number-line scale bounds (Protocol §5.9, §12 item 6)
 *
 * Extracted from the input component so the bounds can be unit-tested and
 * audited independently of React.
 */
/**
 * Calculates dynamic per-scenario number-line bounds (min, max, step, anchor).
 *
 * Ensures:
 *   - Scale is wide enough to contain both the ground-truth optimum and the AI recommendation.
 *   - Anchored to the product's historical demand / benchmark.
 *   - Uses clean, intuitive round numbers for bounds and step intervals.
 */
export function getScenarioScaleBounds(scenario) {
  if (!scenario) {
    return { min: 0, max: 100000, step: 100, anchor: null }
  }

  // Protocol §5.9 / §12 item 6: the response scale is anchored to the product's
  // historical demand, declared per scenario in `numberLine`.
  //
  // It must NOT be derived from the ground truth or the AI value. Deriving the
  // band from those two put the cost-optimal answer at a fixed, learnable
  // position on every slider (near centre, opposite the AI marker), which let a
  // participant score without reading the chart — contaminating the primary DV
  // in exactly the direction the study measures. The declared bands also vary
  // the optimum's relative position from trial to trial, and are pilot-settable
  // independently of the answer.
  const declared = scenario.numberLine
  if (declared && Number.isFinite(declared.min) && Number.isFinite(declared.max)) {
    return {
      min: declared.min,
      max: declared.max,
      step: declared.step || 100,
      anchor: Number.isFinite(declared.anchor) ? declared.anchor : null,
    }
  }

  // Fallback for a scenario without a declared band: anchor on the historical
  // demand level recorded in metadata. Still never the optimum.
  const level = Number(
    scenario.metadata?.demandMean ??
    scenario.metadata?.peakWeekDemandMean ??
    scenario.metadata?.leadTimeDemandBase ??
    scenario.metadata?.expediteBaseCost ??
    1000
  )

  let step = 100
  if (level > 150000)      step = 500
  else if (level > 40000)  step = 250
  else if (level > 5000)   step = 50
  else if (level > 500)    step = 5
  else                     step = 1

  const min = 0
  const max = Math.ceil((level * 3) / (step * 5)) * (step * 5)

  return { min, max, step: step, anchor: null }
}

