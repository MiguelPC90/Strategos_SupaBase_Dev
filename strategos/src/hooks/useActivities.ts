import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types/index'

interface ActivityFilters {
  program_id?: string
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
  const { program_id, n1, n2, owner, sponsor, status, cutoffDate } = filters
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('activities')
      .select('*')
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)
    if (n1)         query = query.eq('n1', n1)
    if (n2)         query = query.eq('n2', n2)
    if (owner)      query = query.eq('owner', owner)
    if (sponsor)    query = query.eq('sponsor', sponsor)
    if (status)     query = query.eq('status', status)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      let rows = (data ?? []) as Activity[]
      if (cutoffDate) {
        rows = rows.map(a => applyStatusCutoff(a, cutoffDate))
      }
      setActivities(rows)
      setLoading(false)
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program_id, n1, n2, owner, sponsor, status, cutoffDate, tick])

  return { activities, loading, error, refetch }
}
