import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Eixo } from '../types/index'

interface UseEixosResult {
  eixos: Eixo[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useEixos(program_id?: string): UseEixosResult {
  const [eixos, setEixos]     = useState<Eixo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('eixos')
      .select('*')
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setEixos((data ?? []) as Eixo[])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id, tick])

  return { eixos, loading, error, refetch }
}
