import type { Activity } from '../types/index'

/** A pair of thresholds defining the 3-zone status model. */
export type ThresholdBand = {
  low:  number
  high: number
}

export type RowState = 'Concluída' | 'Em dia' | 'Em risco' | 'Em atraso'

// ── Module-level thresholds (set once at app startup via setThresholds) ───────
// Defaults are based on the 3-zone model from Wave 3a migration.
let THRESHOLD_AGGREGATES: ThresholdBand = { low: 15, high: 25 }
let THRESHOLD_LEAVES:     ThresholdBand = { low: 5,  high: 10 }

/**
 * Set both thresholds from app_config. Called once in Layout on startup.
 * Fallback chain: new key → old key → hardcoded default.
 */
export function setThresholds(aggregates: ThresholdBand, leaves: ThresholdBand): void {
  THRESHOLD_AGGREGATES = aggregates
  THRESHOLD_LEAVES     = leaves
}

/**
 * Compute 3-zone status from a delay delta (target - actual, in pp).
 * - delta <= band.low    → Em dia
 * - delta <= band.high   → Em risco
 * - delta > band.high    → Em atraso
 */
function statusFromDelta(delta: number, band: ThresholdBand): RowState {
  if (delta <= band.low)  return 'Em dia'
  if (delta <= band.high) return 'Em risco'
  return 'Em atraso'
}

/**
 * Date-based % prevista (0-100) for a single activity.
 * - today <= bs  → 0
 * - today >= bf  → 100
 * - else         → linear interpolation
 * Falls back to stored pct_prev when baseline dates are missing.
 */
export function leafPctPrev(a: Activity, today: string): number {
  const bf = a.bf ?? a.finish
  if (!a.bs || !bf) return a.pct_prev
  const now   = new Date(today).getTime()
  const start = new Date(a.bs).getTime()
  const end   = new Date(bf).getTime()
  if (now <= start) return 0
  if (now >= end)   return 100
  if (end <= start) return 100
  return ((now - start) / (end - start)) * 100
}

/** Average % prevista (0-100), date-derived. Pass N4 leaves only. */
export function rollupPctPrev(activities: Activity[], today: string): number {
  if (activities.length === 0) return 0
  return activities.reduce((s, a) => s + leafPctPrev(a, today), 0) / activities.length
}

/**
 * 4-state status from already-computed actual vs target percentages.
 * Uses 3-zone aggregates threshold band.
 *
 * NOTE: This function does NOT consider deadlines. If a caller has access
 * to the full activities array, prefer getEffectiveStatus(activity, all, today)
 * which handles date-based overrides and recursion correctly.
 */
export function computeRowState(
  actual: number,
  target: number,
  band: ThresholdBand = THRESHOLD_AGGREGATES,
): RowState {
  if (actual >= 100) return 'Concluída'
  const delta = target - actual
  return statusFromDelta(delta, band)
}

export function getThresholdAggregates(): ThresholdBand {
  return THRESHOLD_AGGREGATES
}

export function getThresholdLeaves(): ThresholdBand {
  return THRESHOLD_LEAVES
}

/** Earliest bs / latest bf across activities. Pass N4 leaves only. */
export function rollupDateRange(activities: Activity[]): { bs: string | null; bf: string | null } {
  let minBs: string | null = null
  let maxBf: string | null = null
  for (const a of activities) {
    if (a.bs && (!minBs || a.bs < minBs)) minBs = a.bs
    const end = a.bf ?? a.finish
    if (end && (!maxBf || end > maxBf)) maxBf = end
  }
  return { bs: minBs, bf: maxBf }
}

/** Earliest rs / latest rf across activities. Pass N4 leaves only. */
export function rollupRealDateRange(activities: Activity[]): { rs: string | null; rf: string | null } {
  let minRs: string | null = null
  let maxRf: string | null = null
  for (const a of activities) {
    if (a.rs && (!minRs || a.rs < minRs)) minRs = a.rs
    if (a.rf && (!maxRf || a.rf > maxRf)) maxRf = a.rf
  }
  return { rs: minRs, rf: maxRf }
}

/**
 * Returns the direct children of an activity (level + 1, matched by name
 * in the corresponding n{level} column plus all ancestor n columns).
 * Returns [] for level 6 (no children in this domain).
 */
export function getDirectChildren(activity: Activity, all: Activity[]): Activity[] {
  const L = activity.level
  if (L < 3 || L > 5) return []

  return all.filter(a => {
    if (a.level !== L + 1) return false
    const parentField = `n${L}` as keyof Activity
    if (a[parentField] !== activity.name) return false
    if (L >= 1 && a.n1 !== activity.n1) return false
    if (L >= 2 && a.n2 !== activity.n2) return false
    if (L >= 3 && a.n3 !== activity.n3) return false
    if (L >= 4 && a.n4 !== activity.n4) return false
    return true
  })
}

/**
 * Recursive bottom-up effective pct for any activity at level 3-6.
 * Leaf (no children in `all`) → returns own pct.
 * With children → simple average of effectivePct(child) for each direct child.
 */
export function getEffectivePct(activity: Activity, all: Activity[]): number {
  const children = getDirectChildren(activity, all)
  if (children.length === 0) return activity.pct
  const sum = children.reduce((s, c) => s + getEffectivePct(c, all), 0)
  return sum / children.length
}

/**
 * Aggregate effective pct: simple average of getEffectivePct over leaves.
 * Handles N4 leaves that themselves have N5/N6 descendants.
 * `all` must be the full activity array so descendants can be resolved.
 */
