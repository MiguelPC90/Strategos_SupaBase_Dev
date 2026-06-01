import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Person } from '../types/index'

async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Person[]
}

interface UsePeopleResult {
  people: Person[]
  loading: boolean
  error: string | null
}

export function usePeople(): UsePeopleResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['people'],
    queryFn: fetchPeople,
  })

  return {
    people: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
