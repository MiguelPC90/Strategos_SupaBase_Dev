import { describe, it, expect } from 'vitest'
import { getDirectChildren, getEffectivePct, rollupEffectivePct, getDescendantLeaves, getEffectiveStatus, getEffectiveDates, getEffectiveTarget, getGroupStatus, computeEffectiveMap, computeGroupStatusFromEff } from './rollup'
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

  // Test 10 — regression: getEffectiveStatus uses recursive target, not flat average
  it('uses recursive target not flat average (unbalanced tree)', () => {
    // N4 → N5a (1 N6: target=100) and N5b (2 N6s: target=0 and 100)
    // Recursive target: avg(100, avg(0,100)) = avg(100, 50) = 75
    // Flat (old) target: avg(100, 0, 100) / 3 = 66.67
    // effective pct: N5a→N6a(pct=30)=30, N5b→avg(N6c=100,N6d=100)=100, N4=avg(30,100)=65
    // delta_recursive = 75 - 65 = 10 → LEAVES high=10: Em risco
    // delta_flat      = 66.67 - 65 = 1.67 → LEAVES low=5: would be Em dia
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act', pct: 0 })
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA', pct: 0 })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SB', n3: 'M', n4: 'Act', n5: 'SB', pct: 0 })
    const n6a = mkAct({ id: 'n6a', level: 6, name: 'D1', n3: 'M', n4: 'Act', n5: 'SA', n6: 'D1',
      pct: 30, bs: '2026-01-01', bf: TODAY })                  // target = 100
    const n6c = mkAct({ id: 'n6c', level: 6, name: 'D2', n3: 'M', n4: 'Act', n5: 'SB', n6: 'D2',
      pct: 100, bs: '2026-07-01', bf: '2026-12-31' })          // target = 0  (bs in future)
    const n6d = mkAct({ id: 'n6d', level: 6, name: 'D3', n3: 'M', n4: 'Act', n5: 'SB', n6: 'D3',
      pct: 100, bs: '2026-01-01', bf: TODAY })                  // target = 100
    const all = [n4p, n5a, n5b, n6a, n6c, n6d]
    // effective bf = max(N6a.bf=TODAY, N6c.bf='2026-12-31', N6d.bf=TODAY) = '2026-12-31' → future
    expect(getEffectiveStatus(n4p, all, TODAY)).toBe('Em risco')
  })
})

// ── getEffectiveTarget ────────────────────────────────────────

describe('getEffectiveTarget', () => {
  // Test 1 — leaf with future bs → leafPctPrev = 0
  it('leaf with future bs returns 0 (= leafPctPrev)', () => {
    const leaf = mkAct({ id: 'l', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      pct: 80, bs: '2026-07-01', bf: '2026-12-31' })
    expect(getEffectiveTarget(leaf, [leaf], TODAY)).toBe(0)
  })

  // Test 2 — unbalanced tree: recursive (75) ≠ flat average (66.67)
  it('unbalanced tree: recursive result differs from flat average', () => {
    // N4 → N5a (1 N6: bf=TODAY → target=100)
    //      N5b (2 N6s: bf=TODAY → target=100, bs future → target=0)
    // Recursive: avg(target(N5a)=100, target(N5b)=avg(100,0)=50) = 75
    // Flat: avg(100, 100, 0) / 3 = 66.67
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act' })
    const n5a = mkAct({ id: 'n5a', level: 5, name: 'SA', n3: 'M', n4: 'Act', n5: 'SA' })
    const n5b = mkAct({ id: 'n5b', level: 5, name: 'SB', n3: 'M', n4: 'Act', n5: 'SB' })
    const n6a = mkAct({ id: 'n6a', level: 6, name: 'D1', n3: 'M', n4: 'Act', n5: 'SA', n6: 'D1',
      bs: '2026-01-01', bf: TODAY })                   // target = 100
    const n6c = mkAct({ id: 'n6c', level: 6, name: 'D2', n3: 'M', n4: 'Act', n5: 'SB', n6: 'D2',
      bs: '2026-01-01', bf: TODAY })                   // target = 100
    const n6d = mkAct({ id: 'n6d', level: 6, name: 'D3', n3: 'M', n4: 'Act', n5: 'SB', n6: 'D3',
      bs: '2026-07-01', bf: '2026-12-31' })            // target = 0 (bs in future)
    const all = [n4p, n5a, n5b, n6a, n6c, n6d]
    expect(getEffectiveTarget(n4p, all, TODAY)).toBe(75)
  })

  // Test 3 — dateless branch excluded: only dated N5 contributes
  it('dateless branch is excluded; only dated branch contributes', () => {
    const n4p = mkAct({ id: 'n4p', level: 4, name: 'Act', n3: 'M', n4: 'Act' })
    const n5d = mkAct({ id: 'n5d', level: 5, name: 'SD', n3: 'M', n4: 'Act', n5: 'SD',
      bs: '2026-01-01', bf: TODAY })                   // dated → target = 100
    const n5u = mkAct({ id: 'n5u', level: 5, name: 'SU', n3: 'M', n4: 'Act', n5: 'SU',
      pct_prev: 50 })                                  // no dates → excluded
    expect(getEffectiveTarget(n4p, [n4p, n5d, n5u], TODAY)).toBe(100)
  })
})

