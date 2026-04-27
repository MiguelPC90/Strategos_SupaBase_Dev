import './GestaoIniciativas.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useToast } from '../../context/ToastContext'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import { createPortal } from 'react-dom'
import Card from '../../components/Card/Card'
import Modal from '../../components/Modal/Modal'
import Badge from '../../components/Badge/Badge'
import DateRangePicker from '../../components/DateRangePicker/DateRangePicker'
import * as XLSX from 'xlsx'
import { useActivities } from '../../hooks/useActivities'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { usePeople } from '../../hooks/usePeople'
import { useEixos } from '../../hooks/useEixos'
import { usePlanos } from '../../hooks/usePlanos'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'
import { rollupPct, rollupPctPrev, rollupStatus, rollupDateRange, leafPctPrev, leafStatus } from '../../lib/rollup'
import type { Activity, Person, ActivityDependency, DependencyType, Plano } from '../../types/index'
import { useActivityDependencies } from '../../hooks/useActivityDependencies'
import { validateNewDependency, propagateDateChanges } from '../../lib/activityDependencies'
import { useCanEditCurrent } from '../../hooks/useCanEditCurrent'

// ── Types ──────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey'
type DirtyChange  = Partial<Pick<Activity, 'pct' | 'sort_order'>>

const STATUS_BADGE: Record<string, BadgeVariant> = {
  'Concluída': 'green', 'Em dia': 'blue', 'Em risco': 'amber', 'Em atraso': 'red', 'atrasada': 'red',
}

function statusBadge(s: string): BadgeVariant { return STATUS_BADGE[s] ?? 'grey' }
function statusLabel(s: string): string { return s === 'atrasada' ? 'Em atraso' : s }
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso
}

const TODAY = new Date().toISOString().slice(0, 10)

// ── computePctPrev ─────────────────────────────────────────────
function computePctPrev(bs: string, bf: string): number {
  if (!bs || !bf) return 0
  const start = new Date(bs).getTime()
  const end   = new Date(bf).getTime()
  const today = new Date(TODAY).getTime()
  if (end <= start) return 0
  return Math.min(100, Math.max(0, Math.round(((today - start) / (end - start)) * 100)))
}

// ── Collapsible ────────────────────────────────────────────────
function Collapsible({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="gi-collapsible">
      <button className="gi-collapsible-header" type="button" onClick={() => setOpen(o => !o)}>
        <span className="gi-section-title gi-collapsible-title">{title}</span>
        <span className="gi-collapsible-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="gi-collapsible-body">{children}</div>}
    </div>
  )
}

// ── Tree ───────────────────────────────────────────────────────
interface N5Leaf  { key: string; n5: string; acts: Activity[] }
interface N4Group { key: string; n4: string; n5s: N5Leaf[];  leafActs: Activity[]; all: Activity[] }
interface N3Group { key: string; n3: string; n4s: N4Group[]; leafActs: Activity[]; all: Activity[] }
interface N2Group { key: string; n2: string; n3s: N3Group[]; leafActs: Activity[]; all: Activity[] }
interface N1Group { key: string; n1: string; n2s: N2Group[]; all: Activity[] }

function buildTree(acts: Activity[]): N1Group[] {
  const n1Map = new Map<string, Activity[]>()
  for (const a of acts) {
    const k = a.n1 || '—'; if (!n1Map.has(k)) n1Map.set(k, []); n1Map.get(k)!.push(a)
  }
  const result: N1Group[] = []
  n1Map.forEach((n1Acts, n1) => {
    const n2Map = new Map<string, Activity[]>()
    for (const a of n1Acts) {
      const k = a.n2 || '—'; if (!n2Map.has(k)) n2Map.set(k, []); n2Map.get(k)!.push(a)
    }
    const n2s: N2Group[] = []
    n2Map.forEach((n2Acts, n2) => {
      const n3Map = new Map<string, Activity[]>(); const n2Leaves: Activity[] = []
      for (const a of n2Acts) {
        if (!a.n3) { n2Leaves.push(a); continue }
        if (!n3Map.has(a.n3)) n3Map.set(a.n3, []); n3Map.get(a.n3)!.push(a)
      }
      const n3s: N3Group[] = []
      n3Map.forEach((n3Acts, n3) => {
        const n4Map = new Map<string, Activity[]>(); const n3Leaves: Activity[] = []
        for (const a of n3Acts) {
          if (!a.n4) { n3Leaves.push(a); continue }
          if (!n4Map.has(a.n4)) n4Map.set(a.n4, []); n4Map.get(a.n4)!.push(a)
        }
        const n4s: N4Group[] = []
        n4Map.forEach((n4Acts, n4) => {
          const n5Map = new Map<string, Activity[]>(); const n4Leaves: Activity[] = []
          for (const a of n4Acts) {
            if (!a.n5) { n4Leaves.push(a); continue }
            if (!n5Map.has(a.n5)) n5Map.set(a.n5, []); n5Map.get(a.n5)!.push(a)
          }
          const n5s: N5Leaf[] = []
          n5Map.forEach((n5Acts, n5) => n5s.push({ key: `n5:${n1}:${n2}:${n3}:${n4}:${n5}`, n5, acts: n5Acts }))
          n4s.push({ key: `n4:${n1}:${n2}:${n3}:${n4}`, n4, n5s, leafActs: n4Leaves, all: n4Acts })
        })
        n3s.push({ key: `n3:${n1}:${n2}:${n3}`, n3, n4s, leafActs: n3Leaves, all: n3Acts })
      })
      n2s.push({ key: `n2:${n1}:${n2}`, n2, n3s, leafActs: n2Leaves, all: n2Acts })
    })
    result.push({ key: `n1:${n1}`, n1, n2s, all: n1Acts })
  })
  return result
}

// ── Panel form ─────────────────────────────────────────────────
interface PanelForm {
  id: string | null; name: string; level: string
  n0: string; n1: string; n2: string; n3: string; n4: string; n5: string
  bs: string; bf: string; rs: string; rf: string
  pct: string; owner: string; sponsor: string; notes: string
}

function toForm(a: Activity): PanelForm {
  return {
    id: a.id, name: a.name, level: String(a.level),
    n0: a.n0, n1: a.n1, n2: a.n2, n3: a.n3, n4: a.n4, n5: a.n5,
    bs: a.bs ?? '', bf: a.bf ?? '', rs: a.rs ?? '', rf: a.rf ?? '',
    pct: String(a.pct), owner: a.owner, sponsor: a.sponsor, notes: a.notes ?? '',
  }
}

function blankForm(n0: string, ctx?: Partial<PanelForm>): PanelForm {
  return {
    id: null, name: '', level: '3', n0,
    n1: '', n2: '', n3: '', n4: '', n5: '',
    bs: '', bf: '', rs: '', rf: '',
    pct: '0', owner: '', sponsor: '', notes: '',
    ...ctx,
  }
}

// ── Plano form ─────────────────────────────────────────────────
interface PlanoForm {
  name: string; code: string; eixo_id: string
  start_date: string | null; end_date: string | null
  owner: string; sponsor: string; objective: string
}

const BLANK_PLANO: PlanoForm = {
  name: '', code: '', eixo_id: '',
  start_date: null, end_date: null,
  owner: '', sponsor: '', objective: '',
}

// ── Excel import types ─────────────────────────────────────────
interface ParsedActivity {
  rowNum: number
  level: number
  name: string
  start_date: string | null
  end_date: string | null
  real_start: string | null
  real_end: string | null
  pct: number
  notes: string
  parentIndex: number | null
}

interface ParseError { row: number; message: string }

function parseDate(s: string): string | null {
  if (!s) return null
  const t = s.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return null
}

async function parseExcelFile(file: File): Promise<{ activities: ParsedActivity[]; errors: ParseError[] }> {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  if (rows.length < 2) return { activities: [], errors: [{ row: 1, message: 'Ficheiro vazio ou sem dados.' }] }

  const headers = (rows[0] as string[]).map(h => String(h).trim())
  const colIdx  = (n: string) => headers.findIndex(h => h.toLowerCase() === n.toLowerCase())

  const iNivel = colIdx('Nivel'); const iNome = colIdx('Nome')
  const iInicioP = colIdx('Inicio_Planeado'); const iFimP = colIdx('Fim_Planeado')
  const iInicioR = colIdx('Inicio_Real');    const iFimR  = colIdx('Fim_Real')
  const iPct = colIdx('Pct_Execucao');       const iNotas = colIdx('Notas')

  if (iNivel < 0 || iNome < 0 || iInicioP < 0 || iFimP < 0) {
    return { activities: [], errors: [{ row: 1, message: 'Colunas obrigatórias em falta (Nivel, Nome, Inicio_Planeado, Fim_Planeado). Use o template.' }] }
  }

  const activities: ParsedActivity[] = []
  const errors: ParseError[] = []
  const lastAtLevel: Record<number, number> = {}

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (row.every(c => !c || String(c).trim() === '')) continue
    const rowNum  = r + 1
    const level   = parseInt(String(row[iNivel] ?? '').trim(), 10)
    const name    = String(row[iNome] ?? '').trim()

    if (!level || level < 3 || level > 6) {
      errors.push({ row: rowNum, message: `Nível inválido: "${row[iNivel]}" (deve ser 3–6)` }); continue
    }
    if (!name) { errors.push({ row: rowNum, message: 'Nome em falta' }); continue }

    const start_date = parseDate(String(row[iInicioP] ?? ''))
    const end_date   = parseDate(String(row[iFimP] ?? ''))

    if (!start_date) { errors.push({ row: rowNum, message: 'Inicio_Planeado inválido (use dd/mm/yyyy)' }); continue }
    if (!end_date)   { errors.push({ row: rowNum, message: 'Fim_Planeado inválido (use dd/mm/yyyy)' });   continue }
    if (end_date < start_date) { errors.push({ row: rowNum, message: 'Fim_Planeado anterior ao Inicio_Planeado' }); continue }

    const real_start = iInicioR >= 0 ? parseDate(String(row[iInicioR] ?? '')) : null
    const real_end   = iFimR   >= 0 ? parseDate(String(row[iFimR]    ?? '')) : null
    const pct        = Math.max(0, Math.min(100, parseInt(String(iPct >= 0 ? (row[iPct] ?? '0') : '0').trim(), 10) || 0))
    const notes      = iNotas  >= 0 ? String(row[iNotas] ?? '').trim() : ''

    let parentIndex: number | null = null
    if (level > 3) {
      const pidx = lastAtLevel[level - 1]
      if (pidx === undefined) { errors.push({ row: rowNum, message: `N${level} sem N${level - 1} pai acima` }); continue }
      parentIndex = pidx
    }

    const act: ParsedActivity = { rowNum, level, name, start_date, end_date, real_start, real_end, pct, notes, parentIndex }
    const actIdx = activities.length
    activities.push(act)
    lastAtLevel[level] = actIdx
    for (const k of Object.keys(lastAtLevel).map(Number)) { if (k > level) delete lastAtLevel[k] }
  }

  return { activities, errors }
}

