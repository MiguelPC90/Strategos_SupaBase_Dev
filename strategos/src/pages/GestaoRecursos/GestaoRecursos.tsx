import './GestaoRecursos.css'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { useActivities } from '../../hooks/useActivities'
import { useResources } from '../../hooks/useResources'
import { usePeople } from '../../hooks/usePeople'
import { useFinancials } from '../../hooks/useFinancials'
import KpiCard from '../../components/KpiCard/KpiCard'
import Badge from '../../components/Badge/Badge'
import type { FteResource, Person, FinContract } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────────
interface PlanOption {
  key: string
  label: string
  n0: string; n1: string; n2: string
  id0: string; id1: string; id2: string
  program_id: string | null
}

// FteResource with guaranteed string id (new_ prefix for unsaved rows)
type DraftResource = FteResource

// ── Constants ──────────────────────────────────────────────────────
const RES_TYPES    = ['Interno', 'Externo']
const RES_STATUSES = ['Activo', 'Inactivo']
const DEFAULT_PROFILES = ['PM', 'Gestor de Projecto', 'Técnico', 'Consultor', 'Especialista', 'Arquitecto', 'Analista', 'Desenvolvedor']
const DEFAULT_UNITS    = ['TI', 'Gestão', 'Operações', 'RH', 'Finanças', 'Jurídico', 'Comunicação', 'Engenharia']
const TODAY = new Date().toISOString().slice(0, 10)

// ── Helpers ────────────────────────────────────────────────────────
let _seq = 0
function newId():    string { return 'new_' + (++_seq) + '_' + Math.random().toString(36).slice(2, 6) }
function newAppId(): string { return 'gres_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }
function isNew(id: string): boolean { return id.startsWith('new_') }

function monthsBetween(start: string | null, end: string | null): number {
  if (!start || !end || end < start) return 0
  const s = new Date(start), e = new Date(end)
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1)
}

function calcCost(r: DraftResource, workDays: number): number {
  const pct  = (r.allocation_pct ?? 0) / 100
  const cost = r.daily_cost ?? 0
  const mo   = monthsBetween(r.start_date, r.end_date)
  return pct * cost * workDays * mo
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
}

function fmtFte(n: number): string {
  return n.toFixed(2)
}

// ── SummaryTable ───────────────────────────────────────────────────
interface SummaryTableProps {
  resources: DraftResource[]
  workDays: number
  onRowClick: (id: string) => void
}

