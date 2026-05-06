import './VisaoExecutiva.css'
import { useMemo } from 'react'
import Card from '../../components/Card/Card'
import { useActivities } from '../../hooks/useActivities'
import { usePdsConsolidated } from '../../hooks/usePdsEntries'
import { useRisks } from '../../hooks/useRisks'
import { useFinancials } from '../../hooks/useFinancials'
import { useSnapshots } from '../../hooks/useSnapshots'
import { usePermissions } from '../../hooks/usePermissions'
import { useDefaultCurrency } from '../../hooks/useDefaultCurrency'
import { rollupPct, rollupPctPrev, leafStatus } from '../../lib/rollup'
import { DEFAULT_THRESHOLDS } from '../../lib/riskColors'
import type { Activity } from '../../types/index'

interface VisaoExecutivaProps {
  planoId: string
  programId: string | null
}

type LeafWithMeta = Activity & { _status: string; _gap: number }

function statusBadgeClass(s: string): string {
  if (s === 'Em atraso') return 've-badge-late'
  if (s === 'Em risco')  return 've-badge-risk'
  if (s === 'Em dia')    return 've-badge-ontrack'
  if (s === 'Concluída') return 've-badge-done'
  return ''
}

function fmtCur(v: number, sym: string): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M${sym}`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} k${sym}`
  return `${v.toFixed(0)} ${sym}`
}

