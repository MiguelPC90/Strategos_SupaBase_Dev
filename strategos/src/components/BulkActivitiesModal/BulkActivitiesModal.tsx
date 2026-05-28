import './BulkActivitiesModal.css'
import { useRef, useState } from 'react'
import { Upload, AlertTriangle, Download } from 'lucide-react'
import Modal from '../Modal/Modal'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import {
  parseExcelFile,
  exportActivitiesToExcel,
  computeDiff,
  type ParseError,
  type ActivityForExport,
  type ExistingActivity,
  type DiffResult,
} from '../../lib/excel-import'

interface BulkActivitiesModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  planoId: string
  programId: string | null
  eixoId: string | null    // kept for API compat; not passed to RPC
  n0: string
  n1: string
  n2: string
}

const ACCEPTED_EXTS = ['.xlsx', '.xls', '.csv']

const LEVEL_LABELS: Record<number, string> = { 3: 'Macro', 4: 'Activ.', 5: 'Tarefa', 6: 'Sub-T.' }
const LEVEL_INDENT: Record<number, number> = { 3: 0, 4: 12, 5: 24, 6: 36 }
const FIELD_LABELS: Record<string, string> = {
  name: 'nome', level: 'nível',
  bs: 'início plan.', bf: 'fim plan.',
  rs: 'início real',  rf: 'fim real',
  pct: 'exec', notes: 'notas',
}

function fmtShort(d: string | number | null): string {
  if (d === null || d === '') return '—'
  const s = String(d)
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : s
}

function fmtChangeVal(field: string, val: string | number | null): string {
  if (val === null) return '—'
  if (['bs', 'bf', 'rs', 'rf'].includes(field)) return fmtShort(val)
  return String(val)
}

type FilterType = 'all' | 'new' | 'modified' | 'deleted'

