import { useMemo } from 'react'
import type { Activity } from '../types/index'
import { computeEffectiveMap } from '../lib/rollup'
import type { RowState } from '../lib/rollup'

export interface EffectiveValue {
  pct:    number
  bs:     string | null
  bf:     string | null
  rs:     string | null
  rf:     string | null
  status: RowState
}

export function useEffectiveValues(
  activities: Activity[],
  today: string,
): Map<string, EffectiveValue> {
  return useMemo(() => {
    const full = computeEffectiveMap(activities, today)
    const map  = new Map<string, EffectiveValue>()
    for (const [id, r] of full) {
      map.set(id, { pct: r.pct, bs: r.bs, bf: r.bf, rs: r.rs, rf: r.rf, status: r.status })
    }
    return map
  }, [activities, today])
}