function buildN345(act: ParsedActivity, all: ParsedActivity[]): { n3: string; n4: string; n5: string } {
  const chain: ParsedActivity[] = [act]
  let pidx = act.parentIndex
  while (pidx !== null) { chain.unshift(all[pidx]); pidx = all[pidx].parentIndex }
  const byLevel = new Map<number, string>()
  for (const a of chain) byLevel.set(a.level, a.name)
  return { n3: byLevel.get(3) ?? '', n4: byLevel.get(4) ?? '', n5: byLevel.get(5) ?? '' }
}

function downloadTemplate() {
  const headers = ['Nivel', 'Nome', 'Inicio_Planeado', 'Fim_Planeado', 'Inicio_Real', 'Fim_Real', 'Pct_Execucao', 'Notas']
  const examples: (string | number)[][] = [
    [3, 'M1 - Análise',     '01/04/2026', '30/04/2026', '', '', 0, 'Fase de análise'],
    [4, 'A1 - Entrevistas', '01/04/2026', '15/04/2026', '', '', 0, ''],
    [5, 'S1 - Preparação',  '01/04/2026', '05/04/2026', '', '', 0, ''],
    [5, 'S2 - Execução',    '06/04/2026', '15/04/2026', '', '', 0, ''],
    [4, 'A2 - Documentação','16/04/2026', '30/04/2026', '', '', 0, ''],
    [3, 'M2 - Design',      '01/05/2026', '31/05/2026', '', '', 0, ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = [{ wch: 7 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Actividades')
  XLSX.writeFile(wb, 'template-actividades.xlsx')
}

// ── Panel component ────────────────────────────────────────────
interface DependencyEditorProps {
  predecessors: ActivityDependency[]
  loading: boolean
  leafActivities: Activity[]
  onAdd: (predecessorId: string, depType: DependencyType, lagDays: number) => Promise<string | null>
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<ActivityDependency, 'dep_type' | 'lag_days'>>) => void
}

interface PanelProps {
  form: PanelForm
  eixos: string[]
  planos: string[]
  activities: Activity[]
  internalPeople: Person[]
  errors: Record<string, string>
  onChange: (f: PanelForm) => void
  depProps?: DependencyEditorProps
}

function Panel({ form, eixos, planos, activities, internalPeople, errors, onChange, depProps }: PanelProps) {
  const set = (k: keyof PanelForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [k]: e.target.value })

  const level = Number(form.level) || 3

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLevel = Number(e.target.value)
    const updated: PanelForm = { ...form, level: e.target.value }
    if (newLevel <= 3)       { updated.n3 = ''; updated.n4 = ''; updated.n5 = '' }
    else if (newLevel === 4) { updated.n4 = ''; updated.n5 = '' }
    else if (newLevel === 5) { updated.n5 = '' }
    onChange(updated)
  }

  const handleN1Change = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...form, n1: e.target.value, n2: '', n3: '', n4: '', n5: '' })

  const handleN2Change = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...form, n2: e.target.value, n3: '', n4: '', n5: '' })

  const macros   = activities.filter(a => a.n2 === form.n2 && a.level === 3)
  const actsCand = activities.filter(a => a.n2 === form.n2 && a.level === 4 && a.n3 === form.n3)
  const tasks    = activities.filter(a =>
    a.n2 === form.n2 && a.level === 5 && a.n3 === form.n3 && a.n4 === form.n4
  )

  const pctPrev = computePctPrev(form.bs, form.bf)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── 1. Identificação ── */}
      <div className="gi-section">
        <div className="gi-section-title">Identificação</div>
        <div className="gi-field" style={{ marginTop: 10 }}>
          <span className={`gi-field-label${errors.name ? ' gi-label-error' : ''}`}>Nome *</span>
          <input
            className={`gi-field-input${errors.name ? ' gi-input-error' : ''}`}
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder="Designação da actividade"
          />
          {errors.name && <span className="gi-error">{errors.name}</span>}
        </div>
        <div className="gi-field" style={{ marginTop: 10 }}>
          <span className="gi-field-label">Nível</span>
          <select className="styled-select-sm" value={form.level} onChange={handleLevelChange}>
            <option value="3">Macroactividade</option>
            <option value="4">Actividade</option>
            <option value="5">Tarefa</option>
            <option value="6">Sub-tarefa</option>
          </select>
        </div>
      </div>

      {/* ── 2. Hierarquia ── */}
      <div className="gi-section">
        <div className="gi-section-title">Hierarquia</div>
        <div className="gi-field-row" style={{ marginTop: 10 }}>
          <div className="gi-field">
            <span className="gi-field-label">Eixo</span>
            <select className="styled-select-sm" value={form.n1} onChange={handleN1Change}>
              <option value="">— seleccionar —</option>
              {eixos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="gi-field">
            <span className="gi-field-label">Plano de Acção</span>
            <select className="styled-select-sm" value={form.n2} onChange={handleN2Change}>
              <option value="">— seleccionar —</option>
              {planos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        {level >= 4 && (
          <div className="gi-field" style={{ marginTop: 10 }}>
            <span className="gi-context-label">Macroactividade</span>
            <select
              className="styled-select-sm"
              value={form.n3}
              onChange={e => onChange({ ...form, n3: e.target.value, n4: '', n5: '' })}
            >
              <option value="">— seleccionar —</option>
              {macros.map(a => <option key={a.id} value={a.n3}>{a.name}</option>)}
            </select>
          </div>
        )}
        {level >= 5 && (
          <div className="gi-field" style={{ marginTop: 10 }}>
            <span className="gi-context-label">Actividade</span>
            <select
              className="styled-select-sm"
              value={form.n4}
              onChange={e => onChange({ ...form, n4: e.target.value, n5: '' })}
            >
              <option value="">— seleccionar —</option>
              {actsCand.map(a => <option key={a.id} value={a.n4}>{a.name}</option>)}
            </select>
          </div>
        )}
        {level >= 6 && (
          <div className="gi-field" style={{ marginTop: 10 }}>
            <span className="gi-context-label">Tarefa</span>
            <select
              className="styled-select-sm"
              value={form.n5}
              onChange={e => onChange({ ...form, n5: e.target.value })}
            >
              <option value="">— seleccionar —</option>
              {tasks.map(a => <option key={a.id} value={a.n5}>{a.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── 3. Datas ── */}
      <div className="gi-section">
        <div className="gi-section-title">Datas</div>
        <div style={{ marginTop: 10 }}>
          <DateRangePicker
            label="Baseline"
            startDate={form.bs || null}
            endDate={form.bf || null}
            onChange={(s, e) => onChange({ ...form, bs: s ?? '', bf: e ?? '' })}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <DateRangePicker
            label="Real"
            startDate={form.rs || null}
            endDate={form.rf || null}
            onChange={(s, e) => onChange({ ...form, rs: s ?? '', rf: e ?? '' })}
          />
        </div>
      </div>

      {/* ── 4. Progresso ── */}
      <div className="gi-section">
        <div className="gi-section-title">Progresso</div>
        <div className="gi-field" style={{ marginTop: 10 }}>
          <span className="gi-field-label">% Execução</span>
          <div className="gi-slider-row">
            <input
              className="gi-slider"
              type="range" min="0" max="100" step="1"
              value={form.pct}
              onChange={set('pct')}
            />
            <span className="gi-slider-val">{form.pct}%</span>
          </div>
        </div>
        <div className="gi-progress-row" style={{ marginTop: 8 }}>
          <span className="gi-field-label">% Previsto</span>
          <span className="gi-pct-prev-value gi-readonly">{pctPrev}%</span>
        </div>
      </div>

      {/* ── 5. Responsável e Sponsor (collapsible) ── */}
      <Collapsible title="Responsável e Sponsor">
        <div className="gi-field-row">
          <div className="gi-field">
            <span className="gi-field-label">Responsável</span>
            <select className="gi-field-input" value={form.owner} onChange={set('owner')}>
              <option value="">— seleccionar —</option>
              {internalPeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="gi-field">
            <span className="gi-field-label">Sponsor</span>
            <select className="gi-field-input" value={form.sponsor} onChange={set('sponsor')}>
              <option value="">— seleccionar —</option>
              {internalPeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </Collapsible>

      {/* ── 5.5 Dependências (collapsible, only for saved leaf activities) ── */}
      {form.id && level >= 4 && depProps && (
        <Collapsible title="Dependências">
          <DependenciesEditor
            activityId={form.id}
            predecessors={depProps.predecessors}
            loading={depProps.loading}
            leafActivities={depProps.leafActivities}
            onAdd={depProps.onAdd}
            onRemove={depProps.onRemove}
            onUpdate={depProps.onUpdate}
          />
        </Collapsible>
      )}

      {/* ── 6. Notas (collapsible) ── */}
      <Collapsible title="Notas">
        <div className="gi-field">
          <textarea
            className="gi-field-textarea"
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            placeholder="Observações opcionais…"
          />
        </div>
      </Collapsible>

    </div>
  )
}

// ── ⋯ Row menu ─────────────────────────────────────────────────
interface RowMenuProps {
  actId: string; openId: string | null
  canUp?: boolean; canDown?: boolean
  onOpen: (id: string | null) => void
  onEdit?: () => void; onDuplicate?: () => void
  onDelete?: () => void; onMoveUp?: () => void; onMoveDown?: () => void
}

const MENU_H = 220 // conservative estimate for flip threshold

function RowMenu({ actId, openId, canUp, canDown, onOpen, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown }: RowMenuProps) {
  const open   = openId === actId
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect()
      const right      = window.innerWidth - rect.right
      const spaceBelow = window.innerHeight - rect.bottom
      setPos(spaceBelow >= MENU_H
        ? { top: rect.bottom + 4, right }
        : { bottom: window.innerHeight - rect.top + 4, right }
      )
    }
    onOpen(open ? null : actId)
  }

  const menu = (
    <div
      className="gi-menu"
      style={{ position: 'fixed', zIndex: 300, ...(pos ?? {}) }}
      onClick={e => e.stopPropagation()}
    >
      {onEdit && <button className="gi-menu-item" onClick={() => { onOpen(null); onEdit() }}>Editar</button>}
      {onDuplicate && <button className="gi-menu-item" onClick={() => { onOpen(null); onDuplicate() }}>Duplicar</button>}
      {(onMoveUp || onMoveDown) && (
        <>
          <button className="gi-menu-item" onClick={() => { onOpen(null); onMoveUp?.() }} disabled={!canUp}>Mover para cima</button>
          <button className="gi-menu-item" onClick={() => { onOpen(null); onMoveDown?.() }} disabled={!canDown}>Mover para baixo</button>
        </>
      )}
      {onDelete && (
        <>
          <div className="gi-menu-sep" />
          <button className="gi-menu-item danger" onClick={() => { onOpen(null); onDelete() }}>Eliminar</button>
        </>
      )}
    </div>
  )

  return (
    <div className="gi-menu-wrap">
      <button ref={btnRef} className="gi-icon-btn" onClick={handleClick} title="Acções">⋯</button>
      {open && pos !== null && createPortal(menu, document.body)}
    </div>
  )
}

// ── Search helpers ─────────────────────────────────────────────
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="gi-search-highlight">{part}</mark>
      : part
  )
}

// ── DependenciesEditor ─────────────────────────────────────────
interface DepEditorProps {
  activityId: string
  predecessors: ActivityDependency[]
  loading: boolean
  leafActivities: Activity[]
  onAdd: (predecessorId: string, depType: DependencyType, lagDays: number) => Promise<string | null>
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<ActivityDependency, 'dep_type' | 'lag_days'>>) => void
}

function DependenciesEditor({
  activityId,
  predecessors,
  loading,
  leafActivities,
  onAdd,
  onRemove,
  onUpdate,
}: DepEditorProps) {
  const [addOpen, setAddOpen]   = useState(false)
  const [selPred, setSelPred]   = useState('')
  const [selType, setSelType]   = useState<DependencyType>('FS')
  const [lagDays, setLagDays]   = useState(0)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding]     = useState(false)

  const candidates = useMemo(
    () => leafActivities.filter(a => a.id !== activityId),
    [leafActivities, activityId]
  )

  const actById = useMemo(
    () => new Map(leafActivities.map(a => [a.id, a])),
    [leafActivities]
  )

  const handleAdd = async () => {
    if (!selPred) { setAddError('Selecciona uma actividade predecessora.'); return }
    setAdding(true)
    const err = await onAdd(selPred, selType, lagDays)
    setAdding(false)
    if (err) { setAddError(err); return }
    setSelPred(''); setSelType('FS'); setLagDays(0); setAddError(null); setAddOpen(false)
  }

  return (
    <div className="gi-deps">
      {loading && predecessors.length === 0 ? (
        <span className="gi-deps-loading">A carregar…</span>
      ) : !loading && predecessors.length === 0 && !addOpen ? (
        <span className="gi-deps-empty">Sem predecessores definidos.</span>
      ) : null}

      {predecessors.map(dep => {
        const pred = actById.get(dep.predecessor_id)
        return (
          <div key={dep.id} className="gi-dep-row">
            <span className="gi-dep-type-badge">{dep.dep_type}</span>
            <span className="gi-dep-name" title={pred?.name ?? dep.predecessor_id}>
              {pred?.name ?? dep.predecessor_id}
            </span>
            <select
              className="gi-dep-type-sel"
              value={dep.dep_type}
              onChange={e => onUpdate(dep.id, { dep_type: e.target.value as DependencyType })}
            >
              <option value="FS">FS</option>
              <option value="SS">SS</option>
              <option value="FF">FF</option>
              <option value="SF">SF</option>
            </select>
            <input
              type="number"
              className="gi-dep-lag-input"
              value={dep.lag_days}
              min={-999}
              max={999}
              title="Lag (dias)"
              onChange={e => onUpdate(dep.id, { lag_days: parseInt(e.target.value, 10) || 0 })}
            />
            <span className="gi-dep-lag-unit">d</span>
            <button type="button" className="gi-dep-remove" onClick={() => onRemove(dep.id)} title="Remover">×</button>
          </div>
        )
      })}

      {addOpen && (
        <div className="gi-dep-add-form">
          <select
            className="gi-field-input"
            value={selPred}
            onChange={e => { setSelPred(e.target.value); setAddError(null) }}
          >
            <option value="">— predecessora —</option>
            {candidates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="gi-dep-add-row">
            <select
              className="gi-dep-type-sel"
              value={selType}
              onChange={e => setSelType(e.target.value as DependencyType)}
            >
              <option value="FS">FS</option>
              <option value="SS">SS</option>
              <option value="FF">FF</option>
              <option value="SF">SF</option>
            </select>
            <input
              type="number"
              className="gi-dep-lag-input"
              value={lagDays}
              min={-999}
              max={999}
              placeholder="0"
              title="Lag (dias)"
              onChange={e => setLagDays(parseInt(e.target.value, 10) || 0)}
            />
            <span className="gi-dep-lag-unit">d</span>
            <button
              type="button"
              className="gi-btn gi-btn-primary"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={handleAdd}
              disabled={adding}
            >
              {adding ? '…' : 'Adicionar'}
            </button>
            <button
              type="button"
              className="gi-btn"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => { setAddOpen(false); setAddError(null) }}
            >
              Cancelar
            </button>
          </div>
          {addError && <span className="gi-error">{addError}</span>}
        </div>
      )}

      {!addOpen && (
        <button
          type="button"
          className="gi-btn"
          style={{ alignSelf: 'flex-start', marginTop: predecessors.length > 0 ? 6 : 0 }}
          onClick={() => setAddOpen(true)}
        >
          + Predecessora
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function GestaoIniciativas() {
  const { showToast } = useToast()
  const { filters } = useFilters()
  const [selProgId, setSelProgId] = useState<string | null>(null)
  const readOnly = !useCanEditCurrent('gestao-iniciativas')

  const programs = useAccessiblePrograms('gestao-iniciativas')
  const { activities: rawActivities, loading, refetch } = useActivities({})
  const { people } = usePeople()
  const { eixos: dbEixos } = useEixos(selProgId ?? undefined)
  const { planos: dbPlanos, refetch: refetchPlanos } = usePlanos(selProgId ?? undefined)

  const program         = useMemo(() => programs.find(p => p.id === selProgId), [programs, selProgId])
  const internalPeople  = useMemo(() =>
    people.filter(p => p.active !== false && (p.type ?? '').toLowerCase() === 'interno'),
    [people]
  )

  // Filter client-side: match by program_id (new data) or by n0 name (legacy data with null program_id)
  const activities = useMemo(() => {
    if (!selProgId || !program) return rawActivities
    return rawActivities.filter(a =>
      a.program_id === selProgId ||
      (!a.program_id && a.n0 === program.name)
    )
  }, [rawActivities, selProgId, program])

  // Eixo and plano names from DB tables (Panel dropdowns)
  const eixos = useMemo(() => dbEixos.map(e => e.name), [dbEixos])

  // Dirty changes: id → { pct?, sort_order? }
  const [dirty, setDirty] = useState<Map<string, DirtyChange>>(new Map())

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)

  const [panelForm, setPanelForm]   = useState<PanelForm | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({})

  const [planoModalOpen, setPlanoModalOpen] = useState(false)
  const [planoToEdit, setPlanoToEdit]       = useState<Plano | null>(null)
  const [planoForm, setPlanoForm]           = useState<PlanoForm>(BLANK_PLANO)
  const [planoErrors, setPlanoErrors]       = useState<Record<string, string>>({})
  const [planoSaving, setPlanoSaving]       = useState(false)
  const [planoStep, setPlanoStep]               = useState<1 | 2>(1)
  const [uploadedFile, setUploadedFile]         = useState<File | null>(null)
  const [parsedActivities, setParsedActivities] = useState<ParsedActivity[]>([])
  const [parseErrors, setParseErrors]           = useState<ParseError[]>([])
  const fileInputRef                            = useRef<HTMLInputElement>(null)

  const [batchSaving, setBatchSaving] = useState(false)
  const [delayThreshold, setDelayThreshold] = useState(20)

  useEffect(() => {
    supabase.from('app_config').select('data').eq('config_key', 'status_delay_threshold').single()
      .then(({ data }) => { if (data) setDelayThreshold(parseInt(data.data) || 20) })
  }, [])

  const [searchQuery, setSearchQuery] = useState('')

  const {
    dependencies,
    loading: depsLoading,
    createDependency,
    deleteDependency,
    updateDependency,
    getPredecessors,
  } = useActivityDependencies()

  const leafActivities = useMemo(
    () => activities.filter(a => a.level >= 4),
    [activities]
  )

  // Apply dirty overrides for display
  const localActs = useMemo(() =>
    activities.map(a => { const d = dirty.get(a.id); return d ? { ...a, ...d } : a }),
    [activities, dirty])

  const searchFilteredActs = useMemo(() => {
    if (!searchQuery.trim()) return localActs
    const q = searchQuery.toLowerCase().trim()
    return localActs.filter(a => a.name.toLowerCase().includes(q))
  }, [localActs, searchQuery])

  const tree = useMemo(() => buildTree(searchFilteredActs), [searchFilteredActs])

  // Planos filtered by selected eixo (n1) in panel
  const planos = useMemo(() => {
    const n1 = panelForm?.n1 ?? ''
    return dbPlanos
      .filter(p => !n1 || p.eixo?.name === n1)
      .map(p => p.name)
  }, [dbPlanos, panelForm?.n1])

  // Auto-expand all nodes while search is active
  useEffect(() => {
    if (searchQuery.trim()) setCollapsed(new Set())
  }, [searchQuery])

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return
    const handler = () => setMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuId])

  // Initialize selProgId from global filter or first available program
  useEffect(() => {
    if (programs.length === 0) return
    setSelProgId(prev => {
      if (prev && programs.some(p => p.id === prev)) return prev
      return filters.programIds[0] ?? programs[0].id
    })
  }, [programs, filters.programIds])

  // ── Collapse ─────────────────────────────────────────────────
  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    const keys = new Set<string>()
    for (const n1 of tree) {
      keys.add(n1.key)
      for (const n2 of n1.n2s) {
        keys.add(n2.key)
        for (const n3 of n2.n3s) {
          keys.add(n3.key)
          for (const n4 of n3.n4s) keys.add(n4.key)
        }
      }
    }
    setCollapsed(keys)
  }, [tree])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])

  // ── Inline pct ───────────────────────────────────────────────
  const handlePct = useCallback((id: string, raw: string) => {
    const val = Math.min(100, Math.max(0, Number(raw) || 0))
    setDirty(prev => new Map(prev).set(id, { ...(prev.get(id) ?? {}), pct: val }))
  }, [])

  // ── Batch save ───────────────────────────────────────────────
  const handleBatchSave = useCallback(async () => {
    if (dirty.size === 0) return
    setBatchSaving(true)
    const updates: Activity[] = []
    dirty.forEach((changes, id) => {
      const act = activities.find(a => a.id === id)
      if (act) updates.push({ ...act, ...changes })
    })
    const { error } = await supabase.from('activities').upsert(updates)
    setBatchSaving(false)
    if (!error) {
      setDirty(new Map())
      showToast('Guardado!')
      refetch()
    }
  }, [dirty, activities, refetch])

  // ── Panel ─────────────────────────────────────────────────────
  const openPanel = useCallback((a: Activity) => {
    setPanelForm(toForm(a)); setPanelErrors({})
  }, [])

  const openNew = useCallback(() => {
    const sel = selectedId ? activities.find(a => a.id === selectedId) : null
    if (sel) {
      const level = Math.min(sel.level + 1, 6)
      setPanelForm(blankForm(sel.n0, {
        level: String(level),
        n1: sel.n1, n2: sel.n2,
        // Inherit hierarchy context from the selected parent activity
        n3: sel.level >= 3 ? sel.n3 : '',
        n4: sel.level >= 4 ? sel.n4 : '',
        n5: sel.level >= 5 ? sel.n5 : '',
        owner: sel.owner, sponsor: sel.sponsor,
      }))
    } else {
      setPanelForm(blankForm(program?.name ?? ''))
    }
    setPanelErrors({})
  }, [selectedId, activities, program])

  const closePanel = useCallback(() => { setPanelForm(null); setPanelErrors({}) }, [])

  const handlePanelSave = useCallback(async () => {
    if (!panelForm) return
    const errs: Record<string, string> = {}
    if (!panelForm.name.trim()) errs.name = 'Nome obrigatório.'
    if (Object.keys(errs).length > 0) { setPanelErrors(errs); return }
    setPanelSaving(true); setPanelErrors({})
    const pct    = Math.min(100, Math.max(0, Number(panelForm.pct) || 0))
    const status = pct >= 100 ? 'Concluída' : 'Em dia'
    const level  = Number(panelForm.level) || 3
    const name   = panelForm.name.trim()
    // Derive n3/n4/n5: the activity's own name goes into the slot for its level;
    // higher-level slots hold the context (parent names) from the cascading selects.
    let n3 = '', n4 = '', n5 = ''
    if (level === 3)      { n3 = name }
    else if (level === 4) { n3 = panelForm.n3; n4 = name }
    else if (level === 5) { n3 = panelForm.n3; n4 = panelForm.n4; n5 = name }
    else                  { n3 = panelForm.n3; n4 = panelForm.n4; n5 = panelForm.n5 }
    const payload = {
      name, level,
      n0: panelForm.n0, n1: panelForm.n1, n2: panelForm.n2,
      n3, n4, n5,
      bs: panelForm.bs || null, bf: panelForm.bf || null,
      rs: panelForm.rs || null, rf: panelForm.rf || null,
      pct, status,
      owner: panelForm.owner, sponsor: panelForm.sponsor,
      notes: panelForm.notes || null, program_id: selProgId ?? null,
    }
    let errMsg = ''
    if (panelForm.id) {
      const { data: updatedRow, error } = await supabase
        .from('activities').update(payload).eq('id', panelForm.id).select().single()
      if (error) { errMsg = error.message }
      else if (updatedRow) {
        const dateChanges = propagateDateChanges(updatedRow as Activity, activities, dependencies)
        if (dateChanges.size > 0) {
          const batchResults = await Promise.all(
            Array.from(dateChanges.entries()).map(([id, dates]) =>
              supabase.from('activities').update({ bs: dates.bs, bf: dates.bf }).eq('id', id)
            )
          )
          const batchErr = batchResults.find(r => r.error)
          if (batchErr?.error) errMsg = batchErr.error.message
          else showToast(`Guardado! ${dateChanges.size} successor${dateChanges.size === 1 ? '' : 'es'} actualizados.`)
        } else {
          showToast('Guardado!')
        }
      }
    } else {
      const { error } = await supabase.from('activities').insert({
        ...payload, id0: panelForm.n0, id1: '', id2: '', pct_prev: 0,
        sort_order: activities.length,
      })
      if (error) errMsg = error.message
      else showToast('Guardado!')
    }
    setPanelSaving(false)
    if (errMsg) { setPanelErrors({ _: errMsg }); return }
    setPanelForm(null); refetch()
  }, [panelForm, selProgId, activities, dependencies, showToast, refetch])

  const handlePanelDelete = useCallback(async () => {
    const id = panelForm?.id
    if (!id) return
    if (!confirm(`Eliminar "${panelForm?.name}"? Esta acção não pode ser desfeita.`)) return
    setPanelSaving(true)
    const { error } = await supabase.from('activities').delete().eq('id', id)
    setPanelSaving(false)
    if (error) { setPanelErrors({ _: error.message }); return }
    setDirty(prev => { const next = new Map(prev); next.delete(id); return next })
    setPanelForm(null); refetch()
  }, [panelForm, refetch])

  // ── Duplicate ─────────────────────────────────────────────────
  const handleDuplicate = useCallback((a: Activity) => {
    setPanelForm({ ...toForm(a), id: null, name: a.name + ' (cópia)', pct: '0', rs: '', rf: '' })
    setPanelErrors({})
  }, [])

  // ── Dependency handlers ───────────────────────────────────────
  const handleAddDependency = useCallback(async (
    successorId: string,
    predecessorId: string,
    depType: DependencyType,
    lagDays: number,
  ): Promise<string | null> => {
    const predecessor = activities.find(a => a.id === predecessorId)
    const successor   = activities.find(a => a.id === successorId)
    if (!predecessor || !successor) return 'Actividade não encontrada.'
    const validErr = validateNewDependency(predecessor, successor, depType, lagDays, dependencies)
    if (validErr) return validErr.message
    const result = await createDependency({
      successor_id: successorId, predecessor_id: predecessorId,
      dep_type: depType, lag_days: lagDays,
    })
    if ('error' in result) return result.error.message
    return null
  }, [activities, dependencies, createDependency])

  const handleRemoveDependency = useCallback((id: string) => {
    void deleteDependency(id)
  }, [deleteDependency])

  const handleUpdateDependency = useCallback((
    id: string,
    patch: Partial<Pick<ActivityDependency, 'dep_type' | 'lag_days'>>,
  ) => {
    void updateDependency(id, patch)
  }, [updateDependency])

  const panelDepProps = useMemo<DependencyEditorProps | undefined>(() => {
    const pid   = panelForm?.id
    const level = Number(panelForm?.level) || 3
    if (!pid || level < 4) return undefined
    return {
      predecessors: getPredecessors(pid),
      loading: depsLoading,
      leafActivities,
      onAdd: (predecessorId, depType, lagDays) =>
        handleAddDependency(pid, predecessorId, depType, lagDays),
      onRemove: handleRemoveDependency,
      onUpdate: handleUpdateDependency,
    }
  }, [
    panelForm?.id, panelForm?.level,
    getPredecessors, depsLoading, leafActivities,
    handleAddDependency, handleRemoveDependency, handleUpdateDependency,
  ])

  // ── Plano modal handlers ──────────────────────────────────────
  const handleOpenPlano = useCallback(() => {
    setPlanoToEdit(null)
    setPlanoForm(BLANK_PLANO); setPlanoErrors({})
    setPlanoStep(1); setUploadedFile(null); setParsedActivities([]); setParseErrors([])
    setPlanoModalOpen(true)
  }, [])

  const handleClosePlano = useCallback(() => {
    setPlanoModalOpen(false); setPlanoToEdit(null); setPlanoStep(1)
    setPlanoForm(BLANK_PLANO); setPlanoErrors({})
    setUploadedFile(null); setParsedActivities([]); setParseErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleEditPlano = useCallback((plano: Plano) => {
    setPlanoToEdit(plano)
    setPlanoForm({
      name:       plano.name,
      code:       plano.code,
      eixo_id:    plano.eixo_id,
      start_date: plano.start_date,
      end_date:   plano.end_date,
      owner:      plano.owner ?? '',
      sponsor:    plano.sponsor ?? '',
      objective:  plano.objective ?? '',
    })
    setPlanoErrors({})
    setPlanoModalOpen(true)
  }, [])

  const handleDuplicatePlano = useCallback(async (plano: Plano) => {
    const { data, error } = await supabase
      .from('planos')
      .insert({
        eixo_id:    plano.eixo_id,
        program_id: plano.program_id,
        code:       plano.code + '-C',
        name:       plano.name + ' (cópia)',
        owner:      plano.owner,
        sponsor:    plano.sponsor,
        start_date: plano.start_date,
        end_date:   plano.end_date,
        objective:  plano.objective,
        sort_order: plano.sort_order + 1,
      })
      .select('*, eixo:eixos(name, code)')
      .single()
    if (error) { showToast('Erro ao duplicar: ' + error.message, 'error'); return }
    showToast('Plano duplicado.', 'success')
    refetchPlanos()
    handleEditPlano(data as unknown as Plano)
  }, [showToast, refetchPlanos, handleEditPlano])

  const handleSavePlanoEdit = useCallback(async () => {
    if (!planoToEdit) return
    const errs: Record<string, string> = {}
    if (!planoForm.name.trim())                          errs.name  = 'Nome obrigatório.'
    if (!planoForm.code.trim())                          errs.code  = 'Código obrigatório.'
    if (!planoForm.start_date || !planoForm.end_date)    errs.dates = 'Período previsto obrigatório.'
    if (Object.keys(errs).length) { setPlanoErrors(errs); return }
    setPlanoSaving(true); setPlanoErrors({})
    const { error } = await supabase
      .from('planos')
      .update({
        name:       planoForm.name.trim(),
        code:       planoForm.code.trim().toUpperCase(),
        owner:      planoForm.owner    || null,
        sponsor:    planoForm.sponsor  || null,
        start_date: planoForm.start_date,
        end_date:   planoForm.end_date,
        objective:  planoForm.objective || null,
      })
      .eq('id', planoToEdit.id)
    setPlanoSaving(false)
    if (error) { setPlanoErrors({ _: error.message }); return }
    showToast('Plano guardado.', 'success')
    handleClosePlano()
    refetchPlanos()
  }, [planoToEdit, planoForm, showToast, handleClosePlano, refetchPlanos])

  const clearFile = useCallback(() => {
    setUploadedFile(null); setParsedActivities([]); setParseErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const goToStep2 = useCallback(() => {
    const errs: Record<string, string> = {}
    if (!planoForm.name.trim())   errs.name    = 'Nome obrigatório.'
    if (!planoForm.code.trim())   errs.code    = 'Código obrigatório.'
    if (!planoForm.eixo_id)       errs.eixo_id = 'Eixo obrigatório.'
    if (!planoForm.start_date || !planoForm.end_date) errs.dates = 'Período previsto obrigatório.'
    if (Object.keys(errs).length) { setPlanoErrors(errs); return }
    setPlanoStep(2)
  }, [planoForm])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    const { activities: parsed, errors: errs } = await parseExcelFile(file)
    setParsedActivities(parsed); setParseErrors(errs)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    setUploadedFile(file)
    const { activities: parsed, errors: errs } = await parseExcelFile(file)
    setParsedActivities(parsed); setParseErrors(errs)
  }, [])

  const handleSavePlanoWithActivities = useCallback(async () => {
    if (parseErrors.length > 0) return
    setPlanoSaving(true); setPlanoErrors({})

    const { data: maxResult } = await supabase
      .from('planos').select('sort_order')
      .eq('eixo_id', planoForm.eixo_id)
      .order('sort_order', { ascending: false }).limit(1)

    const nextSort = ((maxResult as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1

    const planoPayload = {
      name:       planoForm.name.trim(),
      code:       planoForm.code.trim().toUpperCase(),
      eixo_id:    planoForm.eixo_id,
      program_id: selProgId ?? null,
      start_date: planoForm.start_date,
      end_date:   planoForm.end_date,
      owner:      planoForm.owner    || null,
      sponsor:    planoForm.sponsor  || null,
      objective:  planoForm.objective || null,
      sort_order: nextSort,
    }

    const { data: newPlano, error: planoErr } = await supabase
      .from('planos').insert(planoPayload).select().single()

    if (planoErr) { setPlanoSaving(false); setPlanoErrors({ _: planoErr.message }); return }

    if (parsedActivities.length > 0) {
      const eixoName    = dbEixos.find(e => e.id === planoForm.eixo_id)?.name ?? ''
      const programName = program?.name ?? ''
      const planoName   = (newPlano as { name: string }).name

      const actPayloads = parsedActivities.map((a, i) => {
        const { n3, n4, n5 } = buildN345(a, parsedActivities)
        return {
          program_id: selProgId ?? null, level: a.level, name: a.name,
          n0: programName, n1: eixoName, n2: planoName, n3, n4, n5,
          id0: programName, id1: '', id2: '',
          bs: a.start_date, bf: a.end_date,
          rs: a.real_start || null, rf: a.real_end || null,
          pct: a.pct, pct_prev: 0,
          status: a.pct >= 100 ? 'Concluída' : 'Em dia',
          owner: '', sponsor: '', notes: a.notes || null,
          sort_order: activities.length + i,
        }
      })

      const { error: actErr } = await supabase.from('activities').insert(actPayloads)
      if (actErr) {
        setPlanoSaving(false)
        setPlanoErrors({ _: `Plano criado mas erro ao importar actividades: ${actErr.message}` })
        return
      }
      refetch()
    }

    setPlanoSaving(false)
    showToast(parsedActivities.length > 0
      ? `Plano "${planoPayload.name}" criado com ${parsedActivities.length} actividade(s).`
      : `Plano "${planoPayload.name}" criado.`
    )
    setPlanoModalOpen(false); setPlanoStep(1)
    setPlanoForm(BLANK_PLANO); setPlanoErrors({})
    setUploadedFile(null); setParsedActivities([]); setParseErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    refetchPlanos()
  }, [planoForm, selProgId, parsedActivities, parseErrors, dbEixos, program, activities.length, showToast, refetchPlanos, refetch])

  // ── Row delete ────────────────────────────────────────────────
  const handleRowDelete = useCallback(async (a: Activity) => {
    if (!confirm(`Eliminar "${a.name}"? Esta acção não pode ser desfeita.`)) return
    const { error } = await supabase.from('activities').delete().eq('id', a.id)
    if (error) { alert(`Erro ao eliminar: ${error.message}`); return }
    setDirty(prev => { const next = new Map(prev); next.delete(a.id); return next })
    if (selectedId === a.id) setSelectedId(null)
    refetch()
  }, [selectedId, refetch])

  // ── Move up/down ──────────────────────────────────────────────
  const handleMove = useCallback((a: Activity, siblings: Activity[], dir: 'up' | 'down') => {
    const sorted = [...siblings].sort((x, y) => x.sort_order - y.sort_order)
    const idx = sorted.findIndex(s => s.id === a.id)
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const other = sorted[targetIdx]
    setDirty(prev => {
      const next = new Map(prev)
      next.set(a.id,     { ...(next.get(a.id)     ?? {}), sort_order: other.sort_order })
      next.set(other.id, { ...(next.get(other.id) ?? {}), sort_order: a.sort_order })
      return next
    })
  }, [])

  // ── Build leaf rows ───────────────────────────────────────────
  function leafRows(acts: Activity[], indent: number, level: string): React.ReactNode[] {
    const sorted = [...acts].sort((a, b) => a.sort_order - b.sort_order)
    return sorted.map((a, idx) => {
      const aEnd   = a.rf ?? a.bf ?? a.finish
      const pctVal = dirty.get(a.id)?.pct ?? a.pct
      const aPrev    = leafPctPrev(a, TODAY)
      const aStatus  = leafStatus(a, TODAY)
      const isSelected = selectedId === a.id
      return (
        <tr
          key={a.id}
          className={`gi-row-${level} gi-row-leaf${isSelected ? ' selected' : ''}`}
          onClick={() => setSelectedId(isSelected ? null : a.id)}
          onDoubleClick={() => openPanel(a)}
        >
          <td>
            <div className="gi-name-cell" style={{ paddingLeft: indent }}>
              <span className="gi-name-text" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
            </div>
          </td>
          <td className="gi-td-c" style={{ fontSize: 12, color: 'var(--text2)' }}>{a.owner || '—'}</td>
          <td className="gi-td-c">{fmtDate(aEnd ?? null)}</td>
          <td className="gi-td-c">
            <div className="gi-pct-wrap">
              <input
                className="gi-pct-input" type="number" min={0} max={100} value={pctVal}
                onClick={e => e.stopPropagation()}
                onChange={e => handlePct(a.id, e.target.value)}
              />
              <span className="gi-pct-unit">%</span>
            </div>
          </td>
          <td className="gi-td-r" style={{ fontSize: 12 }}>{Math.round(aPrev)}%</td>
          <td className="gi-td-c">
            <Badge variant={statusBadge(aStatus)}>{statusLabel(aStatus)}</Badge>
          </td>
          <td onClick={e => e.stopPropagation()}>
            {!readOnly && (
              <RowMenu
                actId={a.id} openId={menuId} canUp={idx > 0} canDown={idx < sorted.length - 1}
                onOpen={setMenuId}
                onEdit={() => openPanel(a)}
                onDuplicate={() => handleDuplicate(a)}
                onDelete={() => handleRowDelete(a)}
                onMoveUp={() => handleMove(a, acts, 'up')}
                onMoveDown={() => handleMove(a, acts, 'down')}
              />
            )}
          </td>
        </tr>
      )
    })
  }

  // ── Build table rows ─────────────────────────────────────────
  const rows: React.ReactNode[] = []

  for (const n1g of tree) {
    const n1col = collapsed.has(n1g.key)
    const n1leaves = n1g.all.filter(a => a.level === 4)
    const n1pct = rollupPct(n1leaves); const n1prev = rollupPctPrev(n1leaves, TODAY)
    const n1st  = rollupStatus(n1leaves, TODAY, delayThreshold); const n1dr = rollupDateRange(n1leaves)
    rows.push(
      <tr key={n1g.key} className="gi-row-n1">
        <td>
          <div className="gi-name-cell" style={{ paddingLeft: 4 }}>
            <button className="gi-toggle" onClick={() => toggle(n1g.key)}>{n1col ? '▶' : '▼'}</button>
            <span className="gi-name-text">{n1g.n1}</span>
          </div>
        </td>
        <td className="gi-td-c" /><td className="gi-td-c">{fmtDate(n1dr.bf)}</td>
        <td className="gi-td-r">{Math.round(n1pct)}%</td><td className="gi-td-r">{Math.round(n1prev)}%</td>
        <td className="gi-td-c"><Badge variant={statusBadge(n1st)}>{n1st}</Badge></td><td />
      </tr>
    )
    if (n1col) continue

    for (const n2g of n1g.n2s) {
      const n2col = collapsed.has(n2g.key)
      const n2leaves = n2g.all.filter(a => a.level === 4)
      const n2pct = rollupPct(n2leaves); const n2prev = rollupPctPrev(n2leaves, TODAY)
      const n2st  = rollupStatus(n2leaves, TODAY, delayThreshold); const n2dr = rollupDateRange(n2leaves)
      const n2Plano = dbPlanos.find(p => p.name === n2g.n2)
      const n2Owner = n2Plano?.owner || '—'
      rows.push(
        <tr key={n2g.key} className="gi-row-n2">
          <td>
            <div className="gi-name-cell" style={{ paddingLeft: 20 }}>
              <button className="gi-toggle" onClick={() => toggle(n2g.key)}>{n2col ? '▶' : '▼'}</button>
              <span className="gi-name-text">{n2g.n2}</span>
            </div>
          </td>
          <td className="gi-td-c" style={{ fontSize: 12 }}>{n2Owner}</td>
          <td className="gi-td-c">{fmtDate(n2dr.bf)}</td>
          <td className="gi-td-r">{Math.round(n2pct)}%</td><td className="gi-td-r">{Math.round(n2prev)}%</td>
          <td className="gi-td-c"><Badge variant={statusBadge(n2st)}>{n2st}</Badge></td>
          <td onClick={e => e.stopPropagation()}>
            {!readOnly && n2Plano && (
              <RowMenu
                actId={n2Plano.id} openId={menuId}
                onOpen={setMenuId}
                onEdit={() => handleEditPlano(n2Plano)}
                onDuplicate={() => handleDuplicatePlano(n2Plano)}
              />
            )}
          </td>
        </tr>
      )
      if (n2col) continue

      rows.push(...leafRows(n2g.leafActs.filter(a => a.level !== 2), 36, 'n3'))

      for (const n3g of n2g.n3s) {
        // True children = n4 groups + any leafActs that are NOT the level-3 representative itself
        const n3ChildLeaves = n3g.leafActs.filter(a => a.level !== 3)
        const n3HasChildren = n3g.n4s.length > 0 || n3ChildLeaves.length > 0
        if (!n3HasChildren) {
          // Leaf-only: the Macroactividade has no children — render as single leaf row
          rows.push(...leafRows(n3g.leafActs, 36, 'n3'))
          continue
        }
        const n3col = collapsed.has(n3g.key)
        const n3leaves = n3g.all.filter(a => a.level === 4)
        const n3pct = rollupPct(n3leaves); const n3prev = rollupPctPrev(n3leaves, TODAY)
        const n3st  = rollupStatus(n3leaves, TODAY, delayThreshold); const n3dr = rollupDateRange(n3leaves)
        const n3Rep  = n3g.all.find(a => a.level === 3)
        const n3Sibs = n3Rep
          ? localActs.filter(a => a.level === 3 && a.n1 === n3Rep.n1 && a.n2 === n3Rep.n2)
              .sort((a, b) => a.sort_order - b.sort_order)
          : []
        const n3RepIdx = n3Rep ? n3Sibs.findIndex(s => s.id === n3Rep.id) : -1
        rows.push(
          <tr
            key={n3g.key}
            className={`gi-row-n3${n3Rep ? ' gi-row-editable' : ''}`}
            onClick={n3Rep ? () => openPanel(n3Rep) : undefined}
          >
            <td>
              <div className="gi-name-cell" style={{ paddingLeft: 36 }}>
                <button
                  className="gi-toggle"
                  onClick={e => { e.stopPropagation(); toggle(n3g.key) }}
                >{n3col ? '▶' : '▼'}</button>
                <span className="gi-name-text">{n3g.n3}</span>
              </div>
            </td>
            <td className="gi-td-c" /><td className="gi-td-c">{fmtDate(n3dr.bf)}</td>
            <td className="gi-td-r">{Math.round(n3pct)}%</td><td className="gi-td-r">{Math.round(n3prev)}%</td>
            <td className="gi-td-c"><Badge variant={statusBadge(n3st)}>{n3st}</Badge></td>
            <td onClick={e => e.stopPropagation()}>
              {!readOnly && n3Rep && (
                <RowMenu
                  actId={n3Rep.id} openId={menuId}
                  canUp={n3RepIdx > 0} canDown={n3RepIdx < n3Sibs.length - 1}
                  onOpen={setMenuId}
                  onEdit={() => openPanel(n3Rep)}
                  onDuplicate={() => handleDuplicate(n3Rep)}
                  onDelete={() => handleRowDelete(n3Rep)}
                  onMoveUp={() => handleMove(n3Rep, n3Sibs, 'up')}
                  onMoveDown={() => handleMove(n3Rep, n3Sibs, 'down')}
                />
              )}
            </td>
          </tr>
        )
        if (n3col) continue

        rows.push(...leafRows(n3ChildLeaves, 52, 'n4'))

        for (const n4g of n3g.n4s) {
          const n4ChildLeaves = n4g.leafActs.filter(a => a.level !== 4)
          const n4HasChildren = n4g.n5s.length > 0 || n4ChildLeaves.length > 0
          if (!n4HasChildren) {
            rows.push(...leafRows(n4g.leafActs, 52, 'n4'))
            continue
          }
          const n4col = collapsed.has(n4g.key)
          const n4leaves = n4g.all.filter(a => a.level === 4)
          const n4pct = rollupPct(n4leaves); const n4prev = rollupPctPrev(n4leaves, TODAY)
          const n4st  = rollupStatus(n4leaves, TODAY, delayThreshold); const n4dr = rollupDateRange(n4leaves)
          const n4Rep  = n4g.all.find(a => a.level === 4)
          const n4Sibs = n4Rep
            ? localActs.filter(a => a.level === 4 && a.n1 === n4Rep.n1 && a.n2 === n4Rep.n2 && a.n3 === n4Rep.n3)
                .sort((a, b) => a.sort_order - b.sort_order)
            : []
          const n4RepIdx = n4Rep ? n4Sibs.findIndex(s => s.id === n4Rep.id) : -1
          rows.push(
            <tr
              key={n4g.key}
              className={`gi-row-n4${n4Rep ? ' gi-row-editable' : ''}`}
              onClick={n4Rep ? () => openPanel(n4Rep) : undefined}
            >
              <td>
                <div className="gi-name-cell" style={{ paddingLeft: 52 }}>
                  <button
                    className="gi-toggle"
                    onClick={e => { e.stopPropagation(); toggle(n4g.key) }}
                  >{n4col ? '▶' : '▼'}</button>
                  <span className="gi-name-text">{n4g.n4}</span>
                </div>
              </td>
              <td className="gi-td-c" /><td className="gi-td-c">{fmtDate(n4dr.bf)}</td>
              <td className="gi-td-r">{Math.round(n4pct)}%</td><td className="gi-td-r">{Math.round(n4prev)}%</td>
              <td className="gi-td-c"><Badge variant={statusBadge(n4st)}>{n4st}</Badge></td>
              <td onClick={e => e.stopPropagation()}>
                {!readOnly && n4Rep && (
                  <RowMenu
                    actId={n4Rep.id} openId={menuId}
                    canUp={n4RepIdx > 0} canDown={n4RepIdx < n4Sibs.length - 1}
                    onOpen={setMenuId}
                    onEdit={() => openPanel(n4Rep)}
                    onDuplicate={() => handleDuplicate(n4Rep)}
                    onDelete={() => handleRowDelete(n4Rep)}
                    onMoveUp={() => handleMove(n4Rep, n4Sibs, 'up')}
                    onMoveDown={() => handleMove(n4Rep, n4Sibs, 'down')}
                  />
                )}
              </td>
            </tr>
          )
          if (n4col) continue

          rows.push(...leafRows(n4ChildLeaves, 68, 'n5'))

          for (const n5g of n4g.n5s) {
            const n5Leaves = n5g.acts.filter(a => a.level !== 5)
            if (n5Leaves.length === 0) {
              // Tarefa with no sub-tasks: single leaf row
              rows.push(...leafRows(n5g.acts, 68, 'n5'))
            } else {
              const n5Rep  = n5g.acts.find(a => a.level === 5)
              const n5Sibs = n5Rep
                ? localActs.filter(a => a.level === 5 && a.n1 === n5Rep.n1 && a.n2 === n5Rep.n2 && a.n3 === n5Rep.n3 && a.n4 === n5Rep.n4)
                    .sort((a, b) => a.sort_order - b.sort_order)
                : []
              const n5RepIdx = n5Rep ? n5Sibs.findIndex(s => s.id === n5Rep.id) : -1
              rows.push(
                <tr
                  key={n5g.key}
                  className={`gi-row-n5${n5Rep ? ' gi-row-editable' : ''}`}
                  onClick={n5Rep ? () => openPanel(n5Rep) : undefined}
                >
                  <td>
                    <div className="gi-name-cell" style={{ paddingLeft: 68 }}>
                      <span className="gi-name-text">{n5g.n5}</span>
                    </div>
                  </td>
                  <td /><td /><td /><td />
                  <td />
                  <td onClick={e => e.stopPropagation()}>
                    {!readOnly && n5Rep && (
                      <RowMenu
                        actId={n5Rep.id} openId={menuId}
                        canUp={n5RepIdx > 0} canDown={n5RepIdx < n5Sibs.length - 1}
                        onOpen={setMenuId}
                        onEdit={() => openPanel(n5Rep)}
                        onDuplicate={() => handleDuplicate(n5Rep)}
                        onDelete={() => handleRowDelete(n5Rep)}
                        onMoveUp={() => handleMove(n5Rep, n5Sibs, 'up')}
                        onMoveDown={() => handleMove(n5Rep, n5Sibs, 'down')}
                      />
                    )}
                  </td>
                </tr>
              )
              rows.push(...leafRows(n5Leaves, 84, 'n5'))
            }
          }
        }
      }
    }
  }

  // ── Orphan planos (created without activities, not in tree) ───
  {
    const renderedN2s = new Set(
      tree.flatMap(n1g => n1g.n2s.map(n2g => `${n1g.n1}|||${n2g.n2}`))
    )
    const renderedN1s = new Set(tree.map(n1g => n1g.n1))

    for (const eixo of dbEixos) {
      const eixoPlanos = dbPlanos.filter(p => p.eixo?.name === eixo.name)
      const orphanPlanos = eixoPlanos.filter(p => !renderedN2s.has(`${eixo.name}|||${p.name}`))
      if (orphanPlanos.length === 0) continue

      const n1key = `n1:${eixo.name}`
      const n1col = collapsed.has(n1key)

      if (!renderedN1s.has(eixo.name)) {
        rows.push(
          <tr key={`orphan-eixo:${eixo.id}`} className="gi-row-n1">
            <td>
              <div className="gi-name-cell" style={{ paddingLeft: 4 }}>
                <button className="gi-toggle" onClick={() => toggle(n1key)}>{n1col ? '▶' : '▼'}</button>
                <span className="gi-name-text">{eixo.name}</span>
              </div>
            </td>
            <td className="gi-td-c" /><td className="gi-td-c">—</td>
            <td className="gi-td-r">—</td><td className="gi-td-r">—</td>
            <td className="gi-td-c" /><td />
          </tr>
        )
      }

      if (n1col) continue

      for (const plano of orphanPlanos) {
        const n2key = `n2:${eixo.name}:${plano.name}`
        rows.push(
          <tr key={`orphan-plano:${plano.id}`} className="gi-row-n2">
            <td>
              <div className="gi-name-cell" style={{ paddingLeft: 20 }}>
                <button className="gi-toggle" onClick={() => toggle(n2key)}>▼</button>
                <span className="gi-name-text">{plano.name}</span>
              </div>
            </td>
            <td className="gi-td-c" style={{ fontSize: 12 }}>{plano.owner || '—'}</td>
            <td className="gi-td-c">{fmtDate(plano.end_date)}</td>
            <td className="gi-td-r">—</td><td className="gi-td-r">—</td>
            <td className="gi-td-c" />
            <td onClick={e => e.stopPropagation()}>
              {!readOnly && (
                <RowMenu
                  actId={plano.id} openId={menuId}
                  onOpen={setMenuId}
                  onEdit={() => handleEditPlano(plano)}
                  onDuplicate={() => handleDuplicatePlano(plano)}
                />
              )}
            </td>
          </tr>
        )
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="gi-page">
      <div className="gi-controls-bar">
        {programs.length > 1 && (
          <>
            <label className="gi-prog-label">Programa</label>
            <select
              className="styled-select"
              value={selProgId ?? ''}
              onChange={e => setSelProgId(e.target.value || null)}
            >
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="gi-sep" />
          </>
        )}
        <div className="gi-search">
          <svg className="gi-search-icon" width="14" height="14" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="gi-search-input"
            placeholder="Pesquisar actividades..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="gi-search-clear"
              onClick={() => setSearchQuery('')}
              title="Limpar pesquisa"
            >×</button>
          )}
        </div>
        {!readOnly && (
          <>
            <button className="gi-btn gi-btn-secondary" onClick={handleOpenPlano} disabled={!selProgId}
              title={!selProgId ? 'Selecciona um programa primeiro' : undefined}>
              Novo Plano
            </button>
            <button className="gi-btn gi-btn-primary" onClick={openNew} disabled={!selProgId}
              title={!selProgId ? 'Selecciona um programa primeiro' : undefined}>
              Nova Actividade
            </button>
          </>
        )}
        <div className="gi-sep" />
        <button className="gi-btn" onClick={collapseAll}>Colapsar tudo</button>
        <button className="gi-btn" onClick={expandAll}>Expandir tudo</button>
        <div className="gi-spacer" />
        {!readOnly && dirty.size > 0 && (
          <button className="gi-btn gi-btn-save" onClick={handleBatchSave} disabled={batchSaving}>
            {batchSaving ? 'A guardar…' : `Guardar (${dirty.size})`}
          </button>
        )}
      </div>

      <Card title="Actividades">
        {loading && rawActivities.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spinner />
          </div>
        ) : !loading && activities.length === 0 ? (
          <EmptyState
            icon="list"
            title="Sem planos ou actividades"
            description="Cria um plano de acção para começar a gerir as actividades do programa."
            {...(!readOnly && { actionLabel: '+ Novo Plano', onAction: handleOpenPlano })}
          />
        ) : (
          <>
            {searchQuery && searchFilteredActs.length === 0 ? (
              <div className="gi-search-empty">
                Nenhuma actividade encontrada para &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="gi-table">
                  <colgroup>
                    <col /><col style={{ width: 110 }} /><col style={{ width: 100 }} />
                    <col style={{ width: 90 }} /><col style={{ width: 70 }} />
                    <col style={{ width: 90 }} /><col style={{ width: 46 }} />
                  </colgroup>
                  <thead>
                <tr>
                  <th style={{ minWidth: 280 }}>Designação</th>
                  <th className="gi-th-c">Responsável</th>
                  <th className="gi-th-c">Prazo</th>
                  <th className="gi-th-c">% Exec</th>
                  <th className="gi-th-c">% Prev</th>
                  <th className="gi-th-c">Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="gi-empty">
                      Nenhuma actividade para os filtros seleccionados.
                    </td>
                  </tr>
                ) : rows}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </Card>

      {planoModalOpen && (
        <Modal
          isOpen={true}
          onClose={handleClosePlano}
          title={planoToEdit ? 'Editar Plano de Acção' : 'Novo Plano de Acção'}
          width={560}
          footer={
            <>
              <button className="gi-btn" onClick={handleClosePlano}>Cancelar</button>
              {planoToEdit ? (
                <button className="gi-btn gi-btn-save" onClick={handleSavePlanoEdit} disabled={planoSaving}>
                  {planoSaving ? 'A guardar…' : 'Guardar'}
                </button>
              ) : planoStep === 1 ? (
                <button className="gi-btn gi-btn-primary" onClick={goToStep2}>
                  Continuar →
                </button>
              ) : (
                <>
                  <button className="gi-btn" onClick={() => setPlanoStep(1)}>← Anterior</button>
                  <button
                    className="gi-btn gi-btn-save"
                    onClick={handleSavePlanoWithActivities}
                    disabled={planoSaving || parseErrors.length > 0}
                  >
                    {planoSaving ? 'A guardar…' : parsedActivities.length > 0 ? `Guardar e importar ${parsedActivities.length}` : 'Guardar plano'}
                  </button>
                </>
              )}
              {planoErrors._ && <span style={{ fontSize: 12, color: 'var(--red)', width: '100%' }}>{planoErrors._}</span>}
            </>
          }
        >
          {/* ── Stepper (create mode only) ── */}
          {!planoToEdit && (
            <div className="gi-stepper">
              <div className={`gi-step${planoStep === 1 ? ' active' : ''}`}>
                <span className="gi-step-num">1</span>
                <span>Dados do Plano</span>
              </div>
              <div className="gi-step-connector" />
              <div className={`gi-step${planoStep === 2 ? ' active' : ''}`}>
                <span className="gi-step-num">2</span>
                <span>Importar (opcional)</span>
              </div>
            </div>
          )}

          {/* ── Step 1: Plano form ── */}
          {planoStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

              <div className="gi-section">
                <div className="gi-section-title">Identificação</div>
                <div className="gi-field" style={{ marginTop: 10 }}>
                  <span className={`gi-field-label${planoErrors.name ? ' gi-label-error' : ''}`}>Nome *</span>
                  <input
                    className={`gi-field-input${planoErrors.name ? ' gi-input-error' : ''}`}
                    value={planoForm.name}
                    onChange={e => setPlanoForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome do plano de acção"
                  />
                  {planoErrors.name && <span className="gi-error">{planoErrors.name}</span>}
                </div>
                <div className="gi-field-row" style={{ marginTop: 10 }}>
                  <div className="gi-field">
                    <span className={`gi-field-label${planoErrors.code ? ' gi-label-error' : ''}`}>Código *</span>
                    <input
                      className={`gi-field-input${planoErrors.code ? ' gi-input-error' : ''}`}
                      value={planoForm.code}
                      onChange={e => setPlanoForm(f => ({ ...f, code: e.target.value }))}
                      placeholder="Ex: RA, MSOSP"
                      style={{ textTransform: 'uppercase' }}
                    />
                    {planoErrors.code && <span className="gi-error">{planoErrors.code}</span>}
                  </div>
                  <div className="gi-field">
                    <span className={`gi-field-label${planoErrors.eixo_id ? ' gi-label-error' : ''}`}>Eixo *</span>
                    <select
                      className={`gi-field-input${planoErrors.eixo_id ? ' gi-input-error' : ''}`}
                      value={planoForm.eixo_id}
                      onChange={e => setPlanoForm(f => ({ ...f, eixo_id: e.target.value }))}
                      disabled={!!planoToEdit}
                    >
                      <option value="">— seleccionar —</option>
                      {dbEixos.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    {planoErrors.eixo_id && <span className="gi-error">{planoErrors.eixo_id}</span>}
                  </div>
                </div>
              </div>

              <div className="gi-section">
                <div className="gi-section-title">Datas</div>
                <div style={{ marginTop: 10 }}>
                  <DateRangePicker
                    label="Período Previsto"
                    required
                    startDate={planoForm.start_date}
                    endDate={planoForm.end_date}
                    onChange={(s, e) => setPlanoForm(f => ({ ...f, start_date: s, end_date: e }))}
                    error={planoErrors.dates}
                  />
                </div>
              </div>

              <div className="gi-section">
                <div className="gi-section-title">Responsáveis</div>
                <div className="gi-two-col" style={{ marginTop: 10 }}>
                  <div className="gi-field">
                    <span className="gi-field-label">Owner</span>
                    <select className="gi-field-input" value={planoForm.owner}
                      onChange={e => setPlanoForm(f => ({ ...f, owner: e.target.value }))}>
                      <option value="">— seleccionar —</option>
                      {internalPeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="gi-field">
                    <span className="gi-field-label">Sponsor</span>
                    <select className="gi-field-input" value={planoForm.sponsor}
                      onChange={e => setPlanoForm(f => ({ ...f, sponsor: e.target.value }))}>
                      <option value="">— seleccionar —</option>
                      {internalPeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="gi-section">
                <div className="gi-section-title">Objectivo</div>
                <div className="gi-field" style={{ marginTop: 10 }}>
                  <textarea
                    className="gi-field-textarea" rows={3}
                    value={planoForm.objective}
                    onChange={e => setPlanoForm(f => ({ ...f, objective: e.target.value }))}
                    placeholder="Descreva o objectivo principal do plano…"
                  />
                </div>
              </div>

            </div>
          )}

          {/* ── Step 2: Excel import (create mode only) ── */}
          {!planoToEdit && planoStep === 2 && (
            <div className="gi-step2">
              <div className="gi-step2-header">
                <div className="gi-step2-help">
                  Importa actividades em bloco a partir de um ficheiro Excel.
                  A hierarquia é inferida pela ordem das linhas: uma N4 é filha da última N3 acima; etc.
                </div>
                <button className="gi-btn-link" type="button" onClick={downloadTemplate}>
                  📥 Template
                </button>
              </div>

              <div
                className={`gi-upload-area${uploadedFile ? ' has-file' : ''}`}
                onClick={() => !uploadedFile && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file" accept=".xlsx,.xls"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                {!uploadedFile ? (
                  <>
                    <div className="gi-upload-icon">📎</div>
                    <div className="gi-upload-text">Arrastar Excel ou clicar para seleccionar</div>
                    <div className="gi-upload-hint">Formatos aceites: .xlsx, .xls</div>
                  </>
                ) : (
                  <div className="gi-upload-selected">
                    <span>📄 {uploadedFile.name}</span>
                    <button type="button" className="gi-upload-clear"
                      onClick={e => { e.stopPropagation(); clearFile() }}>×</button>
                  </div>
                )}
              </div>

              {(parsedActivities.length > 0 || parseErrors.length > 0) && (
                <div className="gi-preview">
                  <div className="gi-preview-header">
                    <span>
                      {parsedActivities.length > 0
                        ? `Pré-visualização — ${parsedActivities.length} actividades`
                        : 'Sem actividades válidas'}
                    </span>
                    {parseErrors.length > 0 && (
                      <span className="gi-preview-errors-badge">⚠ {parseErrors.length} erro(s)</span>
                    )}
                  </div>

                  {parseErrors.length > 0 && (
                    <div className="gi-error-list">
                      {parseErrors.map((e, i) => (
                        <div key={i} className="gi-error-item">Linha {e.row}: {e.message}</div>
                      ))}
                    </div>
                  )}

                  {parsedActivities.length > 0 && (
                    <div className="gi-preview-table-wrap">
                      <table className="gi-preview-table">
                        <thead>
                          <tr>
                            <th style={{ width: 32 }}>#</th>
                            <th style={{ width: 44 }}>Nível</th>
                            <th>Nome</th>
                            <th style={{ width: 85 }}>Início</th>
                            <th style={{ width: 85 }}>Fim</th>
                            <th style={{ width: 52 }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedActivities.map((a, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td><span className="gi-level-badge">N{a.level}</span></td>
                              <td style={{ paddingLeft: `${(a.level - 3) * 14 + 8}px` }}>{a.name}</td>
                              <td>{fmtDate(a.start_date)}</td>
                              <td>{fmtDate(a.end_date)}</td>
                              <td>{a.pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </Modal>
      )}

      {panelForm && (
        <Modal
          isOpen={true}
          onClose={closePanel}
          title={panelForm.id ? 'Editar Actividade' : 'Nova Actividade'}
          width={520}
          footer={
            <>
              {panelForm.id && (
                <button className="gi-btn gi-btn-danger" onClick={handlePanelDelete} disabled={panelSaving} style={{ marginRight: 'auto' }}>
                  Eliminar
                </button>
              )}
              <button className="gi-btn" onClick={closePanel}>Cancelar</button>
              <button className="gi-btn gi-btn-save" onClick={handlePanelSave} disabled={panelSaving}>
                {panelSaving ? 'A guardar…' : 'Guardar'}
              </button>
              {panelErrors._ && <span style={{ fontSize: 12, color: 'var(--red)', width: '100%' }}>{panelErrors._}</span>}
            </>
          }
        >
          <Panel
            form={panelForm} eixos={eixos} planos={planos} activities={activities}
            internalPeople={internalPeople}
            errors={panelErrors}
            onChange={setPanelForm}
            depProps={panelDepProps}
          />
        </Modal>
      )}
    </div>
  )
}
