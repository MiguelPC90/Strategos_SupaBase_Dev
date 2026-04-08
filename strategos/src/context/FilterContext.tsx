import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
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

// ── Context value ─────────────────────────────────────────────
interface FilterContextValue {
  filters: FilterState
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  resetFilters: () => void
  getFilteredActivities: (activities: Activity[]) => Activity[]
}

const FilterContext = createContext<FilterContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const setFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      // Cascading resets
      if (key === 'programIds') {
        next.n1Values = []
        next.n2Values = []
      } else if (key === 'n1Values') {
        next.n2Values = []
      }
      return next
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const getFilteredActivities = useCallback((activities: Activity[]): Activity[] => {
    const { programIds, n1Values, n2Values, owners, sponsors, statuses, cutoffDate } = filters

    return activities.filter(a => {
      if (programIds.length  && !programIds.includes(a.program_id ?? ''))  return false
      if (n1Values.length    && !n1Values.includes(a.n1))                  return false
      if (n2Values.length    && !n2Values.includes(a.n2))                  return false
      if (owners.length      && !owners.includes(a.owner))                 return false
      if (sponsors.length    && !sponsors.includes(a.sponsor))             return false

      if (statuses.length) {
        // Recalculate status against cutoffDate before filtering
        let effectiveStatus = a.status
        if (cutoffDate && !a.rf && a.status !== 'concluida') {
          const deadline = a.finish ?? a.bf
          if (deadline && deadline < cutoffDate && a.pct < 100) {
            effectiveStatus = 'atrasada'
          }
        }
        if (!statuses.includes(effectiveStatus)) return false
      }

      return true
    })
  }, [filters])

  return (
    <FilterContext.Provider value={{ filters, setFilter, resetFilters, getFilteredActivities }}>
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
