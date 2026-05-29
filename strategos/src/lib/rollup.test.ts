import { describe, it, expect } from 'vitest'
import { getDirectChildren, getEffectivePct, rollupEffectivePct, getDescendantLeaves, getEffectiveStatus, getEffectiveDates } from './rollup'
import type { Activity } from '../types/index'

// ── Minimal activity factory ───────────────────────────────────
function mkAct(overrides: Partial<Activity> & { id: string; level: number; name: string }): Activity {
  return {
    n0: 'P0', n1: 'E1', n2: 'PL2', n3: '', n4: '', n5: '', n6: '',
    id0: '', id1: '', id2: '',
    program_id: null, plano_id: null,
    bs: null, bf: null, rs: null, rf: null,
    pct: 0, pct_prev: 0,
    status: 'Em dia', sponsor: '', owner: '', finish: null, notes: null,
    sort_order: 0, created_at: '', updated_at: '', updated_by: null,
    ...overrides,
  }
}

// ── Shared fixtures (n{level} = own name, matching real DB data) ──
// N3: n3='Macro'  (own name stored at n3)
// N4: n3='Macro', n4='Act'  (parent in n3, own name in n4)
// N5: n3='Macro', n4='Act', n5='Sub'
// N6: n3='Macro', n4='Act', n5='Sub', n6='Det'
const n3 = mkAct({ id: 'n3', level: 3, name: 'Macro', n3: 'Macro', pct: 0 })
const n4 = mkAct({ id: 'n4', level: 4, name: 'Act',   n3: 'Macro', n4: 'Act', pct: 0 })
const n5 = mkAct({ id: 'n5', level: 5, name: 'Sub',   n3: 'Macro', n4: 'Act', n5: 'Sub', pct: 60 })
const n6 = mkAct({ id: 'n6', level: 6, name: 'Det',   n3: 'Macro', n4: 'Act', n5: 'Sub', n6: 'Det', pct: 80 })

describe('getDirectChildren', () => {
  it('returns empty for level 6 (no children possible)', () => {
    expect(getDirectChildren(n6, [n6, n5, n4, n3])).toHaveLength(0)
  })

  it('returns N5 children of N4', () => {
    const children = getDirectChildren(n4, [n3, n4, n5, n6])
    expect(children).toHaveLength(1)
    expect(children[0].id).toBe('n5')
  })

  it('does not cross eixo boundaries even when names match', () => {
    const n5other = mkAct({ id: 'n5b', level: 5, name: 'Sub', n1: 'E2', n3: 'Macro', n4: 'Act', n5: 'Sub', pct: 100 })
    const children = getDirectChildren(n4, [n4, n5, n5other])
    expect(children).toHaveLength(1)
    expect(children[0].id).toBe('n5')
  })
})

