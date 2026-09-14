import { describe, it, expect } from 'vitest'
import { resolveBandDraft, ERR_INVERTED, ERR_RANGE } from './thresholdValidation'
import type { ThresholdBand } from './rollup'

// Mirrors the smoke data: programa DCI leaves 30/60 is what a plano inherits.
const INHERITED: ThresholdBand = { low: 30, high: 60 }

describe('resolveBandDraft', () => {
  it('rule 1: both empty stays fully inherited (saves NULLs)', () => {
    expect(resolveBandDraft({ low: null, high: null }, INHERITED)).toEqual({
      low: null, high: null, autoFilled: null, error: null,
    })
  })

  it('rule 2: only high filled auto-completes low from inherited', () => {
    // own high=70 + inherited low=30 → 30/70, valid
    expect(resolveBandDraft({ low: null, high: 70 }, INHERITED)).toEqual({
      low: 30, high: 70, autoFilled: 'low', error: null,
    })
  })

  it('rule 2: only low filled auto-completes high from inherited', () => {
    expect(resolveBandDraft({ low: 12, high: null }, INHERITED)).toEqual({
      low: 12, high: 60, autoFilled: 'high', error: null,
    })
  })

  it('rule 3: auto-complete that inverts the band is BLOCKED', () => {
    // the wave's exact case: own high=10 + inherited low=30 → 30/10 → blocked
    const r = resolveBandDraft({ low: null, high: 10 }, INHERITED)
    expect(r.low).toBe(30)
    expect(r.high).toBe(10)
    expect(r.autoFilled).toBe('low')
    expect(r.error).toBe(ERR_INVERTED)
  })

  it('rule 3: both filled but inverted is BLOCKED', () => {
    const r = resolveBandDraft({ low: 40, high: 20 }, INHERITED)
    expect(r.error).toBe(ERR_INVERTED)
  })

  it('rule 4: both filled and ordered saves as entered', () => {
    expect(resolveBandDraft({ low: 12, high: 20 }, INHERITED)).toEqual({
      low: 12, high: 20, autoFilled: null, error: null,
    })
  })

  it('low === high is valid (empty Em risco zone is a deliberate choice)', () => {
    expect(resolveBandDraft({ low: 20, high: 20 }, INHERITED).error).toBeNull()
  })

  it('rejects negative input', () => {
    expect(resolveBandDraft({ low: -5, high: 20 }, INHERITED).error).toBe(ERR_RANGE)
  })

  it('rejects above 100', () => {
    expect(resolveBandDraft({ low: 10, high: 150 }, INHERITED).error).toBe(ERR_RANGE)
  })

  it('rejects non-numeric (NaN from a bad parse)', () => {
    expect(resolveBandDraft({ low: Number.NaN, high: null }, INHERITED).error).toBe(ERR_RANGE)
  })

  it('does not auto-complete when the range check already failed', () => {
    const r = resolveBandDraft({ low: null, high: 200 }, INHERITED)
    expect(r.autoFilled).toBeNull()
    expect(r.low).toBeNull()
  })
})