export function rollupEffectivePct(leaves: Activity[], all: Activity[]): number {
  if (leaves.length === 0) return 0
  const sum = leaves.reduce((s, leaf) => s + getEffectivePct(leaf, all), 0)
  return sum / leaves.length
}

/**
 * Collect all leaf descendants (activities with no children of their own)
 * under the given activity, recursively. If the activity itself is a leaf,
 * returns [activity].
 */
export function getDescendantLeaves(activity: Activity, all: Activity[]): Activity[] {
  const children = getDirectChildren(activity, all)
  if (children.length === 0) return [activity]
  return children.flatMap(c => getDescendantLeaves(c, all))
}

/** True when the activity (or any descendant leaf) has baseline dates. */
function hasDatedLeaf(activity: Activity, all: Activity[]): boolean {
  const children = getDirectChildren(activity, all)
  if (children.length === 0) return !!(activity.bs && (activity.bf ?? activity.finish))
  return children.some(c => hasDatedLeaf(c, all))
}

/**
 * Recursive effective target pct (0-100) for any activity.
 * Leaf → leafPctPrev (date-derived or stored pct_prev).
 * Has children → average getEffectiveTarget over children that have dated leaves;
 *   dateless branches are excluded; returns 0 if no dated branch exists.
 * Mirrors getEffectivePct's recursion so the two are always comparable.
 */
export function getEffectiveTarget(activity: Activity, all: Activity[], today: string): number {
  const children = getDirectChildren(activity, all)
  if (children.length === 0) return leafPctPrev(activity, today)
  const contributing = children.filter(c => hasDatedLeaf(c, all))
  if (contributing.length === 0) return 0
  const sum = contributing.reduce((s, c) => s + getEffectiveTarget(c, all, today), 0)
  return sum / contributing.length
}

/**
 * Effective baseline and real dates for any activity in the hierarchy.
 * Leaf → own stored dates.
 * Has children → min(bs)/max(bf) and min(rs)/max(rf) over all descendant leaves.
 * rs/rf remain null when no descendant leaf has real-date data (no baseline fallback).
 */
export function getEffectiveDates(activity: Activity, all: Activity[]): {
  bs: string | null; bf: string | null; rs: string | null; rf: string | null
} {
  const children = getDirectChildren(activity, all)
  if (children.length === 0) {
    return { bs: activity.bs, bf: activity.bf, rs: activity.rs, rf: activity.rf }
  }
  const leaves = getDescendantLeaves(activity, all)
  const { bs, bf } = rollupDateRange(leaves)
  const { rs, rf } = rollupRealDateRange(leaves)
  return { bs, bf, rs, rf }
}

/**
 * Unified effective status for any activity at any level.
 * Band is derived from activity.level (>= 3 → THRESHOLD_LEAVES, < 3 → THRESHOLD_AGGREGATES).
 * Resolution order:
 *   1. Concluída  — leaf pct >= 100, OR every descendant leaf pct >= 100 (per-leaf, not averaged)
 *   2. Em atraso  — effective bf in the past and effective pct < 100
 *   3. 3-zone delta vs band → Em dia / Em risco / Em atraso
 */
export function getEffectiveStatus(
  activity: Activity,
  all: Activity[],
  today: string,
): RowState {
  const band     = activity.level >= 3 ? THRESHOLD_LEAVES : THRESHOLD_AGGREGATES
  const children = getDirectChildren(activity, all)
  const leaves   = getDescendantLeaves(activity, all)

  let pct: number
  let bf: string | null
  let target: number

  if (children.length === 0) {
    pct    = activity.pct
    bf     = activity.bf ?? activity.finish
    target = leafPctPrev(activity, today)
  } else {
    pct    = getEffectivePct(activity, all)
    bf     = getEffectiveDates(activity, all).bf
    target = getEffectiveTarget(activity, all, today)
  }

  // Step 1 — Concluída
  if (children.length === 0) {
    if (pct >= 100) return 'Concluída'
  } else {
    if (leaves.length > 0 && leaves.every(l => l.pct >= 100)) return 'Concluída'
  }
  // Step 2 — Em atraso by deadline
  if (bf && today > bf && pct < 100) return 'Em atraso'
  // Step 3 — delta vs band
  return statusFromDelta(target - pct, band)
}

/**
 * Aggregate status for a virtual group row (N0-N4) that has no Activity object.
 * Uses the AGGREGATES or LEAVES band based on level (≥3 → LEAVES, <3 → AGGREGATES).
 * n4Leaves: the N4-level activities belonging to this group.
 * all: the full activity array for the page (needed to resolve N5/N6 descendants).
 */
export function getGroupStatus(
  n4Leaves: Activity[],
  all: Activity[],
  today: string,
  level: number,
): RowState {
  if (n4Leaves.length === 0) return 'Em dia'
  const band = level >= 3 ? THRESHOLD_LEAVES : THRESHOLD_AGGREGATES

  const pct = n4Leaves.reduce((s, n4) => s + getEffectivePct(n4, all), 0) / n4Leaves.length

  let bf: string | null = null
  for (const n4 of n4Leaves) {
    const d = getEffectiveDates(n4, all).bf
    if (d && (!bf || d > bf)) bf = d
  }

  const contributing = n4Leaves.filter(n4 => hasDatedLeaf(n4, all))
  const target = contributing.length > 0
    ? contributing.reduce((s, n4) => s + getEffectiveTarget(n4, all, today), 0) / contributing.length
    : 0

  const allLeaves = n4Leaves.flatMap(n4 => getDescendantLeaves(n4, all))
  if (allLeaves.length > 0 && allLeaves.every(l => l.pct >= 100)) return 'Concluída'
  if (bf && today > bf && pct < 100) return 'Em atraso'
  return statusFromDelta(target - pct, band)
}
