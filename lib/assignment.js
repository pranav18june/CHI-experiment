/**
 * Atomic Balanced Assignment (Protocol §5.1, §5.6)
 *
 * Replaces read-then-write min-count selection, which raced under concurrent
 * starts: many participants read the same counter snapshot and picked the same
 * minimum. Here a single atomic `$inc` yields a sequence number, and the
 * sequence number *determines* the cell via permuted-block randomisation.
 *
 *   - Condition (c0–c3) is drawn from blocks of 4, so the 2×4 design is exactly
 *     balanced within each expertise group at every block boundary.
 *   - Correctness schedule (s0–s7) is drawn from blocks of 8, so every
 *     Latin-square complement pair is equally represented.
 *   - Order *within* a block is a seeded shuffle, so assignment is not
 *     predictable from position alone, and the two factors use different block
 *     sizes and different seed salts so they do not co-vary systematically.
 *
 * The mapping is a pure function of (group, seq), so an assignment can always be
 * recomputed and audited after the fact.
 */

import { VALID_PLAN_PAIRS, planPairForIndex } from '../src/utils/counterbalance.js'

export const CONDITIONS = ['c0', 'c1', 'c2', 'c3']
export const SCHEDULE_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']

const CONDITION_SALT = 0x9e3779b9
const PLAN_SALT = 0x85ebca6b

/** Deterministic 32-bit mix, so a block index becomes a well-spread seed. */
function mixSeed(group, blockIndex, salt) {
  let h = salt ^ (group === 'expert' ? 0x2545f491 : 0x1b873593)
  h = Math.imul(h ^ blockIndex, 0xcc9e2d51)
  h = (h << 13) | (h >>> 19)
  return (Math.imul(h, 5) + 0xe6546b64) >>> 0
}

/** Fisher–Yates with a seeded LCG — same seed always yields the same order. */
export function seededShuffle(items, seed) {
  const out = [...items]
  let state = seed >>> 0
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/**
 * Maps a 1-based sequence number to a condition and a counterbalancing plan.
 *
 * The plan is a (presentation order, correctness schedule) pair drawn from
 * VALID_PLAN_PAIRS — the set that satisfies every §5.6 constraint. Conditions
 * are drawn in blocks of 4 and plans in blocks of |VALID_PLAN_PAIRS|, each with
 * its own seeded shuffle, so the two factors do not co-vary systematically.
 *
 * @param {'novice'|'expert'} group
 * @param {number} seq - 1-based, from an atomic $inc
 */
export function assignmentForSequence(group, seq) {
  const n = Math.max(1, Math.floor(seq)) - 1

  const conditionBlock = Math.floor(n / CONDITIONS.length)
  const conditionOrder = seededShuffle(CONDITIONS, mixSeed(group, conditionBlock, CONDITION_SALT))
  const condition = conditionOrder[n % CONDITIONS.length]

  const planCount = VALID_PLAN_PAIRS.length
  const planIndices = Array.from({ length: planCount }, (_, i) => i)
  const planBlock = Math.floor(n / planCount)
  const planOrder = seededShuffle(planIndices, mixSeed(group, planBlock, PLAN_SALT))
  const planIndex = planOrder[n % planCount]

  const { orderIndex, scheduleIndex } = planPairForIndex(planIndex)

  return {
    condition,
    planIndex,
    orderIndex,
    scheduleIndex,
    scheduleKey: `s${scheduleIndex}`,
    conditionBlock,
    planBlock,
  }
}

/**
 * Server-issued participant identifier.
 *
 * Client-generated ids let a participant mint a fresh identity (and so a fresh
 * cell) by clearing local storage. The server issues the canonical id at
 * assignment time; the client adopts it and re-stamps anything it has already
 * queued.
 */
export function createServerParticipantId() {
  const bytes = new Uint8Array(9)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += b.toString(36).padStart(2, '0')
  return `P-${out.slice(0, 12).toUpperCase()}`
}
