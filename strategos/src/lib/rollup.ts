import type { Activity } from '../types/index'

/** Average % execução (0–100) across a list of activities */
export function rollupPct(activities: Activity[]): number {
  if (activities.length === 0) return 0
  return activities.reduce((s, a) => s + a.pct, 0) / activities.length
}

/** Date-based % prevista for a single leaf (falls back to stored pct_prev) */
function leafPrev(a: Activity, today: string): number {
  const bf = a.bf ?? a.finish
  if (!a.bs || !bf) return a.pct_prev
  const start = new Date(a.bs).getTime()
  const end   = new Date(bf).getTime()
  const now   = new Date(today).getTime()
  if (end <= start) return now >= end ? 100 : 0
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}

/** Average % prevista (0–100), date-derived where possible */
export function rollupPctPrev(activities: Activity[], today: string): number {
  if (activities.length === 0) return 0
  return activities.reduce((s, a) => s + leafPrev(a, today), 0) / activities.length
}

/**
 * Rollup status from a set of activities:
 * - All pct >= 100 → 'Concluída'
 * - Any 'Em atraso' or 'atrasada' → 'Em atraso'
 * - Otherwise → 'Em dia'
 */
export function rollupStatus(activities: Activity[]): string {
  if (activities.length === 0) return 'Em dia'
  if (activities.every(a => a.pct >= 100)) return 'Concluída'
  if (activities.some(a => a.status === 'Em atraso' || a.status === 'atrasada')) return 'Em atraso'
  return 'Em dia'
}

/** Earliest bs / latest bf across activities */
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
