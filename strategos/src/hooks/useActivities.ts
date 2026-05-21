import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types/index'

interface ActivityFilters {
  program_id?: string
  plano_id?: string
  n1?: string
  n2?: string
  owner?: string
  sponsor?: string
  status?: string
  /** ISO date string — activities past this date without rf are recalculated as 'atrasada' */
  cutoffDate?: string | null
}

interface UseActivitiesResult {
  activities: Activity[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function applyStatusCutoff(activity: Activity, cutoffDate: string): Activity {
  // Only re-derive status for leaf activities (level > 0) that are not finished
  if (activity.rf || activity.status === 'concluida') return activity
  const deadline = activity.finish ?? activity.bf
  if (!deadline) return activity
  if (deadline < cutoffDate && activity.pct < 100) {
    return { ...activity, status: 'atrasada' }
  }
  return activity
}

export function useActivities(filters: ActivityFilters = {}): UseActivitiesResult {
  const { program_id, plano_id, n1, n2, owner, sponsor, status, cutoffDate } = filters
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const PAGE_SIZE = 1000
    async function fetchAll(): Promise<Activity[]> {
      const all: Activity[] = []
      let from = 0
      while (true) {
        let q = supabase
          .from('activities')
          .select('*')
          .order('sort_order', { ascending: true })
        if (program_id) q = q.eq('program_id', program_id)
        if (plano_id)   q = q.eq('plano_id', plano_id)
        if (n1)         q = q.eq('n1', n1)
        if (n2)         q = q.eq('n2', n2)
        if (owner)      q = q.eq('owner', owner)
        if (sponsor)    q = q.eq('sponsor', sponsor)
        if (status)     q = q.eq('status', status)
        const { data, error: err } = await q.range(from, from + PAGE_SIZE - 1)
        if (err) throw err
        const batch = (data ?? []) as Activity[]
        all.push(...batch)
        if (batch.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return all
    }

    fetchAll()
      .then(rows => {
        if (cancelled) return
        let final = rows
        if (cutoffDate) { final = rows.map(a => applyStatusCutoff(a, cutoffDate)) }
        setActivities(final)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program_id, plano_id, n1, n2, owner, sponsor, status, cutoffDate, tick])

  return { activities, loading, error, refetch }
}
