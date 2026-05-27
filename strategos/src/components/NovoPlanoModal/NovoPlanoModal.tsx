import './NovoPlanoModal.css'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertTriangle, X, Download, Paperclip, FileText } from 'lucide-react'
import {
  parseExcelFile,
  buildAncestors,
  downloadActivitiesTemplate,
  type ParsedActivity,
  type ParseError,
} from '../../lib/excel-import'
import Modal from '../Modal/Modal'
import SearchableSelect from '../SearchableSelect/SearchableSelect'
import MultiPersonSelect from '../MultiPersonSelect/MultiPersonSelect'
import { useEixos } from '../../hooks/useEixos'
import { useProgramLabels } from '../../hooks/useProgramLabels'
import { usePeople } from '../../hooks/usePeople'
import { usePrograms } from '../../hooks/usePrograms'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import type { Plano } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────
interface PlanoForm {
  name: string; code: string; eixo_id: string
  owner: string; sponsor: string; objective: string
  threshold_leaves_low: number | null
  threshold_leaves_high: number | null
  threshold_aggregates_low: number | null
  threshold_aggregates_high: number | null
}

const BLANK_PLANO: PlanoForm = {
  name: '', code: '', eixo_id: '',
  owner: '', sponsor: '', objective: '',
  threshold_leaves_low: null, threshold_leaves_high: null,
  threshold_aggregates_low: null, threshold_aggregates_high: null,
}

// ── Helpers ────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso
}

// ── Component ──────────────────────────────────────────────────
export interface NovoPlanoModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  planoToEdit?: Plano | null
  /** Pre-select / filter eixos by program */
  programId?: string | null
  /** Pre-select eixo in create mode */
  defaultEixoId?: string
  /** Optional breadcrumb shown in modal title (e.g. "em Programa › Eixo") */
  contextLabel?: string
}

