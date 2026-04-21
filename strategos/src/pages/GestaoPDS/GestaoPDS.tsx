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
import type { PdsItem, PdsEntry } from '../../types/index'

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
  withMeta:       boolean
  onSortToggle(): void
  onHide(itemId: string): void
  onRestore(itemId: string): void
  onAdd(section: SectionKey, title: string): void
}

function PdsSection({
  title, sectionKey, items, sortDir, withMeta,
  onSortToggle, onHide, onRestore, onAdd,
}: PdsSectionProps) {
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
          const isHidden = !!item.hidden_at
          return (
            <div
              key={item.id ?? item.text}
              className={`pds-item${isHidden ? ' pds-item--hidden' : ''}`}
              data-status={withMeta && !isHidden ? (item.status ?? 'Pendente') : undefined}
            >
              <div className="pds-item-row">
                <div className="pds-item-body">
                  <div className="pds-item-text-readonly">{item.text}</div>
                  {withMeta && (item.date || item.status) && (
                    <div className="pds-item-meta">
                      {item.date && (
                        <span className="pds-item-date-badge">{item.date}</span>
                      )}
                      {item.status && (
                        <span
                          className="pds-item-status-badge"
                          data-status={item.status}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                  )}
                  {isHidden && item.hidden_at && (
                    <span className="pds-item-hidden-label">
                      {hiddenLabel(item.hidden_at)}
                    </span>
                  )}
                </div>

                <div className="pds-item-actions">
                  {isHidden ? (
                    <button
                      className="pds-restore-btn"
                      onClick={() => { if (item.id) onRestore(item.id) }}
                      title="Restaurar item"
                    >↩</button>
                  ) : (
                    <button
                      className="pds-hide-btn"
                      onClick={() => { if (item.id) onHide(item.id) }}
                      title="Ocultar item"
                    >◌</button>
                  )}
                </div>
              </div>
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
  const [newItemStatus, setNewItemStatus] = useState('Pendente')
  const [addSaving,     setAddSaving]     = useState(false)

  const handleAdd = useCallback((section: SectionKey, title: string) => {
    setNewItemText('')
    setNewItemDate('')
    setNewItemStatus('Pendente')
    setAddModal({ section, title })
  }, [])

  const handleModalAdd = useCallback(async () => {
    if (!addModal || !selectedPlan || !newItemText.trim()) return
    setAddSaving(true)

    const field    = SECTION_FIELDS[addModal.section]
    const withMeta = addModal.section === 'commitments' || addModal.section === 'nextSteps'
    const newItem: PdsItem = {
      id:         newId(),
      created_at: new Date().toISOString(),
      hidden_at:  null,
      text:       newItemText.trim(),
      ...(withMeta ? { date: newItemDate || undefined, status: newItemStatus } : {}),
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
  const sharedProps = { onHide: handleHide, onRestore: handleRestore, onAdd: handleAdd }

  const noProgram     = !programId
  const noPlans       = !noProgram && !planosLoading && planOptions.length === 0
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
            withMeta={true}
            onSortToggle={() => setCommitSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
          <PdsSection
            {...sharedProps}
            sectionKey="progress"
            title="Principais Avanços"
            items={visProgress}
            sortDir={progressSort}
            withMeta={false}
            onSortToggle={() => setProgressSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
          <PdsSection
            {...sharedProps}
            sectionKey="nextSteps"
            title="Próximos Passos"
            items={visNextSteps}
            sortDir={nextSort}
            withMeta={true}
            onSortToggle={() => setNextSort(d => d === 'asc' ? 'desc' : 'asc')}
          />
          <PdsSection
            {...sharedProps}
            sectionKey="attention"
            title="Pontos de Atenção"
            items={visAttention}
            sortDir={attnSort}
            withMeta={false}
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
            {(addModal.section === 'commitments' || addModal.section === 'nextSteps') && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', marginBottom: 4 }}>
                    Data
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
                    onChange={e => setNewItemStatus(e.target.value)}
                  >
                    <option>Pendente</option>
                    <option>Em curso</option>
                    <option>Concluído</option>
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
