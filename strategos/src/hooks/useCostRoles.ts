import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CostRole } from '../types/index'

export function useCostRoles() {
  const [costRoles, setCostRoles] = useState<CostRole[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cost_roles')
      .select('*')
      .order('name')
    if (error) setError(error.message)
    else { setCostRoles(data ?? []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  return { costRoles, loading, error, reload }
}
