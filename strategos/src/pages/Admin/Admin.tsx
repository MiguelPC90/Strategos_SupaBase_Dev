import './Admin.css'
import { useState, useEffect, useRef, Fragment, type ChangeEvent } from 'react'
import { Check, X, Pencil, Trash2, AlertCircle, FileText, Lock, Key, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { useBranding } from '../../context/BrandingContext'
import * as XLSX from 'xlsx'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import Modal from '../../components/Modal/Modal'
import SearchableSelect, { type SelectOption } from '../../components/SearchableSelect/SearchableSelect'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePrograms } from '../../hooks/usePrograms'
import { gradeStyle, type RiskThresholds, DEFAULT_THRESHOLDS } from '../../lib/riskColors'
import {
  DEFAULT_HEALTH_CONFIG, HEALTH_METRIC_LABELS,
  type HealthConfig, type HealthBlock, type HealthMetric,
} from '../../lib/healthRules'
import type { Program, Eixo, Plano, Profile, Person, CostRole, Snapshot, UserRole, AlertRule, AlertSeverity } from '../../types/index'
import UserPermissionsForm, { type PermRow } from '../../components/UserPermissionsForm/UserPermissionsForm'
import InviteUserModal from '../../components/InviteUserModal/InviteUserModal'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import EditUserModal from '../../components/EditUserModal/EditUserModal'
import NovoPlanoModal from '../../components/NovoPlanoModal/NovoPlanoModal'
import AdminProgramModal from './AdminProgramModal'
import AdminEixoModal from './AdminEixoModal'
import { extractEdgeFunctionError } from '../../lib/edgeFunctionError'

// ── Types ──────────────────────────────────────────────────────
type SectionKey =
  | 'geral'
  | 'utilizadores'
  | 'programas'
  | 'plano'
  | 'recursos'
  | 'financeiro'
  | 'risco'
  | 'dados'
  | 'historico'

interface Section {
  key: SectionKey
  label: string
  desc: string
}

const SECTIONS: Section[] = [
  { key: 'geral',        label: 'Geral',                     desc: 'Identidade do cliente — modo de identidade, título, logótipo e data de corte' },
  { key: 'utilizadores', label: 'Utilizadores e Permissões', desc: 'Utilizadores, roles e matrix de acessos' },
  { key: 'programas',    label: 'Programas e Eixos',         desc: 'Gestão da hierarquia N0 → N1 → N2' },
  { key: 'plano',        label: 'Definições',                 desc: 'Limiares de atraso, saúde do plano, compromissos e alertas' },
  { key: 'recursos',     label: 'Recursos',                  desc: 'Perfis, unidades organizacionais e catálogo de pessoas' },
  { key: 'financeiro',   label: 'Financeiro',                desc: 'Moedas, categorias de custo e anos de gestão' },
  { key: 'risco',        label: 'Risco',                     desc: 'Dimensão da matriz, limiares e estados' },
  { key: 'dados',        label: 'Dados e Importação',        desc: 'Importar/exportar Excel e rótulos de filtros' },
  { key: 'historico',    label: 'Histórico',                 desc: 'Snapshots automáticos e registo de alterações' },
]

// ── Section 1: Geral ───────────────────────────────────────────
const GERAL_CONFIG_KEYS = ['branding_mode', 'client_title', 'client_subtitle', 'client_logo_url', 'cutoff_date'] as const

