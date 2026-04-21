import './GestaoPDS.css'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useToast } from '../../context/ToastContext'
import Spinner from '../../components/Spinner/Spinner'
import Modal from '../../components/Modal/Modal'
import EmptyState from '../../components/EmptyState/EmptyState'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { usePdsEntries, usePdsConsolidated } from '../../hooks/usePdsEntries'
import type { PdsItem, PdsEntry, PdsItemEdit } from '../../types/index'
import { SECTION_CONFIG, type PdsSection } from './sectionConfig'

// ── Types ──────────────────────────────────────────────────────
type SectionKey   = 'commitments' | 'progress' | 'nextSteps' | 'attention'
type SortDir      = 'asc' | 'desc'
type PdsItemField = 'commitments_items' | 'progress_items' | 'next_steps_items' | 'attention_items'

interface PlanOption {
  key:        string
  label:      string
  n0:         string
  n1:         string
  n2:         string
  id0:        string
  id1:        string
  id2:        string
  program_id: string | null
}

interface AddModal { section: SectionKey; title: string }

// ── Constants ──────────────────────────────────────────────────
const SECTION_FIELDS: Record<SectionKey, PdsItemField> = {
  commitments: 'commitments_items',
  progress:    'progress_items',
  nextSteps:   'next_steps_items',
  attention:   'attention_items',
}

