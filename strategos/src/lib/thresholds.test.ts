import { describe, it, expect } from 'vitest'
import { buildThresholdsMap, buildBandResolver } from './thresholds'
import type { Program, Plano } from '../types/index'
import type { ThresholdBand } from './rollup'

// ── Minimal fixtures ───────────────────────────────────────────
function mkProgram(overrides: Partial<Program> & { id: string }): Program {
  return {
    code: 'P', name: 'Prog', description: null, sort_order: 0,
    threshold_leaves_low: 5, threshold_leaves_high: 10,
    threshold_aggregates_low: 15, threshold_aggregates_high: 25,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

function mkPlano(overrides: Partial<Plano> & { id: string }): Plano {
  return {
    eixo_id: 'e1', program_id: 'prog1', code: 'PL', name: 'Plano',
    owner_person_ids: [], owner_primary_id: null, owner_label_override: null,
    sponsor_person_ids: [], sponsor_primary_id: null, sponsor_label_override: null,
    start_date: null, end_date: null, objective: null, sort_order: 0,
    threshold_leaves_low: null, threshold_leaves_high: null,
    threshold_aggregates_low: null, threshold_aggregates_high: null,
    created_at: '', updated_at: '', eixo: null,
    ...overrides,
  }
}

const GLOBAL_LEAVES:     ThresholdBand = { low: 5,  high: 10 }
const GLOBAL_AGGREGATES: ThresholdBand = { low: 15, high: 25 }

// Mirrors the DB smoke data: programa DCI leaves 30/60; plano DCI 1 leaves 15/25 own override.
const progDCI = mkProgram({
  id: 'DCI',
  threshold_leaves_low: 30, threshold_leaves_high: 60,
  threshold_aggregates_low: 15, threshold_aggregates_high: 25,
})
const planoDCI1 = mkPlano({
  id: 'DCI1', program_id: 'DCI',
  threshold_leaves_low: 15, threshold_leaves_high: 25, // own leaves override
  threshold_aggregates_low: null, threshold_aggregates_high: null, // inherit
})
const planoTeste = mkPlano({
  id: 'Teste', program_id: 'DCI',
  threshold_leaves_low: null, threshold_leaves_high: null, // inherit programa 30/60
})

describe('buildThresholdsMap — precedence plano>programa>global, per value', () => {
  const map = buildThresholdsMap([progDCI], [planoDCI1, planoTeste], GLOBAL_LEAVES, GLOBAL_AGGREGATES)

  it('plano with own leaves override wins', () => {
    expect(map.get('DCI1')!.leaves).toEqual({ low: 15, high: 25 })
  })

  it('plano leaves NULL inherits the programa band', () => {
    expect(map.get('Teste')!.leaves).toEqual({ low: 30, high: 60 })
  })

  it('plano aggregates NULL inherits the programa aggregates (which here = global)', () => {
    expect(map.get('DCI1')!.aggregates).toEqual({ low: 15, high: 25 })
  })

  it('each of the 4 values is resolved independently (low from plano, high inherited)', () => {
    const prog = mkProgram({ id: 'PX', threshold_leaves_low: 8, threshold_leaves_high: 40 })
    const plano = mkPlano({ id: 'PLX', program_id: 'PX', threshold_leaves_low: 12, threshold_leaves_high: null })
    const m = buildThresholdsMap([prog], [plano], GLOBAL_LEAVES, GLOBAL_AGGREGATES)
    expect(m.get('PLX')!.leaves).toEqual({ low: 12, high: 40 }) // low from plano, high from programa
  })

  it('program_id missing → global terminal fallback', () => {
    const orphan = mkPlano({ id: 'ORPH', program_id: null })
    const m = buildThresholdsMap([], [orphan], GLOBAL_LEAVES, GLOBAL_AGGREGATES)
    expect(m.get('ORPH')!.leaves).toEqual(GLOBAL_LEAVES)
    expect(m.get('ORPH')!.aggregates).toEqual(GLOBAL_AGGREGATES)
  })
})

describe('buildBandResolver — precedence + clamp + group identity', () => {
  const resolver = buildBandResolver([progDCI], [planoDCI1, planoTeste], GLOBAL_LEAVES, GLOBAL_AGGREGATES)

  it('leaf of DCI 1 → its own leaves override 15/25', () => {
    expect(resolver('DCI', 'DCI1', 'leaves')).toEqual({ low: 15, high: 25 })
  })

  it('leaf of Teste → inherits programa leaves 30/60', () => {
    expect(resolver('DCI', 'Teste', 'leaves')).toEqual({ low: 30, high: 60 })
  })

  it('eixo/programa aggregate (planoId null) → programa aggregates 15/25, NOT a child plano', () => {
    expect(resolver('DCI', null, 'aggregates')).toEqual({ low: 15, high: 25 })
  })

  it('unknown planoId falls through to the programa tier', () => {
    expect(resolver('DCI', 'ghost', 'leaves')).toEqual({ low: 30, high: 60 })
  })

  it('neither id → global tier', () => {
    expect(resolver(null, null, 'leaves')).toEqual(GLOBAL_LEAVES)
    expect(resolver(null, null, 'aggregates')).toEqual(GLOBAL_AGGREGATES)
  })

  it('clamps an inverted band (high < low) to high = low', () => {
    // plano sets leaves_low=70, high NULL → inherits programa high 60 → 70/60 inverted → clamp 70/70
    const progInv = mkProgram({ id: 'INV', threshold_leaves_low: 30, threshold_leaves_high: 60 })
    const planoInv = mkPlano({ id: 'PLINV', program_id: 'INV', threshold_leaves_low: 70, threshold_leaves_high: null })
    const r = buildBandResolver([progInv], [planoInv], GLOBAL_LEAVES, GLOBAL_AGGREGATES)
    expect(r('INV', 'PLINV', 'leaves')).toEqual({ low: 70, high: 70 })
  })
})
