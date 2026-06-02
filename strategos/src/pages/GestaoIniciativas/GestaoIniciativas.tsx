import './GestaoIniciativas.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Minimize2, Maximize2, AlertTriangle, Info, X, Link2, Check, ChevronUp, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import { createPortal } from 'react-dom'
import Card from '../../components/Card/Card'
import Modal from '../../components/Modal/Modal'
import Badge from '../../components/Badge/Badge'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { useEixos } from '../../hooks/useEixos'
import { useProgramLabels, type ProgramLabels } from '../../hooks/useProgramLabels'
import { usePlanos } from '../../hooks/usePlanos'
import { supabase } from '../../lib/supabase'
import { rollupPctPrev, rollupDateRange, leafPctPrev, computeGroupStatusFromEff } from '../../lib/rollup'
import { useEffectiveValues, type EffectiveValue } from '../../hooks/useEffectiveValues'
import type { Activity, ActivityDependency, DependencyType } from '../../types/index'
import { useActivityDependencies } from '../../hooks/useActivityDependencies'
import { validateNewDependency, propagateDateChanges, computeDepGap, DEP_GAP_WARNING_THRESHOLD } from '../../lib/activityDependencies'
import { useCanEditCurrent } from '../../hooks/useCanEditCurrent'
import { useRole } from '../../hooks/useRole'
import BulkActivitiesModal from '../../components/BulkActivitiesModal/BulkActivitiesModal'

// ── Types ──────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey'
type DirtyChange  = Partial<Pick<Activity, 'pct' | 'sort_order'>>

const STATUS_BADGE: Record<string, BadgeVariant> = {
  'Concluída': 'blue', 'Em dia': 'green', 'Em risco': 'amber', 'Em atraso': 'red', 'atrasada': 'red',
}

function statusBadge(s: string): BadgeVariant { return STATUS_BADGE[s] ?? 'grey' }
function statusLabel(s: string): string { return s === 'atrasada' ? 'Em atraso' : s }
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso
}

const TODAY = new Date().toISOString().slice(0, 10)
const DEP_TYPE_TOOLTIP = 'FS: Fim → Início · SS: Início → Início · FF: Fim → Fim · SF: Início → Fim'