const SECTION_KEY_TO_PDS: Record<SectionKey, PdsSection> = {
  commitments: 'commitments',
  progress:    'progress',
  nextSteps:   'next_steps',
  attention:   'attention',
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// ── Helpers ────────────────────────────────────────────────────
function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getEntryField(entry: PdsEntry, field: PdsItemField): PdsItem[] {
  return (entry as unknown as Record<PdsItemField, PdsItem[]>)[field] ?? []
}

function hiddenLabel(hidden_at: string): string {
  const days = Math.floor((Date.now() - new Date(hidden_at).getTime()) / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Ocultado hoje'
  if (days === 1) return 'Ocultado há 1 dia'
  return `Ocultado há ${days} dias`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function statusPillClass(s: string): string {
  if (s === 'Pendente')  return 'pendente'
  if (s === 'Em curso')  return 'em-curso'
  if (s === 'Concluído') return 'concluido'
  return ''
}

function normalizeForDiff(v: unknown): unknown {
  return v == null ? null : v
}

function sortItems(items: PdsItem[], dir: SortDir): PdsItem[] {
  return [...items].sort((a, b) => {
    const ca = a.created_at ?? ''
    const cb = b.created_at ?? ''
    return dir === 'asc' ? ca.localeCompare(cb) : cb.localeCompare(ca)
  })
}

// ── SortBtn ────────────────────────────────────────────────────
function SortBtn({ dir, onClick }: { dir: SortDir; onClick(): void }) {
  return (
    <button className="pds-sort-btn" onClick={onClick} title="Inverter ordenação">
      {dir === 'asc' ? '↓ Mais recentes' : '↑ Mais antigos'}
    </button>
  )
}

// ── Section sub-component ──────────────────────────────────────
interface PdsSectionProps {
  title:          string
  sectionKey:     SectionKey
  items:          PdsItem[]
  sortDir:        SortDir
  editingId:      string | null
  editDraft:      Partial<PdsItem>
  onSortToggle(): void
  onHide(itemId: string): void
  onRestore(itemId: string): void
  onAdd(section: SectionKey, title: string): void
  onEditStart(item: PdsItem, section: PdsSection): void
  onEditChange(patch: Partial<PdsItem>): void
  onEditSave(): void
  onEditCancel(): void
}

function PdsSection({
  title, sectionKey, items, sortDir,
  editingId, editDraft,
  onSortToggle, onHide, onRestore, onAdd,
  onEditStart, onEditChange, onEditSave, onEditCancel,
}: PdsSectionProps) {
  const pdsSection = SECTION_KEY_TO_PDS[sectionKey]
  const cfg        = SECTION_CONFIG[pdsSection]

  return (
    <div className="pds-section">
      <div className="pds-section-head">
        <span>{title}</span>
        <SortBtn dir={sortDir} onClick={onSortToggle} />
      </div>

      <div className="pds-items-list">
        {items.length === 0 && (
          <div className="pds-empty-items">Sem itens. Clique em + para adicionar.</div>
        )}

        {items.map((item) => {
          const isHidden  = !!item.hidden_at
          const isEditing = editingId === item.id

          return (
            <div
              key={item.id ?? item.text}
              className={`pds-item${isHidden ? ' pds-item--hidden' : ''}`}
              data-status={!isHidden && cfg.hasStatus ? (item.status ?? 'Pendente') : undefined}
            >
              {isEditing ? (
                <div className="pds-item-edit">
                  <textarea
                    className="pds-item-edit-textarea"
                    rows={3}
                    value={editDraft.text ?? ''}
                    onChange={e => onEditChange({ text: e.target.value })}
                    autoFocus
                  />
                  {cfg.hasStatus && (
                    <select
                      className="pds-item-edit-select"
                      value={editDraft.status ?? 'Em curso'}
                      onChange={e => onEditChange({ status: e.target.value as PdsItem['status'] })}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em curso">Em curso</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  )}
                  {cfg.hasTargetDate && (
                    <label className="pds-item-edit-label">
                      Data Alvo
                      <input
                        type="date"
                        className="pds-item-edit-date"
                        value={editDraft.target_date ?? ''}
                        onChange={e => onEditChange({ target_date: e.target.value || null })}
                      />
                    </label>
                  )}
                  {cfg.hasCompletedAt && (
                    <label className="pds-item-edit-label">
                      Data Conclusão
                      <input
                        type="date"
                        className="pds-item-edit-date"
                        value={editDraft.completed_at ?? ''}
                        onChange={e => onEditChange({ completed_at: e.target.value || null })}
                      />
                    </label>
                  )}
                  <div className="pds-item-edit-actions">
                    <button className="pds-btn pds-btn-save" onClick={onEditSave}>Guardar</button>
                    <button className="pds-btn" onClick={onEditCancel}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="pds-item-row">
                  <div className="pds-item-body">
                    <div className="pds-item-text-readonly">{item.text}</div>
                    {(item.author || item.created_at) && (
                      <span className="pds-item-meta-created">
                        {item.author ? `${item.author} · ` : ''}
                        {item.created_at ? fmtDate(item.created_at.slice(0, 10)) : ''}
                      </span>
                    )}
                    {cfg.hasStatus && item.status && (
                      <span className={`pds-item-status-pill ${statusPillClass(item.status)}`}>
                        {item.status}
                      </span>
                    )}
                    {cfg.hasTargetDate && (item.target_date ?? item.date) && (
                      <span className="pds-item-target-date">
                        Alvo: {fmtDate((item.target_date ?? item.date)!)}
                      </span>
                    )}
                    {cfg.hasCompletedAt && item.completed_at && (
                      <span className={`pds-item-completed-date${item.status === 'Concluído' ? ' pds-item-completed-date--done' : ''}`}>
                        Concluído em: {fmtDate(item.completed_at)}
                      </span>
                    )}
                    {isHidden && item.hidden_at && (
                      <span className="pds-item-hidden-label">{hiddenLabel(item.hidden_at)}</span>
                    )}
                  </div>

                  <div className="pds-item-actions">
                    {!isHidden && (
                      <button
                        className="pds-edit-btn"
                        onClick={() => onEditStart(item, pdsSection)}
                        title="Editar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                             strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>
                        </svg>
                      </button>
                    )}
                    {isHidden ? (
                      <button
                        className="pds-restore-btn"
                        onClick={() => { if (item.id) onRestore(item.id) }}
                        title="Restaurar"
                      >↩</button>
                    ) : (
                      <button
                        className="pds-hide-btn"
                        onClick={() => { if (item.id) onHide(item.id) }}
                        title="Ocultar"
                      >◌</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="pds-add-btn" onClick={() => onAdd(sectionKey, title)}>
        + Novo Item
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function GestaoPDS() {
  const { showToast } = useToast()
  const { filters }  = useFilters()
  const { programs } = usePrograms()
  const [selProgId, setSelProgId] = useState<string>('')

  useEffect(() => {
    if (selProgId) return
    const init = filters.programIds[0] ?? programs[0]?.id
    if (init) setSelProgId(init)
  }, [programs]) // eslint-disable-line react-hooks/exhaustive-deps

  const programId = selProgId || undefined
  const { planos, loading: planosLoading } = usePlanos(programId)
  const {
    entries,
    loading:  entriesLoading,
    refetch:  refetchEntries,
  } = usePdsEntries(programId)

  // ── Plan options ────────────────────────────────────────────
  const planOptions = useMemo<PlanOption[]>(() =>
    planos.map(p => {
      const eixoName = p.eixo?.name ?? ''
      const progName = programs.find(pg => pg.id === p.program_id)?.name ?? ''
      return {
        key:        p.id,
        label:      eixoName ? `${eixoName} › ${p.name}` : p.name,
        n0:         progName,
        n1:         eixoName,
        n2:         p.name,
        id0:        p.program_id ?? '',
        id1:        p.eixo?.code ?? '',
        id2:        p.code,
        program_id: p.program_id,
      }
    }),
    [planos, programs]
  )

  const [selectedKey, setSelectedKey] = useState<string>('')

  useEffect(() => { setSelectedKey('') }, [programId])

  useEffect(() => {
    if (planOptions.length === 0) return
    if (planOptions.some(p => p.key === selectedKey)) return
    setSelectedKey(planOptions[0].key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOptions])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey],
  )

  // ── Consolidated items from ALL entries for selected plano ──
  const {
    items:   consolidatedItems,
    loading: consolidatedLoading,
    refetch: refetchConsolidated,
  } = usePdsConsolidated(selectedKey || undefined)

  // ── entryIdMap: item.id → { entryId, field } ───────────────
  const entryIdMap = useMemo(() => {
    const map = new Map<string, { entryId: string; field: PdsItemField }>()
    const planEntries = entries.filter(e => e.plano_id === selectedKey)
    for (const entry of planEntries) {
      for (const field of Object.values(SECTION_FIELDS)) {
        for (const item of getEntryField(entry, field)) {
          if (item.id) map.set(item.id, { entryId: entry.id, field })
        }
      }
    }
    return map
  }, [entries, selectedKey])

  // ── Sort states ─────────────────────────────────────────────
  const [commitSort,   setCommitSort]   = useState<SortDir>('asc')
  const [progressSort, setProgressSort] = useState<SortDir>('asc')
  const [nextSort,     setNextSort]     = useState<SortDir>('asc')
  const [attnSort,     setAttnSort]     = useState<SortDir>('asc')

  // ── Filtered + sorted items (7-day soft-delete window) ──────
  const visCommitments = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return sortItems(
      consolidatedItems.commitments.filter(
        item => !item.hidden_at || new Date(item.hidden_at).getTime() > cutoff
      ),
      commitSort,
    )
  }, [consolidatedItems.commitments, commitSort])

  const visProgress = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return sortItems(
      consolidatedItems.progress.filter(
        item => !item.hidden_at || new Date(item.hidden_at).getTime() > cutoff
      ),
      progressSort,
    )
  }, [consolidatedItems.progress, progressSort])

  const visNextSteps = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return sortItems(
      consolidatedItems.nextSteps.filter(
        item => !item.hidden_at || new Date(item.hidden_at).getTime() > cutoff
      ),
      nextSort,
    )
  }, [consolidatedItems.nextSteps, nextSort])

  const visAttention = useMemo(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS
    return sortItems(
      consolidatedItems.attention.filter(
        item => !item.hidden_at || new Date(item.hidden_at).getTime() > cutoff
      ),
      attnSort,
    )
  }, [consolidatedItems.attention, attnSort])

  // ── Inline edit state ────────────────────────────────────────
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<PdsSection | null>(null)
  const [editDraft,      setEditDraft]      = useState<Partial<PdsItem>>({})

  const startEdit = useCallback((item: PdsItem, section: PdsSection) => {
    setEditingId(item.id)
    setEditingSection(section)
    setEditDraft({
      text:         item.text,
      status:       item.status,
      target_date:  item.target_date ?? item.date ?? null,
      completed_at: item.completed_at,
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditingSection(null)
    setEditDraft({})
  }, [])

  const handleEditChange = useCallback((patch: Partial<PdsItem>) => {
    setEditDraft(prev => ({ ...prev, ...patch }))
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId || !editingSection) return

    const meta = entryIdMap.get(editingId)
    if (!meta) return

    const entry = entries.find(e => e.id === meta.entryId)
    if (!entry) return

    const currentItems = getEntryField(entry, meta.field)
    const original = currentItems.find(i => i.id === editingId)
    if (!original) return

    const cfg = SECTION_CONFIG[editingSection]

    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of ['text', 'status', 'target_date', 'completed_at'] as const) {
      const dv = normalizeForDiff(editDraft[key])
      const ov = normalizeForDiff(original[key])
      if (dv !== ov) changes[key] = { from: ov, to: dv }
    }

    if (Object.keys(changes).length === 0) {
      setEditingId(null); setEditingSection(null); setEditDraft({})
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const edit: PdsItemEdit = {
      at: new Date().toISOString(),
      by: userData?.user?.id,
      changes,
    }

    const updatedItem: PdsItem = {
      ...original,
      text:         editDraft.text ?? original.text,
      status:       cfg.hasStatus    ? (editDraft.status as PdsItem['status']) : original.status,
      target_date:  cfg.hasTargetDate  ? (editDraft.target_date  ?? null)      : original.target_date,
      date:         cfg.hasTargetDate  ? (editDraft.target_date  ?? undefined)  : original.date,
      completed_at: cfg.hasCompletedAt ? (editDraft.completed_at ?? null)      : original.completed_at,
      edits:        [...(original.edits ?? []), edit],
    }

    const updated = currentItems.map(i => i.id === editingId ? updatedItem : i)
    const { error } = await supabase
      .from('pds_entries')
      .update({ [meta.field]: updated })
      .eq('id', meta.entryId)

    if (error) {
      showToast(`Erro: ${error.message}`)
    } else {
      setEditingId(null); setEditingSection(null); setEditDraft({})
      refetchEntries()
      refetchConsolidated()
    }
  }, [editingId, editingSection, editDraft, entryIdMap, entries, refetchEntries, refetchConsolidated, showToast])

  // ── Hide / Restore — immediate Supabase save ────────────────
  const applyHideRestore = useCallback(async (itemId: string, hidden_at: string | null) => {
    const meta = entryIdMap.get(itemId)
    if (!meta) return

    const entry = entries.find(e => e.id === meta.entryId)
    if (!entry) return

    const updated = getEntryField(entry, meta.field).map(item =>
      item.id === itemId ? { ...item, hidden_at } : item
    )

    const { error } = await supabase
      .from('pds_entries')
      .update({ [meta.field]: updated })
      .eq('id', meta.entryId)

    if (error) {
      showToast(`Erro: ${error.message}`)
    } else {
      refetchEntries()
      refetchConsolidated()
    }
  }, [entryIdMap, entries, refetchEntries, refetchConsolidated, showToast])

  const handleHide    = useCallback((id: string) =>
    applyHideRestore(id, new Date().toISOString()), [applyHideRestore])
  const handleRestore = useCallback((id: string) =>
    applyHideRestore(id, null), [applyHideRestore])

  // ── Add-item modal ───────────────────────────────────────────
  const [addModal,      setAddModal]      = useState<AddModal | null>(null)
  const [newItemText,   setNewItemText]   = useState('')
  const [newItemDate,   setNewItemDate]   = useState('')
  const [newItemStatus, setNewItemStatus] = useState<'Pendente' | 'Em curso' | 'Concluído'>('Em curso')
  const [addSaving,     setAddSaving]     = useState(false)

  const handleAdd = useCallback((section: SectionKey, title: string) => {
    setNewItemText('')
    setNewItemDate('')
    setNewItemStatus('Em curso')
    setAddModal({ section, title })
  }, [])

  const handleModalAdd = useCallback(async () => {
    if (!addModal || !selectedPlan || !newItemText.trim()) return
    setAddSaving(true)

    const field = SECTION_FIELDS[addModal.section]
    const cfg   = SECTION_CONFIG[SECTION_KEY_TO_PDS[addModal.section]]

    const newItem: PdsItem = {
      id:           newId(),
      created_at:   new Date().toISOString(),
      hidden_at:    null,
      text:         newItemText.trim(),
      ...(cfg.hasStatus ? {
        status:       newItemStatus,
        target_date:  newItemDate || null,
        date:         newItemDate || undefined,
        completed_at: null,
      } : {}),
    }

    const planEntries = entries
      .filter(e => e.plano_id === selectedKey)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    const latest = planEntries[0] ?? null

    let saveErr: string | null = null

    if (latest) {
      const current = getEntryField(latest, field)
      const { error } = await supabase
        .from('pds_entries')
        .update({ [field]: [...current, newItem] })
        .eq('id', latest.id)
      if (error) saveErr = error.message
    } else {
      const { error } = await supabase
        .from('pds_entries')
        .insert({
          program_id: selProgId,
          plano_id:   selectedPlan.key,
          n0:         selectedPlan.n0,
          n1:         selectedPlan.n1,
          plan_name:  selectedPlan.n2,
          id0:        selectedPlan.id0,
          id1:        selectedPlan.id1,
          id2:        selectedPlan.id2,
          [field]:    [newItem],
        })
      if (error) saveErr = error.message
    }

    setAddSaving(false)
    if (saveErr) {
      showToast(`Erro: ${saveErr}`)
    } else {
      setAddModal(null)
      refetchEntries()
      refetchConsolidated()
    }
  }, [
    addModal, selectedPlan, selectedKey, selProgId,
    entries, newItemText, newItemDate, newItemStatus,
    refetchEntries, refetchConsolidated, showToast,
  ])

  // ── Render ───────────────────────────────────────────────────
  const sharedProps = {
    editingId,
    editDraft,
    onHide:       handleHide,
    onRestore:    handleRestore,
    onAdd:        handleAdd,
    onEditStart:  startEdit,
    onEditChange: handleEditChange,
    onEditSave:   saveEdit,
    onEditCancel: cancelEdit,
  }

  const noProgram      = !programId
  const noPlans        = !noProgram && !planosLoading && planOptions.length === 0
  const contentLoading = entriesLoading || planosLoading || (!!selectedKey && consolidatedLoading)

  return (
    <div className="pds-page">
      {/* Controls bar */}
      <div className="pds-controls-bar">
        {programs.length > 1 && (
          <>
            <label className="pds-label">Programa:</label>
            <select
              className="styled-select"
              value={selProgId}
              onChange={e => { setSelProgId(e.target.value); setSelectedKey('') }}
            >
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
        <label className="pds-label">Plano de Acção:</label>
        <select
          className="styled-select"
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          disabled={noProgram || noPlans}
        >
          {noProgram ? (
            <option value="">— selecciona um programa —</option>
          ) : noPlans ? (
            <option value="">— sem planos disponíveis —</option>
          ) : (
            planOptions.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))
          )}
        </select>

        <div className="pds-spacer" />
      </div>

      {/* Content area */}
      {contentLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Spinner />
        </div>
      ) : noProgram ? (
        <div className="pds-status">Selecciona um programa para visualizar os PDS.</div>
      ) : noPlans ? (
        <EmptyState
          icon="inbox"
          title="Sem planos de acção"
          description="Não existem planos de acção disponíveis para este programa."
        />
      ) : !selectedPlan ? (
        <div className="pds-status">Selecciona um plano de acção.</div>
      ) : (
        <div className="pds-grid">
          <PdsSection
            {...sharedProps}
            sectionKey="commitments"
            title="Compromissos Anteriores"
            items={visCommitments}
            sortDir={commitSort}
            onSortToggle={() => setCommitSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
          <PdsSection
            {...sharedProps}
            sectionKey="progress"
            title="Principais Avanços"
            items={visProgress}
            sortDir={progressSort}
            onSortToggle={() => setProgressSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
          <PdsSection
            {...sharedProps}
            sectionKey="nextSteps"
            title="Próximos Passos"
            items={visNextSteps}
            sortDir={nextSort}
            onSortToggle={() => setNextSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
          <PdsSection
            {...sharedProps}
            sectionKey="attention"
            title="Pontos de Atenção"
            items={visAttention}
            sortDir={attnSort}
            onSortToggle={() => setAttnSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
        </div>
      )}

      {/* Add-item modal */}
      {addModal && (
        <Modal
          isOpen={true}
          onClose={() => setAddModal(null)}
          title={`Novo Item — ${addModal.title}`}
          width={420}
          footer={
            <>
              <button className="pds-btn" onClick={() => setAddModal(null)}>Cancelar</button>
              <button
                className="pds-btn pds-btn-save"
                onClick={handleModalAdd}
                disabled={addSaving || !newItemText.trim()}
              >
                {addSaving ? 'A guardar…' : 'Adicionar'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', marginBottom: 4 }}>
                Conteúdo
              </div>
              <textarea
                style={{ width: '100%', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' }}
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                placeholder="Descrição do item…"
                rows={3}
                autoFocus
              />
            </div>
            {SECTION_CONFIG[SECTION_KEY_TO_PDS[addModal.section]].hasStatus && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', marginBottom: 4 }}>
                    Data Alvo
                  </div>
                  <input
                    type="date"
                    style={{ border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                    value={newItemDate}
                    onChange={e => setNewItemDate(e.target.value)}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', marginBottom: 4 }}>
                    Estado
                  </div>
                  <select
                    className="styled-select-sm"
                    value={newItemStatus}
                    onChange={e => setNewItemStatus(e.target.value as typeof newItemStatus)}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em curso">Em curso</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
