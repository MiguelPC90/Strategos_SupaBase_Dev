import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Risk } from '../types/index'

async function fetchRisks(program_id?: string): Promise<Risk[]> {
  let query = supabase
    .from('risks')
    .select('*')
    .order('sort_order', { ascending: true })
  if (program_id) query = query.eq('program_id', program_id)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Risk[]
}

interface UseRisksResult {
  risks: Risk[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useRisks(program_id?: string): UseRisksResult {
  const qc = useQueryClient()
  // Key-mismatch trap: a caller that omits program_id gets ['risks'], which is NOT
  // invalidated by invalidateQueries(['risks', someId]). Every current caller passes
  // an id — keep it that way, or invalidate both keys after a write.
  const key = program_id ? ['risks', program_id] : ['risks']
  const { data, isLoading, error, refetch: rq } = useQuery({
    queryKey: key,
    queryFn: () => fetchRisks(program_id),
  })

  return {
    risks: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => { void qc.invalidateQueries({ queryKey: key }); void rq() },
  }
}
