// Stratgos canonical glossary.
// PT-PT is canonical. EN translations are empty placeholders, to be filled later.
// When EN is empty, the page falls back to PT.

export interface GlossaryTerm {
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
      { term: { pt: 'Programa', en: '' }, definition: { pt: 'Container de mais alto nível. Agrupa eixos sob uma direcção estratégica.', en: '' }, notes: { pt: 'Ex: "Programa Estratégico 2026"', en: '' } },
      { term: { pt: 'Eixo', en: '' }, definition: { pt: 'Pilar estratégico dentro de um programa. Agrupa planos relacionados.', en: '' }, notes: { pt: 'Equivalente a "objectivo estratégico"', en: '' } },
      { term: { pt: 'Plano', en: '' }, definition: { pt: 'Iniciativa accionável (sub-eixo). Tem responsável, orçamento, prazo.', en: '' }, notes: { pt: 'Unidade fundamental de execução', en: '' } },
      { term: { pt: 'Actividade', en: '' }, definition: { pt: 'Item de trabalho concreto dentro de um plano.', en: '' } },
      { term: { pt: 'Tarefa', en: '' }, definition: { pt: 'Sub-actividade. Granularidade mais fina para decomposições detalhadas.', en: '' } },
    ],
  },
  {
    id: 'estados-actividade',
    title: { pt: '2. Estados de Actividade', en: '' },
    intro: { pt: 'Aplicam-se a Actividades (e propagam para níveis superiores via rollup).', en: '' },
    terms: [
      { term: { pt: 'Em dia', en: '' }, definition: { pt: 'Avança conforme planeado.', en: '' } },
      { term: { pt: 'Em risco', en: '' }, definition: { pt: 'Sinais de potencial desvio (warnings, slowdown).', en: '' } },
      { term: { pt: 'Em atraso', en: '' }, definition: { pt: 'Já desviou do prazo planeado.', en: '' } },
      { term: { pt: 'Concluída', en: '' }, definition: { pt: 'Trabalho terminado, entregue.', en: '' } },
    ],
  },
  {
    id: 'estados-pds',
    title: { pt: '3. Estados de Ponto de Situação (PDS)', en: '' },
    intro: { pt: 'Aplicam-se a documentos PDS — não confundir com Estados de Actividade.', en: '' },
    terms: [
      { term: { pt: 'Pendente', en: '' }, definition: { pt: 'PDS criado, aguarda preenchimento.', en: '' } },
      { term: { pt: 'Em curso', en: '' }, definition: { pt: 'PDS em iteração / em preenchimento.', en: '' } },
      { term: { pt: 'Concluído', en: '' }, definition: { pt: 'PDS finalizado e entregue.', en: '' } },
    ],
  },
  {
    id: 'metricas',
    title: { pt: '4. Métricas de Execução', en: '' },
    intro: { pt: 'Três métricas distintas, frequentemente confundidas.', en: '' },
    terms: [
      { term: { pt: 'Grau de Execução', en: '' }, definition: { pt: '% de progresso real das actividades (média ponderada). Indica quanto já fizemos do total (avanço absoluto).', en: '' }, formula: 'Σ(% real × peso) / Σ(peso)' },
      { term: { pt: 'Concretização Geral', en: '' }, definition: { pt: '% de actividades concluídas vs total. Indica quantas actividades estão fechadas (contagem).', en: '' }, formula: '(concluídas / total) × 100' },
      { term: { pt: 'Concretização à Data', en: '' }, definition: { pt: '% de progresso real vs progresso esperado para a data actual. Índice >100% = à frente, <100% = atrás.', en: '' }, formula: '(grau_execução / grau_esperado) × 100' },
      { term: { pt: 'Objectivo', en: '' }, definition: { pt: 'Grau de Execução esperado para a data actual.', en: '' } },
    ],
  },
  {
    id: 'financeiro',
    title: { pt: '5. Financeiro', en: '' },
    intro: { pt: 'Aplicável a Plano (e agregação em Programa via BudgetPage).', en: '' },
    terms: [
      { term: { pt: 'Orçamento', en: '' }, definition: { pt: 'Valor total alocado ao plano/programa.', en: '' } },
      { term: { pt: 'Adjudicado', en: '' }, definition: { pt: 'Valor contratualizado (compromisso assinado).', en: '' } },
      { term: { pt: 'Pago', en: '' }, definition: { pt: 'Valor já facturado e pago.', en: '' } },
      { term: { pt: 'Em Pagamento', en: '' }, definition: { pt: 'Facturado, aguarda pagamento.', en: '' } },
      { term: { pt: 'Por Facturar', en: '' }, definition: { pt: 'Adjudicado mas sem factura ainda.', en: '' } },
      { term: { pt: 'Orçamento Disponível', en: '' }, definition: { pt: 'Quanto ainda há para gastar. Quando adjudicado > orçamento, mostrado a vermelho como overbudget.', en: '' }, formula: 'Orçamento − Adjudicado' },
    ],
  },
  {
    id: 'recursos',
    title: { pt: '6. Recursos', en: '' },
    terms: [
      { term: { pt: 'Recurso', en: '' }, definition: { pt: 'Pessoa alocada a actividades ou planos.', en: '' } },
      { term: { pt: 'Alocação', en: '' }, definition: { pt: '% do tempo de um Recurso dedicado a uma actividade.', en: '' } },
      { term: { pt: 'Sobrealocação', en: '' }, definition: { pt: 'Quando Alocação total de um Recurso > 100%.', en: '' } },
      { term: { pt: 'Capacidade', en: '' }, definition: { pt: 'Tempo disponível total do Recurso (feature futura).', en: '' } },
    ],
  },
  {
    id: 'riscos',
    title: { pt: '7. Riscos', en: '' },
    terms: [
      { term: { pt: 'Risco', en: '' }, definition: { pt: 'Item identificado como ameaça à execução.', en: '' } },
      { term: { pt: 'Severidade', en: '' }, definition: { pt: 'Impacto × Probabilidade.', en: '' } },
      { term: { pt: 'Mitigação', en: '' }, definition: { pt: 'Acção para reduzir o risco.', en: '' } },
      { term: { pt: 'Risco Crítico', en: '' }, definition: { pt: 'Risco de severidade alta.', en: '' } },
      { term: { pt: 'Ponto de Atenção', en: '' }, definition: { pt: 'Risco de severidade moderada.', en: '' } },
      { term: { pt: 'A Requerer Atenção', en: '' }, definition: { pt: 'Estado agregado (Riscos Críticos + Pontos de Atenção).', en: '' } },
    ],
  },
  {
    id: 'dependencias',
    title: { pt: '8. Dependências', en: '' },
    terms: [
      { term: { pt: 'Predecessor', en: '' }, definition: { pt: 'Actividade que deve estar concluída antes de outra começar.', en: '' } },
      { term: { pt: 'Sucessor', en: '' }, definition: { pt: 'Actividade que depende de predecessor.', en: '' } },
      { term: { pt: 'Dependência', en: '' }, definition: { pt: 'Relação entre duas actividades (predecessor ↔ sucessor).', en: '' } },
    ],
  },
  {
    id: 'versoes-temporais',
    title: { pt: '9. Versões / Temporais', en: '' },
    terms: [
      { term: { pt: 'Snapshot', en: '' }, definition: { pt: 'Captura do estado de um plano/programa num momento.', en: '' } },
      { term: { pt: 'Baseline', en: '' }, definition: { pt: 'Versão referência inicial do plano (versão "congelada" para medir desvios).', en: '' } },
      { term: { pt: 'Evolução', en: '' }, definition: { pt: 'Comparação temporal entre snapshots.', en: '' } },
      { term: { pt: 'Prazo', en: '' }, definition: { pt: 'Data limite para conclusão.', en: '' } },
    ],
  },
  {
    id: 'documentos',
    title: { pt: '10. Documentos', en: '' },
    terms: [
      { term: { pt: 'PDS', en: '' }, definition: { pt: 'Sigla de "Ponto de Situação".', en: '' } },
      { term: { pt: 'Ponto de Situação', en: '' }, definition: { pt: 'Documento periódico de reporte de progresso.', en: '' } },
      { term: { pt: 'Resumo Executivo', en: '' }, definition: { pt: 'Block de KPIs no topo de Dashboards e PlanoPage.', en: '' } },
      { term: { pt: 'Visão Executiva', en: '' }, definition: { pt: 'Aba do PlanoPage com Resumo Executivo.', en: '' } },
      { term: { pt: 'Factura', en: '' }, definition: { pt: 'Documento de cobrança.', en: '' } },
    ],
  },
  {
    id: 'roles',
    title: { pt: '11. Roles / Permissões', en: '' },
    terms: [
      { term: { pt: 'admin', en: '' }, definition: { pt: 'Administrador do sistema. Acesso total.', en: '' } },
      { term: { pt: 'program_manager', en: '' }, definition: { pt: 'Gestor de programa. Edita programas e tudo abaixo.', en: '' } },
      { term: { pt: 'project_manager', en: '' }, definition: { pt: 'Gestor de plano. (Renomeação pendente de "editor".)', en: '' } },
      { term: { pt: 'stakeholder', en: '' }, definition: { pt: 'Stakeholder com visibilidade restrita. View-only com filtros.', en: '' } },
      { term: { pt: 'viewer', en: '' }, definition: { pt: 'Vê apenas o que lhe é partilhado. View-only mais restrito.', en: '' } },
    ],
  },
  {
    id: 'verbos',
    title: { pt: '12. Verbos / Acções', en: '' },
    intro: { pt: 'Distinção semântica crítica entre Remover e Eliminar.', en: '' },
    terms: [
      { term: { pt: 'Remover', en: '' }, definition: { pt: 'Desassociar / tirar de um conjunto sem apagar permanentemente.', en: '' }, notes: { pt: 'Ex: remover programa de utilizador, remover dependência', en: '' } },
      { term: { pt: 'Eliminar', en: '' }, definition: { pt: 'Apagar permanentemente do sistema.', en: '' }, notes: { pt: 'Ex: eliminar plano, eliminar factura', en: '' } },
      { term: { pt: 'Editar', en: '' }, definition: { pt: 'Modificar campos sem perda.', en: '' } },
      { term: { pt: 'Duplicar', en: '' }, definition: { pt: 'Criar cópia exacta.', en: '' } },
      { term: { pt: 'Importar', en: '' }, definition: { pt: 'Carregar dados externos (ex: Excel).', en: '' } },
      { term: { pt: 'Exportar', en: '' }, definition: { pt: 'Gerar ficheiro com dados (ex: PDF).', en: '' } },
      { term: { pt: 'Convidar', en: '' }, definition: { pt: 'Convidar utilizador via email.', en: '' } },
      { term: { pt: 'Criar', en: '' }, definition: { pt: 'Criar novo registo.', en: '' } },
    ],
  },
  {
    id: 'visualizacoes',
    title: { pt: '13. Visualizações', en: '' },
    terms: [
      { term: { pt: 'Gantt', en: '' }, definition: { pt: 'Vista de cronograma de actividades.', en: '' } },
      { term: { pt: 'Heatmap', en: '' }, definition: { pt: 'Mapa de calor (ex: alocação por mês).', en: '' } },
      { term: { pt: 'Tabela', en: '' }, definition: { pt: 'Vista lista com colunas ordenáveis.', en: '' } },
      { term: { pt: 'Cards', en: '' }, definition: { pt: 'Vista em cartões individuais.', en: '' } },
      { term: { pt: 'Dashboard', en: '' }, definition: { pt: 'Vista agregada com múltiplos KPIs e charts.', en: '' } },
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
