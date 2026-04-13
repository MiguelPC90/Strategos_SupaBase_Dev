import './Admin.css'
import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Card from '../../components/Card/Card'
import Badge from '../../components/Badge/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { usePrograms } from '../../hooks/usePrograms'
import type { Program, Eixo, Plano, Profile, Person, UserRole } from '../../types/index'

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

// ── Section 4: Recursos ───────────────────────────────────────
type RecursosTab = 'perfis' | 'unidades' | 'pessoas'

interface DraftPerson {
  id:       string | null
  name:     string
  email:    string
  company:  string   // maps to people.type
  org_unit: string
  role:     string
}

// ── Shared: editable string-list backed by app_config ──────────
function StringListEditor({ configKey, label }: { configKey: string; label: string }) {
  const [items,   setItems]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_config')
      .select('key, value')
      .eq('key', configKey)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setLoading(false)
        if (!data) return
        try { setItems(JSON.parse(data.value) as string[]) } catch { /* empty */ }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
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
        { key: configKey, value: JSON.stringify(filtered) },
        { onConflict: 'key' },
      )
      setItems(filtered)
      setToast(true)
      setTimeout(() => setToast(false), 2000)
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
            onClick={() => remove(idx)}>🗑</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
        <button className="adm-add-btn" onClick={() => setItems(prev => [...prev, ''])}>
          + Adicionar
        </button>
        <button className="adm-btn-primary" onClick={save} disabled={saving}>
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
        {toast && <span style={{ fontSize: 12, color: 'var(--green)' }}>Guardado!</span>}
      </div>
    </>
  )
}

