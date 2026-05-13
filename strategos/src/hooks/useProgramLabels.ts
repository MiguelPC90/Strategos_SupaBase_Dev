import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ProgramLabels {
  n1:      string
  n2:      string
  owner:   string
  sponsor: string
}

export const DEFAULT_LABELS: ProgramLabels = {
  n1:      'Eixo',
  n2:      'Plano de Acção',
  owner:   'Responsável',
  sponsor: 'Sponsor',
}

// Module-level cache: programId → merged labels (avoids repeated Supabase fetches)
const labelsCache = new Map<string, ProgramLabels>()

export function useProgramLabels(programId: string | null | undefined): ProgramLabels {
  const [labels, setLabels] = useState<ProgramLabels>(
    programId ? (labelsCache.get(programId) ?? DEFAULT_LABELS) : DEFAULT_LABELS,
  )

  useEffect(() => {
    if (!programId) {
      setLabels(DEFAULT_LABELS)
      return
    }
    if (labelsCache.has(programId)) {
      setLabels(labelsCache.get(programId)!)
      return
    }
    let cancelled = false
    supabase
      .from('app_config')
      .select('data')
      .eq('config_key', `filter_labels_${programId}`)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const merged: ProgramLabels = { ...DEFAULT_LABELS }
        if (data?.data) {
          try {
            const parsed = JSON.parse(data.data) as Partial<ProgramLabels>
            if (parsed.n1)      merged.n1      = parsed.n1
            if (parsed.n2)      merged.n2      = parsed.n2
            if (parsed.owner)   merged.owner   = parsed.owner
            if (parsed.sponsor) merged.sponsor = parsed.sponsor
          } catch { /* keep defaults */ }
        }
        labelsCache.set(programId, merged)
        setLabels(merged)
      })
    return () => { cancelled = true }
  }, [programId])

  return labels
}
