import './Admin.css'
import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Card from '../../components/Card/Card'
import { supabase } from '../../lib/supabase'
import type { Program } from '../../types/index'

// ── Types ──────────────────────────────────────────────────────
type SectionKey =
  | 'geral'
  | 'programas'
  | 'utilizadores'
  | 'recursos'
  | 'financeiro'
  | 'risco'
  | 'historico'
  | 'dados'

interface Section {
  key: SectionKey
  label: string
  desc: string
}

const SECTIONS: Section[] = [
  { key: 'geral',        label: 'Geral',                     desc: 'Título, subtítulo, logótipo do cliente e data de corte' },
  { key: 'programas',    label: 'Programas e Eixos',         desc: 'Gestão da hierarquia N0 → N1 → N2' },
  { key: 'utilizadores', label: 'Utilizadores e Permissões', desc: 'Utilizadores, roles e matrix de acessos' },
  { key: 'recursos',     label: 'Recursos',                  desc: 'Perfis, unidades organizacionais e catálogo de pessoas' },
  { key: 'financeiro',   label: 'Financeiro',                desc: 'Moedas, categorias de custo e anos de gestão' },
  { key: 'risco',        label: 'Risco',                     desc: 'Dimensão da matriz, limiares e estados' },
  { key: 'historico',    label: 'Histórico',                 desc: 'Snapshots automáticos e registo de alterações' },
  { key: 'dados',        label: 'Dados e Importação',        desc: 'Importar/exportar Excel e rótulos de filtros' },
]

// ── Section 1: Geral ───────────────────────────────────────────
const CONFIG_KEYS = ['client_title', 'client_subtitle', 'client_logo_url', 'cutoff_date'] as const

