export type HealthMetric =
  | 'exec_delay'
  | 'delayed_pct'
  | 'critical_risks'
  | 'high_risks'
  | 'attention_open'

export interface HealthRule {
  metric: HealthMetric
  enabled: boolean
  threshold: number
}

export interface HealthBlock {
  operator: 'OR' | 'AND'
  rules: HealthRule[]
}

export interface HealthConfig {
  red: HealthBlock
  amber: HealthBlock
}

export const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  red: {
    operator: 'OR',
    rules: [
      { metric: 'exec_delay',     enabled: true,  threshold: 20 },
      { metric: 'delayed_pct',    enabled: true,  threshold: 30 },
      { metric: 'critical_risks', enabled: true,  threshold: 1  },
      { metric: 'attention_open', enabled: false, threshold: 1  },
    ],
  },
  amber: {
    operator: 'OR',
    rules: [
      { metric: 'exec_delay',     enabled: true, threshold: 10 },
      { metric: 'delayed_pct',    enabled: true, threshold: 10 },
      { metric: 'high_risks',     enabled: true, threshold: 1  },
      { metric: 'attention_open', enabled: true, threshold: 1  },
    ],
  },
}

export const HEALTH_METRIC_LABELS: Record<HealthMetric, string> = {
  exec_delay:     'Desvio de execução (pp)',
  delayed_pct:    '% actividades em atraso',
  critical_risks: 'Nº riscos críticos ≥',
  high_risks:     'Nº riscos elevados ≥',
  attention_open: 'Pontos de atenção abertos ≥',
}

export interface HealthInput {
  execDelay:     number
  delayedPct:    number
  criticalRisks: number
  highRisks:     number
  attentionOpen: number
}

function evalRule(rule: HealthRule, input: HealthInput): boolean {
  if (!rule.enabled) return false
  const value = (() => {
    switch (rule.metric) {
      case 'exec_delay':     return input.execDelay
      case 'delayed_pct':   return input.delayedPct
      case 'critical_risks': return input.criticalRisks
      case 'high_risks':    return input.highRisks
      case 'attention_open': return input.attentionOpen
    }
  })()
  return value >= rule.threshold
}

function evalBlock(block: HealthBlock, input: HealthInput): { triggered: boolean; matched: HealthMetric[] } {
  const enabled = block.rules.filter(r => r.enabled)
  if (enabled.length === 0) return { triggered: false, matched: [] }
  const matched = enabled.filter(r => evalRule(r, input)).map(r => r.metric)
  const triggered = block.operator === 'OR'
    ? matched.length > 0
    : matched.length === enabled.length
  return { triggered, matched }
}

export function computeHealth(
  input: HealthInput,
  config: HealthConfig,
): { level: 'red' | 'amber' | 'green'; reasons: string[] } {
  const red = evalBlock(config.red, input)
  if (red.triggered) {
    return { level: 'red', reasons: red.matched.map(m => HEALTH_METRIC_LABELS[m]) }
  }
  const amber = evalBlock(config.amber, input)
  if (amber.triggered) {
    return { level: 'amber', reasons: amber.matched.map(m => HEALTH_METRIC_LABELS[m]) }
  }
  return { level: 'green', reasons: ['Sem alertas'] }
}
