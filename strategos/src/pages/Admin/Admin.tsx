import './Admin.css'
import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Card from '../../components/Card/Card'
import { supabase } from '../../lib/supabase'

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
        {active === 'geral' ? (
          <AdminGeral />
        ) : (
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
