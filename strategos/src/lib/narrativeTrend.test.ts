import { describe, it, expect } from 'vitest'
import { selectTrendSnapshot, selectTrendInput } from './narrativeTrend'
import { effectiveWindowDays, windowPhrase, generateStatusNarrative, type NarrativeParams } from './statusNarrative'
import { rollupPctPrev } from './rollup'
import type { Activity, Snapshot, SnapshotKpi } from '../types/index'

const PLANO = 'plano-1'
const TODAY = '2026-10-03'

// exec_media_prev mirrors production for app-created planos: AVG(raw pct_prev) = 0.
const kpi = (exec_media: number, total: number): SnapshotKpi =>
  ({ total, concluidas: 0, em_dia: total, em_atraso: 0, exec_media, exec_media_prev: 0 })
const snap = (snap_date: string, exec: number, total = 1): Snapshot =>
  ({ id: snap_date, label: snap_date, snap_date, created_by: null, kpi: kpi(0, 0), by_n0: {}, by_n1: {}, by_n2: { [PLANO]: kpi(exec, total) } })

/** A level-4 leaf as the app creates it: real baselines, pct_prev 0. */
function leaf(id: string, bs: string, bf: string, pct = 0): Activity {
  return {
    id, level: 4, name: id,
    n0: 'P0', n1: 'E1', n2: 'PL2', n3: 'M', n4: id, n5: '', n6: '',
    id0: '', id1: '', id2: '',
    program_id: null, plano_id: PLANO,
    bs, bf, rs: null, rf: null,
    pct, pct_prev: 0,
    status: 'Em dia', sponsor: '', owner: '', finish: null, notes: null,
    sort_order: 0, created_at: '', updated_at: '', updated_by: null,
  }
}

// 100-day baseline: planned % = days elapsed since 2026-07-05.
// 09-03 → 60, 09-18 → 75, 09-24 → 81, 09-26 → 83, 09-30 → 87, 10-03 (today) → 90.
const BS = '2026-07-05'
const BF = '2026-10-13'

describe('selectTrendSnapshot', () => {
  it('returns the chosen snapshot\'s own date, actual and leaf count', () => {
    expect(selectTrendSnapshot([snap('2026-09-26T23:59:00+00:00', 51, 4)], PLANO, TODAY, 7))
      .toEqual({ date: '2026-09-26', exec: 51, total: 4 })
  })
  it('picks the latest snapshot at or before today − window', () => {
    const snaps = [snap('2026-09-25', 50), snap('2026-09-26', 51), snap('2026-09-30', 54)]
    expect(selectTrendSnapshot(snaps, PLANO, TODAY, 7)?.date).toBe('2026-09-26')
  })
  it('no snapshot old enough → null', () => {
    expect(selectTrendSnapshot([snap('2026-09-30', 54)], PLANO, TODAY, 7)).toBeNull()
  })
})

describe('effective window in snapshot selection (as usePlanoNarrative does)', () => {
  const snaps = [snap('2026-09-25', 50), snap('2026-09-26', 51), snap('2026-09-30', 54)]
  it('a stored window of 3 selects the snapshot at/before today − 7, matching "na última semana"', () => {
    const stored = 3
    expect(selectTrendSnapshot(snaps, PLANO, TODAY, effectiveWindowDays(stored))?.date).toBe('2026-09-26')
    expect(windowPhrase(stored)).toBe('na última semana')
  })
  it('the raw stored 3 would have picked today − 3 — the disagreement the effective window fixes', () => {
    expect(selectTrendSnapshot(snaps, PLANO, TODAY, 3)?.date).toBe('2026-09-30')
  })
  it('a window of 7 or more passes through unchanged', () => {
    expect(effectiveWindowDays(7)).toBe(7)
    expect(effectiveWindowDays(45)).toBe(45)
  })
})

describe('selectTrendInput — past planned % recomputed from today\'s leaves', () => {
  const leaves = [leaf('a', BS, BF)]

  it('ignores exec_media_prev: the past gap is recomputed planned − snapshot actual', () => {
    // Snapshot says exec_media_prev 0 (the old bug); the leaf's baseline says 60 on 09-03.
    expect(selectTrendInput([snap('2026-09-03', 8.1)], PLANO, leaves, TODAY, 30))
      .toEqual({ prevExec: 8.1, prevGap: 60 - 8.1 })
  })
  it('evaluates the past planned % at the snapshot\'s own date, not at today − window', () => {
    // Window 7 → boundary 09-26; the nearest snapshot at/before it is 09-24, two days earlier.
    const trend = selectTrendInput([snap('2026-09-24', 20), snap('2026-09-28', 30)], PLANO, leaves, TODAY, 7)
    expect(trend).toEqual({ prevExec: 20, prevGap: rollupPctPrev(leaves, '2026-09-24') - 20 })
    expect(trend?.prevGap).toBe(81 - 20)
    expect(trend?.prevGap).not.toBe(rollupPctPrev(leaves, '2026-09-26') - 20)
  })
  it('leaf count changed since the snapshot → no trend', () => {
    expect(selectTrendInput([snap('2026-09-03', 8.1, 2)], PLANO, leaves, TODAY, 30)).toBeNull()
  })
  it('equal leaf count → trend present', () => {
    expect(selectTrendInput([snap('2026-09-03', 8.1, 1)], PLANO, leaves, TODAY, 30)).not.toBeNull()
  })
  it('a pre-042 snapshot (total counted every level) is ruled out by the same guard', () => {
    expect(selectTrendInput([snap('2026-09-03', 8.1, 7)], PLANO, leaves, TODAY, 30)).toBeNull()
  })
})