function groupPct(leaves: Activity[], eff: Map<string, EffectiveValue>): number {
  if (leaves.length === 0) return 0
  return leaves.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / leaves.length
}

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
function Collapsible({ title, defaultOpen = false, rightSlot, children }: {
  title: string; defaultOpen?: boolean; rightSlot?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="gi-collapsible">
      <div className="gi-collapsible-header-row">
        <button className="gi-collapsible-header" type="button" onClick={() => setOpen(o => !o)}>
          <span className="gi-section-title gi-collapsible-title">{title}</span>
        </button>
        {rightSlot && <span className="gi-collapsible-right-slot">{rightSlot}</span>}
        <span className="gi-collapsible-chevron" onClick={() => setOpen(o => !o)} aria-hidden="true">
          {open ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
        </span>
      </div>
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
  errors: Record<string, string>
  onChange: (f: PanelForm) => void
  canEditBaseline: boolean
  isEmbedded?: boolean
  depProps?: DependencyEditorProps
  labels: ProgramLabels
}

function Panel({ form, eixos, planos, activities, errors, onChange, canEditBaseline, isEmbedded, depProps, labels }: PanelProps) {
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

  const macros   = useMemo(() => activities.filter(a => a.n2 === form.n2 && a.level === 3), [activities, form.n2])
  const actsCand = useMemo(() => activities.filter(a => a.n2 === form.n2 && a.level === 4 && a.n3 === form.n3), [activities, form.n2, form.n3])
  const tasks    = useMemo(() => activities.filter(a =>
    a.n2 === form.n2 && a.level === 5 && a.n3 === form.n3 && a.n4 === form.n4
  ), [activities, form.n2, form.n3, form.n4])

  const pctPrev = computePctPrev(form.bs, form.bf)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── 1. Identificação ── */}
      <div className="gi-section">
        <div className="gi-section-title">Identificação</div>
        <div className="gi-field" style={{ marginTop: 10 }}>
          <span className={`gi-field-label${errors.name ? ' gi-label-error' : ''}`}>Designação</span>
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

      {/* ── 2. Hierarquia (hidden for N3; title hidden for N4+) ── */}
      {level >= 4 && (
        <div className="gi-section">
          {!isEmbedded && (
            <div className="gi-field-row" style={{ marginTop: 10 }}>
              <div className="gi-field">
                <span className="gi-field-label">{labels.n1}</span>
                <select className="styled-select-sm" value={form.n1} onChange={handleN1Change}>
                  <option value="">— seleccionar —</option>
                  {eixos.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="gi-field">
                <span className="gi-field-label">{labels.n2}</span>
                <select className="styled-select-sm" value={form.n2} onChange={handleN2Change}>
                  <option value="">— seleccionar —</option>
                  {planos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}
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
      )}

      {/* ── 3. Datas ── */}
      <div className="gi-section">
        <div className="gi-section-title">Datas</div>
        <div className="gi-date-group" style={{ marginTop: 10 }}>
          <div className="gi-date-group-header">
            <span className="gi-field-label">Baseline</span>
            {(form.bs || form.bf) && canEditBaseline && (
              <button type="button" className="gi-date-clear" onClick={() => onChange({ ...form, bs: '', bf: '' })}>Limpar</button>
            )}
          </div>
          <div className="gi-date-row">
            <div className="gi-date-inline-group">
              <span className="gi-date-inline-lbl">Início:</span>
              <input
                className={`gi-date-input${errors.bs ? ' gi-input-error' : ''}`}
                type="date"
                autoComplete="off"
                value={form.bs}
                disabled={!canEditBaseline}
                onChange={e => onChange({ ...form, bs: e.target.value })}
              />
            </div>
            <div className="gi-date-inline-group">
              <span className="gi-date-inline-lbl">Fim:</span>
              <input
                className={`gi-date-input${errors.bs ? ' gi-input-error' : ''}`}
                type="date"
                autoComplete="off"
                value={form.bf}
                disabled={!canEditBaseline}
                onChange={e => onChange({ ...form, bf: e.target.value })}
              />
            </div>
          </div>
          {errors.bs && <span className="gi-error">{errors.bs}</span>}
        </div>
        <div className="gi-date-group" style={{ marginTop: 10 }}>
          <div className="gi-date-group-header">
            <span className="gi-field-label">Real</span>
            {(form.rs || form.rf) && (
              <button type="button" className="gi-date-clear" onClick={() => onChange({ ...form, rs: '', rf: '' })}>Limpar</button>
            )}
          </div>
          <div className="gi-date-row">
            <div className="gi-date-inline-group">
              <span className="gi-date-inline-lbl">Início:</span>
              <input
                className={`gi-date-input${errors.rs ? ' gi-input-error' : ''}`}
                type="date"
                autoComplete="off"
                value={form.rs}
                onChange={e => onChange({ ...form, rs: e.target.value })}
              />
            </div>
            <div className="gi-date-inline-group">
              <span className="gi-date-inline-lbl">Fim:</span>
              <input
                className={`gi-date-input${errors.rs ? ' gi-input-error' : ''}`}
                type="date"
                autoComplete="off"
                value={form.rf}
                onChange={e => onChange({ ...form, rf: e.target.value })}
              />
            </div>
          </div>
          {errors.rs && <span className="gi-error">{errors.rs}</span>}
        </div>
      </div>

      {/* ── 4. Progresso ── */}
      <div className="gi-section">
        <div className="gi-section-title">Progresso</div>
        <div className="gi-progress-inline" style={{ marginTop: 10 }}>
          <span className="gi-progress-lbl">% Execução:</span>
          <div className="gi-pct-wrap">
            <input
              className="gi-pct-input"
              type="number" min={0} max={100} step={1}
              value={form.pct}
              onChange={set('pct')}
              style={{ width: 64 }}
            />
            <span className="gi-pct-unit" style={{ fontSize: 13 }}>%</span>
          </div>
          <span className="gi-progress-lbl" style={{ marginLeft: 16 }}>% Prevista:</span>
          <span className="gi-pct-prev-value gi-readonly">{pctPrev}%</span>
        </div>
      </div>

      {/* ── 5. Notas (collapsible) ── */}
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

      {/* ── 6. Dependências ── */}
      {level >= 4 && (
        form.id && depProps ? (
          <Collapsible
            title="Dependências"
            rightSlot={
              <span
                className="gi-tooltip-trigger"
                data-tooltip={DEP_TYPE_TOOLTIP}
                onClick={e => e.stopPropagation()}
                tabIndex={0}
              >
                <Info size={14} />
              </span>
            }
          >
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
        ) : !form.id ? (
          <div className="gi-section">
            <div className="gi-section-title">Dependências</div>
            <p className="gi-deps-new-hint">Disponíveis após guardar a actividade.</p>
          </div>
        ) : null
      )}

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
      <button ref={btnRef} className="btn-icon" onClick={handleClick} title="Acções"><MoreHorizontal size={16} strokeWidth={1.5} /></button>
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

  const successor = actById.get(activityId)

  return (
    <div className="gi-deps">
      {loading && predecessors.length === 0 && (
        <span className="gi-deps-loading">A carregar…</span>
      )}

      {predecessors.map(dep => {
        const pred = actById.get(dep.predecessor_id)
        const gap  = successor && pred ? computeDepGap(pred, successor, dep) : null
        const showGapWarning = gap !== null && gap > DEP_GAP_WARNING_THRESHOLD
        const gapTooltip = showGapWarning
          ? `Gap de ${gap} dias entre o fim do predecessor e o início do sucessor (lag declarado: ${dep.lag_days}d). Verifique se a dependência ainda faz sentido.`
          : ''
        return (
          <div key={dep.id} className="gi-dep-row">
            <span className="gi-dep-name" title={pred?.name ?? dep.predecessor_id}>
              {pred?.name ?? dep.predecessor_id}
            </span>
            <select
              className="styled-select-sm gi-dep-type-sel"
              value={dep.dep_type}
              title={DEP_TYPE_TOOLTIP}
              onChange={e => onUpdate(dep.id, { dep_type: e.target.value as DependencyType })}
            >
              <option value="FS">FS</option>
              <option value="SS">SS</option>
              <option value="FF">FF</option>
              <option value="SF">SF</option>
            </select>
            <span className="gi-dep-lag-group">
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
            </span>
            {showGapWarning ? (
              <span className="gi-dep-gap-warn gi-dep-gap-slot" title={gapTooltip}>
                <AlertTriangle size={13} />
                <span className="gi-dep-gap-lbl">gap</span>
              </span>
            ) : (
              <span className="gi-dep-gap-slot" />
            )}
            <span />
            <button
              type="button"
              className="gi-dep-remove"
              onClick={() => onRemove(dep.id)}
              title="Remover dependência"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}

      {addOpen && (
        <>
          <div className="gi-dep-row">
            <select
              className="styled-select-sm gi-dep-pred-select"
              value={selPred}
              onChange={e => { setSelPred(e.target.value); setAddError(null) }}
            >
              <option value="">— Actividade predecessora —</option>
              {candidates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select
              className="styled-select-sm gi-dep-type-sel"
              value={selType}
              title={DEP_TYPE_TOOLTIP}
              onChange={e => setSelType(e.target.value as DependencyType)}
            >
              <option value="FS">FS</option>
              <option value="SS">SS</option>
              <option value="FF">FF</option>
              <option value="SF">SF</option>
            </select>
            <span className="gi-dep-lag-group">
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
            </span>
            <span className="gi-dep-gap-slot" />
            <button
              type="button"
              className="gi-dep-confirm"
              onClick={handleAdd}
              disabled={adding}
              title="Confirmar"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="gi-dep-remove"
              onClick={() => { setAddOpen(false); setAddError(null) }}
              title="Cancelar"
            >
              <X size={13} />
            </button>
          </div>
          {addError && <span className="gi-error">{addError}</span>}
        </>
      )}

      {!addOpen && (
        <button
          type="button"
          className="btn gi-dep-add-btn"
          onClick={() => setAddOpen(true)}
        >
          + Predecessora
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
interface GestaoIniciativasProps {
  planoId?: string
  programId?: string
}

export default function GestaoIniciativas({
  planoId: propPlanoId,
  programId: propProgramId,
}: GestaoIniciativasProps = {}) {
  const { showToast } = useToast()
  const [selProgId, setSelProgId] = useState<string | null>(null)
  const readOnly = !useCanEditCurrent('gestao-iniciativas', propPlanoId)
  const { isAdmin, isProgramManager } = useRole()

  const { programs } = usePrograms()
  const { activities: rawActivities, loading, refetch } = useActivities({ plano_id: propPlanoId })
  const { eixos: dbEixos } = useEixos(selProgId ?? undefined)
  const { planos: dbPlanos, refetch: _refetchPlanos } = usePlanos(selProgId ?? undefined)
  const labels = useProgramLabels(selProgId)

  const program = useMemo(() => programs.find(p => p.id === selProgId), [programs, selProgId])

  const activities = rawActivities

  // Current plano metadata (for pre-filling n1/n2 when opening new activity)
  const currentPlano = useMemo(
    () => dbPlanos.find(p => p.id === propPlanoId),
    [dbPlanos, propPlanoId]
  )

  // Eixo and plano names from DB tables (Panel dropdowns)
  const eixos = useMemo(() => dbEixos.map(e => e.name), [dbEixos])

  // Dirty changes: id → { pct?, sort_order? }
  const [dirty, setDirty] = useState<Map<string, DirtyChange>>(new Map())

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'collapse' | 'expand'>('collapse')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)

  const [panelForm, setPanelForm]   = useState<PanelForm | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({})

  const tableRef = useRef<HTMLDivElement>(null)

  const [batchSaving, setBatchSaving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

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

  const predecessorCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dependencies) {
      m.set(d.successor_id, (m.get(d.successor_id) ?? 0) + 1)
    }
    return m
  }, [dependencies])

  // Apply dirty overrides for display
  const localActs = useMemo(() =>
    activities.map(a => { const d = dirty.get(a.id); return d ? { ...a, ...d } : a }),
    [activities, dirty])

  const searchFilteredActs = useMemo(() => {
    if (!searchQuery.trim()) return localActs
    const q = searchQuery.toLowerCase().trim()
    return localActs.filter(a => a.name.toLowerCase().includes(q))
  }, [localActs, searchQuery])

  const eff = useEffectiveValues(localActs, TODAY)

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

  useEffect(() => {
    if (propProgramId) setSelProgId(propProgramId)
  }, [propProgramId])

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

  // ── Click-outside deselect ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedId(null)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

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
      const firstAct = activities[0]
      const n1 = firstAct?.n1 ?? currentPlano?.eixo?.name ?? ''
      const n2 = firstAct?.n2 ?? currentPlano?.name ?? ''
      setPanelForm(blankForm(program?.name ?? '', { n1, n2 }))
    }
    setPanelErrors({})
  }, [selectedId, activities, program, currentPlano])

  const closePanel = useCallback(() => { setPanelForm(null); setPanelErrors({}) }, [])

  const handlePanelSave = useCallback(async () => {
    if (!panelForm) return
    const errs: Record<string, string> = {}
    if (!panelForm.name.trim()) errs.name = 'Designação obrigatória.'
    if ((panelForm.bs && !panelForm.bf) || (!panelForm.bs && panelForm.bf))
      errs.bs = 'Datas baseline devem ser preenchidas.'
    else if (panelForm.bs && panelForm.bf && panelForm.bs > panelForm.bf)
      errs.bs = 'Data de início baseline tem de ser anterior à data de fim.'
    if (panelForm.rf && !panelForm.rs)
      errs.rs = 'Indique a data de início real.'
    else if (panelForm.rs && panelForm.rf && panelForm.rs > panelForm.rf)
      errs.rs = 'Data de início real tem de ser anterior à data de fim.'
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
    if ('error' in result) return result.error?.message ?? 'Unknown error'
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
      const aStatus  = eff.get(a.id)?.status ?? 'Em dia'
      const isSelected = selectedId === a.id
      return (
        <tr
          key={a.id}
          className={`gi-row-${level} gi-row-leaf${isSelected ? ' selected' : ''}`}
          onClick={() => setSelectedId(a.id)}
          onDoubleClick={() => openPanel(a)}
        >
          <td>
            <div className="gi-name-cell" style={{ paddingLeft: indent }}>
              <span className="gi-name-text" title={a.name}>{highlightMatch(a.name, searchQuery)}</span>
              {(predecessorCounts.get(a.id) ?? 0) > 0 && (
                <span className="act-dep-chip" title={predecessorCounts.get(a.id) === 1 ? '1 dependência' : `${predecessorCounts.get(a.id)} dependências`}>
                  <Link2 size={11} />{predecessorCounts.get(a.id)}
                </span>
              )}
            </div>
          </td>
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
    for (const n2g of n1g.n2s) {
      rows.push(...leafRows(n2g.leafActs.filter(a => a.level !== 2), 4, 'n3'))

      for (const n3g of n2g.n3s) {
        // True children = n4 groups + any leafActs that are NOT the level-3 representative itself
        const n3ChildLeaves = n3g.leafActs.filter(a => a.level !== 3)
        const n3HasChildren = n3g.n4s.length > 0 || n3ChildLeaves.length > 0
        if (!n3HasChildren) {
          // Leaf-only: the Macroactividade has no children — render as single leaf row
          rows.push(...leafRows(n3g.leafActs, 4, 'n3'))
          continue
        }
        const n3col = collapsed.has(n3g.key)
        const n3leaves = n3g.all.filter(a => a.level === 4)
        const n3pct = groupPct(n3leaves, eff); const n3prev = rollupPctPrev(n3leaves, TODAY)
        const n3st  = computeGroupStatusFromEff(n3leaves, eff, 3, TODAY); const n3dr = rollupDateRange(n3leaves)
        const n3Rep  = n3g.all.find(a => a.level === 3)
        const n3Sibs = n3Rep
          ? localActs.filter(a => a.level === 3 && a.n1 === n3Rep.n1 && a.n2 === n3Rep.n2)
              .sort((a, b) => a.sort_order - b.sort_order)
          : []
        const n3RepIdx = n3Rep ? n3Sibs.findIndex(s => s.id === n3Rep.id) : -1
        rows.push(
          <tr
            key={n3g.key}
            className={`gi-row-n3${n3Rep ? ' gi-row-editable' : ''}${n3Rep && selectedId === n3Rep.id ? ' selected' : ''}`}
            onClick={n3Rep ? () => setSelectedId(n3Rep.id) : undefined}
            onDoubleClick={n3Rep ? () => openPanel(n3Rep) : undefined}
          >
            <td>
              <div className="gi-name-cell" style={{ paddingLeft: 4 }}>
                <button
                  className="gi-toggle"
                  onClick={e => { e.stopPropagation(); toggle(n3g.key) }}
                >{n3col ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}</button>
                <span className="gi-name-text">{n3g.n3}</span>
              </div>
            </td>
            <td className="gi-td-c">{fmtDate(n3dr.bf)}</td>
            <td className="gi-td-c"><div className="gi-pct-wrap"><span className="gi-pct-ghost">{Math.round(n3pct)}</span><span className="gi-pct-unit">%</span></div></td><td className="gi-td-r">{Math.round(n3prev)}%</td>
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

        rows.push(...leafRows(n3ChildLeaves, 20, 'n4'))

        for (const n4g of n3g.n4s) {
          const n4ChildLeaves = n4g.leafActs.filter(a => a.level !== 4)
          const n4HasChildren = n4g.n5s.length > 0 || n4ChildLeaves.length > 0
          if (!n4HasChildren) {
            rows.push(...leafRows(n4g.leafActs, 20, 'n4'))
            continue
          }
          const n4col = collapsed.has(n4g.key)
          const n4leaves = n4g.all.filter(a => a.level === 4)
          const n4pct = groupPct(n4leaves, eff); const n4prev = rollupPctPrev(n4leaves, TODAY)
          const n4st  = computeGroupStatusFromEff(n4leaves, eff, 4, TODAY); const n4dr = rollupDateRange(n4leaves)
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
                <div className="gi-name-cell" style={{ paddingLeft: 20 }}>
                  <button
                    className="gi-toggle"
                    onClick={e => { e.stopPropagation(); toggle(n4g.key) }}
                  >{n4col ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}</button>
                  <span className="gi-name-text">{n4g.n4}</span>
                </div>
              </td>
              <td className="gi-td-c">{fmtDate(n4dr.bf)}</td>
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

          rows.push(...leafRows(n4ChildLeaves, 36, 'n5'))

          for (const n5g of n4g.n5s) {
            const n5Leaves = n5g.acts.filter(a => a.level !== 5)
            if (n5Leaves.length === 0) {
              // Tarefa with no sub-tasks: single leaf row
              rows.push(...leafRows(n5g.acts, 36, 'n5'))
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
                    <div className="gi-name-cell" style={{ paddingLeft: 36 }}>
                      <span className="gi-name-text">{n5g.n5}</span>
                    </div>
                  </td>
                  <td /><td /><td />
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
              rows.push(...leafRows(n5Leaves, 52, 'n5'))
            }
          }
        }
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="gi-page">
      <div className="gi-controls-bar">
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
            ><X size={14} strokeWidth={1.5} /></button>
          )}
        </div>
        {!readOnly && (
          <>
            <button className="btn-primary" onClick={openNew} disabled={!selProgId}
              title={!selProgId ? 'Selecciona um programa primeiro' : undefined}>
              Nova Actividade
            </button>
            {propPlanoId && (
              <button className="btn" onClick={() => setBulkOpen(true)} disabled={!selProgId}
                title={!selProgId ? 'Selecciona um programa primeiro' : undefined}>
                Importar actividades
              </button>
            )}
          </>
        )}
        <div className="gi-sep" />
        <button
          className="btn gi-btn-icon"
          title={bulkAction === 'collapse' ? 'Colapsar tudo' : 'Expandir tudo'}
          onClick={() => {
            if (bulkAction === 'collapse') { collapseAll(); setBulkAction('expand') }
            else { expandAll(); setBulkAction('collapse') }
          }}
        >
          {bulkAction === 'collapse' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {!readOnly && dirty.size > 0 && (
          <button className="btn-primary" onClick={handleBatchSave} disabled={batchSaving}>
            {batchSaving ? 'A guardar…' : `Guardar (${dirty.size})`}
          </button>
        )}
      </div>

      <div ref={tableRef}>
      <Card title="Actividades">
        {loading && rawActivities.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spinner />
          </div>
        ) : !loading && activities.length === 0 ? (
          <EmptyState
            icon="list"
            title="Sem actividades"
            description="Clica em + Nova Actividade para começar a gerir as actividades deste plano."
            {...(!readOnly && { actionLabel: '+ Nova Actividade', onAction: openNew })}
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
                    <col /><col style={{ width: 100 }} />
                    <col style={{ width: 90 }} /><col style={{ width: 70 }} />
                    <col style={{ width: 90 }} /><col style={{ width: 46 }} />
                  </colgroup>
                  <thead>
                <tr>
                  <th style={{ minWidth: 280 }}>Designação</th>
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
                    <td colSpan={6} className="gi-empty">
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
      </div>

      {propPlanoId && selProgId && (
        <BulkActivitiesModal
          isOpen={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onImported={() => { setBulkOpen(false); refetch() }}
          planoId={propPlanoId}
          programId={selProgId}
          eixoId={currentPlano?.eixo_id ?? null}
          n0={program?.name ?? ''}
          n1={currentPlano?.eixo?.name ?? ''}
          n2={currentPlano?.name ?? ''}
        />
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
                <button className="btn-danger" onClick={handlePanelDelete} disabled={panelSaving} style={{ marginRight: 'auto' }}>
                  Eliminar
                </button>
              )}
              <button className="btn" onClick={closePanel}>Cancelar</button>
              <button className="btn-primary" onClick={handlePanelSave} disabled={panelSaving}>
                {panelSaving ? 'A guardar…' : 'Guardar'}
              </button>
              {panelErrors._ && <span style={{ fontSize: 12, color: 'var(--red)', width: '100%' }}>{panelErrors._}</span>}
            </>
          }
        >
          <Panel
            form={panelForm} eixos={eixos} planos={planos} activities={activities}
            errors={panelErrors}
            onChange={setPanelForm}
            canEditBaseline={!panelForm.id || isAdmin || isProgramManager}
            isEmbedded={true}
            depProps={panelDepProps}
            labels={labels}
          />
        </Modal>
      )}
    </div>
  )
}
