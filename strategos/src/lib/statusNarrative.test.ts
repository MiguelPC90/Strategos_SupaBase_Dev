import { describe, it, expect } from 'vitest'
import {
  generateStatusNarrative, selectFamily, fmtPct, fmtNum, windowPhrase,
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
  it('zero execution → não iniciado', () => {
    expect(selectFamily(p({ execMedia: 0, execTarget: 40 }))).toBe('nao_iniciado')
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
  it('precedence: não iniciado wins over concluído', () => {
    expect(selectFamily(p({ status: 'Concluída', execMedia: 0 }))).toBe('nao_iniciado')
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
  it('stable + advanced → estável', () => {
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 61.5, prevGap: 6.8 } }))
      .toContain('Tendência estável: avançou 6,7 pontos no último mês, com o desvio praticamente inalterado.')
  })
  it('stable + stalled → estável, sem avanço material', () => {
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 68.2, prevGap: 6.8 } }))
      .toContain('Tendência estável: sem avanço material no último mês e desvio inalterado.')
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
      .toContain('Tendência estável')
  })
  it('gap change just outside the threshold counts as widened', () => {
    // prevGap 5.7 → change +1.1 > 1
    expect(generateStatusNarrative({ ...base, trend: { prevExec: 55.2, prevGap: 5.7 } }))
      .toContain('Tendência desfavorável')
  })
  it('raising the threshold flips a borderline plano back to estável', () => {
    expect(generateStatusNarrative({ ...base, stabilityPoints: 2, trend: { prevExec: 55.2, prevGap: 5.7 } }))
      .toContain('Tendência estável')
  })
})

// ── Window phrasing ───────────────────────────────────────────
describe('window phrasing', () => {
  it('maps the configured window to wording', () => {
    expect(windowPhrase(7)).toBe('na última semana')
    expect(windowPhrase(30)).toBe('no último mês')
    expect(windowPhrase(90)).toBe('no último trimestre')
    expect(windowPhrase(200)).toBe('nos últimos 200 dias')
  })
  it('the sentence uses the configured phrasing', () => {
    expect(generateStatusNarrative(p({
      execMedia: 68.2, execTarget: 75, deadline: null, windowDays: 7,
      trend: { prevExec: 55.2, prevGap: 5 },
    }))).toContain('na última semana')
  })
})

// ── The state is never named ──────────────────────────────────
describe('the plan state is never restated', () => {
  for (const status of ['Em dia', 'Em risco', 'Em atraso']) {
    it(`"${status}" does not appear in the text`, () => {
      const s = generateStatusNarrative(p({ status, riskCount: 2, delayedCount: 1 }))
      expect(s).not.toContain(status)
    })
  }
})
