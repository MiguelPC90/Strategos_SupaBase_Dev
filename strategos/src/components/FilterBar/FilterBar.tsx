import './FilterBar.css'
import { useMemo } from 'react'
import { X } from 'lucide-react'
import MultiSelect from '../MultiSelect/MultiSelect'
import { useFilters } from '../../context/FilterContext'
import { usePrograms } from '../../hooks/usePrograms'
import { useActivities } from '../../hooks/useActivities'
import { useProgramLabels } from '../../hooks/useProgramLabels'

const STATUS_OPTIONS = ['Concluída', 'Em dia', 'Em risco', 'Em atraso']

export default function FilterBar() {
  const { filters, setFilter, resetFilters, ownerOptions, sponsorOptions } = useFilters()
  const { programs } = usePrograms()
  const { activities } = useActivities()

  const activeProgramId = filters.programIds.length === 1 ? filters.programIds[0] : undefined
  const labels = useProgramLabels(activeProgramId)

  // Program name ↔ id helpers
  const programNameToId = useMemo(
    () => new Map(programs.map(p => [p.name, p.id])),
    [programs],
  )
  const programIdToName = useMemo(
    () => new Map(programs.map(p => [p.id, p.name])),
    [programs],
  )
  const programNames    = useMemo(() => programs.map(p => p.name), [programs])
  const selectedPrograms = useMemo(
    () => filters.programIds.map(id => programIdToName.get(id) ?? id),
    [filters.programIds, programIdToName],
  )

  // Activities restricted to selected programs (for cascading n1/n2 options)
  const actsForOptions = useMemo(() => {
    if (filters.programIds.length === 0) return activities
    return activities.filter(a => filters.programIds.includes(a.program_id ?? ''))
  }, [activities, filters.programIds])

  const n1Options = useMemo(
    () => [...new Set(actsForOptions.map(a => a.n1).filter(Boolean))].sort(),
    [actsForOptions],
  )

  const n2Options = useMemo(() => {
    const base = filters.n1Values.length > 0
      ? actsForOptions.filter(a => filters.n1Values.includes(a.n1))
      : actsForOptions
    return [...new Set(base.map(a => a.n2).filter(Boolean))].sort()
  }, [actsForOptions, filters.n1Values])

  function handleProgramChange(names: string[]) {
    const ids = names
      .map(n => programNameToId.get(n))
      .filter((id): id is string => id !== undefined)
    setFilter('programIds', ids)
  }

  const activeCount =
    filters.programIds.length +
    filters.n1Values.length +
    filters.n2Values.length +
    filters.owners.length +
    filters.sponsors.length +
    filters.statuses.length

  return (
    <div className="filter-bar">
      <span className="filter-label">Filtros</span>

      <MultiSelect
        label="Programa"
        options={programNames}
        value={selectedPrograms}
        onChange={handleProgramChange}
      />
      <MultiSelect
        label={labels.n1}
        options={n1Options}
        value={filters.n1Values}
        onChange={v => setFilter('n1Values', v)}
      />
      <MultiSelect
        label={labels.n2}
        options={n2Options}
        value={filters.n2Values}
        onChange={v => setFilter('n2Values', v)}
      />
      <MultiSelect
        label={labels.owner}
        options={ownerOptions}
        value={filters.owners}
        onChange={v => setFilter('owners', v)}
      />
      <MultiSelect
        label={labels.sponsor}
        options={sponsorOptions}
        value={filters.sponsors}
        onChange={v => setFilter('sponsors', v)}
      />
      <MultiSelect
        label="Estado"
        options={STATUS_OPTIONS}
        value={filters.statuses}
        onChange={v => setFilter('statuses', v)}
      />

      {activeCount > 0 && (
        <button className="filter-clear" onClick={resetFilters}>
          <X size={14} strokeWidth={1.5} /> Limpar ({activeCount})
        </button>
      )}
    </div>
  )
}