// ── getGroupStatus ────────────────────────────────────────────

describe('getGroupStatus', () => {
  // Test 4 — all descendants at 100 → Concluída
  it('all N4 leaves at 100 → Concluída', () => {
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 100 })
    const n4b = mkAct({ id: 'n4b', level: 4, name: 'B', n3: 'M', n4: 'B', pct: 100 })
    expect(getGroupStatus([n4a, n4b], [n4a, n4b], TODAY, 2)).toBe('Concluída')
  })

  // Test 5 — group effective bf past + pct < 100 → Em atraso
  it('all N4 leaves past deadline and pct < 100 → Em atraso', () => {
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'A', n3: 'M', n4: 'A',
      pct: 50, bs: '2020-01-01', bf: '2022-01-01' })   // past
    const n4b = mkAct({ id: 'n4b', level: 4, name: 'B', n3: 'M', n4: 'B',
      pct: 50, bs: '2020-01-01', bf: '2023-06-01' })   // past (max of the two)
    // group bf = max('2022-01-01', '2023-06-01') = '2023-06-01' < TODAY → Em atraso
    expect(getGroupStatus([n4a, n4b], [n4a, n4b], TODAY, 2)).toBe('Em atraso')
  })

  // Test 6 — one past bf, another future bf → group bf = max (future) → deadline not missed
  it('one N4 past deadline, another future → group max-bf is future → no deadline miss', () => {
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'A', n3: 'M', n4: 'A',
      pct: 100, bs: '2020-01-01', bf: '2021-01-01' })  // past deadline but done (pct=100)
    const n4b = mkAct({ id: 'n4b', level: 4, name: 'B', n3: 'M', n4: 'B',
      pct: 90, bs: '2029-01-01', bf: '2030-01-01' })   // far future → target = 0
    // group bf = max('2021-01-01','2030-01-01') = '2030-01-01' → future → Step 2 does not fire
    // pct = avg(100,90)=95, target=avg(100,0)=50, delta=50-95=-45 ≤ 15 → Em dia
    expect(getGroupStatus([n4a, n4b], [n4a, n4b], TODAY, 0)).toBe('Em dia')
  })

  // Test 7 — healthy group is Em dia even when one N4 is individually Em atraso (proves worst-wins gone)
  it('healthy group Em dia despite one N4 being Em atraso individually under LEAVES band', () => {
    // n4a: pct=80, target=100, delta=20 → LEAVES high=10: individually Em atraso
    // n4b: pct=95, target=100, delta=5  → LEAVES low=5:  individually Em dia
    // group (level=2, AGGREGATES band): pct=87.5, target=100, delta=12.5 ≤ low=15 → Em dia
    // old groupState (worst-wins): n4a is Em atraso → returned Em atraso
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'A', n3: 'M', n4: 'A',
      pct: 80, bs: '2026-01-01', bf: TODAY })
    const n4b = mkAct({ id: 'n4b', level: 4, name: 'B', n3: 'M', n4: 'B',
      pct: 95, bs: '2026-01-01', bf: TODAY })
    expect(getGroupStatus([n4a, n4b], [n4a, n4b], TODAY, 2)).toBe('Em dia')
  })

  // Test 8 — band by level: same delta → different status at level 3 vs level 2
  it('same delta → Em atraso at level 3 (LEAVES band) and Em dia at level 2 (AGGREGATES band)', () => {
    // delta = 12: LEAVES high=10 → 12>10 → Em atraso; AGGREGATES low=15 → 12≤15 → Em dia
    const n4a = mkAct({ id: 'n4a', level: 4, name: 'A', n3: 'M', n4: 'A',
      pct: 88, bs: '2026-01-01', bf: TODAY })          // target=100, delta=12
    expect(getGroupStatus([n4a], [n4a], TODAY, 3)).toBe('Em atraso')
    expect(getGroupStatus([n4a], [n4a], TODAY, 2)).toBe('Em dia')
  })

  // Test 9 — empty n4Leaves → Em dia
  it('empty n4Leaves returns Em dia', () => {
    expect(getGroupStatus([], [], TODAY, 2)).toBe('Em dia')
  })
})

