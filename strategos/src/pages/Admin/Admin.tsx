import './Admin.css'
import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePrograms } from '../../hooks/usePrograms'
import type { Program, Eixo, Plano, Profile, UserRole } from '../../types/index'

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
interface DraftProg  { id: string | null; code: string; name: string }
interface DraftEixo  { id: string | null; code: string; name: string }
interface DraftPlano { id: string | null; code: string; name: string; owner: string; sponsor: string }

function AdminProgramas() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [progLoad, setProgLoad] = useState(true)
  const [selProgId, setSelProgId] = useState<string | null>(null)
  const [draft, setDraft]        = useState<DraftProg | null>(null)

  const [eixos,     setEixos]     = useState<Eixo[]>([])
  const [eixoLoad,  setEixoLoad]  = useState(false)
  const [selEixoId, setSelEixoId] = useState<string | null>(null)
  const [eixoDraft, setEixoDraft] = useState<DraftEixo | null>(null)

  const [planos,    setPlanos]    = useState<Plano[]>([])
  const [planoLoad, setPlanoLoad] = useState(false)
  const [planoDraft, setPlanoDraft] = useState<DraftPlano | null>(null)

  const [errMsg, setErrMsg] = useState('')

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

  async function loadEixos(programId: string) {
    setEixoLoad(true)
    const { data } = await supabase
      .from('eixos')
      .select('id, program_id, code, name, sort_order, created_at, updated_at')
      .eq('program_id', programId)
      .order('sort_order')
      .order('name')
    setEixos((data ?? []) as Eixo[])
    setEixoLoad(false)
  }

  useEffect(() => {
    setSelEixoId(null)
    setEixoDraft(null)
    setEixos([])
    setPlanos([])
    if (selProgId) loadEixos(selProgId)
  }, [selProgId])

  async function loadPlanos(eixoId: string) {
    setPlanoLoad(true)
    const { data } = await supabase
      .from('planos')
      .select('id, eixo_id, program_id, code, name, owner, sponsor, sort_order, created_at, updated_at')
      .eq('eixo_id', eixoId)
      .order('sort_order')
      .order('name')
    setPlanos((data ?? []) as Plano[])
    setPlanoLoad(false)
  }

  useEffect(() => {
    setPlanoDraft(null)
    setPlanos([])
    if (selEixoId) loadPlanos(selEixoId)
  }, [selEixoId])

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

  async function saveEixo() {
    if (!eixoDraft || !eixoDraft.name.trim() || !selProgId) return
    const payload = { program_id: selProgId, code: eixoDraft.code.trim(), name: eixoDraft.name.trim(), sort_order: 0 }
    if (eixoDraft.id) {
      await supabase.from('eixos').update(payload).eq('id', eixoDraft.id)
    } else {
      await supabase.from('eixos').insert(payload)
    }
    setEixoDraft(null)
    await loadEixos(selProgId)
  }

  async function deleteEixo(id: string) {
    const { count } = await supabase
      .from('planos')
      .select('id', { count: 'exact', head: true })
      .eq('eixo_id', id)
    if ((count ?? 0) > 0) {
      showErr('Não é possível apagar — existem planos associados')
      return
    }
    await supabase.from('eixos').delete().eq('id', id)
    if (selEixoId === id) setSelEixoId(null)
    if (selProgId) await loadEixos(selProgId)
  }

  async function savePlano() {
    if (!planoDraft || !planoDraft.name.trim() || !selEixoId) return
    const payload = {
      eixo_id:    selEixoId,
      program_id: selProgId,
      code:       planoDraft.code.trim(),
      name:       planoDraft.name.trim(),
      owner:      planoDraft.owner.trim() || null,
      sponsor:    planoDraft.sponsor.trim() || null,
      sort_order: 0,
    }
    if (planoDraft.id) {
      await supabase.from('planos').update(payload).eq('id', planoDraft.id)
    } else {
      await supabase.from('planos').insert(payload)
    }
    setPlanoDraft(null)
    await loadPlanos(selEixoId)
  }

  async function deletePlano(id: string) {
    if (!window.confirm('Apagar este plano? Esta acção não pode ser desfeita.')) return
    await supabase.from('planos').delete().eq('id', id)
    if (selEixoId) await loadPlanos(selEixoId)
  }

  const selProg  = programs.find(p => p.id === selProgId)
  const selEixo  = eixos.find(e => e.id === selEixoId)

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

        {/* ── Panel 2: Eixos ── */}
        <Card title={selProg ? `Eixos — ${selProg.name}` : 'Eixos'}>
          {!selProgId ? (
            <p className="adm-empty-panel">Selecciona um programa</p>
          ) : (
            <div style={{ margin: '-16px' }}>
              {eixoLoad ? (
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
                    {eixos.map(e => {
                      const editing = eixoDraft?.id === e.id
                      const rowCls  = [selEixoId === e.id ? 'selected' : '', editing ? 'editing' : ''].filter(Boolean).join(' ')
                      return (
                        <tr
                          key={e.id}
                          className={rowCls || undefined}
                          style={{ cursor: editing ? 'default' : 'pointer' }}
                          onClick={() => !editing && setSelEixoId(e.id)}
                        >
                          <td style={{ width: 70 }}>
                            {editing ? (
                              <input
                                className="adm-row-input" autoFocus
                                value={eixoDraft!.code}
                                onChange={ev => setEixoDraft(d => d ? { ...d, code: ev.target.value } : d)}
                                onKeyDown={ev => { if (ev.key === 'Enter') saveEixo(); if (ev.key === 'Escape') setEixoDraft(null) }}
                              />
                            ) : e.code}
                          </td>
                          <td>
                            {editing ? (
                              <input
                                className="adm-row-input"
                                value={eixoDraft!.name}
                                onChange={ev => setEixoDraft(d => d ? { ...d, name: ev.target.value } : d)}
                                onKeyDown={ev => { if (ev.key === 'Enter') saveEixo(); if (ev.key === 'Escape') setEixoDraft(null) }}
                              />
                            ) : e.name}
                          </td>
                          <td>
                            {editing ? (
                              <span style={{ whiteSpace: 'nowrap' }}>
                                <button className="adm-icon-btn" title="Guardar"  onClick={ev => { ev.stopPropagation(); saveEixo() }}>✓</button>
                                <button className="adm-icon-btn" title="Cancelar" onClick={ev => { ev.stopPropagation(); setEixoDraft(null) }}>✕</button>
                              </span>
                            ) : (
                              <span style={{ whiteSpace: 'nowrap' }}>
                                <button className="adm-icon-btn" title="Editar"
                                  onClick={ev => { ev.stopPropagation(); setEixoDraft({ id: e.id, code: e.code, name: e.name }) }}>✎</button>
                                <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                                  onClick={ev => { ev.stopPropagation(); deleteEixo(e.id) }}>🗑</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {eixoDraft !== null && eixoDraft.id === null && (
                      <tr className="editing">
                        <td style={{ width: 70 }}>
                          <input className="adm-row-input" autoFocus placeholder="Cód."
                            value={eixoDraft.code}
                            onChange={ev => setEixoDraft(d => d ? { ...d, code: ev.target.value } : d)}
                            onKeyDown={ev => { if (ev.key === 'Enter') saveEixo(); if (ev.key === 'Escape') setEixoDraft(null) }}
                          />
                        </td>
                        <td>
                          <input className="adm-row-input" placeholder="Nome"
                            value={eixoDraft.name}
                            onChange={ev => setEixoDraft(d => d ? { ...d, name: ev.target.value } : d)}
                            onKeyDown={ev => { if (ev.key === 'Enter') saveEixo(); if (ev.key === 'Escape') setEixoDraft(null) }}
                          />
                        </td>
                        <td>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            <button className="adm-icon-btn" title="Guardar"  onClick={saveEixo}>✓</button>
                            <button className="adm-icon-btn" title="Cancelar" onClick={() => setEixoDraft(null)}>✕</button>
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
                  disabled={eixoDraft !== null}
                  onClick={() => setEixoDraft({ id: null, code: '', name: '' })}
                >
                  + Novo Eixo
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Panel 3: Planos ── */}
        <Card title={selEixo ? `Planos — ${selEixo.name}` : 'Planos'}>
          {!selEixoId ? (
            <p className="adm-empty-panel">Selecciona um eixo</p>
          ) : (
            <div style={{ margin: '-16px' }}>
              {planoLoad ? (
                <p className="adm-empty-panel">A carregar…</p>
              ) : (
                <table className="adm-panel-table">
                  <thead>
                    <tr>
                      <th>Cód.</th>
                      <th>Nome</th>
                      <th>Responsável</th>
                      <th>Patrocinador</th>
                      <th style={{ width: 72 }}>Acções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planos.map(p => {
                      const editing = planoDraft?.id === p.id
                      const rowCls  = editing ? 'editing' : ''
                      return (
                        <tr key={p.id} className={rowCls || undefined}>
                          <td style={{ width: 60 }}>
                            {editing ? (
                              <input
                                className="adm-row-input" autoFocus
                                value={planoDraft!.code}
                                onChange={ev => setPlanoDraft(d => d ? { ...d, code: ev.target.value } : d)}
                                onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                              />
                            ) : p.code}
                          </td>
                          <td>
                            {editing ? (
                              <input
                                className="adm-row-input"
                                value={planoDraft!.name}
                                onChange={ev => setPlanoDraft(d => d ? { ...d, name: ev.target.value } : d)}
                                onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                              />
                            ) : p.name}
                          </td>
                          <td>
                            {editing ? (
                              <input
                                className="adm-row-input"
                                value={planoDraft!.owner}
                                onChange={ev => setPlanoDraft(d => d ? { ...d, owner: ev.target.value } : d)}
                                onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                              />
                            ) : (p.owner ?? '—')}
                          </td>
                          <td>
                            {editing ? (
                              <input
                                className="adm-row-input"
                                value={planoDraft!.sponsor}
                                onChange={ev => setPlanoDraft(d => d ? { ...d, sponsor: ev.target.value } : d)}
                                onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                              />
                            ) : (p.sponsor ?? '—')}
                          </td>
                          <td>
                            {editing ? (
                              <span style={{ whiteSpace: 'nowrap' }}>
                                <button className="adm-icon-btn" title="Guardar"  onClick={savePlano}>✓</button>
                                <button className="adm-icon-btn" title="Cancelar" onClick={() => setPlanoDraft(null)}>✕</button>
                              </span>
                            ) : (
                              <span style={{ whiteSpace: 'nowrap' }}>
                                <button className="adm-icon-btn" title="Editar"
                                  onClick={() => setPlanoDraft({ id: p.id, code: p.code, name: p.name, owner: p.owner ?? '', sponsor: p.sponsor ?? '' })}>✎</button>
                                <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                                  onClick={() => deletePlano(p.id)}>🗑</button>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {planoDraft !== null && planoDraft.id === null && (
                      <tr className="editing">
                        <td style={{ width: 60 }}>
                          <input className="adm-row-input" autoFocus placeholder="Cód."
                            value={planoDraft.code}
                            onChange={ev => setPlanoDraft(d => d ? { ...d, code: ev.target.value } : d)}
                            onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                          />
                        </td>
                        <td>
                          <input className="adm-row-input" placeholder="Nome"
                            value={planoDraft.name}
                            onChange={ev => setPlanoDraft(d => d ? { ...d, name: ev.target.value } : d)}
                            onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                          />
                        </td>
                        <td>
                          <input className="adm-row-input" placeholder="Responsável"
                            value={planoDraft.owner}
                            onChange={ev => setPlanoDraft(d => d ? { ...d, owner: ev.target.value } : d)}
                            onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                          />
                        </td>
                        <td>
                          <input className="adm-row-input" placeholder="Patrocinador"
                            value={planoDraft.sponsor}
                            onChange={ev => setPlanoDraft(d => d ? { ...d, sponsor: ev.target.value } : d)}
                            onKeyDown={ev => { if (ev.key === 'Enter') savePlano(); if (ev.key === 'Escape') setPlanoDraft(null) }}
                          />
                        </td>
                        <td>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            <button className="adm-icon-btn" title="Guardar"  onClick={savePlano}>✓</button>
                            <button className="adm-icon-btn" title="Cancelar" onClick={() => setPlanoDraft(null)}>✕</button>
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
                  disabled={planoDraft !== null}
                  onClick={() => setPlanoDraft({ id: null, code: '', name: '', owner: '', sponsor: '' })}
                >
                  + Novo Plano
                </button>
              </div>
            </div>
          )}
        </Card>

      </div>

      {errMsg && (
        <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>
      )}
    </>
  )
}

// ── Section 3b: Permissões matrix ─────────────────────────────
const MATRIX_PAGES: { key: string; label: string }[] = [
  { key: 'dashboard',           label: 'Dashboard'     },
  { key: 'actividades',         label: 'Actividades'   },
  { key: 'gantt',               label: 'Gantt'         },
  { key: 'ponto-situacao',      label: 'PDS'           },
  { key: 'execucao-financeira', label: 'Financeiro'    },
  { key: 'recursos',            label: 'Recursos'      },
  { key: 'evolucao',            label: 'Evolução'      },
  { key: 'gestao-iniciativas',  label: 'G.Iniciativas' },
  { key: 'gestao-pds',          label: 'G.PDS'         },
  { key: 'gestao-riscos',       label: 'G.Riscos'      },
  { key: 'gestao-financeira',   label: 'G.Financeira'  },
  { key: 'gestao-recursos',     label: 'G.Recursos'    },
]

type CellValue = '' | 'view' | 'edit'
type PermMap   = Record<string, Record<string, CellValue>>

function AdminPermissoes({ profiles }: { profiles: Profile[] }) {
  const { programs } = usePrograms()
  const [selProgId,    setSelProgId]    = useState<string | null>(null)
  const [permMap,      setPermMap]      = useState<PermMap>({})
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [flashCells,   setFlashCells]   = useState<Set<string>>(new Set())

  // Set first program as default once programs load
  useEffect(() => {
    if (programs.length > 0 && !selProgId) {
      setSelProgId(programs[0].id)
    }
  }, [programs, selProgId])

  // Load permissions whenever selected program changes
  useEffect(() => {
    if (!selProgId) return
    let cancelled = false
    setLoadingPerms(true)
    supabase
      .from('user_permissions')
      .select('user_id, page, access_level')
      .eq('program_id', selProgId)
      .then(({ data }) => {
        if (cancelled) return
        const map: PermMap = {}
        for (const row of (data ?? [])) {
          if (!map[row.user_id]) map[row.user_id] = {}
          map[row.user_id][row.page] = (row.access_level === 'none' ? '' : row.access_level) as CellValue
        }
        setPermMap(map)
        setLoadingPerms(false)
      })
    return () => { cancelled = true }
  }, [selProgId])

  async function handleCellChange(userId: string, page: string, value: CellValue) {
    if (!selProgId) return
    // Optimistic update
    setPermMap(m => ({ ...m, [userId]: { ...(m[userId] ?? {}), [page]: value } }))
    if (value === '') {
      await supabase.from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('program_id', selProgId)
        .eq('page', page)
    } else {
      await supabase.from('user_permissions')
        .upsert(
          { user_id: userId, program_id: selProgId, page, access_level: value },
          { onConflict: 'user_id, program_id, page' },
        )
    }
    // Flash green border for 300ms
    const cellKey = `${userId}-${page}`
    setFlashCells(s => { const n = new Set(s); n.add(cellKey); return n })
    setTimeout(() => {
      setFlashCells(s => { const n = new Set(s); n.delete(cellKey); return n })
    }, 300)
  }

  const nonAdminProfiles = profiles.filter(p => p.role !== 'admin')

  return (
    <Card title="Permissões">
      <div className="adm-program-bar">
        <span>Programa:</span>
        <select
          className="adm-select"
          value={selProgId ?? ''}
          onChange={e => setSelProgId(e.target.value || null)}
        >
          {programs.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          {programs.length === 0 && <option value="">Sem programas</option>}
        </select>
      </div>

      {loadingPerms ? (
        <p className="adm-help">A carregar…</p>
      ) : (
        <div className="adm-matrix-wrap">
          <table className="adm-matrix">
            <thead>
              <tr>
                <th className="adm-matrix-name">Utilizador</th>
                {MATRIX_PAGES.map(pg => (
                  <th key={pg.key}>{pg.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nonAdminProfiles.map(p => (
                <tr key={p.id}>
                  <td className="adm-matrix-name">{p.full_name || p.email}</td>
                  {MATRIX_PAGES.map(pg => {
                    const val: CellValue = (permMap[p.id]?.[pg.key] as CellValue) ?? ''
                    const cellKey = `${p.id}-${pg.key}`
                    return (
                      <td key={pg.key}>
                        <select
                          className={`adm-matrix-select${flashCells.has(cellKey) ? ' saved' : ''}`}
                          value={val}
                          onChange={e => handleCellChange(p.id, pg.key, e.target.value as CellValue)}
                        >
                          <option value="">–</option>
                          <option value="view">Ver</option>
                          <option value="edit">Editar</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {nonAdminProfiles.length === 0 && (
                <tr>
                  <td
                    colSpan={MATRIX_PAGES.length + 1}
                    style={{ textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic', padding: '20px 0' }}
                  >
                    Sem utilizadores não-admin
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Section 3a: Utilizadores ───────────────────────────────────
function roleBadge(role: UserRole) {
  if (role === 'admin')  return <Badge variant="navy">Admin</Badge>
  if (role === 'gestor') return <Badge variant="blue">Gestor</Badge>
  return <Badge variant="grey">Viewer</Badge>
}

interface InviteForm { email: string; role: 'gestor' | 'viewer' }

function AdminUtilizadores() {
  const { user: currentUser } = useAuth()

  const [profiles,   setProfiles]   = useState<Profile[]>([])
  const [loadingP,   setLoadingP]   = useState(true)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [editRole,   setEditRole]   = useState<UserRole>('viewer')
  const [saving,     setSaving]     = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [invite,     setInvite]     = useState<InviteForm>({ email: '', role: 'viewer' })
  const [inviting,   setInviting]   = useState(false)
  const [toast,      setToast]      = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function loadProfiles() {
    setLoadingP(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, created_at, updated_at')
      .order('full_name')
    setProfiles((data ?? []) as Profile[])
    setLoadingP(false)
  }

  useEffect(() => { loadProfiles() }, [])

  function startEdit(p: Profile) {
    setEditId(p.id)
    setEditRole(p.role)
  }

  function cancelEdit() {
    setEditId(null)
  }

  async function saveRole() {
    if (!editId) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ role: editRole }).eq('id', editId)
      setEditId(null)
      await loadProfiles()
    } finally {
      setSaving(false)
    }
  }

  async function deleteProfile(id: string, name: string | null) {
    const label = name || 'este utilizador'
    if (!window.confirm(`Remover ${label}? Esta acção não pode ser desfeita.`)) return
    await supabase.from('profiles').delete().eq('id', id)
    await loadProfiles()
  }

  async function handleInvite() {
    if (!invite.email.trim()) return
    setInviting(true)
    try {
      // Try admin invite; fall back to inserting a profile row
      const { error } = await supabase.auth.admin.inviteUserByEmail(invite.email.trim())
      if (error) {
        // Fallback: insert profile row so the user appears in the list
        await supabase.from('profiles').insert({
          email: invite.email.trim(),
          role: invite.role,
          full_name: null,
          avatar_url: null,
        })
      } else {
        // Update role on the profile that the invite created
        await supabase.from('profiles')
          .update({ role: invite.role })
          .eq('email', invite.email.trim())
      }
      setShowInvite(false)
      setInvite({ email: '', role: 'viewer' })
      showToast('Convite enviado!')
      await loadProfiles()
    } finally {
      setInviting(false)
    }
  }

  const inviteActions = (
    <button
      className="adm-btn-secondary"
      style={{ padding: '4px 12px', fontSize: 12 }}
      onClick={() => { setShowInvite(v => !v); setInvite({ email: '', role: 'viewer' }) }}
    >
      + Convidar Utilizador
    </button>
  )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Card 1: Utilizadores ── */}
        <Card title="Utilizadores" actions={inviteActions}>
          {showInvite && (
            <div className="adm-invite-form">
              <div className="adm-field" style={{ margin: 0, flex: '1 1 200px' }}>
                <label className="adm-label">Email</label>
                <input
                  className="adm-input"
                  type="email"
                  placeholder="utilizador@org.pt"
                  value={invite.email}
                  onChange={e => setInvite(v => ({ ...v, email: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleInvite(); if (e.key === 'Escape') setShowInvite(false) }}
                />
              </div>
              <div className="adm-field" style={{ margin: 0 }}>
                <label className="adm-label">Role</label>
                <select
                  className="adm-select"
                  value={invite.role}
                  onChange={e => setInvite(v => ({ ...v, role: e.target.value as 'gestor' | 'viewer' }))}
                >
                  <option value="gestor">Gestor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingBottom: 1 }}>
                <button className="adm-btn-primary" onClick={handleInvite} disabled={inviting || !invite.email.trim()}>
                  {inviting ? 'A enviar…' : 'Convidar'}
                </button>
                <button className="adm-btn-secondary" onClick={() => setShowInvite(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {loadingP ? (
            <p className="adm-help" style={{ padding: '12px 0' }}>A carregar…</p>
          ) : (
            <div style={{ margin: '-16px', marginTop: showInvite ? '8px' : '-16px' }}>
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
                    const editing       = editId === p.id
                    return (
                      <tr key={p.id} className={editing ? 'editing' : undefined}>
                        <td style={{ fontWeight: 500 }}>{p.full_name || '—'}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.email}</td>
                        <td>
                          {editing ? (
                            <select
                              className="adm-select"
                              value={editRole}
                              onChange={e => setEditRole(e.target.value as UserRole)}
                              autoFocus
                            >
                              <option value="admin">Admin</option>
                              <option value="gestor">Gestor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : roleBadge(p.role)}
                        </td>
                        <td>
                          {editing ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <button className="adm-icon-btn" title="Guardar" onClick={saveRole} disabled={saving}>✓</button>
                              <button className="adm-icon-btn" title="Cancelar" onClick={cancelEdit}>✕</button>
                            </span>
                          ) : (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <button
                                className="adm-icon-btn"
                                title={isAdmin ? 'Não editável' : isCurrentUser ? 'Não editável' : 'Editar role'}
                                disabled={isAdmin || isCurrentUser}
                                onClick={() => startEdit(p)}
                              >✎</button>
                              <button
                                className="adm-icon-btn"
                                title={isAdmin ? 'Não editável' : isCurrentUser ? 'Não pode remover a própria conta' : 'Remover'}
                                disabled={isAdmin || isCurrentUser}
                                style={{ color: isAdmin || isCurrentUser ? undefined : 'var(--red)' }}
                                onClick={() => deleteProfile(p.id, p.full_name)}
                              >🗑</button>
                            </span>
                          )}
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

        {/* ── Card 2: Permissões ── */}
        <AdminPermissoes profiles={profiles} />

      </div>

      {toast && <div className="adm-toast">{toast}</div>}
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
        {active === 'geral'          ? <AdminGeral />          :
         active === 'programas'     ? <AdminProgramas />     :
         active === 'utilizadores'  ? <AdminUtilizadores />  : (
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
