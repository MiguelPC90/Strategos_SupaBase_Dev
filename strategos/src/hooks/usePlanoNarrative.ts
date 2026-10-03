import { useMemo } from 'react'
import { useSnapshots } from './useSnapshots'
import { useRisks } from './useRisks'
import { useAppConfig } from './useAppConfig'
import { rollupPctPrev } from '../lib/rollup'
import { DEFAULT_THRESHOLDS } from '../lib/riskColors'
import { selectTrendInput } from '../lib/narrativeTrend'
import { generateStatusNarrative, effectiveWindowDays } from '../lib/statusNarrative'
import type { Activity } from '../types/index'
import type { EffectiveValue } from './useEffectiveValues'

/** app_config keys for the two tuning parameters (Admin → Definições → Tendência). */
export const TREND_WINDOW_KEY    = 'narrative_trend_window_days'
export const TREND_STABILITY_KEY = 'narrative_trend_stability_points'
export const TREND_WINDOW_DEFAULT    = 30
export const TREND_STABILITY_DEFAULT = 1

/**
 * The plan status narrative, assembled once for both PlanoPage and PontoSituacao.
 *
 * Every input is derived HERE so the same plano reads word-for-word identically on
 * both pages. Previously each page built the inputs itself and the two copies had
 * to be kept aligned by hand (commit 7267d8c) — that is the drift this hook removes.
 *
 * Percentages stay RAW (unrounded): the narrative truncates them itself, and
 * feeding it pre-rounded values would change which branch it picks.
 *
 * useSnapshots / useRisks are React Query, so calling this alongside a page that
 * already uses them costs no extra request.
 */
export function usePlanoNarrative(
  planoId:    string | null | undefined,
  programId:  string | null | undefined,
  planoStatus: string,
  planLeaves: Activity[],
  eff:        Map<string, EffectiveValue>,
  today:      string,
): string {
  const { snapshots }       = useSnapshots(programId ?? undefined)
  const { risks }           = useRisks(programId ?? undefined)
  const { config, getJSON, getNumber } = useAppConfig()

  const windowDays = useMemo(
    () => effectiveWindowDays(getNumber(TREND_WINDOW_KEY, TREND_WINDOW_DEFAULT) || TREND_WINDOW_DEFAULT),
    [config],
  )
  const stabilityPoints = useMemo(
    () => getNumber(TREND_STABILITY_KEY, TREND_STABILITY_DEFAULT),
    [config],
  )
  const riskThresholds = useMemo(
    () => getJSON('risk_thresholds', DEFAULT_THRESHOLDS),
    [config],
  )

  return useMemo(() => {
    if (planLeaves.length === 0) return ''

    const execMedia = planLeaves.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / planLeaves.length
    const execTarget = rollupPctPrev(planLeaves, today)

    let riskCount = 0, delayedCount = 0, concludedCount = 0
    for (const a of planLeaves) {
      const st = eff.get(a.id)?.status
      if (st === 'Em risco')   riskCount++
      if (st === 'Em atraso')  delayedCount++
      if (st === 'Concluída')  concludedCount++
    }

    // Deadline = latest baseline finish; realFinish = latest real finish.
    let deadline: string | null = null
    let realFinish: string | null = null
    for (const a of planLeaves) {
      const bf = a.bf ?? a.finish
      if (bf && (!deadline || bf > deadline)) deadline = bf
      if (a.rf && (!realFinish || a.rf > realFinish)) realFinish = a.rf
    }

    const criticalRisks = planoId
      ? risks.filter(r => r.plano_id === planoId && r.impact * r.probability > riskThresholds.high).length
      : 0

    return generateStatusNarrative({
      status: planoStatus,
      execMedia,
      execTarget,
      riskCount,
      delayedCount,
      concludedCount,
      criticalRisks,
      deadline,
      realFinish,
      today,
      trend: selectTrendInput(snapshots, planoId, today, windowDays),
      windowDays,
      stabilityPoints,
    })
  }, [
    planoId, planoStatus, planLeaves, eff, today,
    risks, riskThresholds, snapshots, windowDays, stabilityPoints,
  ])
}
