import './Admin.css'
import { useState } from 'react'
import Card from '../../components/Card/Card'

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
        <Card title={section.label}>
          <p className="adm-section-desc">{section.desc}</p>
          <div className="page-placeholder adm-placeholder">
            <p>A implementar</p>
          </div>
        </Card>
      </div>

    </div>
  )
}
