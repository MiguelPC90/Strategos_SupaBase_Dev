import './CommandPalette.css'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Star } from 'lucide-react'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFavorites } from '../../hooks/useFavorites'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { planos } = usePlanos()
  const { programs } = usePrograms()
  const { favorites } = useFavorites()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const programMap = useMemo(() => new Map(programs.map(p => [p.id, p])), [programs])
  const favSet = useMemo(() => new Set(favorites.map(f => f.plano_id)), [favorites])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      const favPlanos = planos.filter(p => favSet.has(p.id))
      const rest = planos.filter(p => !favSet.has(p.id))
      return [...favPlanos, ...rest].slice(0, 30)
    }
    return planos
      .filter(p => {
        const prog = p.program_id ? programMap.get(p.program_id) : null
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (prog?.name.toLowerCase().includes(q) ?? false)
        )
      })
      .slice(0, 30)
  }, [query, planos, programMap, favSet])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = useCallback((planoId: string) => {
    navigate(`/planos/${planoId}`)
    onClose()
  }, [navigate, onClose])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex].id)
    }
  }

  if (!isOpen) return null

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmdk-input-row">
          <Search size={16} className="cmdk-search-icon" />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Pesquisar plano..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
          />
          <kbd className="cmdk-esc-hint">Esc</kbd>
        </div>
        {results.length > 0 ? (
          <ul ref={listRef} className="cmdk-list">
            {results.map((p, i) => {
              const prog = p.program_id ? programMap.get(p.program_id) : null
              const isFav = favSet.has(p.id)
              return (
                <li
                  key={p.id}
                  className={`cmdk-item${i === selectedIndex ? ' cmdk-item-selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => handleSelect(p.id)}
                >
                  <span className="cmdk-item-main">
                    <span className="cmdk-item-name">{p.name}</span>
                    <span className="cmdk-item-code">{p.code}</span>
                  </span>
                  <span className="cmdk-item-right">
                    {prog && <span className="cmdk-item-prog">{prog.name}</span>}
                    {isFav
                      ? <Star size={13} className="cmdk-fav-star" fill="currentColor" />
                      : <span className="cmdk-fav-placeholder" />
                    }
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="cmdk-empty">Sem resultados</div>
        )}
      </div>
    </div>
  )
}
