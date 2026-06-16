import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

async function fetchAppConfig(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('app_config')
    .select('config_key, data')
  if (error) throw new Error(error.message)
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.config_key] = row.data ?? ''
  return map
}

interface UseAppConfigResult {
  config: Record<string, string>
  getNumber: (key: string, fallback: number) => number
  getJSON: <T extends object>(key: string, fallback: T) => T
  loading: boolean
  error: string | null
  invalidate: () => void
}

export function useAppConfig(): UseAppConfigResult {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['app_config'],
    queryFn: fetchAppConfig,
  })

  const config = data ?? {}

  function getNumber(key: string, fallback: number): number {
    const n = Number(config[key])
    return Number.isFinite(n) ? n : fallback
  }

  function getJSON<T extends object>(key: string, fallback: T): T {
    try {
      return config[key] ? { ...fallback, ...JSON.parse(config[key]) } : fallback
    } catch {
      return fallback
    }
  }

  return {
    config,
    getNumber,
    getJSON,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    invalidate: () => { void qc.invalidateQueries({ queryKey: ['app_config'] }) },
  }
}