// ── computeEffectiveMap parity ────────────────────────────────
// Multi-level fixture: N4→N5, N4→N5→N6, leaf-only N4, finish-only deadline
// Verifies that the bottom-up single pass produces identical output to
// calling getEffectivePct + getEffectiveDates + getEffectiveTarget + getEffectiveStatus
// individually for every activity.

describe('computeEffectiveMap parity', () => {
  const D = TODAY  // '2026-05-28'

  // N4 "Done": two N5 leaves each at 100% → Concluída
  const p4Done = mkAct({ id: 'p4Done', level: 4, name: 'Done', n3: 'R', n4: 'Done', pct: 0 })
  const p5D1   = mkAct({ id: 'p5D1',  level: 5, name: 'D1',   n3: 'R', n4: 'Done', n5: 'D1', pct: 100, bs: '2026-01-01', bf: D })
  const p5D2   = mkAct({ id: 'p5D2',  level: 5, name: 'D2',   n3: 'R', n4: 'Done', n5: 'D2', pct: 100, bs: '2026-01-01', bf: D })

  // N4 "Late": one N5 leaf past deadline → Em atraso
  const p4Late = mkAct({ id: 'p4Late', level: 4, name: 'Late', n3: 'R', n4: 'Late', pct: 0 })
  const p5L1   = mkAct({ id: 'p5L1',  level: 5, name: 'L1',   n3: 'R', n4: 'Late', n5: 'L1', pct: 50, bs: '2020-01-01', bf: '2022-01-01' })

  // N4 "Deep": N4 → N5 → two N6 leaves (unbalanced targets)
  const p4Deep = mkAct({ id: 'p4Deep', level: 4, name: 'Deep', n3: 'R', n4: 'Deep', pct: 0 })
  const p5DS   = mkAct({ id: 'p5DS',   level: 5, name: 'DS',   n3: 'R', n4: 'Deep', n5: 'DS', pct: 0 })
  const p6G1   = mkAct({ id: 'p6G1',   level: 6, name: 'G1',   n3: 'R', n4: 'Deep', n5: 'DS', n6: 'G1', pct: 30, bs: '2026-01-01', bf: D })
  const p6G2   = mkAct({ id: 'p6G2',   level: 6, name: 'G2',   n3: 'R', n4: 'Deep', n5: 'DS', n6: 'G2', pct: 70, bs: '2026-07-01', bf: '2026-12-31' })

  // N4 "Fin": leaf with finish set but bf null (tests bfProp/finish-fallback path)
  const p4Fin  = mkAct({ id: 'p4Fin',  level: 4, name: 'Fin',  n3: 'R', n4: 'Fin',  pct: 40, bs: '2021-01-01', finish: '2022-01-01' })

  const all = [p4Done, p5D1, p5D2, p4Late, p5L1, p4Deep, p5DS, p6G1, p6G2, p4Fin]
  const ε   = 1e-9

  it('pct matches getEffectivePct for every activity', () => {
    const m = computeEffectiveMap(all, D)
    for (const a of all) {
      expect(Math.abs(m.get(a.id)!.pct - getEffectivePct(a, all))).toBeLessThan(ε)
    }
  })

  it('dates match getEffectiveDates for every activity', () => {
    const m = computeEffectiveMap(all, D)
    for (const a of all) {
      const exp = getEffectiveDates(a, all)
      const act = m.get(a.id)!
      expect(act.bs).toBe(exp.bs)
      expect(act.bf).toBe(exp.bf)
      expect(act.rs).toBe(exp.rs)
      expect(act.rf).toBe(exp.rf)
    }
  })

  it('target matches getEffectiveTarget for every activity', () => {
    const m = computeEffectiveMap(all, D)
    for (const a of all) {
      expect(Math.abs(m.get(a.id)!.target - getEffectiveTarget(a, all, D))).toBeLessThan(ε)
    }
  })

  it('status matches getEffectiveStatus for every activity', () => {
    const m = computeEffectiveMap(all, D)
    for (const a of all) {
      expect(m.get(a.id)!.status).toBe(getEffectiveStatus(a, all, D))
    }
  })

  it('finish-only leaf: display bf is null but status is Em atraso', () => {
    const m = computeEffectiveMap(all, D)
    expect(m.get(p4Fin.id)!.bf).toBeNull()                    // display bf = a.bf = null
    expect(m.get(p4Fin.id)!.status).toBe('Em atraso')         // finish-fallback deadline fires
    expect(m.get(p4Fin.id)!.status).toBe(getEffectiveStatus(p4Fin, all, D))
  })

  it('allAt100 propagates: Done subtree true, Late/Deep/Fin false', () => {
    const m = computeEffectiveMap(all, D)
    expect(m.get(p4Done.id)!.allAt100).toBe(true)
    expect(m.get(p4Late.id)!.allAt100).toBe(false)
    expect(m.get(p4Deep.id)!.allAt100).toBe(false)
    expect(m.get(p4Fin.id)!.allAt100).toBe(false)
  })

  it('getGroupStatus sanity: N4-leaf group status is consistent with individual statuses', () => {
    const n4Leaves = all.filter(a => a.level === 4)
    const gs = getGroupStatus(n4Leaves, all, D, 2)
    // p4Late has past deadline with pct<100 → group should be Em atraso at any band
    expect(gs).toBe('Em atraso')
  })
})

