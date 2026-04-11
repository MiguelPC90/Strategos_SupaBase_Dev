import './PontoSituacao.css'
import { useState, useMemo } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { usePdsEntries } from '../../hooks/usePdsEntries'
import { useEixos } from '../../hooks/useEixos'
import { useRisks } from '../../hooks/useRisks'
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

// ── Risk helpers ────────────────────────────────────────────────
type RiskBadge = 'green' | 'amber' | 'red' | 'grey'

function grauVariant(grau: number): RiskBadge {
  if (grau <= 4)  return 'green'
  if (grau <= 9)  return 'amber'
  return 'red'
}

function estadoVariant(status: string): RiskBadge {
  const s = status.toLowerCase()
  if (s === 'aberto')         return 'red'
  if (s === 'em mitigação')   return 'amber'
  if (s === 'mitigado')       return 'grey'
  if (s === 'fechado')        return 'green'
  return 'grey'
}

// ── Main page ──────────────────────────────────────────────────
export default function PontoSituacao() {
  const { filters }  = useFilters()
  const programId    = filters.programIds[0] as string | undefined
  const { entries, loading } = usePdsEntries(programId)
  const { eixos } = useEixos(programId)

  const [selectedKey, setSelectedKey] = useState('')
  const [entryIdx, setEntryIdx]       = useState(0)

  const { risks } = useRisks(programId)

  // Plan options from eixos table
  const planOptions = useMemo(() =>
    eixos.map(eixo => ({ key: eixo.id, label: eixo.name })),
    [eixos]
  )

  // Selected eixo
  const selectedEixo = useMemo(
    () => eixos.find(e => e.id === selectedKey) ?? null,
    [eixos, selectedKey]
  )

  // Entries for the selected eixo, sorted newest first
  const planEntries = useMemo(() => {
    if (!selectedEixo) return []
    return entries
      .filter(e => e.n1 === selectedEixo.name)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [entries, selectedKey])

  // Risks linked to any pds_entry sharing id0+id2 with the selected plan
  const planRisks = useMemo(() => {
    if (!planEntries.length) return []
    const { id0, id2 } = planEntries[0]
    const matchIds = new Set(
      entries
        .filter(e => e.id0 === id0 && e.id2 === id2)
        .map(e => e.id)
    )
    return risks.filter(r => matchIds.has(r.pds_id))
  }, [risks, planEntries, entries])

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

          {/* Risks table — only shown when there are risks for this plan */}
          {planRisks.length > 0 && (
            <Card title="Riscos">
              <table className="pds-risk-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th className="pds-risk-num">Impacto</th>
                    <th className="pds-risk-num">Probabilidade</th>
                    <th className="pds-risk-num">Grau</th>
                    <th className="pds-risk-status">Estado</th>
                    <th>Mitigação</th>
                  </tr>
                </thead>
                <tbody>
                  {planRisks.map(r => {
                    const grau = r.impact * r.probability
                    return (
                      <tr key={r.id}>
                        <td>{r.description}</td>
                        <td className="pds-risk-num">{r.impact}</td>
                        <td className="pds-risk-num">{r.probability}</td>
                        <td className="pds-risk-num">
                          <Badge variant={grauVariant(grau)}>{grau}</Badge>
                        </td>
                        <td className="pds-risk-status">
                          <Badge variant={estadoVariant(r.status)}>{r.status}</Badge>
                        </td>
                        <td className="pds-risk-mitigation">{r.mitigation}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
