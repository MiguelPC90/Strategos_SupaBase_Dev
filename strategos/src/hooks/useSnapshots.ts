import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Snapshot } from '../types/index'

interface UseSnapshotsResult {
  snapshots: Snapshot[]
  loading: boolean
  error: string | null
}

export function useSnapshots(program_id?: string): UseSnapshotsResult {
  const query = useQuery({
    queryKey: ['snapshots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('snapshots')
        .select('id, label, snap_date, kpi, by_n1, by_n0, by_n2, risks, financials, created_by')
        .order('snap_date', { ascending: true })
      if (error) throw error
      return (data ?? []) as Snapshot[]
    },
    staleTime: 15 * 60 * 1000,
  })

  const snapshots = useMemo(
    () => program_id
      ? (query.data ?? []).filter(s => program_id in (s.by_n0 ?? {}))
      : (query.data ?? []),
    [query.data, program_id],
  )

  return {
    snapshots,
    loading: query.isLoading,
    error:   query.error ? String(query.error) : null,
  }
}