function SummaryTable({ resources, workDays, onRowClick }: SummaryTableProps) {
  if (resources.length === 0) return null
  return (
    <div className="gres-summary-wrap">
      <div className="gres-summary-title">Resumo de Recursos</div>
      <table className="gres-summary-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Perfil</th>
            <th>Tipo</th>
            <th className="gres-th-r">% Aloc.</th>
            <th>Período</th>
            <th className="gres-th-r">Custo Est.</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {resources.map(r => {
            const cost = calcCost(r, workDays)
            const period = r.start_date && r.end_date
              ? `${r.start_date.slice(0, 7)} → ${r.end_date.slice(0, 7)}`
              : r.start_date ? `desde ${r.start_date.slice(0, 7)}` : '—'
            const status = r.status ?? 'Activo'
            return (
              <tr key={r.id} className="gres-summary-row" onClick={() => onRowClick(r.id)}>
                <td><strong>{r.name || '—'}</strong></td>
                <td>{r.role ?? '—'}</td>
                <td>{r.type ?? '—'}</td>
                <td className="gres-td-r">{r.allocation_pct ?? 0}%</td>
                <td>{period}</td>
                <td className="gres-td-r">{cost > 0 ? fmtEur(cost) : '—'}</td>
                <td>
                  <Badge variant={status === 'Activo' ? 'green' : 'grey'}>{status}</Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── ResourceCard ───────────────────────────────────────────────────
interface ResourceCardProps {
  res: DraftResource
  people: Person[]
  contracts: FinContract[]
  profiles: string[]
  orgUnits: string[]
  workDays: number
  onChange: (patch: Partial<DraftResource>) => void
  onDelete: () => void
  onDuplicate: () => void
}

function ResourceCard({
  res, people, contracts, profiles, orgUnits, workDays,
  onChange, onDelete, onDuplicate,
}: ResourceCardProps) {
  const cost = calcCost(res, workDays)
  const isOverallocated = (res.allocation_pct ?? 0) > 100
  const dateErr = !!(res.start_date && res.end_date && res.end_date < res.start_date)
  const isExpired = !!(res.end_date && res.end_date < TODAY && res.status !== 'Inactivo')
  const isInactive = res.status === 'Inactivo'

  const handleNameChange = (val: string) => {
    onChange({ name: val })
    // Auto-fill from people catalog if exact match
    const match = people.find(p => p.name.toLowerCase().trim() === val.toLowerCase().trim())
    if (match) {
      const patch: Partial<DraftResource> = { name: val }
      if (!res.org_unit && match.org_unit) patch.org_unit = match.org_unit
      if (!res.role     && match.role)     patch.role     = match.role
      if (!res.type     && match.type)     patch.type     = match.type || 'Interno'
      onChange(patch)
    }
  }

  const datalistId = `people-dl-${res.id}`
  const profilesDlId = `profiles-dl-${res.id}`
  const unitsDlId = `units-dl-${res.id}`

  return (
    <div
      id={`res-card-${res.id}`}
      className={[
        'gres-card',
        isOverallocated ? 'gres-card--overallocated' : '',
        isInactive ? 'gres-card--inactive' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Datalists */}
      <datalist id={datalistId}>
        {people.filter(p => p.active !== false).map(p => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <datalist id={profilesDlId}>
        {profiles.map(p => <option key={p} value={p} />)}
      </datalist>
      <datalist id={unitsDlId}>
        {orgUnits.map(u => <option key={u} value={u} />)}
      </datalist>

      <div className="gres-card-body">
        {/* Main row */}
        <div className="gres-card-main">
          <div className="gres-field">
            <label className="gres-field-label">Nome</label>
            <input
              className="gres-input gres-input--name"
              list={datalistId}
              value={res.name}
              placeholder="Nome do recurso"
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>
          <div className="gres-field">
            <label className="gres-field-label">Perfil</label>
            <input
              className="gres-input"
              list={profilesDlId}
              value={res.role ?? ''}
              placeholder="Perfil"
              onChange={e => onChange({ role: e.target.value || null })}
            />
          </div>
          <div className="gres-field">
            <label className="gres-field-label">Tipo</label>
            <select
              className="gres-select"
              value={res.type ?? 'Interno'}
              onChange={e => onChange({ type: e.target.value })}
            >
              {RES_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="gres-field">
            <label className="gres-field-label">% Aloc.</label>
            <input
              className="gres-input"
              type="number"
              min={0}
              max={200}
              value={res.allocation_pct ?? 0}
              onChange={e => onChange({ allocation_pct: parseFloat(e.target.value) || 0 })}
              style={isOverallocated ? { borderColor: 'var(--red)', background: '#fff5f5' } : {}}
            />
          </div>
          <div className="gres-field">
            <label className="gres-field-label">Estado</label>
            <select
              className="gres-select"
              value={res.status ?? 'Activo'}
              onChange={e => onChange({ status: e.target.value })}
            >
              {RES_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="gres-card-actions">
            <button className="gres-icon-btn" onClick={onDuplicate} title="Duplicar">⧉</button>
            <button className="gres-icon-btn danger" onClick={onDelete} title="Eliminar">✕</button>
          </div>
        </div>

        {/* Detail row */}
        <div className={`gres-card-detail${res.type === 'Externo' ? ' gres-card-detail--contract' : ''}`}>
          <div className="gres-field">
            <label className="gres-field-label">Unidade Org.</label>
            <input
              className="gres-input"
              list={unitsDlId}
              value={res.org_unit ?? ''}
              placeholder="Unidade"
              onChange={e => onChange({ org_unit: e.target.value || null })}
            />
          </div>
          <div className="gres-field">
            <label className="gres-field-label">Custo/dia (€)</label>
            <input
              className="gres-input"
              type="number"
              min={0}
              value={res.daily_cost ?? ''}
              placeholder="0"
              onChange={e => onChange({ daily_cost: parseFloat(e.target.value) || null })}
            />
          </div>
          <div className="gres-field">
            <label className="gres-field-label">Data Início</label>
            <input
              className={`gres-input${dateErr ? ' gres-input--err' : ''}`}
              type="date"
              value={res.start_date ?? ''}
              onChange={e => onChange({ start_date: e.target.value || null })}
            />
          </div>
          <div className="gres-field">
            <label className="gres-field-label">Data Fim</label>
            <input
              className={`gres-input${dateErr ? ' gres-input--err' : ''}`}
              type="date"
              value={res.end_date ?? ''}
              onChange={e => onChange({ end_date: e.target.value || null })}
            />
          </div>
          {res.type === 'Externo' ? (
            <div className="gres-field">
              <label className="gres-field-label">Contrato</label>
              <select
                className="gres-select"
                value={res.contract_id ?? ''}
                onChange={e => onChange({ contract_id: e.target.value || null })}
              >
                <option value="">— sem contrato —</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.supplier}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="gres-field">
              <label className="gres-field-label">Tipo</label>
              <span style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>Interno</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: cost hint + inactive warning */}
      {(cost > 0 || isExpired) && (
        <div className="gres-card-footer">
          {cost > 0 && (
            <span className="gres-cost-hint">
              Custo estimado: <strong>{fmtEur(cost)}</strong>
              {` (${monthsBetween(res.start_date, res.end_date)} meses × ${workDays} dias/mês)`}
            </span>
          )}
          {isExpired && (
            <span className="gres-inactive-hint">⚠ Data fim passada — considere marcar como Inactivo</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── ImportPanel ────────────────────────────────────────────────────
interface ImportPanelProps {
  planOptions: PlanOption[]
  currentPlanKey: string
  allResources: FteResource[]
  onImport: (resources: DraftResource[]) => void
  onClose: () => void
}

function ImportPanel({ planOptions, currentPlanKey, allResources, onImport, onClose }: ImportPanelProps) {
  const [sourcePlanKey, setSourcePlanKey] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sourcePlan = useMemo(
    () => planOptions.find(p => p.key === sourcePlanKey) ?? null,
    [planOptions, sourcePlanKey])

  const sourceResources = useMemo(
    () => sourcePlan
      ? allResources.filter(r => r.pds_id === sourcePlan.id2)
      : [],
    [allResources, sourcePlan])

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const confirmImport = () => {
    const toImport = sourceResources
      .filter(r => selected.has(r.id))
      .map(r => ({ ...r, id: newId(), app_id: newAppId(), pds_id: '', start_date: null, end_date: null }))
    onImport(toImport)
    onClose()
  }

  const otherPlans = planOptions.filter(p => p.key !== currentPlanKey)

  return (
    <>
      <div className="gres-panel-overlay" onClick={onClose} />
      <div className="gres-panel">
        <div className="gres-panel-header">
          <span className="gres-panel-title">Importar de outro Plano</span>
          <button className="gres-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gres-panel-body">
          <div>
            <label className="gres-field-label" style={{ display: 'block', marginBottom: 4 }}>Plano de origem</label>
            <select
              className="gres-import-plan-select"
              value={sourcePlanKey}
              onChange={e => { setSourcePlanKey(e.target.value); setSelected(new Set()) }}
            >
              <option value="">— seleccionar plano —</option>
              {otherPlans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {sourcePlan && (
            <div className="gres-import-list">
              {sourceResources.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>
                  Sem recursos neste plano.
                </div>
              ) : (
                sourceResources.map(r => (
                  <div
                    key={r.id}
                    className={`gres-import-item${selected.has(r.id) ? ' gres-import-item--selected' : ''}`}
                    onClick={() => toggle(r.id)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={selected.has(r.id)}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="gres-import-item-name">{r.name || '(sem nome)'}</div>
                      <div className="gres-import-item-meta">
                        {r.role ?? '—'} · {r.type ?? '—'} · {r.allocation_pct ?? 0}%
                      </div>
                    </div>
                    <Badge variant={r.type === 'Externo' ? 'blue' : 'green'}>{r.type ?? 'Interno'}</Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="gres-panel-footer">
          <button
            className="gres-btn gres-btn-primary"
            onClick={confirmImport}
            disabled={selected.size === 0}
          >
            Importar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
          <button className="gres-btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function GestaoRecursos() {
  const { filters }  = useFilters()
  const programId    = filters.programIds[0] as string | undefined
  const { activities }  = useActivities({ program_id: programId })
  const { resources: dbResources, loading, refetch } = useResources(programId)
  const { people } = usePeople()
  const { contracts: dbContracts } = useFinancials(programId)

  // ── Plan options ─────────────────────────────────────────────
  const planOptions = useMemo<PlanOption[]>(() => {
    const seen = new Set<string>()
    const opts: PlanOption[] = []
    for (const a of activities) {
      if (a.level !== 2) continue
      const key = `${a.n1}|||${a.n2}`
      if (seen.has(key)) continue
      seen.add(key)
      opts.push({
        key, label: a.n1 ? `${a.n1} › ${a.n2}` : (a.n2 || '(sem nome)'),
        n0: a.n0, n1: a.n1, n2: a.n2, id0: a.id0, id1: a.id1, id2: a.id2,
        program_id: a.program_id,
      })
    }
    return opts
  }, [activities])

  const [selectedKey, setSelectedKey] = useState('')
  useEffect(() => { setSelectedKey('') }, [programId])
  useEffect(() => {
    if (!selectedKey && planOptions.length > 0) setSelectedKey(planOptions[0].key)
  }, [planOptions, selectedKey])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey])

  // ── Working days ─────────────────────────────────────────────
  const [workDays, setWorkDays] = useState(22)

  // ── AppConfig: profiles + org units ─────────────────────────
  const [profiles, setProfiles] = useState<string[]>(DEFAULT_PROFILES)
  const [orgUnits, setOrgUnits] = useState<string[]>(DEFAULT_UNITS)

  useEffect(() => {
    supabase.from('app_config')
      .select('config_key, data')
      .in('config_key', ['res_perfis', 'res_unidades'])
      .then(({ data }) => {
        if (!data) return
        for (const row of data) {
          const vals = (row.data as Record<string, unknown>).values
          if (!Array.isArray(vals)) continue
          const strs = (vals as unknown[]).filter(v => typeof v === 'string') as string[]
          if (row.config_key === 'res_perfis'   && strs.length > 0) setProfiles(strs)
          if (row.config_key === 'res_unidades' && strs.length > 0) setOrgUnits(strs)
        }
      })
  }, [])

  // ── Draft state ──────────────────────────────────────────────
  const [draft,    setDraft]    = useState<DraftResource[]>([])
  const [committed, setCommitted] = useState<DraftResource[]>([])
  const [deleted,  setDeleted]  = useState<Set<string>>(new Set())

  useEffect(() => {
    if (loading) return
    const pdsId = selectedPlan?.id2
    const planResources = dbResources.filter(r => r.pds_id === pdsId)
    setDraft(planResources)
    setCommitted(planResources)
    setDeleted(new Set())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.id2, loading, dbResources])

  const isDirty = useMemo(() =>
    JSON.stringify(draft) !== JSON.stringify(committed) || deleted.size > 0,
    [draft, committed, deleted])

  // ── Resource CRUD ────────────────────────────────────────────
  const updateResource = useCallback((id: string, patch: Partial<DraftResource>) => {
    setDraft(d => d.map(r => r.id === id ? { ...r, ...patch } : r))
  }, [])

  const addResource = useCallback(() => {
    if (!selectedPlan) return
    const id = newId()
    setDraft(d => [...d, {
      id, pds_id: selectedPlan.id2, app_id: newAppId(), program_id: selectedPlan.program_id,
      name: '', org_unit: null, role: null, type: 'Interno', daily_cost: null,
      id2: selectedPlan.id2, start_date: null, end_date: null,
      allocation_pct: 100, contract_id: null, status: 'Activo', sort_order: null,
    }])
  }, [selectedPlan])

  const deleteResource = useCallback((id: string) => {
    setDraft(d => d.filter(r => r.id !== id))
    if (!isNew(id)) setDeleted(prev => new Set([...prev, id]))
  }, [])

  const duplicateResource = useCallback((id: string) => {
    setDraft(d => {
      const src = d.find(r => r.id === id)
      if (!src) return d
      return [...d, { ...src, id: newId(), app_id: newAppId(), start_date: null, end_date: null }]
    })
  }, [])

  // ── Import panel ─────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false)

  const handleImport = useCallback((imported: DraftResource[]) => {
    if (!selectedPlan) return
    setDraft(d => [
      ...d,
      ...imported.map(r => ({ ...r, pds_id: selectedPlan.id2, program_id: selectedPlan.program_id, id2: selectedPlan.id2 })),
    ])
  }, [selectedPlan])

  // ── Contracts for selected plan ───────────────────────────────
  const planContracts = useMemo<FinContract[]>(() =>
    selectedPlan ? dbContracts.filter(c => c.pds_id === selectedPlan.id2) : [],
    [dbContracts, selectedPlan])

  // ── KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active     = draft.filter(r => (r.status ?? 'Activo') === 'Activo')
    const ftTotal    = active.reduce((s, r) => s + (r.allocation_pct ?? 0) / 100, 0)
    const costTotal  = draft.reduce((s, r) => s + calcCost(r, workDays), 0)
    const overAlloc  = draft.filter(r => (r.allocation_pct ?? 0) > 100).length
    return { active: active.length, ftTotal, costTotal, overAlloc }
  }, [draft, workDays])

  // ── Save ─────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState<string | null>(null)
  const [toast,     setToast]     = useState('')
  const [conflicts, setConflicts] = useState<string[]>([])

  const handleSave = useCallback(async () => {
    if (saving || !selectedPlan || !isDirty) return

    // Date validation
    const dateErrors = draft.filter(r => r.start_date && r.end_date && r.end_date < r.start_date)
    if (dateErrors.length > 0) {
      setSaveErr(`${dateErrors.length} recurso(s) com datas inválidas (fim < início).`)
      return
    }

    setSaving(true)
    setSaveErr(null)
    setConflicts([])

    const pdsId  = selectedPlan.id2
    const progId = selectedPlan.program_id

    try {
      const existRows = draft.filter(r => !isNew(r.id))
      const newRows   = draft.filter(r => isNew(r.id))
      const delArr    = Array.from(deleted)

      const ops: Promise<unknown>[] = []

      const makePayload = (r: DraftResource, idx?: number) => ({
        pds_id: pdsId, app_id: r.app_id, program_id: progId,
        name: r.name, org_unit: r.org_unit, role: r.role, type: r.type,
        daily_cost: r.daily_cost, id2: r.id2 ?? pdsId,
        start_date: r.start_date, end_date: r.end_date,
        allocation_pct: r.allocation_pct, contract_id: r.contract_id,
        status: r.status, sort_order: idx ?? r.sort_order,
      })

      if (existRows.length)
        ops.push(supabase.from('fte_resources').upsert(
          existRows.map(r => ({ id: r.id, ...makePayload(r) })),
          { onConflict: 'id' }).then(res => { if (res.error) throw res.error }))

      if (delArr.length)
        ops.push(supabase.from('fte_resources').delete().in('id', delArr)
          .then(res => { if (res.error) throw res.error }))

      let insertedRows: FteResource[] = []
      if (newRows.length)
        ops.push(supabase.from('fte_resources')
          .insert(newRows.map((r, idx) => makePayload(r, existRows.length + idx)))
          .select()
          .then(res => { if (res.error) throw res.error; insertedRows = (res.data ?? []) as FteResource[] }))

      await Promise.all(ops)

      // Patch draft with real IDs
      const finalDraft: DraftResource[] = [
        ...existRows,
        ...newRows.map((r, i) => insertedRows[i] ?? r),
      ]
      setDraft(finalDraft)
      setCommitted(finalDraft)
      setDeleted(new Set())

      // Cross-plan conflict check
      refetch()
      const conflictNames: string[] = []
      const savedNames = new Set(finalDraft.map(r => r.name.toLowerCase().trim()).filter(Boolean))
      for (const savedName of savedNames) {
        const others = dbResources.filter(r =>
          r.pds_id !== pdsId &&
          r.name.toLowerCase().trim() === savedName
        )
        const totalPct = finalDraft
          .filter(r => r.name.toLowerCase().trim() === savedName)
          .reduce((s, r) => s + (r.allocation_pct ?? 0), 0)
          + others.reduce((s, r) => s + (r.allocation_pct ?? 0), 0)
        if (totalPct > 100) {
          conflictNames.push(finalDraft.find(r => r.name.toLowerCase().trim() === savedName)?.name ?? savedName)
        }
      }
      setConflicts(conflictNames)
      setToast('Guardado!')
      setTimeout(() => setToast(''), 3000)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [saving, selectedPlan, isDirty, draft, deleted, dbResources, refetch])

  // ── Scroll to card ───────────────────────────────────────────
  const scrollToCard = (id: string) => {
    document.getElementById(`res-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ── Render ───────────────────────────────────────────────────
  const noProgram = !programId
  const noPlans   = !noProgram && planOptions.length === 0

  return (
    <div className="gres-page">
      {/* Controls bar */}
      <div className="gres-controls-bar">
        <label className="gres-label">Plano:</label>
        <select
          className="gres-plan-select"
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          disabled={noProgram || noPlans}
        >
          {noProgram  ? <option value="">— selecciona um programa —</option>
           : noPlans  ? <option value="">— sem planos disponíveis —</option>
           : planOptions.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span className="gres-label" style={{ marginLeft: 8 }}>Dias úteis/mês:</span>
        <input
          className="gres-days-input"
          type="number"
          min={1}
          max={31}
          value={workDays}
          onChange={e => setWorkDays(parseInt(e.target.value) || 22)}
        />
        <div className="gres-spacer" />
        {saveErr    && <span className="gres-save-err">{saveErr}</span>}
        {toast      && <span className="gres-toast">{toast}</span>}
        {conflicts.length > 0 && (
          <span className="gres-warn">⚠ Sobrealocação: {conflicts.join(', ')}</span>
        )}
        <button
          className="gres-btn"
          onClick={() => setShowImport(true)}
          disabled={!selectedPlan}
        >
          Importar de outro plano
        </button>
        <button
          className="gres-btn gres-btn-save"
          onClick={handleSave}
          disabled={!selectedPlan || !isDirty || saving}
        >
          {saving ? 'A guardar…' : isDirty ? 'Guardar alterações' : 'Guardar'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>A carregar…</div>
      ) : noProgram ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Selecciona um programa para gerir recursos.
        </div>
      ) : noPlans ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Nenhum plano disponível para este programa.
        </div>
      ) : !selectedPlan ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Selecciona um plano para gerir recursos.
        </div>
      ) : (
        <>
          {/* Plan header bar */}
          <div className="gres-header-bar">
            <span>{selectedPlan.n1}</span>
            {selectedPlan.n1 && <span className="sep">›</span>}
            <span>{selectedPlan.n2}</span>
          </div>

          {/* KPI row */}
          <div className="gres-kpi-row">
            <KpiCard label="Recursos Activos"   value={kpis.active}              color="navy" />
            <KpiCard label="FTE Total"           value={fmtFte(kpis.ftTotal)}    color="blue" />
            <KpiCard label="Custo Estimado"      value={fmtEur(kpis.costTotal)}  color="text" />
            <KpiCard
              label="Sobrealocações"
              value={kpis.overAlloc}
              color={kpis.overAlloc > 0 ? 'red' : 'green'}
              subtitle={kpis.overAlloc > 0 ? 'recursos > 100%' : 'sem conflitos'}
            />
          </div>

          {/* Summary table */}
          {draft.length > 0 && (
            <SummaryTable
              resources={draft}
              workDays={workDays}
              onRowClick={scrollToCard}
            />
          )}

          {/* Cards section */}
          <div className="gres-cards-section">
            <div className="gres-cards-toolbar">
              <span className="gres-cards-title">Recursos Alocados ({draft.length})</span>
              <button className="gres-btn gres-btn-primary" onClick={addResource}>+ Adicionar Recurso</button>
            </div>

            {draft.length === 0 ? (
              <div className="gres-empty">
                Sem recursos alocados. Clica em + Adicionar Recurso para começar.
              </div>
            ) : (
              draft.map(res => (
                <ResourceCard
                  key={res.id}
                  res={res}
                  people={people}
                  contracts={planContracts}
                  profiles={profiles}
                  orgUnits={orgUnits}
                  workDays={workDays}
                  onChange={patch => updateResource(res.id, patch)}
                  onDelete={() => deleteResource(res.id)}
                  onDuplicate={() => duplicateResource(res.id)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Import panel */}
      {showImport && (
        <ImportPanel
          planOptions={planOptions}
          currentPlanKey={selectedKey}
          allResources={dbResources}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
