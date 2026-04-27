import { useMemo } from 'react'
import { usePlanos } from './usePlanos'
import { usePrograms } from './usePrograms'
import type { Program, Plano } from '../types/index'

export interface PlanoThresholds {
  leaves: number
  aggregates: number
}

/** Build a plano-id → thresholds map from programs + planos arrays. */
export function buildThresholdsMap(
  programs: Program[],
  planos: Plano[],
): Map<string, PlanoThresholds> {
  const progMap = new Map<string, PlanoThresholds>()
  for (const p of programs) {
    progMap.set(p.id, {
      leaves:     p.threshold_leaves     ?? 0,
      aggregates: p.threshold_aggregates ?? 20,
    })
  }
  const map = new Map<string, PlanoThresholds>()
  for (const plano of planos) {
    const progThresh = progMap.get(plano.program_id ?? '') ?? { leaves: 0, aggregates: 20 }
    map.set(plano.id, {
      leaves:     plano.threshold_leaves     ?? progThresh.leaves,
      aggregates: plano.threshold_aggregates ?? progThresh.aggregates,
    })
  }
  return map
}

/**
 * Returns a memoised Map<planoId, { leaves, aggregates }>.
 * Resolution: plano override ?? program default ?? hardcoded fallback.
 */
export function useThresholdsMap(): Map<string, PlanoThresholds> {
  const { programs } = usePrograms()
  const { planos }   = usePlanos()
  return useMemo(() => buildThresholdsMap(programs, planos), [programs, planos])
}