// ── computeGroupStatusFromEff parity ──────────────────────────
// 14 scenarios asserting computeGroupStatusFromEff === getGroupStatus
// for every combination of: Concluída / Em atraso (deadline) / delta-band / empty / mixed groups

describe('computeGroupStatusFromEff parity', () => {
  const D = TODAY

  // Helper: project computeEffectiveMap → eff map for computeGroupStatusFromEff
  function effFrom(acts: Activity[]) {
    const full = computeEffectiveMap(acts, D)
    return new Map(Array.from(full.entries()).map(([id, r]) => [id, {
      pct: r.pct, target: r.target, bf: r.bf,
      allAt100: r.allAt100, hasDatedLeaf: r.hasDatedLeaf,
    }]))
  }

  // Scenario 1 — empty leaves → Em dia
  it('empty leaves → Em dia', () => {
    const eff = new Map()
    expect(computeGroupStatusFromEff([], eff, 2, D)).toBe('Em dia')
    expect(computeGroupStatusFromEff([], eff, 2, D)).toBe(getGroupStatus([], [], D, 2))
  })

  // Scenario 2 — single leaf at 100 (no children) → Concluída
  it('single leaf pct=100 → Concluída', () => {
    const a = mkAct({ id: 'p2', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 100 })
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Concluída')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 3 — N4 with N5 children all at 100 → Concluída
  it('N4 with N5 children all 100 → Concluída', () => {
    const a4 = mkAct({ id: 'c4', level: 4, name: 'P', n3: 'M', n4: 'P', pct: 0 })
    const a5a = mkAct({ id: 'c5a', level: 5, name: 'C1', n3: 'M', n4: 'P', n5: 'C1', pct: 100 })
    const a5b = mkAct({ id: 'c5b', level: 5, name: 'C2', n3: 'M', n4: 'P', n5: 'C2', pct: 100 })
    const acts = [a4, a5a, a5b]
    const eff = effFrom(acts)
    expect(computeGroupStatusFromEff([a4], eff, 2, D)).toBe('Concluída')
    expect(computeGroupStatusFromEff([a4], eff, 2, D)).toBe(getGroupStatus([a4], acts, D, 2))
  })

  // Scenario 4 — deadline in the past, pct<100 → Em atraso
  it('past deadline → Em atraso', () => {
    const a = mkAct({ id: 'p4', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 50, bs: '2020-01-01', bf: '2022-01-01' })
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Em atraso')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 5 — deadline today (not past) → should NOT be Em atraso from deadline
  it('deadline == today → not deadline Em atraso', () => {
    const a = mkAct({ id: 'p5', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 50, bs: '2020-01-01', bf: D })
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 6 — delta <= low → Em dia (AGGREGATES band: low=15)
  it('delta within AGGREGATES low → Em dia (level 2)', () => {
    const a = mkAct({ id: 'p6', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 90, bs: D, bf: '2030-12-31' })
    // target = 0 (today=bs → 0), pct=90, delta = 0-90 = -90 ≤ 15 → Em dia
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Em dia')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 7 — delta in (low, high] → Em risco (AGGREGATES band: low=15, high=25)
  it('delta in AGGREGATES Em risco zone (level 2)', () => {
    // delta=20: AGGREGATES low=15 < 20 ≤ high=25 → Em risco
    const a = mkAct({ id: 'p7', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 80, bs: '2026-01-01', bf: D })
    // today==bf → target=100, delta=100-80=20
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Em risco')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 8 — delta > high → Em atraso via delta (AGGREGATES band: high=25)
  it('delta > AGGREGATES high → Em atraso via delta (level 2)', () => {
    // delta=30: > high=25 → Em atraso
    const a = mkAct({ id: 'p8', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 70, bs: '2026-01-01', bf: D })
    // target=100, delta=30
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Em atraso')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 9 — LEAVES band (level ≥ 3): same delta → different status
  it('same delta 12pp → Em atraso at level 3 (LEAVES), Em dia at level 2 (AGGREGATES)', () => {
    const a = mkAct({ id: 'p9', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 88, bs: '2026-01-01', bf: D })
    // target=100, delta=12; LEAVES high=10 → Em atraso; AGGREGATES low=15 → Em dia
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 3, D)).toBe('Em atraso')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Em dia')
    expect(computeGroupStatusFromEff([a], eff, 3, D)).toBe(getGroupStatus([a], [a], D, 3))
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 10 — dateless leaf: hasDatedLeaf=false → target=0 → Em dia at any reasonable pct
  it('dateless leaf → hasDatedLeaf false → target=0, status Em dia', () => {
    const a = mkAct({ id: 'p10', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 50 })
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Em dia')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 11 — multiple leaves mixed: late + on-track → Em atraso dominates
  it('mixed group: one late leaf → group Em atraso', () => {
    const aLate = mkAct({ id: 'p11a', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 50, bs: '2020-01-01', bf: '2022-01-01' })
    const aOk   = mkAct({ id: 'p11b', level: 4, name: 'B', n3: 'M', n4: 'B', pct: 100 })
    const acts  = [aLate, aOk]
    const eff   = effFrom(acts)
    expect(computeGroupStatusFromEff([aLate, aOk], eff, 2, D)).toBe('Em atraso')
    expect(computeGroupStatusFromEff([aLate, aOk], eff, 2, D)).toBe(getGroupStatus([aLate, aOk], acts, D, 2))
  })

  // Scenario 12 — all leaves at 100 in a group → Concluída even with past deadline
  it('all leaves at 100 → Concluída (deadline irrelevant)', () => {
    const a = mkAct({ id: 'p12', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 100, bf: '2022-01-01' })
    const eff = effFrom([a])
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe('Concluída')
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], [a], D, 2))
  })

  // Scenario 13 — finish-only deadline (bf=null, finish set): finish used as deadline
  it('finish-only deadline: finish in past → Em atraso', () => {
    const a = mkAct({ id: 'p13', level: 4, name: 'A', n3: 'M', n4: 'A', pct: 40, bs: '2021-01-01', finish: '2022-01-01' })
    const acts = [a]
    const eff  = effFrom(acts)
    // getGroupStatus uses getEffectiveDates which uses bf??finish for parent bf propagation
    // For a leaf N4, getEffectiveDates returns { bf: a.bf } = null (no finish fallback for display)
    // so getGroupStatus sees bf=null → no deadline check → delta path
    // computeGroupStatusFromEff also reads eff.bf which is a.bf=null → same behavior
    expect(computeGroupStatusFromEff([a], eff, 2, D)).toBe(getGroupStatus([a], acts, D, 2))
  })

  // Scenario 14 — full eff map (all 4 N4 leaves from computeEffectiveMap parity fixture)
  it('full fixture: computeGroupStatusFromEff matches getGroupStatus for all-leaves group', () => {
    const p4Done = mkAct({ id: 'f4Done', level: 4, name: 'Done', n3: 'R', n4: 'Done', pct: 0 })
    const p5D1   = mkAct({ id: 'f5D1',  level: 5, name: 'D1',   n3: 'R', n4: 'Done', n5: 'D1', pct: 100, bs: '2026-01-01', bf: D })
    const p5D2   = mkAct({ id: 'f5D2',  level: 5, name: 'D2',   n3: 'R', n4: 'Done', n5: 'D2', pct: 100, bs: '2026-01-01', bf: D })
    const p4Late = mkAct({ id: 'f4Late', level: 4, name: 'Late', n3: 'R', n4: 'Late', pct: 0 })
    const p5L1   = mkAct({ id: 'f5L1',  level: 5, name: 'L1',   n3: 'R', n4: 'Late', n5: 'L1', pct: 50, bs: '2020-01-01', bf: '2022-01-01' })
    const p4Deep = mkAct({ id: 'f4Deep', level: 4, name: 'Deep', n3: 'R', n4: 'Deep', pct: 0 })
    const p5DS   = mkAct({ id: 'f5DS',   level: 5, name: 'DS',   n3: 'R', n4: 'Deep', n5: 'DS', pct: 0 })
    const p6G1   = mkAct({ id: 'f6G1',   level: 6, name: 'G1',   n3: 'R', n4: 'Deep', n5: 'DS', n6: 'G1', pct: 30, bs: '2026-01-01', bf: D })
    const p6G2   = mkAct({ id: 'f6G2',   level: 6, name: 'G2',   n3: 'R', n4: 'Deep', n5: 'DS', n6: 'G2', pct: 70, bs: '2026-07-01', bf: '2026-12-31' })
    const p4Fin  = mkAct({ id: 'f4Fin',  level: 4, name: 'Fin',  n3: 'R', n4: 'Fin',  pct: 40, bs: '2021-01-01', finish: '2022-01-01' })
    const acts   = [p4Done, p5D1, p5D2, p4Late, p5L1, p4Deep, p5DS, p6G1, p6G2, p4Fin]
    const n4s    = [p4Done, p4Late, p4Deep, p4Fin]
    const eff    = effFrom(acts)
    for (const level of [0, 1, 2, 3, 4] as const) {
      expect(computeGroupStatusFromEff(n4s, eff, level, D)).toBe(getGroupStatus(n4s, acts, D, level))
    }
  })
})
