import { describe, it, expect } from 'vitest'
import {
  computeEffectiveMap,
  computeGroupStatusFromEff,
  getEffectiveStatus,
  type BandResolver,
  type ThresholdBand,
  type ThresholdKind,
} from './rollup'
import type { Activity } from '../types/index'

// Minimal activity factory (mirrors rollup.test.ts)
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

const TODAY = '2025-01-15'

// Wide resolver always returns permissive bands
const WIDE_LEAVES: ThresholdBand = { low: 20, high: 30 }
const wideResolver: BandResolver = (_pid, _lid, kind) =>
  kind === 'leaves' ? WIDE_LEAVES : { low: 30, high: 50 }

describe('BandResolver — Phase 1 dormant capability', () => {

  it('1: omitted resolver uses global THRESHOLD_LEAVES {5,10}', () => {
    // pct=80, pct_prev=95 → target=95, delta=15 → 15 > 10 → Em atraso
    const leaf = mkAct({
      id: 'l1', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      pct: 80, pct_prev: 95,
      program_id: 'prog1', plano_id: 'plan1',
    })
    const eff = computeEffectiveMap([leaf], TODAY)
    expect(eff.get('l1')?.status).toBe('Em atraso')
  })

  it('2: resolver overrides leaf band → different status for same delta', () => {
    // Same leaf; wideResolver returns {low:20,high:30} → delta=15 ≤ 20 → Em dia
    const leaf = mkAct({
      id: 'l2', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      pct: 80, pct_prev: 95,
      program_id: 'prog1', plano_id: 'plan1',
    })
    const eff = computeEffectiveMap([leaf], TODAY, wideResolver)
    expect(eff.get('l2')?.status).toBe('Em dia')
  })

  it('3: resolver receives correct programId, planoId, and kind for an N4 leaf', () => {
    const calls: { programId: unknown; planoId: unknown; kind: ThresholdKind }[] = []
    const spyResolver: BandResolver = (programId, planoId, kind) => {
      calls.push({ programId, planoId, kind })
      return { low: 50, high: 100 }
    }
    const leaf = mkAct({
      id: 'l3', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      pct: 50, pct_prev: 80,
      program_id: 'prog-abc', plano_id: 'plan-xyz',
    })
    computeEffectiveMap([leaf], TODAY, spyResolver)
    expect(calls).toHaveLength(1)
    expect(calls[0].programId).toBe('prog-abc')
    expect(calls[0].planoId).toBe('plan-xyz')
    expect(calls[0].kind).toBe('leaves')
  })

  it('4: getEffectiveStatus uses resolver for leaf (without map)', () => {
    // Without resolver: global {5,10}, delta=15 → Em atraso
    // With wideResolver: {20,30}, delta=15 ≤ 20 → Em dia
    const leaf = mkAct({
      id: 'l4', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      pct: 80, pct_prev: 95,
      program_id: 'prog1', plano_id: 'plan1',
    })
    const all = [leaf]
    expect(getEffectiveStatus(leaf, all, TODAY)).toBe('Em atraso')
    expect(getEffectiveStatus(leaf, all, TODAY, wideResolver)).toBe('Em dia')
  })

  it('5: resolver simulates plano > program > global precedence across two leaves', () => {
    // plano 'special' → tight {5,10}; any other plano → wide {20,30}
    const precedenceResolver: BandResolver = (_pid, planoId, kind) => {
      if (kind !== 'leaves') return { low: 30, high: 50 }
      return planoId === 'special' ? { low: 5, high: 10 } : { low: 20, high: 30 }
    }
    // Both leaves: pct=80, pct_prev=95, delta=15
    const leafSpecial = mkAct({
      id: 'ls', level: 4, name: 'ActS', n3: 'M', n4: 'ActS',
      pct: 80, pct_prev: 95,
      program_id: 'prog1', plano_id: 'special',
    })
    const leafOther = mkAct({
      id: 'lo', level: 4, name: 'ActO', n3: 'M', n4: 'ActO',
      pct: 80, pct_prev: 95,
      program_id: 'prog1', plano_id: 'other',
    })
    const eff = computeEffectiveMap([leafSpecial, leafOther], TODAY, precedenceResolver)
    expect(eff.get('ls')?.status).toBe('Em atraso')  // special → tight band → atraso
    expect(eff.get('lo')?.status).toBe('Em dia')     // other   → wide band  → em dia
  })

  it('6: computeGroupStatusFromEff flips status with resolver', () => {
    // Hand-crafted eff entry so hasDatedLeaf=true drives the target path
    // pct=80, target=95, delta=15; no deadline, not all at 100
    const leaf = mkAct({
      id: 'l6', level: 4, name: 'Act', n3: 'M', n4: 'Act',
      pct: 80,
      program_id: 'prog1', plano_id: 'plan1',
    })
    const effMap = new Map<string, {
      pct: number; bf: string | null; allAt100: boolean; hasDatedLeaf: boolean; target: number
    }>([
      ['l6', { pct: 80, target: 95, bf: null, allAt100: false, hasDatedLeaf: true }],
    ])
    // Without resolver: THRESHOLD_LEAVES {5,10}, delta=15>10 → Em atraso
    expect(computeGroupStatusFromEff([leaf], effMap, 4, TODAY)).toBe('Em atraso')
    // With wideResolver: {20,30}, delta=15≤20 → Em dia
    expect(computeGroupStatusFromEff([leaf], effMap, 4, TODAY, wideResolver)).toBe('Em dia')
  })

})