describe('getEffectivePct', () => {
  it('leaf at N6 returns own pct', () => {
    expect(getEffectivePct(n6, [n6])).toBe(80)
  })

  it('N4 with no children returns own pct', () => {
    const n4leaf = mkAct({ id: 'n4l', level: 4, name: 'Act', n3: 'Macro', n4: 'Act', pct: 42 })
    expect(getEffectivePct(n4leaf, [n4leaf])).toBe(42)
  })

  it('N4 with two N5 children (no N6) returns simple average of N5 pcts', () => {
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SubA', n3: 'Macro', n4: 'Act', n5: 'SubA', pct: 40 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SubB', n3: 'Macro', n4: 'Act', n5: 'SubB', pct: 80 })
    const all = [n4, n5a, n5b]
    expect(getEffectivePct(n4, all)).toBe(60)
  })

  it('N4 with N5 that has N6 children: recursive, not flat average', () => {
    // n5x raw pct=99, but it has two N6 children at 20 and 80
    // n5x effective = (20+80)/2 = 50
    // n4 effective = 50 (only one N5 child)
    const n5x  = mkAct({ id: 'n5x', level: 5, name: 'SubX', n3: 'Macro', n4: 'Act', n5: 'SubX', pct: 99 })
    const n6a  = mkAct({ id: 'n6a', level: 6, name: 'Det1', n3: 'Macro', n4: 'Act', n5: 'SubX', n6: 'Det1', pct: 20 })
    const n6b  = mkAct({ id: 'n6b', level: 6, name: 'Det2', n3: 'Macro', n4: 'Act', n5: 'SubX', n6: 'Det2', pct: 80 })
    const all  = [n4, n5x, n6a, n6b]
    expect(getEffectivePct(n5x, all)).toBe(50)
    expect(getEffectivePct(n4, all)).toBe(50)
  })

  it('sibling N5 activities do not pollute each other', () => {
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SubA', n3: 'Macro', n4: 'Act', n5: 'SubA', pct: 0 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SubB', n3: 'Macro', n4: 'Act', n5: 'SubB', pct: 0 })
    const n6c = mkAct({ id: 'n6c', level: 6, name: 'Det',  n3: 'Macro', n4: 'Act', n5: 'SubA', n6: 'Det', pct: 100 })
    const all = [n4, n5a, n5b, n6c]
    expect(getEffectivePct(n5a, all)).toBe(100)  // rolled up from n6c
    expect(getEffectivePct(n5b, all)).toBe(0)    // leaf — own pct
    expect(getEffectivePct(n4,  all)).toBe(50)   // average(100, 0)
  })

  it('N3 with two N4 children returns average of N4 effective pcts', () => {
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'ActA', n3: 'Macro', n4: 'ActA', pct: 30 })
    const n4b = mkAct({ id: 'n4b', level: 4, name: 'ActB', n3: 'Macro', n4: 'ActB', pct: 70 })
    const all = [n3, n4a, n4b]
    expect(getEffectivePct(n3, all)).toBe(50)
  })

  it('cross-eixo isolation: N5 in a different eixo is not counted as a child', () => {
    const n4local = mkAct({ id: 'n4l', level: 4, name: 'Act', n1: 'E1', n3: 'Macro', n4: 'Act', pct: 20 })
    const n5other = mkAct({ id: 'n5o', level: 5, name: 'Sub', n1: 'E2', n3: 'Macro', n4: 'Act', n5: 'Sub', pct: 100 })
    const all = [n4local, n5other]
    // n4local has no children in its own eixo → returns own pct
    expect(getEffectivePct(n4local, all)).toBe(20)
  })

  it('returns own pct when all array is empty', () => {
    const n4x = mkAct({ id: 'x', level: 4, name: 'X', n3: 'M', n4: 'X', pct: 55 })
    expect(getEffectivePct(n4x, [])).toBe(55)
  })
})

describe('rollupEffectivePct', () => {
  it('returns 0 for empty array', () => {
    expect(rollupEffectivePct([], [])).toBe(0)
  })

  it('averages effective pcts across mixed leaves (some with descendants, some without)', () => {
    // n4a is a leaf at 40; n4b has an N5 child at 80 (n4b raw pct is 0)
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'ActA', n3: 'Macro', n4: 'ActA', pct: 40 })
    const n4b = mkAct({ id: 'n4b', level: 4, name: 'ActB', n3: 'Macro', n4: 'ActB', pct: 0 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SubB', n3: 'Macro', n4: 'ActB', n5: 'SubB', pct: 80 })
    const all = [n4a, n4b, n5b]
    // effective: n4a=40, n4b=80 → average = 60
    expect(rollupEffectivePct([n4a, n4b], all)).toBe(60)
  })
})

const TODAY = '2026-05-28'

