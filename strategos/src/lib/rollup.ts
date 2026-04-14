import type { Activity } from '../types/index'

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
 * Derived status for a single leaf activity (level >= 4).
 * - pct >= 100                  → 'Concluída'
 * - today > bf AND pct < 100    → 'Em atraso'
 * - pct_previsto > pct          → 'Em atraso'
 * - else                        → 'Em dia'
 */
export function leafStatus(a: Activity, today: string): string {
  if (a.pct >= 100) return 'Concluída'
  const bf = a.bf ?? a.finish
  if (bf && today > bf) return 'Em atraso'
  if (leafPctPrev(a, today) > a.pct) return 'Em atraso'
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
 * Rollup status from N4 leaves using date + schedule logic.
 * - All pct >= 100                        → 'Concluída'
 * - today > max(bf) AND avg pct < 100     → 'Em atraso'
 * - avg pct_previsto > avg pct            → 'Em atraso'
 * - else                                  → 'Em dia'
 *
 * Pass N4 leaves only.
 */
export function rollupStatus(leaves: Activity[], today: string): string {
  if (leaves.length === 0) return 'Em dia'
  if (leaves.every(a => a.pct >= 100)) return 'Concluída'
  const avgPct = leaves.reduce((s, a) => s + a.pct, 0) / leaves.length
  const maxBf  = leaves.reduce((m: string | null, a) => {
    const bf = a.bf ?? a.finish
    return bf ? (!m || bf > m ? bf : m) : m
  }, null)
  if (maxBf && today > maxBf && avgPct < 100) return 'Em atraso'
  const avgPrev = rollupPctPrev(leaves, today)
  if (avgPrev > avgPct) return 'Em atraso'
  return 'Em dia'
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
