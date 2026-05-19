// Stratgos canonical glossary.
// PT-PT is canonical. EN translations are empty placeholders, to be filled later.
// When EN is empty, the page falls back to PT.

export interface GlossaryTerm {
  id: string
  term: { pt: string; en?: string }
  definition: { pt: string; en?: string }
  formula?: string
  notes?: { pt: string; en?: string }
}

export interface GlossarySection {
  id: string
  title: { pt: string; en?: string }
  intro?: { pt: string; en?: string }
  terms: GlossaryTerm[]
}

export const GLOSSARY_SECTIONS: GlossarySection[] = [
  {
    id: 'estrutura',
    title: { pt: '1. Estrutura organizacional', en: '' },
    intro: { pt: 'Hierarquia top-down: Programa → Eixo → Plano → Actividade → Tarefa', en: '' },
    terms: [
      { id: 'programa',   term: { pt: 'Programa',   en: '' }, definition: { pt: 'Container de mais alto nível. Agrupa eixos sob uma direcção estratégica.', en: '' }, notes: { pt: 'Ex: "Programa Estratégico 2026"', en: '' } },
      { id: 'eixo',       term: { pt: 'Eixo',       en: '' }, definition: { pt: 'Pilar estratégico dentro de um programa. Agrupa planos relacionados.', en: '' }, notes: { pt: 'Equivalente a "objectivo estratégico"', en: '' } },
      { id: 'plano',      term: { pt: 'Plano',      en: '' }, definition: { pt: 'Iniciativa accionável (sub-eixo). Tem responsável, orçamento, prazo.', en: '' }, notes: { pt: 'Unidade fundamental de execução', en: '' } },
      { id: 'actividade', term: { pt: 'Actividade', en: '' }, definition: { pt: 'Item de trabalho concreto dentro de um plano.', en: '' } },
      { id: 'tarefa',     term: { pt: 'Tarefa',     en: '' }, definition: { pt: 'Sub-actividade. Granularidade mais fina para decomposições detalhadas.', en: '' } },
    ],
  },
  {
    id: 'estados-actividade',
    title: { pt: '2. Estados de Actividade', en: '' },
    intro: { pt: 'Aplicam-se a Actividades (e propagam para níveis superiores via rollup).', en: '' },
    terms: [
      { id: 'estado-em-dia',    term: { pt: 'Em dia',    en: '' }, definition: { pt: 'Avança conforme planeado.', en: '' } },
      { id: 'estado-em-risco',  term: { pt: 'Em risco',  en: '' }, definition: { pt: 'Sinais de potencial desvio (warnings, slowdown).', en: '' } },
      { id: 'estado-em-atraso', term: { pt: 'Em atraso', en: '' }, definition: { pt: 'Já desviou do prazo planeado.', en: '' } },
      { id: 'estado-concluida', term: { pt: 'Concluída', en: '' }, definition: { pt: 'Trabalho terminado, entregue.', en: '' } },
    ],
  },
  {
    id: 'estados-pds',
    title: { pt: '3. Estados de Ponto de Situação', en: '' },
    intro: { pt: 'Aplicam-se a documentos PDS — não confundir com Estados de Actividade.', en: '' },
    terms: [
      { id: 'pds-pendente', term: { pt: 'Pendente', en: '' }, definition: { pt: 'PDS criado, aguarda preenchimento.', en: '' } },
      { id: 'pds-em-curso', term: { pt: 'Em curso', en: '' }, definition: { pt: 'PDS em iteração / em preenchimento.', en: '' } },
      { id: 'pds-concluido', term: { pt: 'Concluído', en: '' }, definition: { pt: 'PDS finalizado e entregue.', en: '' } },
    ],
  },
  {
    id: 'metricas',
    title: { pt: '4. Métricas de Execução', en: '' },
    intro: { pt: 'Três métricas distintas, frequentemente confundidas.', en: '' },
    terms: [
      { id: 'grau-execucao',       term: { pt: 'Grau de Execução',     en: '' }, definition: { pt: '% de progresso real das actividades (média ponderada). Indica quanto já fizemos do total (avanço absoluto).', en: '' }, formula: 'Σ(% real × peso) / Σ(peso)' },
      { id: 'concretizacao-geral', term: { pt: 'Concretização Geral',  en: '' }, definition: { pt: '% de actividades concluídas vs total. Indica quantas actividades estão fechadas (contagem).', en: '' }, formula: '(concluídas / total) × 100' },
      { id: 'concretizacao-data',  term: { pt: 'Concretização à Data', en: '' }, definition: { pt: '% de progresso real vs progresso esperado para a data actual. Índice >100% = à frente, <100% = atrás.', en: '' }, formula: '(grau_execução / grau_esperado) × 100' },
      { id: 'objectivo',           term: { pt: 'Objectivo',            en: '' }, definition: { pt: 'Grau de Execução esperado para a data actual.', en: '' } },
    ],
  },
  {
    id: 'financeiro',
    title: { pt: '5. Financeiro', en: '' },
    intro: { pt: 'Aplicável a Plano (e agregação em Programa via BudgetPage).', en: '' },
    terms: [
      { id: 'orcamento',            term: { pt: 'Orçamento',            en: '' }, definition: { pt: 'Valor total alocado ao plano/programa.', en: '' } },
      { id: 'adjudicado',           term: { pt: 'Adjudicado',           en: '' }, definition: { pt: 'Valor contratualizado (compromisso assinado).', en: '' } },
      { id: 'pago',                 term: { pt: 'Pago',                 en: '' }, definition: { pt: 'Valor já facturado e pago.', en: '' } },
      { id: 'em-pagamento',         term: { pt: 'Em Pagamento',         en: '' }, definition: { pt: 'Facturado, aguarda pagamento.', en: '' } },
      { id: 'por-facturar',         term: { pt: 'Por Facturar',         en: '' }, definition: { pt: 'Adjudicado mas sem factura ainda.', en: '' } },
      { id: 'orcamento-disponivel', term: { pt: 'Orçamento Disponível', en: '' }, definition: { pt: 'Quanto ainda há para gastar. Quando adjudicado > orçamento, mostrado a vermelho como overbudget.', en: '' }, formula: 'Orçamento − Adjudicado' },
    ],
  },
  {
    id: 'recursos',
    title: { pt: '6. Recursos', en: '' },
    terms: [
      { id: 'recurso',       term: { pt: 'Recurso',       en: '' }, definition: { pt: 'Pessoa alocada a actividades ou planos.', en: '' } },
      { id: 'alocacao',      term: { pt: 'Alocação',      en: '' }, definition: { pt: '% do tempo de um Recurso dedicado a uma actividade.', en: '' } },
      { id: 'sobrealocacao', term: { pt: 'Sobrealocação', en: '' }, definition: { pt: 'Quando Alocação total de um Recurso > 100%.', en: '' } },
      { id: 'capacidade',    term: { pt: 'Capacidade',    en: '' }, definition: { pt: 'Tempo disponível total do Recurso (feature futura).', en: '' } },
    ],
  },
  {
    id: 'riscos',
    title: { pt: '7. Riscos', en: '' },
    terms: [
      { id: 'risco',            term: { pt: 'Risco',             en: '' }, definition: { pt: 'Item identificado como ameaça à execução.', en: '' } },
      { id: 'severidade',       term: { pt: 'Severidade',        en: '' }, definition: { pt: 'Impacto × Probabilidade.', en: '' } },
      { id: 'mitigacao',        term: { pt: 'Mitigação',         en: '' }, definition: { pt: 'Acção para reduzir o risco.', en: '' } },
      { id: 'risco-critico',    term: { pt: 'Risco Crítico',     en: '' }, definition: { pt: 'Risco de severidade alta.', en: '' } },
      { id: 'ponto-atencao',    term: { pt: 'Ponto de Atenção',  en: '' }, definition: { pt: 'Risco de severidade moderada.', en: '' } },
      { id: 'requerer-atencao', term: { pt: 'A Requerer Atenção', en: '' }, definition: { pt: 'Estado agregado (Riscos Críticos + Pontos de Atenção).', en: '' } },
    ],
  },
  {
    id: 'dependencias',
    title: { pt: '8. Dependências', en: '' },
    terms: [
      { id: 'predecessor', term: { pt: 'Predecessor', en: '' }, definition: { pt: 'Actividade que deve estar concluída antes de outra começar.', en: '' } },
      { id: 'sucessor',    term: { pt: 'Sucessor',    en: '' }, definition: { pt: 'Actividade que depende de predecessor.', en: '' } },
      { id: 'dependencia', term: { pt: 'Dependência', en: '' }, definition: { pt: 'Relação entre duas actividades (predecessor ↔ sucessor).', en: '' } },
    ],
  },
  {
    id: 'versoes-temporais',
    title: { pt: '9. Versões / Temporais', en: '' },
    terms: [
      { id: 'snapshot', term: { pt: 'Snapshot', en: '' }, definition: { pt: 'Captura do estado de um plano/programa num momento.', en: '' } },
      { id: 'baseline', term: { pt: 'Baseline', en: '' }, definition: { pt: 'Versão referência inicial do plano (versão "congelada" para medir desvios).', en: '' } },
      { id: 'evolucao', term: { pt: 'Evolução', en: '' }, definition: { pt: 'Comparação temporal entre snapshots.', en: '' } },
      { id: 'prazo',    term: { pt: 'Prazo',    en: '' }, definition: { pt: 'Data limite para conclusão.', en: '' } },
    ],
  },
  {
    id: 'documentos',
    title: { pt: '10. Documentos', en: '' },
    terms: [
      { id: 'ponto-situacao',   term: { pt: 'Ponto de Situação', en: '' }, definition: { pt: 'Documento periódico de reporte de progresso.', en: '' } },
      { id: 'resumo-executivo', term: { pt: 'Resumo Executivo',  en: '' }, definition: { pt: 'Block de KPIs no topo de Dashboards e PlanoPage.', en: '' } },
      { id: 'visao-executiva',  term: { pt: 'Visão Executiva',   en: '' }, definition: { pt: 'Aba do PlanoPage com Resumo Executivo.', en: '' } },
      { id: 'factura',          term: { pt: 'Factura',           en: '' }, definition: { pt: 'Documento de cobrança.', en: '' } },
    ],
  },
  {
    id: 'roles',
    title: { pt: '11. Roles / Permissões', en: '' },
    terms: [
      { id: 'role-admin',           term: { pt: 'admin',           en: '' }, definition: { pt: 'Administrador do sistema. Acesso total.', en: '' } },
      { id: 'role-program-manager', term: { pt: 'program_manager', en: '' }, definition: { pt: 'Gestor de programa. Edita programas e tudo abaixo.', en: '' } },
      { id: 'role-project-manager', term: { pt: 'project_manager', en: '' }, definition: { pt: 'Gestor de plano. (Renomeação pendente de "editor".)', en: '' } },
      { id: 'role-stakeholder',     term: { pt: 'stakeholder',     en: '' }, definition: { pt: 'Stakeholder com visibilidade restrita. View-only com filtros.', en: '' } },
      { id: 'role-viewer',          term: { pt: 'viewer',          en: '' }, definition: { pt: 'Vê apenas o que lhe é partilhado. View-only mais restrito.', en: '' } },
    ],
  },
  {
    id: 'verbos',
    title: { pt: '12. Verbos / Acções', en: '' },
    intro: { pt: 'Distinção semântica crítica entre Remover e Eliminar.', en: '' },
    terms: [
      { id: 'verb-remover',   term: { pt: 'Remover',  en: '' }, definition: { pt: 'Desassociar / tirar de um conjunto sem apagar permanentemente.', en: '' }, notes: { pt: 'Ex: remover programa de utilizador, remover dependência', en: '' } },
      { id: 'verb-eliminar',  term: { pt: 'Eliminar', en: '' }, definition: { pt: 'Apagar permanentemente do sistema.', en: '' }, notes: { pt: 'Ex: eliminar plano, eliminar factura', en: '' } },
      { id: 'verb-editar',    term: { pt: 'Editar',   en: '' }, definition: { pt: 'Modificar campos sem perda.', en: '' } },
      { id: 'verb-duplicar',  term: { pt: 'Duplicar', en: '' }, definition: { pt: 'Criar cópia exacta.', en: '' } },
      { id: 'verb-importar',  term: { pt: 'Importar', en: '' }, definition: { pt: 'Carregar dados externos (ex: Excel).', en: '' } },
      { id: 'verb-exportar',  term: { pt: 'Exportar', en: '' }, definition: { pt: 'Gerar ficheiro com dados (ex: PDF).', en: '' } },
      { id: 'verb-convidar',  term: { pt: 'Convidar', en: '' }, definition: { pt: 'Convidar utilizador via email.', en: '' } },
      { id: 'verb-criar',     term: { pt: 'Criar',    en: '' }, definition: { pt: 'Criar novo registo.', en: '' } },
    ],
  },
  {
    id: 'visualizacoes',
    title: { pt: '13. Visualizações', en: '' },
    terms: [
      { id: 'viz-gantt',     term: { pt: 'Gantt',     en: '' }, definition: { pt: 'Vista de cronograma de actividades.', en: '' } },
      { id: 'viz-heatmap',   term: { pt: 'Heatmap',   en: '' }, definition: { pt: 'Mapa de calor (ex: alocação por mês).', en: '' } },
      { id: 'viz-tabela',    term: { pt: 'Tabela',    en: '' }, definition: { pt: 'Vista lista com colunas ordenáveis.', en: '' } },
      { id: 'viz-cards',     term: { pt: 'Cards',     en: '' }, definition: { pt: 'Vista em cartões individuais.', en: '' } },
      { id: 'viz-dashboard', term: { pt: 'Dashboard', en: '' }, definition: { pt: 'Vista agregada com múltiplos KPIs e charts.', en: '' } },
    ],
  },
]

