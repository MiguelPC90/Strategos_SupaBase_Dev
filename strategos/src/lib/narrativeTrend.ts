import type { Activity, Snapshot, SnapshotKpi } from '../types/index'
import { rollupPctPrev } from './rollup'
import type { TrendInput } from './statusNarrative'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The snapshot chosen as the trend's comparison point. */
export interface TrendSnapshot {
  /** The snapshot's own date (YYYY-MM-DD) — can be earlier than today − window. */
  date: string
  /** Past ACTUAL: average execution % of the plano's level-4 leaves on that date. */
  exec: number
  /** How many level-4 leaves that average was computed over. */
  total: number
}

/**
 * Picks the most recent snapshot at or before (today − windowDays) that carries this
 * plano in `by_n2`. Requiring it to be at or before the target makes the warm-up period
 * exactly the configured window: a plano with no history that old gets no trend clause,
 * and the clause simply appears once enough history exists.
 *
 * Reads only the actual (`exec_media`) and the leaf count (`total`). Deliberately NOT
 * `exec_media_prev`: that is AVG of the raw pct_prev column, which is 0 for every
 * activity created in the app — it is not a planned %.
 */
export function selectTrendSnapshot(
  snapshots: Snapshot[],
  planoId: string | null | undefined,
  today: string,
  windowDays: number,
): TrendSnapshot | null {
  if (!planoId) return null
  const target = addDays(today, -windowDays)

  let best: { date: string; kpi: SnapshotKpi } | null = null
  for (const s of snapshots) {
    const date = s.snap_date.slice(0, 10)
    if (date > target) continue
    const kpi = s.by_n2?.[planoId]
    if (!kpi) continue
    if (!best || date > best.date) best = { date, kpi }
  }
  if (!best) return null

  return { date: best.date, exec: best.kpi.exec_media, total: best.kpi.total }
}

/**
 * The comparison point for the narrative's trend clause.
 *
 * Shared by PlanoPage and PontoSituacao (through usePlanoNarrative): both pages MUST
 * derive the trend the same way or the same plano would read differently on each. Do
 * not reimplement per page.
 *
 * Only the past ACTUAL comes from the snapshot. The past PLANNED % is recomputed with
 * rollupPctPrev over TODAY's leaves and baselines, at the snapshot's own date — the same
 * function as the live "previsto" (see the trend note in statusNarrative.ts). Past gap =
 * that planned % − the snapshot's actual.
 *
 * Null — no trend clause — when there is no snapshot old enough, or when the snapshot
 * averaged a different number of level-4 leaves than the plano has today: the two halves
 * of the past gap would then describe different sets of activities. This also rules out
 * snapshots from before migration 042, whose `total` counted every level.
 */
export function selectTrendInput(
  snapshots: Snapshot[],
  planoId: string | null | undefined,
  planLeaves: Activity[],
  today: string,
  windowDays: number,
): TrendInput | null {
  const snap = selectTrendSnapshot(snapshots, planoId, today, windowDays)
  if (!snap) return null
  if (snap.total !== planLeaves.length) return null

  const pastPlanned = rollupPctPrev(planLeaves, snap.date)
  return {
    prevExec: snap.exec,
    prevGap:  pastPlanned - snap.exec,
  }
}
