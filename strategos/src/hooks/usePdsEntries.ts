import { useEffect, useState, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PdsEntry, PdsItem } from '../types/index'

interface UsePdsEntriesResult {
  entries: PdsEntry[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePdsEntries(program_id?: string): UsePdsEntriesResult {
  const [entries, setEntries] = useState<PdsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('pds_entries')
      .select(`
        id, id0, id1, id2, plan_name, n0, n1, program_id, plano_id,
        commitments_items, progress_items, next_steps_items, attention_items,
        fte_working_days, created_at, updated_at
      `)
      .order('sort_order', { ascending: true })

    if (program_id) query = query.eq('program_id', program_id)

    query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setEntries((data ?? []) as PdsEntry[])
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id, tick])

  return { entries, loading, error, refetch }
}

// ── Consolidated hook ──────────────────────────────────────────
// Fetches ALL pds_entries for a given plano_id, merges item arrays
// across entries, and returns them sorted by created_at ascending.

export interface ConsolidatedItems {
  commitments: PdsItem[]
  progress:    PdsItem[]
  nextSteps:   PdsItem[]
  attention:   PdsItem[]
}

interface UsePdsConsolidatedResult {
  items:   ConsolidatedItems
  loading: boolean
  error:   string | null
  refetch: () => void
}

const EMPTY_CONSOLIDATED: ConsolidatedItems = {
  commitments: [],
  progress:    [],
  nextSteps:   [],
  attention:   [],
}

function mergeAndSort(
  entries: Pick<PdsEntry, 'commitments_items' | 'progress_items' | 'next_steps_items' | 'attention_items'>[],
  field: 'commitments_items' | 'progress_items' | 'next_steps_items' | 'attention_items',
): PdsItem[] {
  const all = entries.flatMap(e => (e[field] ?? []) as PdsItem[])
  return all.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

async function fetchPdsConsolidated(planoId: string): Promise<ConsolidatedItems> {
  const { data, error } = await supabase
    .from('pds_entries')
    .select('id, commitments_items, progress_items, next_steps_items, attention_items')
    .eq('plano_id', planoId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Pick<PdsEntry, 'commitments_items' | 'progress_items' | 'next_steps_items' | 'attention_items'>[]
  return {
    commitments: mergeAndSort(rows, 'commitments_items'),
    progress:    mergeAndSort(rows, 'progress_items'),
    nextSteps:   mergeAndSort(rows, 'next_steps_items'),
    attention:   mergeAndSort(rows, 'attention_items'),
  }
}

/**
 * React Query. Key is ['pds_consolidated', planoId] — deliberately DISTINCT from anything
 * usePdsEntries uses: different query, different column set, and GestaoPDS builds its
 * entryIdMap from usePdsEntries. Conflating the two would break the inline-edit lookup
 * silently (it returns early with no toast when the entry is not found).
 *
 * usePdsEntries above is STILL legacy on purpose. It is the read-modify-write source for all
 * three GestaoPDS write paths, which rewrite a whole JSONB array from an in-memory copy with
 * no re-read and no version guard. Caching it would widen the existing lost-update window, so
 * migrating it belongs with a re-read-before-write (or updated_at guard) fix — not here.
 */
export function usePdsConsolidated(planoId?: string): UsePdsConsolidatedResult {
  const qc = useQueryClient()
  const key = ['pds_consolidated', planoId]
  const { data, isLoading, error, refetch: rq } = useQuery({
    queryKey: key,
    queryFn: () => fetchPdsConsolidated(planoId!),
    // No plano selected: fetch nothing and report not-loading, matching the previous
    // behaviour. Without this the query would run unfiltered and return every plano's items.
    enabled: !!planoId,
  })

  return {
    items: data ?? EMPTY_CONSOLIDATED,
    loading: planoId ? isLoading : false,
    error: error ? (error as Error).message : null,
    refetch: () => { void qc.invalidateQueries({ queryKey: key }); void rq() },
  }
}
