import { describe, it, expect } from 'vitest'
import {
  parseRows,
  parseDate,
  buildAncestors,
  type ParsedActivity,
} from './excel-import'

// ── Test data helpers ───────────────────────────────────────────

const HDR  = ['Nivel', 'Nome', 'Inicio_Planeado', 'Fim_Planeado', 'Inicio_Real', 'Fim_Real', 'Pct_Execucao', 'Notas']
const HDR_UUID = [...HDR, '_uuid']

/** Build a data row with sensible defaults */
function row(level: number, name: string, start = '01/01/2026', end = '31/12/2026', pct = 0): unknown[] {
  return [level, name, start, end, '', '', pct, '']
}

/** Build a data row that includes a _uuid column value */
function rowUuid(level: number, name: string, uuid: string): unknown[] {
  return [level, name, '01/01/2026', '31/12/2026', '', '', 0, '', uuid]
}

/** Wrap headers + data rows into the allRows format expected by parseRows */
function parse(headers: string[], rows: unknown[][]): ReturnType<typeof parseRows> {
  return parseRows([headers, ...rows])
}

// ── 1. Golden path ──────────────────────────────────────────────

describe('golden path', () => {
  it('parses a valid 3→6 hierarchy and returns correct parentIndex chain', () => {
    const { activities, errors } = parse(HDR, [
      row(3, 'M1'),
      row(4, 'A1'),
      row(5, 'S1'),
      row(6, 'D1'),
      row(4, 'A2'),
      row(5, 'S2'),
    ])
    expect(errors).toHaveLength(0)
    expect(activities).toHaveLength(6)

    const [m1, a1, s1, d1, a2, s2] = activities
    expect(m1.level).toBe(3); expect(m1.parentIndex).toBeNull()
    expect(a1.level).toBe(4); expect(a1.parentIndex).toBe(0)  // child of M1
    expect(s1.level).toBe(5); expect(s1.parentIndex).toBe(1)  // child of A1
    expect(d1.level).toBe(6); expect(d1.parentIndex).toBe(2)  // child of S1
    expect(a2.level).toBe(4); expect(a2.parentIndex).toBe(0)  // sibling of A1, child of M1
    expect(s2.level).toBe(5); expect(s2.parentIndex).toBe(4)  // child of A2 (not A1)

    const anc = buildAncestors(d1, activities)
    expect(anc.n3).toBe('M1')
    expect(anc.n4).toBe('A1')
    expect(anc.n5).toBe('S1')
    expect(anc.n6).toBe('D1')
  })
})

// ── 2. Stack invalidation ───────────────────────────────────────

describe('stack invalidation', () => {
  it('re-parents when going back to a higher-level sibling', () => {
    const { activities } = parse(HDR, [
      row(3, 'M1'),
      row(4, 'A1'),
      row(5, 'S1'),
      row(6, 'D1'),
      row(4, 'A2'),  // clears L5, L6 from stack
      row(5, 'S2'),  // must be child of A2, not A1
    ])
    const a2idx = activities.findIndex(a => a.name === 'A2')
    const s2    = activities.find(a => a.name === 'S2')!
    expect(s2.parentIndex).toBe(a2idx)
  })
})

// ── 3. Skip-level warning ───────────────────────────────────────

describe('skip-level warning', () => {
  it('level 6 after level 3 emits warnings but still parses the row', () => {
    const { activities, errors } = parse(HDR, [
      row(3, 'M1'),
      row(6, 'D1'),  // no L4, no L5 in stack
    ])
    expect(errors).toHaveLength(0)
    expect(activities).toHaveLength(2)

    const d1 = activities[1]
    expect(d1.level).toBe(6)
    expect(d1.parentIndex).toBeNull()
    expect(d1.warnings.some(w => w.includes('nível 4'))).toBe(true)
    expect(d1.warnings.some(w => w.includes('nível 5'))).toBe(true)

    const anc = buildAncestors(d1, activities)
    expect(anc.n4).toBe('')
    expect(anc.n5).toBe('')
    expect(anc.n6).toBe('D1')
  })
})

