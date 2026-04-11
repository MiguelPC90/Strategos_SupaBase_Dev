import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Plano } from '../types/index'

interface UsePlanosResult {
  planos: Plano[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePlanos(program_id?: string): UsePlanosResult {
  const [planos, setPlanos]   = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('planos')
      .select('*, eixo:eixos(name, code)')
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setPlanos((data ?? []) as unknown as Plano[])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id, tick])

  return { planos, loading, error, refetch }
}
