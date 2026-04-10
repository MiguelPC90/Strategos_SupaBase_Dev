import './PontoSituacao.css'
import { useState, useMemo } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { usePdsEntries } from '../../hooks/usePdsEntries'
import { usePrograms } from '../../hooks/usePrograms'
import { useFilters } from '../../context/FilterContext'
import type { PdsItem } from '../../types/index'

// ── Text renderer: **bold** + newlines via CSS pre-wrap ────────
function renderText(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
  )
}

// ── PDS item list ──────────────────────────────────────────────
interface ItemListProps {
  items: PdsItem[]
  className?: string
}

function ItemList({ items, className = '' }: ItemListProps) {
  if (items.length === 0) {
    return <p className="pds-empty-items">Sem itens.</p>
  }
  return (
    <ul className={`pds-item-list${className ? ` ${className}` : ''}`}>
      {items.map((item, i) => (
        <li key={i} className="pds-item">
          <span className="pds-item-text">{renderText(item.text)}</span>
          {item.date && <span className="pds-item-date">{item.date}</span>}
          {item.status && <Badge variant="grey">{item.status}</Badge>}
        </li>
      ))}
    </ul>
  )
}

// ── Date formatter ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Main page ──────────────────────────────────────────────────
export default function PontoSituacao() {
  const { filters }  = useFilters()
  const { programs } = usePrograms()
  const { entries, loading } = usePdsEntries(filters.programIds[0])

  const [selectedKey, setSelectedKey] = useState('')
  const [entryIdx, setEntryIdx]       = useState(0)

  // Unique plan options derived from loaded entries
  const planOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { key: string; label: string }[] = []
    for (const e of entries) {
      const key = `${e.program_id}|${e.n0}|${e.n1}`
      if (!seen.has(key)) {
        seen.add(key)
        const prog  = programs.find(p => p.id === e.program_id)
        const parts = [prog?.name ?? '', e.n0, e.plan_name || e.n1].filter(Boolean)
        opts.push({ key, label: parts.join(' › ') })
      }
    }
    return opts
  }, [entries, programs])

  // Entries for the selected plan, sorted newest first
  const planEntries = useMemo(() => {
    if (!selectedKey) return []
    const [pid, n0, n1] = selectedKey.split('|')
    return entries
      .filter(e => String(e.program_id) === pid && e.n0 === n0 && e.n1 === n1)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [entries, selectedKey])

  function handlePlanChange(key: string) {
    setSelectedKey(key)
    setEntryIdx(0)
  }

  const entry      = planEntries[entryIdx] ?? null
  const planLabel  = planOptions.find(o => o.key === selectedKey)?.label ?? ''
  const totalPages = planEntries.length

  return (
    <div className="pds-page">

      {/* Plan selector */}
      <div className="pds-selector-bar">
        <span className="pds-selector-label">Plano</span>
        <select
          className="pds-selector-select"
          value={selectedKey}
          onChange={e => handlePlanChange(e.target.value)}
        >
          <option value="">— Seleccionar plano —</option>
          {planOptions.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Empty / no-selection states */}
      {!selectedKey ? (
        <div className="pds-placeholder">
          Seleccione um plano para ver o ponto de situação.
        </div>
      ) : loading ? (
        <div className="pds-placeholder">A carregar…</div>
      ) : planEntries.length === 0 ? (
        <div className="pds-placeholder">Sem pontos de situação para este plano.</div>
      ) : (
        <>
          {/* Header bar — navy, plan path + date navigator */}
          <div className="pds-header-bar">
            <span className="pds-header-path">{planLabel}</span>
            <div className="pds-header-nav">
              <button
                className="pds-nav-btn"
                disabled={entryIdx >= totalPages - 1}
                onClick={() => setEntryIdx(i => Math.min(i + 1, totalPages - 1))}
                title="Entrada anterior"
              >←</button>
              <span className="pds-header-date">
                {entry && fmtDate(entry.updated_at)}
                {totalPages > 1 && (
                  <span className="pds-header-count"> ({entryIdx + 1}/{totalPages})</span>
                )}
              </span>
              <button
                className="pds-nav-btn"
                disabled={entryIdx === 0}
                onClick={() => setEntryIdx(i => Math.max(i - 1, 0))}
                title="Entrada seguinte"
              >→</button>
            </div>
          </div>

          {/* 2×2 card grid */}
          <div className="pds-grid">
            <Card title="Compromissos anteriores">
              <ItemList items={entry?.commitments_items ?? []} />
            </Card>
            <Card title="Principais avanços">
              <ItemList items={entry?.progress_items ?? []} />
            </Card>
            <Card title="Próximos passos">
              <ItemList items={entry?.next_steps_items ?? []} />
            </Card>
            <Card title="Pontos de atenção">
              <ItemList items={entry?.attention_items ?? []} className="pds-attention-list" />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
