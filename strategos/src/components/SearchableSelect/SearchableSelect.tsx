import './SearchableSelect.css'
import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  disabledReason?: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar…',
  disabled = false,
  required = false,
}: SearchableSelectProps) {
  const [open,          setOpen]          = useState(false)
  const [query,         setQuery]         = useState('')
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const containerRef  = useRef<HTMLDivElement>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value) ?? null

  const filtered = useMemo(() =>
    query
      ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
      : options,
    [options, query])

  const openDropdown = () => {
    if (disabled) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      })
    }
    setOpen(true)
    setQuery('')
    setActiveIdx(-1)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIdx(-1)
  }, [])

  const selectOption = (opt: SelectOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    closeDropdown()
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown()
    }
    const scrollHandler = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      closeDropdown()
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', scrollHandler, { capture: true, passive: true })
    window.addEventListener('resize', closeDropdown)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', scrollHandler, { capture: true })
      window.removeEventListener('resize', closeDropdown)
    }
  }, [open, closeDropdown])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown() }
      return
    }
    if (e.key === 'Escape') { closeDropdown(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) selectOption(filtered[activeIdx])
    }
  }

  return (
    <div
      ref={containerRef}
      className={`ss-root${open ? ' ss-root--open' : ''}${disabled ? ' ss-root--disabled' : ''}`}
      onKeyDown={onKeyDown}
    >
      <div
        className="ss-trigger"
        onClick={openDropdown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={`ss-value${!selected ? ' ss-value--placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        {!required && value && !disabled && (
          <button className="ss-clear" onClick={clear} tabIndex={-1} aria-label="Limpar"><X size={14} strokeWidth={1.5} /></button>
        )}
        <span className="ss-chevron" aria-hidden>{open ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}</span>
      </div>

      {open && (
        <div ref={dropdownRef} className="ss-dropdown" style={dropdownStyle} role="listbox">
          <div className="ss-search-wrap">
            <input
              ref={inputRef}
              className="ss-search"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
              placeholder="Filtrar…"
              aria-label="Filtrar opções"
            />
          </div>
          <ul className="ss-list">
            {filtered.length === 0 ? (
              <li className="ss-empty">Sem resultados</li>
            ) : filtered.map((opt, idx) => (
              <li
                key={opt.value}
                className={[
                  'ss-option',
                  opt.disabled        ? 'ss-option--disabled'  : '',
                  idx === activeIdx   ? 'ss-option--active'    : '',
                  opt.value === value ? 'ss-option--selected'  : '',
                ].filter(Boolean).join(' ')}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled}
                onClick={() => selectOption(opt)}
                title={opt.disabled && opt.disabledReason ? opt.disabledReason : undefined}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
