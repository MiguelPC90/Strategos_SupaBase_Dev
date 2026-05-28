import './BulkActivitiesModal.css'
import { useRef, useState } from 'react'
import { Upload, AlertTriangle } from 'lucide-react'
import Modal from '../Modal/Modal'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import {
  parseExcelFile,
  buildAncestors,
  downloadActivitiesTemplate,
  type ParsedActivity,
} from '../../lib/excel-import'

interface BulkActivitiesModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  planoId: string
  programId: string | null
  eixoId: string | null
  n0: string
  n1: string
  n2: string
}

const LEVEL_LABELS: Record<number, string> = {
  3: 'Macro', 4: 'Activ.', 5: 'Tarefa', 6: 'Sub-T.',
}
const LEVEL_INDENT: Record<number, number> = {
  3: 0, 4: 12, 5: 24, 6: 36,
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const p = d.split('-')
  return `${p[2]}/${p[1]}/${p[0].slice(2)}`
}

export default function BulkActivitiesModal({
  isOpen,
  onClose,
  onImported,
  planoId,
  programId,
  eixoId,
  n0,
  n1,
  n2,
}: BulkActivitiesModalProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [fileName, setFileName] = useState('')
  const [activities, setActivities] = useState<ParsedActivity[]>([])
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const ACCEPTED_EXTS = ['.xlsx', '.xls', '.csv']

  function reset() {
    setStep('upload')
    setFileName('')
    setActivities([])
    setErrors([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function processFile(file: File) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED_EXTS.includes(ext)) {
      showToast(`Formato não suportado "${ext}". Use .xlsx, .xls ou .csv.`)
      return
    }
    setParsing(true)
    setFileName(file.name)
    const result = await parseExcelFile(file)
    setActivities(result.activities)
    setErrors(result.errors)
    setParsing(false)
    setStep('preview')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await processFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    await processFile(file)
  }

  const errorRows = new Set(errors.map(e => e.row))
  const validActivities = activities.filter(a => !errorRows.has(a.rowNum))

  async function handleImport() {
    if (validActivities.length === 0) return
    setSaving(true)

    const { data: maxData } = await supabase
      .from('activities')
      .select('sort_order')
      .eq('plano_id', planoId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const maxSortOrder = (maxData?.[0]?.sort_order as number | undefined) ?? -1

    const { data: existingData } = await supabase
      .from('activities')
      .select('name')
      .eq('plano_id', planoId)
    const existingNames = new Set(
      ((existingData ?? []) as { name: string }[]).map(a => a.name.toLowerCase()),
    )

    const toInsert: Record<string, unknown>[] = []
    let dupCount = 0
    for (let i = 0; i < validActivities.length; i++) {
      const a = validActivities[i]
      if (existingNames.has(a.name.toLowerCase())) { dupCount++; continue }
      const { n3, n4, n5, n6 } = buildAncestors(a, activities)
      toInsert.push({
        program_id: programId,
        eixo_id: eixoId,
        plano_id: planoId,
        level: a.level,
        name: a.name,
        n0, n1, n2, n3, n4, n5, n6,
        bs: a.start_date,
        bf: a.end_date,
        rs: a.real_start,
        rf: a.real_end,
        pct: a.pct,
        pct_prev: 0,
        status: a.pct >= 100 ? 'Concluída' : 'Em dia',
        sort_order: maxSortOrder + 1 + i,
        id0: '', id1: '', id2: '',
        source: 'manual',
        notes: a.notes || null,
      })
    }

    if (toInsert.length === 0) {
      setSaving(false)
      showToast(
        dupCount > 0
          ? `Nenhuma actividade importada — ${dupCount} duplicado(s) ignorado(s).`
          : 'Nenhuma actividade válida para importar.',
      )
      reset()
      onClose()
      return
    }

    const { error } = await supabase.from('activities').insert(toInsert)
    setSaving(false)
    if (error) { showToast(`Erro ao importar: ${error.message}`); return }
    let msg = `${toInsert.length} actividade(s) importada(s).`
    if (dupCount > 0) msg += ` ${dupCount} duplicado(s) ignorado(s).`
    showToast(msg)
    reset()
    onImported()
  }

  const footer = step === 'upload' ? (
    <>
      <button className="btn" onClick={downloadActivitiesTemplate} type="button">
        Descarregar modelo
      </button>
      <div style={{ flex: 1 }} />
      <button className="btn" onClick={handleClose} type="button">Cancelar</button>
      <button
        className="btn-primary"
        onClick={() => fileInputRef.current?.click()}
        disabled={parsing}
        type="button"
      >
        {parsing ? 'A processar…' : 'Seleccionar ficheiro'}
      </button>
    </>
  ) : (
    <>
      <button className="btn" onClick={reset} type="button" disabled={saving}>Voltar</button>
      <div style={{ flex: 1 }} />
      <button className="btn" onClick={handleClose} type="button" disabled={saving}>Cancelar</button>
      <button
        className="btn-primary"
        onClick={handleImport}
        disabled={saving || validActivities.length === 0}
        type="button"
      >
        {saving
          ? 'A importar…'
          : `Importar ${validActivities.length} actividade${validActivities.length !== 1 ? 's' : ''}`}
      </button>
    </>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Actividades" width={680} footer={footer}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {step === 'upload' && (
        <div
          className={`bam-upload-zone${isDragging ? ' bam-upload-zone--dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={32} strokeWidth={1.5} className="bam-upload-icon" />
          <p className="bam-upload-hint">
            Selecciona um ficheiro <strong>.xlsx</strong> com as actividades a importar.<br />
            Usa o modelo para garantir o formato correcto.
          </p>
          {parsing && <p className="bam-parsing-msg">A processar…</p>}
        </div>
      )}

      {step === 'preview' && (
        <div className="bam-preview">
          <div className="bam-file-name">
            <span className="bam-file-label">Ficheiro:</span>
            <span className="bam-file-val">{fileName}</span>
          </div>

          {errors.length > 0 && (
            <div className="bam-errors">
              <div className="bam-errors-header">
                <AlertTriangle size={14} strokeWidth={1.5} />
                <span>{errors.length} erro(s) — as linhas abaixo não serão importadas</span>
              </div>
              {errors.map(e => (
                <div key={e.row} className="bam-error-row">
                  Linha {e.row}: {e.message}
                </div>
              ))}
            </div>
          )}

          {activities.length === 0 && errors.length === 0 ? (
            <p className="bam-empty">Nenhuma actividade encontrada no ficheiro.</p>
          ) : activities.length > 0 && (
            <div className="bam-table-wrap">
              <table className="bam-table">
                <thead>
                  <tr>
                    <th className="bam-th-lvl">Nível</th>
                    <th>Designação</th>
                    <th className="bam-th-date">Início</th>
                    <th className="bam-th-date">Fim</th>
                    <th className="bam-th-pct">% Exec</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(a => {
                    const hasError = errorRows.has(a.rowNum)
                    const hasWarning = a.warnings.length > 0
                    return (
                      <tr key={a.rowNum} className={`bam-tr${hasError ? ' bam-tr-error' : ''}`}>
                        <td className="bam-td-lvl">{LEVEL_LABELS[a.level] ?? a.level}</td>
                        <td>
                          <div
                            className="bam-name-cell"
                            style={{ paddingLeft: LEVEL_INDENT[a.level] ?? 0 }}
                          >
                            {hasError && (
                              <span
                                className="bam-row-x"
                                title={errors.find(e => e.row === a.rowNum)?.message}
                              >
                                ✕
                              </span>
                            )}
                            {!hasError && hasWarning && (
                              <span className="bam-row-warn" title={a.warnings.join(' · ')}>
                                <AlertTriangle size={12} strokeWidth={1.5} />
                              </span>
                            )}
                            <span className={hasError ? 'bam-name-strike' : ''}>{a.name}</span>
                          </div>
                        </td>
                        <td className="bam-td-date">{fmtDate(a.start_date)}</td>
                        <td className="bam-td-date">{fmtDate(a.end_date)}</td>
                        <td className="bam-td-pct">{a.pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="bam-summary">
            {validActivities.length > 0 && (
              <span className="bam-summary-ok">{validActivities.length} válida(s)</span>
            )}
            {errors.length > 0 && (
              <span className="bam-summary-err">{errors.length} com erro(s)</span>
            )}
            {activities.filter(a => a.warnings.length > 0).length > 0 && (
              <span className="bam-summary-warn">
                {activities.filter(a => a.warnings.length > 0).length} com aviso(s)
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
