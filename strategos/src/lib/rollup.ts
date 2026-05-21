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

/**
 * Derived status for a single leaf activity (level === 4) — 4-state model.
 * Resolution order (first match wins):
 *  1. pct >= 100                          → 'Concluída'
 *  2. today > bf AND pct < 100            → 'Em atraso' (deadline missed)
 *  3. 3-zone delta vs leaves thresholds   → Em dia / Em risco / Em atraso
 */
export function leafStatus(
  a: Activity,
  today: string,
  band: ThresholdBand = THRESHOLD_LEAVES,
): RowState {
  if (a.pct >= 100) return 'Concluída'
  const overdue = a.bf ? today > a.bf : false
  if (overdue) return 'Em atraso'
  const target = leafPctPrev(a, today)
  const delta  = target - a.pct
  return statusFromDelta(delta, band)
}

/** Average % execução (0-100). Pass N4 leaves only. */
export function rollupPct(activities: Activity[]): number {
  if (activities.length === 0) return 0
  return activities.reduce((s, a) => s + a.pct, 0) / activities.length
}

/** Average % prevista (0-100), date-derived. Pass N4 leaves only. */
export function rollupPctPrev(activities: Activity[], today: string): number {
  if (activities.length === 0) return 0
  return activities.reduce((s, a) => s + leafPctPrev(a, today), 0) / activities.length
}

/**
 * Rollup status from N4 leaves using date + schedule logic — 4-state model.
 * Resolution order (first match wins):
 *  1. leaves.length === 0                          → 'Em dia'
 *  2. All pct >= 100                               → 'Concluída'
 *  3. today > max(bf) AND avg pct < 100            → 'Em atraso' (group deadline missed)
 *  4. 3-zone delta vs aggregates thresholds        → Em dia / Em risco / Em atraso
 */
export function rollupStatus(
  leaves: Activity[],
  today: string,
  band: ThresholdBand = THRESHOLD_AGGREGATES,
): RowState {
  if (leaves.length === 0) return 'Em dia'
  if (leaves.every(a => a.pct >= 100)) return 'Concluída'
  const avgPct = leaves.reduce((s, a) => s + a.pct, 0) / leaves.length
  const maxBf  = leaves.reduce((m: string | null, a) => {
    const bf = a.bf ?? a.finish
    return bf ? (!m || bf > m ? bf : m) : m
  }, null)
  if (maxBf && today > maxBf && avgPct < 100) return 'Em atraso'
  const avgPrev = rollupPctPrev(leaves, today)
  const delta   = avgPrev - avgPct
  return statusFromDelta(delta, band)
}

/**
 * 4-state status from already-computed actual vs target percentages.
 * Uses 3-zone aggregates threshold band.
 *
 * NOTE: This function does NOT consider deadlines. If a caller has access
 * to leaves, prefer rollupStatus(leaves, today, band) which handles
 * date-based overrides correctly.
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

/** Descendants (level > 4) of an N4 activity, matched via shared n1/n2/n3 + n4 === n4.name. */
export function getN4DescendantLeaves(n4: Activity, all: Activity[]): Activity[] {
  return all.filter(a =>
    a.level > 4 &&
    a.n1 === n4.n1 &&
    a.n2 === n4.n2 &&
    a.n3 === n4.n3 &&
    a.n4 === n4.name
  )
}

/**
 * Effective dates and pct for an N4 activity.
 * N4 with N5/N6 children → rolled up from descendants.
 * N4 without children → its own DB values.
 */
export function getN4Effective(n4: Activity, all: Activity[]): {
  bs: string | null; bf: string | null; rs: string | null; rf: string | null; pct: number
} {
  const descendants = getN4DescendantLeaves(n4, all)
  if (descendants.length === 0) {
    return { bs: n4.bs, bf: n4.bf, rs: n4.rs, rf: n4.rf, pct: n4.pct }
  }
  const { bs, bf } = rollupDateRange(descendants)
  const { rs, rf } = rollupRealDateRange(descendants)
  return { bs, bf, rs, rf, pct: rollupPct(descendants) }
}
