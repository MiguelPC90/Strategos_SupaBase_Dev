import { useMemo } from 'react'
import { useRisks } from './useRisks'
import { usePdsConsolidated } from './usePdsEntries'
import { useAppConfig } from './useAppConfig'
import { leafPctPrev } from '../lib/rollup'
import { DEFAULT_THRESHOLDS } from '../lib/riskColors'
import {
  computeHealth, DEFAULT_HEALTH_CONFIG,
  type HealthInput,
} from '../lib/healthRules'

/** Mirrors computeHealth's return type (not exported from healthRules.ts). */
export interface PlanoHealth {
  level:   'red' | 'amber' | 'green'
  reasons: string[]
}
import type { Activity } from '../types/index'
import type { EffectiveValue } from './useEffectiveValues'

/**
 * The plan health semaphore: a five-metric composite (exec_delay, delayed_pct,
 * critical_risks, high_risks, attention_open) evaluated against the Admin's
 * `app_config.health_rules` by computeHealth.
 *
 * The rule evaluation was always shared (lib/healthRules.ts); the HealthInput
 * construction was not — it lived only in PontoSituacao. This hook is that
 * construction, lifted VERBATIM, so PontoSituacao and PlanoPage cannot drift.
 *
 * `planLeaves` and `eff` are taken as arguments rather than recomputed: both pages
 * already derive them for the plano status pill, and one source per page keeps the
 * semaphore consistent with the pill beside it.
 *
 * useRisks and usePdsConsolidated are React Query, so calling this alongside a page
 * that already uses them costs no extra request — they share the cache.
 */
export function usePlanoHealth(
  planoId:    string | null | undefined,
  programId:  string | null | undefined,
  planLeaves: Activity[],
  eff:        Map<string, EffectiveValue>,
  today:      string,
): PlanoHealth {
  const { risks }            = useRisks(programId ?? undefined)
  const { items: pdsItems }  = usePdsConsolidated(planoId ?? undefined)
  const { config, getJSON }  = useAppConfig()

  const thresholds   = useMemo(() => getJSON('risk_thresholds', DEFAULT_THRESHOLDS),    [config])
  const healthConfig = useMemo(() => getJSON('health_rules',    DEFAULT_HEALTH_CONFIG), [config])

  const planRisks = useMemo(
    () => planoId ? risks.filter(r => r.plano_id === planoId) : [],
    [risks, planoId],
  )

  // Matches PontoSituacao's `visAttention`: hidden items are dropped first, then the
  // HealthInput drops completed ones. Kept as two steps so the filter stays verbatim.
  const visAttention = useMemo(
    () => pdsItems.attention.filter(i => !i.hidden_at),
    [pdsItems.attention],
  )

  const healthInput = useMemo((): HealthInput => {
    const total     = planLeaves.length
    const delayed   = planLeaves.filter(a => {
      const s = eff.get(a.id)?.status ?? 'Em dia'
      return s === 'Em atraso' || s === 'Em risco'
    }).length
    const avgPct    = total > 0 ? planLeaves.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / total : 0
    const avgPrev   = total > 0 ? planLeaves.reduce((s, a) => s + leafPctPrev(a, today), 0) / total : 0
    const attOpen   = visAttention.filter(i => {
      const s = (i.status ?? '').toLowerCase()
      return s !== 'concluído' && s !== 'concluída'
    }).length
    return {
      execDelay:     Math.max(0, avgPrev - avgPct),
      delayedPct:    total > 0 ? (delayed / total) * 100 : 0,
      criticalRisks: planRisks.filter(r => r.impact * r.probability > thresholds.high).length,
      highRisks:     planRisks.filter(r => {
        const g = r.impact * r.probability
        return g > thresholds.medium && g <= thresholds.high
      }).length,
      attentionOpen: attOpen,
    }
  }, [planLeaves, eff, planRisks, visAttention, thresholds, today])

  return useMemo(
    () => computeHealth(healthInput, healthConfig),
    [healthInput, healthConfig],
  )
}