export default function BulkActivitiesModal({
  isOpen,
  onClose,
  onImported,
  planoId,
  programId,
  n0,
  n1,
  n2,
}: BulkActivitiesModalProps) {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step,        setStep       ] = useState<'upload' | 'preview'>('upload')
  const [fileName,    setFileName   ] = useState('')
  const [isDragging,  setIsDragging ] = useState(false)
  const [parsing,     setParsing    ] = useState(false)
  const [exporting,   setExporting  ] = useState(false)
  const [saving,      setSaving     ] = useState(false)
  const [diffResult,  setDiffResult ] = useState<DiffResult | null>(null)
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  const [filterType,  setFilterType ] = useState<FilterType>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applyError,  setApplyError ] = useState<string | null>(null)

  function reset() {
    setStep('upload'); setFileName(''); setDiffResult(null)
    setParseErrors([]); setFilterType('all'); setApplyError(null)
  }

  function handleClose() { reset(); onClose() }

  async function processFile(file: File) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED_EXTS.includes(ext)) {
      showToast(`Formato não suportado "${ext}". Use .xlsx, .xls ou .csv.`)
      return
    }
    setParsing(true)
    setFileName(file.name)
    const [parseResult, existingRes] = await Promise.all([
      parseExcelFile(file),
      supabase.from('activities').select('id,level,name,bs,bf,rs,rf,pct,notes').eq('plano_id', planoId).order('sort_order'),
    ])
    const diff = computeDiff(parseResult.activities, (existingRes.data ?? []) as ExistingActivity[])
    setDiffResult(diff)
    setParseErrors(parseResult.errors)
    setFilterType('all')
    setApplyError(null)
    setParsing(false)
    setStep('preview')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; await processFile(file)
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]; if (!file) return
    await processFile(file)
  }

  async function handleExport() {
    setExporting(true)
    const { data } = await supabase
      .from('activities').select('id,level,name,bs,bf,rs,rf,pct,notes')
      .eq('plano_id', planoId).order('sort_order')
    setExporting(false)
    exportActivitiesToExcel((data ?? []) as ActivityForExport[], n2)
  }

  async function handleApply() {
    if (!diffResult) return
    setSaving(true); setApplyError(null)

    const newPayload = diffResult.diffs.filter(d => d.type === 'new').map(d => ({
      level: d.parsed!.level, name: d.parsed!.name,
      n3: d.ancestors!.n3, n4: d.ancestors!.n4, n5: d.ancestors!.n5, n6: d.ancestors!.n6,
      bs: d.parsed!.start_date, bf: d.parsed!.end_date,
      rs: d.parsed!.real_start, rf: d.parsed!.real_end,
      pct: d.parsed!.pct, notes: d.parsed!.notes,
    }))
    const modifiedPayload = diffResult.diffs.filter(d => d.type === 'modified').map(d => ({
      id: d.uuid,
      level: d.parsed!.level, name: d.parsed!.name,
      n3: d.ancestors!.n3, n4: d.ancestors!.n4, n5: d.ancestors!.n5, n6: d.ancestors!.n6,
      bs: d.parsed!.start_date, bf: d.parsed!.end_date,
      rs: d.parsed!.real_start, rf: d.parsed!.real_end,
      pct: d.parsed!.pct, notes: d.parsed!.notes,
    }))
    const deletedPayload = diffResult.diffs.filter(d => d.type === 'deleted').map(d => d.uuid)

    const { data, error } = await supabase.rpc('apply_activity_diff', {
      p_plano_id: planoId, p_program_id: programId,
      p_n0: n0, p_n1: n1, p_n2: n2,
      p_new: newPayload, p_modified: modifiedPayload, p_deleted: deletedPayload,
    })

    setSaving(false)
    if (error) { setApplyError(`Erro ao aplicar: ${error.message}`); return }
    const r = data as { new: number; modified: number; deleted: number }
    showToast(`Aplicado: ${r.new} nova(s), ${r.modified} modificada(s), ${r.deleted} removida(s).`)
    reset(); onImported()
  }

  function onApplyClick() {
    if (!diffResult) return
    diffResult.summary.deleted > 0 ? setConfirmOpen(true) : void handleApply()
  }

  async function handleApplyConfirmed() { setConfirmOpen(false); await handleApply() }

  // ── Derived ──────────────────────────────────────────────────
  const filteredDiffs = diffResult
    ? (filterType === 'all' ? diffResult.diffs
        : diffResult.diffs.filter(d =>
            filterType === 'new'      ? d.type === 'new'
            : filterType === 'modified' ? d.type === 'modified'
            : d.type === 'deleted'))
    : []

  const applyCount = diffResult
    ? diffResult.summary.new + diffResult.summary.modified + diffResult.summary.deleted
    : 0

  const hierWarnings = (diffResult?.diffs ?? []).flatMap(d =>
    d.warnings.map(w => d.parsed?.rowNum ? `Linha ${d.parsed.rowNum}: ${w}` : w),
  )

  // ── Footer ───────────────────────────────────────────────────
  const footer = step === 'upload' ? (
    <>
      <button className="btn bam-export-btn" onClick={handleExport} disabled={exporting} type="button">
        <Download size={13} strokeWidth={1.5} />
        {exporting ? 'A exportar…' : 'Exportar actividades'}
      </button>
      <div style={{ flex: 1 }} />
      <button className="btn" onClick={handleClose} type="button">Cancelar</button>
      <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={parsing} type="button">
        {parsing ? 'A processar…' : 'Seleccionar ficheiro'}
      </button>
    </>
  ) : (
    <>
      <button className="btn" onClick={reset} type="button" disabled={saving}>Voltar</button>
      <div style={{ flex: 1 }} />
      <button className="btn" onClick={handleClose} type="button" disabled={saving}>Cancelar</button>
      <button className="btn-primary" onClick={onApplyClick} disabled={saving || applyCount === 0} type="button">
        {saving ? 'A aplicar…' : applyCount === 0 ? 'Sem alterações' : `Aplicar ${applyCount}`}
      </button>
    </>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Actividades" width={760} footer={footer}>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileChange} />

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar eliminação"
        message={`Vais apagar ${diffResult?.summary.deleted ?? 0} actividade(s) e as suas dependências. Esta acção é permanente. Continuar?`}
        confirmLabel="Apagar e aplicar"
        destructive
        loading={saving}
        onConfirm={handleApplyConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />

      {step === 'upload' && (
        <div
          className={`bam-upload-zone${isDragging ? ' bam-upload-zone--dragging' : ''}`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
          <Upload size={32} strokeWidth={1.5} className="bam-upload-icon" />
          <p className="bam-upload-hint">
            Exporta as actividades actuais, edita no Excel e reimporta.<br />
            A correspondência é feita pelo <strong>_uuid</strong> oculto.
          </p>
          {parsing && <p className="bam-parsing-msg">A processar…</p>}
        </div>
      )}

      {step === 'preview' && diffResult && (
        <div className="bam-preview">
          <div className="bam-file-name">
            <span className="bam-file-label">Ficheiro:</span>
            <span className="bam-file-val">{fileName}</span>
          </div>

          {/* Summary chips */}
          <div className="bam-diff-summary">
            <span className="bam-sum-chip bam-sum-new">✚ {diffResult.summary.new} nova{diffResult.summary.new !== 1 ? 's' : ''}</span>
            <span className="bam-sum-chip bam-sum-modified">◆ {diffResult.summary.modified} modificada{diffResult.summary.modified !== 1 ? 's' : ''}</span>
            <span className="bam-sum-chip bam-sum-deleted">✕ {diffResult.summary.deleted} a apagar</span>
            <span className="bam-sum-chip bam-sum-unchanged">● {diffResult.summary.unchanged} {diffResult.summary.unchanged !== 1 ? 'iguais' : 'igual'}</span>
          </div>

          {/* Warnings */}
          {(parseErrors.length > 0 || diffResult.summary.levelChanges > 0 || hierWarnings.length > 0) && (
            <div className="bam-warnings-block">
              {parseErrors.map(e => (
                <div key={e.row} className="bam-warn-line bam-warn-error">
                  <AlertTriangle size={12} strokeWidth={1.5} />
                  <span>Linha {e.row}: {e.message} (excluída)</span>
                </div>
              ))}
              {diffResult.summary.levelChanges > 0 && (
                <div className="bam-warn-line bam-warn-level">
                  <AlertTriangle size={12} strokeWidth={1.5} />
                  <span>{diffResult.summary.levelChanges} actividade{diffResult.summary.levelChanges !== 1 ? 's' : ''} muda{diffResult.summary.levelChanges !== 1 ? 'm' : ''} de nível (ver destaque)</span>
                </div>
              )}
              {hierWarnings.map((w, i) => (
                <div key={i} className="bam-warn-line">
                  <AlertTriangle size={12} strokeWidth={1.5} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Filter chips */}
          <div className="bam-filter-row">
            {(['all', 'new', 'modified', 'deleted'] as const).map(f => {
              const count = f === 'all' ? diffResult.diffs.length
                : f === 'new' ? diffResult.summary.new
                : f === 'modified' ? diffResult.summary.modified
                : diffResult.summary.deleted
              return (
                <button key={f} className={`bam-filter-chip${filterType === f ? ' active' : ''}`} onClick={() => setFilterType(f)} type="button">
                  {f === 'all' ? 'Todas' : f === 'new' ? 'Novas' : f === 'modified' ? 'Modificadas' : 'A apagar'}
                  <span className="bam-filter-count">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Diff table */}
          {filteredDiffs.length === 0 ? (
            <p className="bam-empty">Sem actividades para este filtro.</p>
          ) : (
            <div className="bam-table-wrap">
              <table className="bam-table">
                <colgroup>
                  <col style={{ width: 72 }} /><col style={{ width: 40 }} />
                  <col /><col style={{ width: 210 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="bam-th-action">Acção</th>
                    <th className="bam-th-lvl">Nv</th>
                    <th>Designação</th>
                    <th className="bam-th-changes">Alterações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiffs.map((d, idx) => {
                    const oldLvl = d.levelChanged ? d.changes?.find(c => c.field === 'level')?.oldValue ?? null : null
                    return (
                      <tr key={`${d.type}-${d.uuid ?? idx}`} className={`bam-diff-row-${d.type}`}>
                        <td className="bam-td-action">
                          <span className={`bam-action-chip bam-action-${d.type}`}>
                            {d.type === 'new' ? '✚ NOVA' : d.type === 'modified' ? '◆ MOD' : d.type === 'deleted' ? '✕ APAGAR' : '● IGUAL'}
                          </span>
                        </td>
                        <td className="bam-td-lvl">
                          {oldLvl != null
                            ? <span className="bam-level-change" title="Nível alterado">{String(oldLvl)}→{d.level}</span>
                            : <>{LEVEL_LABELS[d.level] ?? d.level}</>
                          }
                        </td>
                        <td>
                          <div className="bam-name-cell" style={{ paddingLeft: LEVEL_INDENT[d.level] ?? 0 }}>
                            <span className="bam-name-text">{d.name}</span>
                          </div>
                        </td>
                        <td className="bam-td-changes">
                          {d.type === 'deleted' && <span className="bam-change-del">será removida</span>}
                          {d.type === 'modified' && d.changes && (
                            <span className="bam-changes-list">
                              {d.changes.map((c, ci) => (
                                <span key={c.field}>
                                  {ci > 0 && <span className="bam-change-sep"> · </span>}
                                  {c.field === 'level' && <AlertTriangle size={11} strokeWidth={1.5} className="bam-change-lvl-icon" />}
                                  {FIELD_LABELS[c.field] ?? c.field}: {fmtChangeVal(c.field, c.oldValue)}→{fmtChangeVal(c.field, c.newValue)}
                                </span>
                              ))}
                            </span>
                          )}
                          {(d.type === 'new' || d.type === 'unchanged') && <span className="bam-change-none">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {applyError && <div className="bam-apply-error">{applyError}</div>}
        </div>
      )}
    </Modal>
  )
}
