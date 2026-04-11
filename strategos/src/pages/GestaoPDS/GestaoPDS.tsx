import './GestaoPDS.css'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useFilters } from '../../context/FilterContext'
import { useActivities } from '../../hooks/useActivities'
import { usePdsEntries } from '../../hooks/usePdsEntries'
import type { PdsItem } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────
type SectionKey = 'commitments' | 'progress' | 'nextSteps' | 'attention'

interface ActiveCell {
  section: SectionKey
  idx: number
}

interface PlanOption {
  key: string
  label: string
  n0: string
  n1: string
  n2: string
  id0: string
  id1: string
  id2: string
  program_id: string | null
}

interface DraftState {
  commitments: PdsItem[]
  progress:    PdsItem[]
  nextSteps:   PdsItem[]
  attention:   PdsItem[]
}

const EMPTY_DRAFT: DraftState = {
  commitments: [],
  progress:    [],
  nextSteps:   [],
  attention:   [],
}

// ── Helpers ────────────────────────────────────────────────────

/** Wrap text selection (or cursor) with a markdown marker pair */
function applyMarker(text: string, start: number, end: number, marker: string): string {
  const selected = text.slice(start, end)
  return selected
    ? text.slice(0, start) + marker + selected + marker + text.slice(end)
    : text.slice(0, start) + marker + marker + text.slice(end)
}

// ── Section sub-component ──────────────────────────────────────
interface PdsSectionProps {
  sectionKey:   SectionKey
  title:        string
  items:        PdsItem[]
  withMeta:     boolean
  activeCell:   ActiveCell | null
  activeRef:    { current: HTMLTextAreaElement | null }
  onFocus(section: SectionKey, idx: number, el: HTMLTextAreaElement): void
  onBlur(): void
  onChangeItem(section: SectionKey, idx: number, patch: Partial<PdsItem>): void
  onRemove(section: SectionKey, idx: number): void
  onAdd(section: SectionKey): void
  onMove(section: SectionKey, idx: number, dir: 'up' | 'down'): void
}

