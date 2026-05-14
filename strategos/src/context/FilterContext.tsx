import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import { usePlanos } from '../hooks/usePlanos'
import { useEixos } from '../hooks/useEixos'
import { usePrograms } from '../hooks/usePrograms'
import { buildThresholdsMap } from '../hooks/useThresholdsMap'
import { leafStatus } from '../lib/rollup'
import type { Activity } from '../types/index'

// ── State shape ───────────────────────────────────────────────
export interface FilterState {
  /** Selected program UUIDs */
  programIds: string[]
  /** Selected n1 (eixo) names */
  n1Values: string[]
  /** Selected n2 (plano) names */
  n2Values: string[]
  /** Selected owner names */
  owners: string[]
  /** Selected sponsor names */
  sponsors: string[]
  /** Selected status values */
  statuses: string[]
  /** ISO date string used as cutoff for status recalculation */
  cutoffDate: string | null
}

const DEFAULT_FILTERS: FilterState = {
  programIds:  [],
  n1Values:    [],
  n2Values:    [],
  owners:      [],
  sponsors:    [],
  statuses:    [],
  cutoffDate:  null,
}

const STORAGE_KEY = 'stratgos:filters'

function loadFromStorage(): FilterState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_FILTERS
    const parsed = JSON.parse(saved) as Partial<FilterState>
    return { ...DEFAULT_FILTERS, ...parsed }
  } catch {
    return DEFAULT_FILTERS
  }
}

// ── Context value ─────────────────────────────────────────────
interface FilterContextValue {
  filters: FilterState
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  resetFilters: () => void
  getFilteredActivities: (activities: Activity[]) => Activity[]
  ownerOptions: string[]
  sponsorOptions: string[]
}

const FilterContext = createContext<FilterContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(loadFromStorage)

  // All eixos + planos needed for cascade auto-fill and owner/sponsor lists
  const { eixos: allEixos }     = useEixos()
  const { planos: allPlanos }   = usePlanos()
  const { programs: allPrograms } = usePrograms()

  const thresholdsMap = useMemo(
    () => buildThresholdsMap(allPrograms, allPlanos),
    [allPrograms, allPlanos],
  )

  // Persist to sessionStorage on every filter change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  const ownerOptions = useMemo(
    () => {
      const base = filters.programIds.length > 0
        ? allPlanos.filter(p => filters.programIds.includes(p.program_id ?? ''))
        : allPlanos
      return [...new Set(base.flatMap(p => (p.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)))].sort()
    },
    [allPlanos, filters.programIds],
  )

  const sponsorOptions = useMemo(
    () => {
      const base = filters.programIds.length > 0
        ? allPlanos.filter(p => filters.programIds.includes(p.program_id ?? ''))
        : allPlanos
      return [...new Set(base.flatMap(p => (p.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)))].sort()
    },
    [allPlanos, filters.programIds],
  )

  const setFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }

      if (key === 'programIds') {
        // Parent changed → clear both children
        next.n1Values = []
        next.n2Values = []
        return next
      }

      if (key === 'n1Values') {
        const eixoName = (value as string[])[0]
        if (eixoName) {
          // Auto-fill programa from eixo; prefer a match in current program if names collide
          const currentProgId = prev.programIds[0]
          const eixo = allEixos.find(e => e.name === eixoName && e.program_id === currentProgId)
                    || allEixos.find(e => e.name === eixoName)
          if (eixo?.program_id) next.programIds = [eixo.program_id]
        }
        // Always clear plano (incompatible with new eixo selection or Todos)
        next.n2Values = []
        return next
      }

      if (key === 'n2Values') {
        const planoName = (value as string[])[0]
        if (planoName) {
          // Auto-fill programa + eixo from plano
          const plano = allPlanos.find(p => p.name === planoName)
          if (plano) {
            if (plano.program_id) next.programIds = [plano.program_id]
            const eixoName = plano.eixo?.name
            next.n1Values = eixoName ? [eixoName] : []
          }
        }
        // Plano = Todos → don't touch parents
        return next
      }

      return next
    })
  }, [allEixos, allPlanos])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const getFilteredActivities = useCallback((activities: Activity[]): Activity[] => {
    const { programIds, n1Values, n2Values, owners, sponsors, statuses } = filters
    const today = new Date().toISOString().slice(0, 10)

    const ownerPlanoIds = owners.length
      ? new Set(allPlanos.filter(p => {
          const vals = (p.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)
          return vals.some(v => owners.includes(v))
        }).map(p => p.id))
      : null
    const sponsorPlanoIds = sponsors.length
      ? new Set(allPlanos.filter(p => {
          const vals = (p.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)
          return vals.some(v => sponsors.includes(v))
        }).map(p => p.id))
      : null

    return activities.filter(a => {
      if (programIds.length && !programIds.includes(a.program_id ?? ''))           return false
      if (n1Values.length   && !n1Values.includes(a.n1))                           return false
      if (n2Values.length   && !n2Values.includes(a.n2))                           return false
      if (ownerPlanoIds   && !ownerPlanoIds.has(a.plano_id ?? ''))                 return false
      if (sponsorPlanoIds && !sponsorPlanoIds.has(a.plano_id ?? ''))               return false

      // Status filter: only applied to leaf activities (level >= 4)
      // Parent activities always included to preserve tree structure
      if (statuses.length && a.level >= 4) {
        const tLeaves = thresholdsMap.get(a.plano_id ?? '')?.leaves
        if (!statuses.includes(leafStatus(a, today, tLeaves))) return false
      }

      return true
    })
  }, [filters, allPlanos, thresholdsMap])

  return (
    <FilterContext.Provider value={{ filters, setFilter, resetFilters, getFilteredActivities, ownerOptions, sponsorOptions }}>
      {children}
    </FilterContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────
export function useFilters(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider')
  return ctx
}
