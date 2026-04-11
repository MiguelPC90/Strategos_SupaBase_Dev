import './GestaoIniciativas.css'
import { useState, useMemo, useCallback } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { useActivities } from '../../hooks/useActivities'
import { usePrograms } from '../../hooks/usePrograms'
import { usePeople } from '../../hooks/usePeople'
import { useFilters } from '../../context/FilterContext'
import { supabase } from '../../lib/supabase'
import { rollupPct, rollupPctPrev, rollupStatus, rollupDateRange } from '../../lib/rollup'
import type { Activity } from '../../types/index'

// ── Helpers ────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'red' | 'grey'

const STATUS_BADGE: Record<string, BadgeVariant> = {
  'Concluída':  'green',
  'Em dia':     'blue',
  'Em atraso':  'red',
  'atrasada':   'red',
}

function statusBadge(s: string): BadgeVariant {
  return STATUS_BADGE[s] ?? 'grey'
}

function statusLabel(s: string): string {
  return s === 'atrasada' ? 'Em atraso' : s
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso
}

const TODAY = new Date().toISOString().slice(0, 10)

// ── Tree ───────────────────────────────────────────────────────
interface N3Group { key: string; n3: string; acts: Activity[] }
interface N2Group { key: string; n2: string; n3s: N3Group[]; all: Activity[] }
interface N1Group { key: string; n1: string; n2s: N2Group[]; all: Activity[] }

function buildTree(acts: Activity[]): N1Group[] {
  const n1Map = new Map<string, Activity[]>()
  for (const a of acts) {
    const k = a.n1 || '—'
    if (!n1Map.has(k)) n1Map.set(k, [])
    n1Map.get(k)!.push(a)
  }
  const result: N1Group[] = []
  n1Map.forEach((n1Acts, n1) => {
    const n2Map = new Map<string, Activity[]>()
    for (const a of n1Acts) {
      const k = a.n2 || '—'
      if (!n2Map.has(k)) n2Map.set(k, [])
      n2Map.get(k)!.push(a)
    }
    const n2s: N2Group[] = []
    n2Map.forEach((n2Acts, n2) => {
      const n3Map = new Map<string, Activity[]>()
      for (const a of n2Acts) {
        const k = a.n3 || ''
        if (!n3Map.has(k)) n3Map.set(k, [])
        n3Map.get(k)!.push(a)
      }
      const n3s: N3Group[] = []
      n3Map.forEach((n3Acts, n3) => {
        n3s.push({ key: `n3:${n1}:${n2}:${n3}`, n3, acts: n3Acts })
      })
      n2s.push({ key: `n2:${n1}:${n2}`, n2, n3s, all: n2Acts })
    })
    result.push({ key: `n1:${n1}`, n1, n2s, all: n1Acts })
  })
  return result
}

// ── Panel form ─────────────────────────────────────────────────
interface PanelForm {
  id: string | null
  name: string; level: string
  n0: string; n1: string; n2: string; n3: string; n4: string; n5: string
  bs: string; bf: string; rs: string; rf: string; finish: string
  pct: string; status: string; owner: string; sponsor: string; notes: string
}

function toForm(a: Activity): PanelForm {
  return {
    id: a.id, name: a.name, level: String(a.level),
    n0: a.n0, n1: a.n1, n2: a.n2, n3: a.n3, n4: a.n4, n5: a.n5,
    bs: a.bs ?? '', bf: a.bf ?? '', rs: a.rs ?? '', rf: a.rf ?? '', finish: a.finish ?? '',
    pct: String(a.pct), status: a.status,
    owner: a.owner, sponsor: a.sponsor, notes: a.notes ?? '',
  }
}

function blankForm(n0: string): PanelForm {
  return {
    id: null, name: '', level: '4',
    n0, n1: '', n2: '', n3: '', n4: '', n5: '',
    bs: '', bf: '', rs: '', rf: '', finish: '',
    pct: '0', status: 'Em dia', owner: '', sponsor: '', notes: '',
  }
}