// ── Pessoas sub-tab ────────────────────────────────────────────
function PessoasTab() {
  const [people,   setPeople]   = useState<Person[]>([])
  const [loading,  setLoading]  = useState(true)
  const [draft,    setDraft]    = useState<DraftPerson | null>(null)
  const [errMsg,   setErrMsg]   = useState('')

  function showErr(msg: string) {
    setErrMsg(msg)
    setTimeout(() => setErrMsg(''), 3000)
  }

  async function loadPeople() {
    setLoading(true)
    const { data } = await supabase
      .from('people')
      .select('id, name, email, org_unit, role, type, notes, active, sort_order')
      .order('name')
    setPeople((data ?? []) as Person[])
    setLoading(false)
  }

  useEffect(() => { loadPeople() }, [])

  async function savePerson() {
    if (!draft || !draft.name.trim()) return
    const payload = {
      name:     draft.name.trim(),
      email:    draft.email.trim() || null,
      type:     draft.company.trim() || null,
      org_unit: draft.org_unit.trim() || null,
      role:     draft.role.trim() || null,
    }
    if (draft.id) {
      const { error } = await supabase.from('people').update(payload).eq('id', draft.id)
      if (error) { showErr(error.message); return }
    } else {
      const { error } = await supabase.from('people').insert({ ...payload, sort_order: 0, active: true })
      if (error) { showErr(error.message); return }
    }
    setDraft(null)
    await loadPeople()
  }

  async function deletePerson(id: string) {
    if (!window.confirm('Remover esta pessoa?')) return
    await supabase.from('people').delete().eq('id', id)
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
                <th>Email</th>
                <th>Empresa</th>
                <th>Unidade</th>
                <th>Perfil</th>
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
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.email}
                          onChange={e => setDraft(d => d ? { ...d, email: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (p.email || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.company}
                          onChange={e => setDraft(d => d ? { ...d, company: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (p.type || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.org_unit}
                          onChange={e => setDraft(d => d ? { ...d, org_unit: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (p.org_unit || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <input className="adm-row-input" value={draft!.role}
                          onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)}
                          onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                      ) : (p.role || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={savePerson}>✓</button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: p.id, name: p.name, email: p.email ?? '', company: p.type ?? '', org_unit: p.org_unit ?? '', role: p.role ?? '' })}>✎</button>
                          <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
                            onClick={() => deletePerson(p.id)}>🗑</button>
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
                  <td><input className="adm-row-input" placeholder="Email"
                    value={draft.email}
                    onChange={e => setDraft(d => d ? { ...d, email: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td><input className="adm-row-input" placeholder="Empresa"
                    value={draft.company}
                    onChange={e => setDraft(d => d ? { ...d, company: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td><input className="adm-row-input" placeholder="Unidade"
                    value={draft.org_unit}
                    onChange={e => setDraft(d => d ? { ...d, org_unit: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td><input className="adm-row-input" placeholder="Perfil"
                    value={draft.role}
                    onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)}
                    onKeyDown={e => { if (e.key === 'Enter') savePerson(); if (e.key === 'Escape') setDraft(null) }} />
                  </td>
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={savePerson}>✓</button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
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
              onClick={() => setDraft({ id: null, name: '', email: '', company: '', org_unit: '', role: '' })}
            >
              + Nova Pessoa
            </button>
          </div>
        </div>
      )}
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

function AdminRecursos() {
  const [tab, setTab] = useState<RecursosTab>('perfis')

  return (
    <Card title="Recursos">
      <div className="adm-tabs">
        {(['perfis', 'unidades', 'pessoas'] as RecursosTab[]).map(t => (
          <button
            key={t}
            className={`adm-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'perfis' ? 'Perfis' : t === 'unidades' ? 'Unidades' : 'Pessoas'}
          </button>
        ))}
      </div>

      {tab === 'perfis'   && <StringListEditor configKey="resource_profiles" label="Perfis de recursos disponíveis" />}
      {tab === 'unidades' && <StringListEditor configKey="org_units"         label="Unidades organizacionais" />}
      {tab === 'pessoas'  && <PessoasTab />}
    </Card>
  )
}

// ── Section 5: Financeiro ─────────────────────────────────────
type FinTab = 'moedas' | 'categorias' | 'anos'

interface Currency     { id: string; code: string; name: string; is_default: boolean }
interface CostCategory { id: string; program_id: string; name: string; is_capex: boolean }
interface ManagementYear { id: string; program_id: string; year: number }
interface DraftCurrency  { id: string | null; code: string; name: string }
interface DraftCategory  { id: string | null; name: string }

// ── Tab: Moedas ────────────────────────────────────────────────
function MoedasTab() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading,    setLoading]    = useState(true)
  const [draft,      setDraft]      = useState<DraftCurrency | null>(null)
  const [errMsg,     setErrMsg]     = useState('')

  function showErr(msg: string) { setErrMsg(msg); setTimeout(() => setErrMsg(''), 3000) }

  async function loadCurrencies() {
    setLoading(true)
    const { data } = await supabase
      .from('currencies')
      .select('id, code, name, is_default')
      .order('code')
    const rows = (data ?? []) as Currency[]
    if (rows.length === 0) {
      await supabase.from('currencies').insert([
        { code: 'EUR', name: 'Euro',              is_default: true  },
        { code: 'USD', name: 'Dólar Americano',   is_default: false },
        { code: 'AKZ', name: 'Kwanza Angolano',   is_default: false },
      ])
      const { data: seeded } = await supabase
        .from('currencies').select('id, code, name, is_default').order('code')
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
    const payload = { code: draft.code.trim().toUpperCase().slice(0, 3), name: draft.name.trim() }
    if (draft.id) {
      await supabase.from('currencies').update(payload).eq('id', draft.id)
    } else {
      await supabase.from('currencies').insert({ ...payload, is_default: false })
    }
    setDraft(null)
    await loadCurrencies()
  }

  async function deleteCurrency(c: Currency) {
    if (c.is_default) { showErr('Não é possível apagar a moeda padrão'); return }
    if (!window.confirm(`Apagar moeda ${c.code}?`)) return
    await supabase.from('currencies').delete().eq('id', c.id)
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
                        <input className="adm-row-input" autoFocus maxLength={3}
                          style={{ textTransform: 'uppercase' }}
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
                    <td style={{ textAlign: 'center' }}>
                      <input type="radio" className="adm-radio"
                        checked={c.is_default} onChange={() => setDefault(c.id)} />
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={saveCurrency}>✓</button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: c.id, code: c.code, name: c.name })}>✎</button>
                          <button className="adm-icon-btn" title="Apagar" style={{ color: 'var(--red)' }}
                            onClick={() => deleteCurrency(c)}>🗑</button>
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
                  <td />
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={saveCurrency}>✓</button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer">
            <button className="adm-add-btn" disabled={draft !== null}
              onClick={() => setDraft({ id: null, code: '', name: '' })}>
              + Nova Moeda
            </button>
          </div>
        </div>
      )}
      {errMsg && <div className="adm-toast" style={{ background: 'var(--red)' }}>{errMsg}</div>}
    </>
  )
}

// ── Tab: Categorias de Custo ───────────────────────────────────
interface ProgTabProps { programs: Program[]; progsLoading: boolean }

function CategoriasTab({ programs, progsLoading }: ProgTabProps) {
  const [selProgId,  setSelProgId]  = useState<string | null>(null)
  const [categories, setCategories] = useState<CostCategory[]>([])
  const [loading,    setLoading]    = useState(false)
  const [draft,      setDraft]      = useState<DraftCategory | null>(null)

  useEffect(() => {
    if (programs.length > 0 && !selProgId) setSelProgId(programs[0].id)
  }, [programs, selProgId])

  useEffect(() => {
    if (!selProgId) return
    let cancelled = false
    setLoading(true)
    setDraft(null)
    supabase.from('cost_categories')
      .select('id, program_id, name, is_capex')
      .eq('program_id', selProgId)
      .order('name')
      .then(({ data }) => {
        if (cancelled) return
        setCategories((data ?? []) as CostCategory[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [selProgId])

  async function reloadCategories() {
    if (!selProgId) return
    const { data } = await supabase.from('cost_categories')
      .select('id, program_id, name, is_capex')
      .eq('program_id', selProgId).order('name')
    setCategories((data ?? []) as CostCategory[])
  }

  async function toggleCapex(cat: CostCategory) {
    const newVal = !cat.is_capex
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_capex: newVal } : c))
    await supabase.from('cost_categories').update({ is_capex: newVal }).eq('id', cat.id)
  }

  async function saveCategory() {
    if (!draft || !draft.name.trim() || !selProgId) return
    if (draft.id) {
      await supabase.from('cost_categories').update({ name: draft.name.trim() }).eq('id', draft.id)
    } else {
      await supabase.from('cost_categories').insert({ program_id: selProgId, name: draft.name.trim(), is_capex: false })
    }
    setDraft(null)
    await reloadCategories()
  }

  async function deleteCategory(id: string) {
    if (!window.confirm('Remover esta categoria?')) return
    await supabase.from('cost_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
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
                <th>Nome</th>
                <th style={{ width: 80 }}>Tipo</th>
                <th style={{ width: 72 }}>Acções</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const editing = draft?.id === cat.id
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
                        onClick={() => toggleCapex(cat)}
                        style={{
                          background: cat.is_capex ? '#EBF0FA' : '#FDF3E7',
                          color:      cat.is_capex ? 'var(--blue)' : 'var(--amber)',
                        }}
                      >
                        {cat.is_capex ? 'CAPEX' : 'OPEX'}
                      </span>
                    </td>
                    <td>
                      {editing ? (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Guardar"  onClick={saveCategory}>✓</button>
                          <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
                        </span>
                      ) : (
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <button className="adm-icon-btn" title="Editar"
                            onClick={() => setDraft({ id: cat.id, name: cat.name })}>✎</button>
                          <button className="adm-icon-btn" title="Remover" style={{ color: 'var(--red)' }}
                            onClick={() => deleteCategory(cat.id)}>🗑</button>
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
                    <span className="adm-toggle-badge" style={{ background: '#FDF3E7', color: 'var(--amber)' }}>OPEX</span>
                  </td>
                  <td>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button className="adm-icon-btn" title="Guardar"  onClick={saveCategory}>✓</button>
                      <button className="adm-icon-btn" title="Cancelar" onClick={() => setDraft(null)}>✕</button>
                    </span>
                  </td>
                </tr>
              )}
              {categories.length === 0 && draft === null && (
                <tr><td colSpan={3} className="adm-empty-panel">Sem categorias</td></tr>
              )}
            </tbody>
          </table>
          <div className="adm-panel-footer">
            <button className="adm-add-btn" disabled={draft !== null || !selProgId}
              onClick={() => setDraft({ id: null, name: '' })}>
              + Nova Categoria
            </button>
          </div>
        </div>
      )}
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
                      onClick={() => deleteYear(y.id)}>🗑</button>
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

  const TABS: [FinTab, string][] = [
    ['moedas',     'Moedas'],
    ['categorias', 'Categorias de Custo'],
    ['anos',       'Anos de Gestão'],
  ]

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
    </Card>
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
         active === 'utilizadores'  ? <AdminUtilizadores />  :
         active === 'recursos'      ? <AdminRecursos />      :
         active === 'financeiro'    ? <AdminFinanceiro />    : (
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
