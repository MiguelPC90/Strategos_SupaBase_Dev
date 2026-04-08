import { useState, useRef, useEffect } from 'react'

interface MultiSelectProps {
  label: string
  options?: string[]
  placeholder?: string
}

export default function MultiSelect({ label, options = [], placeholder = 'Todos' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggle(opt: string) {
    setSelected(prev =>
      prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
    )
  }

  const displayValue =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionados`

  return (
    <div className="ms-wrap" ref={ref}>
      <button
        className={`ms-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <span className="ms-label">{label}</span>
        <span className="ms-sep">·</span>
        <span className="ms-value">{displayValue}</span>
        <svg viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="ms-dropdown">
          {options.length === 0 ? (
            <div className="ms-empty">Sem opções disponíveis</div>
          ) : (
            options.map(opt => (
              <label key={opt} className="ms-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                <span>{opt}</span>
              </label>
            ))
          )}
          {selected.length > 0 && (
            <button className="ms-clear" onClick={() => setSelected([])}>
              Limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  )
}
