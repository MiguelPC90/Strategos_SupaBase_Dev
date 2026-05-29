import { useMemo } from 'react'
import type { Activity } from '../types/index'
import { getEffectivePct, getEffectiveDates, getEffectiveStatus, type RowState } from '../lib/rollup'

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
    const map = new Map<string, EffectiveValue>()
    for (const a of activities) {
      const d = getEffectiveDates(a, activities)
      map.set(a.id, {
        pct:    getEffectivePct(a, activities),
        bs:     d.bs,
        bf:     d.bf,
        rs:     d.rs,
        rf:     d.rf,
        status: getEffectiveStatus(a, activities, today),
      })
    }
    return map
  }, [activities, today])
}
