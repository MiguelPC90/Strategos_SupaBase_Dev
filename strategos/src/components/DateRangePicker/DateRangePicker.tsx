import './DateRangePicker.css'
import { useState, useEffect, useRef } from 'react'

// ── Props ──────────────────────────────────────────────────────
export interface DateRangePickerProps {
  startDate: string | null
  endDate: string | null
  onChange: (start: string | null, end: string | null) => void
  required?: boolean
  label?: string
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  allowClear?: boolean
  minDate?: string
  maxDate?: string
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function getThisMonth(): [string, string] {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth() + 1
  const ms  = String(m).padStart(2, '0')
  const last = new Date(y, m, 0).getDate()
  return [`${y}-${ms}-01`, `${y}-${ms}-${String(last).padStart(2, '0')}`]
}

function getThisQuarter(): [string, string] {
  const now = new Date()
  const y   = now.getFullYear()
  const q   = Math.floor(now.getMonth() / 3)
  const sm  = q * 3 + 1
  const em  = sm + 2
  const last = new Date(y, em, 0).getDate()
  return [
    `${y}-${String(sm).padStart(2, '0')}-01`,
    `${y}-${String(em).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  ]
}

function getThisYear(): [string, string] {
  const y = new Date().getFullYear()
  return [`${y}-01-01`, `${y}-12-31`]
}

// ── Calendar SVG icon ──────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" className="drp-icon">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────
export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  required    = false,
  label,
  placeholder = 'Seleccionar período',
  disabled    = false,
  size        = 'md',
  allowClear  = true,
  minDate,
  maxDate,
  error,
}: DateRangePickerProps) {
  const [open,       setOpen]       = useState(false)
  const [localStart, setLocalStart] = useState('')
  const [localEnd,   setLocalEnd]   = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape when popup is open
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleOpen = () => {
    if (disabled) return
    setLocalStart(startDate ?? '')
    setLocalEnd(endDate ?? '')
    setOpen(true)
  }

  const handleApply = () => {
    onChange(localStart || null, localEnd || null)
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null, null)
    setOpen(false)
  }

  const applyShortcut = (s: string, e: string) => {
    setLocalStart(s)
    setLocalEnd(e)
  }

  const dateError = !!(localStart && localEnd && localEnd < localStart)
  const hasValue  = !!(startDate || endDate)

  const triggerCls = [
    'drp-trigger',
    size === 'sm' ? 'sm' : '',
    error    ? 'error'    : '',
    disabled ? 'disabled' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="drp-container" ref={containerRef}>
      {label && (
        <span className="drp-label">
          {label}
          {required && <span className="drp-required">*</span>}
        </span>
      )}

      {/* Trigger — div avoids nested <button> inside <button> */}
      <div
        className={triggerCls}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleOpen}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault()
            handleOpen()
          }
        }}
      >
        <CalendarIcon />

        {startDate || endDate ? (
          <span className="drp-dates">
            <span>{formatDate(startDate) || '—'}</span>
            <span className="drp-arrow">→</span>
            {endDate
              ? <span>{formatDate(endDate)}</span>
              : <span className="drp-placeholder">Seleccionar fim</span>
            }
          </span>
        ) : (
          <span className="drp-dates empty">{placeholder}</span>
        )}

        {allowClear && hasValue && (
          <button
            type="button"
            className="drp-clear"
            onClick={e => { e.stopPropagation(); onChange(null, null) }}
            title="Limpar"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {error && <span className="drp-error">{error}</span>}

      {open && (
        <div className="drp-popup">
          {/* Date inputs */}
          <div className="drp-popup-row">
            <div className="drp-popup-field">
              <label>Início</label>
              <input
                type="date"
                value={localStart}
                min={minDate}
                max={maxDate}
                onChange={e => setLocalStart(e.target.value)}
              />
            </div>
            <div className="drp-popup-field">
              <label>Fim</label>
              <input
                type="date"
                value={localEnd}
                min={localStart || minDate}
                max={maxDate}
                onChange={e => setLocalEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Quick-select shortcuts */}
          <div className="drp-shortcuts">
            <button type="button" className="drp-shortcut"
              onClick={() => { const [s, e] = getThisMonth();   applyShortcut(s, e) }}>
              Este mês
            </button>
            <button type="button" className="drp-shortcut"
              onClick={() => { const [s, e] = getThisQuarter(); applyShortcut(s, e) }}>
              Trimestre
            </button>
            <button type="button" className="drp-shortcut"
              onClick={() => { const [s, e] = getThisYear();    applyShortcut(s, e) }}>
              Este ano
            </button>
          </div>

          {dateError && (
            <div className="drp-warn">Data de fim anterior ao início</div>
          )}

          <div className="drp-actions">
            <button type="button" className="drp-btn" onClick={handleClear}>
              Limpar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleApply}
              disabled={dateError}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
