import './Breadcrumb.css'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useFilters } from '../../context/FilterContext'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { useEixos } from '../../hooks/useEixos'
import { usePlanos } from '../../hooks/usePlanos'
import { useCanEditCurrent } from '../../hooks/useCanEditCurrent'
import { useToast } from '../../context/ToastContext'
import type { PageKey } from '../../types/index'

const GESTAO_PAGES: PageKey[] = [
  'gestao-iniciativas',
  'gestao-pds',
  'gestao-riscos',
  'gestao-financeira',
  'gestao-recursos',
]

const STATUS_OPTIONS = ['Concluída', 'Em dia', 'Em risco', 'Em atraso']

function SecondaryFiltersMenu() {
  const { filters, setFilter, ownerOptions, sponsorOptions } = useFilters()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function toggleFilter(current: string[], key: 'statuses' | 'owners' | 'sponsors', value: string) {
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    setFilter(key, next)
  }

  return (
    <div className="breadcrumb-filters-menu" ref={ref}>
      <button
        className="breadcrumb-add-filter-btn"
        onClick={() => setOpen(o => !o)}
      >
        + Filtros
      </button>
      {open && (
        <div className="breadcrumb-filters-popup">
          <div className="bfp-group">
            <div className="bfp-group-title">Estado</div>
            {STATUS_OPTIONS.map(s => (
              <label key={s} className="bfp-option">
                <input
                  type="checkbox"
                  checked={filters.statuses.includes(s)}
                  onChange={() => toggleFilter(filters.statuses, 'statuses', s)}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
          {ownerOptions.length > 0 && (
            <div className="bfp-group">
              <div className="bfp-group-title">Responsável</div>
              {ownerOptions.map(o => (
                <label key={o} className="bfp-option">
                  <input
                    type="checkbox"
                    checked={filters.owners.includes(o)}
                    onChange={() => toggleFilter(filters.owners, 'owners', o)}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          )}
          {sponsorOptions.length > 0 && (
            <div className="bfp-group">
              <div className="bfp-group-title">Sponsor</div>
              {sponsorOptions.map(s => (
                <label key={s} className="bfp-option">
                  <input
                    type="checkbox"
                    checked={filters.sponsors.includes(s)}
                    onChange={() => toggleFilter(filters.sponsors, 'sponsors', s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

interface SegmentOption {
  value: string | null
  label: string
}

interface BreadcrumbSegmentProps {
  label: string
  options: SegmentOption[]
  current: string | null
  onSelect: (value: string | null) => void
  isFirst?: boolean
}

function BreadcrumbSegment({ label, options, current, onSelect, isFirst }: BreadcrumbSegmentProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="breadcrumb-segment" ref={ref}>
      <button
        className={`breadcrumb-btn${isFirst ? ' first' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{label}</span>
        <svg className="breadcrumb-chevron" width="10" height="10"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="breadcrumb-dropdown">
          {options.map(opt => (
            <button
              key={opt.value ?? '__all__'}
              className={`breadcrumb-option${opt.value === current ? ' active' : ''}`}
              onClick={() => { onSelect(opt.value); setOpen(false) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface FilterChipProps {
  label: string
  onRemove: () => void
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <div className="breadcrumb-chip">
      <span>{label}</span>
      <button className="breadcrumb-chip-remove" onClick={onRemove} title="Remover filtro">×</button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export default function Breadcrumb() {
  const { filters, setFilter } = useFilters()
  const { showToast } = useToast()
  const location = useLocation()

  const pageKey = location.pathname.slice(1) as PageKey
  const isGestaoCurrent = GESTAO_PAGES.includes(pageKey)

  const accessiblePrograms = useAccessiblePrograms(isGestaoCurrent ? pageKey : undefined)

  const programId = filters.programIds[0] ?? null
  const n1Name    = filters.n1Values[0]   ?? null
  const n2Name    = filters.n2Values[0]   ?? null

  // All eixos + planos — filtered in dropdowns based on current selections
  const { eixos: allEixos } = useEixos()
  const { planos: allPlanos } = usePlanos()

  // useCanEditCurrent always called (hook rules); only used when isGestaoCurrent
  const canEditPage = useCanEditCurrent(isGestaoCurrent ? pageKey : 'gestao-pds')
  const showReadOnly = isGestaoCurrent && !canEditPage

  const accessibleProgramIds = useMemo(
    () => new Set(accessiblePrograms.map(p => p.id)),
    [accessiblePrograms],
  )

  // Cascade-restricted dropdown options, always bounded by accessible programs
  const eixoOptions = useMemo(() => {
    if (programId) return allEixos.filter(e => e.program_id === programId)
    return allEixos.filter(e => e.program_id !== null && accessibleProgramIds.has(e.program_id))
  }, [allEixos, programId, accessibleProgramIds])

  const planoOptions = useMemo(() => {
    if (n1Name) return allPlanos.filter(p => p.eixo?.name === n1Name)
    if (programId) return allPlanos.filter(p => p.program_id === programId)
    return allPlanos.filter(p => p.program_id !== null && accessibleProgramIds.has(p.program_id))
  }, [allPlanos, n1Name, programId, accessibleProgramIds])

  // Programmatic selection guard — blocks inaccessible programs and shows feedback
  function trySetProgram(id: string | null) {
    if (id && !accessiblePrograms.find(p => p.id === id)) {
      showToast('Sem acesso a este programa', 'warning')
      return
    }
    setFilter('programIds', id ? [id] : [])
  }

  // Auto-reset programId when it's not accessible on the current page
  useEffect(() => {
    if (!programId) return
    if (accessiblePrograms.length === 0) return
    if (!accessiblePrograms.find(p => p.id === programId)) {
      setFilter('programIds', [])
    }
  }, [accessiblePrograms, programId, setFilter])

  if (isGestaoCurrent && accessiblePrograms.length === 0) {
    return (
      <div className="breadcrumb">
        <div className="breadcrumb-main">
          <span className="breadcrumb-no-access">Sem acesso a programas nesta página</span>
        </div>
      </div>
    )
  }

  const currentProgram = accessiblePrograms.find(p => p.id === programId)

  return (
    <div className="breadcrumb">
      <div className="breadcrumb-main">
        {/* Programa — always visible */}
        <BreadcrumbSegment
          label={currentProgram?.name ?? 'Todos os programas'}
          isFirst
          options={[
            { value: null, label: 'Todos os programas' },
            ...accessiblePrograms.map(p => ({ value: p.id, label: p.name })),
          ]}
          current={programId}
          onSelect={trySetProgram}
        />

        <span className="breadcrumb-separator">›</span>

        {/* Eixo — always visible, restricted to selected program */}
        <BreadcrumbSegment
          label={n1Name ?? 'Todos os eixos'}
          options={[
            { value: null, label: 'Todos os eixos' },
            ...eixoOptions.map(e => ({ value: e.name, label: e.name })),
          ]}
          current={n1Name}
          onSelect={name => setFilter('n1Values', name ? [name] : [])}
        />

        <span className="breadcrumb-separator">›</span>

        {/* Plano — always visible, restricted to selected eixo or program */}
        <BreadcrumbSegment
          label={n2Name ?? 'Todos os planos'}
          options={[
            { value: null, label: 'Todos os planos' },
            ...planoOptions.map(p => ({ value: p.name, label: p.name })),
          ]}
          current={n2Name}
          onSelect={name => setFilter('n2Values', name ? [name] : [])}
        />
      </div>

      {showReadOnly && (
        <span className="breadcrumb-readonly-badge">Só leitura</span>
      )}

      {/* Secondary filter chips + filter button */}
      <div className="breadcrumb-chips">
        {filters.statuses.map(s => (
          <FilterChip
            key={`status:${s}`}
            label={`Estado: ${s}`}
            onRemove={() => setFilter('statuses', filters.statuses.filter(x => x !== s))}
          />
        ))}
        {filters.owners.map(o => (
          <FilterChip
            key={`owner:${o}`}
            label={`Responsável: ${o}`}
            onRemove={() => setFilter('owners', filters.owners.filter(x => x !== o))}
          />
        ))}
        {filters.sponsors.map(s => (
          <FilterChip
            key={`sponsor:${s}`}
            label={`Sponsor: ${s}`}
            onRemove={() => setFilter('sponsors', filters.sponsors.filter(x => x !== s))}
          />
        ))}
        <SecondaryFiltersMenu />
      </div>
    </div>
  )
}