// ── End to end: the hook's composition, without React ─────────
// execMedia / execTarget as usePlanoNarrative derives them; trend via selectTrendInput.
function narrate(leaves: Activity[], snapshots: Snapshot[], windowDays: number, status = 'Em atraso'): string {
  const params: NarrativeParams = {
    status,
    execMedia: leaves.reduce((s, a) => s + a.pct, 0) / leaves.length,
    execTarget: rollupPctPrev(leaves, TODAY),
    riskCount: 0, delayedCount: 0, concludedCount: 0, criticalRisks: 0,
    deadline: BF, realFinish: null, today: TODAY,
    trend: selectTrendInput(snapshots, PLANO, leaves, TODAY, windowDays),
    windowDays, stabilityPoints: 1,
  }
  return generateStatusNarrative(params)
}

describe('the trend against history (pct_prev 0, real baselines)', () => {
  it('a constant 51,9 gap reads "mantém-se", not "de 0 para 51,9"', () => {
    // 09-03: planned 60, actual 8,1 → gap 51,9.  Today: planned 90, actual 38,1 → gap 51,9.
    const s = narrate([leaf('a', BS, BF, 38.1)], [snap('2026-09-03', 8.1)], 30)
    expect(s).toBe('38,1% executado contra 90% previsto. Sem recuperação: avançou 30 pontos no último mês, mas o desvio mantém-se em 51,9 pontos.')
    expect(s).not.toContain('de 0 para')
  })
  it('a plano at 0% reads the real from-to, not "de 0 para"', () => {
    const s = narrate([leaf('a', BS, BF, 0)], [snap('2026-09-03', 0)], 30)
    expect(s).toBe('0% executado contra 90% previsto. Tendência desfavorável: praticamente sem avanço no último mês, com o desvio a subir de 60 para 90 pontos.')
  })
  it('Quinzena and Mês change the numbers, not just the period word', () => {
    const leaves = [leaf('a', BS, BF, 38.1)]
    const history = [snap('2026-09-03', 8.1), snap('2026-09-18', 30)]
    expect(narrate(leaves, history, 30))
      .toContain('Sem recuperação: avançou 30 pontos no último mês, mas o desvio mantém-se em 51,9 pontos.')
    expect(narrate(leaves, history, 15))
      .toContain('Tendência desfavorável: avançou 8,1 pontos na última quinzena, mas o desvio agravou-se de 45 para 51,9 pontos.')
  })
  it('activities added within the window → the sentence stands without the trend clause', () => {
    const s = narrate([leaf('a', BS, BF, 38.1), leaf('b', BS, BF, 38.1)], [snap('2026-09-03', 8.1, 1)], 30)
    expect(s).toBe('38,1% executado contra 90% previsto.')
  })
})

describe('narrowed + stalled cannot occur with recomputed planned values', () => {
  // Planned only rises between the two dates (same leaves, later date), and the gap
  // change is that rise minus progress — so a narrowing gap always means real progress.
  it('holds across windows, past and present actuals, and thresholds', () => {
    const leaves = [
      leaf('a', BS, BF),
      leaf('b', '2026-08-20', '2026-12-31'),
      leaf('c', '2026-01-10', '2026-09-15'),   // past its baseline end: planned pinned at 100
    ]
    const boundary: Record<number, string> = { 7: '2026-09-26', 15: '2026-09-18', 30: '2026-09-03', 90: '2026-07-05' }
    const execTarget = rollupPctPrev(leaves, TODAY)
    const offending: string[] = []
    let checked = 0, favourable = 0
    for (const windowDays of [7, 15, 30, 90]) {
      for (let past = 0; past <= 100; past += 5) {
        const trend = selectTrendInput([snap(boundary[windowDays], past, leaves.length)], PLANO, leaves, TODAY, windowDays)
        if (!trend) offending.push(`no trend: w${windowDays} past${past}`)
        for (let now = 0; now <= 100; now += 5) {
          for (const stabilityPoints of [0, 0.5, 1, 3]) {
            const s = generateStatusNarrative({
              status: 'Em risco', execMedia: now, execTarget,
              riskCount: 0, delayedCount: 0, concludedCount: 0, criticalRisks: 0,
              deadline: null, realFinish: null, today: TODAY,
              trend, windowDays, stabilityPoints,
            })
            if (s.includes('Sem avanços')) offending.push(`w${windowDays} past${past} now${now} s${stabilityPoints}`)
            if (s.includes('Tendência favorável')) favourable++
            checked++
          }
        }
      }
    }
    expect(checked).toBe(4 * 21 * 21 * 4)
    expect(favourable).toBeGreaterThan(0)   // the narrowed branch was exercised
    expect(offending).toEqual([])
  })
})
