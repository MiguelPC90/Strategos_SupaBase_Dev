import { useMemo } from 'react'
import { usePlanos } from './usePlanos'
import { usePrograms } from './usePrograms'
import type { Program, Plano } from '../types/index'
import type { ThresholdBand } from '../lib/rollup'

export interface PlanoThresholds {
  leaves:     ThresholdBand
  aggregates: ThresholdBand
}

// Hardcoded fallbacks if everything else is missing (matches migration 036 defaults)
const FALLBACK_LEAVES_LOW      = 5
const FALLBACK_LEAVES_HIGH     = 10
const FALLBACK_AGGREGATES_LOW  = 15
const FALLBACK_AGGREGATES_HIGH = 25

/**
 * Resolution chain for each individual threshold value:
 *   plano override → program default → hardcoded fallback
 * Each of the 4 values is resolved independently. If a plano has only
 * leaves_low set (but not high), it falls back to program default for high.
 */
export function buildThresholdsMap(
  programs: Program[],
  planos: Plano[],
): Map<string, PlanoThresholds> {
  // Per-program defaults
  const progMap = new Map<string, PlanoThresholds>()
  for (const p of programs) {
    progMap.set(p.id, {
      leaves: {
        low:  p.threshold_leaves_low  ?? FALLBACK_LEAVES_LOW,
        high: p.threshold_leaves_high ?? FALLBACK_LEAVES_HIGH,
      },
      aggregates: {
        low:  p.threshold_aggregates_low  ?? FALLBACK_AGGREGATES_LOW,
        high: p.threshold_aggregates_high ?? FALLBACK_AGGREGATES_HIGH,
      },
    })
  }

  const map = new Map<string, PlanoThresholds>()
  for (const plano of planos) {
    const prog = progMap.get(plano.program_id ?? '') ?? {
      leaves:     { low: FALLBACK_LEAVES_LOW,     high: FALLBACK_LEAVES_HIGH },
      aggregates: { low: FALLBACK_AGGREGATES_LOW, high: FALLBACK_AGGREGATES_HIGH },
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

/**
 * Returns a memoised Map<planoId, { leaves, aggregates }>.
 * Each of leaves and aggregates is a ThresholdBand { low, high }.
 * Resolution chain per value: plano override → program default → hardcoded fallback.
 */
export function useThresholdsMap(): Map<string, PlanoThresholds> {
  const { programs } = usePrograms()
  const { planos }   = usePlanos()
  return useMemo(() => buildThresholdsMap(programs, planos), [programs, planos])
}