describe('getDescendantLeaves', () => {
  it('returns [self] for a leaf (childless N4)', () => {
    const n4leaf = mkAct({ id: 'n4l', level: 4, name: 'Act', n3: 'Macro', n4: 'Act', pct: 50 })
    const result = getDescendantLeaves(n4leaf, [n4leaf])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n4l')
  })

  it('collects N6 grandchildren under an N4 (skips intermediate N5)', () => {
    // N4 → N5 → two N6 leaves; descendant leaves should be the two N6 only
    const n5x = mkAct({ id: 'n5x', level: 5, name: 'Sub', n3: 'Macro', n4: 'Act', n5: 'Sub', pct: 0 })
    const n6a = mkAct({ id: 'n6a', level: 6, name: 'D1', n3: 'Macro', n4: 'Act', n5: 'Sub', n6: 'D1', pct: 30 })
    const n6b = mkAct({ id: 'n6b', level: 6, name: 'D2', n3: 'Macro', n4: 'Act', n5: 'Sub', n6: 'D2', pct: 70 })
    const all = [n4, n5x, n6a, n6b]
    const ids = getDescendantLeaves(n4, all).map(a => a.id).sort()
    expect(ids).toEqual(['n6a', 'n6b'])
  })
})

describe('getEffectiveStatus (legacy: pre-Part-B)', () => {
  it('N4 with all children at 100% → Concluída', () => {
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SubA', n3: 'Macro', n4: 'Act', n5: 'SubA', pct: 100 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SubB', n3: 'Macro', n4: 'Act', n5: 'SubB', pct: 100 })
    const all = [n4, n5a, n5b]
    expect(getEffectiveStatus(n4, all, TODAY)).toBe('Concluída')
  })

  it('leaf N4 past deadline at 0% → Em atraso (unchanged leaf behaviour)', () => {
    const n4late = mkAct({ id: 'n4late', level: 4, name: 'Act', n3: 'Macro', n4: 'Act', pct: 0, bf: '2020-01-01' })
    expect(getEffectiveStatus(n4late, [n4late], TODAY)).toBe('Em atraso')
  })
})

// ── getEffectiveDates ──────────────────────────────────────────

describe('getEffectiveDates', () => {
  it('leaf returns own dates', () => {
    const a = mkAct({
      id: 'a1', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      bs: '2026-01-01', bf: '2026-12-31', rs: '2026-01-15', rf: '2026-11-30',
    })
    const d = getEffectiveDates(a, [a])
    expect(d).toEqual({ bs: '2026-01-01', bf: '2026-12-31', rs: '2026-01-15', rf: '2026-11-30' })
  })

  it('parent returns min(bs)/max(bf) over descendant leaves', () => {
    // N4 → two N5 leaves with different date ranges
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act' })
    const n5x = mkAct({ id: 'n5x', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA',
      bs: '2026-02-01', bf: '2026-08-31' })
    const n5y = mkAct({ id: 'n5y', level: 5, name: 'SB', n3: 'M', n4: 'Act', n5: 'SB',
      bs: '2026-01-01', bf: '2026-12-31' })
    const all = [n4p, n5x, n5y]
    const d = getEffectiveDates(n4p, all)
    expect(d.bs).toBe('2026-01-01')   // min
    expect(d.bf).toBe('2026-12-31')   // max
  })

  it('rs/rf stay null when no descendant leaf has real dates', () => {
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act' })
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA',
      bs: '2026-01-01', bf: '2026-12-31' })
    const d = getEffectiveDates(n4p, [n4p, n5a])
    expect(d.rs).toBeNull()
    expect(d.rf).toBeNull()
  })
})

// ── getEffectiveStatus (unified model) ────────────────────────