// ── Panel sub-component ────────────────────────────────────────
interface PanelProps {
  form: PanelForm
  peopleNames: string[]
  onChange: (f: PanelForm) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  saving: boolean
  error: string
}

function Panel({ form, peopleNames, onChange, onSave, onDelete, onClose, saving, error }: PanelProps) {
  const set = (k: keyof PanelForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [k]: e.target.value })

  const listId = 'gi-people-list'

  return (
    <>
      <div className="gi-panel-overlay" onClick={onClose} />
      <datalist id={listId}>
        {peopleNames.map(n => <option key={n} value={n} />)}
      </datalist>
      <div className="gi-panel">
        <div className="gi-panel-header">
          <span className="gi-panel-title">
            {form.id ? 'Editar Actividade' : 'Nova Actividade'}
          </span>
          <button className="gi-btn" onClick={onClose}>✕</button>
        </div>

        <div className="gi-panel-body">
          <div className="gi-field">
            <span className="gi-field-label">Nome *</span>
            <input
              className="gi-field-input"
              value={form.name}
              onChange={set('name')}
              placeholder="Designação da actividade"
            />
          </div>

          <div className="gi-section-title">Hierarquia</div>
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">N1 — Eixo</span>
              <input className="gi-field-input" value={form.n1} onChange={set('n1')} />
            </div>
            <div className="gi-field">
              <span className="gi-field-label">N2 — Plano</span>
              <input className="gi-field-input" value={form.n2} onChange={set('n2')} />
            </div>
          </div>
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">N3</span>
              <input className="gi-field-input" value={form.n3} onChange={set('n3')} />
            </div>
            <div className="gi-field">
              <span className="gi-field-label">N4</span>
              <input className="gi-field-input" value={form.n4} onChange={set('n4')} />
            </div>
          </div>

          <div className="gi-section-title">Datas baseline</div>
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">Início (BS)</span>
              <input className="gi-field-input" type="date" value={form.bs} onChange={set('bs')} />
            </div>
            <div className="gi-field">
              <span className="gi-field-label">Fim (BF)</span>
              <input className="gi-field-input" type="date" value={form.bf} onChange={set('bf')} />
            </div>
          </div>

          <div className="gi-section-title">Datas reais</div>
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

          <div className="gi-section-title">Progresso</div>
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">% Execução</span>
              <input
                className="gi-field-input"
                type="number"
                min="0"
                max="100"
                value={form.pct}
                onChange={set('pct')}
              />
            </div>
            <div className="gi-field">
              <span className="gi-field-label">Estado</span>
              <select className="gi-field-select" value={form.status} onChange={set('status')}>
                <option>Em dia</option>
                <option>Em atraso</option>
                <option>Concluída</option>
              </select>
            </div>
          </div>

          <div className="gi-section-title">Responsáveis</div>
          <div className="gi-field-row">
            <div className="gi-field">
              <span className="gi-field-label">Responsável</span>
              <input
                className="gi-field-input"
                list={listId}
                value={form.owner}
                onChange={set('owner')}
              />
            </div>
            <div className="gi-field">
              <span className="gi-field-label">Sponsor</span>
              <input
                className="gi-field-input"
                list={listId}
                value={form.sponsor}
                onChange={set('sponsor')}
              />
            </div>
          </div>

          <div className="gi-field">
            <span className="gi-field-label">Prazo (Finish)</span>
            <input className="gi-field-input" type="date" value={form.finish} onChange={set('finish')} />
          </div>

          <div className="gi-field">
            <span className="gi-field-label">Notas</span>
            <textarea className="gi-field-textarea" value={form.notes} onChange={set('notes')} rows={3} />
          </div>
        </div>

        <div className="gi-panel-footer">
          <button className="gi-btn gi-btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
          <button className="gi-btn" onClick={onClose}>Cancelar</button>
          {form.id && (
            <button
              className="gi-btn gi-btn-danger"
              onClick={onDelete}
              disabled={saving}
              style={{ marginLeft: 'auto' }}
            >
              Eliminar
            </button>
          )}
          {error && <span className="gi-panel-err">{error}</span>}
        </div>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function GestaoIniciativas() {
  const { filters } = useFilters()
  const programId = filters.programIds[0]

  const { activities, loading, refetch } = useActivities({ program_id: programId })
  const { programs } = usePrograms()
  const { people } = usePeople()

  const program = useMemo(
    () => programs.find(p => p.id === programId),
    [programs, programId]
  )
  const peopleNames = useMemo(
    () => people.filter(p => p.active !== false).map(p => p.name),
    [people]
  )

  // Dirty: id → modified pct (inline edits only)
  const [dirty, setDirty] = useState<Map<string, number>>(new Map())

  // Collapse state
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Panel state
  const [panelForm, setPanelForm] = useState<PanelForm | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)
  const [panelErr, setPanelErr] = useState('')

  // Batch save state
  const [batchSaving, setBatchSaving] = useState(false)

  // Apply dirty pct overrides to activities for display
  const localActs = useMemo(
    () => activities.map(a => dirty.has(a.id) ? { ...a, pct: dirty.get(a.id)! } : a),
    [activities, dirty]
  )

  const tree = useMemo(() => buildTree(localActs), [localActs])

  // ── Collapse handlers ────────────────────────────────────────
  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
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
          if (n3.n3) keys.add(n3.key)
        }
      }
    }
    setCollapsed(keys)
  }, [tree])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])

  // ── Inline pct change ────────────────────────────────────────
  const handlePct = useCallback((id: string, raw: string) => {
    const val = Math.min(100, Math.max(0, Number(raw) || 0))
    setDirty(prev => new Map(prev).set(id, val))
  }, [])

  // ── Batch save ───────────────────────────────────────────────
  const handleBatchSave = useCallback(async () => {
    if (dirty.size === 0) return
    setBatchSaving(true)
    const updates: Activity[] = []
    dirty.forEach((pct, id) => {
      const act = activities.find(a => a.id === id)
      if (act) updates.push({ ...act, pct })
    })
    const { error } = await supabase.from('activities').upsert(updates)
    setBatchSaving(false)
    if (!error) {
      setDirty(new Map())
      refetch()
    }
  }, [dirty, activities, refetch])

  // ── Panel open/close ─────────────────────────────────────────
  const openPanel = useCallback((a: Activity) => {
    setPanelForm(toForm(a))
    setPanelErr('')
  }, [])

  const openNew = useCallback(() => {
    setPanelForm(blankForm(program?.name ?? ''))
    setPanelErr('')
  }, [program])

  const closePanel = useCallback(() => {
    setPanelForm(null)
    setPanelErr('')
  }, [])

  // ── Panel save ───────────────────────────────────────────────
  const handlePanelSave = useCallback(async () => {
    if (!panelForm) return
    if (!panelForm.name.trim()) {
      setPanelErr('Nome obrigatório.')
      return
    }
    setPanelSaving(true)
    setPanelErr('')

    const pct = Math.min(100, Math.max(0, Number(panelForm.pct) || 0))
    const payload = {
      name:       panelForm.name.trim(),
      level:      Number(panelForm.level) || 4,
      n0:         panelForm.n0,
      n1:         panelForm.n1,
      n2:         panelForm.n2,
      n3:         panelForm.n3,
      n4:         panelForm.n4,
      n5:         panelForm.n5,
      bs:         panelForm.bs  || null,
      bf:         panelForm.bf  || null,
      rs:         panelForm.rs  || null,
      rf:         panelForm.rf  || null,
      finish:     panelForm.finish || null,
      pct,
      status:     panelForm.status,
      owner:      panelForm.owner,
      sponsor:    panelForm.sponsor,
      notes:      panelForm.notes || null,
      program_id: programId ?? null,
    }

    let errMsg = ''
    if (panelForm.id) {
      const { error } = await supabase
        .from('activities')
        .update(payload)
        .eq('id', panelForm.id)
      if (error) errMsg = error.message
    } else {
      const { error } = await supabase
        .from('activities')
        .insert({
          ...payload,
          id0:        panelForm.n0,
          id1:        '',
          id2:        '',
          pct_prev:   0,
          sort_order: activities.length,
        })
      if (error) errMsg = error.message
    }

    setPanelSaving(false)
    if (errMsg) {
      setPanelErr(errMsg)
      return
    }
    setPanelForm(null)
    refetch()
  }, [panelForm, programId, activities.length, refetch])

  // ── Panel delete ─────────────────────────────────────────────
  const handlePanelDelete = useCallback(async () => {
    const id = panelForm?.id
    if (!id) return
    if (!confirm(`Eliminar "${panelForm?.name}"? Esta acção não pode ser desfeita.`)) return
    setPanelSaving(true)
    const { error } = await supabase.from('activities').delete().eq('id', id)
    setPanelSaving(false)
    if (error) {
      setPanelErr(error.message)
      return
    }
    setDirty(prev => { const next = new Map(prev); next.delete(id); return next })
    setPanelForm(null)
    refetch()
  }, [panelForm, refetch])

  // ── Row delete (without opening panel) ───────────────────────
  const handleRowDelete = useCallback(async (a: Activity) => {
    if (!confirm(`Eliminar "${a.name}"? Esta acção não pode ser desfeita.`)) return
    const { error } = await supabase.from('activities').delete().eq('id', a.id)
    if (error) { alert(`Erro ao eliminar: ${error.message}`); return }
    setDirty(prev => { const next = new Map(prev); next.delete(a.id); return next })
    refetch()
  }, [refetch])

  // ── Build table rows ─────────────────────────────────────────
  const rows: React.ReactNode[] = []

  for (const n1g of tree) {
    const n1col  = collapsed.has(n1g.key)
    const n1pct  = rollupPct(n1g.all)
    const n1prev = rollupPctPrev(n1g.all, TODAY)
    const n1st   = rollupStatus(n1g.all)
    const n1dr   = rollupDateRange(n1g.all)

    rows.push(
      <tr key={n1g.key} className="gi-row-n1">
        <td>
          <div className="gi-name-cell" style={{ paddingLeft: 4 }}>
            <button className="gi-toggle" onClick={() => toggle(n1g.key)}>
              {n1col ? '▶' : '▼'}
            </button>
            <span className="gi-name-text">{n1g.n1}</span>
          </div>
        </td>
        <td className="gi-td-c" />
        <td className="gi-td-c">{fmtDate(n1dr.bf)}</td>
        <td className="gi-td-r">{Math.round(n1pct)}%</td>
        <td className="gi-td-r">{Math.round(n1prev)}%</td>
        <td className="gi-td-c"><Badge variant={statusBadge(n1st)}>{n1st}</Badge></td>
        <td />
      </tr>
    )
    if (n1col) continue

    for (const n2g of n1g.n2s) {
      const n2col  = collapsed.has(n2g.key)
      const n2pct  = rollupPct(n2g.all)
      const n2prev = rollupPctPrev(n2g.all, TODAY)
      const n2st   = rollupStatus(n2g.all)
      const n2dr   = rollupDateRange(n2g.all)

      rows.push(
        <tr key={n2g.key} className="gi-row-n2">
          <td>
            <div className="gi-name-cell" style={{ paddingLeft: 20 }}>
              <button className="gi-toggle" onClick={() => toggle(n2g.key)}>
                {n2col ? '▶' : '▼'}
              </button>
              <span className="gi-name-text">{n2g.n2}</span>
            </div>
          </td>
          <td className="gi-td-c" />
          <td className="gi-td-c">{fmtDate(n2dr.bf)}</td>
          <td className="gi-td-r">{Math.round(n2pct)}%</td>
          <td className="gi-td-r">{Math.round(n2prev)}%</td>
          <td className="gi-td-c"><Badge variant={statusBadge(n2st)}>{n2st}</Badge></td>
          <td />
        </tr>
      )
      if (n2col) continue

      for (const n3g of n2g.n3s) {
        if (n3g.n3) {
          const n3col  = collapsed.has(n3g.key)
          const n3pct  = rollupPct(n3g.acts)
          const n3prev = rollupPctPrev(n3g.acts, TODAY)
          const n3st   = rollupStatus(n3g.acts)
          const n3dr   = rollupDateRange(n3g.acts)

          rows.push(
            <tr key={n3g.key} className="gi-row-n3">
              <td>
                <div className="gi-name-cell" style={{ paddingLeft: 36 }}>
                  <button className="gi-toggle" onClick={() => toggle(n3g.key)}>
                    {n3col ? '▶' : '▼'}
                  </button>
                  <span className="gi-name-text">{n3g.n3}</span>
                </div>
              </td>
              <td className="gi-td-c" />
              <td className="gi-td-c">{fmtDate(n3dr.bf)}</td>
              <td className="gi-td-r">{Math.round(n3pct)}%</td>
              <td className="gi-td-r">{Math.round(n3prev)}%</td>
              <td className="gi-td-c"><Badge variant={statusBadge(n3st)}>{n3st}</Badge></td>
              <td />
            </tr>
          )
          if (n3col) continue
        }

        for (const a of n3g.acts) {
          const indent = n3g.n3 ? 52 : 36
          const aEnd   = a.rf ?? a.bf ?? a.finish
          const pctVal = dirty.get(a.id) ?? a.pct
          const aPrev  = rollupPctPrev([a], TODAY)

          rows.push(
            <tr key={a.id} className="gi-row-n4">
              <td>
                <div className="gi-name-cell" style={{ paddingLeft: indent }}>
                  <span className="gi-name-text" title={a.name}>{a.name}</span>
                </div>
              </td>
              <td className="gi-td-c" style={{ fontSize: 12, color: 'var(--text2)' }}>
                {a.owner || '—'}
              </td>
              <td className="gi-td-c">{fmtDate(aEnd ?? null)}</td>
              <td className="gi-td-c">
                <div className="gi-pct-wrap">
                  <input
                    className="gi-pct-input"
                    type="number"
                    min={0}
                    max={100}
                    value={pctVal}
                    onChange={e => handlePct(a.id, e.target.value)}
                  />
                  <span className="gi-pct-unit">%</span>
                </div>
              </td>
              <td className="gi-td-r" style={{ fontSize: 12 }}>{Math.round(aPrev)}%</td>
              <td className="gi-td-c">
                <Badge variant={statusBadge(a.status)}>{statusLabel(a.status)}</Badge>
              </td>
              <td>
                <div className="gi-act-btns">
                  <button
                    className="gi-icon-btn"
                    onClick={() => openPanel(a)}
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    className="gi-icon-btn del"
                    onClick={() => handleRowDelete(a)}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          )
        }
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="gi-page">
      <div className="gi-controls-bar">
        <button
          className="gi-btn gi-btn-primary"
          onClick={openNew}
          disabled={!programId}
          title={!programId ? 'Selecciona um programa primeiro' : undefined}
        >
          + Nova Actividade
        </button>
        <div className="gi-sep" />
        <button className="gi-btn" onClick={collapseAll}>Colapsar tudo</button>
        <button className="gi-btn" onClick={expandAll}>Expandir tudo</button>
        <div className="gi-spacer" />
        {dirty.size > 0 && (
          <button
            className="gi-btn gi-btn-save"
            onClick={handleBatchSave}
            disabled={batchSaving}
          >
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
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 64 }} />
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
          form={panelForm}
          peopleNames={peopleNames}
          onChange={setPanelForm}
          onSave={handlePanelSave}
          onDelete={handlePanelDelete}
          onClose={closePanel}
          saving={panelSaving}
          error={panelErr}
        />
      )}
    </div>
  )
}
