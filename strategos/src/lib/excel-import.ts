import * as XLSX from 'xlsx'

// ── Public types ────────────────────────────────────────────────

export interface ParsedActivity {
  rowNum: number
  uuid: string | null
  level: number
  name: string
  start_date: string | null
  end_date: string | null
  real_start: string | null
  real_end: string | null
  pct: number
  notes: string
  parentIndex: number | null
  warnings: string[]
}

export interface ParseError {
  row: number
  message: string
}

export interface ParseResult {
  activities: ParsedActivity[]
  errors: ParseError[]
}

export interface Ancestors {
  n3: string
  n4: string
  n5: string
  n6: string
}

// ── Internal ────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const REQUIRED_COLS = ['Nivel', 'Nome', 'Inicio_Planeado', 'Fim_Planeado']

// ── Exports ─────────────────────────────────────────────────────

export function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null
    return raw.toISOString().slice(0, 10)
  }
  if (typeof raw === 'number') {
    // Excel epoch: 1899-12-30 (accounts for the 1900 leap-year bug)
    const date = new Date(Date.UTC(1899, 11, 30) + raw * 86400000)
    return date.toISOString().slice(0, 10)
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    const m1 = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    const m2 = t.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  }
  return null
}

/**
 * Core row-level parser. `allRows[0]` = header row; `allRows[1..]` = data rows.
 * Exported so tests can drive it directly without an XLSX file round-trip.
 */
export function parseRows(allRows: unknown[][]): ParseResult {
  if (allRows.length < 2) {
    return { activities: [], errors: [{ row: 1, message: 'Ficheiro vazio ou sem dados.' }] }
  }

  const headers = (allRows[0] as string[]).map(h => String(h).trim())
  const colIdx  = (n: string) => headers.findIndex(h => h.toLowerCase() === n.toLowerCase())

  const iNivel   = colIdx('Nivel');           const iNome    = colIdx('Nome')
  const iInicioP = colIdx('Inicio_Planeado'); const iFimP    = colIdx('Fim_Planeado')
  const iInicioR = colIdx('Inicio_Real');     const iFimR    = colIdx('Fim_Real')
  const iPct     = colIdx('Pct_Execucao');    const iNotas   = colIdx('Notas')
  const iUuid    = colIdx('_uuid')

  const missingRequired = REQUIRED_COLS.filter(c => colIdx(c) < 0)
  if (missingRequired.length > 0) {
    return {
      activities: [],
      errors: [{ row: 1, message: `Colunas obrigatórias em falta (${missingRequired.join(', ')}). Use o template.` }],
    }
  }

  const activities: ParsedActivity[] = []
  const errors: ParseError[] = []
  const lastAtLevel: Record<number, number> = {}
  const dataRows = allRows.slice(1)

  for (let r = 0; r < dataRows.length; r++) {
    const row    = dataRows[r] as unknown[]
    if (row.every(c => !c || String(c).trim() === '')) continue

    // rowNum is 1-indexed Excel row number: header = row 1, first data row = row 2
    const rowNum = r + 2
    const level  = parseInt(String(row[iNivel] ?? '').trim(), 10)
    const name   = String(row[iNome] ?? '').trim()

    if (!level || level < 3 || level > 6) {
      errors.push({ row: rowNum, message: `Nível inválido: "${row[iNivel]}" (deve ser 3–6)` }); continue
    }
    if (!name) { errors.push({ row: rowNum, message: 'Nome em falta' }); continue }

    const start_date = parseDate(row[iInicioP] ?? null)
    const end_date   = parseDate(row[iFimP] ?? null)

    if (!start_date) {
      errors.push({ row: rowNum, message: 'Inicio_Planeado inválido (aceite: dd/mm/aaaa, aaaa-mm-dd, ou célula de data Excel)' }); continue
    }
    if (!end_date) {
      errors.push({ row: rowNum, message: 'Fim_Planeado inválido (aceite: dd/mm/aaaa, aaaa-mm-dd, ou célula de data Excel)' }); continue
    }
    if (end_date < start_date) {
      errors.push({ row: rowNum, message: 'Fim_Planeado anterior ao Inicio_Planeado' }); continue
    }

    const real_start = iInicioR >= 0 ? parseDate(row[iInicioR] ?? null) : null
    const real_end   = iFimR    >= 0 ? parseDate(row[iFimR]    ?? null) : null
    const pct        = Math.max(0, Math.min(100, parseInt(String(iPct >= 0 ? (row[iPct] ?? '0') : '0').trim(), 10) || 0))
    const notes      = iNotas   >= 0 ? String(row[iNotas] ?? '').trim() : ''

    // UUID resolution
    const warnings: string[] = []
    let uuid: string | null = null
    if (iUuid >= 0) {
      const rawUuid = String(row[iUuid] ?? '').trim()
      if (rawUuid) {
        if (UUID_REGEX.test(rawUuid)) {
          uuid = rawUuid.toLowerCase()
        } else {
          warnings.push('_uuid inválido — actividade será tratada como nova')
        }
      }
    }

    // Parent resolution — missing ancestor is a warning (non-fatal)
    let parentIndex: number | null = null
    if (level > 3) {
      if (level >= 4 && lastAtLevel[3] === undefined) warnings.push(`Nível ${level} sem ancestor de nível 3`)
      if (level >= 5 && lastAtLevel[4] === undefined) warnings.push(`Nível ${level} sem ancestor de nível 4`)
      if (level >= 6 && lastAtLevel[5] === undefined) warnings.push(`Nível ${level} sem ancestor de nível 5`)
      const pidx = lastAtLevel[level - 1]
      if (pidx !== undefined) parentIndex = pidx
    }

    const act: ParsedActivity = {
      rowNum, uuid, level, name, start_date, end_date,
      real_start, real_end, pct, notes, parentIndex, warnings,
    }
    const actIdx = activities.length
    activities.push(act)
    lastAtLevel[level] = actIdx
    for (const k of Object.keys(lastAtLevel).map(Number)) {
      if (k > level) delete lastAtLevel[k]
    }
  }

  return { activities, errors }
}

