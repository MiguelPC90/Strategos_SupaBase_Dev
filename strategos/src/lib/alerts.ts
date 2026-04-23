import type { AlertRule, AlertSeverity, Snapshot } from '../types/index'

export type { AlertSeverity }
export type { AlertRule }

export interface Alert {
  id: string
  ruleKey: string
  severity: AlertSeverity
  title: string
  description: string
  href?: string
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

interface PlanoRef {
  id: string
  name: string
  program_id: string | null
}

export function generateAlerts(opts: {
  rules: AlertRule[]
  currentSnapshot: Snapshot | null
  snapshot14daysAgo: Snapshot | null
  planos: PlanoRef[]
  programIdFilter?: string
}): Alert[] {
  const { rules, currentSnapshot, snapshot14daysAgo, planos, programIdFilter } = opts
  if (!currentSnapshot) return []

  // Build lookup maps
  const planoNameById = new Map(planos.map(p => [p.id, p.name]))
  const planosByProgram = new Map<string, Set<string>>()
  for (const p of planos) {
    if (!p.program_id) continue
    const s = planosByProgram.get(p.program_id) ?? new Set()
    s.add(p.id)
    planosByProgram.set(p.program_id, s)
  }
  const scopedPlanoIds: Set<string> | null = programIdFilter
    ? (planosByProgram.get(programIdFilter) ?? new Set())
    : null  // null = global (no filter)

  const alerts: Alert[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const threshold = rule.threshold ?? 0

    // ── risk_critical ──────────────────────────────────────────
    if (rule.rule_key === 'risk_critical') {
      const top = currentSnapshot.risks?.top_criticos ?? []
      for (const risk of top) {
        if (risk.grade < threshold) continue
        if (scopedPlanoIds !== null && risk.planoId && !scopedPlanoIds.has(risk.planoId)) continue
        const planoName = risk.planoId ? (planoNameById.get(risk.planoId) ?? 'Plano desconhecido') : '—'
        alerts.push({
          id:          `risk_${risk.id}`,
          ruleKey:     rule.rule_key,
          severity:    rule.severity,
          title:       `Risco crítico: "${risk.description}"`,
          description: `${planoName} — grade ${risk.grade}`,
          href:        risk.planoId ? `/ponto-situacao?plano=${risk.planoId}` : '/ponto-situacao',
        })
      }
    }

    // ── invoice_overdue ────────────────────────────────────────
    if (rule.rule_key === 'invoice_overdue') {
      // program-scoped overdue not available in snapshot — show global only
      if (scopedPlanoIds === null || scopedPlanoIds.size > 0) {
        const count = currentSnapshot.financials?.totals?.facturas_overdue_count ?? 0
        const value = currentSnapshot.financials?.totals?.facturas_overdue_value ?? 0
        if (count > 0) {
          alerts.push({
            id:          'invoice_overdue',
            ruleKey:     rule.rule_key,
            severity:    rule.severity,
            title:       `${count} factura${count !== 1 ? 's' : ''} em atraso`,
            description: `Total ${fmtCurrency(value)} por regularizar`,
            href:        '/exec-financeira',
          })
        }
      }
    }

    // ── plan_stagnated ─────────────────────────────────────────
    if (rule.rule_key === 'plan_stagnated') {
      const byN2     = currentSnapshot.by_n2 ?? {}
      const prevByN2 = snapshot14daysAgo?.by_n2 ?? {}
      for (const [planoId, kpi] of Object.entries(byN2)) {
        if (kpi.total === 0) continue
        if (scopedPlanoIds !== null && !scopedPlanoIds.has(planoId)) continue
        const prevKpi = prevByN2[planoId]
        if (!prevKpi || prevKpi.total === 0) continue
        if (Math.abs(kpi.exec_media - prevKpi.exec_media) > 1) continue  // moved enough
        const planoName = planoNameById.get(planoId) ?? planoId.slice(0, 8)
        alerts.push({
          id:          `stagnated_${planoId}`,
          ruleKey:     rule.rule_key,
          severity:    rule.severity,
          title:       `Plano "${planoName}" sem progresso`,
          description: `Concretização inalterada há ${threshold} dias`,
          href:        `/ponto-situacao?plano=${planoId}`,
        })
      }
    }
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return alerts
}