function PdsSection({
  sectionKey, title, items, withMeta,
  activeCell, activeRef,
  onFocus, onBlur, onChangeItem, onRemove, onAdd, onMove,
}: PdsSectionProps) {
  const isActive = (idx: number) =>
    activeCell?.section === sectionKey && activeCell.idx === idx

  return (
    <div className="pds-section">
      <div className="pds-section-head">{title}</div>

      <div className="pds-items-list">
        {items.length === 0 && (
          <div className="pds-empty-items">Sem itens. Clique em + para adicionar.</div>
        )}

        {items.map((item, idx) => (
          <div
            key={idx}
            className={`pds-item${isActive(idx) ? ' pds-item--active' : ''}`}
            data-status={withMeta ? (item.status ?? 'Pendente') : undefined}
          >
            {/* Mini toolbar — only visible when this item is focused */}
            {isActive(idx) && (
              <div className="pds-toolbar">
                <button
                  className="pds-toolbar-btn"
                  title="Negrito (**texto**)"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const el = activeRef.current
                    if (!el) return
                    onChangeItem(sectionKey, idx, {
                      text: applyMarker(
                        item.text,
                        el.selectionStart ?? 0,
                        el.selectionEnd ?? 0,
                        '**',
                      ),
                    })
                  }}
                >B</button>
                <button
                  className="pds-toolbar-btn pds-toolbar-btn--i"
                  title="Itálico (*texto*)"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const el = activeRef.current
                    if (!el) return
                    onChangeItem(sectionKey, idx, {
                      text: applyMarker(
                        item.text,
                        el.selectionStart ?? 0,
                        el.selectionEnd ?? 0,
                        '*',
                      ),
                    })
                  }}
                >I</button>
              </div>
            )}

            <div className="pds-item-row">
              {/* Move buttons */}
              <div className="pds-move-btns">
                <button
                  className="pds-move-btn"
                  onClick={() => onMove(sectionKey, idx, 'up')}
                  disabled={idx === 0}
                  title="Mover acima"
                >▲</button>
                <button
                  className="pds-move-btn"
                  onClick={() => onMove(sectionKey, idx, 'down')}
                  disabled={idx === items.length - 1}
                  title="Mover abaixo"
                >▼</button>
              </div>

              {/* Text + optional meta */}
              <div className="pds-item-body">
                <textarea
                  className="pds-item-text"
                  value={item.text}
                  placeholder="Descrição… (suporta **negrito** e *itálico*)"
                  rows={2}
                  onChange={(e) => onChangeItem(sectionKey, idx, { text: e.target.value })}
                  onFocus={(e) => {
                    onFocus(sectionKey, idx, e.currentTarget)
                    activeRef.current = e.currentTarget
                  }}
                  onBlur={() => setTimeout(onBlur, 150)}
                />

                {withMeta && (
                  <div className="pds-item-meta">
                    <input
                      type="date"
                      className="pds-item-date"
                      value={item.date ?? ''}
                      onChange={(e) =>
                        onChangeItem(sectionKey, idx, { date: e.target.value })
                      }
                    />
                    <select
                      className="pds-item-status"
                      value={item.status ?? 'Pendente'}
                      onChange={(e) =>
                        onChangeItem(sectionKey, idx, { status: e.target.value })
                      }
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em curso">Em curso</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Remove */}
              <button
                className="pds-remove-btn"
                onClick={() => onRemove(sectionKey, idx)}
                title="Remover item"
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      <button className="pds-add-btn" onClick={() => onAdd(sectionKey)}>
        + Adicionar
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function GestaoPDS() {
  const { filters }  = useFilters()
  const programId    = filters.programIds[0] as string | undefined
  const { activities } = useActivities({ program_id: programId })
  const { entries, loading } = usePdsEntries(programId)

  // ── Plan options from level-2 activities ────────────────────
  const planOptions = useMemo<PlanOption[]>(() => {
    const seen = new Set<string>()
    const opts: PlanOption[] = []
    for (const a of activities) {
      if (a.level !== 2) continue
      const key = `${a.n1}|||${a.n2}`
      if (seen.has(key)) continue
      seen.add(key)
      opts.push({
        key,
        label:      a.n1 ? `${a.n1} › ${a.n2}` : (a.n2 || '(sem nome)'),
        n0:         a.n0,
        n1:         a.n1,
        n2:         a.n2,
        id0:        a.id0,
        id1:        a.id1,
        id2:        a.id2,
        program_id: a.program_id,
      })
    }
    return opts
  }, [activities])

  const [selectedKey, setSelectedKey] = useState<string>('')

  // Reset plan selection when program changes
  useEffect(() => { setSelectedKey('') }, [programId])

  // Auto-select first plan once options load
  useEffect(() => {
    if (!selectedKey && planOptions.length > 0) {
      setSelectedKey(planOptions[0].key)
    }
  }, [planOptions, selectedKey])

  const selectedPlan = useMemo(
    () => planOptions.find(p => p.key === selectedKey) ?? null,
    [planOptions, selectedKey],
  )

  const baseEntry = useMemo(() => {
    if (!selectedPlan) return null
    return (
      entries.find(
        e => e.plan_name === selectedPlan.n2 && e.n1 === selectedPlan.n1,
      ) ?? null
    )
  }, [entries, selectedPlan])

  // ── Draft state ──────────────────────────────────────────────
  const [draft,     setDraft]     = useState<DraftState>(EMPTY_DRAFT)
  const [committed, setCommitted] = useState<DraftState>(EMPTY_DRAFT)
  // Tracks the id from a newly inserted row (no refetch needed)
  const [localEntryId, setLocalEntryId] = useState<string | null>(null)

  // Initialise draft + committed whenever plan/entry changes
  useEffect(() => {
    setLocalEntryId(null)
    const d: DraftState = baseEntry
      ? {
          commitments: baseEntry.commitments_items ?? [],
          progress:    baseEntry.progress_items    ?? [],
          nextSteps:   baseEntry.next_steps_items  ?? [],
          attention:   baseEntry.attention_items   ?? [],
        }
      : EMPTY_DRAFT
    setDraft(d)
    setCommitted(d)
  }, [baseEntry, selectedKey])

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(committed),
    [draft, committed],
  )

  const dirtyCount = useMemo(() => {
    if (!isDirty) return 0
    let n = 0
    const diff = (a: PdsItem[], b: PdsItem[]) => {
      const len = Math.max(a.length, b.length)
      for (let i = 0; i < len; i++) {
        if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) n++
      }
    }
    diff(draft.commitments, committed.commitments)
    diff(draft.progress,    committed.progress)
    diff(draft.nextSteps,   committed.nextSteps)
    diff(draft.attention,   committed.attention)
    return n
  }, [isDirty, draft, committed])

  // ── Toolbar / active cell ────────────────────────────────────
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const activeRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Save state ───────────────────────────────────────────────
  const [toast,   setToast]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  // ── Item callbacks ───────────────────────────────────────────
  const handleFocus = useCallback(
    (section: SectionKey, idx: number, el: HTMLTextAreaElement) => {
      setActiveCell({ section, idx })
      activeRef.current = el
    },
    [],
  )

  const handleBlur = useCallback(() => {
    setActiveCell(null)
  }, [])

  const handleChangeItem = useCallback(
    (section: SectionKey, idx: number, patch: Partial<PdsItem>) => {
      setDraft(prev => {
        const arr = [...prev[section]]
        arr[idx] = { ...arr[idx], ...patch }
        return { ...prev, [section]: arr }
      })
    },
    [],
  )

  const handleRemove = useCallback((section: SectionKey, idx: number) => {
    setDraft(prev => {
      const arr = [...prev[section]]
      arr.splice(idx, 1)
      return { ...prev, [section]: arr }
    })
    setActiveCell(null)
  }, [])

  const handleAdd = useCallback((section: SectionKey) => {
    setDraft(prev => ({
      ...prev,
      [section]: [...prev[section], { text: '' }],
    }))
  }, [])

  const handleMove = useCallback(
    (section: SectionKey, idx: number, dir: 'up' | 'down') => {
      setDraft(prev => {
        const arr = [...prev[section]]
        const target = dir === 'up' ? idx - 1 : idx + 1
        if (target < 0 || target >= arr.length) return prev
        ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
        return { ...prev, [section]: arr }
      })
    },
    [],
  )

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedPlan || !isDirty || saving) return
    setSaving(true)
    setSaveErr(null)

    const effectiveId = baseEntry?.id ?? localEntryId
    const payload = {
      ...(effectiveId ? { id: effectiveId } : {}),
      program_id:        selectedPlan.program_id,
      n0:                selectedPlan.n0,
      n1:                selectedPlan.n1,
      plan_name:         selectedPlan.n2,
      id0:               selectedPlan.id0,
      id1:               selectedPlan.id1,
      id2:               selectedPlan.id2,
      commitments_items: draft.commitments,
      progress_items:    draft.progress,
      next_steps_items:  draft.nextSteps,
      attention_items:   draft.attention,
    }

    const { data, error } = await supabase
      .from('pds_entries')
      .upsert(payload, { onConflict: 'id' })
      .select('id')
      .maybeSingle()

    setSaving(false)
    if (error) {
      setSaveErr(error.message)
    } else {
      if (data?.id) setLocalEntryId(data.id)
      setCommitted(draft)
      setToast(true)
      setTimeout(() => setToast(false), 2000)
    }
  }, [selectedPlan, isDirty, saving, baseEntry, localEntryId, draft])

  // ── Shared section props ─────────────────────────────────────
  const sectionProps = {
    activeCell,
    activeRef,
    onFocus:      handleFocus,
    onBlur:       handleBlur,
    onChangeItem: handleChangeItem,
    onRemove:     handleRemove,
    onAdd:        handleAdd,
    onMove:       handleMove,
  }

  const noProgram = !programId
  const noPlans   = !noProgram && planOptions.length === 0

  return (
    <div className="pds-page">
      {/* Controls bar */}
      <div className="pds-controls-bar">
        <label className="pds-label">Plano de Acção:</label>
        <select
          className="pds-plan-select"
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
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

        {saveErr && <span className="pds-save-err">{saveErr}</span>}
        {toast   && <span className="pds-toast">Guardado!</span>}

        <button
          className="pds-btn pds-btn-save"
          onClick={handleSave}
          disabled={!selectedPlan || !isDirty || saving}
        >
          {saving ? 'A guardar…' : isDirty ? `Guardar (${dirtyCount})` : 'Guardar'}
        </button>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="pds-status">A carregar…</div>
      ) : noProgram ? (
        <div className="pds-status">
          Selecciona um programa para visualizar os PDS.
        </div>
      ) : noPlans ? (
        <div className="pds-status">
          Nenhum plano de acção disponível para este programa.
        </div>
      ) : !selectedPlan ? (
        <div className="pds-status">Selecciona um plano de acção.</div>
      ) : (
        <div className="pds-grid">
          <PdsSection
            {...sectionProps}
            sectionKey="commitments"
            title="Compromissos Anteriores"
            items={draft.commitments}
            withMeta={true}
          />
          <PdsSection
            {...sectionProps}
            sectionKey="progress"
            title="Principais Avanços"
            items={draft.progress}
            withMeta={false}
          />
          <PdsSection
            {...sectionProps}
            sectionKey="nextSteps"
            title="Próximos Passos"
            items={draft.nextSteps}
            withMeta={true}
          />
          <PdsSection
            {...sectionProps}
            sectionKey="attention"
            title="Pontos de Atenção"
            items={draft.attention}
            withMeta={false}
          />
        </div>
      )}
    </div>
  )
}
