import { useMemo } from 'react'
import type { Activity } from '../types/index'
import { computeEffectiveMap } from '../lib/rollup'
import type { RowState } from '../lib/rollup'
import { useBandResolver } from './useThresholdsMap'

export interface EffectiveValue {
  pct:          number
  target:       number
  bs:           string | null
  bf:           string | null
  rs:           string | null
  rf:           string | null
  allAt100:     boolean
  hasDatedLeaf: boolean
  status:       RowState
}

export function useEffectiveValues(
  activities: Activity[],
  today: string,
): Map<string, EffectiveValue> {
  const resolver = useBandResolver()
  return useMemo(() => {
    const full = computeEffectiveMap(activities, today, resolver)
    const map  = new Map<string, EffectiveValue>()
    for (const [id, r] of full) {
      map.set(id, {
        pct:          r.pct,
        target:       r.target,
        bs:           r.bs,
        bf:           r.bf,
        rs:           r.rs,
        rf:           r.rf,
        allAt100:     r.allAt100,
        hasDatedLeaf: r.hasDatedLeaf,
        status:       r.status,
      })
    }
    return map
  }, [activities, today, resolver])
}
