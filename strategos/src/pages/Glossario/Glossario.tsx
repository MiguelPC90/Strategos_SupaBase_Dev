import { useState, useMemo, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import './Glossario.css'

interface GlossaryTerm {
  term: string
  definition: string
  formula?: string
  notes?: string
}

interface GlossarySection {
  id: string
  title: string
  intro?: string
  terms: GlossaryTerm[]
}

const SECTIONS: GlossarySection[] = [
  {
    id: 'estrutura',
    title: '1. Estrutura organizacional',
    intro: 'Hierarquia top-down: Programa → Eixo → Plano → Actividade → Tarefa',
    terms: [
      { term: 'Programa', definition: 'Container de mais alto nível. Agrupa eixos sob uma direcção estratégica.', notes: 'Ex: "Programa Estratégico 2026"' },
      { term: 'Eixo', definition: 'Pilar estratégico dentro de um programa. Agrupa planos relacionados.', notes: 'Equivalente a "objectivo estratégico"' },
      { term: 'Plano', definition: 'Iniciativa accionável (sub-eixo). Tem responsável, orçamento, prazo.', notes: 'Unidade fundamental de execução' },
      { term: 'Actividade', definition: 'Item de trabalho concreto dentro de um plano.' },
      { term: 'Tarefa', definition: 'Sub-actividade. Granularidade mais fina para decomposições detalhadas.' },
    ],
  },
  {
    id: 'estados-actividade',
    title: '2. Estados de Actividade',
    intro: 'Aplicam-se a Actividades (e propagam para níveis superiores via rollup).',
    terms: [
      { term: 'Em dia', definition: 'Avança conforme planeado.' },
      { term: 'Em risco', definition: 'Sinais de potencial desvio (warnings, slowdown).' },
      { term: 'Em atraso', definition: 'Já desviou do prazo planeado.' },
      { term: 'Concluída', definition: 'Trabalho terminado, entregue.' },
    ],
  },
  {
    id: 'estados-pds',
    title: '3. Estados de Ponto de Situação (PDS)',
    intro: 'Aplicam-se a documentos PDS — não confundir com Estados de Actividade.',
    terms: [
      { term: 'Pendente', definition: 'PDS criado, aguarda preenchimento.' },
      { term: 'Em curso', definition: 'PDS em iteração / em preenchimento.' },
      { term: 'Concluído', definition: 'PDS finalizado e entregue.' },
    ],
  },
  {
    id: 'metricas',
    title: '4. Métricas de Execução',
    intro: 'Três métricas distintas, frequentemente confundidas.',
    terms: [
      { term: 'Grau de Execução', definition: '% de progresso real das actividades (média ponderada). Indica quanto já fizemos do total (avanço absoluto).', formula: 'Σ(% real × peso) / Σ(peso)' },
      { term: 'Concretização Geral', definition: '% de actividades concluídas vs total. Indica quantas actividades estão fechadas (contagem).', formula: '(concluídas / total) × 100' },
      { term: 'Concretização à Data', definition: '% de progresso real vs progresso esperado para a data actual. Índice >100% = à frente, <100% = atrás.', formula: '(grau_execução / grau_esperado) × 100' },
      { term: 'Objectivo', definition: 'Grau de Execução esperado para a data actual.' },
    ],
  },
  {
    id: 'financeiro',
    title: '5. Financeiro',
    intro: 'Aplicável a Plano (e agregação em Programa via BudgetPage).',
    terms: [
      { term: 'Orçamento', definition: 'Valor total alocado ao plano/programa.' },
      { term: 'Adjudicado', definition: 'Valor contratualizado (compromisso assinado).' },
      { term: 'Pago', definition: 'Valor já facturado e pago.' },
      { term: 'Em Pagamento', definition: 'Facturado, aguarda pagamento.' },
      { term: 'Por Facturar', definition: 'Adjudicado mas sem factura ainda.' },
      { term: 'Orçamento Disponível', definition: 'Quanto ainda há para gastar. Quando adjudicado > orçamento, mostrado a vermelho como overbudget.', formula: 'Orçamento − Adjudicado' },
    ],
  },
  {
    id: 'recursos',
    title: '6. Recursos',
    terms: [
      { term: 'Recurso', definition: 'Pessoa alocada a actividades ou planos.' },
      { term: 'Alocação', definition: '% do tempo de um Recurso dedicado a uma actividade.' },
      { term: 'Sobrealocação', definition: 'Quando Alocação total de um Recurso > 100%.' },
      { term: 'Capacidade', definition: 'Tempo disponível total do Recurso (feature futura).' },
    ],
  },
  {
    id: 'riscos',
    title: '7. Riscos',
    terms: [
      { term: 'Risco', definition: 'Item identificado como ameaça à execução.' },
      { term: 'Severidade', definition: 'Impacto × Probabilidade.' },
      { term: 'Mitigação', definition: 'Acção para reduzir o risco.' },
      { term: 'Risco Crítico', definition: 'Risco de severidade alta.' },
      { term: 'Ponto de Atenção', definition: 'Risco de severidade moderada.' },
      { term: 'A Requerer Atenção', definition: 'Estado agregado (Riscos Críticos + Pontos de Atenção).' },
    ],
  },
  {
    id: 'dependencias',
    title: '8. Dependências',
    terms: [
      { term: 'Predecessor', definition: 'Actividade que deve estar concluída antes de outra começar.' },
      { term: 'Sucessor', definition: 'Actividade que depende de predecessor.' },
      { term: 'Dependência', definition: 'Relação entre duas actividades (predecessor ↔ sucessor).' },
    ],
  },
  {
    id: 'versoes-temporais',
    title: '9. Versões / Temporais',
    terms: [
      { term: 'Snapshot', definition: 'Captura do estado de um plano/programa num momento.' },
      { term: 'Baseline', definition: 'Versão referência inicial do plano (versão "congelada" para medir desvios).' },
      { term: 'Evolução', definition: 'Comparação temporal entre snapshots.' },
      { term: 'Prazo', definition: 'Data limite para conclusão.' },
    ],
  },
  {
    id: 'documentos',
    title: '10. Documentos',
    terms: [
      { term: 'PDS', definition: 'Sigla de "Ponto de Situação".' },
      { term: 'Ponto de Situação', definition: 'Documento periódico de reporte de progresso.' },
      { term: 'Resumo Executivo', definition: 'Block de KPIs no topo de Dashboards e PlanoPage.' },
      { term: 'Visão Executiva', definition: 'Aba do PlanoPage com Resumo Executivo.' },
      { term: 'Factura', definition: 'Documento de cobrança.' },
    ],
  },
  {
    id: 'roles',
    title: '11. Roles / Permissões',
    terms: [
      { term: 'admin', definition: 'Administrador do sistema. Acesso total.' },
      { term: 'program_manager', definition: 'Gestor de programa. Edita programas e tudo abaixo.' },
      { term: 'project_manager', definition: 'Gestor de plano. (Renomeação pendente de "editor".)' },
      { term: 'stakeholder', definition: 'Stakeholder com visibilidade restrita. View-only com filtros.' },
      { term: 'viewer', definition: 'Vê apenas o que lhe é partilhado. View-only mais restrito.' },
    ],
  },
  {
    id: 'verbos',
    title: '12. Verbos / Acções',
    intro: 'Distinção semântica crítica entre Remover e Eliminar.',
    terms: [
      { term: 'Remover', definition: 'Desassociar / tirar de um conjunto sem apagar permanentemente.', notes: 'Ex: remover programa de utilizador, remover dependência' },
      { term: 'Eliminar', definition: 'Apagar permanentemente do sistema.', notes: 'Ex: eliminar plano, eliminar factura' },
      { term: 'Editar', definition: 'Modificar campos sem perda.' },
      { term: 'Duplicar', definition: 'Criar cópia exacta.' },
      { term: 'Importar', definition: 'Carregar dados externos (ex: Excel).' },
      { term: 'Exportar', definition: 'Gerar ficheiro com dados (ex: PDF).' },
      { term: 'Convidar', definition: 'Convidar utilizador via email.' },
      { term: 'Criar', definition: 'Criar novo registo.' },
    ],
  },
  {
    id: 'visualizacoes',
    title: '13. Visualizações',
    terms: [
      { term: 'Gantt', definition: 'Vista de cronograma de actividades.' },
      { term: 'Heatmap', definition: 'Mapa de calor (ex: alocação por mês).' },
      { term: 'Tabela', definition: 'Vista lista com colunas ordenáveis.' },
      { term: 'Cards', definition: 'Vista em cartões individuais.' },
      { term: 'Dashboard', definition: 'Vista agregada com múltiplos KPIs e charts.' },
    ],
  },
]

export default function Glossario() {
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState<string>('estrutura')
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const filteredSections = useMemo(() => {
    if (!query.trim()) return SECTIONS
    const q = query.toLowerCase()
    return SECTIONS.map(section => ({
      ...section,
      terms: section.terms.filter(t =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        (t.notes?.toLowerCase().includes(q) ?? false)
      ),
    })).filter(s => s.terms.length > 0)
  }, [query])

  useEffect(() => {
    if (query.trim()) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )

    Object.values(sectionRefs.current).forEach(el => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [query])

  function scrollToSection(id: string) {
    const el = sectionRefs.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="glossario-page">
      <aside className="glossario-sidebar">
        <h2 className="glossario-sidebar-title">Glossário</h2>
        <nav className="glossario-nav">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`glossario-nav-item${activeSection === s.id && !query ? ' is-active' : ''}`}
              onClick={() => scrollToSection(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      <main className="glossario-content">
        <div className="glossario-header">
          <h1 className="glossario-title">Glossário Stratgos</h1>
          <p className="glossario-intro">
            Vocabulário canónico da plataforma. Referência única para termos usados em UI, documentação e comunicação.
          </p>
          <div className="glossario-search">
            <Search size={16} className="glossario-search-icon" />
            <input
              type="text"
              className="glossario-search-input"
              placeholder="Pesquisar termos..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredSections.length === 0 && (
          <div className="glossario-empty">
            Sem resultados para <strong>"{query}"</strong>.
          </div>
        )}

        {filteredSections.map(section => (
          <section
            key={section.id}
            id={section.id}
            ref={el => { sectionRefs.current[section.id] = el }}
            className="glossario-section"
          >
            <h2 className="glossario-section-title">{section.title}</h2>
            {section.intro && <p className="glossario-section-intro">{section.intro}</p>}
            <dl className="glossario-terms">
              {section.terms.map(t => (
                <div key={t.term} className="glossario-term">
                  <dt className="glossario-term-name">{t.term}</dt>
                  <dd className="glossario-term-body">
                    <p className="glossario-term-definition">{t.definition}</p>
                    {t.formula && (
                      <p className="glossario-term-formula">
                        <span className="glossario-term-formula-label">Fórmula:</span>{' '}
                        <code>{t.formula}</code>
                      </p>
                    )}
                    {t.notes && <p className="glossario-term-notes">{t.notes}</p>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </main>
    </div>
  )
}
