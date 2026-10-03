import { describe, it, expect } from 'vitest'
import {
  generateStatusNarrative, selectFamily, fmtPct, fmtNum, windowPhrase, TREND_PERIODS,
  type NarrativeParams,
} from './statusNarrative'

const BASE: NarrativeParams = {
  status: 'Em dia',
  execMedia: 68.25,
  execTarget: 75,
  riskCount: 0,
  delayedCount: 0,
  concludedCount: 0,
  criticalRisks: 0,
  deadline: '2027-01-15',
  realFinish: null,
  today: '2026-10-02',
  trend: null,
  windowDays: 30,
  stabilityPoints: 1,
}
const p = (o: Partial<NarrativeParams> = {}): NarrativeParams => ({ ...BASE, ...o })

// ── Formatting ────────────────────────────────────────────────
describe('truncation', () => {
  it('truncates, never rounds up: 99.98 → 99,9%', () => {
    expect(fmtPct(99.98)).toBe('99,9%')
  })
  it('99.999 still does not reach 100%', () => {
    expect(fmtPct(99.999)).toBe('99,9%')
  })
  it('exactly 100 renders 100%', () => {
    expect(fmtPct(100)).toBe('100%')
  })
  it('drops a trailing ,0 on round values', () => {
    expect(fmtPct(75)).toBe('75%')
    expect(fmtNum(13)).toBe('13')
  })
  it('keeps one decimal when present', () => {
    expect(fmtNum(6.85)).toBe('6,8')
  })
  it('a 99.x plano never shows 100% in the full sentence', () => {
    const s = generateStatusNarrative(p({ execMedia: 99.98, execTarget: 100 }))
    expect(s).toContain('99,9%')
    expect(s).not.toMatch(/100% executado/)
  })
})

// ── Family selection ──────────────────────────────────────────
describe('family selection', () => {
  it('execTarget 0 → não iniciado, NOT "em linha com o objectivo de 0%"', () => {
    const params = p({ execMedia: 0, execTarget: 0 })
    expect(selectFamily(params)).toBe('nao_iniciado')
    const s = generateStatusNarrative(params)
    expect(s).toBe('Plano ainda não iniciado.')
    expect(s).not.toContain('objectivo')
  })
  it('zero execution WITH a live target is NOT não iniciado — it reads as em curso', () => {
    const params = p({ execMedia: 0, execTarget: 30 })
    expect(selectFamily(params)).toBe('em_curso')
    const s = generateStatusNarrative(params)
    expect(s).toBe('0% executado contra 30% previsto, com três meses até ao prazo.')
    expect(s).not.toContain('não iniciado')
  })
  it('Concluída → concluído', () => {
    expect(selectFamily(p({ status: 'Concluída' }))).toBe('concluido')
  })
  it('deadline before the window opened → fora de prazo', () => {
    expect(selectFamily(p({ deadline: '2026-07-10' }))).toBe('fora_de_prazo')
  })
  it('deadline inside the window → ultrapassou o prazo', () => {
    expect(selectFamily(p({ deadline: '2026-09-20' }))).toBe('ultrapassou_prazo')
  })
  it('future deadline → em curso', () => {
    expect(selectFamily(p())).toBe('em_curso')
  })
  it('no deadline at all → em curso', () => {
    expect(selectFamily(p({ deadline: null }))).toBe('em_curso')
  })
  it('precedence: concluído wins over no baseline', () => {
    expect(selectFamily(p({ status: 'Concluída', execTarget: 0 }))).toBe('concluido')
  })
  it('a plano at 100% with no baseline reads concluído, never "não iniciado"', () => {
    const s = generateStatusNarrative(p({
      status: 'Concluída', execMedia: 100, execTarget: 0, concludedCount: 24, realFinish: '2026-09-14',
    }))
    expect(s).toBe('Concluído em Setembro de 2026, com 24 actividades fechadas.')
    expect(s).not.toContain('não iniciado')
  })
  it('no baseline + no execution → não iniciado', () => {
    const params = p({ execMedia: 0, execTarget: 0 })
    expect(selectFamily(params)).toBe('nao_iniciado')
    expect(generateStatusNarrative(params)).toBe('Plano ainda não iniciado.')
  })
  it('no baseline + some execution → em execução, sem baseline', () => {
    const params = p({ execMedia: 12, execTarget: 0 })
    expect(selectFamily(params)).toBe('sem_baseline')
    expect(generateStatusNarrative(params)).toBe('Em execução (12%), sem baseline para comparação.')
  })
  it('the sem-baseline percentage is truncated like everywhere else', () => {
    expect(generateStatusNarrative(p({ execMedia: 12.39, execTarget: 0 })))
      .toBe('Em execução (12,3%), sem baseline para comparação.')
  })
  it('precedence: concluído wins over an expired deadline', () => {
    expect(selectFamily(p({ status: 'Concluída', deadline: '2026-07-10' }))).toBe('concluido')
  })
})

