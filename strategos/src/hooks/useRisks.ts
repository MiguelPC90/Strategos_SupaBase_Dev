import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Risk } from '../types/index'

interface UseRisksResult {
  risks: Risk[]
  loading: boolean
  error: string | null
}

export function useRisks(program_id?: string): UseRisksResult {
  const [risks, setRisks]     = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('risks')
      .select('*')
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setRisks((data ?? []) as Risk[])
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id])

  return { risks, loading, error }
}
