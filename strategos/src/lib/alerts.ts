import type { AlertRule, AlertSeverity, Snapshot } from '../types/index'
import { supabase } from './supabase'

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
  start_date?: string | null
}

export async function generateAlerts(opts: {
  rules: AlertRule[]
  currentSnapshot: Snapshot | null
  snapshot14daysAgo: Snapshot | null
  planos: PlanoRef[]
  planoFilter: Set<string> | null  // null = no filter; empty Set = filter active, nothing matches
}): Promise<Alert[]> {
  const { rules, currentSnapshot, snapshot14daysAgo, planos, planoFilter } = opts
  if (!currentSnapshot) return []

  const planoNameById = new Map(planos.map(p => [p.id, p.name]))
  // planoFilter: null → show all; Set → only include planos whose id is in the Set
  const scopedPlanoIds = planoFilter

  // Eligible planos: already started AND not concluded
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eligiblePlanoIds = new Set<string>()
  for (const plano of planos) {
    if (plano.start_date && new Date(plano.start_date) > today) continue
    const execMedia = currentSnapshot.by_n2?.[plano.id]?.exec_media ?? 0
    if (execMedia >= 100) continue
    eligiblePlanoIds.add(plano.id)
  }

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
        if (risk.planoId && !eligiblePlanoIds.has(risk.planoId)) continue
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
      if (scopedPlanoIds !== null) {
        // Filter active — query fin_invoices scoped to the selected planos
        const today = new Date().toISOString().split('T')[0]
        const { data: invoices, error } = await supabase
          .from('fin_invoices')
          .select('id, amount, plano_id')
          .in('status', ['Recebida', 'Aprovada'])
          .lt('due_date', today)
        if (!error && invoices) {
          const scoped = invoices.filter(
            inv => inv.plano_id && scopedPlanoIds.has(inv.plano_id),
          )
          if (scoped.length > 0) {
            const count      = scoped.length
            const totalValue = scoped.reduce((s, inv) => s + Number(inv.amount ?? 0), 0)
            alerts.push({
              id:          'invoice_overdue',
              ruleKey:     rule.rule_key,
              severity:    rule.severity,
              title:       `${count} factura${count !== 1 ? 's' : ''} em atraso`,
              description: `Total ${fmtCurrency(totalValue)} por regularizar`,
              href:        '/exec-financeira',
            })
          }
        }
      } else {
        // No filter — use snapshot totals (global)
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
        if (!eligiblePlanoIds.has(planoId)) continue
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

    // ── activity_late_chronic ──────────────────────────────────
    if (rule.rule_key === 'activity_late_chronic') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - threshold)
      const cutoffStr = cutoff.toISOString().split('T')[0]
      const { data: acts, error: actErr } = await supabase
        .from('activities')
        .select('id, name, bf, pct, plano_id, n2')
        .lt('bf', cutoffStr)
        .lt('pct', 100)
        .eq('level', 4)
        .order('bf', { ascending: true })
        .limit(5)
      if (!actErr && acts) {
        const today = new Date()
        for (const act of acts) {
          if (scopedPlanoIds !== null && (!act.plano_id || !scopedPlanoIds.has(act.plano_id))) continue
          if (act.plano_id && !eligiblePlanoIds.has(act.plano_id)) continue
          const daysLate  = Math.floor((today.getTime() - new Date(act.bf).getTime()) / 86_400_000)
          const planoName = act.plano_id ? (planoNameById.get(act.plano_id) ?? act.n2 ?? '—') : (act.n2 ?? '—')
          alerts.push({
            id:          `activity_late_chronic_${act.id}`,
            ruleKey:     rule.rule_key,
            severity:    rule.severity,
            title:       `Actividade "${act.name}" em atraso crónico`,
            description: `${daysLate} dias em atraso — ${planoName}`,
            href:        act.plano_id ? `/actividades?plano=${act.plano_id}` : '/actividades',
          })
        }
      }
    }

    // ── budget_exceeded ────────────────────────────────────────
    if (rule.rule_key === 'budget_exceeded') {
      if (scopedPlanoIds === null) {
        const totals = currentSnapshot.financials?.totals
        if (totals && totals.total_budget > 0) {
          const pct = (totals.total_executed / totals.total_budget) * 100
          if (pct > threshold) {
            alerts.push({
              id:          'budget_exceeded',
              ruleKey:     rule.rule_key,
              severity:    rule.severity,
              title:       'Orçamento ultrapassado',
              description: `Executado ${pct.toFixed(1)}% do total (${fmtCurrency(totals.total_executed)} de ${fmtCurrency(totals.total_budget)})`,
              href:        '/exec-financeira',
            })
          }
        }
      }
    }

    // ── invoice_overdue_long ───────────────────────────────────
    if (rule.rule_key === 'invoice_overdue_long') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - threshold)
      const cutoffStr = cutoff.toISOString().split('T')[0]
      const { data: invoices, error: invErr } = await supabase
        .from('fin_invoices')
        .select('id, amount, plano_id, due_date, supplier, ref')
        .in('status', ['Recebida', 'Aprovada'])
        .lt('due_date', cutoffStr)
        .order('due_date', { ascending: true })
        .limit(5)
      if (!invErr && invoices) {
        const today = new Date()
        for (const inv of invoices) {
          if (scopedPlanoIds !== null && (!inv.plano_id || !scopedPlanoIds.has(inv.plano_id))) continue
          const daysOverdue = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86_400_000)
          alerts.push({
            id:          `invoice_overdue_long_${inv.id}`,
            ruleKey:     rule.rule_key,
            severity:    rule.severity,
            title:       `Factura em atraso há ${daysOverdue} dias`,
            description: `${inv.supplier ?? 'Fornecedor'} — ${fmtCurrency(Number(inv.amount ?? 0))} (ref ${inv.ref ?? '—'})`,
            href:        '/exec-financeira',
          })
        }
      }
    }

    // ── risks_many_in_plan ────────────────────────────────────
    if (rule.rule_key === 'risks_many_in_plan') {
      const { data: riskRows } = await supabase
        .from('risks')
        .select('plano_id, status')
        .in('status', ['Aberto', 'Em mitigação', 'Open'])
      const countByPlano = new Map<string, number>()
      for (const r of riskRows ?? []) {
        if (!r.plano_id) continue
        countByPlano.set(r.plano_id, (countByPlano.get(r.plano_id) ?? 0) + 1)
      }
      for (const [planoId, count] of countByPlano) {
        if (scopedPlanoIds !== null && !scopedPlanoIds.has(planoId)) continue
        if (!eligiblePlanoIds.has(planoId)) continue
        if (count <= threshold) continue
        const planoName = planoNameById.get(planoId) ?? planoId.slice(0, 8)
        alerts.push({
          id:          `risks-many-${planoId}`,
          ruleKey:     rule.rule_key,
          severity:    rule.severity,
          title:       `${count} riscos abertos no plano "${planoName}"`,
          description: `Mais que ${threshold} riscos requerem gestão`,
          href:        `/ponto-situacao?plano=${planoId}`,
        })
      }
    }

    // ── risk_new_critical ──────────────────────────────────────
    if (rule.rule_key === 'risk_new_critical') {
      const { data: cfg } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'risk_thresholds')
        .maybeSingle()
      const thresholds = cfg?.value as { high?: number } | null
      const criticalGrade = thresholds?.high ?? 15
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - threshold)
      const { data: riskRows } = await supabase
        .from('risks')
        .select('id, plano_id, description, probability, impact, status, created_at')
        .gte('created_at', cutoff.toISOString())
        .limit(20)
      for (const r of riskRows ?? []) {
        if (r.status === 'Mitigado' || r.status === 'Closed') continue
        const grade = (r.probability ?? 0) * (r.impact ?? 0)
        if (grade < criticalGrade) continue
        if (scopedPlanoIds !== null && r.plano_id && !scopedPlanoIds.has(r.plano_id)) continue
        if (r.plano_id && !eligiblePlanoIds.has(r.plano_id)) continue
        const planoName = r.plano_id ? (planoNameById.get(r.plano_id) ?? '—') : '—'
        alerts.push({
          id:          `risk-new-critical-${r.id}`,
          ruleKey:     rule.rule_key,
          severity:    rule.severity,
          title:       `Novo risco crítico: "${r.description}"`,
          description: `${planoName} — grade ${grade}`,
          href:        r.plano_id ? `/ponto-situacao?plano=${r.plano_id}` : '/ponto-situacao',
        })
      }
    }

    // ── plan_declining ─────────────────────────────────────────
    if (rule.rule_key === 'plan_declining') {
      if (snapshot14daysAgo) {
        const currentByN2 = currentSnapshot.by_n2 ?? {}
        const pastByN2    = snapshot14daysAgo.by_n2 ?? {}
        for (const [planoId, currentKpi] of Object.entries(currentByN2)) {
          if (scopedPlanoIds !== null && !scopedPlanoIds.has(planoId)) continue
          if (!eligiblePlanoIds.has(planoId)) continue
          const pastKpi = pastByN2[planoId]
          if (!pastKpi) continue
          const delta = currentKpi.exec_media - pastKpi.exec_media
          if (delta >= 0) continue
          if (Math.abs(delta) < threshold) continue
          const planoName = planoNameById.get(planoId) ?? planoId.slice(0, 8)
          alerts.push({
            id:          `plan-declining-${planoId}`,
            ruleKey:     rule.rule_key,
            severity:    rule.severity,
            title:       `Plano "${planoName}" em declínio`,
            description: `Concretização caiu ${Math.abs(delta).toFixed(1)}pp nos últimos 14 dias`,
            href:        `/ponto-situacao?plano=${planoId}`,
          })
        }
      }
    }

    // ── plan_pds_stale ─────────────────────────────────────────
    if (rule.rule_key === 'plan_pds_stale') {
      const { data: entries } = await supabase
        .from('pds_entries')
        .select('plano_id, created_at')
        .not('plano_id', 'is', null)
        .order('created_at', { ascending: false })
      const latestByPlano = new Map<string, string>()
      for (const e of entries ?? []) {
        if (!e.plano_id) continue
        if (!latestByPlano.has(e.plano_id)) latestByPlano.set(e.plano_id, e.created_at)
      }
      const staleMs = threshold * 86_400_000
      const now = Date.now()
      for (const [planoId, lastCreated] of latestByPlano) {
        if (scopedPlanoIds !== null && !scopedPlanoIds.has(planoId)) continue
        if (!eligiblePlanoIds.has(planoId)) continue
        const ageMs = now - new Date(lastCreated).getTime()
        if (ageMs < staleMs) continue
        const ageDays = Math.floor(ageMs / 86_400_000)
        const planoName = planoNameById.get(planoId) ?? planoId.slice(0, 8)
        alerts.push({
          id:          `plan-pds-stale-${planoId}`,
          ruleKey:     rule.rule_key,
          severity:    rule.severity,
          title:       `PDS desactualizado em "${planoName}"`,
          description: `Último PDS criado há ${ageDays} dias`,
          href:        `/ponto-situacao?plano=${planoId}`,
        })
      }
    }

    // ── plan_activities_stale ──────────────────────────────────
    if (rule.rule_key === 'plan_activities_stale') {
      const { data: acts } = await supabase
        .from('activities')
        .select('plano_id, updated_at')
        .not('plano_id', 'is', null)
        .order('updated_at', { ascending: false })
      const latestByPlano = new Map<string, string>()
      for (const a of acts ?? []) {
        if (!a.plano_id) continue
        if (!latestByPlano.has(a.plano_id)) latestByPlano.set(a.plano_id, a.updated_at)
      }
      const staleMs = threshold * 86_400_000
      const now = Date.now()
      for (const [planoId, lastUpdated] of latestByPlano) {
        if (scopedPlanoIds !== null && !scopedPlanoIds.has(planoId)) continue
        if (!eligiblePlanoIds.has(planoId)) continue
        const ageMs = now - new Date(lastUpdated).getTime()
        if (ageMs < staleMs) continue
        const ageDays = Math.floor(ageMs / 86_400_000)
        const planoName = planoNameById.get(planoId) ?? planoId.slice(0, 8)
        alerts.push({
          id:          `plan-activities-stale-${planoId}`,
          ruleKey:     rule.rule_key,
          severity:    rule.severity,
          title:       `Actividades paradas em "${planoName}"`,
          description: `Sem actualização há ${ageDays} dias`,
          href:        `/ponto-situacao?plano=${planoId}`,
        })
      }
    }
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return alerts
}
