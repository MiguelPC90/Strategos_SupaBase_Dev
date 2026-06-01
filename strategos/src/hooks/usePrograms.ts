import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Program } from '../types/index'

async function fetchPrograms(): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Program[]
}

interface UseProgramsResult {
  programs: Program[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePrograms(): UseProgramsResult {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch: rq } = useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
  })

  return {
    programs: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => { void qc.invalidateQueries({ queryKey: ['programs'] }); void rq() },
  }
}
