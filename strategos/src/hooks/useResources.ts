import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FteResource } from '../types/index'

interface UseResourcesResult {
  resources: FteResource[]
  loading: boolean
  error: string | null
}

export function useResources(program_id?: string): UseResourcesResult {
  const [resources, setResources] = useState<FteResource[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('fte_resources')
      .select('*')
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setResources((data ?? []) as FteResource[])
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id])

  return { resources, loading, error }
}
