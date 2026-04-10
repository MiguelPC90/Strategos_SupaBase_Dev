import './Evolucao.css'
import { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Card from '../../components/Card/Card'
import KpiCard from '../../components/KpiCard/KpiCard'
import { useSnapshots } from '../../hooks/useSnapshots'
import { usePrograms } from '../../hooks/usePrograms'
import type { Snapshot, SnapshotKpi } from '../../types/index'

// ── Helpers ────────────────────────────────────────────────────
function defaultFrom(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtSnap(isoDate: string): string {
  const parts = isoDate.split('-')
  return `${parts[2]}/${parts[1]}`
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

// ── Colours ────────────────────────────────────────────────────
const NAVY  = '#002E5E'
const GREEN = '#95BB42'
const RED   = '#A32D2D'
const BLUE  = '#185FA5'
const PALETTE = [NAVY, GREEN, '#854F0B', BLUE, RED, '#7B4F9E', '#2196A7', '#B35C00']

// ── Component ──────────────────────────────────────────────────
export default function Evolucao() {
  const [programId,   setProgramId]   = useState('')
  const [dateFrom,    setDateFrom]    = useState(defaultFrom)
  const [dateTo,      setDateTo]      = useState(defaultTo)
  const [eixoMetric,  setEixoMetric]  = useState<'exec' | 'concr'>('exec')

  const { programs }                       = usePrograms()
  const { snapshots, loading, error }      = useSnapshots(programId || undefined)

  // ── filter by date range ──────────────────────────────────────
  const filtered = useMemo(
    () => snapshots.filter(s => s.snap_date >= dateFrom && s.snap_date <= dateTo),
    [snapshots, dateFrom, dateTo],
  )

  // ── main chart data (exec + concr + state counts) ─────────────
  const chartData = useMemo(
    () => filtered.map(s => {
      const kpi   = extractKpi(s, programId)
      const concr = kpi.total > 0 ? kpi.concluidas / kpi.total * 100 : 0
      const aData = kpi.total > 0 ? (kpi.concluidas + kpi.em_dia) / kpi.total * 100 : 0
      return {
        date:       fmtSnap(s.snap_date),
        exec:       +kpi.exec_media.toFixed(1),
        concr:      +concr.toFixed(1),
        aData:      +aData.toFixed(1),
        concluidas: kpi.concluidas,
        em_dia:     kpi.em_dia,
        em_atraso:  kpi.em_atraso,
        objetivo:   100,
      }
    }),
    [filtered, programId],
  )

  // ── unique eixo keys across all filtered snapshots ────────────
  const eixoKeys = useMemo(() => {
    const keys = new Set<string>()
    filtered.forEach(s => Object.keys(s.by_n1).forEach(k => keys.add(k)))
    return [...keys].sort()
  }, [filtered])

  // ── eixo chart data (one metric value per key per snapshot) ───
  const eixoData = useMemo(
    () => filtered.map(s => {
      const pt: Record<string, number | string> = { date: fmtSnap(s.snap_date) }
      for (const k of eixoKeys) {
        const kpi = s.by_n1[k]
        if (kpi) {
          pt[k] = eixoMetric === 'exec'
            ? +kpi.exec_media.toFixed(1)
            : kpi.total > 0 ? +(kpi.concluidas / kpi.total * 100).toFixed(1) : 0
        }
      }
      return pt
    }),
    [filtered, eixoKeys, eixoMetric],
  )

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

        <div className="evol-ctrl-sep" />

        <span className="evol-ctrl-label">Vista por eixo</span>
        <div className="evol-chips">
          <button
            className={`evol-chip${eixoMetric === 'exec' ? ' active' : ''}`}
            onClick={() => setEixoMetric('exec')}
          >Execução</button>
          <button
            className={`evol-chip${eixoMetric === 'concr' ? ' active' : ''}`}
            onClick={() => setEixoMetric('concr')}
          >Concretização</button>
        </div>

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

      {/* ── Charts ──────────────────────────────────────────────── */}
      {hasEnough && (
        <>
          <div className="evol-charts-row">

            {/* Chart 1 — Execução */}
            <Card title="Evolução da Execução">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => `${(v as number).toFixed(1)}%`} />
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
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => `${(v as number).toFixed(1)}%`} />
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

          <div className="evol-charts-row">

            {/* Chart 3 — Estado stacked area */}
            <Card title="Evolução do Estado">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="em_atraso"
                    name="Em atraso"
                    stackId="1"
                    stroke={RED}
                    fill={RED}
                    fillOpacity={0.75}
                  />
                  <Area
                    type="monotone"
                    dataKey="em_dia"
                    name="Em dia"
                    stackId="1"
                    stroke={NAVY}
                    fill={NAVY}
                    fillOpacity={0.75}
                  />
                  <Area
                    type="monotone"
                    dataKey="concluidas"
                    name="Concluídas"
                    stackId="1"
                    stroke={GREEN}
                    fill={GREEN}
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Chart 4 — Por Eixo */}
            <Card title="Evolução por Eixo">
              {eixoKeys.length === 0 ? (
                <p className="evol-empty-inner">Sem dados de eixo disponíveis.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={eixoData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => `${(v as number).toFixed(1)}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {eixoKeys.map((k, i) => (
                      <Line
                        key={k}
                        type="monotone"
                        dataKey={k}
                        name={k}
                        stroke={PALETTE[i % PALETTE.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
