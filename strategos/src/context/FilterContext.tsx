import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { usePlanos } from '../hooks/usePlanos'
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
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  // Fetch all planos (no program filter) to populate owner/sponsor options
  const { planos } = usePlanos()

  const ownerOptions = useMemo(
    () => [...new Set(planos.map(p => p.owner).filter((v): v is string => Boolean(v)))].sort(),
    [planos],
  )

  const sponsorOptions = useMemo(
    () => [...new Set(planos.map(p => p.sponsor).filter((v): v is string => Boolean(v)))].sort(),
    [planos],
  )

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
    const { programIds, n1Values, n2Values, owners, sponsors, statuses } = filters
    const today = new Date().toISOString().slice(0, 10)

    return activities.filter(a => {
      if (programIds.length  && !programIds.includes(a.program_id ?? ''))  return false
      if (n1Values.length    && !n1Values.includes(a.n1))                  return false
      if (n2Values.length    && !n2Values.includes(a.n2))                  return false
      if (owners.length      && !owners.includes(a.owner))                 return false
      if (sponsors.length    && !sponsors.includes(a.sponsor))             return false

      // Status filter: only applied to leaf activities (level >= 4)
      // Parent activities are always included to preserve tree structure
      if (statuses.length && a.level >= 4) {
        if (!statuses.includes(leafStatus(a, today))) return false
      }

      return true
    })
  }, [filters])

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
