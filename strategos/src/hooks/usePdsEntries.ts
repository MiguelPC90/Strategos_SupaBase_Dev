import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PdsEntry } from '../types/index'

interface UsePdsEntriesResult {
  entries: PdsEntry[]
  loading: boolean
  error: string | null
}

export function usePdsEntries(program_id?: string): UsePdsEntriesResult {
  const [entries, setEntries] = useState<PdsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('pds_entries')
      .select(`
        id, id0, id1, id2, plan_name, n0, n1, program_id,
        commitments_items, progress_items, next_steps_items, attention_items,
        fte_working_days, created_at, updated_at
      `)
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setEntries((data ?? []) as PdsEntry[])
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id])

  return { entries, loading, error }
}
