import type { Program, Plano } from '../types/index'
import type { ThresholdBand, BandResolver, ThresholdKind } from './rollup'

export interface PlanoThresholds {
  leaves:     ThresholdBand
  aggregates: ThresholdBand
}

// Hardcoded absolute-last-resort fallbacks (matches migration 036 defaults).
// Used only when the app_config global is missing. Normally the live app_config
// global bands are threaded in as the terminal fallback (see buildBandResolver).
export const FALLBACK_LEAVES_LOW      = 5
export const FALLBACK_LEAVES_HIGH     = 10
export const FALLBACK_AGGREGATES_LOW  = 15
export const FALLBACK_AGGREGATES_HIGH = 25

const HARDCODED_LEAVES:     ThresholdBand = { low: FALLBACK_LEAVES_LOW,     high: FALLBACK_LEAVES_HIGH }
const HARDCODED_AGGREGATES: ThresholdBand = { low: FALLBACK_AGGREGATES_LOW, high: FALLBACK_AGGREGATES_HIGH }

/**
 * Resolution chain for each individual threshold value:
 *   plano override → program default → GLOBAL fallback
 * Each of the 4 values is resolved independently. If a plano has only
 * leaves_low set (but not high), it falls back to program default for high.
 *
 * The GLOBAL fallback is passed in (the live app_config bands). The hardcoded
 * constants are only the absolute last resort when no global is supplied.
 */
export function buildThresholdsMap(
  programs: Program[],
  planos: Plano[],
  globalLeaves: ThresholdBand = HARDCODED_LEAVES,
  globalAggregates: ThresholdBand = HARDCODED_AGGREGATES,
): Map<string, PlanoThresholds> {
  // Per-program defaults
  const progMap = new Map<string, PlanoThresholds>()
  for (const p of programs) {
    progMap.set(p.id, {
      leaves: {
        low:  p.threshold_leaves_low  ?? globalLeaves.low,
        high: p.threshold_leaves_high ?? globalLeaves.high,
      },
      aggregates: {
        low:  p.threshold_aggregates_low  ?? globalAggregates.low,
        high: p.threshold_aggregates_high ?? globalAggregates.high,
      },
    })
  }

  const map = new Map<string, PlanoThresholds>()
  for (const plano of planos) {
    const prog = progMap.get(plano.program_id ?? '') ?? {
      leaves:     { ...globalLeaves },
      aggregates: { ...globalAggregates },
    }
    map.set(plano.id, {
      leaves: {
        low:  plano.threshold_leaves_low  ?? prog.leaves.low,
        high: plano.threshold_leaves_high ?? prog.leaves.high,
      },
      aggregates: {
        low:  plano.threshold_aggregates_low  ?? prog.aggregates.low,
        high: plano.threshold_aggregates_high ?? prog.aggregates.high,
      },
    })
  }
  return map
}

/** Clamp so a mixed-inheritance band can never invert (high >= low). */
export function clampBand(b: ThresholdBand): ThresholdBand {
  return { low: b.low, high: Math.max(b.low, b.high) }
}

/**
 * Build a BandResolver implementing precedence PLANO > PROGRAMA > GLOBAL with
 * NULL=inherit, resolving each of the 4 values independently and clamping the
 * result (high >= low). The GLOBAL tier is the live app_config band.
 *
 * Resolution:
 *   - a leaf / plano-scoped group (planoId set)  → that plano's band for `kind`
 *   - an eixo / programa group (planoId null)     → the programa's band for `kind`
 *   - neither                                     → the app_config global for `kind`
 */
export function buildBandResolver(
  programs: Program[],
  planos: Plano[],
  globalLeaves: ThresholdBand,
  globalAggregates: ThresholdBand,
): BandResolver {
  const planoMap = buildThresholdsMap(programs, planos, globalLeaves, globalAggregates)

  const progMap = new Map<string, PlanoThresholds>()
  for (const p of programs) {
    progMap.set(p.id, {
      leaves: {
        low:  p.threshold_leaves_low  ?? globalLeaves.low,
        high: p.threshold_leaves_high ?? globalLeaves.high,
      },
      aggregates: {
        low:  p.threshold_aggregates_low  ?? globalAggregates.low,
        high: p.threshold_aggregates_high ?? globalAggregates.high,
      },
    })
  }

  return (programId, planoId, kind: ThresholdKind): ThresholdBand => {
    if (planoId) {
      const pl = planoMap.get(planoId)
      if (pl) return clampBand(pl[kind])
    }
    if (programId) {
      const pr = progMap.get(programId)
      if (pr) return clampBand(pr[kind])
    }
    return clampBand(kind === 'leaves' ? globalLeaves : globalAggregates)
  }
}