// ── Family wording ────────────────────────────────────────────
describe('family wording', () => {
  it('concluído with real finish names the month', () => {
    expect(generateStatusNarrative(p({ status: 'Concluída', concludedCount: 24, realFinish: '2026-09-14' })))
      .toBe('Concluído em Setembro de 2026, com 24 actividades fechadas.')
  })
  it('concluído without real dates falls back', () => {
    expect(generateStatusNarrative(p({ status: 'Concluída', concludedCount: 24, realFinish: null })))
      .toBe('Plano concluído, com 24 actividades fechadas.')
  })
  it('concluído singular', () => {
    expect(generateStatusNarrative(p({ status: 'Concluída', concludedCount: 1, realFinish: '2026-09-14' })))
      .toContain('com uma actividade fechada.')
  })
  it('fora de prazo reports remaining work and pace, never "agravou-se"', () => {
    const s = generateStatusNarrative(p({
      deadline: '2026-07-10', execMedia: 78.4, execTarget: 100,
      trend: { prevExec: 76.4, prevGap: 23.6 },
    }))
    expect(s).toBe('Prazo terminou em Julho de 2026. Faltam 21,6% por executar e avançou 2 pontos no último mês.')
    expect(s).not.toContain('agravou')
  })
  it('fora de prazo without history omits the pace', () => {
    expect(generateStatusNarrative(p({ deadline: '2026-07-10', execMedia: 78.4, execTarget: 100 })))
      .toBe('Prazo terminou em Julho de 2026. Faltam 21,6% por executar.')
  })
  it('ultrapassou o prazo', () => {
    expect(generateStatusNarrative(p({
      deadline: '2026-09-20', execMedia: 78.4, execTarget: 100,
      trend: { prevExec: 76.4, prevGap: 10 },
    }))).toBe('Ultrapassou o prazo em Setembro de 2026 com 21,6% por executar; avançou apenas 2 pontos no último mês.')
  })
})

// ── The enumeration ───────────────────────────────────────────
describe('enumeration', () => {
  it('full example: order em risco → em atraso → risco → prazo', () => {
    expect(generateStatusNarrative(p({
      execMedia: 68.25, execTarget: 75,
      riskCount: 5, delayedCount: 2, criticalRisks: 1,
      deadline: '2027-01-15',
    }))).toBe('68,2% executado contra 75% previsto, com cinco actividades em risco e duas em atraso, um risco crítico e três meses até ao prazo.')
  })
  it('omits every zero item', () => {
    expect(generateStatusNarrative(p({ deadline: null })))
      .toBe('68,2% executado contra 75% previsto.')
  })
  it('em atraso alone carries the noun', () => {
    expect(generateStatusNarrative(p({ delayedCount: 2, deadline: null })))
      .toContain('com duas actividades em atraso.')
  })
  it('em atraso after em risco drops the repeated noun', () => {
    expect(generateStatusNarrative(p({ riskCount: 5, delayedCount: 2, deadline: null })))
      .toContain('com cinco actividades em risco e duas em atraso.')
  })
  it('singular actividade em risco', () => {
    expect(generateStatusNarrative(p({ riskCount: 1, deadline: null })))
      .toContain('com uma actividade em risco.')
  })
  it('plural riscos críticos uses masculine words', () => {
    expect(generateStatusNarrative(p({ criticalRisks: 3, deadline: null })))
      .toContain('com três riscos críticos.')
  })
  it('counts above nine stay numeric', () => {
    expect(generateStatusNarrative(p({ delayedCount: 14, deadline: null })))
      .toContain('com 14 actividades em atraso.')
  })
  it('singular mês (sole item, so no conjunction)', () => {
    expect(generateStatusNarrative(p({ deadline: '2026-11-20' })))
      .toContain('com um mês até ao prazo.')
  })
  it('singular mês joined after other items', () => {
    expect(generateStatusNarrative(p({ delayedCount: 1, deadline: '2026-11-20' })))
      .toContain('com uma actividade em atraso e um mês até ao prazo.')
  })
  it('omits the prazo item when the deadline is under a month away', () => {
    expect(generateStatusNarrative(p({ deadline: '2026-10-20' })))
      .toBe('68,2% executado contra 75% previsto.')
  })
})

