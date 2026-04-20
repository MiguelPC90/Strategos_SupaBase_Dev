import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ActivityDependency, DependencyType } from '../types/index'

interface CreateParams {
  successor_id: string
  predecessor_id: string
  dep_type: DependencyType
  lag_days: number
}

export function useActivityDependencies() {
  const [dependencies, setDependencies] = useState<ActivityDependency[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('activity_dependencies')
      .select('*')
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setDependencies((data ?? []) as ActivityDependency[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createDependency = async (params: CreateParams) => {
    const { data, error: fetchError } = await supabase
      .from('activity_dependencies')
      .insert(params)
      .select()
      .single()

    if (fetchError) return { error: fetchError }
    await load()
    return { data: data as ActivityDependency }
  }

  const updateDependency = async (id: string, patch: Partial<Pick<ActivityDependency, 'dep_type' | 'lag_days'>>) => {
    const { data, error: fetchError } = await supabase
      .from('activity_dependencies')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (fetchError) return { error: fetchError }
    await load()
    return { data: data as ActivityDependency }
  }

  const deleteDependency = async (id: string) => {
    const { error: fetchError } = await supabase
      .from('activity_dependencies')
      .delete()
      .eq('id', id)

    if (fetchError) return { error: fetchError }
    await load()
    return { success: true }
  }

  const getPredecessors = (activityId: string): ActivityDependency[] =>
    dependencies.filter(d => d.successor_id === activityId)

  const getSuccessors = (activityId: string): ActivityDependency[] =>
    dependencies.filter(d => d.predecessor_id === activityId)

  return {
    dependencies,
    loading,
    error,
    reload: load,
    createDependency,
    updateDependency,
    deleteDependency,
    getPredecessors,
    getSuccessors,
  }
}
