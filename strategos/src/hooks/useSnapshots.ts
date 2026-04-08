import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Snapshot } from '../types/index'

interface UseSnapshotsResult {
  snapshots: Snapshot[]
  loading: boolean
  error: string | null
}

export function useSnapshots(program_id?: string): UseSnapshotsResult {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('snapshots')
      .select('id, label, snap_date, kpi, by_n1, by_n0, created_by')
      .order('snap_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        let rows = (data ?? []) as Snapshot[]

        // Client-side filter by program_id key in by_n0
        if (program_id) {
          rows = rows.filter(s => program_id in s.by_n0)
        }

        setSnapshots(rows)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [program_id])

  return { snapshots, loading, error }
}