// Locale helper — falls back to PT if EN is empty.
export function t(field: { pt: string; en?: string }, locale: 'pt' | 'en' = 'pt'): string {
  if (locale === 'en' && field.en && field.en.trim() !== '') {
    return field.en
  }
  return field.pt
}

// Lookup a term by id across all sections
export function findGlossaryTerm(id: string): GlossaryTerm | undefined {
  for (const section of GLOSSARY_SECTIONS) {
    const found = section.terms.find(term => term.id === id)
    if (found) return found
  }
  return undefined
}

// Lookup the section that contains a term (for "Ver glossário" deep link)
export function findGlossarySection(termId: string): GlossarySection | undefined {
  return GLOSSARY_SECTIONS.find(section =>
    section.terms.some(term => term.id === termId)
  )
}

// Map activity state label → glossary term id
const ACTIVITY_STATE_TO_TERM_ID: Record<string, string> = {
  'Em dia':    'estado-em-dia',
  'Em risco':  'estado-em-risco',
  'Em atraso': 'estado-em-atraso',
  'Concluída': 'estado-concluida',
}

export function getActivityStateTermId(state: string): string | undefined {
  return ACTIVITY_STATE_TO_TERM_ID[state]
}

// Map PDS state label → glossary term id
const PDS_STATE_TO_TERM_ID: Record<string, string> = {
  'Pendente':  'pds-pendente',
  'Em curso':  'pds-em-curso',
  'Concluído': 'pds-concluido',
}

export function getPdsStateTermId(state: string): string | undefined {
  return PDS_STATE_TO_TERM_ID[state]
}
