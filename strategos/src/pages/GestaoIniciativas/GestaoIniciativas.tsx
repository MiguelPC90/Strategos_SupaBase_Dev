import './GestaoIniciativas.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { usePeople } from '../../hooks/usePeople'
import { useEixos } from '../../hooks/useEixos'
import { usePlanos } from '../../hooks/usePlanos'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'
import { rollupPct, rollupPctPrev, rollupStatus, rollupDateRange, leafPctPrev, leafStatus } from '../../lib/rollup'
import type { Activity } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'red' | 'grey'
type DirtyChange  = Partial<Pick<Activity, 'pct' | 'sort_order'>>

const STATUS_BADGE: Record<string, BadgeVariant> = {
  'Concluída': 'green', 'Em dia': 'blue', 'Em atraso': 'red', 'atrasada': 'red',
}

function statusBadge(s: string): BadgeVariant { return STATUS_BADGE[s] ?? 'grey' }
function statusLabel(s: string): string { return s === 'atrasada' ? 'Em atraso' : s }
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso
}

const TODAY = new Date().toISOString().slice(0, 10)

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
interface PanelProps {
  form: PanelForm
  eixos: string[]
  planos: string[]
  activities: Activity[]
  peopleNames: string[]
  onChange: (f: PanelForm) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  saving: boolean
  error: string
}