// ── 4. Empty rows ───────────────────────────────────────────────

describe('empty rows', () => {
  it('skips rows where all cells are blank', () => {
    const { activities, errors } = parse(HDR, [
      row(3, 'M1'),
      ['', '', '', '', '', '', '', ''],
      row(4, 'A1'),
      ['', '', '', '', '', '', '', ''],
    ])
    expect(errors).toHaveLength(0)
    expect(activities).toHaveLength(2)
  })
})

// ── 5. Invalid level ────────────────────────────────────────────

describe('invalid level', () => {
  it('level 7 emits a ParseError and row is skipped', () => {
    const { activities, errors } = parse(HDR, [
      row(3, 'M1'),
      [7, 'X', '01/01/2026', '31/12/2026', '', '', 0, ''],
      row(4, 'A1'),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(3)  // Excel row 3 (header=1, M1=2, X=3)
    expect(errors[0].message).toMatch(/Nível inválido/)
    expect(activities).toHaveLength(2)  // M1 and A1
  })

  it('level 2 also emits a ParseError', () => {
    const { errors } = parse(HDR, [
      [2, 'Bad', '01/01/2026', '31/12/2026', '', '', 0, ''],
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/Nível inválido/)
  })
})

// ── 6. Missing required columns ─────────────────────────────────

describe('missing required columns', () => {
  it('returns a single ParseError on row 1 when Nivel is absent', () => {
    const { activities, errors } = parse(
      ['Nome', 'Inicio_Planeado', 'Fim_Planeado'],
      [['M1', '01/01/2026', '31/12/2026']],
    )
    expect(activities).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(1)
    expect(errors[0].message).toMatch(/Nivel/)
  })
})

// ── 7. Date formats ─────────────────────────────────────────────

describe('parseDate', () => {
  it('handles Date objects', () => {
    expect(parseDate(new Date('2026-06-01'))).toBe('2026-06-01')
  })

  it('returns null for an invalid Date', () => {
    expect(parseDate(new Date('not-a-date'))).toBeNull()
  })

  it('handles Excel serial numbers', () => {
    // Serial 46003 → 2025-12-31
    const result = parseDate(46003)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('handles dd/mm/yyyy string', () => {
    expect(parseDate('01/06/2026')).toBe('2026-06-01')
  })

  it('handles yyyy-mm-dd string (passthrough)', () => {
    expect(parseDate('2026-06-01')).toBe('2026-06-01')
  })

  it('handles yyyy/mm/dd string', () => {
    expect(parseDate('2026/06/01')).toBe('2026-06-01')
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseDate(null)).toBeNull()
  })
})

// ── 8. UUID present and valid ───────────────────────────────────

describe('UUID support', () => {
  it('captures a valid UUID from _uuid column', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const { activities, errors } = parse(HDR_UUID, [rowUuid(3, 'M1', validUuid)])
    expect(errors).toHaveLength(0)
    expect(activities[0].uuid).toBe(validUuid.toLowerCase())
    expect(activities[0].warnings).toHaveLength(0)
  })

  // ── 9. UUID present but invalid ──────────────────────────────

  it('emits a warning and sets uuid to null when _uuid is malformed', () => {
    const { activities } = parse(HDR_UUID, [rowUuid(3, 'M1', 'not-a-uuid')])
    expect(activities[0].uuid).toBeNull()
    expect(activities[0].warnings.some(w => w.includes('_uuid inválido'))).toBe(true)
  })

  // ── 10. UUID absent ──────────────────────────────────────────

  it('sets uuid to null silently when _uuid column is absent', () => {
    const { activities } = parse(HDR, [row(3, 'M1')])
    const act: ParsedActivity = activities[0]
    expect(act.uuid).toBeNull()
    expect(act.warnings).toHaveLength(0)
  })
})
