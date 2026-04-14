import './Evolucao.css'
import { useState, useMemo } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import { useSnapshots } from '../../hooks/useSnapshots'
import { usePrograms } from '../../hooks/usePrograms'
import { useEixos } from '../../hooks/useEixos'
import type { Snapshot, SnapshotKpi } from '../../types/index'

// ── Helpers ────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear().toString()

function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

/** X-axis tick: DD/MM (same year) or DD/MM/YY (different year) */
function fmtSnap(isoDate: string): string {
  const date = isoDate.slice(0, 10)
  const [yyyy, mm, dd] = date.split('-')
  if (yyyy === CURRENT_YEAR) return `${dd}/${mm}`
  return `${dd}/${mm}/${yyyy.slice(2)}`
}

/** Tooltip label: DD/MM/YYYY HH:MM */
function fmtSnapTooltip(isoDate: string): string {
  const date = isoDate.slice(0, 10)
  const [yyyy, mm, dd] = date.split('-')
  const time = isoDate.length > 10 ? isoDate.slice(11, 16) : ''
  return time ? `${dd}/${mm}/${yyyy} ${time}` : `${dd}/${mm}/${yyyy}`
}

function delta(val: number): string {
  return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1)
}

type KpiColor = 'navy' | 'green' | 'blue' | 'red' | 'amber' | 'text'

function deltaColor(val: number, positiveIsGood: boolean): KpiColor {
  if (val > 0) return positiveIsGood ? 'green' : 'red'
  if (val < 0) return positiveIsGood ? 'red' : 'green'
  return 'text'
}

function extractKpi(s: Snapshot, pid: string): SnapshotKpi {
  if (pid && s.by_n0[pid]) return s.by_n0[pid]
  return s.kpi
}

// ── Comparison table helpers ───────────────────────────────────
const VAR_GREEN = '#3B6D11'
const VAR_RED   = '#A32D2D'

interface CompRow {
  label: string
  ref: number
  actual: number
  invertColor: boolean
  isPercent: boolean
}

interface CompGroup {
  title: string
  rows: CompRow[]
}

function varStyle(variation: number, invertColor: boolean): { color: string; prefix: string } {
  if (variation === 0) return { color: 'var(--text3)', prefix: '' }
  const isPositive = variation > 0
  const isGood = invertColor ? !isPositive : isPositive
  return { color: isGood ? VAR_GREEN : VAR_RED, prefix: isPositive ? '▲ ' : '▼ ' }
}

function fmtVal(v: number, isPercent: boolean): string {
  return isPercent ? v.toFixed(1) + '%' : Math.round(v).toString()
}

function fmtVariationPct(variation: number, ref: number): string {
  if (ref === 0) return '—'
  const pct = variation / ref * 100
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
}

// ── Colours ────────────────────────────────────────────────────
const NAVY  = '#002E5E'
const GREEN = '#95BB42'
const BLUE  = '#185FA5'