// ── The trend clause ──────────────────────────────────────────
describe('trend clause', () => {
  const base = p({ execMedia: 68.2, execTarget: 75, deadline: null })  // gap now = 6.8

  it('widened + advanced → desfavorável', () => {
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 55.2, prevGap: 5 } }))
      .toContain('Tendência desfavorável: avançou 13 pontos no último mês, mas o desvio agravou-se de 5 para 6,8 pontos.')
  })
  it('widened + stalled → desfavorável, sem avanço', () => {
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 68.2, prevGap: 2.1 } }))
      .toContain('Tendência desfavorável: praticamente sem avanço no último mês, com o desvio a subir de 2,1 para 6,8 pontos.')
  })
  it('narrowed + advanced → favorável', () => {
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 50.2, prevGap: 10 } }))
      .toContain('Tendência favorável: avançou 18 pontos no último mês e o desvio reduziu-se de 10 para 6,8 pontos.')
  })
  it('narrowed + stalled → no judgement word, never "favorável"', () => {
    const s = generateStatusNarrative({ ...base, trend: { prevExec: 68.2, prevGap: 10 } })
    expect(s).toBe('68,2% executado contra 75% previsto. Sem avanços no último mês, embora o desvio se tenha reduzido de 10 para 6,8 pontos.')
    expect(s).not.toContain('favorável')
  })
  it('stable + Em dia → mantém o ritmo previsto (no "Tendência" prefix)', () => {
    const s = generateStatusNarrative({ ...base, status: 'Em dia', trend: { prevExec: 61.5, prevGap: 6.8 } })
    expect(s).toBe('68,2% executado contra 75% previsto. Mantém o ritmo previsto: avançou 6,7 pontos no último mês, com o desvio praticamente inalterado.')
  })
  it('stable + Em risco → sem recuperação, stating the current gap level', () => {
    const s = generateStatusNarrative({ ...base, status: 'Em risco', trend: { prevExec: 61.5, prevGap: 6.8 } })
    expect(s).toBe('68,2% executado contra 75% previsto. Sem recuperação: avançou 6,7 pontos no último mês, mas o desvio mantém-se em 6,8 pontos.')
  })
  it('stable + Em atraso → sem recuperação', () => {
    expect(generateStatusNarrative({ ...base, status: 'Em atraso', trend: { prevExec: 61.5, prevGap: 6.8 } }))
      .toContain('Sem recuperação: avançou 6,7 pontos no último mês, mas o desvio mantém-se em 6,8 pontos.')
  })
  it('sem recuperação with a large gap reads the level, not a from-to', () => {
    // gap 18 both then and now
    expect(generateStatusNarrative({ ...base, execMedia: 57, status: 'Em risco', trend: { prevExec: 50.3, prevGap: 18 } }))
      .toContain('Sem recuperação: avançou 6,7 pontos no último mês, mas o desvio mantém-se em 18 pontos.')
  })
  it('same stable gap change, different state → different label', () => {
    const trend = { prevExec: 61.5, prevGap: 6.8 }
    const emDia    = generateStatusNarrative({ ...base, status: 'Em dia',    trend })
    const emRisco  = generateStatusNarrative({ ...base, status: 'Em risco',  trend })
    const emAtraso = generateStatusNarrative({ ...base, status: 'Em atraso', trend })
    expect(emDia).toContain('Mantém o ritmo previsto')
    expect(emDia).not.toContain('Sem recuperação')
    expect(emRisco).toContain('Sem recuperação')
    expect(emRisco).not.toContain('Mantém o ritmo previsto')
    expect(emAtraso).toBe(emRisco)
  })
  it('stable + Em dia + stalled → sem avanço material', () => {
    // gap 6.8 then and now, no progress
    expect(generateStatusNarrative({ ...base, status: 'Em dia', trend: { prevExec: 68.2, prevGap: 6.8 } }))
      .toBe('68,2% executado contra 75% previsto. Mantém o ritmo previsto: sem avanço material no último mês, com o desvio praticamente inalterado.')
  })
  it('stable + Em risco + stalled → execução inalterada, with the gap level', () => {
    expect(generateStatusNarrative({ ...base, execMedia: 57, status: 'Em risco', trend: { prevExec: 57, prevGap: 18 } }))
      .toContain('Sem recuperação: execução inalterada no último mês, com o desvio em 18 pontos.')
  })
  it('stable + Em atraso + stalled → execução inalterada', () => {
    expect(generateStatusNarrative({ ...base, status: 'Em atraso', trend: { prevExec: 68.2, prevGap: 6.8 } }))
      .toContain('Sem recuperação: execução inalterada no último mês, com o desvio em 6,8 pontos.')
  })
  it('negative progress counts as stalled and is never printed as a number', () => {
    // execution revised down 0.3 (stable gap) and down 3 (gap widened)
    const stable  = generateStatusNarrative({ ...base, status: 'Em dia',   trend: { prevExec: 68.5, prevGap: 6.8 } })
    const risco   = generateStatusNarrative({ ...base, status: 'Em risco', trend: { prevExec: 68.5, prevGap: 6.8 } })
    const widened = generateStatusNarrative({ ...base, trend: { prevExec: 71.2, prevGap: 3.8 } })
    expect(stable).toContain('Mantém o ritmo previsto: sem avanço material no último mês')
    expect(risco).toContain('Sem recuperação: execução inalterada no último mês')
    expect(widened).toContain('Tendência desfavorável: praticamente sem avanço no último mês')
    for (const s of [stable, risco, widened]) {
      expect(s).not.toContain('avançou -')
      expect(s).not.toMatch(/-\d/)
    }
  })
  // prevExec 78.4 → zero progress; prevExec 80 → revised down 1.6
  for (const prevExec of [78.4, 80]) {
    it(`fora de prazo, progress ${(78.4 - prevExec).toFixed(1)} → sem avanço material`, () => {
      const s = generateStatusNarrative(p({
        deadline: '2026-07-10', execMedia: 78.4, execTarget: 100, trend: { prevExec, prevGap: 20 },
      }))
      expect(s).toBe('Prazo terminou em Julho de 2026. Faltam 21,6% por executar, sem avanço material no último mês.')
      expect(s).not.toContain('avançou 0')
      expect(s).not.toContain('avançou -')
    })
    it(`ultrapassou o prazo, progress ${(78.4 - prevExec).toFixed(1)} → sem avanço material`, () => {
      const s = generateStatusNarrative(p({
        deadline: '2026-09-20', execMedia: 78.4, execTarget: 100, trend: { prevExec, prevGap: 10 },
      }))
      expect(s).toBe('Ultrapassou o prazo em Setembro de 2026 com 21,6% por executar, sem avanço material no último mês.')
      expect(s).not.toContain('avançou 0')
      expect(s).not.toContain('avançou -')
    })
  }
  it('the stable labels carry no "Tendência" prefix', () => {
    const trend = { prevExec: 61.5, prevGap: 6.8 }
    expect(generateStatusNarrative({ ...base, status: 'Em dia',   trend })).not.toContain('Tendência')
    expect(generateStatusNarrative({ ...base, status: 'Em risco', trend })).not.toContain('Tendência')
  })
  it('no history → no trend clause at all', () => {
    const s = generateStatusNarrative({ ...base, trend: null })
    expect(s).not.toContain('Tendência')
    expect(s).toBe('68,2% executado contra 75% previsto.')
  })
})