function AdminGeral() {
  const [title,      setTitle]      = useState('')
  const [subtitle,   setSubtitle]   = useState('')
  const [cutoffDate, setCutoffDate] = useState('')
  const [logoUrl,    setLogoUrl]    = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [toast,      setToast]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('key, value')
      .in('key', [...CONFIG_KEYS])
      .then(({ data }) => {
        if (cancelled) return
        setLoading(false)
        if (!data) return
        const map: Record<string, string> = {}
        for (const row of data) map[row.key] = row.value
        setTitle(map['client_title']     ?? '')
        setSubtitle(map['client_subtitle'] ?? '')
        setLogoUrl(map['client_logo_url']  ?? '')
        setCutoffDate(map['cutoff_date']   ?? '')
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const pairs = [
        { key: 'client_title',    value: title },
        { key: 'client_subtitle', value: subtitle },
        { key: 'cutoff_date',     value: cutoffDate },
      ]
      await Promise.all(
        pairs.map(p => supabase.from('app_config').upsert(p, { onConflict: 'key' }))
      )
      setToast(true)
      setTimeout(() => setToast(false), 2000)
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
        { key: 'client_logo_url', value: publicUrl },
        { onConflict: 'key' },
      )
      setLogoUrl(publicUrl)
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoRemove() {
    await supabase.from('app_config').upsert(
      { key: 'client_logo_url', value: '' },
      { onConflict: 'key' },
    )
    setLogoUrl('')
  }

  if (loading) {
    return (
      <Card title="Configuração Geral">
        <p className="adm-help">A carregar…</p>
      </Card>
    )
  }

  return (
    <>
      <Card title="Configuração Geral">
        <div className="adm-section-grid">

          {/* ── Left: text config ── */}
          <div>
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
              className="adm-btn-primary"
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

      {toast && <div className="adm-toast">Guardado!</div>}
    </>
  )
}

// ── Section 2: Programas e Eixos ──────────────────────────────
interface DraftProg { id: string | null; code: string; name: string }

function AdminProgramas() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [progLoad, setProgLoad] = useState(true)
  const [selProgId, setSelProgId] = useState<string | null>(null)
  const [draft, setDraft]        = useState<DraftProg | null>(null)
  const [errMsg, setErrMsg]      = useState('')

  function showErr(msg: string) {
    setErrMsg(msg)
    setTimeout(() => setErrMsg(''), 3000)
  }

  async function loadPrograms() {
    setProgLoad(true)
    const { data } = await supabase
      .from('programs')
      .select('id, code, name, sort_order')
      .order('sort_order')
      .order('name')
    setPrograms((data ?? []) as Program[])
    setProgLoad(false)
  }

  useEffect(() => { loadPrograms() }, [])

  async function saveProg() {
    if (!draft || !draft.name.trim()) return
    const payload = { code: draft.code.trim(), name: draft.name.trim(), sort_order: 0 }
    if (draft.id) {
      await supabase.from('programs').update(payload).eq('id', draft.id)
    } else {
      await supabase.from('programs').insert(payload)
    }
    setDraft(null)
    await loadPrograms()
  }

  async function deleteProg(id: string) {
    const { count } = await supabase
      .from('eixos')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id)
    if ((count ?? 0) > 0) {
      showErr('Não é possível apagar — existem eixos associados')
      return
    }
    await supabase.from('programs').delete().eq('id', id)
    if (selProgId === id) setSelProgId(null)
    await loadPrograms()
  }

  const selProg = programs.find(p => p.id === selProgId)

  return (
    <>
      <div className="adm-3col">

        {/* ── Panel 1: Programas ── */}
        <Card title="Programas">
          <div style={{ margin: '-16px' }}>
            {progLoad ? (
              <p className="adm-empty-panel">A carregar…</p>
            ) : (
              <table className="adm-panel-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th style={{ width: 72 }}>Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map(p => {
                    const editing = draft?.id === p.id
                    const rowCls  = [selProgId === p.id ? 'selected' : '', editing ? 'editing' : ''].filter(Boolean).join(' ')
                    return (
                      <tr
                        key={p.id}
                        className={rowCls || undefined}
                        style={{ cursor: editing ? 'default' : 'pointer' }}
                        onClick={() => !editing && setSelProgId(p.id)}
                      >
                        <td style={{ width: 70 }}>
                          {editing ? (
                            <input
                              className="adm-row-input" autoFocus
                              value={draft!.code}
                              onChange={e => setDraft(d => d ? { ...d, code: e.target.value } : d)}
                              onKeyDown={e => { if (e.key === 'Enter') saveProg(); if (e.key === 'Escape') setDraft(null) }}
                            />
                          ) : p.code}
                        </td>
                        <td>
                          {editing ? (
                            <input
                              className="adm-row-input"
                              value={draft!.name}
                              onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                              onKeyDown={e => { if (e.key === 'Enter') saveProg(); if (e.key === 'Escape') setDraft(null) }}
                            />
                          ) : p.name}
                        </td>
                        <td>
                          {editing ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <button className="adm-icon-btn" title="Guardar"  onClick={e => { e.stopPropagation(); saveProg() }}>✓</button>
                              <button className="adm-icon-btn" title="Cancelar" onClick={e => { e.stopPropagation(); setDraft(null) }}>✕</button>
                            </span>
                          ) : (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <button className="adm-icon-btn" title="Editar"
                                onClick={e => { e.stopPropagation(); setDraft({ id: p.id, code: p.code, name: p.name }) }}>✎</button>
                              <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                                onClick={e => { e.stopPropagation(); deleteProg(p.id) }}>🗑</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {draft !== null && draft.id === null && (
                    <tr className="editing">
                      <td style={{ width: 70 }}>
                        <input className="adm-row-input" autoFocus placeholder="Cód."
                          value={draft.code}
                          onChange={e => setDraft(d => d ? { ...d, code: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') saveProg(); if (e.key === 'Escape') setDraft(null) }}
                        />
                      </td>
                      <td>
                        <input className="adm-row-input" placeholder="Nome"
                          value={draft.name}
                          onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') saveProg(); if (e.key === 'Escape') setDraft(null) }}
                        />
                      </td>
                      <td>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={saveProg}>✓</button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            <div className="adm-panel-footer">
              <button
                className="adm-add-btn"
                disabled={draft !== null}
                onClick={() => setDraft({ id: null, code: '', name: '' })}
              >
                + Novo Programa
              </button>
            </div>
          </div>
        </Card>

        {/* ── Panel 2: Eixos (placeholder) ── */}
        <Card title={selProg ? `Eixos — ${selProg.name}` : 'Eixos'}>
          {!selProgId ? (
            <p className="adm-empty-panel">Selecciona um programa</p>
          ) : (
            <div className="page-placeholder adm-placeholder">
              <p>A implementar</p>
            </div>
          )}
        </Card>

        {/* ── Panel 3: Planos (placeholder) ── */}
        <Card title="Planos">
          <p className="adm-empty-panel">Selecciona um eixo</p>
        </Card>

      </div>

      {errMsg && (
        <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>
      )}
    </>
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
        {active === 'geral'     ? <AdminGeral />     :
         active === 'programas' ? <AdminProgramas /> : (
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
