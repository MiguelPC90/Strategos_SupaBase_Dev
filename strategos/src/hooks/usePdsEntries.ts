import { useEffect, useState, useCallback } from 'react'
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

export function usePdsConsolidated(planoId?: string): UsePdsConsolidatedResult {
  const [items,   setItems]   = useState<ConsolidatedItems>(EMPTY_CONSOLIDATED)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tick,    setTick]    = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    if (!planoId) {
      setItems(EMPTY_CONSOLIDATED)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('pds_entries')
      .select('id, commitments_items, progress_items, next_steps_items, attention_items')
      .eq('plano_id', planoId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        const rows = (data ?? []) as Pick<PdsEntry, 'commitments_items' | 'progress_items' | 'next_steps_items' | 'attention_items'>[]
        setItems({
          commitments: mergeAndSort(rows, 'commitments_items'),
          progress:    mergeAndSort(rows, 'progress_items'),
          nextSteps:   mergeAndSort(rows, 'next_steps_items'),
          attention:   mergeAndSort(rows, 'attention_items'),
        })
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [planoId, tick])

  return { items, loading, error, refetch }
}