export default function NovoPlanoModal({
  isOpen,
  onClose,
  onSaved,
  planoToEdit,
  programId,
  defaultEixoId,
  contextLabel,
}: NovoPlanoModalProps) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { eixos: dbEixos } = useEixos(programId ?? undefined)
  const labels = useProgramLabels(programId)
  const { people } = usePeople()
  const { programs } = usePrograms()

  const activePeople = useMemo(
    () => people.filter(p => p.active !== false),
    [people]
  )

  const peopleMap = useMemo(
    () => new Map(activePeople.map(p => [p.id, p])),
    [activePeople]
  )
  const peopleByName = useMemo(
    () => new Map(activePeople.map(p => [p.name, p])),
    [activePeople]
  )

  const ownerSponsorOptions = useMemo(() => {
    const peopleOpts = activePeople.map(p => ({ value: p.name, label: p.name, subtitle: 'Pessoa' }))
    const orgUnits = [...new Set(people.map(p => p.org_unit).filter((u): u is string => Boolean(u)))]
    const unitOpts = orgUnits.map(u => ({ value: u, label: u, subtitle: 'Unidade' }))
    const seen = new Set<string>()
    return [...peopleOpts, ...unitOpts]
      .filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [people, activePeople])

  const [planoForm,        setPlanoForm]        = useState<PlanoForm>(() => ({
    ...BLANK_PLANO,
    eixo_id: planoToEdit ? '' : (defaultEixoId ?? ''),
  }))
  const [planoErrors,      setPlanoErrors]      = useState<Record<string, string>>({})
  const [planoSaving,      setPlanoSaving]      = useState(false)
  const [planoStep,        setPlanoStep]        = useState<1 | 2>(1)
  const [ownerLabelOverride,   setOwnerLabelOverride]   = useState('')
  const [sponsorLabelOverride, setSponsorLabelOverride] = useState('')
  const [uploadedFile,     setUploadedFile]     = useState<File | null>(null)
  const [parsedActivities, setParsedActivities] = useState<ParsedActivity[]>([])
  const [parseErrors,      setParseErrors]      = useState<ParseError[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derive effective program from the eixo the user selects (overrides prop)
  const effectiveProgramId = useMemo(() => {
    const fromEixo = dbEixos.find(e => e.id === planoForm.eixo_id)?.program_id
    return fromEixo ?? programId ?? null
  }, [dbEixos, planoForm.eixo_id, programId])

  const effectiveProgram = useMemo(
    () => programs.find(p => p.id === effectiveProgramId) ?? null,
    [programs, effectiveProgramId]
  )

  // Reset / populate form when modal opens or planoToEdit changes
  useEffect(() => {
    if (!isOpen) {
      setPlanoForm(BLANK_PLANO)
      setPlanoErrors({})
      setPlanoStep(1)
      setOwnerLabelOverride('')
      setSponsorLabelOverride('')
      setUploadedFile(null)
      setParsedActivities([])
      setParseErrors([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (planoToEdit) {
      const editOwnerIds = planoToEdit.owner_person_ids ?? []
      const editSponsorIds = planoToEdit.sponsor_person_ids ?? []
      const ownerStr = editOwnerIds.map(id => peopleMap.get(id)?.name ?? '').filter(Boolean).join(' | ')
      const sponsorStr = editSponsorIds.map(id => peopleMap.get(id)?.name ?? '').filter(Boolean).join(' | ')
      setPlanoForm({
        name:                planoToEdit.name,
        code:                planoToEdit.code,
        eixo_id:             planoToEdit.eixo_id,
        owner:               ownerStr,
        sponsor:             sponsorStr,
        objective:           planoToEdit.objective ?? '',
        threshold_leaves_low:     planoToEdit.threshold_leaves_low ?? null,
        threshold_leaves_high:    planoToEdit.threshold_leaves_high ?? null,
        threshold_aggregates_low:  planoToEdit.threshold_aggregates_low ?? null,
        threshold_aggregates_high: planoToEdit.threshold_aggregates_high ?? null,
      })
      setOwnerLabelOverride(planoToEdit.owner_label_override ?? '')
      setSponsorLabelOverride(planoToEdit.sponsor_label_override ?? '')
      setPlanoStep(1)
    } else {
      setPlanoForm({ ...BLANK_PLANO, eixo_id: defaultEixoId ?? '' })
      setPlanoStep(1)
    }
    setPlanoErrors({})
  }, [isOpen, planoToEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync defaultEixoId into create-mode form (handles filter changes while modal is open)
  useEffect(() => {
    if (!planoToEdit && defaultEixoId) {
      setPlanoForm(f => ({ ...f, eixo_id: defaultEixoId }))
    }
  }, [defaultEixoId, planoToEdit])

  const clearFile = useCallback(() => {
    setUploadedFile(null); setParsedActivities([]); setParseErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const goToStep2 = useCallback(() => {
    const errs: Record<string, string> = {}
    if (!planoForm.name.trim())   errs.name    = 'Nome obrigatório.'
    if (!planoForm.code.trim())   errs.code    = 'Código obrigatório.'
    if (!planoForm.eixo_id)       errs.eixo_id = `${labels.n1} obrigatório.`
    const { threshold_leaves_low: ll, threshold_leaves_high: lh,
            threshold_aggregates_low: al, threshold_aggregates_high: ah } = planoForm
    if (ll !== null && lh !== null && lh < ll) errs.threshold = 'Folhas High deve ser ≥ Folhas Low'
    else if (al !== null && ah !== null && ah < al) errs.threshold = 'Agregados High deve ser ≥ Agregados Low'
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

  const handleSavePlanoEdit = useCallback(async () => {
    if (!planoToEdit) return
    const errs: Record<string, string> = {}
    if (!planoForm.name.trim()) errs.name = 'Nome obrigatório.'
    if (!planoForm.code.trim()) errs.code = 'Código obrigatório.'
    if (Object.keys(errs).length) { setPlanoErrors(errs); return }
    const { threshold_leaves_low: ll, threshold_leaves_high: lh,
            threshold_aggregates_low: al, threshold_aggregates_high: ah } = planoForm
    if (ll !== null && lh !== null && lh < ll) { setPlanoErrors({ threshold: 'Folhas High deve ser ≥ Folhas Low' }); return }
    if (al !== null && ah !== null && ah < al) { setPlanoErrors({ threshold: 'Agregados High deve ser ≥ Agregados Low' }); return }
    setPlanoSaving(true); setPlanoErrors({})
    const ownerNames = (planoForm.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const ownerPersonIds: string[] = []
    const ownerUnmatched: string[] = []
    for (const n of ownerNames) {
      const id = peopleByName.get(n)?.id
      if (id) { ownerPersonIds.push(id) } else { ownerUnmatched.push(n) }
    }
    const ownerLabelOverrideVal = [ownerLabelOverride.trim(), ownerUnmatched.join(' | ')].filter(Boolean).join(' | ') || null
    const sponsorNames = (planoForm.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const sponsorPersonIds: string[] = []
    const sponsorUnmatched: string[] = []
    for (const n of sponsorNames) {
      const id = peopleByName.get(n)?.id
      if (id) { sponsorPersonIds.push(id) } else { sponsorUnmatched.push(n) }
    }
    const sponsorLabelOverrideVal = [sponsorLabelOverride.trim(), sponsorUnmatched.join(' | ')].filter(Boolean).join(' | ') || null
    const { error } = await supabase
      .from('planos')
      .update({
        name:                 planoForm.name.trim(),
        code:                 planoForm.code.trim().toUpperCase(),
        owner_person_ids:     ownerPersonIds,
        owner_primary_id:     ownerPersonIds[0] ?? null,
        owner_label_override: ownerLabelOverrideVal,
        sponsor_person_ids:   sponsorPersonIds,
        sponsor_primary_id:   sponsorPersonIds[0] ?? null,
        sponsor_label_override: sponsorLabelOverrideVal,
        objective:            planoForm.objective || null,
        threshold_leaves_low:      planoForm.threshold_leaves_low,
        threshold_leaves_high:     planoForm.threshold_leaves_high,
        threshold_aggregates_low:  planoForm.threshold_aggregates_low,
        threshold_aggregates_high: planoForm.threshold_aggregates_high,
      })
      .eq('id', planoToEdit.id)
    setPlanoSaving(false)
    if (error) { setPlanoErrors({ _: error.message }); return }
    showToast('Plano guardado.', 'success')
    onClose()
    onSaved()
  }, [planoToEdit, planoForm, ownerLabelOverride, sponsorLabelOverride, peopleByName, showToast, onClose, onSaved])

  const handleSavePlanoWithActivities = useCallback(async () => {
    if (parseErrors.length > 0) return
    setPlanoSaving(true); setPlanoErrors({})

    const { data: maxResult } = await supabase
      .from('planos').select('sort_order')
      .eq('eixo_id', planoForm.eixo_id)
      .order('sort_order', { ascending: false }).limit(1)

    const nextSort = ((maxResult as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1

    const ownerNamesNew = (planoForm.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const ownerPersonIdsNew: string[] = []
    const ownerUnmatchedNew: string[] = []
    for (const n of ownerNamesNew) {
      const id = peopleByName.get(n)?.id
      if (id) { ownerPersonIdsNew.push(id) } else { ownerUnmatchedNew.push(n) }
    }
    const ownerLabelOverrideNew = [ownerLabelOverride.trim(), ownerUnmatchedNew.join(' | ')].filter(Boolean).join(' | ') || null
    const sponsorNamesNew = (planoForm.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const sponsorPersonIdsNew: string[] = []
    const sponsorUnmatchedNew: string[] = []
    for (const n of sponsorNamesNew) {
      const id = peopleByName.get(n)?.id
      if (id) { sponsorPersonIdsNew.push(id) } else { sponsorUnmatchedNew.push(n) }
    }
    const sponsorLabelOverrideNew = [sponsorLabelOverride.trim(), sponsorUnmatchedNew.join(' | ')].filter(Boolean).join(' | ') || null
    const planoPayload = {
      name:                 planoForm.name.trim(),
      code:                 planoForm.code.trim().toUpperCase(),
      eixo_id:              planoForm.eixo_id,
      program_id:           effectiveProgramId ?? null,
      owner_person_ids:     ownerPersonIdsNew,
      owner_primary_id:     ownerPersonIdsNew[0] ?? null,
      owner_label_override: ownerLabelOverrideNew,
      sponsor_person_ids:   sponsorPersonIdsNew,
      sponsor_primary_id:   sponsorPersonIdsNew[0] ?? null,
      sponsor_label_override: sponsorLabelOverrideNew,
      objective:            planoForm.objective || null,
      threshold_leaves_low:      planoForm.threshold_leaves_low,
      threshold_leaves_high:     planoForm.threshold_leaves_high,
      threshold_aggregates_low:  planoForm.threshold_aggregates_low,
      threshold_aggregates_high: planoForm.threshold_aggregates_high,
      sort_order:                nextSort,
    }

    const { data: newPlano, error: planoErr } = await supabase
      .from('planos').insert(planoPayload).select().single()

    if (planoErr) { setPlanoSaving(false); setPlanoErrors({ _: planoErr.message }); return }

    if (parsedActivities.length > 0) {
      const eixoName    = dbEixos.find(e => e.id === planoForm.eixo_id)?.name ?? ''
      const programName = effectiveProgram?.name ?? ''
      const planoName   = (newPlano as { name: string }).name

      const actPayloads = parsedActivities.map((a, i) => {
        const { n3, n4, n5, n6 } = buildAncestors(a, parsedActivities)
        return {
          program_id: effectiveProgramId ?? null, level: a.level, name: a.name,
          n0: programName, n1: eixoName, n2: planoName, n3, n4, n5, n6,
          id0: programName, id1: '', id2: '',
          bs: a.start_date, bf: a.end_date,
          rs: a.real_start || null, rf: a.real_end || null,
          pct: a.pct, pct_prev: 0,
          status: a.pct >= 100 ? 'Concluída' : 'Em dia',
          notes: a.notes || null,
          sort_order: i,
        }
      })

      const { error: actErr } = await supabase.from('activities').insert(actPayloads)
      if (actErr) {
        setPlanoSaving(false)
        setPlanoErrors({ _: `Plano criado mas erro ao importar actividades: ${actErr.message}` })
        return
      }
    }

    setPlanoSaving(false)
    showToast(parsedActivities.length > 0
      ? `Plano "${planoPayload.name}" criado com ${parsedActivities.length} actividade(s).`
      : `Plano "${planoPayload.name}" criado.`
    )
    onClose()
    onSaved()
    navigate(`/planos/${(newPlano as { id: string }).id}`)
  }, [planoForm, effectiveProgramId, effectiveProgram, parsedActivities, parseErrors, dbEixos, ownerLabelOverride, sponsorLabelOverride, peopleByName, showToast, onClose, onSaved, navigate])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${planoToEdit ? 'Editar' : 'Novo'} ${labels.n2}${contextLabel ? ` · ${contextLabel}` : ''}`}
      width={560}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          {planoToEdit ? (
            <button className="btn-primary" onClick={handleSavePlanoEdit} disabled={planoSaving}>
              {planoSaving ? 'A guardar…' : 'Guardar'}
            </button>
          ) : planoStep === 1 ? (
            <button className="btn-primary" onClick={goToStep2}>
              Continuar <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <>
              <button className="btn" onClick={() => setPlanoStep(1)}><ChevronLeft size={14} strokeWidth={1.5} /> Anterior</button>
              <button
                className="btn-primary"
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
                <span className={`gi-field-label${planoErrors.eixo_id ? ' gi-label-error' : ''}`}>{labels.n1} *</span>
                <SearchableSelect
                  options={dbEixos.map(e => ({ value: e.id, label: e.name }))}
                  value={planoForm.eixo_id || null}
                  onChange={v => setPlanoForm(f => ({ ...f, eixo_id: v ?? '' }))}
                  placeholder="Seleccionar eixo..."
                  disabled={!!planoToEdit}
                  required
                />
                {planoErrors.eixo_id && <span className="gi-error">{planoErrors.eixo_id}</span>}
              </div>
            </div>
          </div>

          <div className="gi-section">
            <div className="gi-section-title">Responsáveis</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="gi-field">
                <span className="gi-field-label">{labels.sponsor}</span>
                <MultiPersonSelect
                  value={(planoForm.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)}
                  onChange={arr => setPlanoForm(f => ({ ...f, sponsor: arr.join(' | ') }))}
                  options={ownerSponsorOptions}
                  placeholder="Seleccionar patrocinador(es) (opcional)..."
                />
                <input
                  type="text"
                  className="gi-field-input"
                  style={{ marginTop: 4, fontSize: 12 }}
                  value={sponsorLabelOverride}
                  onChange={e => setSponsorLabelOverride(e.target.value)}
                  placeholder="Ou nome de entidade (ex: Comissão Executiva)"
                />
              </div>
              <div className="gi-field">
                <span className="gi-field-label">{labels.owner}</span>
                <MultiPersonSelect
                  value={(planoForm.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)}
                  onChange={arr => setPlanoForm(f => ({ ...f, owner: arr.join(' | ') }))}
                  options={ownerSponsorOptions}
                  placeholder="Seleccionar responsável(is) (opcional)..."
                />
                <input
                  type="text"
                  className="gi-field-input"
                  style={{ marginTop: 4, fontSize: 12 }}
                  value={ownerLabelOverride}
                  onChange={e => setOwnerLabelOverride(e.target.value)}
                  placeholder="Ou nome de entidade (ex: Conselho de Administração)"
                />
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

          <div className="gi-section">
            <div className="gi-section-title">Limiares de Estado</div>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
              Margem em pontos percentuais. Vazio = herdar do programa. Low = limite entre «Em dia» e «Em risco»; High = limite entre «Em risco» e «Em atraso».
            </p>
            <div className="threshold-pair" style={{ marginTop: 10 }}>
              <label className="gi-field">
                <span className="gi-field-label">Plano e Macroactividades (N2-N3) — Low</span>
                <input
                  className="gi-field-input threshold-input-low"
                  type="number" min={0} max={100}
                  value={planoForm.threshold_aggregates_low ?? ''}
                  placeholder={`padrão: ${effectiveProgram?.threshold_aggregates_low ?? 15}`}
                  onChange={e => setPlanoForm(f => ({
                    ...f,
                    threshold_aggregates_low: e.target.value === '' ? null : (parseInt(e.target.value) || 0),
                  }))}
                />
              </label>
              <label className="gi-field">
                <span className="gi-field-label">Plano e Macroactividades (N2-N3) — High</span>
                <input
                  className="gi-field-input threshold-input-high"
                  type="number" min={0} max={100}
                  value={planoForm.threshold_aggregates_high ?? ''}
                  placeholder={`padrão: ${effectiveProgram?.threshold_aggregates_high ?? 25}`}
                  onChange={e => setPlanoForm(f => ({
                    ...f,
                    threshold_aggregates_high: e.target.value === '' ? null : (parseInt(e.target.value) || 0),
                  }))}
                />
              </label>
            </div>
            <div className="threshold-pair" style={{ marginTop: 8 }}>
              <label className="gi-field">
                <span className="gi-field-label">Actividades (N4-N6) — Low</span>
                <input
                  className="gi-field-input threshold-input-low"
                  type="number" min={0} max={100}
                  value={planoForm.threshold_leaves_low ?? ''}
                  placeholder={`padrão: ${effectiveProgram?.threshold_leaves_low ?? 5}`}
                  onChange={e => setPlanoForm(f => ({
                    ...f,
                    threshold_leaves_low: e.target.value === '' ? null : (parseInt(e.target.value) || 0),
                  }))}
                />
              </label>
              <label className="gi-field">
                <span className="gi-field-label">Actividades (N4-N6) — High</span>
                <input
                  className="gi-field-input threshold-input-high"
                  type="number" min={0} max={100}
                  value={planoForm.threshold_leaves_high ?? ''}
                  placeholder={`padrão: ${effectiveProgram?.threshold_leaves_high ?? 10}`}
                  onChange={e => setPlanoForm(f => ({
                    ...f,
                    threshold_leaves_high: e.target.value === '' ? null : (parseInt(e.target.value) || 0),
                  }))}
                />
              </label>
            </div>
            {(() => {
              const ll = planoForm.threshold_leaves_low, lh = planoForm.threshold_leaves_high
              const al = planoForm.threshold_aggregates_low, ah = planoForm.threshold_aggregates_high
              const err = (ll !== null && lh !== null && lh < ll)
                ? 'Folhas High deve ser ≥ Folhas Low'
                : (al !== null && ah !== null && ah < al)
                ? 'Agregados High deve ser ≥ Agregados Low'
                : null
              return err ? <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'block' }}>{err}</span> : null
            })()}
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
            <button className="gi-btn-link" type="button" onClick={downloadActivitiesTemplate}>
              <Download size={14} strokeWidth={1.5} /> Template
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
                <div className="gi-upload-icon"><Paperclip size={32} strokeWidth={1.5} /></div>
                <div className="gi-upload-text">Arrastar Excel ou clicar para seleccionar</div>
                <div className="gi-upload-hint">Formatos aceites: .xlsx, .xls</div>
              </>
            ) : (
              <div className="gi-upload-selected">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} strokeWidth={1.5} /> {uploadedFile.name}</span>
                <button type="button" className="gi-upload-clear"
                  onClick={e => { e.stopPropagation(); clearFile() }}><X size={14} strokeWidth={1.5} /></button>
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
                  <span className="gi-preview-errors-badge"><AlertTriangle size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{parseErrors.length} erro(s)</span>
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
  )
}
