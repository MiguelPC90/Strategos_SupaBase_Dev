import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Program } from '../types/index'

interface UseProgramsResult {
  programs: Program[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePrograms(): UseProgramsResult {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('programs')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
        } else {
          setPrograms((data ?? []) as Program[])
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [tick])

  return { programs, loading, error, refetch }
}
