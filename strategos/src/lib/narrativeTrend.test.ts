import { describe, it, expect } from 'vitest'
import { selectTrendInput } from './narrativeTrend'
import { effectiveWindowDays, windowPhrase } from './statusNarrative'
import type { Snapshot, SnapshotKpi } from '../types/index'

const PLANO = 'plano-1'
const kpi = (exec_media: number, exec_media_prev: number): SnapshotKpi =>
  ({ total: 1, concluidas: 0, em_dia: 1, em_atraso: 0, exec_media, exec_media_prev })
const snap = (snap_date: string, exec: number, prev: number): Snapshot =>
  ({ id: snap_date, label: snap_date, snap_date, created_by: null, kpi: kpi(0, 0), by_n0: {}, by_n1: {}, by_n2: { [PLANO]: kpi(exec, prev) } })

// One snapshot per day, so the selected one reveals which window was applied.
const TODAY = '2026-10-03'
const SNAPS = [
  snap('2026-09-25', 50, 55),  // today − 8
  snap('2026-09-26', 51, 56),  // today − 7
  snap('2026-09-30', 54, 59),  // today − 3
]

describe('effective window in snapshot selection (as usePlanoNarrative does)', () => {
  it('a stored window of 3 selects the snapshot at/before today − 7, matching "na última semana"', () => {
    const stored = 3
    expect(selectTrendInput(SNAPS, PLANO, TODAY, effectiveWindowDays(stored))).toEqual({ prevExec: 51, prevGap: 5 })
    expect(windowPhrase(stored)).toBe('na última semana')
  })
  it('the raw stored 3 would have picked today − 3 — the disagreement this fixes', () => {
    expect(selectTrendInput(SNAPS, PLANO, TODAY, 3)).toEqual({ prevExec: 54, prevGap: 5 })
  })
  it('a window of 7 or more passes through unchanged', () => {
    expect(effectiveWindowDays(7)).toBe(7)
    expect(effectiveWindowDays(45)).toBe(45)
  })
})
