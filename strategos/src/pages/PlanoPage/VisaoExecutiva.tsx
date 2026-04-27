import './VisaoExecutiva.css'
import { useMemo } from 'react'
import KpiCard from '../../components/KpiCard/KpiCard'
import { useActivities } from '../../hooks/useActivities'
import { usePdsConsolidated } from '../../hooks/usePdsEntries'
import { useRisks } from '../../hooks/useRisks'
import { useFinancials } from '../../hooks/useFinancials'
import { useSnapshots } from '../../hooks/useSnapshots'
import { usePermissions } from '../../hooks/usePermissions'
import { rollupStatus, rollupPct, leafStatus } from '../../lib/rollup'
import { DEFAULT_THRESHOLDS } from '../../lib/riskColors'
import type { Activity } from '../../types/index'

interface VisaoExecutivaProps {
  planoId: string
  programId: string | null
}

type LeafWithMeta = Activity & { _status: string; _gap: number }

function kpiStatusColor(s: string): 'green' | 'red' | 'amber' | 'blue' | 'text' {
  if (s === 'Concluída') return 'blue'
  if (s === 'Em dia')    return 'green'
  if (s === 'Em risco')  return 'amber'
  if (s === 'Em atraso') return 'red'
  return 'text'
}

function statusBadgeClass(s: string): string {
  if (s === 'Em atraso') return 've-badge-late'
  if (s === 'Em risco')  return 've-badge-risk'
  if (s === 'Em dia')    return 've-badge-ontrack'
  if (s === 'Concluída') return 've-badge-done'
  return ''
}

