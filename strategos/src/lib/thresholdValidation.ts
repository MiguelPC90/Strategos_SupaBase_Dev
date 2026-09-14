import type { ThresholdBand } from './rollup'

/**
 * A threshold band as held in an edit form: either value may be empty (null),
 * meaning "inherit this value from the parent tier".
 */
export interface BandDraft {
  low:  number | null
  high: number | null
}

export interface BandResolution {
  /** Value to write (null = inherit). */
  low:  number | null
  /** Value to write (null = inherit). */
  high: number | null
  /** Which side was auto-completed from the inherited value, if any. */
  autoFilled: 'low' | 'high' | null
  /** Non-null blocks the save; shown inline next to the band (PT-PT). */
  error: string | null
}

// User-facing messages (PT-PT).
export const ERR_INVERTED = 'O valor mínimo tem de ser menor ou igual ao máximo.'
export const ERR_RANGE    = 'Os valores têm de estar entre 0 e 100.'

function invalidNumber(v: number | null): boolean {
  return v !== null && (!Number.isFinite(v) || v < 0 || v > 100)
}

/**
 * Apply the band edit rules against the value this band would inherit:
 *   1. both empty            → valid, save NULLs (full inheritance), no auto-complete
 *   2. exactly one filled    → auto-complete the empty side from `inherited`
 *   3. after completion, low > high → blocked (error)
 *   4. both filled, low <= high     → valid as entered
 * Non-numeric / out-of-range input is rejected with ERR_RANGE.
 *
 * `inherited` MUST come from the live resolution chain (lib/thresholds.ts
 * buildBandResolver), so the auto-filled value equals the value the engine
 * would actually have used.
 */
export function resolveBandDraft(draft: BandDraft, inherited: ThresholdBand): BandResolution {
  if (invalidNumber(draft.low) || invalidNumber(draft.high)) {
    return { low: draft.low, high: draft.high, autoFilled: null, error: ERR_RANGE }
  }

  // Rule 1 — fully inherited.
  if (draft.low === null && draft.high === null) {
    return { low: null, high: null, autoFilled: null, error: null }
  }

  // Rule 2 — auto-complete the missing half from the inherited value.
  let low  = draft.low
  let high = draft.high
  let autoFilled: 'low' | 'high' | null = null
  if (low === null)  { low  = inherited.low;  autoFilled = 'low'  }
  if (high === null) { high = inherited.high; autoFilled = 'high' }

  // Rule 3 — an inverted band is blocked, never silently clamped on write.
  if (low > high) {
    return { low, high, autoFilled, error: ERR_INVERTED }
  }

  // Rule 4 — valid.
  return { low, high, autoFilled, error: null }
}