// ── Component ──────────────────────────────────────────────────
export default function Evolucao() {
  const [programId, setProgramId] = useState('')
  const [dateFrom,  setDateFrom]  = useState(defaultFrom)
  const [dateTo,    setDateTo]    = useState(defaultTo)

  const { programs }                  = usePrograms()
  const { snapshots, loading, error } = useSnapshots(programId || undefined)
  const { eixos }                     = useEixos(programId || undefined)

  // UUID → name map: resolves eixo UUIDs used as by_n1 keys since migration 007
  const eixoNameById = useMemo(
    () => new Map(eixos.map(e => [e.id, e.name])),
    [eixos],
  )

  // ── filter by date range ──────────────────────────────────────
  const filtered = useMemo(
    () => snapshots.filter(s => s.snap_date >= dateFrom && s.snap_date <= dateTo),
    [snapshots, dateFrom, dateTo],
  )

  // ── chart data ────────────────────────────────────────────────
  const chartData = useMemo(
    () => filtered.map(s => {
      const kpi   = extractKpi(s, programId)
      const concr = kpi.total > 0 ? kpi.concluidas / kpi.total * 100 : 0
      const aData = kpi.total > 0 ? (kpi.concluidas + kpi.em_dia) / kpi.total * 100 : 0
      return {
        fullDate: s.snap_date,
        exec:     +kpi.exec_media.toFixed(1),
        concr:    +concr.toFixed(1),
        aData:    +aData.toFixed(1),
        objetivo: 100,
      }
    }),
    [filtered, programId],
  )

  // ── unique eixo keys (for comparison table Per Eixo group) ────
  const eixoKeys = useMemo(() => {
    const keys = new Set<string>()
    filtered.forEach(s => Object.keys(s.by_n1).forEach(k => keys.add(k)))
    return [...keys].sort()
  }, [filtered])

  // ── comparison table data ─────────────────────────────────────
  const compGroups = useMemo<CompGroup[]>(() => {
    if (filtered.length < 2) return []
    const first = extractKpi(filtered[0], programId)
    const last  = extractKpi(filtered[filtered.length - 1], programId)

    const firstConcr = first.total > 0 ? first.concluidas / first.total * 100 : 0
    const lastConcr  = last.total  > 0 ? last.concluidas  / last.total  * 100 : 0
    const firstAData = first.total > 0 ? (first.concluidas + first.em_dia) / first.total * 100 : 0
    const lastAData  = last.total  > 0 ? (last.concluidas  + last.em_dia)  / last.total  * 100 : 0

    const groups: CompGroup[] = [
      {
        title: 'Dados Gerais',
        rows: [
          { label: 'Total actividades (N4)', ref: first.total,      actual: last.total,      invertColor: false, isPercent: false },
          { label: 'Concluídas',             ref: first.concluidas, actual: last.concluidas, invertColor: false, isPercent: false },
          { label: 'Em dia',                 ref: first.em_dia,     actual: last.em_dia,     invertColor: false, isPercent: false },
          { label: 'Em atraso',              ref: first.em_atraso,  actual: last.em_atraso,  invertColor: true,  isPercent: false },
        ],
      },
      {
        title: 'Indicadores de Execução',
        rows: [
          { label: 'Grau de execução (%)', ref: first.exec_media, actual: last.exec_media, invertColor: false, isPercent: true },
          { label: 'Exec. objectivo (%)',  ref: 100,              actual: 100,             invertColor: false, isPercent: true },
        ],
      },
      {
        title: 'Indicadores de Concretização',
        rows: [
          { label: 'Concretização geral (%)',      ref: firstConcr, actual: lastConcr, invertColor: false, isPercent: true },
          { label: 'Concretização geral obj. (%)', ref: 100,        actual: 100,       invertColor: false, isPercent: true },
          { label: 'Concretização à data (%)',     ref: firstAData, actual: lastAData, invertColor: false, isPercent: true },
        ],
      },
    ]

    if (eixoKeys.length > 0) {
      const firstSnap = filtered[0]
      const lastSnap  = filtered[filtered.length - 1]
      groups.push({
        title: 'Por Eixo',
        rows: eixoKeys.map(k => ({
          label:       `${eixoNameById.get(k) ?? k} — Grau de execução (%)`,
          ref:         firstSnap.by_n1[k]?.exec_media ?? 0,
          actual:      lastSnap.by_n1[k]?.exec_media  ?? 0,
          invertColor: false,
          isPercent:   true,
        })),
      })
    }

    return groups
  }, [filtered, programId, eixoKeys])

  // ── delta cards: first → last ─────────────────────────────────
  const firstKpi = filtered.length > 0 ? extractKpi(filtered[0], programId) : null
  const lastKpi  = filtered.length > 0 ? extractKpi(filtered[filtered.length - 1], programId) : null
  const dExec    = firstKpi && lastKpi ? lastKpi.exec_media  - firstKpi.exec_media  : null
  const dConclui = firstKpi && lastKpi ? lastKpi.concluidas  - firstKpi.concluidas  : null
  const dEmDia   = firstKpi && lastKpi ? lastKpi.em_dia      - firstKpi.em_dia      : null
  const dAtraso  = firstKpi && lastKpi ? lastKpi.em_atraso   - firstKpi.em_atraso   : null

  if (loading) return <div className="evol-empty">A carregar…</div>
  if (error)   return <div className="evol-empty evol-error">{error}</div>

  const hasEnough = filtered.length >= 2

  return (
    <div className="evol-page">

      {/* ── Controls bar ───────────────────────────────────────── */}
      <div className="evol-controls-bar">
        <span className="evol-ctrl-label">Programa</span>
        <select
          className="evol-select"
          value={programId}
          onChange={e => setProgramId(e.target.value)}
        >
          <option value="">Todos os programas</option>
          {programs.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="evol-ctrl-sep" />

        <span className="evol-ctrl-label">De</span>
        <input
          type="date"
          className="evol-date-input"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
        />
        <span className="evol-ctrl-label">Até</span>
        <input
          type="date"
          className="evol-date-input"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
        />

        <span className="evol-ctrl-info">
          {filtered.length} snapshot{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Delta KPI row ───────────────────────────────────────── */}
      {hasEnough && (
        <div className="evol-kpi-row">
          <KpiCard
            label="Execução média"
            value={lastKpi ? `${lastKpi.exec_media.toFixed(1)}%` : '—'}
            subtitle={dExec !== null ? `${delta(dExec)}pp vs. início do período` : ''}
            color={dExec !== null ? deltaColor(dExec, true) : 'text'}
          />
          <KpiCard
            label="Concluídas"
            value={lastKpi ? String(lastKpi.concluidas) : '—'}
            subtitle={dConclui !== null ? `${delta(dConclui)} actividades vs. início` : ''}
            color={dConclui !== null ? deltaColor(dConclui, true) : 'text'}
          />
          <KpiCard
            label="Em dia"
            value={lastKpi ? String(lastKpi.em_dia) : '—'}
            subtitle={dEmDia !== null ? `${delta(dEmDia)} actividades vs. início` : ''}
            color={dEmDia !== null ? deltaColor(dEmDia, true) : 'text'}
          />
          <KpiCard
            label="Em atraso"
            value={lastKpi ? String(lastKpi.em_atraso) : '—'}
            subtitle={dAtraso !== null ? `${delta(dAtraso)} actividades vs. início` : ''}
            color={dAtraso !== null ? deltaColor(dAtraso, false) : 'text'}
          />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!hasEnough && (
        <div className="evol-empty">
          {filtered.length === 0
            ? 'Sem dados históricos no período selecionado.'
            : 'São necessários pelo menos 2 snapshots para visualizar tendências.'}
          <br />
          <span className="evol-empty-sub">
            Os snapshots são guardados automaticamente todos os dias às 23:59.
          </span>
        </div>
      )}

      {/* ── Charts + comparison table ────────────────────────────── */}
      {hasEnough && (
        <>
          {/* Top two line charts */}
          <div className="evol-charts-row">

            {/* Chart 1 — Execução */}
            <Card title="Evolução da Execução">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="fullDate"
                    tickFormatter={(v) => fmtSnap(v as string)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v) => `${(v as number).toFixed(1)}%`}
                    labelFormatter={(label) => fmtSnapTooltip(label as string)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="exec"
                    name="Execução média"
                    stroke={NAVY}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="objetivo"
                    name="Objetivo"
                    stroke={GREEN}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Chart 2 — Concretização */}
            <Card title="Evolução da Concretização">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="fullDate"
                    tickFormatter={(v) => fmtSnap(v as string)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v) => `${(v as number).toFixed(1)}%`}
                    labelFormatter={(label) => fmtSnapTooltip(label as string)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="concr"
                    name="Concretização"
                    stroke={NAVY}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="aData"
                    name="À data"
                    stroke={BLUE}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="objetivo"
                    name="Objetivo"
                    stroke={GREEN}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Comparison table */}
          <Card title="Comparação de indicadores">
            <table className="evol-comp-table">
              <colgroup>
                <col style={{ width: '40%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th className="evol-comp-center">Valor Referência</th>
                  <th className="evol-comp-center">Valor Actual</th>
                  <th className="evol-comp-center">Variação</th>
                  <th className="evol-comp-center">Variação %</th>
                </tr>
              </thead>
              <tbody>
                {compGroups.map(group => (
                  <>
                    <tr key={`g-${group.title}`} className="evol-comp-group">
                      <td colSpan={5}>{group.title}</td>
                    </tr>
                    {group.rows.map(row => {
                      const variation = row.actual - row.ref
                      const { color, prefix } = varStyle(variation, row.invertColor)
                      return (
                        <tr key={`r-${group.title}-${row.label}`}>
                          <td>{row.label}</td>
                          <td className="evol-comp-center">{fmtVal(row.ref, row.isPercent)}</td>
                          <td className="evol-comp-center">{fmtVal(row.actual, row.isPercent)}</td>
                          <td className="evol-comp-var" style={{ color }}>
                            {prefix}{fmtVal(Math.abs(variation), row.isPercent)}
                          </td>
                          <td className="evol-comp-var" style={{ color }}>
                            {fmtVariationPct(variation, row.ref)}
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
