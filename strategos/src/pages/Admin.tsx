import Card from '../components/Card'

const SECTIONS = [
  { title: 'Configuração geral', desc: 'Título, subtítulo, logótipo, data de referência' },
  { title: 'Utilizadores e perfis', desc: 'Gestão de utilizadores, perfis e permissões' },
  { title: 'Programas e estrutura', desc: 'Programas, eixos e planos de ação' },
  { title: 'Cores e tema', desc: 'Personalização visual da plataforma' },
  { title: 'Importar / Exportar dados', desc: 'Migração e backup de dados' },
]

export default function Admin() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {SECTIONS.map(s => (
        <Card key={s.title} title={s.title}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>{s.desc}</p>
          <div className="page-placeholder" style={{ minHeight: 80 }}>
            <p>A implementar</p>
          </div>
        </Card>
      ))}
    </div>
  )
}
