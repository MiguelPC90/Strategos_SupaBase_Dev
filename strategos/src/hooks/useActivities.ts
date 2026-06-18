import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types/index'

interface ActivityFilters {
  program_id?: string
  plano_id?: string
  n1?: string
  n2?: string
  status?: string
}

interface UseActivitiesResult {
  activities: Activity[]
  loading: boolean
  error: string | null
  refetch: () => void
}

async function fetchActivities(filters: ActivityFilters): Promise<Activity[]> {
  const { program_id, plano_id, n1, n2, status } = filters
  const PAGE_SIZE = 1000
  const all: Activity[] = []
  const seen = new Set<string>()
  let from = 0
  while (true) {
    let q = supabase
      .from('activities')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (program_id) q = q.eq('program_id', program_id)
    if (plano_id)   q = q.eq('plano_id', plano_id)
    if (n1)         q = q.eq('n1', n1)
    if (n2)         q = q.eq('n2', n2)
    if (status)     q = q.eq('status', status)
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const batch = (data ?? []) as Activity[]
    for (const row of batch) {
      if (!seen.has(row.id)) {
        seen.add(row.id)
        all.push(row)
      }
    }
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export function useActivities(filters: ActivityFilters = {}): UseActivitiesResult {
  const { program_id, plano_id, n1, n2, status } = filters
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['activities', program_id ?? null, plano_id ?? null, n1 ?? null, n2 ?? null, status ?? null],
    queryFn: () => fetchActivities(filters),
    staleTime: 2 * 60 * 1000,
  })

  return {
    activities: data ?? [],
    loading:    isLoading,
    error:      error ? String(error) : null,
    refetch:    () => { void qc.invalidateQueries({ queryKey: ['activities'] }) },
  }
}
