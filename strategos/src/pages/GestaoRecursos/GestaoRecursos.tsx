import './GestaoRecursos.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useToast } from '../../context/ToastContext'
import Spinner from '../../components/Spinner/Spinner'
import EmptyState from '../../components/EmptyState/EmptyState'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { usePlanos } from '../../hooks/usePlanos'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { useResources } from '../../hooks/useResources'
import { usePeople } from '../../hooks/usePeople'
import { useFinancials } from '../../hooks/useFinancials'
import KpiCard from '../../components/KpiCard/KpiCard'
import Badge from '../../components/Badge/Badge'
import Modal from '../../components/Modal/Modal'
import type { FteResource, Person, FinContract } from '../../types/index'
import { useCanEditCurrent } from '../../hooks/useCanEditCurrent'
import { usePermissions } from '../../hooks/usePermissions'

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

interface ResourceForm {
  id: string | null
  person_id: string | null
  name: string
  role: string
  org_unit: string
  type: string
  allocation_pct: string
  daily_cost: string
  start_date: string
  end_date: string
  status: string
  contract_id: string
}

// ── Constants ──────────────────────────────────────────────────────
const RES_TYPES    = ['Interno', 'Externo']
const RES_STATUSES = ['Activo', 'Inactivo']
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

function fmtEur(n: number, sym = '€'): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ' + sym
}

function fmtFte(n: number): string {
  return n.toFixed(2)
}

// ── SummaryTable ───────────────────────────────────────────────────
interface SummaryTableProps {
  resources: DraftResource[]
  workDays: number
  onRowClick: (id: string) => void
  sym: string
  showCosts: boolean
}