// ── Stability threshold boundary ──────────────────────────────
describe('stability threshold boundary', () => {
  // gap now = 6.8; stabilityPoints = 1
  const base = p({ execMedia: 68.2, execTarget: 75, deadline: null, stabilityPoints: 1 })

  it('gap change exactly at the threshold counts as stable', () => {
    // prevGap 5.8 → change +1.0, not > 1
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 55.2, prevGap: 5.8 } }))
      .toContain('Mantém o ritmo previsto')
  })
  it('gap change just outside the threshold counts as widened', () => {
    // prevGap 5.7 → change +1.1 > 1
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 55.2, prevGap: 5.7 } }))
      .toContain('Tendência desfavorável')
  })
  it('raising the threshold flips a borderline plano back to stable', () => {
    expect(generateStatusNarrative({ ...base, stabilityPoints: 2, trend: { prevExec: 55.2, prevGap: 5.7 } }))
      .toContain('Mantém o ritmo previsto')
  })
})

// ── Window phrasing ───────────────────────────────────────────
describe('window phrasing', () => {
  it('the five named periods map to their exact phrase', () => {
    expect(windowPhrase(7)).toBe('na última semana')
    expect(windowPhrase(15)).toBe('na última quinzena')
    expect(windowPhrase(30)).toBe('no último mês')
    expect(windowPhrase(90)).toBe('no último trimestre')
    expect(windowPhrase(180)).toBe('no último semestre')
  })
  it('any other length is stated literally — never a false "no último mês"', () => {
    expect(windowPhrase(45)).toBe('nos últimos 45 dias')
    expect(windowPhrase(10)).toBe('nos últimos 10 dias')
    expect(windowPhrase(31)).toBe('nos últimos 31 dias')
    expect(windowPhrase(200)).toBe('nos últimos 200 dias')
  })
  it('the Admin options are exactly the named periods, with matching phrases', () => {
    expect(TREND_PERIODS.map(t => [t.label, t.days, t.phrase])).toEqual([
      ['Semana',    7,   'na última semana'],
      ['Quinzena',  15,  'na última quinzena'],
      ['Mês',       30,  'no último mês'],
      ['Trimestre', 90,  'no último trimestre'],
      ['Semestre',  180, 'no último semestre'],
    ])
    for (const t of TREND_PERIODS) expect(windowPhrase(t.days)).toBe(t.phrase)
  })
  it('the sentence uses the configured phrasing', () => {
    expect(generateStatusNarrative(p({
      execMedia: 68.2, execTarget: 75, deadline: null, windowDays: 7,
      trend: { prevExec: 55.2, prevGap: 5 },
    }))).toContain('na última semana')
  })
  it('a stored window below a week is read as 7 — never a sub-week phrase', () => {
    expect(windowPhrase(3)).toBe('na última semana')
    expect(windowPhrase(1)).toBe('na última semana')
    expect(windowPhrase(45)).toBe('nos últimos 45 dias')
    expect(generateStatusNarrative(p({
      execMedia: 68.2, execTarget: 75, deadline: null, windowDays: 3,
      trend: { prevExec: 55.2, prevGap: 5 },
    }))).toContain('avançou 13 pontos na última semana')
  })
  it('a sub-week stored window also uses 7 days for the deadline-family boundary', () => {
    // deadline 5 days ago: inside a 7-day window → ultrapassou, as for windowDays 7
    expect(selectFamily(p({ deadline: '2026-09-27', windowDays: 3 }))).toBe('ultrapassou_prazo')
  })
  it('a non-named window reaches the sentence literally', () => {
    const s = generateStatusNarrative(p({
      execMedia: 68.2, execTarget: 75, deadline: null, windowDays: 45,
      trend: { prevExec: 55.2, prevGap: 5 },
    }))
    expect(s).toContain('avançou 13 pontos nos últimos 45 dias')
    expect(s).not.toContain('no último mês')
  })
})

// ── The state is never named ──────────────────────────────────
describe('the plan state is never restated', () => {
  it('"Em execução" (sem baseline) is not mistaken for, nor contains, a plan state', () => {
    const s = generateStatusNarrative(p({ status: 'Em atraso', execMedia: 12, execTarget: 0 }))
    for (const state of ['Em dia', 'Em risco', 'Em atraso', 'Concluída']) expect(s).not.toContain(state)
  })
  for (const status of ['Em dia', 'Em risco', 'Em atraso']) {
    it(`"${status}" does not appear in the text`, () => {
      const s = generateStatusNarrative(p({ status, riskCount: 2, delayedCount: 1 }))
      expect(s).not.toContain(status)
    })
    it(`"${status}" selects the stalled stable label without being named`, () => {
      const s = generateStatusNarrative(p({ status, trend: { prevExec: 68.25, prevGap: 6.75 } }))
      expect(s).not.toContain(status)
    })
    it(`"${status}" selects the stable trend label without being named`, () => {
      const s = generateStatusNarrative(p({ status, trend: { prevExec: 61.5, prevGap: 6.75 } }))
      expect(s).not.toContain(status)
    })
  }
})
