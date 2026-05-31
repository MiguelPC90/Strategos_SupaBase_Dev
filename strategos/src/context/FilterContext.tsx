import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import { usePlanos } from '../hooks/usePlanos'
import { useEixos } from '../hooks/useEixos'
import { usePeople } from '../hooks/usePeople'
import { getEffectiveStatus } from '../lib/rollup'
import type { Activity } from '../types/index'

// ── State shape ───────────────────────────────────────────────
export interface FilterState {
  /** Selected program UUIDs */
  programIds: string[]
  /** Selected n1 (eixo) names */
  n1Values: string[]
  /** Selected n2 (plano) names */
  n2Values: string[]
  /** Selected owner person UUIDs */
  owners: string[]
  /** Selected sponsor person UUIDs */
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

const STORAGE_KEY     = 'stratgos:filters'
const STORAGE_VERSION = 'v2'  // bump when filter identity format changes

function loadFromStorage(): FilterState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_FILTERS
    const parsed = JSON.parse(saved) as Partial<FilterState> & { _v?: string }
    if (parsed._v !== STORAGE_VERSION) return DEFAULT_FILTERS
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
  /** Display names for the owner filter dropdown */
  ownerOptions: string[]
  /** Display names for the sponsor filter dropdown */
  sponsorOptions: string[]
  /** Maps person UUID → display name (for chip labels) */
  personIdToName: Map<string, string>
}

const FilterContext = createContext<FilterContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(loadFromStorage)

  const { eixos: allEixos }     = useEixos()
  const { planos: allPlanos }   = usePlanos()
  const { people }              = usePeople()

  const personIdToName = useMemo(
    () => new Map(people.map(p => [p.id, p.name])),
    [people],
  )

  // Persist to sessionStorage on every filter change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, _v: STORAGE_VERSION }))
  }, [filters])

  const ownerOptions = useMemo(() => {
    const base = filters.programIds.length > 0
      ? allPlanos.filter(p => filters.programIds.includes(p.program_id ?? ''))
      : allPlanos
    const ids = new Set(base.flatMap(p => p.owner_person_ids))
    return [...ids]
      .map(id => personIdToName.get(id))
      .filter((n): n is string => !!n)
      .sort()
  }, [allPlanos, filters.programIds, personIdToName])

  const sponsorOptions = useMemo(() => {
    const base = filters.programIds.length > 0
      ? allPlanos.filter(p => filters.programIds.includes(p.program_id ?? ''))
      : allPlanos
    const ids = new Set(base.flatMap(p => p.sponsor_person_ids))
    return [...ids]
      .map(id => personIdToName.get(id))
      .filter((n): n is string => !!n)
      .sort()
  }, [allPlanos, filters.programIds, personIdToName])

  const setFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }

      if (key === 'programIds') {
        next.n1Values = []
        next.n2Values = []
        return next
      }

      if (key === 'n1Values') {
        const eixoName = (value as string[])[0]
        if (eixoName) {
          const currentProgId = prev.programIds[0]
          const eixo = allEixos.find(e => e.name === eixoName && e.program_id === currentProgId)
                    || allEixos.find(e => e.name === eixoName)
          if (eixo?.program_id) next.programIds = [eixo.program_id]
        }
        next.n2Values = []
        return next
      }

      if (key === 'n2Values') {
        const planoName = (value as string[])[0]
        if (planoName) {
          const plano = allPlanos.find(p => p.name === planoName)
          if (plano) {
            if (plano.program_id) next.programIds = [plano.program_id]
            const eixoName = plano.eixo?.name
            next.n1Values = eixoName ? [eixoName] : []
          }
        }
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
      ? new Set(allPlanos.filter(p =>
          p.owner_person_ids.some(id => owners.includes(id))
        ).map(p => p.id))
      : null
    const sponsorPlanoIds = sponsors.length
      ? new Set(allPlanos.filter(p =>
          p.sponsor_person_ids.some(id => sponsors.includes(id))
        ).map(p => p.id))
      : null

    return activities.filter(a => {
      if (programIds.length && !programIds.includes(a.program_id ?? ''))           return false
      if (n1Values.length   && !n1Values.includes(a.n1))                           return false
      if (n2Values.length   && !n2Values.includes(a.n2))                           return false
      if (ownerPlanoIds   && !ownerPlanoIds.has(a.plano_id ?? ''))                 return false
      if (sponsorPlanoIds && !sponsorPlanoIds.has(a.plano_id ?? ''))               return false

      if (statuses.length && a.level >= 4) {
        if (!statuses.includes(getEffectiveStatus(a, activities, today))) return false
      }

      return true
    })
  }, [filters, allPlanos])

  const ctxValue = useMemo(
    () => ({ filters, setFilter, resetFilters, getFilteredActivities, ownerOptions, sponsorOptions, personIdToName }),
    [filters, setFilter, resetFilters, getFilteredActivities, ownerOptions, sponsorOptions, personIdToName],
  )

  return (
    <FilterContext.Provider value={ctxValue}>
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
