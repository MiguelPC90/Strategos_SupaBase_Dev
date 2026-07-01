import { useMemo } from 'react'
import { usePlanos } from './usePlanos'
import { usePrograms } from './usePrograms'
import { useAppConfig } from './useAppConfig'
import type { ThresholdBand, BandResolver } from '../lib/rollup'
import {
  buildThresholdsMap,
  buildBandResolver,
  type PlanoThresholds,
  FALLBACK_LEAVES_LOW,
  FALLBACK_LEAVES_HIGH,
  FALLBACK_AGGREGATES_LOW,
  FALLBACK_AGGREGATES_HIGH,
} from '../lib/thresholds'

// Re-export the pure builders + type so existing importers keep working.
export { buildThresholdsMap, buildBandResolver }
export type { PlanoThresholds }

/** Reads the live app_config global bands the same way Layout does. */
function useGlobalBands(): { globalLeaves: ThresholdBand; globalAggregates: ThresholdBand } {
  const { config } = useAppConfig()
  const globalLeaves = useMemo<ThresholdBand>(() => ({
    low:  parseInt(config['status_delay_threshold_leaves_low']  ?? '5')  || FALLBACK_LEAVES_LOW,
    high: parseInt(config['status_delay_threshold_leaves_high'] ?? '10') || FALLBACK_LEAVES_HIGH,
  }), [config])
  const globalAggregates = useMemo<ThresholdBand>(() => ({
    low:  parseInt(config['status_delay_threshold_aggregates_low']  ?? '15') || FALLBACK_AGGREGATES_LOW,
    high: parseInt(config['status_delay_threshold_aggregates_high'] ?? '25') || FALLBACK_AGGREGATES_HIGH,
  }), [config])
  return { globalLeaves, globalAggregates }
}

/**
 * Returns a memoised Map<planoId, { leaves, aggregates }>.
 * Each of leaves and aggregates is a ThresholdBand { low, high }.
 * Resolution chain per value: plano override → program default → app_config global.
 */
export function useThresholdsMap(): Map<string, PlanoThresholds> {
  const { programs } = usePrograms()
  const { planos }   = usePlanos()
  const { globalLeaves, globalAggregates } = useGlobalBands()
  return useMemo(
    () => buildThresholdsMap(programs, planos, globalLeaves, globalAggregates),
    [programs, planos, globalLeaves, globalAggregates],
  )
}

/**
 * Referentially-stable BandResolver for the live engine. Memoised on
 * [programs, planos, globalLeaves, globalAggregates] so the eff-map does not
 * recompute every render. Consumed by useEffectiveValues and the group pills.
 */
export function useBandResolver(): BandResolver {
  const { programs } = usePrograms()
  const { planos }   = usePlanos()
  const { globalLeaves, globalAggregates } = useGlobalBands()
  return useMemo(
    () => buildBandResolver(programs, planos, globalLeaves, globalAggregates),
    [programs, planos, globalLeaves, globalAggregates],
  )
}