export function parseExcelBuffer(buffer: ArrayBuffer): ParseResult {
  const wb   = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  return parseRows(rows)
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer()
  return parseExcelBuffer(buf)
}

export function buildAncestors(act: ParsedActivity, all: ParsedActivity[]): Ancestors {
  const chain: ParsedActivity[] = [act]
  let pidx = act.parentIndex
  while (pidx !== null) { chain.unshift(all[pidx]); pidx = all[pidx].parentIndex }
  const byLevel = new Map<number, string>()
  for (const a of chain) byLevel.set(a.level, a.name)
  return {
    n3: byLevel.get(3) ?? '',
    n4: byLevel.get(4) ?? '',
    n5: byLevel.get(5) ?? '',
    n6: byLevel.get(6) ?? '',
  }
}

export function downloadActivitiesTemplate(): void {
  const headers = ['Nivel', 'Nome', 'Inicio_Planeado', 'Fim_Planeado', 'Inicio_Real', 'Fim_Real', 'Pct_Execucao', 'Notas', '_uuid']
  const examples: (string | number)[][] = [
    [3, 'M1 - Análise',      '01/04/2026', '30/04/2026', '', '', 0, 'Fase de análise', ''],
    [4, 'A1 - Entrevistas',  '01/04/2026', '15/04/2026', '', '', 0, '',                ''],
    [5, 'S1 - Preparação',   '01/04/2026', '05/04/2026', '', '', 0, '',                ''],
    [5, 'S2 - Execução',     '06/04/2026', '15/04/2026', '', '', 0, '',                ''],
    [4, 'A2 - Documentação', '16/04/2026', '30/04/2026', '', '', 0, '',                ''],
    [3, 'M2 - Design',       '01/05/2026', '31/05/2026', '', '', 0, '',                ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = [
    { wch: 7 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
    { wch: 0, hidden: true },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Actividades')
  XLSX.writeFile(wb, 'template-actividades.xlsx')
}

// ── Phase 3: Export + Diff ──────────────────────────────────────

export interface ActivityForExport {
  id: string
  level: number
  name: string
  bs: string | null
  bf: string | null
  rs: string | null
  rf: string | null
  pct: number
  notes: string | null
}

export interface ExistingActivity {
  id: string
  level: number
  name: string
  bs: string | null
  bf: string | null
  rs: string | null
  rf: string | null
  pct: number
  notes: string | null
}

export type DiffType = 'new' | 'modified' | 'unchanged' | 'deleted'

export interface FieldChange {
  field: string
  oldValue: string | number | null
  newValue: string | number | null
}

export interface ActivityDiff {
  type: DiffType
  uuid: string | null
  level: number
  name: string
  parsed?: ParsedActivity
  ancestors?: Ancestors
  changes?: FieldChange[]
  existing?: ExistingActivity
  levelChanged?: boolean
  warnings: string[]
}

export interface DiffResult {
  diffs: ActivityDiff[]
  summary: {
    new: number
    modified: number
    unchanged: number
    deleted: number
    levelChanges: number
  }
}

function fmtDateForExport(d: string | null): string {
  if (!d) return ''
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40)
}

export function exportActivitiesToExcel(activities: ActivityForExport[], planoName: string): void {
  const headers = ['Nivel', 'Nome', 'Inicio_Planeado', 'Fim_Planeado', 'Inicio_Real', 'Fim_Real', 'Pct_Execucao', 'Notas', '_uuid']
  const rows = activities.map(a => [
    a.level, a.name,
    fmtDateForExport(a.bs), fmtDateForExport(a.bf),
    fmtDateForExport(a.rs), fmtDateForExport(a.rf),
    a.pct, a.notes ?? '', a.id,
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 7 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
    { wch: 0, hidden: true },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Actividades')
  XLSX.writeFile(wb, `actividades-${slugify(planoName)}.xlsx`)
}

export function computeDiff(parsed: ParsedActivity[], existing: ExistingActivity[]): DiffResult {
  const existingByUuid = new Map(existing.map(e => [e.id, e]))
  const seenUuids = new Set<string>()
  const diffs: ActivityDiff[] = []

  for (const p of parsed) {
    const ancestors = buildAncestors(p, parsed)

    if (!p.uuid) {
      diffs.push({ type: 'new', uuid: null, level: p.level, name: p.name, parsed: p, ancestors, warnings: p.warnings })
      continue
    }

    seenUuids.add(p.uuid)
    const ex = existingByUuid.get(p.uuid)

    if (!ex) {
      diffs.push({
        type: 'new', uuid: p.uuid, level: p.level, name: p.name, parsed: p, ancestors,
        warnings: [...p.warnings, 'UUID não encontrado — será inserido como novo'],
      })
      continue
    }

    type Check = { field: string; oldV: string | number | null; newV: string | number | null }
    const checks: Check[] = [
      { field: 'name',  oldV: (ex.name  ?? '').trim(), newV: p.name.trim()        },
      { field: 'level', oldV: ex.level,                 newV: p.level              },
      { field: 'bs',    oldV: ex.bs   ?? null,          newV: p.start_date ?? null },
      { field: 'bf',    oldV: ex.bf   ?? null,          newV: p.end_date   ?? null },
      { field: 'rs',    oldV: ex.rs   ?? null,          newV: p.real_start ?? null },
      { field: 'rf',    oldV: ex.rf   ?? null,          newV: p.real_end   ?? null },
      { field: 'pct',   oldV: ex.pct,                   newV: p.pct                },
      { field: 'notes', oldV: (ex.notes ?? '').trim(),  newV: p.notes.trim()       },
    ]
    const changes: FieldChange[] = checks
      .filter(c => c.oldV !== c.newV)
      .map(c => ({ field: c.field, oldValue: c.oldV, newValue: c.newV }))

    if (changes.length === 0) {
      diffs.push({ type: 'unchanged', uuid: p.uuid, level: p.level, name: p.name, parsed: p, ancestors, warnings: p.warnings })
    } else {
      diffs.push({
        type: 'modified', uuid: p.uuid, level: p.level, name: p.name,
        parsed: p, ancestors, changes, levelChanged: ex.level !== p.level,
        warnings: p.warnings,
      })
    }
  }

  for (const ex of existing) {
    if (!seenUuids.has(ex.id)) {
      diffs.push({ type: 'deleted', uuid: ex.id, level: ex.level, name: ex.name, existing: ex, warnings: [] })
    }
  }

  return {
    diffs,
    summary: {
      new:          diffs.filter(d => d.type === 'new').length,
      modified:     diffs.filter(d => d.type === 'modified').length,
      unchanged:    diffs.filter(d => d.type === 'unchanged').length,
      deleted:      diffs.filter(d => d.type === 'deleted').length,
      levelChanges: diffs.filter(d => d.levelChanged).length,
    },
  }
}
