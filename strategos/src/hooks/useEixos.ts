import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Eixo } from '../types/index'

async function fetchEixos(program_id?: string): Promise<Eixo[]> {
  let query = supabase
    .from('eixos')
    .select('*')
    .order('sort_order', { ascending: true })
  if (program_id) query = query.eq('program_id', program_id)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Eixo[]
}

interface UseEixosResult {
  eixos: Eixo[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useEixos(program_id?: string): UseEixosResult {
  const qc = useQueryClient()
  const key = program_id ? ['eixos', program_id] : ['eixos']
  const { data, isLoading, error, refetch: rq } = useQuery({
    queryKey: key,
    queryFn: () => fetchEixos(program_id),
  })

  return {
    eixos: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => { void qc.invalidateQueries({ queryKey: key }); void rq() },
  }
}
