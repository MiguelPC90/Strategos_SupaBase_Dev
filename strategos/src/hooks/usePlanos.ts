import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Plano } from '../types/index'

async function fetchPlanos(program_id?: string): Promise<Plano[]> {
  let query = supabase
    .from('planos')
    .select('*, eixo:eixos(name, code)')
    .order('sort_order', { ascending: true })
  if (program_id) query = query.eq('program_id', program_id)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Plano[]
}

interface UsePlanosResult {
  planos: Plano[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePlanos(program_id?: string): UsePlanosResult {
  const qc = useQueryClient()
  const key = program_id ? ['planos', program_id] : ['planos']
  const { data, isLoading, error, refetch: rq } = useQuery({
    queryKey: key,
    queryFn: () => fetchPlanos(program_id),
  })

  return {
    planos: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => { void qc.invalidateQueries({ queryKey: key }); void rq() },
  }
}