function AdminGeral() {
  const { showToast } = useToast()
  const { refresh: refreshBranding } = useBranding()
  const [brandingMode,   setBrandingMode]   = useState<'stratgos' | 'cobrand'>('stratgos')
  const [title,          setTitle]          = useState('')
  const [subtitle,       setSubtitle]       = useState('')
  const [cutoffDate,     setCutoffDate]     = useState('')
  const [logoUrl,        setLogoUrl]        = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .in('config_key', [...GERAL_CONFIG_KEYS])
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error || !data) return
        const map: Record<string, string> = {}
        for (const row of data) map[row.config_key] = row.data
        const rawMode = map['branding_mode'] ?? 'stratgos'
        setBrandingMode(rawMode === 'cobrand' ? 'cobrand' : 'stratgos')
        setTitle(map['client_title']       ?? '')
        setSubtitle(map['client_subtitle'] ?? '')
        setLogoUrl(map['client_logo_url']  ?? '')
        setCutoffDate(map['cutoff_date']   ?? '')
      }, () => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const pairs = [
        { config_key: 'branding_mode',   data: brandingMode },
        { config_key: 'client_title',    data: title },
        { config_key: 'client_subtitle', data: subtitle },
        { config_key: 'cutoff_date',     data: cutoffDate },
      ]
      await Promise.all(
        pairs.map(p => supabase.from('app_config').upsert(p, { onConflict: 'config_key' }))
      )
      await refreshBranding()
      showToast('Guardado!')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() ?? 'png'
      const path = `logo_${Date.now()}.${ext}`
      const { data: uploadData, error } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true })
      if (error || !uploadData) return
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(uploadData.path)
      await supabase.from('app_config').upsert(
        { config_key: 'client_logo_url', data: publicUrl },
        { onConflict: 'config_key' },
      )
      setLogoUrl(publicUrl)
      await refreshBranding()
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoRemove() {
    await supabase.from('app_config').upsert(
      { config_key: 'client_logo_url', data: '' },
      { onConflict: 'config_key' },
    )
    setLogoUrl('')
    await refreshBranding()
  }

  if (loading) {
    return (
      <Card title="Configuração Geral">
        <p className="adm-help">A carregar…</p>
      </Card>
    )
  }

  return (
    <Card title="Configuração Geral">
      <div className="adm-section-grid">

        {/* ── Left: text config ── */}
        <div>
          <div className="adm-field">
            <label className="adm-label">Modo de identidade</label>
            <div className="adm-radio-group">
              <label>
                <input
                  type="radio"
                  className="adm-radio"
                  name="branding-mode"
                  value="stratgos"
                  checked={brandingMode === 'stratgos'}
                  onChange={() => setBrandingMode('stratgos')}
                />
                Apenas Stratgos
              </label>
              <label>
                <input
                  type="radio"
                  className="adm-radio"
                  name="branding-mode"
                  value="cobrand"
                  checked={brandingMode === 'cobrand'}
                  onChange={() => setBrandingMode('cobrand')}
                />
                Stratgos + Cliente
              </label>
            </div>
            <span className="adm-help">
              "Apenas Stratgos": wordmark Stratgos no topbar. "Stratgos + Cliente": g-mark Stratgos + logo e nome do cliente.
            </span>
          </div>

          <div className="adm-field">
            <label className="adm-label">Título da plataforma</label>
            <input
              className="adm-input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ex: Plano Estratégico 2025"
            />
          </div>

          <div className="adm-field">
            <label className="adm-label">Subtítulo</label>
            <input
              className="adm-input"
              type="text"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="adm-field">
            <label className="adm-label">Data de corte</label>
            <input
              className="adm-input"
              type="date"
              value={cutoffDate}
              onChange={e => setCutoffDate(e.target.value)}
            />
            <span className="adm-help">Dados anteriores a esta data não são mostrados</span>
          </div>

          <button
            className="btn-primary btn-lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>

        {/* ── Right: logo ── */}
        <div>
          <div className="adm-field">
            <label className="adm-label">Logótipo do cliente</label>
            {logoUrl && (
              <div className="adm-logo-wrap">
                <img className="adm-logo-preview" src={logoUrl} alt="Logótipo" />
                <button className="adm-btn-ghost" onClick={handleLogoRemove}>Remover</button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="adm-file-hidden"
              onChange={handleLogoUpload}
            />
            <button
              className="adm-btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'A carregar…' : 'Carregar imagem'}
            </button>
            <span className="adm-help">Recomendado: PNG transparente, máx. 400×120px</span>
          </div>
        </div>

      </div>
    </Card>
  )
}

// ── Health block editor ────────────────────────────────────────
interface HealthBlockEditorProps {
  color: 'red' | 'amber'
  label: string
  block: HealthBlock
  onChange: (b: HealthBlock) => void
}

function HealthBlockEditor({ color, label, block, onChange }: HealthBlockEditorProps) {
  function setOperator(op: 'OR' | 'AND') {
    onChange({ ...block, operator: op })
  }

  function setRule(metric: HealthMetric, patch: Partial<{ enabled: boolean; threshold: number }>) {
    onChange({
      ...block,
      rules: block.rules.map(r => r.metric === metric ? { ...r, ...patch } : r),
    })
  }

  return (
    <div className="adm-health-block">
      <div className="adm-health-block-header">
        <span className="adm-health-block-title"><AlertCircle size={14} style={{ color: color === 'red' ? 'var(--red)' : 'var(--amber)' }} /> {label}</span>
        <div className="adm-health-op-toggle">
          <button
            className={`adm-health-op-btn${block.operator === 'OR' ? ' active' : ''}`}
            onClick={() => setOperator('OR')}
          >OU</button>
          <button
            className={`adm-health-op-btn${block.operator === 'AND' ? ' active' : ''}`}
            onClick={() => setOperator('AND')}
          >E</button>
        </div>
      </div>
      {block.rules.map(rule => (
        <div key={rule.metric} className="adm-health-rule-row">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={e => setRule(rule.metric, { enabled: e.target.checked })}
          />
          <span className="adm-health-rule-label">{HEALTH_METRIC_LABELS[rule.metric]}</span>
          <input
            className="adm-input adm-health-threshold-input"
            type="number"
            min={0}
            step={1}
            value={rule.threshold}
            disabled={!rule.enabled}
            onChange={e => setRule(rule.metric, { threshold: parseInt(e.target.value) || 0 })}
          />
        </div>
      ))}
    </div>
  )
}

// ── Section 2: Programas e Eixos ──────────────────────────────
function formatThresholdCell(inherited: boolean, ll: number, lh: number, al: number, ah: number) {
  return (
    <span className={inherited ? 'adm-tree-limiares-inherited' : 'adm-tree-limiares-own'} style={{ fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ display: 'block' }}>Act {ll}–{lh}pp</span>
      <span style={{ display: 'block' }}>Agr {al}–{ah}pp</span>
    </span>
  )
}

function AdminProgramas() {
  const { showToast } = useToast()
  const [programs, setPrograms] = useState<Program[]>([])
  const [eixos,    setEixos]    = useState<Eixo[]>([])
  const [planos,   setPlanos]   = useState<Plano[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expandedProgs, setExpandedProgs] = useState<Set<string>>(new Set())
  const [expandedEixos, setExpandedEixos] = useState<Set<string>>(new Set())

  const [progModal,          setProgModal]          = useState<{ program: Program | null } | null>(null)
  const [eixoModal,          setEixoModal]          = useState<{ program: Program; eixo: Eixo | null } | null>(null)
  const [planoModal,         setPlanoModal]         = useState<{ program: Program; eixo: Eixo; plano: Plano | null } | null>(null)
  const [planoDeleteConfirm, setPlanoDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  async function loadAll() {
    setLoading(true)
    const [progsRes, eixosRes, planosRes] = await Promise.all([
      supabase.from('programs')
        .select('id, code, name, sort_order, threshold_leaves_low, threshold_leaves_high, threshold_aggregates_low, threshold_aggregates_high')
        .order('sort_order').order('name'),
      supabase.from('eixos')
        .select('id, program_id, code, name, sort_order, created_at, updated_at')
        .order('sort_order').order('name'),
      supabase.from('planos')
        .select('id, eixo_id, program_id, code, name, owner, sponsor, sort_order, created_at, updated_at, threshold_leaves_low, threshold_leaves_high, threshold_aggregates_low, threshold_aggregates_high')
        .order('sort_order').order('name'),
    ])
    setPrograms((progsRes.data ?? []) as Program[])
    setEixos((eixosRes.data ?? []) as Eixo[])
    setPlanos((planosRes.data ?? []) as Plano[])
    setLoading(false)
  }

  useEffect(() => { void loadAll() }, [])

  function toggleProg(id: string) {
    setExpandedProgs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleEixo(id: string) {
    setExpandedEixos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function deleteProg(id: string) {
    const { count } = await supabase
      .from('eixos').select('id', { count: 'exact', head: true }).eq('program_id', id)
    if ((count ?? 0) > 0) { showToast('Não é possível apagar — existem eixos associados', 'error'); return }
    await supabase.from('programs').delete().eq('id', id)
    setExpandedProgs(prev => { const next = new Set(prev); next.delete(id); return next })
    void loadAll()
  }

  async function deleteEixo(id: string) {
    const { count } = await supabase
      .from('planos').select('id', { count: 'exact', head: true }).eq('eixo_id', id)
    if ((count ?? 0) > 0) { showToast('Não é possível apagar — existem planos associados', 'error'); return }
    await supabase.from('eixos').delete().eq('id', id)
    setExpandedEixos(prev => { const next = new Set(prev); next.delete(id); return next })
    void loadAll()
  }

  async function handleConfirmDeletePlano() {
    if (!planoDeleteConfirm) return
    await supabase.from('planos').delete().eq('id', planoDeleteConfirm.id)
    setPlanoDeleteConfirm(null)
    void loadAll()
  }

  return (
    <>
      <Card title="Programas, Eixos e Planos">
        <div style={{ margin: '-16px' }}>
          {loading ? (
            <p className="adm-empty-panel">A carregar…</p>
          ) : (
            <table className="adm-panel-table adm-tree-table">
              <thead>
                <tr>
                  <th>Designação</th>
                  <th style={{ width: 200 }} title="Bandas de estado em pp. Act = Actividades (N4-N6); Agr = Plano e Macroact. (N2-N3). Low = limite «Em dia»; High = limite «Em atraso».">Limiares</th>
                  <th style={{ width: 80 }}>Acções</th>
                </tr>
              </thead>
              <tbody>
                {programs.flatMap(p => {
                  const isExpanded = expandedProgs.has(p.id)
                  const progEixos  = eixos.filter(e => e.program_id === p.id)

                  const eixoRows = isExpanded ? [
                    ...(progEixos.length === 0
                      ? [<tr key={`empty-eixos-${p.id}`} className="adm-tree-row-eixo">
                          <td className="adm-tree-cell adm-tree-cell--eixo" colSpan={3}>
                            <span className="adm-tree-empty">Sem eixos</span>
                          </td>
                        </tr>]
                      : progEixos.flatMap(e => {
                          const eixoExpanded = expandedEixos.has(e.id)
                          const eixoPlanos   = planos.filter(pl => pl.eixo_id === e.id)

                          const planoRows = eixoExpanded ? [
                            ...(eixoPlanos.length === 0
                              ? [<tr key={`empty-planos-${e.id}`} className="adm-tree-row-plano">
                                  <td className="adm-tree-cell adm-tree-cell--plano" colSpan={3}>
                                    <span className="adm-tree-empty">Sem planos</span>
                                  </td>
                                </tr>]
                              : eixoPlanos.map(pl => {
                                  const plHasOwn   = pl.threshold_leaves_low !== null || pl.threshold_leaves_high !== null || pl.threshold_aggregates_low !== null || pl.threshold_aggregates_high !== null
                                  const leavesLow  = plHasOwn ? (pl.threshold_leaves_low  ?? 5)  : (p.threshold_leaves_low  ?? 5)
                                  const leavesHigh = plHasOwn ? (pl.threshold_leaves_high ?? 10)  : (p.threshold_leaves_high ?? 10)
                                  const aggLow     = plHasOwn ? (pl.threshold_aggregates_low  ?? 15) : (p.threshold_aggregates_low  ?? 15)
                                  const aggHigh    = plHasOwn ? (pl.threshold_aggregates_high ?? 25) : (p.threshold_aggregates_high ?? 25)
                                  return (
                                    <tr key={`plano-${pl.id}`} className="adm-tree-row-plano">
                                      <td className="adm-tree-cell adm-tree-cell--plano">
                                        <span className="adm-tree-code">{p.code}.{e.code}.{pl.code}</span>
                                        <span className="adm-tree-name adm-tree-name--plano">{pl.name}</span>
                                        <span className="adm-tree-tooltip-trigger"
                                          data-tooltip={`Resp: ${pl.owner || '—'} · Patr: ${pl.sponsor || '—'}`}
                                        ><Info size={11} /></span>
                                      </td>
                                      <td>{formatThresholdCell(!plHasOwn, leavesLow, leavesHigh, aggLow, aggHigh)}</td>
                                      <td>
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                          <button className="adm-icon-btn" title="Editar"
                                            onClick={() => setPlanoModal({ program: p, eixo: e, plano: pl })}
                                          ><Pencil size={14} /></button>
                                          <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                                            onClick={() => setPlanoDeleteConfirm({ id: pl.id, name: pl.name })}
                                          ><Trash2 size={14} /></button>
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })
                            ),
                            <tr key={`add-plano-${e.id}`} className="adm-tree-row-add adm-tree-row-plano">
                              <td className="adm-tree-cell adm-tree-cell--plano" colSpan={3}>
                                <button className="adm-add-btn"
                                  onClick={() => setPlanoModal({ program: p, eixo: e, plano: null })}
                                >+ Novo Plano</button>
                              </td>
                            </tr>,
                          ] : []

                          return [
                            <tr
                              key={`eixo-${e.id}`}
                              className={`adm-tree-row-eixo${eixoExpanded ? ' selected' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleEixo(e.id)}
                            >
                              <td className="adm-tree-cell adm-tree-cell--eixo">
                                <span className="adm-tree-chevron">
                                  {eixoExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </span>
                                <span className="adm-tree-code">{p.code}.{e.code}</span>
                                <span className="adm-tree-name">{e.name}</span>
                              </td>
                              <td>{formatThresholdCell(true, p.threshold_leaves_low ?? 5, p.threshold_leaves_high ?? 10, p.threshold_aggregates_low ?? 15, p.threshold_aggregates_high ?? 25)}</td>
                              <td onClick={ev => ev.stopPropagation()}>
                                <span style={{ whiteSpace: 'nowrap' }}>
                                  <button className="adm-icon-btn" title="Editar"
                                    onClick={() => setEixoModal({ program: p, eixo: e })}
                                  ><Pencil size={14} /></button>
                                  <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                                    onClick={() => deleteEixo(e.id)}
                                  ><Trash2 size={14} /></button>
                                </span>
                              </td>
                            </tr>,
                            ...planoRows,
                          ]
                        })
                    ),
                    <tr key={`add-eixo-${p.id}`} className="adm-tree-row-add adm-tree-row-eixo">
                      <td className="adm-tree-cell adm-tree-cell--eixo" colSpan={3}>
                        <button className="adm-add-btn"
                          onClick={() => setEixoModal({ program: p, eixo: null })}
                        >+ Novo Eixo</button>
                      </td>
                    </tr>,
                  ] : []

                  return [
                    <tr
                      key={`prog-${p.id}`}
                      className={`adm-tree-row-prog${isExpanded ? ' selected' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleProg(p.id)}
                    >
                      <td className="adm-tree-cell">
                        <span className="adm-tree-chevron">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span className="adm-tree-code">{p.code}</span>
                        <span className="adm-tree-name adm-tree-name--prog">{p.name}</span>
                      </td>
                      <td>{formatThresholdCell(false, p.threshold_leaves_low ?? 5, p.threshold_leaves_high ?? 10, p.threshold_aggregates_low ?? 15, p.threshold_aggregates_high ?? 25)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setProgModal({ program: p })}
                          ><Pencil size={14} /></button>
                          <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                            onClick={() => deleteProg(p.id)}
                          ><Trash2 size={14} /></button>
                        </span>
                      </td>
                    </tr>,
                    ...eixoRows,
                  ]
                })}
              </tbody>
            </table>
          )}
          <div className="adm-panel-footer">
            <button className="adm-add-btn"
              onClick={() => setProgModal({ program: null })}
            >+ Novo Programa</button>
          </div>
        </div>
      </Card>

      {progModal !== null && (
        <AdminProgramModal
          program={progModal.program}
          programs={programs}
          onClose={() => setProgModal(null)}
          onSaved={() => void loadAll()}
        />
      )}

      {eixoModal !== null && (
        <AdminEixoModal
          eixo={eixoModal.eixo}
          program={eixoModal.program}
          eixos={eixos}
          onClose={() => setEixoModal(null)}
          onSaved={() => void loadAll()}
        />
      )}

      {planoModal !== null && (
        <NovoPlanoModal
          isOpen
          onClose={() => setPlanoModal(null)}
          onSaved={() => void loadAll()}
          planoToEdit={planoModal.plano}
          programId={planoModal.program.id}
          defaultEixoId={planoModal.eixo.id}
          contextLabel={`em ${planoModal.program.name} › ${planoModal.eixo.name}`}
        />
      )}

      <ConfirmModal
        open={planoDeleteConfirm !== null}
        title="Apagar plano"
        message={`Apagar "${planoDeleteConfirm?.name ?? ''}"? Esta acção não pode ser desfeita.`}
        confirmLabel="Apagar"
        destructive
        onConfirm={handleConfirmDeletePlano}
        onCancel={() => setPlanoDeleteConfirm(null)}
      />
    </>
  )
}

// ── Section 3b: Permissões por utilizador ─────────────────────
function UserPermissionsModal({ userId, userName, userRole, isOpen, onClose }: {
  userId: string
  userName: string
  userRole: UserRole
  isOpen: boolean
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [currentPerms, setCurrentPerms] = useState<PermRow[]>([])
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const { error: delErr } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
      if (delErr) throw delErr
      if (currentPerms.length > 0) {
        const { error: insErr } = await supabase
          .from('user_permissions')
          .insert(currentPerms.map(r => ({ ...r, user_id: userId })))
        if (insErr) throw insErr
      }
      showToast('Permissões guardadas.', 'success')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast('Erro ao guardar: ' + msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const modalFooter = (
    <>
      <button className="adm-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'A guardar…' : 'Guardar'}
      </button>
    </>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Permissões: ${userName}`} width={600} footer={modalFooter}>
      <UserPermissionsForm userId={userId} userRole={userRole} onChange={setCurrentPerms} />
    </Modal>
  )
}

// ── Section 3a: Utilizadores ───────────────────────────────────
function roleBadge(role: UserRole) {
  if (role === 'admin')           return <Badge variant="navy">Admin</Badge>
  if (role === 'program_manager') return <Badge variant="blue">Prog.Manager</Badge>
  if (role === 'editor')          return <Badge variant="blue">Gestor</Badge>
  if (role === 'sponsor')         return <Badge variant="amber">Sponsor</Badge>
  if (role === 'stakeholder')     return <Badge variant="grey">Stakeholder</Badge>
  return <Badge variant="grey">Viewer</Badge>
}

function AdminUtilizadores() {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()

  const [profiles,        setProfiles]        = useState<Profile[]>([])
  const [loadingP,        setLoadingP]        = useState(true)
  const [editUser,        setEditUser]        = useState<Profile | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [permModal,       setPermModal]       = useState<{ userId: string; userName: string; userRole: UserRole } | null>(null)
  const [deleteConfirm,   setDeleteConfirm]   = useState<{ id: string; name: string } | null>(null)
  const [deleting,        setDeleting]        = useState(false)
  const [resetConfirm,    setResetConfirm]    = useState<{ id: string; name: string; email: string } | null>(null)
  const [resetting,       setResetting]       = useState(false)

  async function loadProfiles(): Promise<Profile[]> {
    setLoadingP(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, created_at, updated_at')
      .order('full_name')
    const loaded = (data ?? []) as Profile[]
    setProfiles(loaded)
    setLoadingP(false)
    return loaded
  }

  useEffect(() => { loadProfiles() }, [])

  function requestDeleteProfile(id: string, name: string | null) {
    setDeleteConfirm({ id, name: name || 'este utilizador' })
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteConfirm.id },
      })
      if (error) {
        const structuredMsg = await extractEdgeFunctionError(error)
        throw new Error(structuredMsg ?? error.message)
      }
      if (data?.error) throw new Error(data.error as string)
      showToast('Utilizador removido.', 'success')
      setDeleteConfirm(null)
      await loadProfiles()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover utilizador', 'error')
    } finally {
      setDeleting(false)
    }
  }

  function requestResetPassword(id: string, name: string | null, email: string) {
    setResetConfirm({ id, name: name || email, email })
  }

  async function handleConfirmReset() {
    if (!resetConfirm) return
    setResetting(true)
    try {
      const { data, error } = await supabase.functions.invoke('force-reset-password', {
        body: { userId: resetConfirm.id },
      })
      if (error) {
        const structuredMsg = await extractEdgeFunctionError(error)
        throw new Error(structuredMsg ?? error.message)
      }
      if (data?.error) throw new Error(data.error as string)
      showToast(`Email de reset enviado para ${resetConfirm.email}`, 'success')
      setResetConfirm(null)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar email de reset', 'error')
    } finally {
      setResetting(false)
    }
  }

  const inviteActions = (
    <button
      className="adm-btn-secondary"
      style={{ padding: '4px 12px', fontSize: 12 }}
      onClick={() => setShowInviteModal(true)}
    >
      + Convidar Utilizador
    </button>
  )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Card 1: Utilizadores ── */}
        <Card title="Utilizadores" actions={inviteActions}>
          {loadingP ? (
            <p className="adm-help" style={{ padding: '12px 0' }}>A carregar…</p>
          ) : (
            <div style={{ margin: '-16px' }}>
              <table className="adm-panel-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th style={{ width: 100 }}>Role</th>
                    <th style={{ width: 80 }}>Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => {
                    const isCurrentUser = p.id === currentUser?.id
                    const isAdmin       = p.role === 'admin'
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.full_name || '—'}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.email}</td>
                        <td>{roleBadge(p.role)}</td>
                        <td>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            <button
                              className="adm-icon-btn"
                              title={isAdmin ? 'Utilizadores Admin não podem ser editados a partir desta interface' : isCurrentUser ? 'Não editável' : 'Editar utilizador'}
                              disabled={isAdmin || isCurrentUser}
                              onClick={() => setEditUser(p)}
                            ><Pencil size={16} /></button>
                            <button
                              className="adm-icon-btn"
                              title={isAdmin ? 'Admin tem acesso total' : 'Editar permissões'}
                              disabled={isAdmin}
                              onClick={() => setPermModal({ userId: p.id, userName: p.full_name || p.email || p.id, userRole: p.role })}
                            ><Lock size={15} /></button>
                            <button
                              className="adm-icon-btn"
                              title={isCurrentUser ? 'Não pode forçar reset da própria conta' : 'Forçar reset de password'}
                              disabled={isCurrentUser}
                              onClick={() => requestResetPassword(p.id, p.full_name, p.email || '')}
                            ><Key size={15} /></button>
                            <button
                              className="adm-icon-btn"
                              title={isAdmin ? 'Utilizadores Admin não podem ser eliminados a partir desta interface' : isCurrentUser ? 'Não pode remover a própria conta' : 'Remover'}
                              disabled={isAdmin || isCurrentUser}
                              style={{ color: isAdmin || isCurrentUser ? undefined : 'var(--red)' }}
                              onClick={() => requestDeleteProfile(p.id, p.full_name)}
                            ><Trash2 size={16} /></button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {profiles.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic', padding: '20px 0' }}>Sem utilizadores</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>

      {/* ── Edit user modal ── */}
      {editUser && (
        <EditUserModal
          open
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { void loadProfiles() }}
        />
      )}

      {/* ── User permissions modal ── */}
      {permModal && (
        <UserPermissionsModal
          userId={permModal.userId}
          userName={permModal.userName}
          userRole={permModal.userRole}
          isOpen={!!permModal}
          onClose={() => setPermModal(null)}
        />
      )}

      {/* ── Invite user modal ── */}
      <InviteUserModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => { void loadProfiles() }}
      />

      {/* ── Delete user confirmation ── */}
      {deleteConfirm && (
        <ConfirmModal
          open
          title="Remover utilizador"
          message={`Tem a certeza que pretende remover ${deleteConfirm.name}? Esta acção é permanente e não pode ser desfeita. Todas as permissões associadas serão também eliminadas.`}
          confirmLabel="Remover"
          cancelLabel="Cancelar"
          destructive
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* ── Force reset password confirmation ── */}
      {resetConfirm && (
        <ConfirmModal
          open
          title="Forçar reset de password"
          message={`Pretende enviar um email de reset de password para ${resetConfirm.name} (${resetConfirm.email})? O utilizador receberá um link para definir uma nova palavra-passe.`}
          confirmLabel="Enviar email"
          cancelLabel="Cancelar"
          loading={resetting}
          onConfirm={handleConfirmReset}
          onCancel={() => setResetConfirm(null)}
        />
      )}
    </>
  )
}

// ── Section 4: Recursos ───────────────────────────────────────
type RecursosTab = 'perfis' | 'unidades' | 'cargos' | 'pessoas'

interface DraftPerson {
  id:                     string | null
  name:                   string
  email:                  string
  company:                string
  is_external:            boolean
  org_unit:               string
  role:                   string
  cost_role_id:           string   // '' = none
  cost_per_hour_override: string   // '' = none, parsed to number on save
  profile_id:             string | null
}

interface DraftCostRole {
  id:           string | null
  name:         string
  cost_per_hour: string
  currency:     string
  is_active:    boolean
}

// ── Cargos sub-tab ─────────────────────────────────────────────
function CostRolesTab() {
  const { showToast } = useToast()
  const [costRoles,       setCostRoles]       = useState<CostRole[]>([])
  const [loading,         setLoading]         = useState(true)
  const [draft,           setDraft]           = useState<DraftCostRole | null>(null)
  const [errMsg,          setErrMsg]          = useState('')
  const [costRoleDeleteConfirm, setCostRoleDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [defaultCurrency,       setDefaultCurrency]       = useState('EUR')
  const [defaultCurrencySymbol, setDefaultCurrencySymbol] = useState('€')

  function showErr(msg: string) {
    setErrMsg(msg)
    setTimeout(() => setErrMsg(''), 3000)
  }

  async function loadCostRoles() {
    setLoading(true)
    const { data } = await supabase.from('cost_roles').select('*').order('name')
    setCostRoles((data ?? []) as CostRole[])
    setLoading(false)
  }

  useEffect(() => {
    loadCostRoles()
    supabase.from('currencies').select('code, symbol, is_default').order('code')
      .then(({ data }) => {
        const def = (data ?? []).find((r: { code: string; symbol: string; is_default: boolean }) => r.is_default)
        if (def) { setDefaultCurrency(def.code); setDefaultCurrencySymbol(def.symbol) }
      })
  }, [])

  async function saveCostRole() {
    if (!draft || !draft.name.trim()) return
    const payload = {
      name:          draft.name.trim(),
      cost_per_hour: parseFloat(draft.cost_per_hour) || 0,
      currency:      draft.currency.trim() || 'EUR',
      is_active:     draft.is_active,
    }
    if (draft.id) {
      const { error } = await supabase.from('cost_roles').update(payload).eq('id', draft.id)
      if (error) { showErr(error.message); return }
    } else {
      const { error } = await supabase.from('cost_roles').insert(payload)
      if (error) { showErr(error.message); return }
    }
    showToast(draft.id ? 'Cargo actualizado.' : 'Cargo criado.', 'success')
    setDraft(null)
    await loadCostRoles()
  }

  function requestDeleteCostRole(id: string, name: string) {
    setCostRoleDeleteConfirm({ id, name })
  }

  async function handleConfirmDeleteCostRole() {
    if (!costRoleDeleteConfirm) return
    const { error } = await supabase.from('cost_roles').delete().eq('id', costRoleDeleteConfirm.id)
    if (error) { showErr(error.message); setCostRoleDeleteConfirm(null); return }
    setCostRoleDeleteConfirm(null)
    await loadCostRoles()
  }

  return (
    <>
      <p className="adm-help" style={{ marginBottom: 8 }}>
        Cargos com custo/hora padrão. Atribuir a uma pessoa define o custo base de alocação.
      </p>
      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : (
        <div style={{ margin: '-16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Cargo</th>
                <th style={{ width: 100 }}>{defaultCurrencySymbol}/hora</th>
                <th style={{ width: 60 }}>Moeda</th>
                <th style={{ width: 56 }}>Activo</th>
                <th style={{ width: 72 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {costRoles.map(cr => {
                const editing = draft?.id === cr.id
                return (
                  <tr key={cr.id} className={editing ? 'editing' : undefined}>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" autoFocus value={draft!.name}
                          onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCostRole(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : cr.name}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" type="number" min={0} value={draft!.cost_per_hour}
                          onChange={e => setDraft(d => d ? { ...d, cost_per_hour: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCostRole(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cr.cost_per_hour}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.currency} style={{ width: 50 }}
                          onChange={e => setDraft(d => d ? { ...d, currency: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCostRole(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : cr.currency}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {editing ? (
                        <input type="checkbox" checked={draft!.is_active}
                          onChange={e => setDraft(d => d ? { ...d, is_active: e.target.checked } : d)} />
                      ) : (
                        <span style={{ color: cr.is_active ? 'var(--green)' : 'var(--text3)' }}>
                          {cr.is_active ? '●' : '○'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={saveCostRole}><Check size={14} strokeWidth={1.5} /></button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: cr.id, name: cr.name, cost_per_hour: String(cr.cost_per_hour), currency: cr.currency, is_active: cr.is_active })}><Pencil size={16} /></button>
                          <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
                            onClick={() => requestDeleteCostRole(cr.id, cr.name)}><Trash2 size={16} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {draft !== null && draft.id === null && (
                <tr className="editing">
                  <td><input className="adm-row-input" autoFocus placeholder="Nome do cargo *"
                    value={draft.name}
                    onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCostRole(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td><input className="adm-row-input" type="number" min={0} placeholder="0"
                    value={draft.cost_per_hour}
                    onChange={e => setDraft(d => d ? { ...d, cost_per_hour: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCostRole(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td><input className="adm-row-input" placeholder="EUR" value={draft.currency} style={{ width: 50 }}
                    onChange={e => setDraft(d => d ? { ...d, currency: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCostRole(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={draft.is_active}
                      onChange={e => setDraft(d => d ? { ...d, is_active: e.target.checked } : d)} />
                  </td>
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={saveCostRole}><Check size={14} strokeWidth={1.5} /></button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer">
            <button className="adm-add-btn" disabled={draft !== null}
              onClick={() => setDraft({ id: null, name: '', cost_per_hour: '', currency: defaultCurrency, is_active: true })}>
              + Novo Cargo
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={costRoleDeleteConfirm !== null}
        title="Remover cargo"
        message={`Remover "${costRoleDeleteConfirm?.name ?? ''}"?`}
        confirmLabel="Remover"
        destructive
        onConfirm={handleConfirmDeleteCostRole}
        onCancel={() => setCostRoleDeleteConfirm(null)}
      />
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

// ── Shared: editable string-list backed by app_config ──────────
function StringListEditor({ configKey, label, defaults = [] }: { configKey: string; label: string; defaults?: string[] }) {
  const { showToast } = useToast()
  const [items,   setItems]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .eq('config_key', configKey)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setLoading(false)
        if (!data) { setItems(defaults); return }
        try { setItems(JSON.parse(data.data) as string[]) } catch { setItems(defaults) }
      }, () => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [configKey])

  function update(idx: number, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? val : it))
  }

  function remove(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    setSaving(true)
    try {
      const filtered = items.map(s => s.trim()).filter(Boolean)
      await supabase.from('app_config').upsert(
        { config_key: configKey, data: JSON.stringify(filtered) },
        { onConflict: 'config_key' },
      )
      setItems(filtered)
      showToast('Guardado!')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="adm-help">A carregar…</p>

  return (
    <>
      <p className="adm-section-desc">{label}</p>
      {items.map((item, idx) => (
        <div key={idx} className="adm-list-item">
          <input
            className="adm-list-input"
            value={item}
            onChange={e => update(idx, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
          />
          <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
            onClick={() => remove(idx)}><Trash2 size={16} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
        <button className="adm-add-btn" onClick={() => setItems(prev => [...prev, ''])}>
          + Adicionar
        </button>
        <button className="btn-primary btn-lg" onClick={save} disabled={saving}>
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </>
  )
}

// ── Pessoas sub-tab ────────────────────────────────────────────
function PessoasTab() {
  const [people,          setPeople]          = useState<Person[]>([])
  const [loading,         setLoading]         = useState(true)
  const [draft,           setDraft]           = useState<DraftPerson | null>(null)
  const [errMsg,          setErrMsg]          = useState('')
  const [personDeleteConfirm, setPersonDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [profOpts,        setProfOpts]        = useState<string[]>([])
  const [unitOpts,        setUnitOpts]        = useState<string[]>([])
  const [costRoles,       setCostRoles]       = useState<CostRole[]>([])
  const [defaultCurrency,       setDefaultCurrency]       = useState('EUR')
  const [defaultCurrencySymbol, setDefaultCurrencySymbol] = useState('€')
  const [currSymbolMap,         setCurrSymbolMap]         = useState<Map<string, string>>(new Map())
  const [authProfiles,    setAuthProfiles]    = useState<{ id: string; full_name: string | null; email: string }[]>([])

  function showErr(msg: string) {
    setErrMsg(msg)
    setTimeout(() => setErrMsg(''), 3000)
  }

  async function loadPeople() {
    setLoading(true)
    const { data } = await supabase
      .from('people')
      .select('id, name, email, org_unit, role, company, is_external, notes, active, sort_order, cost_role_id, cost_per_hour_override, currency, profile_id')
      .order('name')
    setPeople((data ?? []) as Person[])
    setLoading(false)
  }

  useEffect(() => {
    supabase.from('cost_roles').select('*').order('name')
      .then(({ data }) => setCostRoles((data ?? []) as CostRole[]))
    supabase.from('currencies').select('code, symbol, is_default').order('code')
      .then(({ data }) => {
        const rows = data as { code: string; symbol: string; is_default: boolean }[] ?? []
        const map = new Map(rows.map(r => [r.code, r.symbol]))
        setCurrSymbolMap(map)
        const def = rows.find(r => r.is_default)
        if (def) { setDefaultCurrency(def.code); setDefaultCurrencySymbol(def.symbol) }
      })
    supabase.from('profiles').select('id, full_name, email').order('full_name')
      .then(({ data }) => setAuthProfiles((data ?? []) as { id: string; full_name: string | null; email: string }[]))
  }, [])

  useEffect(() => { loadPeople() }, [])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .in('config_key', ['resource_profiles', 'org_units'])
      .then(({ data }) => {
        if (cancelled || !data) return
        for (const row of data) {
          try {
            const arr = JSON.parse(row.data) as string[]
            if (row.config_key === 'resource_profiles') setProfOpts(arr)
            if (row.config_key === 'org_units')         setUnitOpts(arr)
          } catch { /* leave empty — fallback to text input */ }
        }
      })
    return () => { cancelled = true }
  }, [])

  async function savePerson() {
    if (!draft || !draft.name.trim()) return
    const payload = {
      name:                   draft.name.trim(),
      email:                  draft.email.trim() || null,
      company:                draft.company.trim() || null,
      is_external:            draft.is_external,
      org_unit:               draft.org_unit.trim() || null,
      role:                   draft.role.trim() || null,
      cost_role_id:           draft.cost_role_id || null,
      cost_per_hour_override: draft.cost_per_hour_override !== '' ? parseFloat(draft.cost_per_hour_override) : null,
      profile_id:             draft.profile_id || null,
    }
    if (draft.id) {
      const { error } = await supabase.from('people').update(payload).eq('id', draft.id)
      if (error) { showErr(error.message); return }
    } else {
      const { error } = await supabase.from('people').insert({ ...payload, sort_order: 0, active: true, currency: defaultCurrency })
      if (error) { showErr(error.message); return }
    }
    setDraft(null)
    await loadPeople()
  }

  function requestDeletePerson(id: string, name: string) {
    setPersonDeleteConfirm({ id, name })
  }

  async function handleConfirmDeletePerson() {
    if (!personDeleteConfirm) return
    await supabase.from('people').delete().eq('id', personDeleteConfirm.id)
    setPersonDeleteConfirm(null)
    await loadPeople()
  }

  return (
    <>
      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : (
        <div style={{ margin: '-16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th style={{ minWidth: 160 }}>Utilizador</th>
                <th>Email</th>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Unidade</th>
                <th>Perfil</th>
                <th style={{ width: 140 }}>Cargo / Custo</th>
                <th style={{ width: 72 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {people.map(p => {
                const editing = draft?.id === p.id
                return (
                  <tr key={p.id} className={editing ? 'editing' : undefined}>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" autoFocus value={draft!.name}
                          onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (p.name || '—')}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      {editing ? (
                        <SearchableSelect
                          options={authProfiles.map((ap): SelectOption => ({
                            value: ap.id,
                            label: ap.full_name ? `${ap.full_name} (${ap.email})` : ap.email,
                          }))}
                          value={draft!.profile_id}
                          onChange={v => {
                            if (v) {
                              const linked = authProfiles.find(ap => ap.id === v)
                              setDraft(d => d ? { ...d, profile_id: v, email: linked?.email ?? d.email } : d)
                            } else {
                              setDraft(d => d ? { ...d, profile_id: null } : d)
                            }
                          }}
                          placeholder="— sem utilizador —"
                        />
                      ) : (() => {
                        if (!p.profile_id) return '—'
                        const linked = authProfiles.find(ap => ap.id === p.profile_id)
                        if (!linked) return '(eliminado)'
                        return linked.full_name || linked.email
                      })()}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {editing ? (
                        <input
                          className={draft!.profile_id ? 'adm-row-input adm-row-input--linked' : 'adm-row-input'}
                          disabled={!!draft!.profile_id}
                          value={draft!.email}
                          onChange={e => setDraft(d => d ? { ...d, email: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }}
                        />
                      ) : (p.email || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.company}
                          onChange={e => setDraft(d => d ? { ...d, company: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (p.company || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <select className="styled-select-sm" value={draft!.is_external ? 'ext' : 'int'}
                          onChange={e => setDraft(d => d ? { ...d, is_external: e.target.value === 'ext' } : d)}>
                          <option value="int">Interno</option>
                          <option value="ext">Externo</option>
                        </select>
                      ) : (p.is_external ? 'Externo' : 'Interno')}
                    </td>
                    <td>
                      {editing ? (
                        unitOpts.length > 0 ? (
                          <select className="styled-select-sm" value={draft!.org_unit}
                            onChange={e => setDraft(d => d ? { ...d, org_unit: e.target.value } : d)}>
                            <option value="">— seleccionar —</option>
                            {unitOpts.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        ) : (
                          <input className="adm-row-input" value={draft!.org_unit}
                            onChange={e => setDraft(d => d ? { ...d, org_unit: e.target.value } : d)}
                            onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                        )
                      ) : (p.org_unit || '—')}
                    </td>
                    <td>
                      {editing ? (
                        profOpts.length > 0 ? (
                          <select className="styled-select-sm" value={draft!.role}
                            onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)}>
                            <option value="">— seleccionar —</option>
                            {profOpts.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                          </select>
                        ) : (
                          <input className="adm-row-input" value={draft!.role}
                            onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)}
                            onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                        )
                      ) : (p.role || '—')}
                    </td>
                    <td style={{ width: 140 }}>
                      {editing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <select className="styled-select-sm" value={draft!.cost_role_id}
                            onChange={e => setDraft(d => d ? { ...d, cost_role_id: e.target.value } : d)}>
                            <option value="">— sem cargo —</option>
                            {costRoles.filter(cr => cr.is_active).map(cr => (
                              <option key={cr.id} value={cr.id}>{cr.name}</option>
                            ))}
                          </select>
                          <input className="adm-row-input" type="number" min={0} placeholder={`Override ${defaultCurrencySymbol}/h`}
                            value={draft!.cost_per_hour_override}
                            onChange={e => setDraft(d => d ? { ...d, cost_per_hour_override: e.target.value } : d)}
                            onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                        </div>
                      ) : (() => {
                        const cr = costRoles.find(r => r.id === p.cost_role_id)
                        const resolved = p.cost_per_hour_override ?? cr?.cost_per_hour
                        return (
                          <span style={{ fontSize: 12 }}>
                            {cr ? cr.name : '—'}
                            {resolved != null && resolved > 0 && (
                              <span style={{ marginLeft: 4, color: 'var(--text2)' }}>
                                {p.cost_per_hour_override != null ? '* ' : ''}{resolved}{currSymbolMap.get(cr?.currency ?? defaultCurrency) ?? cr?.currency ?? ''}/h
                              </span>
                            )}
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={savePerson}><Check size={14} strokeWidth={1.5} /></button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: p.id, name: p.name, email: p.email ?? '', company: p.company ?? '', is_external: p.is_external ?? false, org_unit: p.org_unit ?? '', role: p.role ?? '', cost_role_id: p.cost_role_id ?? '', cost_per_hour_override: p.cost_per_hour_override != null ? String(p.cost_per_hour_override) : '', profile_id: p.profile_id ?? null })}><Pencil size={16} /></button>
                          <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
                            onClick={() => requestDeletePerson(p.id, p.name)}><Trash2 size={16} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {draft !== null && draft.id === null && (
                <tr className="editing">
                  <td><input className="adm-row-input" autoFocus placeholder="Nome *"
                    value={draft.name}
                    onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <SearchableSelect
                      options={authProfiles.map((ap): SelectOption => ({
                        value: ap.id,
                        label: ap.full_name ? `${ap.full_name} (${ap.email})` : ap.email,
                      }))}
                      value={draft.profile_id}
                      onChange={v => {
                        if (v) {
                          const linked = authProfiles.find(ap => ap.id === v)
                          setDraft(d => d ? { ...d, profile_id: v, email: linked?.email ?? d.email } : d)
                        } else {
                          setDraft(d => d ? { ...d, profile_id: null } : d)
                        }
                      }}
                      placeholder="— sem utilizador —"
                    />
                  </td>
                  <td><input
                    className={draft.profile_id ? 'adm-row-input adm-row-input--linked' : 'adm-row-input'}
                    disabled={!!draft.profile_id}
                    placeholder={draft.profile_id ? 'Email do utilizador' : 'Email'}
                    value={draft.email}
                    onChange={e => setDraft(d => d ? { ...d, email: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td><input className="adm-row-input" placeholder="Empresa"
                    value={draft.company}
                    onChange={e => setDraft(d => d ? { ...d, company: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td>
                    <select className="styled-select-sm" value={draft.is_external ? 'ext' : 'int'}
                      onChange={e => setDraft(d => d ? { ...d, is_external: e.target.value === 'ext' } : d)}>
                      <option value="int">Interno</option>
                      <option value="ext">Externo</option>
                    </select>
                  </td>
                  <td>
                    {unitOpts.length > 0 ? (
                      <select className="styled-select-sm" value={draft.org_unit}
                        onChange={e => setDraft(d => d ? { ...d, org_unit: e.target.value } : d)}>
                        <option value="">— seleccionar —</option>
                        {unitOpts.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <input className="adm-row-input" placeholder="Unidade"
                        value={draft.org_unit}
                        onChange={e => setDraft(d => d ? { ...d, org_unit: e.target.value } : d)}
                        onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                    )}
                  </td>
                  <td>
                    {profOpts.length > 0 ? (
                      <select className="styled-select-sm" value={draft.role}
                        onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)}>
                        <option value="">— seleccionar —</option>
                        {profOpts.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                      </select>
                    ) : (
                      <input className="adm-row-input" placeholder="Perfil"
                        value={draft.role}
                        onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)}
                        onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                    )}
                  </td>
                  <td style={{ width: 140 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <select className="styled-select-sm" value={draft.cost_role_id}
                        onChange={e => setDraft(d => d ? { ...d, cost_role_id: e.target.value } : d)}>
                        <option value="">— sem cargo —</option>
                        {costRoles.filter(cr => cr.is_active).map(cr => (
                          <option key={cr.id} value={cr.id}>{cr.name}</option>
                        ))}
                      </select>
                      <input className="adm-row-input" type="number" min={0} placeholder={`Override ${defaultCurrencySymbol}/h`}
                        value={draft.cost_per_hour_override}
                        onChange={e => setDraft(d => d ? { ...d, cost_per_hour_override: e.target.value } : d)}
                        onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                    </div>
                  </td>
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={savePerson}><Check size={14} strokeWidth={1.5} /></button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer">
            <button
              className="adm-add-btn"
              disabled={draft !== null}
              onClick={() => setDraft({ id: null, name: '', email: '', company: '', is_external: false, org_unit: '', role: '', cost_role_id: '', cost_per_hour_override: '', profile_id: null })}
            >
              + Nova Pessoa
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={personDeleteConfirm !== null}
        title="Remover pessoa"
        message={`Remover "${personDeleteConfirm?.name ?? ''}"?`}
        confirmLabel="Remover"
        destructive
        onConfirm={handleConfirmDeletePerson}
        onCancel={() => setPersonDeleteConfirm(null)}
      />
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

function AdminRecursos() {
  const [tab, setTab] = useState<RecursosTab>('perfis')

  return (
    <Card title="Recursos">
      <div className="adm-tabs">
        {(['perfis', 'unidades', 'cargos', 'pessoas'] as RecursosTab[]).map(t => (
          <button
            key={t}
            className={`adm-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'perfis' ? 'Perfis' : t === 'unidades' ? 'Unidades' : t === 'cargos' ? 'Cargos' : 'Recursos'}
          </button>
        ))}
      </div>

      {tab === 'perfis'   && <StringListEditor configKey="resource_profiles" label="Perfis de recursos disponíveis" />}
      {tab === 'unidades' && <StringListEditor configKey="org_units"         label="Unidades organizacionais" />}
      {tab === 'cargos'   && <CostRolesTab />}
      {tab === 'pessoas'  && <PessoasTab />}
    </Card>
  )
}

// ── Section 5: Financeiro ─────────────────────────────────────
type FinTab = 'moedas' | 'categorias' | 'anos' | 'alertas'

interface Currency     { id: string; code: string; name: string; symbol: string; is_default: boolean }
interface CostCategory { id: string; name: string; is_capex: boolean }
interface ManagementYear { id: string; program_id: string; year: number }
interface DraftCurrency  { id: string | null; code: string; name: string; symbol: string }
interface DraftCategory  { id: string | null; name: string; is_capex: boolean; programIds: string[] }

// ── Tab: Moedas ────────────────────────────────────────────────
function MoedasTab() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading,    setLoading]    = useState(true)
  const [draft,      setDraft]      = useState<DraftCurrency | null>(null)
  const [errMsg,     setErrMsg]     = useState('')
  const [currencyDeleteConfirm, setCurrencyDeleteConfirm] = useState<{ id: string; code: string } | null>(null)

  function showErr(msg: string) { setErrMsg(msg); setTimeout(() => setErrMsg(''), 3000) }

  async function loadCurrencies() {
    setLoading(true)
    const { data } = await supabase
      .from('currencies')
      .select('id, code, name, symbol, is_default')
      .order('code')
    const rows = (data ?? []) as Currency[]
    if (rows.length === 0) {
      await supabase.from('currencies').insert([
        { code: 'EUR', name: 'Euro',              symbol: '€',  is_default: true  },
        { code: 'USD', name: 'Dólar Americano',   symbol: '$',  is_default: false },
        { code: 'AKZ', name: 'Kwanza Angolano',   symbol: 'Kz', is_default: false },
      ])
      const { data: seeded } = await supabase
        .from('currencies').select('id, code, name, symbol, is_default').order('code')
      setCurrencies((seeded ?? []) as Currency[])
    } else {
      setCurrencies(rows)
    }
    setLoading(false)
  }

  useEffect(() => { loadCurrencies() }, [])

  async function setDefault(id: string) {
    setCurrencies(prev => prev.map(c => ({ ...c, is_default: c.id === id })))
    await Promise.all([
      supabase.from('currencies').update({ is_default: false }).neq('id', id),
      supabase.from('currencies').update({ is_default: true  }).eq('id', id),
    ])
  }

  async function saveCurrency() {
    if (!draft || !draft.code.trim() || !draft.name.trim()) return
    const payload = {
      code:   draft.code.trim().toUpperCase().slice(0, 3),
      name:   draft.name.trim(),
      symbol: draft.symbol.trim().slice(0, 4),
    }
    if (draft.id) {
      await supabase.from('currencies').update(payload).eq('id', draft.id)
    } else {
      await supabase.from('currencies').insert({ ...payload, is_default: false })
    }
    setDraft(null)
    await loadCurrencies()
  }

  function requestDeleteCurrency(c: Currency) {
    if (c.is_default) { showErr('Não é possível apagar a moeda padrão'); return }
    setCurrencyDeleteConfirm({ id: c.id, code: c.code })
  }

  async function handleConfirmDeleteCurrency() {
    if (!currencyDeleteConfirm) return
    await supabase.from('currencies').delete().eq('id', currencyDeleteConfirm.id)
    setCurrencyDeleteConfirm(null)
    await loadCurrencies()
  }

  return (
    <>
      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : (
        <div style={{ margin: '-16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Código</th>
                <th>Nome</th>
                <th style={{ width: 64 }}>Símbolo</th>
                <th style={{ width: 70, textAlign: 'center' }}>Default</th>
                <th style={{ width: 72 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map(c => {
                const editing = draft?.id === c.id
                return (
                  <tr key={c.id} className={editing ? 'editing' : undefined}>
                    <td>
                      {editing ? (
                        <input className="adm-row-input adm-input-uppercase" autoFocus maxLength={3}
                          value={draft!.code}
                          onChange={ev => setDraft(d => d ? { ...d, code: ev.target.value } : d)}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveCurrency(); if (ev.key === 'Escape') setDraft(null) }} />
                      ) : c.code}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.name}
                          onChange={ev => setDraft(d => d ? { ...d, name: ev.target.value } : d)}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveCurrency(); if (ev.key === 'Escape') setDraft(null) }} />
                      ) : c.name}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" maxLength={4} placeholder="€"
                          value={draft!.symbol}
                          onChange={ev => setDraft(d => d ? { ...d, symbol: ev.target.value } : d)}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveCurrency(); if (ev.key === 'Escape') setDraft(null) }} />
                      ) : c.symbol}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="radio" className="adm-radio"
                        checked={c.is_default} onChange={() => setDefault(c.id)} />
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={saveCurrency}><Check size={14} strokeWidth={1.5} /></button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: c.id, code: c.code, name: c.name, symbol: c.symbol || '' })}><Pencil size={16} /></button>
                          <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                            onClick={() => requestDeleteCurrency(c)}><Trash2 size={16} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {draft !== null && draft.id === null && (
                <tr className="editing">
                  <td>
                    <input className="adm-row-input" autoFocus maxLength={3}
                      style={{ textTransform: 'uppercase' }} placeholder="EUR"
                      value={draft.code}
                      onChange={ev => setDraft(d => d ? { ...d, code: ev.target.value } : d)}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveCurrency(); if (ev.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td>
                    <input className="adm-row-input" placeholder="Nome"
                      value={draft.name}
                      onChange={ev => setDraft(d => d ? { ...d, name: ev.target.value } : d)}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveCurrency(); if (ev.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td>
                    <input className="adm-row-input" maxLength={4} placeholder="€"
                      value={draft.symbol}
                      onChange={ev => setDraft(d => d ? { ...d, symbol: ev.target.value } : d)}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveCurrency(); if (ev.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td />
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={saveCurrency}><Check size={14} strokeWidth={1.5} /></button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer">
            <button className="adm-add-btn" disabled={draft !== null}
              onClick={() => setDraft({ id: null, code: '', name: '', symbol: '' })}>
              + Nova Moeda
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={currencyDeleteConfirm !== null}
        title="Apagar moeda"
        message={`Apagar moeda ${currencyDeleteConfirm?.code ?? ''}?`}
        confirmLabel="Apagar"
        destructive
        onConfirm={handleConfirmDeleteCurrency}
        onCancel={() => setCurrencyDeleteConfirm(null)}
      />
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

// ── Tab: Categorias de Custo ───────────────────────────────────
interface ProgTabProps { programs: Program[]; progsLoading: boolean }


function CategoriasTab({ programs }: ProgTabProps) {
  const [categories,       setCategories]       = useState<CostCategory[]>([])
  const [categoryPrograms, setCategoryPrograms] = useState<Record<string, string[]>>({})
  const [loading,          setLoading]          = useState(true)
  const [draft,            setDraft]            = useState<DraftCategory | null>(null)
  const [errMsg,           setErrMsg]           = useState('')
  const [categoryDeleteConfirm, setCategoryDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  function showErr(msg: string) { setErrMsg(msg); setTimeout(() => setErrMsg(''), 3000) }

  async function loadAll() {
    const [catRes, linkRes] = await Promise.all([
      supabase.from('cost_categories').select('id, name, is_capex').order('name'),
      supabase.from('cost_category_programs').select('category_id, program_id'),
    ])
    setCategories((catRes.data ?? []) as CostCategory[])
    const map: Record<string, string[]> = {}
    for (const row of (linkRes.data ?? []) as { category_id: string; program_id: string }[]) {
      if (!map[row.category_id]) map[row.category_id] = []
      map[row.category_id].push(row.program_id)
    }
    setCategoryPrograms(map)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAll().then(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function toggleCapex(cat: CostCategory) {
    const newVal = !cat.is_capex
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_capex: newVal } : c))
    await supabase.from('cost_categories').update({ is_capex: newVal }).eq('id', cat.id)
  }

  async function saveCategory() {
    if (!draft || !draft.name.trim() || draft.programIds.length === 0) return
    const payload = { name: draft.name.trim(), is_capex: draft.is_capex }
    let savedId: string
    if (draft.id) {
      const { error } = await supabase.from('cost_categories').update(payload).eq('id', draft.id)
      if (error) { showErr(error.message); return }
      savedId = draft.id
    } else {
      const { data: inserted, error } = await supabase
        .from('cost_categories').insert(payload).select('id').single()
      if (error || !inserted) { showErr(error?.message ?? 'Erro ao criar'); return }
      savedId = (inserted as { id: string }).id
    }
    // Re-sync join table: delete old links, then insert new
    await supabase.from('cost_category_programs').delete().eq('category_id', savedId)
    const { error: linkErr } = await supabase.from('cost_category_programs').insert(
      draft.programIds.map(pid => ({ category_id: savedId, program_id: pid }))
    )
    if (linkErr) { showErr(linkErr.message); return }
    setDraft(null)
    await loadAll()
  }

  function requestDeleteCategory(id: string, name: string) {
    setCategoryDeleteConfirm({ id, name })
  }

  async function handleConfirmDeleteCategory() {
    if (!categoryDeleteConfirm) return
    const { id } = categoryDeleteConfirm
    await supabase.from('cost_categories').delete().eq('id', id)
    setCategoryDeleteConfirm(null)
    setCategories(prev => prev.filter(c => c.id !== id))
    setCategoryPrograms(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function renderProgramChecklist(selectedIds: string[], onChange: (ids: string[]) => void) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {programs.map(p => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedIds.includes(p.id)}
              onChange={e => {
                const next = e.target.checked
                  ? [...selectedIds, p.id]
                  : selectedIds.filter(id => id !== p.id)
                if (next.length === 0) return  // at least 1 required
                onChange(next)
              }}
            />
            {p.name}
          </label>
        ))}
        {programs.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sem programas</span>}
      </div>
    )
  }

  return (
    <>
      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : (
        <div style={{ margin: '0 -16px -16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th style={{ width: 80 }}>Tipo</th>
                <th>Programas</th>
                <th style={{ width: 72 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const editing    = draft?.id === cat.id
                const catProgIds = categoryPrograms[cat.id] ?? []
                return (
                  <tr key={cat.id} className={editing ? 'editing' : undefined}>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" autoFocus value={draft!.name}
                          onChange={ev => setDraft(d => d ? { ...d, name: ev.target.value } : d)}
                          onKeyDown={ev => { if (ev.key === 'Enter') saveCategory(); if (ev.key === 'Escape') setDraft(null) }} />
                      ) : cat.name}
                    </td>
                    <td>
                      <span className="adm-toggle-badge"
                        onClick={() => editing
                          ? setDraft(d => d ? { ...d, is_capex: !d.is_capex } : d)
                          : toggleCapex(cat)}
                        style={{
                          background: (editing ? draft!.is_capex : cat.is_capex) ? 'var(--blue-bg)' : 'var(--amber-bg)',
                          color:      (editing ? draft!.is_capex : cat.is_capex) ? 'var(--blue)' : 'var(--amber)',
                        }}
                      >
                        {(editing ? draft!.is_capex : cat.is_capex) ? 'CAPEX' : 'OPEX'}
                      </span>
                    </td>
                    <td>
                      {editing ? (
                        renderProgramChecklist(draft!.programIds, ids => setDraft(d => d ? { ...d, programIds: ids } : d))
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {catProgIds.length > 0
                            ? catProgIds.map(id => programs.find(p => p.id === id)?.name ?? id).join(', ')
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={saveCategory}><Check size={14} strokeWidth={1.5} /></button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: cat.id, name: cat.name, is_capex: cat.is_capex, programIds: catProgIds })}><Pencil size={16} /></button>
                          <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
                            onClick={() => requestDeleteCategory(cat.id, cat.name)}><Trash2 size={16} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {draft !== null && draft.id === null && (
                <tr className="editing">
                  <td>
                    <input className="adm-row-input" autoFocus placeholder="Nome da categoria"
                      value={draft.name}
                      onChange={ev => setDraft(d => d ? { ...d, name: ev.target.value } : d)}
                      onKeyDown={ev => { if (ev.key === 'Enter') saveCategory(); if (ev.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td>
                    <span className="adm-toggle-badge"
                      onClick={() => setDraft(d => d ? { ...d, is_capex: !d.is_capex } : d)}
                      style={{
                        background: draft.is_capex ? 'var(--blue-bg)' : 'var(--amber-bg)',
                        color:      draft.is_capex ? 'var(--blue)' : 'var(--amber)',
                      }}
                    >
                      {draft.is_capex ? 'CAPEX' : 'OPEX'}
                    </span>
                  </td>
                  <td>
                    {renderProgramChecklist(draft.programIds, ids => setDraft(d => d ? { ...d, programIds: ids } : d))}
                  </td>
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={saveCategory}><Check size={14} strokeWidth={1.5} /></button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}><X size={16} /></button>
                    </span>
                  </td>
                </tr>
              )}
              {categories.length === 0 && draft === null && (
                <tr><td colSpan={4} className="adm-empty-panel">Sem categorias</td></tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer">
            <button className="adm-add-btn" disabled={draft !== null}
              onClick={() => setDraft({ id: null, name: '', is_capex: false, programIds: programs.length > 0 ? [programs[0].id] : [] })}>
              + Nova Categoria
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={categoryDeleteConfirm !== null}
        title="Remover categoria"
        message={`Remover "${categoryDeleteConfirm?.name ?? ''}"?`}
        confirmLabel="Remover"
        destructive
        onConfirm={handleConfirmDeleteCategory}
        onCancel={() => setCategoryDeleteConfirm(null)}
      />
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

// ── Tab: Anos de Gestão ────────────────────────────────────────
function AnosTab({ programs, progsLoading }: ProgTabProps) {
  const [selProgId, setSelProgId] = useState<string | null>(null)
  const [years,     setYears]     = useState<ManagementYear[]>([])
  const [loading,   setLoading]   = useState(false)
  const [newYear,   setNewYear]   = useState('')
  const [errMsg,    setErrMsg]    = useState('')

  function showErr(msg: string) { setErrMsg(msg); setTimeout(() => setErrMsg(''), 3000) }

  useEffect(() => {
    if (programs.length > 0 && !selProgId) setSelProgId(programs[0].id)
  }, [programs, selProgId])

  useEffect(() => {
    if (!selProgId) return
    let cancelled = false
    setLoading(true)
    setNewYear('')
    supabase.from('management_years')
      .select('id, program_id, year')
      .eq('program_id', selProgId)
      .order('year')
      .then(({ data }) => {
        if (cancelled) return
        setYears((data ?? []) as ManagementYear[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [selProgId])

  async function addYear() {
    const y = parseInt(newYear, 10)
    if (!selProgId || isNaN(y) || y < 2020 || y > 2040) { showErr('Ano inválido (2020–2040)'); return }
    if (years.some(ey => ey.year === y)) { showErr('Esse ano já existe'); return }
    const { data } = await supabase.from('management_years')
      .insert({ program_id: selProgId, year: y })
      .select('id, program_id, year')
      .single()
    if (data) setYears(prev => [...prev, data as ManagementYear].sort((a, b) => a.year - b.year))
    setNewYear('')
  }

  async function deleteYear(id: string) {
    await supabase.from('management_years').delete().eq('id', id)
    setYears(prev => prev.filter(y => y.id !== id))
  }

  return (
    <>
      <div className="adm-program-bar">
        <span>Programa:</span>
        {progsLoading ? <span className="adm-help">A carregar…</span> : (
          <select className="adm-select" value={selProgId ?? ''}
            onChange={e => setSelProgId(e.target.value || null)}>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            {programs.length === 0 && <option value="">Sem programas</option>}
          </select>
        )}
      </div>
      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : (
        <div style={{ margin: '0 -16px -16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Ano</th>
                <th style={{ width: 72 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {years.map(y => (
                <tr key={y.id}>
                  <td style={{ fontWeight: 500 }}>{y.year}</td>
                  <td>
                    <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
                      onClick={() => deleteYear(y.id)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {years.length === 0 && (
                <tr><td colSpan={2} className="adm-empty-panel">Sem anos configurados</td></tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="adm-row-input"
              type="number" min={2020} max={2040}
              placeholder="AAAA"
              value={newYear}
              style={{ width: 80 }}
              onChange={e => setNewYear(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addYear() }}
            />
            <button className="adm-add-btn" disabled={!selProgId || !newYear} onClick={addYear}>
              + Adicionar Ano
            </button>
          </div>
        </div>
      )}
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

function AdminFinanceiro() {
  const [tab, setTab] = useState<FinTab>('moedas')
  const { programs, loading: progsLoading } = usePrograms()
  const { showToast } = useToast()
  const [invoiceOverdue,  setInvoiceOverdue]  = useState(100)
  const [invoiceDueSoon,  setInvoiceDueSoon]  = useState(85)
  const [savingAlerts,    setSavingAlerts]    = useState(false)

  const TABS: [FinTab, string][] = [
    ['moedas',     'Moedas'],
    ['categorias', 'Categorias de Custo'],
    ['anos',       'Anos de Gestão'],
    ['alertas',    'Alertas'],
  ]

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .in('config_key', ['invoice_alert_overdue', 'invoice_alert_due_soon'])
      .then(({ data }) => {
        if (cancelled || !data) return
        const map: Record<string, string> = {}
        for (const row of data) map[row.config_key] = row.data
        const iov = parseInt(map['invoice_alert_overdue']  ?? '')
        const ids = parseInt(map['invoice_alert_due_soon'] ?? '')
        if (!isNaN(iov)) setInvoiceOverdue(iov)
        if (!isNaN(ids)) setInvoiceDueSoon(ids)
      })
    return () => { cancelled = true }
  }, [])

  async function handleSaveAlerts() {
    setSavingAlerts(true)
    try {
      await Promise.all([
        supabase.from('app_config').upsert({ config_key: 'invoice_alert_overdue',  data: String(invoiceOverdue) },  { onConflict: 'config_key' }),
        supabase.from('app_config').upsert({ config_key: 'invoice_alert_due_soon', data: String(invoiceDueSoon) }, { onConflict: 'config_key' }),
      ])
      showToast('Guardado!')
    } finally {
      setSavingAlerts(false)
    }
  }

  return (
    <Card title="Financeiro">
      <div className="adm-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`adm-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'moedas'     && <MoedasTab />}
      {tab === 'categorias' && <CategoriasTab programs={programs} progsLoading={progsLoading} />}
      {tab === 'anos'       && <AnosTab      programs={programs} progsLoading={progsLoading} />}
      {tab === 'alertas'    && (
        <div>
          <div className="adm-field">
            <label className="adm-label">Alertas de Facturas</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="adm-label" style={{ fontWeight: 400, marginBottom: 4 }}>% atraso (ultrapassou prazo)</label>
                <input
                  className="adm-input"
                  type="number"
                  min={50}
                  max={200}
                  step={5}
                  value={invoiceOverdue}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 100
                    setInvoiceOverdue(v)
                    if (invoiceDueSoon >= v) setInvoiceDueSoon(v - 5)
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="adm-label" style={{ fontWeight: 400, marginBottom: 4 }}>% a vencer (aviso)</label>
                <input
                  className="adm-input"
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  value={invoiceDueSoon}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 85
                    setInvoiceDueSoon(Math.min(v, invoiceOverdue - 5))
                  }}
                />
              </div>
            </div>
            <span className="adm-help">
              % calculado sobre o prazo entre data de emissão e vencimento. ≥{invoiceOverdue}% = atrasada, ≥{invoiceDueSoon}% = a vencer.
            </span>
          </div>
          <button className="btn-primary btn-lg" onClick={handleSaveAlerts} disabled={savingAlerts}>
            {savingAlerts ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      )}
    </Card>
  )
}

// ── Section 6: Risco ──────────────────────────────────────────
type RiscoTab = 'matriz' | 'estados'

const DEFAULT_RISK_STATES = ['Identificado', 'Em monitorização', 'Mitigado', 'Fechado']

function enforceThresholdChain(
  field: keyof RiskThresholds,
  value: number,
  current: RiskThresholds,
  maxGrade: number,
): RiskThresholds {
  const t = { ...current, [field]: value }
  if (t.very_low >= t.low)    t.low    = t.very_low + 1
  if (t.low     >= t.medium)  t.medium = t.low      + 1
  if (t.medium  >= t.high)    t.high   = t.medium   + 1
  if (t.high    >= maxGrade)  t.high   = maxGrade   - 1
  if (t.medium  >= t.high)    t.medium = t.high     - 1
  if (t.low     >= t.medium)  t.low    = t.medium   - 1
  if (t.very_low >= t.low)    t.very_low = t.low    - 1
  if (t.very_low < 1)         t.very_low = 1
  return t
}

function MatrizTab() {
  const { showToast } = useToast()
  const [size,    setSize]    = useState(5)
  const [veryLow, setVeryLow] = useState(DEFAULT_THRESHOLDS.very_low)
  const [low,     setLow]     = useState(DEFAULT_THRESHOLDS.low)
  const [medium,  setMedium]  = useState(DEFAULT_THRESHOLDS.medium)
  const [high,    setHigh]    = useState(DEFAULT_THRESHOLDS.high)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .in('config_key', ['risk_matrix_size', 'risk_thresholds'])
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          const map: Record<string, string> = {}
          for (const row of data) map[row.config_key] = row.data
          if (map['risk_matrix_size']) setSize(parseInt(map['risk_matrix_size'], 10) || 5)
          if (map['risk_thresholds']) {
            try {
              const t = JSON.parse(map['risk_thresholds']) as Partial<RiskThresholds>
              setVeryLow(t.very_low ?? DEFAULT_THRESHOLDS.very_low)
              setLow(t.low         ?? DEFAULT_THRESHOLDS.low)
              setMedium(t.medium   ?? DEFAULT_THRESHOLDS.medium)
              setHigh(t.high       ?? DEFAULT_THRESHOLDS.high)
            } catch { /* use defaults */ }
          }
        }
        setLoading(false)
      }, () => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSizeClick(newSize: number) {
    setSize(newSize)
    await supabase.from('app_config').upsert(
      { config_key: 'risk_matrix_size', data: String(newSize) },
      { onConflict: 'config_key' },
    )
  }

  async function saveThresholds() {
    setSaving(true)
    try {
      const t: RiskThresholds = { very_low: veryLow, low, medium, high }
      await supabase.from('app_config').upsert(
        { config_key: 'risk_thresholds', data: JSON.stringify(t) },
        { onConflict: 'config_key' },
      )
      showToast('Guardado!')
    } finally {
      setSaving(false)
    }
  }

  function handleThresholdChange(field: keyof RiskThresholds, value: number) {
    const next = enforceThresholdChain(
      field, value,
      { very_low: veryLow, low, medium, high },
      size * size,
    )
    setVeryLow(next.very_low)
    setLow(next.low)
    setMedium(next.medium)
    setHigh(next.high)
  }

  if (loading) return <p className="adm-help">A carregar…</p>

  const N    = size
  const cols = Array.from({ length: N }, (_, i) => i + 1)
  const rows = Array.from({ length: N }, (_, i) => N - i)
  const t: RiskThresholds = { very_low: veryLow, low, medium, high }

  const LEVELS: { label: string; swatch: string; value: number; field: keyof RiskThresholds }[] = [
    { label: 'Muito Baixo até', swatch: gradeStyle(1, N, t).bg,           value: veryLow, field: 'very_low' },
    { label: 'Baixo até',       swatch: gradeStyle(veryLow + 1, N, t).bg, value: low,     field: 'low'      },
    { label: 'Médio até',       swatch: gradeStyle(low + 1, N, t).bg,     value: medium,  field: 'medium'   },
    { label: 'Alto até',        swatch: gradeStyle(medium + 1, N, t).bg,  value: high,    field: 'high'     },
  ]

  return (
    <>
      {/* ── Size selector ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="adm-label" style={{ marginBottom: 8 }}>Dimensão da matriz</div>
        <div className="adm-size-btns">
          {[3, 4, 5, 6].map(s => (
            <button
              key={s}
              className={`adm-size-btn${size === s ? ' active' : ''}`}
              onClick={() => handleSizeClick(s)}
            >
              {s}×{s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Thresholds — 5 levels ── */}
      <div className="adm-label" style={{ marginBottom: 8 }}>Limiares de severidade</div>
      <div className="adm-threshold-list">
        {LEVELS.map(lvl => (
          <div key={lvl.label} className="adm-threshold-level">
            <span className="adm-level-swatch" style={{ background: lvl.swatch }} />
            <span className="adm-level-label">{lvl.label}</span>
            <input
              className="adm-input"
              type="number"
              min={1}
              max={N * N - 1}
              step={1}
              value={lvl.value}
              style={{ width: 72 }}
              onChange={e => handleThresholdChange(lvl.field, parseInt(e.target.value, 10) || 1)}
            />
          </div>
        ))}
        <div className="adm-threshold-level">
          <span className="adm-level-swatch" style={{ background: gradeStyle(high + 1, N, t).bg }} />
          <span className="adm-level-label">Crítico</span>
          <span className="adm-level-auto">&gt; {high}</span>
        </div>
      </div>

      <button className="btn-primary btn-lg" onClick={saveThresholds} disabled={saving}
        style={{ marginBottom: 24 }}>
        {saving ? 'A guardar…' : 'Guardar limiares'}
      </button>

      {/* ── Matrix preview ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: (N + 1) * 38, width: 14,
        }}>
          <span className="adm-axis-label" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
            Probabilidade
          </span>
        </div>
        <div>
          <div className="adm-matrix-preview"
            style={{ gridTemplateColumns: `repeat(${N + 1}, 36px)` }}>
            <div className="adm-matrix-header-cell" />
            {cols.map(col => (
              <div key={`ih-${col}`} className="adm-matrix-header-cell">{col}</div>
            ))}
            {rows.flatMap(prob => [
              <div key={`ph-${prob}`} className="adm-matrix-header-cell">{prob}</div>,
              ...cols.map(imp => {
                const gs = gradeStyle(imp * prob, N, t)
                return (
                  <div key={`c-${prob}-${imp}`} className="adm-matrix-cell"
                    style={{ background: gs.bg, color: gs.color }}>
                    {imp * prob}
                  </div>
                )
              }),
            ])}
          </div>
          <div style={{ textAlign: 'center', marginLeft: 38 }}>
            <span className="adm-axis-label">Impacto</span>
          </div>
        </div>
      </div>
    </>
  )
}

function AdminRisco() {
  const [tab, setTab] = useState<RiscoTab>('matriz')

  return (
    <Card title="Risco">
      <div className="adm-tabs">
        <button className={`adm-tab${tab === 'matriz'  ? ' active' : ''}`} onClick={() => setTab('matriz')}>Matriz</button>
        <button className={`adm-tab${tab === 'estados' ? ' active' : ''}`} onClick={() => setTab('estados')}>Estados</button>
      </div>
      {tab === 'matriz'  && <MatrizTab />}
      {tab === 'estados' && (
        <StringListEditor
          configKey="risk_states"
          label="Estados de risco disponíveis"
          defaults={DEFAULT_RISK_STATES}
        />
      )}
    </Card>
  )
}

// ── Section 7: Histórico ──────────────────────────────────────
type HistoricoTab = 'snapshots' | 'registo'

interface ChangeLogRow {
  id: string
  changed_by: string | null
  table_name: string
  operation: string
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_at: string
  summary: string | null
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Tab: Snapshots ─────────────────────────────────────────────
function SnapshotsTab() {
  const { showToast } = useToast()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading,   setLoading]   = useState(true)
  const [snapshotDeleteConfirm, setSnapshotDeleteConfirm] = useState<{ id: string; date: string } | null>(null)

  async function loadSnapshots() {
    setLoading(true)
    const { data } = await supabase
      .from('snapshots')
      .select('id, label, snap_date, kpi, by_n0, by_n1, created_by')
      .order('snap_date', { ascending: false })
      .limit(90)
    setSnapshots((data ?? []) as Snapshot[])
    setLoading(false)
  }

  useEffect(() => { loadSnapshots() }, [])

  async function saveNow() {
    try {
      await supabase.rpc('daily_snapshot')
      showToast('Snapshot guardado!')
      await loadSnapshots()
    } catch {
      showToast('Erro ao guardar snapshot', 'error')
    }
  }

  function requestDeleteSnapshot(id: string, snapDate: string) {
    setSnapshotDeleteConfirm({ id, date: fmtDate(snapDate) })
  }

  async function handleConfirmDeleteSnapshot() {
    if (!snapshotDeleteConfirm) return
    await supabase.from('snapshots').delete().eq('id', snapshotDeleteConfirm.id)
    setSnapshots(prev => prev.filter(s => s.id !== snapshotDeleteConfirm.id))
    setSnapshotDeleteConfirm(null)
  }

  const mostRecentId = snapshots[0]?.id ?? null

  return (
    <>
      <div className="adm-snap-header">
        <span className="adm-snap-info">Snapshots automáticos — guardados diariamente às 23:59</span>
        <button className="adm-outline-btn" onClick={saveNow}>Guardar snapshot agora</button>
      </div>

      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : snapshots.length === 0 ? (
        <p className="adm-empty-panel" style={{ padding: '24px 0' }}>
          Ainda não existem snapshots. O primeiro será criado automaticamente às 23:59.
        </p>
      ) : (
        <div style={{ margin: '0 -16px -16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Actividades</th>
                <th style={{ textAlign: 'right' }}>Em dia</th>
                <th style={{ textAlign: 'right' }}>Em atraso</th>
                <th style={{ textAlign: 'right' }}>Concluídas</th>
                <th style={{ width: 50 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(s => {
                const isMostRecent = s.id === mostRecentId
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(s.snap_date)}</td>
                    <td style={{ textAlign: 'right' }}>{s.kpi?.total ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{s.kpi?.em_dia ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>{s.kpi?.em_atraso ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--blue)' }}>{s.kpi?.concluidas ?? '—'}</td>
                    <td>
                      <button
                        className="adm-icon-btn"
                        title={isMostRecent ? 'Não é possível eliminar o snapshot mais recente' : 'Eliminar'}
                        disabled={isMostRecent}
                        style={{ color: isMostRecent ? undefined : 'var(--red)' }}
                        onClick={() => requestDeleteSnapshot(s.id, s.snap_date)}
                      ><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={snapshotDeleteConfirm !== null}
        title="Eliminar snapshot"
        message={`Eliminar o snapshot de ${snapshotDeleteConfirm?.date ?? ''}?`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleConfirmDeleteSnapshot}
        onCancel={() => setSnapshotDeleteConfirm(null)}
      />
    </>
  )
}

// ── Tab: Registo de Alterações ─────────────────────────────────
const LOG_TABLES = [
  'activities', 'planos', 'eixos', 'programs', 'risks',
  'fin_budget_lines', 'fin_contracts', 'fin_invoices',
  'fte_resources', 'pds_entries',
]

function RegistoTab() {
  const [rows,       setRows]       = useState<ChangeLogRow[]>([])
  const [profiles,   setProfiles]   = useState<Profile[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tableFilter, setTableFilter] = useState('')
  const [userFilter,  setUserFilter]  = useState('')
  const [logError,   setLogError]   = useState(false)

  // Load profiles once
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, created_at, updated_at')
      .then(({ data }) => { setProfiles((data ?? []) as Profile[]) })
  }, [])

  // Reload log whenever filters change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLogError(false)
    let q = supabase
      .from('change_log')
      .select('id, changed_by, table_name, operation, record_id, old_values, new_values, changed_at, summary')
      .order('changed_at', { ascending: false })
      .limit(100)
    if (tableFilter) q = q.eq('table_name', tableFilter)
    if (userFilter)  q = q.eq('changed_by', userFilter)
    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) { setLogError(true); setLoading(false); return }
      setRows((data ?? []) as ChangeLogRow[])
      setLoading(false)
    }, () => {
      if (!cancelled) { setLogError(true); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [tableFilter, userFilter])

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || p.email]))

  function actionBadge(operation: string) {
    if (operation === 'INSERT') return <Badge variant="green">INSERT</Badge>
    if (operation === 'DELETE') return <Badge variant="red">DELETE</Badge>
    return <Badge variant="blue">UPDATE</Badge>
  }

  function shortId(id: string | null) {
    if (!id) return '—'
    // UUID: 32 hex + 4 dashes = 36 chars; show first 8
    return id.length > 8 ? id.slice(0, 8) + '…' : id
  }

  if (logError) {
    return <div className="adm-empty-state">Erro ao carregar o registo de alterações.</div>
  }

  return (
    <>
      <div className="adm-filter-row">
        <span>Tabela:</span>
        <select className="styled-select-sm" style={{ width: 'auto' }} value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}>
          <option value="">Todas</option>
          {LOG_TABLES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span>Utilizador:</span>
        <select className="styled-select-sm" style={{ width: 'auto' }} value={userFilter}
          onChange={e => setUserFilter(e.target.value)}>
          <option value="">Todos</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="adm-help">A carregar…</p>
      ) : rows.length === 0 ? (
        <div className="adm-empty-state">Sem alterações registadas ainda.</div>
      ) : (
        <div style={{ margin: '0 -16px -16px' }}>
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Utilizador</th>
                <th>Tabela</th>
                <th>Acção</th>
                <th>Registo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <Fragment key={r.id}>
                  <tr>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(r.changed_at)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {r.changed_by ? (profileMap[r.changed_by] ?? r.changed_by.slice(0, 8)) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {r.table_name}
                      {r.summary && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.summary}</div>}
                    </td>
                    <td>{actionBadge(r.operation)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                      {shortId(r.record_id)}
                    </td>
                  </tr>
                  {(r.old_values || r.new_values) && (
                    <tr className="adm-change-diff-row">
                      <td colSpan={5}>
                        <details>
                          <summary className="adm-change-diff-summary">Ver alterações</summary>
                          <div className="adm-change-diff">
                            {r.old_values && (
                              <div>
                                <strong>Antes:</strong>
                                <pre>{JSON.stringify(r.old_values, null, 2)}</pre>
                              </div>
                            )}
                            {r.new_values && (
                              <div>
                                <strong>Depois:</strong>
                                <pre>{JSON.stringify(r.new_values, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function AdminHistorico() {
  const [tab, setTab] = useState<HistoricoTab>('snapshots')

  return (
    <Card title="Histórico e Auditoria">
      <div className="adm-tabs">
        <button className={`adm-tab${tab === 'snapshots' ? ' active' : ''}`}
          onClick={() => setTab('snapshots')}>Snapshots</button>
        <button className={`adm-tab${tab === 'registo' ? ' active' : ''}`}
          onClick={() => setTab('registo')}>Registo de Alterações</button>
      </div>
      {tab === 'snapshots' && <SnapshotsTab />}
      {tab === 'registo'   && <RegistoTab />}
    </Card>
  )
}

// ── Section 8: Dados e Importação ────────────────────────────
type DadosTab = 'importar' | 'exportar' | 'rotulos'

interface FilterLabels { n0: string; n1: string; n2: string; owner: string; sponsor: string }

const EXPORT_TABLES = [
  'programs', 'eixos', 'planos', 'activities', 'pds_entries',
  'fin_budget_lines', 'fin_contracts', 'fin_invoices',
  'fte_resources', 'risks', 'people',
]

// ── Tab: Importar ──────────────────────────────────────────────
function ImportarTab() {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file,         setFile]         = useState<File | null>(null)
  const [sheets,       setSheets]       = useState<string[]>([])
  const [selSheet,     setSelSheet]     = useState('')
  const [previewRows,  setPreviewRows]  = useState<string[][]>([])
  const [previewCols,  setPreviewCols]  = useState<string[]>([])
  const [previewing,   setPreviewing]   = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setSheets([])
    setSelSheet('')
    setPreviewRows([])
    setPreviewCols([])
    if (e.target) e.target.value = ''
  }

  async function handlePreview() {
    if (!file) return
    setPreviewing(true)
    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const names = wb.SheetNames
      setSheets(names)
      const sheetName = selSheet && names.includes(selSheet) ? selSheet : names[0]
      setSelSheet(sheetName)
      renderSheet(wb, sheetName)
    } finally {
      setPreviewing(false)
    }
  }

  function renderSheet(wb: XLSX.WorkBook, sheetName: string) {
    const ws   = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
    const head = (data[0] ?? []).map(String)
    const body = data.slice(1, 6).map(r => head.map((_, i) => String((r as string[])[i] ?? '')))
    setPreviewCols(head)
    setPreviewRows(body)
  }

  async function handleSheetChange(name: string) {
    setSelSheet(name)
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array' })
    renderSheet(wb, name)
  }

  function handleCancel() {
    setFile(null)
    setSheets([])
    setSelSheet('')
    setPreviewRows([])
    setPreviewCols([])
  }

  const hasPreviewed = previewCols.length > 0

  return (
    <>
      <p className="adm-section-desc">
        Faz upload do Excel template preenchido para importar dados para o Supabase.
        Os dados existentes não são apagados — registos com o mesmo código são actualizados.
      </p>

      {/* Upload zone */}
      <div
        className={`adm-upload-zone${file ? ' has-file' : ''}`}
        onClick={() => fileRef.current?.click()}
      >
        <FileText size={24} strokeWidth={1.5} />
        <br />
        {file ? file.name : 'Arrasta o ficheiro Excel aqui ou clica para seleccionar'}
      </div>
      <input ref={fileRef} type="file" accept=".xlsx" className="adm-file-hidden"
        onChange={handleFileChange} />

      {/* File info */}
      {file && (
        <div className="adm-file-info">
          <span>{file.name}</span>
          <span style={{ color: 'var(--text3)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {/* Sheet selector (after preview) */}
      {sheets.length > 1 && (
        <div className="adm-program-bar" style={{ marginTop: 10 }}>
          <span>Folha:</span>
          <select className="styled-select-sm" style={{ width: 'auto' }} value={selSheet}
            onChange={e => handleSheetChange(e.target.value)}>
            {sheets.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Preview table */}
      {hasPreviewed && (
        <div className="adm-preview-wrap">
          <table className="adm-preview-table">
            <thead>
              <tr>{previewCols.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {previewRows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action buttons */}
      {file && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="btn-primary btn-lg" onClick={handlePreview} disabled={previewing}>
            {previewing ? 'A carregar…' : 'Pré-visualizar'}
          </button>
          <button className="btn-primary btn-lg" disabled={!hasPreviewed}
            onClick={() => showToast('Importação via UI disponível em breve. Usa o script de importação para já.', 'info')}>
            Importar
          </button>
          <button className="adm-outline-btn" onClick={handleCancel}>Cancelar</button>
        </div>
      )}
    </>
  )
}

// ── Tab: Exportar ──────────────────────────────────────────────
function ExportarTab() {
  const { showToast } = useToast()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const results = await Promise.all(
        EXPORT_TABLES.map(t =>
          supabase.from(t).select('*').then(({ data }) => ({ table: t, rows: data ?? [] }))
        )
      )
      const wb = XLSX.utils.book_new()
      for (const { table, rows } of results) {
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, table)
      }
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `Stratgos_export_${date}.xlsx`)
      showToast('Exportação concluída!')
    } catch {
      showToast('Erro na exportação', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <p className="adm-section-desc">
        Exporta todos os dados do Supabase para um ficheiro Excel com múltiplas folhas.
      </p>
      <button className="btn-primary btn-lg" onClick={handleExport} disabled={exporting}>
        {exporting ? 'A exportar…' : 'Exportar tudo para Excel'}
      </button>
    </>
  )
}

// ── Tab: Rótulos ───────────────────────────────────────────────
function RotulosTab() {
  const { showToast } = useToast()
  const { programs } = usePrograms()
  const [selProgId, setSelProgId] = useState<string | null>(null)
  const [labels,    setLabels]    = useState<FilterLabels>({ n0: '', n1: '', n2: '', owner: '', sponsor: '' })
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (programs.length > 0 && !selProgId) setSelProgId(programs[0].id)
  }, [programs, selProgId])

  useEffect(() => {
    if (!selProgId) return
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .eq('config_key', `filter_labels_${selProgId}`)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          try {
            const parsed = JSON.parse(data.data) as Partial<FilterLabels>
            setLabels({ n0: parsed.n0 ?? '', n1: parsed.n1 ?? '', n2: parsed.n2 ?? '', owner: parsed.owner ?? '', sponsor: parsed.sponsor ?? '' })
          } catch { setLabels({ n0: '', n1: '', n2: '', owner: '', sponsor: '' }) }
        } else {
          setLabels({ n0: '', n1: '', n2: '', owner: '', sponsor: '' })
        }
      })
    return () => { cancelled = true }
  }, [selProgId])

  async function handleSave() {
    if (!selProgId) return
    setSaving(true)
    try {
      await supabase.from('app_config').upsert(
        { config_key: `filter_labels_${selProgId}`, data: JSON.stringify(labels) },
        { onConflict: 'config_key' },
      )
      showToast('Guardado!')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="adm-section-desc">
        Personaliza os rótulos dos filtros por programa. Útil quando diferentes
        programas usam terminologia diferente (ex: "Eixo" vs "Área").
      </p>

      <div className="adm-program-bar">
        <span>Programa:</span>
        <select className="adm-select" value={selProgId ?? ''}
          onChange={e => setSelProgId(e.target.value || null)}>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          {programs.length === 0 && <option value="">Sem programas</option>}
        </select>
      </div>

      <div className="adm-label-grid">
        {([
          ['n0',      'N0 (Programa)',  'Programa'      ],
          ['n1',      'N1 (Eixo)',      'Eixo'          ],
          ['n2',      'N2 (Plano)',     'Plano'         ],
          ['owner',   'Responsável',    'Responsável'   ],
          ['sponsor', 'Patrocinador',   'Patrocinador'  ],
        ] as [keyof FilterLabels, string, string][]).map(([key, label, ph]) => (
          <div key={key} className="adm-field">
            <label className="adm-label">{label}</label>
            <input
              className="adm-input"
              value={labels[key]}
              placeholder={ph}
              onChange={e => setLabels(l => ({ ...l, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="adm-form-actions">
        <button className="btn-primary btn-lg" onClick={handleSave} disabled={saving || !selProgId}>
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </>
  )
}

function AdminDados() {
  const [tab, setTab] = useState<DadosTab>('importar')

  const TABS: [DadosTab, string][] = [
    ['importar', 'Importar'],
    ['exportar', 'Exportar'],
    ['rotulos',  'Rótulos'],
  ]

  return (
    <Card title="Dados e Importação">
      <div className="adm-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`adm-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'importar' && <ImportarTab />}
      {tab === 'exportar' && <ExportarTab />}
      {tab === 'rotulos'  && <RotulosTab />}
    </Card>
  )
}

// ── Section 9: Plano ──────────────────────────────────────────
const PLANO_CONFIG_KEYS = [
  'status_delay_threshold_aggregates_low', 'status_delay_threshold_aggregates_high',
  'status_delay_threshold_leaves_low', 'status_delay_threshold_leaves_high',
  'pds_hide_completed_days', 'health_rules',
] as const

const SEVERITY_OPTS: AlertSeverity[] = ['critical', 'high', 'medium', 'low']
const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo',
}

function AdminPlano() {
  const { showToast } = useToast()
  const [delayAggLow,  setDelayAggLow]  = useState(15)
  const [delayAggHigh, setDelayAggHigh] = useState(25)
  const [delayLvsLow,  setDelayLvsLow]  = useState(5)
  const [delayLvsHigh, setDelayLvsHigh] = useState(10)
  const [hideCompletedDays,    setHideCompletedDays]    = useState(90)
  const [healthConfig,         setHealthConfig]         = useState<HealthConfig>(DEFAULT_HEALTH_CONFIG)
  const [loading,    setLoading]    = useState(true)
  const [savingKey,  setSavingKey]  = useState<string | null>(null)
  const [savedKey,   setSavedKey]   = useState<string | null>(null)
  const [errorKey,   setErrorKey]   = useState<string | null>(null)

  // Alert rules — row-by-row save
  const [alertRules,   setAlertRules]   = useState<AlertRule[]>([])
  const [alertLoading, setAlertLoading] = useState(true)
  const [alertSaving,  setAlertSaving]  = useState<string | null>(null)
  const [alertSaved,   setAlertSaved]   = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('config_key, data')
      .in('config_key', [...PLANO_CONFIG_KEYS])
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error || !data) return
        const map: Record<string, string> = {}
        for (const row of data) map[row.config_key] = row.data
        setDelayAggLow(parseInt(map['status_delay_threshold_aggregates_low']  ?? '15') || 15)
        setDelayAggHigh(parseInt(map['status_delay_threshold_aggregates_high'] ?? '25') || 25)
        setDelayLvsLow(parseInt(map['status_delay_threshold_leaves_low']       ?? '5')  || 5)
        setDelayLvsHigh(parseInt(map['status_delay_threshold_leaves_high']     ?? '10') || 10)
        const hcd = parseInt(map['pds_hide_completed_days'] ?? '')
        if (!isNaN(hcd)) setHideCompletedDays(hcd)
        if (map['health_rules']) {
          try { setHealthConfig({ ...DEFAULT_HEALTH_CONFIG, ...JSON.parse(map['health_rules']) }) }
          catch { /* keep defaults */ }
        }
      }, () => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    supabase.from('alert_rules').select('*').order('severity').then(({ data, error }) => {
      if (data) setAlertRules(data as AlertRule[])
      if (error) console.error(error)
      setAlertLoading(false)
    })
  }, [])

  async function saveConfigKey(key: string, value: string) {
    setSavingKey(key)
    setErrorKey(null)
    const { error } = await supabase
      .from('app_config')
      .upsert({ config_key: key, data: value }, { onConflict: 'config_key' })
    setSavingKey(null)
    if (error) {
      setErrorKey(key)
    } else {
      setSavedKey(key)
      setTimeout(() => setSavedKey(prev => prev === key ? null : prev), 2300)
    }
  }

  async function handleAlertUpdate(rule: AlertRule, field: keyof AlertRule, value: unknown) {
    setAlertSaving(rule.id)
    const patch = { [field]: value }
    const { error } = await supabase.from('alert_rules').update(patch).eq('id', rule.id)
    if (error) {
      showToast(error.message, 'error')
    } else {
      setAlertRules(prev => prev.map(r => r.id === rule.id ? { ...r, ...patch } as AlertRule : r))
      setAlertSaved(true)
      setTimeout(() => setAlertSaved(false), 2300)
    }
    setAlertSaving(null)
  }

  if (loading) {
    return (
      <Card title="Plano">
        <p className="adm-help">A carregar…</p>
      </Card>
    )
  }

  return (
    <div className="adm-plano-stack">
      <Card title="Limiares de atraso" actions={
        savedKey && ['status_delay_threshold_aggregates_low', 'status_delay_threshold_aggregates_high', 'status_delay_threshold_leaves_low', 'status_delay_threshold_leaves_high', 'pds_hide_completed_days'].includes(savedKey)
          ? <span className="adm-saved-indicator">Guardado</span>
          : undefined
      }>
        <p className="adm-section-desc">Desvio tolerado (em pontos percentuais) entre execução prevista e real. Low = limite entre «Em dia» e «Em risco»; High = limite entre «Em risco» e «Em atraso».</p>
        <div className="adm-thresholds-row">
          <div className="adm-field">
            <label className="adm-label">Agregados — Low (pp)</label>
            <input
              className="adm-input threshold-input-low"
              type="number" min={0} max={100} step={1}
              value={delayAggLow}
              onChange={e => setDelayAggLow(parseInt(e.target.value) || 0)}
              onBlur={() => saveConfigKey('status_delay_threshold_aggregates_low', String(delayAggLow))}
            />
            <span className="adm-help">Desvio acima do qual planos, eixos e programas passam a «Em risco».</span>
            {errorKey === 'status_delay_threshold_aggregates_low' && <span className="adm-error-indicator">Erro ao guardar</span>}
          </div>
          <div className="adm-field">
            <label className="adm-label">Agregados — High (pp)</label>
            <input
              className="adm-input threshold-input-high"
              type="number" min={0} max={100} step={1}
              value={delayAggHigh}
              onChange={e => setDelayAggHigh(parseInt(e.target.value) || 0)}
              onBlur={() => saveConfigKey('status_delay_threshold_aggregates_high', String(delayAggHigh))}
            />
            <span className="adm-help">Desvio acima do qual planos, eixos e programas passam a «Em atraso».</span>
            {errorKey === 'status_delay_threshold_aggregates_high' && <span className="adm-error-indicator">Erro ao guardar</span>}
          </div>
        </div>
        <div className="adm-thresholds-row" style={{ marginTop: 'var(--space-3)' }}>
          <div className="adm-field">
            <label className="adm-label">Folhas — Low (pp)</label>
            <input
              className="adm-input threshold-input-low"
              type="number" min={0} max={100} step={1}
              value={delayLvsLow}
              onChange={e => setDelayLvsLow(parseInt(e.target.value) || 0)}
              onBlur={() => saveConfigKey('status_delay_threshold_leaves_low', String(delayLvsLow))}
            />
            <span className="adm-help">Desvio acima do qual actividades individuais passam a «Em risco».</span>
            {errorKey === 'status_delay_threshold_leaves_low' && <span className="adm-error-indicator">Erro ao guardar</span>}
          </div>
          <div className="adm-field">
            <label className="adm-label">Folhas — High (pp)</label>
            <input
              className="adm-input threshold-input-high"
              type="number" min={0} max={100} step={1}
              value={delayLvsHigh}
              onChange={e => setDelayLvsHigh(parseInt(e.target.value) || 0)}
              onBlur={() => saveConfigKey('status_delay_threshold_leaves_high', String(delayLvsHigh))}
            />
            <span className="adm-help">Desvio acima do qual actividades individuais passam a «Em atraso».</span>
            {errorKey === 'status_delay_threshold_leaves_high' && <span className="adm-error-indicator">Erro ao guardar</span>}
          </div>
        </div>
        <div className="adm-field" style={{ marginTop: 'var(--space-3)' }}>
          <label className="adm-label">Ocultar compromissos concluídos após (dias)</label>
          <input
            className="adm-input"
            type="number"
            min={0}
            step={1}
            value={hideCompletedDays}
            onChange={e => setHideCompletedDays(parseInt(e.target.value) || 0)}
            onBlur={() => saveConfigKey('pds_hide_completed_days', String(hideCompletedDays))}
          />
          <span className="adm-help">Compromissos anteriores concluídos há mais de X dias são ocultados no Ponto de Situação. Compromissos em aberto aparecem sempre.</span>
          {errorKey === 'pds_hide_completed_days' && <span className="adm-error-indicator">Erro ao guardar</span>}
        </div>
        {savingKey && savingKey !== 'health_rules' && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>A guardar…</span>}
      </Card>

      <Card title="Limiares de Saúde do Plano" actions={
        savedKey === 'health_rules' ? <span className="adm-saved-indicator">Guardado</span> : undefined
      }>
        <p className="adm-section-desc">
          Regras usadas para calcular o semáforo de saúde no cabeçalho do Ponto de Situação.
        </p>
        <div className="adm-health-blocks">
          <HealthBlockEditor
            color="red"
            label="Crítico"
            block={healthConfig.red}
            onChange={b => {
              const next = { ...healthConfig, red: b }
              setHealthConfig(next)
              saveConfigKey('health_rules', JSON.stringify(next))
            }}
          />
          <HealthBlockEditor
            color="amber"
            label="Aviso"
            block={healthConfig.amber}
            onChange={b => {
              const next = { ...healthConfig, amber: b }
              setHealthConfig(next)
              saveConfigKey('health_rules', JSON.stringify(next))
            }}
          />
        </div>
        {errorKey === 'health_rules' && <span className="adm-error-indicator" style={{ marginTop: 'var(--space-2)', display: 'block' }}>Erro ao guardar</span>}
      </Card>

      <Card title="Alertas" actions={alertSaved ? <span className="adm-saved-indicator">Guardado</span> : undefined}>
        <p className="adm-section-desc">Regras de alerta exibidas no briefing executivo do Dashboard. Edite directamente na tabela — as alterações são guardadas imediatamente.</p>
        {alertLoading ? (
          <div className="page-placeholder"><p>A carregar...</p></div>
        ) : (
          <table className="adm-panel-table">
            <thead>
              <tr>
                <th>Regra</th>
                <th>Descrição</th>
                <th style={{ width: 76, textAlign: 'center' }}>Activo</th>
                <th style={{ width: 96 }}>Threshold</th>
                <th style={{ width: 110 }}>Severidade</th>
              </tr>
            </thead>
            <tbody>
              {alertRules.map(rule => (
                <tr key={rule.id} style={{ opacity: alertSaving === rule.id ? 0.5 : 1 }}>
                  <td>
                    <code style={{ fontSize: 11, background: 'var(--bg3)', padding: '1px 4px', borderRadius: 'var(--r)' }}>{rule.rule_key}</code>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{rule.label}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{rule.description ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={rule.enabled}
                      onChange={e => handleAlertUpdate(rule, 'enabled', e.target.checked)} />
                  </td>
                  <td>
                    <input type="number" className="adm-row-input"
                      style={{ width: 72 }}
                      value={rule.threshold ?? ''}
                      min={0}
                      onChange={e => handleAlertUpdate(rule, 'threshold',
                        e.target.value === '' ? null : Number(e.target.value))} />
                  </td>
                  <td>
                    <select className="styled-select-sm"
                      value={rule.severity}
                      onChange={e => handleAlertUpdate(rule, 'severity', e.target.value as AlertSeverity)}>
                      {SEVERITY_OPTS.map(s => (
                        <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── Main Admin component ───────────────────────────────────────
export default function Admin() {
  const [active, setActive] = useState<SectionKey>('geral')

  const section = SECTIONS.find(s => s.key === active)!

  return (
    <div className="adm-layout">

      {/* ── Left nav ── */}
      <nav className="adm-nav">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            className={`adm-nav-btn${active === s.key ? ' active' : ''}`}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* ── Right content ── */}
      <div className="adm-content">
        {active === 'geral'          ? <AdminGeral />          :
         active === 'utilizadores'  ? <AdminUtilizadores />  :
         active === 'programas'     ? <AdminProgramas />     :
         active === 'plano'         ? <AdminPlano />         :
         active === 'recursos'      ? <AdminRecursos />      :
         active === 'financeiro'    ? <AdminFinanceiro />    :
         active === 'risco'         ? <AdminRisco />         :
         active === 'dados'         ? <AdminDados />         :
         active === 'historico'     ? <AdminHistorico />     : (
          <Card title={section.label}>
            <p className="adm-section-desc">{section.desc}</p>
            <div className="page-placeholder adm-placeholder">
              <p>A implementar</p>
            </div>
          </Card>
        )}
      </div>

    </div>
  )
}
