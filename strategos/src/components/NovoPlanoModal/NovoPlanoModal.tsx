import './NovoPlanoModal.css'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertTriangle, X, Download, Paperclip, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
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
import { buildLegacyOwnerString, buildLegacySponsorString } from '../../lib/owners'

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

// ── Helpers ────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : iso
}

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null
    return raw.toISOString().slice(0, 10)
  }
  if (typeof raw === 'number') {
    // Excel epoch: 1899-12-30 (accounts for the 1900 leap-year bug)
    const date = new Date(Date.UTC(1899, 11, 30) + raw * 86400000)
    return date.toISOString().slice(0, 10)
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    const m1 = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    const m2 = t.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  }
  return null
}

async function parseExcelFile(file: File): Promise<{ activities: ParsedActivity[]; errors: ParseError[] }> {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
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

    const start_date = parseDate(row[iInicioP] ?? null)
    const end_date   = parseDate(row[iFimP] ?? null)

    if (!start_date) { errors.push({ row: rowNum, message: 'Inicio_Planeado inválido (aceite: dd/mm/aaaa, aaaa-mm-dd, ou célula de data Excel)' }); continue }
    if (!end_date)   { errors.push({ row: rowNum, message: 'Fim_Planeado inválido (aceite: dd/mm/aaaa, aaaa-mm-dd, ou célula de data Excel)' });   continue }
    if (end_date < start_date) { errors.push({ row: rowNum, message: 'Fim_Planeado anterior ao Inicio_Planeado' }); continue }

    const real_start = iInicioR >= 0 ? parseDate(row[iInicioR] ?? null) : null
    const real_end   = iFimR   >= 0 ? parseDate(row[iFimR]    ?? null) : null
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
      const ownerStr = (editOwnerIds.length > 0 && peopleMap.size > 0)
        ? editOwnerIds.map(id => peopleMap.get(id)?.name ?? '').filter(Boolean).join(' | ')
        : (planoToEdit.owner ?? '')
      const sponsorStr = (editSponsorIds.length > 0 && peopleMap.size > 0)
        ? editSponsorIds.map(id => peopleMap.get(id)?.name ?? '').filter(Boolean).join(' | ')
        : (planoToEdit.sponsor ?? '')
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
    const ownerPersonIds = ownerNames
      .map(n => peopleByName.get(n)?.id)
      .filter((id): id is string => Boolean(id))
    const ownerLabelOverrideVal = ownerLabelOverride.trim() || null
    const sponsorNames = (planoForm.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const sponsorPersonIds = sponsorNames
      .map(n => peopleByName.get(n)?.id)
      .filter((id): id is string => Boolean(id))
    const sponsorLabelOverrideVal = sponsorLabelOverride.trim() || null
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
        owner:                buildLegacyOwnerString(ownerPersonIds, ownerLabelOverrideVal, peopleMap) || null,
        sponsor:              buildLegacySponsorString(sponsorPersonIds, sponsorLabelOverrideVal, peopleMap) || null,
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
  }, [planoToEdit, planoForm, ownerLabelOverride, sponsorLabelOverride, peopleByName, peopleMap, showToast, onClose, onSaved])

  const handleSavePlanoWithActivities = useCallback(async () => {
    if (parseErrors.length > 0) return
    setPlanoSaving(true); setPlanoErrors({})

    const { data: maxResult } = await supabase
      .from('planos').select('sort_order')
      .eq('eixo_id', planoForm.eixo_id)
      .order('sort_order', { ascending: false }).limit(1)

    const nextSort = ((maxResult as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1

    const ownerNamesNew = (planoForm.owner ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const ownerPersonIdsNew = ownerNamesNew
      .map(n => peopleByName.get(n)?.id)
      .filter((id): id is string => Boolean(id))
    const ownerLabelOverrideNew = ownerLabelOverride.trim() || null
    const sponsorNamesNew = (planoForm.sponsor ?? '').split('|').map(s => s.trim()).filter(Boolean)
    const sponsorPersonIdsNew = sponsorNamesNew
      .map(n => peopleByName.get(n)?.id)
      .filter((id): id is string => Boolean(id))
    const sponsorLabelOverrideNew = sponsorLabelOverride.trim() || null
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
      owner:                buildLegacyOwnerString(ownerPersonIdsNew, ownerLabelOverrideNew, peopleMap) || null,
      sponsor:              buildLegacySponsorString(sponsorPersonIdsNew, sponsorLabelOverrideNew, peopleMap) || null,
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
        const { n3, n4, n5 } = buildN345(a, parsedActivities)
        return {
          program_id: effectiveProgramId ?? null, level: a.level, name: a.name,
          n0: programName, n1: eixoName, n2: planoName, n3, n4, n5,
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
  }, [planoForm, effectiveProgramId, effectiveProgram, parsedActivities, parseErrors, dbEixos, ownerLabelOverride, sponsorLabelOverride, peopleByName, peopleMap, showToast, onClose, onSaved, navigate])

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
            <button className="gi-btn-link" type="button" onClick={downloadTemplate}>
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
