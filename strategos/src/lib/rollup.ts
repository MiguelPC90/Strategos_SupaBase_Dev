import type { Activity } from '../types/index'

// ── Module-level thresholds (set once at app startup via setThresholds) ───────
let THRESHOLD_AGGREGATES = 20  // for N0-N3 rollup status
let THRESHOLD_LEAVES     = 0   // for N4+ leaf status

/**
 * Set both thresholds from app_config. Called once in Layout on startup.
 * Fallback chain: new key → old key → hardcoded default.
 */
export function setThresholds(aggregates: number, leaves: number): void {
  THRESHOLD_AGGREGATES = aggregates
  THRESHOLD_LEAVES     = leaves
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
 * Derived status for a single leaf activity (level >= 4) — 4-state model.
 * - pct >= 100                                        → 'Concluída'
 * - today > bf AND pct < 100                          → 'Em atraso' (missed deadline)
 * - pct < (leafPctPrev(a, today) − THRESHOLD_LEAVES)  → 'Em risco' (behind but deadline not yet passed)
 * - else                                              → 'Em dia'
 *
 * THRESHOLD_LEAVES defaults to 0 (any gap triggers risk). Configurable via
 * app_config key 'status_delay_threshold_leaves'.
 */
export function leafStatus(a: Activity, today: string): string {
  if (a.pct >= 100) return 'Concluída'
  const pct_prev = leafPctPrev(a, today)
  const overdue  = a.bf ? today > a.bf : false
  if (overdue) return 'Em atraso'
  if (a.pct < pct_prev - THRESHOLD_LEAVES) return 'Em risco'
  return 'Em dia'
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
 * - All pct >= 100                                    → 'Concluída'
 * - today > max(bf) AND avg pct < 100                → 'Em atraso' (group missed deadline)
 * - (avg pct_previsto − avg pct) > threshold         → 'Em risco' (behind but deadline not yet passed)
 * - else                                             → 'Em dia'
 *
 * `threshold` defaults to THRESHOLD_AGGREGATES (configurable via app_config
 * key 'status_delay_threshold_aggregates'). Pages may override by passing
 * their own locally-fetched value; the module default ensures the correct
 * value when no explicit argument is supplied.
 *
 * Pass N4 leaves only.
 */
export function rollupStatus(leaves: Activity[], today: string, threshold = THRESHOLD_AGGREGATES): string {
  if (leaves.length === 0) return 'Em dia'
  if (leaves.every(a => a.pct >= 100)) return 'Concluída'
  const avgPct = leaves.reduce((s, a) => s + a.pct, 0) / leaves.length
  const maxBf  = leaves.reduce((m: string | null, a) => {
    const bf = a.bf ?? a.finish
    return bf ? (!m || bf > m ? bf : m) : m
  }, null)
  if (maxBf && today > maxBf && avgPct < 100) return 'Em atraso'
  const avgPrev = rollupPctPrev(leaves, today)
  if ((avgPrev - avgPct) > threshold) return 'Em risco'
  return 'Em dia'
}

export type RowState = 'Concluída' | 'Em dia' | 'Em risco' | 'Em atraso'

/**
 * 4-state status from already-computed actual vs target percentages.
 * Uses THRESHOLD_AGGREGATES: within threshold → 'Em risco', beyond → 'Em atraso'.
 */
export function computeRowState(actual: number, target: number): RowState {
  if (actual >= 100) return 'Concluída'
  const delta = target - actual
  if (delta <= 0) return 'Em dia'
  if (delta <= THRESHOLD_AGGREGATES) return 'Em risco'
  return 'Em atraso'
}

export function getThresholdAggregates(): number {
  return THRESHOLD_AGGREGATES
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