function Panel({ form, eixos, planos, activities, peopleNames, onChange, onSave, onDelete, onClose, saving, error }: PanelProps) {
  const [datesOpen, setDatesOpen] = useState(false)

  const set = (k: keyof PanelForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [k]: e.target.value })

  const level = Number(form.level) || 3

  // Level change → clear irrelevant context fields
  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLevel = Number(e.target.value)
    const updated: PanelForm = { ...form, level: e.target.value }
    if (newLevel <= 3)       { updated.n3 = ''; updated.n4 = ''; updated.n5 = '' }
    else if (newLevel === 4) { updated.n4 = ''; updated.n5 = '' }
    else if (newLevel === 5) { updated.n5 = '' }
    onChange(updated)
  }

  // N1 change → cascade clear
  const handleN1Change = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...form, n1: e.target.value, n2: '', n3: '', n4: '', n5: '' })

  // N2 change → cascade clear
  const handleN2Change = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...form, n2: e.target.value, n3: '', n4: '', n5: '' })

  // Cascading candidates — filtered per level
  const macros   = activities.filter(a => a.n2 === form.n2 && a.level === 3)
  const actsCand = activities.filter(a => a.n2 === form.n2 && a.level === 4 && a.n3 === form.n3)
  const tasks    = activities.filter(a =>
    a.n2 === form.n2 && a.level === 5 && a.n3 === form.n3 && a.n4 === form.n4
  )
  const listId = 'gi-people-list'

  return (
    <>
      <div className="gi-panel-overlay" onClick={onClose} />
      <datalist id={listId}>
        {peopleNames.map(n => <option key={n} value={n} />)}
      </datalist>
      <div className="gi-panel">
        <div className="gi-panel-header">
          <span className="gi-panel-title">{form.id ? 'Editar Actividade' : 'Nova Actividade'}</span>
          <button className="gi-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gi-panel-body">

          {/* 1. Nome */}
          <div className="gi-field">
            <span className="gi-field-label">Nome *</span>
            <input
              className="gi-field-input"
              value={form.name}
              onChange={e => onChange({ ...form, name: e.target.value })}
              placeholder="Designação da actividade"
            />
          </div>

          {/* 2. Nível */}
          <div className="gi-field">
            <span className="gi-field-label">Nível</span>
            <select className="gi-level-select" value={form.level} onChange={handleLevelChange}>
              <option value="3">Macroactividade</option>
              <option value="4">Actividade</option>
              <option value="5">Tarefa</option>
              <option value="6">Sub-tarefa</option>
            </select>
          </div>

          {/* 3. Eixo + Plano de Acção */}
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">Eixo</span>
              <select className="gi-field-select" value={form.n1} onChange={handleN1Change}>
                <option value="">— seleccionar —</option>
                {eixos.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="gi-field">
              <span className="gi-field-label">Plano de Acção</span>
              <select className="gi-field-select" value={form.n2} onChange={handleN2Change}>
                <option value="">— seleccionar —</option>
                {planos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* 4. Macroactividade (level >= 4) */}
          {level >= 4 && (
            <div className="gi-context-section">
              <div className="gi-field">
                <span className="gi-context-label">Macroactividade</span>
                <select
                  className="gi-field-select"
                  value={form.n3}
                  onChange={e => onChange({ ...form, n3: e.target.value, n4: '', n5: '' })}
                >
                  <option value="">— seleccionar —</option>
                  {macros.map(a => <option key={a.id} value={a.n3}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 5. Actividade (level >= 5) */}
          {level >= 5 && (
            <div className="gi-context-section">
              <div className="gi-field">
                <span className="gi-context-label">Actividade</span>
                <select
                  className="gi-field-select"
                  value={form.n4}
                  onChange={e => onChange({ ...form, n4: e.target.value, n5: '' })}
                >
                  <option value="">— seleccionar —</option>
                  {actsCand.map(a => <option key={a.id} value={a.n4}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 6. Tarefa (level >= 6) */}
          {level >= 6 && (
            <div className="gi-context-section">
              <div className="gi-field">
                <span className="gi-context-label">Tarefa</span>
                <select
                  className="gi-field-select"
                  value={form.n5}
                  onChange={e => onChange({ ...form, n5: e.target.value })}
                >
                  <option value="">— seleccionar —</option>
                  {tasks.map(a => <option key={a.id} value={a.n5}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 7. Responsável + Sponsor */}
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">Responsável</span>
              <input className="gi-field-input" list={listId} value={form.owner} onChange={set('owner')} />
            </div>
            <div className="gi-field">
              <span className="gi-field-label">Sponsor</span>
              <input className="gi-field-input" list={listId} value={form.sponsor} onChange={set('sponsor')} />
            </div>
          </div>

          {/* 8. Datas e Progresso (colapsável) */}
          <button className="gi-section-toggle" onClick={() => setDatesOpen(o => !o)}>
            <span>Datas e Progresso</span>
            <span>{datesOpen ? '▲' : '▼'}</span>
          </button>

          {datesOpen && (
            <>
              <div className="gi-field-row">
                <div className="gi-field">
                  <span className="gi-field-label">Início baseline (BS)</span>
                  <input className="gi-field-input" type="date" value={form.bs} onChange={set('bs')} />
                </div>
                <div className="gi-field">
                  <span className="gi-field-label">Fim baseline (BF)</span>
                  <input className="gi-field-input" type="date" value={form.bf} onChange={set('bf')} />
                </div>
              </div>

              <div className="gi-field-row">
                <div className="gi-field">
                  <span className="gi-field-label">Início real (RS)</span>
                  <input className="gi-field-input" type="date" value={form.rs} onChange={set('rs')} />
                </div>
                <div className="gi-field">
                  <span className="gi-field-label">Fim real (RF)</span>
                  <input className="gi-field-input" type="date" value={form.rf} onChange={set('rf')} />
                </div>
              </div>

              <div className="gi-field">
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

              <div className="gi-field">
                <span className="gi-field-label">Notas</span>
                <textarea className="gi-field-textarea" value={form.notes} onChange={set('notes')} rows={3} />
              </div>
            </>
          )}

        </div>
        <div className="gi-panel-footer">
          <button className="gi-btn gi-btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
          <button className="gi-btn" onClick={onClose}>Cancelar</button>
          {form.id && (
            <button className="gi-btn gi-btn-danger" onClick={onDelete} disabled={saving} style={{ marginLeft: 'auto' }}>
              Eliminar
            </button>
          )}
          {error && <span className="gi-panel-err">{error}</span>}
        </div>
      </div>
    </>
  )
}

// ── ⋯ Row menu ─────────────────────────────────────────────────
interface RowMenuProps {
  actId: string; openId: string | null
  canUp: boolean; canDown: boolean
  onOpen: (id: string | null) => void
  onEdit: () => void; onDuplicate: () => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
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
      <button className="gi-menu-item" onClick={() => { onOpen(null); onEdit() }}>Editar</button>
      <button className="gi-menu-item" onClick={() => { onOpen(null); onDuplicate() }}>Duplicar</button>
      <button className="gi-menu-item" onClick={() => { onOpen(null); onMoveUp() }} disabled={!canUp}>Mover para cima</button>
      <button className="gi-menu-item" onClick={() => { onOpen(null); onMoveDown() }} disabled={!canDown}>Mover para baixo</button>
      <div className="gi-menu-sep" />
      <button className="gi-menu-item danger" onClick={() => { onOpen(null); onDelete() }}>Eliminar</button>
    </div>
  )

  return (
    <div className="gi-menu-wrap">
      <button ref={btnRef} className="gi-icon-btn" onClick={handleClick} title="Acções">⋯</button>
      {open && pos !== null && createPortal(menu, document.body)}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function GestaoIniciativas() {
  const { filters } = useFilters()
  const [selProgId, setSelProgId] = useState<string | null>(null)

  const { programs } = usePrograms()
  const { activities: rawActivities, loading, refetch } = useActivities({})
  const { people } = usePeople()
  const { eixos: dbEixos } = useEixos(selProgId ?? undefined)
  const { planos: dbPlanos } = usePlanos(selProgId ?? undefined)

  const program     = useMemo(() => programs.find(p => p.id === selProgId), [programs, selProgId])
  const peopleNames = useMemo(() => people.filter(p => p.active !== false).map(p => p.name), [people])

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
  const [panelErr, setPanelErr]     = useState('')

  const [batchSaving, setBatchSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Apply dirty overrides for display
  const localActs = useMemo(() =>
    activities.map(a => { const d = dirty.get(a.id); return d ? { ...a, ...d } : a }),
    [activities, dirty])

  const tree = useMemo(() => buildTree(localActs), [localActs])

  // Planos filtered by selected eixo (n1) in panel
  const planos = useMemo(() => {
    const n1 = panelForm?.n1 ?? ''
    return dbPlanos
      .filter(p => !n1 || p.eixo?.name === n1)
      .map(p => p.name)
  }, [dbPlanos, panelForm?.n1])

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return
    const handler = () => setMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuId])

  // Toast auto-clear
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

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
      setToast('Guardado!')
      refetch()
    }
  }, [dirty, activities, refetch])

  // ── Panel ─────────────────────────────────────────────────────
  const openPanel = useCallback((a: Activity) => {
    setPanelForm(toForm(a)); setPanelErr('')
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
    setPanelErr('')
  }, [selectedId, activities, program])

  const closePanel = useCallback(() => { setPanelForm(null); setPanelErr('') }, [])

  const handlePanelSave = useCallback(async () => {
    if (!panelForm) return
    if (!panelForm.name.trim()) { setPanelErr('Nome obrigatório.'); return }
    setPanelSaving(true); setPanelErr('')
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
      const { error } = await supabase.from('activities').update(payload).eq('id', panelForm.id)
      if (error) errMsg = error.message
    } else {
      const { error } = await supabase.from('activities').insert({
        ...payload, id0: panelForm.n0, id1: '', id2: '', pct_prev: 0,
        sort_order: activities.length,
      })
      if (error) errMsg = error.message
    }
    setPanelSaving(false)
    if (errMsg) { setPanelErr(errMsg); return }
    setPanelForm(null); refetch()
  }, [panelForm, selProgId, activities.length, refetch])

  const handlePanelDelete = useCallback(async () => {
    const id = panelForm?.id
    if (!id) return
    if (!confirm(`Eliminar "${panelForm?.name}"? Esta acção não pode ser desfeita.`)) return
    setPanelSaving(true)
    const { error } = await supabase.from('activities').delete().eq('id', id)
    setPanelSaving(false)
    if (error) { setPanelErr(error.message); return }
    setDirty(prev => { const next = new Map(prev); next.delete(id); return next })
    setPanelForm(null); refetch()
  }, [panelForm, refetch])

  // ── Duplicate ─────────────────────────────────────────────────
  const handleDuplicate = useCallback((a: Activity) => {
    setPanelForm({ ...toForm(a), id: null, name: a.name + ' (cópia)', pct: '0', rs: '', rf: '' })
    setPanelErr('')
  }, [])

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
              <span className="gi-name-text" title={a.name}>{a.name}</span>
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
            <RowMenu
              actId={a.id} openId={menuId} canUp={idx > 0} canDown={idx < sorted.length - 1}
              onOpen={setMenuId}
              onEdit={() => openPanel(a)}
              onDuplicate={() => handleDuplicate(a)}
              onDelete={() => handleRowDelete(a)}
              onMoveUp={() => handleMove(a, acts, 'up')}
              onMoveDown={() => handleMove(a, acts, 'down')}
            />
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
    const n1st  = rollupStatus(n1leaves, TODAY); const n1dr = rollupDateRange(n1leaves)
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
      const n2st  = rollupStatus(n2leaves, TODAY); const n2dr = rollupDateRange(n2leaves)
      const n2Owner = dbPlanos.find(p => p.name === n2g.n2)?.owner || '—'
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
          <td className="gi-td-c"><Badge variant={statusBadge(n2st)}>{n2st}</Badge></td><td />
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
        const n3st  = rollupStatus(n3leaves, TODAY); const n3dr = rollupDateRange(n3leaves)
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
              {n3Rep && (
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
          const n4st  = rollupStatus(n4leaves, TODAY); const n4dr = rollupDateRange(n4leaves)
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
                {n4Rep && (
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
                    {n5Rep && (
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

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="gi-page">
      <div className="gi-controls-bar">
        {programs.length > 1 && (
          <>
            <label className="gi-prog-label">Programa</label>
            <select
              className="gi-prog-select"
              value={selProgId ?? ''}
              onChange={e => setSelProgId(e.target.value || null)}
            >
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="gi-sep" />
          </>
        )}
        <button className="gi-btn gi-btn-primary" onClick={openNew} disabled={!selProgId}
          title={!selProgId ? 'Selecciona um programa primeiro' : undefined}>
          Nova Actividade
        </button>
        <div className="gi-sep" />
        <button className="gi-btn" onClick={collapseAll}>Colapsar tudo</button>
        <button className="gi-btn" onClick={expandAll}>Expandir tudo</button>
        <div className="gi-spacer" />
        {toast && <span className="gi-toast">{toast}</span>}
        {dirty.size > 0 && (
          <button className="gi-btn gi-btn-save" onClick={handleBatchSave} disabled={batchSaving}>
            {batchSaving ? 'A guardar…' : `Guardar (${dirty.size})`}
          </button>
        )}
      </div>

      <Card title="Actividades">
        {loading ? (
          <div className="gi-empty">A carregar…</div>
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
                      {activities.length === 0
                        ? 'Sem actividades. Selecciona um programa ou cria uma nova actividade.'
                        : 'Nenhuma actividade para os filtros seleccionados.'}
                    </td>
                  </tr>
                ) : rows}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {panelForm && (
        <Panel
          form={panelForm} eixos={eixos} planos={planos} activities={activities}
          peopleNames={peopleNames}
          onChange={setPanelForm} onSave={handlePanelSave} onDelete={handlePanelDelete}
          onClose={closePanel} saving={panelSaving} error={panelErr}
        />
      )}
    </div>
  )
}
