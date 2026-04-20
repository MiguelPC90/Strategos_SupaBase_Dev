import './Breadcrumb.css'
import { useState, useRef, useEffect } from 'react'
import { useFilters } from '../../context/FilterContext'
import { usePrograms } from '../../hooks/usePrograms'
import { useEixos } from '../../hooks/useEixos'
import { usePlanos } from '../../hooks/usePlanos'

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
  const { programs } = usePrograms()

  const programId = filters.programIds[0] ?? null
  const n1Name    = filters.n1Values[0]   ?? null
  const n2Name    = filters.n2Values[0]   ?? null

  const { eixos }  = useEixos(programId ?? undefined)
  const { planos } = usePlanos(programId ?? undefined)

  const currentProgram = programs.find(p => p.id === programId)
  const planosForEixo  = n1Name ? planos.filter(p => p.eixo?.name === n1Name) : planos

  const hasChips =
    filters.statuses.length > 0 ||
    filters.owners.length   > 0 ||
    filters.sponsors.length > 0

  return (
    <div className="breadcrumb">
      <div className="breadcrumb-main">
        {/* Program segment — always shown */}
        <BreadcrumbSegment
          label={currentProgram?.name ?? 'Todos os programas'}
          isFirst
          options={[
            { value: null, label: 'Todos os programas' },
            ...programs.map(p => ({ value: p.id, label: p.name })),
          ]}
          current={programId}
          onSelect={id => setFilter('programIds', id ? [id] : [])}
        />

        {/* Eixo segment — only when a program is selected */}
        {programId && (
          <>
            <span className="breadcrumb-separator">›</span>
            <BreadcrumbSegment
              label={n1Name ?? 'Todos os eixos'}
              options={[
                { value: null, label: 'Todos os eixos' },
                ...eixos.map(e => ({ value: e.name, label: e.name })),
              ]}
              current={n1Name}
              onSelect={name => setFilter('n1Values', name ? [name] : [])}
            />
          </>
        )}

        {/* Plano segment — only when an eixo is selected */}
        {n1Name && (
          <>
            <span className="breadcrumb-separator">›</span>
            <BreadcrumbSegment
              label={n2Name ?? 'Todos os planos'}
              options={[
                { value: null, label: 'Todos os planos' },
                ...planosForEixo.map(p => ({ value: p.name, label: p.name })),
              ]}
              current={n2Name}
              onSelect={name => setFilter('n2Values', name ? [name] : [])}
            />
          </>
        )}
      </div>

      {/* Secondary filter chips */}
      {hasChips && (
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
        </div>
      )}
    </div>
  )
}