function SummaryTable({ resources, workDays, onRowClick, sym, showCosts }: SummaryTableProps) {
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
            {showCosts && <th className="gres-th-r">Custo Est.</th>}
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
                {showCosts && <td className="gres-td-r">{cost > 0 ? fmtEur(cost, sym) : '—'}</td>}
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

// ── ResourceCard (read-only) ───────────────────────────────────────
interface ResourceCardProps {
  res: DraftResource
  contracts: FinContract[]
  workDays: number
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  sym: string
  readOnly: boolean
  showCosts: boolean
}

function ResourceCard({ res, contracts, workDays, onEdit, onDelete, onDuplicate, sym, readOnly, showCosts }: ResourceCardProps) {
  const cost = calcCost(res, workDays)
  const isOverallocated = (res.allocation_pct ?? 0) > 100
  const dateErr = !!(res.start_date && res.end_date && res.end_date < res.start_date)
  const isExpired = !!(res.end_date && res.end_date < TODAY && res.status !== 'Inactivo')
  const isInactive = res.status === 'Inactivo'
  const linkedContract = contracts.find(c => c.id === res.contract_id)
  const status = res.status ?? 'Activo'

  const period = res.start_date && res.end_date
    ? `${res.start_date.slice(0, 7)} → ${res.end_date.slice(0, 7)}`
    : res.start_date ? `desde ${res.start_date.slice(0, 7)}` : '—'

  return (
    <div
      id={`res-card-${res.id}`}
      className={[
        'gres-card',
        isOverallocated ? 'gres-card--overallocated' : '',
        isInactive ? 'gres-card--inactive' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="gres-card-body">
        {/* Main row */}
        <div className="gres-card-main">
          <div className="gres-field">
            <span className="gres-field-label">Nome</span>
            <strong style={{ fontSize: 13 }}>{res.name || <span style={{ color: 'var(--text3)' }}>—</span>}</strong>
            {res.person_id
              ? <span className="gr-person-linked-chip">🔗 Catálogo</span>
              : <span className="gr-person-unlinked-chip">Não ligado</span>
            }
          </div>
          <div className="gres-field">
            <span className="gres-field-label">Perfil</span>
            <span style={{ fontSize: 12 }}>{res.role ?? '—'}</span>
          </div>
          <div className="gres-field">
            <span className="gres-field-label">Tipo</span>
            <span style={{ fontSize: 12 }}>{res.type ?? '—'}</span>
          </div>
          <div className="gres-field">
            <span className="gres-field-label">% Aloc.</span>
            <span style={{ fontSize: 12, color: isOverallocated ? 'var(--red)' : undefined, fontWeight: isOverallocated ? 700 : undefined }}>
              {res.allocation_pct ?? 0}%
            </span>
          </div>
          <div className="gres-field">
            <span className="gres-field-label">Estado</span>
            <Badge variant={status === 'Activo' ? 'green' : 'grey'}>{status}</Badge>
          </div>
          {!readOnly && (
            <div className="gres-card-actions">
              <button className="gres-icon-btn" onClick={onEdit} title="Editar" style={{ fontSize: 14 }}>✎</button>
              <button className="gres-icon-btn" onClick={onDuplicate} title="Duplicar">⧉</button>
              <button className="gres-icon-btn danger" onClick={onDelete} title="Eliminar">✕</button>
            </div>
          )}
        </div>

        {/* Detail row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div className="gres-field">
            <span className="gres-field-label">Unidade Org.</span>
            <span style={{ fontSize: 12 }}>{res.org_unit ?? '—'}</span>
          </div>
          {showCosts && (
            <div className="gres-field">
              <span className="gres-field-label">Custo/dia</span>
              <span style={{ fontSize: 12 }}>{res.daily_cost != null ? fmtEur(res.daily_cost, sym) : '—'}</span>
            </div>
          )}
          <div className="gres-field">
            <span className="gres-field-label">Período</span>
            <span style={{ fontSize: 12 }}>{period}</span>
          </div>
          {res.type === 'Externo' && (
            <div className="gres-field">
              <span className="gres-field-label">Contrato</span>
              <span style={{ fontSize: 12 }}>{linkedContract?.supplier ?? '—'}</span>
            </div>
          )}
        </div>
      </div>

      {(showCosts && cost > 0 || isExpired || dateErr) && (
        <div className="gres-card-footer">
          {showCosts && cost > 0 && (
            <span className="gres-cost-hint">
              Custo estimado: <strong>{fmtEur(cost, sym)}</strong>
              {` (${monthsBetween(res.start_date, res.end_date)} meses × ${workDays} dias/mês)`}
            </span>
          )}
          {isExpired && <span className="gres-inactive-hint">⚠ Data fim passada — considere marcar como Inactivo</span>}
          {dateErr && <span className="gres-inactive-hint">⚠ Data fim anterior a data início</span>}
        </div>
      )}
    </div>
  )
}

// ── PersonAutocomplete ─────────────────────────────────────────
function PersonAutocomplete({ value, personId, people, onNameChange, onSelect, onPersonCreated }: {
  value: string
  personId: string | null
  people: Person[]
  onNameChange: (name: string) => void
  onSelect: (p: Person) => void
  onPersonCreated: (id: string, name: string) => void
}) {
  const { showToast } = useToast()
  const [open, setOpen]               = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [creating, setCreating]       = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activePeople = useMemo(() => people.filter(p => p.active !== false), [people])

  const suggestions = useMemo(() => {
    const q = value.toLowerCase().trim()
    return q.length === 0
      ? activePeople.slice(0, 10)
      : activePeople.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10)
  }, [activePeople, value])

  const exactMatch = useMemo(
    () => activePeople.find(p => p.name.toLowerCase().trim() === value.toLowerCase().trim()),
    [activePeople, value]
  )

  const q           = value.toLowerCase().trim()
  const showCreate  = q.length > 0 && !exactMatch
  const showDupWarn = !personId && q.length > 0 && !exactMatch && suggestions.length > 0
  const totalItems  = suggestions.length + (showCreate ? 1 : 0)

  const closeDropdown = useCallback(() => { setOpen(false); setHighlighted(-1) }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [closeDropdown])

  const handleCreate = useCallback(async () => {
    const name = value.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('people')
        .insert({ name, active: true })
        .select('id, name')
        .single()
      if (error) throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any
      onPersonCreated(row.id as string, row.name as string)
      showToast(`"${row.name as string}" adicionado ao catálogo.`)
      closeDropdown()
    } catch (e) {
      console.error('Create person:', e)
    } finally {
      setCreating(false)
    }
  }, [value, creating, onPersonCreated, showToast, closeDropdown])

  const pickPerson = useCallback((p: Person) => {
    onSelect(p)
    closeDropdown()
  }, [onSelect, closeDropdown])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); setHighlighted(0); e.preventDefault() }
      return
    }
    if (e.key === 'Escape') { closeDropdown(); e.preventDefault() }
    else if (e.key === 'ArrowDown') { setHighlighted(h => (h + 1) % totalItems); e.preventDefault() }
    else if (e.key === 'ArrowUp')   { setHighlighted(h => (h - 1 + totalItems) % totalItems); e.preventDefault() }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted < 0) return
      if (showCreate && highlighted === 0) { void handleCreate(); return }
      const idx = showCreate ? highlighted - 1 : highlighted
      if (suggestions[idx]) pickPerson(suggestions[idx])
    }
  }

  const hasDropdown = open && (suggestions.length > 0 || showCreate)

  return (
    <div className="gr-person-autocomplete" ref={containerRef}>
      <div style={{ position: 'relative' }}>
        <input
          className="gres-form-input gr-person-input"
          value={value}
          placeholder="Nome do recurso"
          autoComplete="off"
          onChange={e => { onNameChange(e.target.value); setOpen(true); setHighlighted(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {personId && <span className="gr-person-linked-icon" title="Ligado ao catálogo">🔗</span>}
      </div>

      {hasDropdown && (
        <div className="gr-person-suggestions">
          {showCreate && (
            <div
              className={`gr-person-suggestion gr-person-create${highlighted === 0 ? ' highlighted' : ''}`}
              onMouseDown={e => { e.preventDefault(); void handleCreate() }}
              onMouseEnter={() => setHighlighted(0)}
            >
              {creating ? 'A criar…' : `+ Criar "${value.trim()}" no catálogo`}
            </div>
          )}
          {suggestions.map((p, i) => {
            const idx  = showCreate ? i + 1 : i
            const meta = [p.role, p.org_unit].filter(Boolean).join(' · ')
            return (
              <div
                key={p.id}
                className={`gr-person-suggestion${highlighted === idx ? ' highlighted' : ''}`}
                onMouseDown={e => { e.preventDefault(); pickPerson(p) }}
                onMouseEnter={() => setHighlighted(idx)}
              >
                <div className="gr-person-sug-name">{p.name}</div>
                {(meta || p.type) && (
                  <div className="gr-person-sug-meta">
                    {meta && <span>{meta}</span>}
                    {p.type && (
                      <span className={`gr-person-badge ${p.type === 'Externo' ? 'ext' : 'int'}`}>{p.type}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showDupWarn && (
        <div className="gr-person-duplicate-warn">
          ⚠ Nome semelhante encontrado — selecciona da lista para ligar ao catálogo
        </div>
      )}
    </div>
  )
}

// ── ResourceModalBody ──────────────────────────────────────────────
function ResourceModalBody({ form, setForm, people, contracts, profiles, orgUnits, sym, showCosts }: {
  form: ResourceForm
  setForm: (f: ResourceForm) => void
  people: Person[]
  contracts: FinContract[]
  profiles: string[]
  orgUnits: string[]
  sym: string
  showCosts: boolean
}) {
  const set = (patch: Partial<ResourceForm>) => setForm({ ...form, ...patch })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="gres-form-field">
        <label className="gres-form-label">Nome</label>
        <PersonAutocomplete
          value={form.name}
          personId={form.person_id}
          people={people}
          onNameChange={name => set({ name, person_id: null })}
          onSelect={p => set({
            name: p.name, person_id: p.id,
            role: form.role || p.role || '',
            org_unit: form.org_unit || p.org_unit || '',
            type: p.type || form.type || 'Interno',
          })}
          onPersonCreated={(id, name) => set({ name, person_id: id })}
        />
      </div>
      <div className="gres-form-row">
        <div className="gres-form-field">
          <label className="gres-form-label">Perfil</label>
          {profiles.length > 0 ? (
            <select className="styled-select-sm" value={form.role}
              onChange={e => set({ role: e.target.value })}>
              <option value="">— perfil —</option>
              {profiles.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <input className="gres-form-input" value={form.role}
              onChange={e => set({ role: e.target.value })} placeholder="Perfil" />
          )}
        </div>
        <div className="gres-form-field">
          <label className="gres-form-label">Unidade Org.</label>
          {orgUnits.length > 0 ? (
            <select className="styled-select-sm" value={form.org_unit}
              onChange={e => set({ org_unit: e.target.value })}>
              <option value="">— unidade —</option>
              {orgUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <input className="gres-form-input" value={form.org_unit}
              onChange={e => set({ org_unit: e.target.value })} placeholder="Unidade Org." />
          )}
        </div>
      </div>
      <div className="gres-form-row">
        <div className="gres-form-field">
          <label className="gres-form-label">Tipo</label>
          <select className="styled-select-sm" value={form.type}
            onChange={e => set({ type: e.target.value })}>
            {RES_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="gres-form-field">
          <label className="gres-form-label">% Alocação</label>
          <input className="gres-form-input" type="number" min={0} max={200}
            value={form.allocation_pct}
            onChange={e => set({ allocation_pct: e.target.value })} />
        </div>
      </div>
      <div className="gres-form-row">
        {showCosts && (
          <div className="gres-form-field">
            <label className="gres-form-label">Custo/Dia ({sym})</label>
            <input className="gres-form-input" type="number" min={0}
              value={form.daily_cost}
              onChange={e => set({ daily_cost: e.target.value })} placeholder="0" />
          </div>
        )}
        <div className="gres-form-field">
          <label className="gres-form-label">Estado</label>
          <select className="styled-select-sm" value={form.status}
            onChange={e => set({ status: e.target.value })}>
            {RES_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="gres-form-row">
        <div className="gres-form-field">
          <label className="gres-form-label">Data Início</label>
          <input className="gres-form-input" type="date" value={form.start_date}
            onChange={e => set({ start_date: e.target.value })} />
        </div>
        <div className="gres-form-field">
          <label className="gres-form-label">Data Fim</label>
          <input className="gres-form-input" type="date" value={form.end_date}
            onChange={e => set({ end_date: e.target.value })} />
        </div>
      </div>
      {form.type === 'Externo' && (
        <div className="gres-form-field">
          <label className="gres-form-label">Contrato</label>
          <select className="styled-select-sm" value={form.contract_id}
            onChange={e => set({ contract_id: e.target.value })}>
            <option value="">— sem contrato —</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.supplier}</option>)}
          </select>
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
      ? allResources.filter(r => r.pds_id === sourcePlan.key)
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
          <button className="btn" onClick={onClose}>✕</button>
        </div>
        <div className="gres-panel-body">
          <div>
            <label className="gres-field-label" style={{ display: 'block', marginBottom: 4 }}>Plano de origem</label>
            <select
              className="styled-select-sm"
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
            className="btn-primary"
            onClick={confirmImport}
            disabled={selected.size === 0}
          >
            Importar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
          <button className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────
interface GestaoRecursosProps {
  mode?: 'standalone' | 'embedded'
  planoId?: string
  programId?: string
}

export default function GestaoRecursos({
  mode = 'standalone',
  planoId: propPlanoId,
  programId: propProgramId,
}: GestaoRecursosProps = {}) {
  const { showToast } = useToast()
  const { filters }  = useFilters()
  const programs = useAccessiblePrograms('gestao-recursos')
  const [selProgId, setSelProgId] = useState<string>('')
  const readOnly = !useCanEditCurrent('gestao-recursos')
  const { canViewCosts } = usePermissions()

  // Initialise from global filter or first available program (once)

  useEffect(() => {
    if (mode === 'embedded') return
    if (selProgId) return
    const init = filters.programIds[0] ?? programs[0]?.id
    if (init) setSelProgId(init)
  }, [programs]) // eslint-disable-line react-hooks/exhaustive-deps

  const programId = mode === 'embedded' ? propProgramId : (selProgId || undefined)
  const showCosts = canViewCosts('gestao-recursos', programId)

  const { planos, loading: planosLoading } = usePlanos(programId)
  const { resources: dbResources, loading: resLoading, refetch } = useResources(programId)
  const loading = resLoading || planosLoading
  const { people } = usePeople()
  const { contracts: dbContracts } = useFinancials(programId)

  // ── Plan options from planos table ───────────────────────────
  const planOptions = useMemo<PlanOption[]>(() =>
    planos.map(p => {
      const eixoName = p.eixo?.name ?? ''
      return {
        key: p.id, label: eixoName ? `${eixoName} › ${p.name}` : p.name,
        n0: '', n1: eixoName, n2: p.name, id0: '', id1: p.eixo?.code ?? '', id2: p.code,
        program_id: p.program_id,
      }
    }),
    [planos]
  )

  const [selectedKey, setSelectedKey] = useState('')
  useEffect(() => {
    if (mode === 'embedded') return
    setSelectedKey('')
  }, [programId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === 'embedded') {
      if (propPlanoId) setSelectedKey(propPlanoId)
      return
    }
    if (planOptions.length === 0) return
    if (planOptions.some(p => p.key === selectedKey)) return
    setSelectedKey(planOptions[0].key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOptions, propPlanoId])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey])

  // ── Working days ─────────────────────────────────────────────
  const [workDays, setWorkDays] = useState(22)

  // ── AppConfig: profiles + org units ─────────────────────────
  const [profiles,   setProfiles]   = useState<string[]>([])
  const [orgUnits,   setOrgUnits]   = useState<string[]>([])
  const [currSymbol, setCurrSymbol] = useState('€')

  useEffect(() => {
    supabase.from('app_config')
      .select('config_key, data')
      .in('config_key', ['resource_profiles', 'org_units'])
      .then(({ data }) => {
        if (!data) return
        for (const row of data) {
          const strs = JSON.parse(row.data as string) as string[]
          if (!Array.isArray(strs)) continue
          if (row.config_key === 'resource_profiles') setProfiles(strs)
          if (row.config_key === 'org_units')         setOrgUnits(strs)
        }
      })
  }, [])

  // Fetch default currency symbol
  useEffect(() => {
    supabase.from('currencies').select('symbol').eq('is_default', true).limit(1)
      .then(({ data }) => { if (data?.[0]?.symbol) setCurrSymbol(data[0].symbol) })
  }, [])

  // ── Draft state ──────────────────────────────────────────────
  const [draft,    setDraft]    = useState<DraftResource[]>([])
  const [committed, setCommitted] = useState<DraftResource[]>([])
  const [deleted,  setDeleted]  = useState<Set<string>>(new Set())

  useEffect(() => {
    if (loading) return
    const pdsId = selectedPlan?.key
    const planResources = dbResources.filter(r => r.pds_id === pdsId)
    setDraft(planResources)
    setCommitted(planResources)
    setDeleted(new Set())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.key, loading, dbResources])

  const isDirty = useMemo(() =>
    JSON.stringify(draft) !== JSON.stringify(committed) || deleted.size > 0,
    [draft, committed, deleted])

  // ── Resource CRUD ────────────────────────────────────────────
  const updateResource = useCallback((id: string, patch: Partial<DraftResource>) => {
    setDraft(d => d.map(r => r.id === id ? { ...r, ...patch } : r))
  }, [])

  // ── Resource modal ───────────────────────────────────────
  const [resourceModal, setResourceModal] = useState<ResourceForm | null>(null)
  const [resModalErr,   setResModalErr]   = useState<string | null>(null)

  const openNewResource = useCallback(() => {
    if (!selectedPlan) return
    setResModalErr(null)
    setResourceModal({
      id: null, person_id: null, name: '', role: '', org_unit: '', type: 'Interno',
      allocation_pct: '100', daily_cost: '', start_date: '', end_date: '',
      status: 'Activo', contract_id: '',
    })
  }, [selectedPlan])

  const openEditResource = useCallback((id: string) => {
    const r = draft.find(x => x.id === id)
    if (!r) return
    setResModalErr(null)
    setResourceModal({
      id: r.id,
      person_id: r.person_id ?? null,
      name: r.name ?? '',
      role: r.role ?? '',
      org_unit: r.org_unit ?? '',
      type: r.type ?? 'Interno',
      allocation_pct: String(r.allocation_pct ?? 100),
      daily_cost: r.daily_cost != null ? String(r.daily_cost) : '',
      start_date: r.start_date ?? '',
      end_date: r.end_date ?? '',
      status: r.status ?? 'Activo',
      contract_id: r.contract_id ?? '',
    })
  }, [draft])

  const confirmResource = useCallback(() => {
    if (!resourceModal) return
    const f = resourceModal
    const allocPct = parseFloat(f.allocation_pct)
    if (!f.name.trim()) { setResModalErr('Nome é obrigatório.'); return }
    if (isNaN(allocPct) || allocPct < 0) { setResModalErr('% Alocação inválida.'); return }
    const patch: Partial<DraftResource> = {
      name: f.name.trim(),
      person_id: f.person_id,
      role: f.role || null,
      org_unit: f.org_unit || null,
      type: f.type || 'Interno',
      allocation_pct: allocPct,
      daily_cost: f.daily_cost !== '' ? parseFloat(f.daily_cost) : null,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      status: f.status || 'Activo',
      contract_id: f.contract_id || null,
    }
    if (f.id) {
      updateResource(f.id, patch)
    } else {
      if (!selectedPlan) return
      const id = newId()
      setDraft(d => [...d, {
        id, pds_id: selectedPlan.key, app_id: newAppId(), program_id: selectedPlan.program_id,
        name: patch.name!, org_unit: patch.org_unit ?? null, role: patch.role ?? null,
        type: patch.type!, daily_cost: patch.daily_cost ?? null, id2: selectedPlan.id2,
        start_date: patch.start_date ?? null, end_date: patch.end_date ?? null,
        allocation_pct: patch.allocation_pct!, contract_id: patch.contract_id ?? null,
        person_id: patch.person_id ?? null,
        status: patch.status!, sort_order: null,
      }])
    }
    setResourceModal(null)
  }, [resourceModal, selectedPlan, updateResource, setDraft])

  const deleteResource = useCallback((id: string) => {
    setDraft(d => d.filter(r => r.id !== id))
    if (!isNew(id)) setDeleted(prev => new Set([...prev, id]))
  }, [])

  const deleteFromModal = useCallback(() => {
    if (!resourceModal?.id) return
    deleteResource(resourceModal.id)
    setResourceModal(null)
  }, [resourceModal, deleteResource])

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
      ...imported.map(r => ({ ...r, pds_id: selectedPlan.key, program_id: selectedPlan.program_id, id2: selectedPlan.id2 })),
    ])
  }, [selectedPlan])

  // ── Contracts for selected plan ───────────────────────────────
  const planContracts = useMemo<FinContract[]>(() =>
    selectedPlan ? dbContracts.filter(c => c.pds_id === selectedPlan.key) : [],
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

    const pdsId  = selectedPlan.key
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
        person_id: r.person_id ?? null,
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
      showToast('Guardado!')
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [saving, selectedPlan, isDirty, draft, deleted, dbResources, refetch])

  // ── Render ───────────────────────────────────────────────────
  const noProgram = mode === 'embedded' ? false : !programId
  const noPlans   = mode === 'embedded' ? false : (!noProgram && !planosLoading && planOptions.length === 0)

  return (
    <div className="gres-page">
      {/* Controls bar */}
      {mode === 'standalone' ? (
        <div className="gres-controls-bar">
          {programs.length > 1 && (
            <>
              <label className="gres-label">Programa:</label>
              <select
                className="styled-select"
                value={selProgId}
                onChange={e => { setSelProgId(e.target.value); setSelectedKey('') }}
              >
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
          <label className="gres-label">Plano:</label>
          <select
            className="styled-select"
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
          {conflicts.length > 0 && (
            <span className="gres-warn">⚠ Sobrealocação: {conflicts.join(', ')}</span>
          )}
          {!readOnly && (
            <>
              <button
                className="btn"
                onClick={() => setShowImport(true)}
                disabled={!selectedPlan}
              >
                Importar de outro plano
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={!selectedPlan || !isDirty || saving}
              >
                {saving ? 'A guardar…' : isDirty ? 'Guardar alterações' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="gres-controls-bar">
          <span className="gres-label">Dias úteis/mês:</span>
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
          {conflicts.length > 0 && (
            <span className="gres-warn">⚠ Sobrealocação: {conflicts.join(', ')}</span>
          )}
          {!readOnly && (
            <>
              <button
                className="btn"
                onClick={() => setShowImport(true)}
                disabled={!selectedPlan}
              >
                Importar de outro plano
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={!selectedPlan || !isDirty || saving}
              >
                {saving ? 'A guardar…' : isDirty ? 'Guardar alterações' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner />
        </div>
      ) : noProgram ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Selecciona um programa para gerir recursos.
        </div>
      ) : noPlans ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Nenhum plano disponível para este programa.
        </div>
      ) : (!selectedPlan && mode === 'standalone') ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Selecciona um plano para gerir recursos.
        </div>
      ) : (
        <>
          {/* Plan header bar */}
          {mode === 'standalone' && (
            <div className="gres-header-bar">
              <span>{selectedPlan.n1}</span>
              {selectedPlan.n1 && <span className="sep">›</span>}
              <span>{selectedPlan.n2}</span>
            </div>
          )}

          {/* KPI row */}
          <div className="gres-kpi-row">
            <KpiCard label="Recursos Activos"   value={kpis.active}              color="navy" />
            <KpiCard label="FTE Total"           value={fmtFte(kpis.ftTotal)}    color="blue" />
            {showCosts && <KpiCard label="Custo Estimado" value={fmtEur(kpis.costTotal, currSymbol)} color="text" />}
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
              onRowClick={openEditResource}
              sym={currSymbol}
              showCosts={showCosts}
            />
          )}

          {/* Cards section */}
          <div className="gres-cards-section">
            <div className="gres-cards-toolbar">
              <span className="gres-cards-title">Recursos Alocados ({draft.length})</span>
              {!readOnly && <button className="btn-primary" onClick={openNewResource}>+ Adicionar Recurso</button>}
            </div>

            {draft.length === 0 ? (
              <EmptyState
                icon="list"
                title="Sem recursos alocados"
                description="Clica em + Adicionar Recurso para começar a alocar recursos a este plano."
                {...(!readOnly && { actionLabel: '+ Adicionar Recurso', onAction: openNewResource })}
              />
            ) : (
              draft.map(res => (
                <ResourceCard
                  key={res.id}
                  res={res}
                  contracts={planContracts}
                  workDays={workDays}
                  onEdit={() => openEditResource(res.id)}
                  onDelete={() => deleteResource(res.id)}
                  onDuplicate={() => duplicateResource(res.id)}
                  sym={currSymbol}
                  readOnly={readOnly}
                  showCosts={showCosts}
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

      {/* Resource modal */}
      <Modal
        isOpen={!!resourceModal}
        onClose={() => setResourceModal(null)}
        title={resourceModal?.id ? 'Editar Recurso' : 'Novo Recurso'}
        width={500}
        footer={
          <>
            {resourceModal?.id && (
              <button className="btn-danger" onClick={deleteFromModal} style={{ marginRight: 'auto' }}>
                Eliminar
              </button>
            )}
            <button className="btn" onClick={() => setResourceModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmResource}>Guardar</button>
            {resModalErr && <span className="gres-save-err">{resModalErr}</span>}
          </>
        }
      >
        {resourceModal && (
          <ResourceModalBody
            form={resourceModal}
            setForm={setResourceModal}
            people={people}
            contracts={planContracts}
            profiles={profiles}
            orgUnits={orgUnits}
            sym={currSymbol}
            showCosts={showCosts}
          />
        )}
      </Modal>
    </div>
  )
}
