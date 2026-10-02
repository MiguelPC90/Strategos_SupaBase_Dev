import type { Snapshot } from '../types/index'
import type { TrendInput } from './statusNarrative'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The comparison point for the narrative's trend clause, taken from snapshot history.
 *
 * Shared by PlanoPage and PontoSituacao: both pages MUST derive the trend the same
 * way or the same plano would read differently on each. Do not reimplement per page.
 *
 * Picks the most recent snapshot at or before (today − windowDays) that carries this
 * plano in `by_n2`. Requiring it to be at or before the target makes the warm-up
 * period exactly the configured window: a plano with no history that old gets no
 * trend clause, and the clause simply appears once enough history exists.
 *
 * At each snapshot `exec_media` is the actual and `exec_media_prev` the planned, so
 * the gap is `exec_media_prev − exec_media`.
 */
export function selectTrendInput(
  snapshots: Snapshot[],
  planoId: string | null | undefined,
  today: string,
  windowDays: number,
): TrendInput | null {
  if (!planoId) return null
  const target = addDays(today, -windowDays)

  let best: Snapshot | null = null
  for (const s of snapshots) {
    const date = s.snap_date.slice(0, 10)
    if (date > target) continue
    if (!s.by_n2?.[planoId]) continue
    if (!best || date > best.snap_date.slice(0, 10)) best = s
  }
  if (!best) return null

  const k = best.by_n2![planoId]
  // exec_media_prev was added later than exec_media; without it there is no gap
  // to compare, so treat the snapshot as unusable rather than assume zero.
  if (k.exec_media_prev === undefined || k.exec_media_prev === null) return null

  return {
    prevExec: k.exec_media,
    prevGap:  k.exec_media_prev - k.exec_media,
  }
}