function fmtEur(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} k€`
  return `${v.toFixed(0)} €`
}

function TrendNode({ delta, unit }: { delta: number | null; unit: string }) {
  if (delta === null) return null
  if (Math.abs(delta) < 0.05) return <span className="ve-trend-flat">— sem alteração</span>
  const sign = delta > 0 ? '▲' : '▼'
  const cls  = delta > 0 ? 've-trend-up' : 've-trend-down'
  return <span className={cls}>{sign} {Math.abs(delta).toFixed(1)}{unit}</span>
}

export default function VisaoExecutiva({ planoId, programId }: VisaoExecutivaProps) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const { activities, loading: actLoading }   = useActivities({ program_id: programId ?? undefined })
  const { items: pdsItems, loading: pdsLoading } = usePdsConsolidated(planoId)
  const { risks, loading: risksLoading }      = useRisks(programId ?? undefined)
  const { budgetLines, invoices, loading: finLoading } = useFinancials(programId ?? undefined)
  const { snapshots }                         = useSnapshots(programId ?? undefined)
  const { canViewCosts }                      = usePermissions()

  const loading = actLoading || pdsLoading || risksLoading || finLoading

  // ── Level-4 leaves for this plano ────────────────────────────
  const leaves = useMemo(
    () => activities.filter(a => a.plano_id === planoId && a.level === 4),
    [activities, planoId],
  )

  // ── KPI calculations ─────────────────────────────────────────
  const status  = useMemo(() => rollupStatus(leaves, today), [leaves, today])
  const execPct = useMemo(() => rollupPct(leaves), [leaves])
  const totalN  = leaves.length
  const doneN   = leaves.filter(a => a.pct >= 100).length
  const concPct = totalN > 0 ? (doneN / totalN) * 100 : 0

  const openAttention = pdsItems.attention.filter(i => !i.hidden_at)
  const planoRisks    = risks.filter(r => r.plano_id === planoId)
  const criticalRisks = planoRisks.filter(r => r.probability * r.impact > DEFAULT_THRESHOLDS.high)

  // ── Snapshot deltas (vs. 7 days ago) ─────────────────────────
  const { execDelta, concDelta } = useMemo(() => {
    const planoSnaps = snapshots
      .filter(s => s.by_n2 != null && planoId in s.by_n2)
      .sort((a, b) => a.snap_date.localeCompare(b.snap_date))

    if (planoSnaps.length < 2) return { execDelta: null, concDelta: null }

    const latest = planoSnaps[planoSnaps.length - 1]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoff = sevenDaysAgo.toISOString().split('T')[0]
    const prev = [...planoSnaps].reverse().find(s => s.snap_date <= cutoff)

    if (!prev || !latest.by_n2 || !prev.by_n2) return { execDelta: null, concDelta: null }

    const lk = latest.by_n2[planoId]
    const pk = prev.by_n2[planoId]
    if (!lk || !pk) return { execDelta: null, concDelta: null }

    const latestConc = lk.total > 0 ? (lk.concluidas / lk.total) * 100 : 0
    const prevConc   = pk.total > 0 ? (pk.concluidas / pk.total) * 100 : 0

    return {
      execDelta: lk.exec_media - pk.exec_media,
      concDelta: latestConc - prevConc,
    }
  }, [snapshots, planoId, today])

  // ── Top 5 critical activities ─────────────────────────────────
  const top5: LeafWithMeta[] = useMemo(() => {
    const withMeta: LeafWithMeta[] = leaves.map(a => ({
      ...a,
      _status: leafStatus(a, today),
      _gap:    a.pct_prev - a.pct,
    }))
    const delayed  = withMeta.filter(a => a._status === 'Em atraso').sort((a, b) => b._gap - a._gap)
    const atRisk   = withMeta.filter(a => a._status === 'Em risco').sort((a, b) => b._gap - a._gap)
    const upcoming = withMeta
      .filter(a => a._status === 'Em dia' && a.bf != null)
      .sort((a, b) => (a.bf ?? '').localeCompare(b.bf ?? ''))
    return [...delayed, ...atRisk, ...upcoming].slice(0, 5)
  }, [leaves, today])

  // ── Finance ──────────────────────────────────────────────────
  const showCosts = canViewCosts('gestao-financeira', programId ?? undefined)

  const { totalBudget, totalExecuted, totalCommitted } = useMemo(() => {
    const lines   = budgetLines.filter(bl => bl.plano_id === planoId)
    const invs    = invoices.filter(inv => inv.plano_id === planoId)
    const budget  = lines.reduce((s, bl) =>
      s + Object.values(bl.values ?? {}).reduce((x, v) => x + (v ?? 0), 0), 0)
    const executed  = invs.filter(i => i.status === 'Paga').reduce((s, i) => s + i.amount, 0)
    const committed = invs.filter(i => i.status === 'Aprovada' || i.status === 'Recebida')
                         .reduce((s, i) => s + i.amount, 0)
    return { totalBudget: budget, totalExecuted: executed, totalCommitted: committed }
  }, [budgetLines, invoices, planoId])

  const execFinPct   = totalBudget > 0 ? (totalExecuted / totalBudget) * 100 : 0
  const commitFinPct = totalBudget > 0 ? ((totalExecuted + totalCommitted) / totalBudget) * 100 : 0

  if (loading) {
    return <div className="ve-loading">A carregar...</div>
  }

  return (
    <div className="ve-wrap">
      {/* Zone 2 — KPI Row */}
      <div className="ve-kpi-row">
        <KpiCard
          label="Status"
          value={status}
          color={kpiStatusColor(status)}
        />
        <KpiCard
          label="% Execução"
          value={`${execPct.toFixed(1)}%`}
          trend={<TrendNode delta={execDelta} unit=" pp" />}
          color="navy"
        />
        <KpiCard
          label="Concretização"
          value={`${concPct.toFixed(0)}%`}
          subtitle={`${doneN} de ${totalN} actividades`}
          trend={<TrendNode delta={concDelta} unit=" pp" />}
          color="navy"
        />
        <KpiCard
          label="Pontos Atenção"
          value={openAttention.length}
          color={openAttention.length > 0 ? 'amber' : 'text'}
        />
        <KpiCard
          label="Riscos Críticos"
          value={criticalRisks.length}
          color={criticalRisks.length > 0 ? 'red' : 'text'}
        />
      </div>

      {/* Zone 3 — Two-column */}
      <div className="ve-two-col">
        {/* Left: Top 5 critical activities */}
        <div className="ve-panel">
          <h3 className="ve-panel-title">Top 5 Actividades Críticas</h3>
          {top5.length === 0 ? (
            <p className="ve-panel-empty">
              {totalN === 0 ? 'Sem actividades registadas.' : 'Todas as actividades em dia.'}
            </p>
          ) : (
            <ul className="ve-act-list">
              {top5.map(a => (
                <li key={a.id} className="ve-act-item">
                  <div className="ve-act-top">
                    <span className="ve-act-name">{a.name}</span>
                    <span className={`ve-badge ${statusBadgeClass(a._status)}`}>{a._status}</span>
                  </div>
                  <div className="ve-act-bar-wrap">
                    <div className="ve-act-bar-outer">
                      <div className="ve-act-bar" style={{ width: `${Math.min(100, a.pct)}%` }} />
                    </div>
                    <span className="ve-act-pct">{a.pct.toFixed(0)}%</span>
                  </div>
                  {a.bf && (
                    <span className="ve-act-date">
                      Prazo: {a.bf.split('-').reverse().join('/')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Immediate attention */}
        <div className="ve-panel">
          <h3 className="ve-panel-title">Atenção Imediata</h3>
          {criticalRisks.length === 0 && openAttention.length === 0 ? (
            <p className="ve-panel-empty">Sem itens de atenção imediata.</p>
          ) : (
            <div className="ve-attn-sections">
              {criticalRisks.length > 0 && (
                <div className="ve-attn-group">
                  <span className="ve-attn-group-lbl">Riscos Críticos</span>
                  <ul className="ve-attn-list">
                    {criticalRisks.slice(0, 5).map(r => (
                      <li key={r.id} className="ve-attn-item ve-attn-risk">
                        <span className="ve-attn-dot" />
                        <span className="ve-attn-text">{r.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {openAttention.length > 0 && (
                <div className="ve-attn-group">
                  <span className="ve-attn-group-lbl">Pontos de Atenção PDS</span>
                  <ul className="ve-attn-list">
                    {openAttention.slice(0, 5).map(item => (
                      <li key={item.id} className="ve-attn-item ve-attn-pds">
                        <span className="ve-attn-dot" />
                        <span className="ve-attn-text">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zone 4 — Finance bar (hidden for ops/view_ops) */}
      {showCosts && totalBudget > 0 && (
        <div className="ve-panel ve-finance-panel">
          <h3 className="ve-panel-title">Execução Financeira</h3>
          <div className="ve-fin-summary">
            <div className="ve-fin-stat">
              <span className="ve-fin-lbl">Orçamento Total</span>
              <span className="ve-fin-val">{fmtEur(totalBudget)}</span>
            </div>
            <div className="ve-fin-stat">
              <span className="ve-fin-lbl">Executado</span>
              <span className="ve-fin-val ve-fin-executed">{fmtEur(totalExecuted)}</span>
            </div>
            <div className="ve-fin-stat">
              <span className="ve-fin-lbl">Comprometido</span>
              <span className="ve-fin-val ve-fin-committed">{fmtEur(totalExecuted + totalCommitted)}</span>
            </div>
            <div className="ve-fin-stat">
              <span className="ve-fin-lbl">Disponível</span>
              <span className="ve-fin-val">{fmtEur(Math.max(0, totalBudget - totalExecuted - totalCommitted))}</span>
            </div>
          </div>
          <div className="ve-fin-bar-outer">
            <div
              className="ve-fin-bar-committed"
              style={{ width: `${Math.min(100, commitFinPct)}%` }}
            />
            <div
              className="ve-fin-bar-executed"
              style={{ width: `${Math.min(100, execFinPct)}%` }}
            />
          </div>
          <div className="ve-fin-bar-legend">
            <span className="ve-fin-legend-item ve-fin-legend-exec">
              <span className="ve-fin-legend-dot" />
              Executado ({execFinPct.toFixed(0)}%)
            </span>
            {totalCommitted > 0 && (
              <span className="ve-fin-legend-item ve-fin-legend-commit">
                <span className="ve-fin-legend-dot" />
                Comprometido ({(commitFinPct - execFinPct).toFixed(0)} pp adicionais)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