export default function VisaoExecutiva({ planoId, programId }: VisaoExecutivaProps) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const { activities, loading: actLoading }            = useActivities({ program_id: programId ?? undefined })
  const { items: pdsItems, loading: pdsLoading }       = usePdsConsolidated(planoId)
  const { risks, loading: risksLoading }               = useRisks(programId ?? undefined)
  const { budgetLines, invoices, loading: finLoading } = useFinancials(programId ?? undefined)
  const { snapshots }                                  = useSnapshots(programId ?? undefined)
  const { canViewCosts }                               = usePermissions()
  const { symbol: currSymbol }                         = useDefaultCurrency()

  const loading = actLoading || pdsLoading || risksLoading || finLoading

  // ── Level-4 leaves for this plano ────────────────────────────
  const leaves = useMemo(
    () => activities.filter(a => a.plano_id === planoId && a.level === 4),
    [activities, planoId],
  )

  // ── Activity status counts ────────────────────────────────────
  const actSummary = useMemo(() => {
    const statuses = leaves.map(a => leafStatus(a, today))
    return {
      done:    statuses.filter(s => s === 'Concluída').length,
      ontrack: statuses.filter(s => s === 'Em dia').length,
      risk:    statuses.filter(s => s === 'Em risco').length,
      late:    statuses.filter(s => s === 'Em atraso').length,
      total:   leaves.length,
    }
  }, [leaves, today])

  // ── KPI calculations ─────────────────────────────────────────
  const execPct    = useMemo(() => rollupPct(leaves),            [leaves])
  const execTarget = useMemo(() => rollupPctPrev(leaves, today), [leaves, today])
  const totalN     = leaves.length

  const concGeralVal    = totalN > 0 ? (actSummary.done / totalN) * 100 : 0
  const concGeralTarget = totalN > 0 ? ((actSummary.done + actSummary.late) / totalN) * 100 : null
  const concDataVal     = (actSummary.done + actSummary.late) > 0
    ? (actSummary.done / (actSummary.done + actSummary.late)) * 100 : null

  const openAttention = pdsItems.attention.filter(i => !i.hidden_at)
  const planoRisks    = risks.filter(r => r.plano_id === planoId)
  const criticalRisks = planoRisks.filter(r => r.probability * r.impact > DEFAULT_THRESHOLDS.high)

  // ── Snapshot deltas (vs. 7 days ago) ─────────────────────────
  const {
    execDelta, concGeralDelta, concDataDelta,
    delta7Conc, delta7EmDia, delta7EmRisco, delta7EmAtraso,
  } = useMemo(() => {
    const nullResult = {
      execDelta:      null as number | null,
      concGeralDelta: null as number | null,
      concDataDelta:  null as number | null,
      delta7Conc:     null as number | null,
      delta7EmDia:    null as number | null,
      delta7EmRisco:  null as number | null,
      delta7EmAtraso: null as number | null,
    }

    const planoSnaps = snapshots
      .filter(s => s.by_n2 != null && planoId in s.by_n2)
      .sort((a, b) => a.snap_date.localeCompare(b.snap_date))

    if (planoSnaps.length < 2) return nullResult

    const latest = planoSnaps[planoSnaps.length - 1]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const cutoff = sevenDaysAgo.toISOString().split('T')[0]
    const prev = [...planoSnaps].reverse().find(s => s.snap_date.slice(0, 10) <= cutoff)

    if (!prev || !latest.by_n2 || !prev.by_n2) return nullResult

    const lk = latest.by_n2[planoId]
    const pk = prev.by_n2[planoId]
    if (!lk || !pk) return nullResult

    const lConcGeral = lk.total > 0 ? (lk.concluidas / lk.total) * 100 : 0
    const pConcGeral = pk.total > 0 ? (pk.concluidas / pk.total) * 100 : 0

    const lDue = lk.concluidas + lk.em_atraso
    const pDue = pk.concluidas + pk.em_atraso
    const lConcData = lDue > 0 ? (lk.concluidas / lDue) * 100 : null
    const pConcData = pDue > 0 ? (pk.concluidas / pDue) * 100 : null

    return {
      execDelta:      lk.exec_media - pk.exec_media,
      concGeralDelta: lConcGeral - pConcGeral,
      concDataDelta:  lConcData !== null && pConcData !== null ? lConcData - pConcData : null,
      delta7Conc:     lk.concluidas - pk.concluidas,
      delta7EmDia:    lk.em_dia - pk.em_dia,
      delta7EmRisco:  lk.em_risco !== undefined && pk.em_risco !== undefined
        ? lk.em_risco - pk.em_risco : null,
      delta7EmAtraso: lk.em_atraso - pk.em_atraso,
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
    const lines  = budgetLines.filter(bl => bl.plano_id === planoId)
    const invs   = invoices.filter(inv => inv.plano_id === planoId)
    const budget = lines.reduce((s, bl) =>
      s + Object.values(bl.values ?? {}).reduce((x, v) => x + (v ?? 0), 0), 0)
    const executed  = invs.filter(i => i.status === 'Paga').reduce((s, i) => s + i.amount, 0)
    const committed = invs.filter(i => i.status === 'Aprovada' || i.status === 'Recebida')
                         .reduce((s, i) => s + i.amount, 0)
    return { totalBudget: budget, totalExecuted: executed, totalCommitted: committed }
  }, [budgetLines, invoices, planoId])

  if (loading) {
    return <div className="ve-loading">A carregar...</div>
  }

  return (
    <div className="ve-wrap">
      {/* Zone 2 — 3-card executive KPI summary */}
      <div className="ve-kpi-row">

        {/* Card 1 — ESTADO DAS ACTIVIDADES */}
        <Card title="Estado das Actividades">
          <div className="ve-contagem-kpi-grid">
            <div className="ve-contagem-kpi">
              <div className="ve-contagem-kpi-numbers">
                <span className="ve-contagem-kpi-value t-headline t-tabular">{actSummary.done}</span>
                <span className="ve-contagem-kpi-denom">/ {totalN}</span>
              </div>
              <div className="ve-contagem-kpi-label">Concluídas</div>
              {delta7Conc !== null && (
                <div className={`ve-contagem-kpi-delta ${delta7Conc > 0 ? 'good' : delta7Conc < 0 ? 'bad' : 'neutral'}`}>
                  {delta7Conc > 0 ? '+' : ''}{delta7Conc} últimos 7 dias
                </div>
              )}
            </div>
            <div className="ve-contagem-kpi">
              <div className="ve-contagem-kpi-numbers">
                <span className="ve-contagem-kpi-value t-headline t-tabular">{actSummary.ontrack}</span>
                <span className="ve-contagem-kpi-denom">/ {totalN}</span>
              </div>
              <div className="ve-contagem-kpi-label">Em Dia</div>
              {delta7EmDia !== null && (
                <div className={`ve-contagem-kpi-delta ${delta7EmDia > 0 ? 'neutral' : delta7EmDia < 0 ? 'bad' : 'neutral'}`}>
                  {delta7EmDia > 0 ? '+' : ''}{delta7EmDia} últimos 7 dias
                </div>
              )}
            </div>
            <div className="ve-contagem-kpi">
              <div className="ve-contagem-kpi-numbers">
                <span className={`ve-contagem-kpi-value t-headline t-tabular${actSummary.risk > 0 ? ' risk' : ''}`}>{actSummary.risk}</span>
                <span className="ve-contagem-kpi-denom">/ {totalN}</span>
              </div>
              <div className="ve-contagem-kpi-label">Em Risco</div>
              {delta7EmRisco !== null && (
                <div className={`ve-contagem-kpi-delta ${delta7EmRisco > 0 ? 'bad' : delta7EmRisco < 0 ? 'good' : 'neutral'}`}>
                  {delta7EmRisco > 0 ? '+' : ''}{delta7EmRisco} últimos 7 dias
                </div>
              )}
            </div>
            <div className="ve-contagem-kpi">
              <div className="ve-contagem-kpi-numbers">
                <span className={`ve-contagem-kpi-value t-headline t-tabular${actSummary.late > 0 ? ' late' : ''}`}>{actSummary.late}</span>
                <span className="ve-contagem-kpi-denom">/ {totalN}</span>
              </div>
              <div className="ve-contagem-kpi-label">Em Atraso</div>
              {delta7EmAtraso !== null && (
                <div className={`ve-contagem-kpi-delta ${delta7EmAtraso > 0 ? 'bad' : delta7EmAtraso < 0 ? 'good' : 'neutral'}`}>
                  {delta7EmAtraso > 0 ? '+' : ''}{delta7EmAtraso} últimos 7 dias
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Card 2 — EXECUÇÃO */}
        <Card title="Execução">
          <div className="ve-exec-kpi-grid">
            <div className="ve-exec-kpi">
              <div className="ve-exec-kpi-value-row">
                <span className="ve-exec-kpi-value t-headline-sm t-tabular">{execPct.toFixed(1)}%</span>
                {execDelta !== null && (
                  Math.abs(execDelta) < 0.05
                    ? <span className="ve-exec-kpi-delta neutral">0pp</span>
                    : <span className={`ve-exec-kpi-delta ${execDelta > 0 ? 'positive' : 'negative'}`}>
                        {execDelta > 0 ? '▲' : '▼'}{Math.abs(execDelta).toFixed(1)}pp
                      </span>
                )}
              </div>
              <div className="ve-exec-kpi-target">Objectivo: {execTarget.toFixed(1)}%</div>
              <div className="ve-exec-kpi-label">Grau de Execução</div>
            </div>
            <div className="ve-exec-kpi">
              <div className="ve-exec-kpi-value-row">
                <span className="ve-exec-kpi-value t-headline-sm t-tabular">{concGeralVal.toFixed(1)}%</span>
                {concGeralDelta !== null && (
                  Math.abs(concGeralDelta) < 0.05
                    ? <span className="ve-exec-kpi-delta neutral">0pp</span>
                    : <span className={`ve-exec-kpi-delta ${concGeralDelta > 0 ? 'positive' : 'negative'}`}>
                        {concGeralDelta > 0 ? '▲' : '▼'}{Math.abs(concGeralDelta).toFixed(1)}pp
                      </span>
                )}
              </div>
              {concGeralTarget !== null
                ? <div className="ve-exec-kpi-target">Objectivo: {concGeralTarget.toFixed(1)}%</div>
                : <div className="ve-exec-kpi-target" />
              }
              <div className="ve-exec-kpi-label">Concretização Geral</div>
            </div>
            <div className="ve-exec-kpi">
              <div className="ve-exec-kpi-value-row">
                <span className="ve-exec-kpi-value t-headline-sm t-tabular">
                  {concDataVal !== null ? `${concDataVal.toFixed(1)}%` : '—'}
                </span>
                {concDataDelta !== null && (
                  Math.abs(concDataDelta) < 0.05
                    ? <span className="ve-exec-kpi-delta neutral">0pp</span>
                    : <span className={`ve-exec-kpi-delta ${concDataDelta > 0 ? 'positive' : 'negative'}`}>
                        {concDataDelta > 0 ? '▲' : '▼'}{Math.abs(concDataDelta).toFixed(1)}pp
                      </span>
                )}
              </div>
              <div className="ve-exec-kpi-target">Objectivo: 100%</div>
              <div className="ve-exec-kpi-label">Concretização à Data</div>
            </div>
          </div>
        </Card>

        {/* Card 3 — A REQUERER ATENÇÃO */}
        <Card title="A Requerer Atenção">
          <div className="ve-attn-kpi-grid">
            <div className="ve-attn-kpi">
              <span className={`ve-attn-kpi-value t-display t-tabular${criticalRisks.length > 0 ? ' risk' : ''}`}>
                {criticalRisks.length}
              </span>
              <span className="ve-attn-kpi-label">Riscos Críticos</span>
            </div>
            <div className="ve-attn-kpi">
              <span className={`ve-attn-kpi-value t-display t-tabular${openAttention.length > 0 ? ' amber' : ''}`}>
                {openAttention.length}
              </span>
              <span className="ve-attn-kpi-label">Pontos de Atenção</span>
            </div>
          </div>
        </Card>
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

      {/* Zone 4 — Finance mini cards (hidden for ops/view_ops) */}
      {showCosts && totalBudget > 0 && (
        <div className="ve-fin-cards">
          <div className="ve-fin-card">
            <span className="ve-fin-card-lbl">Orçamento</span>
            <span className="ve-fin-card-val">{fmtCur(totalBudget, currSymbol)}</span>
          </div>
          <div className="ve-fin-card">
            <span className="ve-fin-card-lbl">Comprometido</span>
            <span className="ve-fin-card-val ve-fin-card-committed">
              {fmtCur(totalExecuted + totalCommitted, currSymbol)}
            </span>
            <span className="ve-fin-card-pct">
              {((totalExecuted + totalCommitted) / totalBudget * 100).toFixed(1)}% do orç.
            </span>
          </div>
          <div className="ve-fin-card">
            <span className="ve-fin-card-lbl">Executado</span>
            <span className="ve-fin-card-val ve-fin-card-executed">
              {fmtCur(totalExecuted, currSymbol)}
            </span>
            <span className="ve-fin-card-pct">
              {(totalExecuted / totalBudget * 100).toFixed(1)}% do orç.
            </span>
          </div>
          <div className="ve-fin-card">
            <span className="ve-fin-card-lbl">Disponível</span>
            <span className="ve-fin-card-val">
              {fmtCur(Math.max(0, totalBudget - totalExecuted - totalCommitted), currSymbol)}
            </span>
            <span className="ve-fin-card-pct">
              {(Math.max(0, totalBudget - totalExecuted - totalCommitted) / totalBudget * 100).toFixed(1)}% do orç.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