describe('getEffectiveStatus (unified model)', () => {
  it('leaf at 100% → Concluída', () => {
    const a = mkAct({ id: 'a', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 100, bf: '2020-01-01' })
    expect(getEffectiveStatus(a, [a], TODAY)).toBe('Concluída')
  })

  it('parent with all leaves at 100% → Concluída', () => {
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 0 })
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA', pct: 100 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SB', n3: 'M', n4: 'Act', n5: 'SB', pct: 100 })
    expect(getEffectiveStatus(n4p, [n4p, n5a, n5b], TODAY)).toBe('Concluída')
  })

  it('parent with one leaf at 99 → NOT Concluída (per-leaf check, not averaged)', () => {
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 0 })
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA', pct: 100 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SB', n3: 'M', n4: 'Act', n5: 'SB', pct: 99 })
    // effective pct = (100+99)/2 = 99.5 → rounds up if rounded, but per-leaf check requires 100
    const result = getEffectiveStatus(n4p, [n4p, n5a, n5b], TODAY)
    expect(result).not.toBe('Concluída')
  })

  it('parent past effective bf with pct < 100 → Em atraso', () => {
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 0 })
    // both N5 leaves have bf in the past
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA', pct: 50, bf: '2021-01-01' })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SB', n3: 'M', n4: 'Act', n5: 'SB', pct: 50, bf: '2022-01-01' })
    // effective bf = max('2021-01-01','2022-01-01') = '2022-01-01', TODAY > that
    expect(getEffectiveStatus(n4p, [n4p, n5a, n5b], TODAY)).toBe('Em atraso')
  })

  it('band by level: same delta → Em atraso for N3 (leaves band) but Em dia for N2 (aggregates band)', () => {
    // delta = pct_prev - pct = 52 - 40 = 12
    // leaves band:     high=10 → 12 > 10  → Em atraso
    // aggregates band: low=15  → 12 ≤ 15  → Em dia
    const n3leaf = mkAct({ id: 'n3l', level: 3, name: 'M', n3: 'M', pct: 40, pct_prev: 52 })
    const n2leaf = mkAct({ id: 'n2l', level: 2, name: 'PL', n2: 'PL', pct: 40, pct_prev: 52 })
    expect(getEffectiveStatus(n3leaf, [n3leaf], TODAY)).toBe('Em atraso')
    expect(getEffectiveStatus(n2leaf, [n2leaf], TODAY)).toBe('Em dia')
  })

  it('parent target ignores leaves without baseline dates', () => {
    // n5dated:   bf = today so leafPctPrev = 100; pct = 80 → delta = 20 → Em atraso (leaves band)
    // n5undated: no bs/bf → excluded from withDates; if included, target=(100+0)/2=50, delta=50-80=-30 → Em dia
    // Correct behaviour (n5undated excluded): target=100, delta=100-80=20 > leaves.high=10 → Em atraso
    const n4p    = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 0 })
    const n5dated   = mkAct({ id: 'n5d', level: 5, name: 'SD', n3: 'M', n4: 'Act', n5: 'SD',
      pct: 80, bs: '2026-01-01', bf: TODAY })
    const n5undated = mkAct({ id: 'n5u', level: 5, name: 'SU', n3: 'M', n4: 'Act', n5: 'SU',
      pct: 80, pct_prev: 0 })
    expect(getEffectiveStatus(n4p, [n4p, n5dated, n5undated], TODAY)).toBe('Em atraso')
  })

  it('deep recursion N3→N4→N5→N6: rolls up correctly to Concluída', () => {
    const n3d  = mkAct({ id: 'n3d',  level: 3, name: 'Mac', n3: 'Mac' })
    const n4d  = mkAct({ id: 'n4d',  level: 4, name: 'Act', n3: 'Mac', n4: 'Act' })
    const n5d  = mkAct({ id: 'n5d',  level: 5, name: 'Sub', n3: 'Mac', n4: 'Act', n5: 'Sub' })
    const n6da = mkAct({ id: 'n6da', level: 6, name: 'D1',  n3: 'Mac', n4: 'Act', n5: 'Sub', n6: 'D1', pct: 100 })
    const n6db = mkAct({ id: 'n6db', level: 6, name: 'D2',  n3: 'Mac', n4: 'Act', n5: 'Sub', n6: 'D2', pct: 100 })
    const all = [n3d, n4d, n5d, n6da, n6db]
    expect(getEffectiveStatus(n3d, all, TODAY)).toBe('Concluída')
  })

  it('100% with deadline already passed → still Concluída (Step 1 wins before deadline check)', () => {
    const a = mkAct({ id: 'a', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 100, bf: '2020-01-01' })
    expect(getEffectiveStatus(a, [a], TODAY)).toBe('Concluída')
  })
})
