import './MultiPersonSelect.css'
import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, X, Check } from 'lucide-react'

export interface MultiPersonOption {
  value: string
  label: string
  subtitle?: string
}

interface MultiPersonSelectProps {
  value: string[]
  onChange: (v: string[]) => void
  options: MultiPersonOption[]
  placeholder?: string
  disabled?: boolean
}

export default function MultiPersonSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  disabled = false,
}: MultiPersonSelectProps) {
  const [open,          setOpen]          = useState(false)
  const [query,         setQuery]         = useState('')
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

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
        top:   rect.bottom + 4,
        left:  rect.left,
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

  const toggleOption = (opt: MultiPersonOption) => {
    const next = value.includes(opt.value)
      ? value.filter(v => v !== opt.value)
      : [...value, opt.value]
    onChange(next)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', closeDropdown, { capture: true, passive: true })
    window.addEventListener('resize', closeDropdown)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', closeDropdown, { capture: true })
      window.removeEventListener('resize', closeDropdown)
    }
  }, [open, closeDropdown])

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDropdown() }
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { closeDropdown(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) toggleOption(filtered[activeIdx])
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const displayText = value.length > 0 ? value.join(', ') : null

  return (
    <div
      ref={containerRef}
      className={`mps-root${open ? ' mps-root--open' : ''}${disabled ? ' mps-root--disabled' : ''}`}
    >
      <div
        className="mps-trigger"
        onClick={openDropdown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`mps-value${!displayText ? ' mps-value--placeholder' : ''}`}>
          {displayText ?? placeholder}
        </span>
        {value.length > 0 && !disabled && (
          <button className="mps-clear" onClick={clearAll} tabIndex={-1} aria-label="Limpar">
            <X size={14} strokeWidth={1.5} />
          </button>
        )}
        <span className="mps-chevron" aria-hidden>
          {open ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
        </span>
      </div>

      {open && (
        <div className="mps-dropdown" style={dropdownStyle} role="listbox" aria-multiselectable="true">
          <div className="mps-search-wrap">
            <input
              ref={inputRef}
              className="mps-search"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
              placeholder="Filtrar…"
              aria-label="Filtrar opções"
              onKeyDown={onInputKeyDown}
            />
          </div>
          <ul className="mps-list">
            {filtered.length === 0 ? (
              <li className="mps-empty">Sem resultados</li>
            ) : filtered.map((opt, idx) => {
              const isSelected = value.includes(opt.value)
              return (
                <li
                  key={opt.value}
                  className={[
                    'mps-option',
                    isSelected        ? 'mps-option--selected' : '',
                    idx === activeIdx ? 'mps-option--active'   : '',
                  ].filter(Boolean).join(' ')}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(opt)}
                >
                  <span className="mps-option-label">{opt.label}</span>
                  {opt.subtitle && <span className="mps-option-sub">{opt.subtitle}</span>}
                  {isSelected && <Check size={13} strokeWidth={2} className="mps-option-check" />}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
