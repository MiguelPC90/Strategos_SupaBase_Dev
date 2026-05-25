/**
 * Canonical sort utilities for hierarchical entities.
 *
 * Wave 4 (May 2026) — replaces ad-hoc .sort() calls across FilterBar,
 * PlanosCatalog, and other call sites. Works in concert with migration 037
 * which ensures sort_order is per-parent and collision-free in the DB.
 *
 * Two APIs are exposed:
 *
 * 1. compareCodes(a, b)    — natural sort over text codes ("1", "2", "10")
 * 2. compareEixos / comparePlanos — hierarchical comparison using program +
 *                                    eixo + plano codes, requires a Map from
 *                                    program_id to program.code (built once
 *                                    from usePrograms).
 *
 * When the caller has direct access to sort_order (post-migration 037), prefer
 * sort_order arithmetic. Use these comparators when sorting by code (e.g.
 * derived from text fields like activities.n1/n2).
 */

// Cached collator for natural sort with Portuguese locale support
const COLLATOR = new Intl.Collator('pt-PT', { numeric: true, sensitivity: 'base' })

/**
 * Natural compare for code strings. Numeric segments compared as numbers.
 * "1" < "2" < "10" < "10a" < "10b" < "11"
 * Null/empty codes sort to the end.
 */
export function compareCodes(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const ae = !a || a === ''
  const be = !b || b === ''
  if (ae && be) return 0
  if (ae) return 1   // empty/null → end
  if (be) return -1
  return COLLATOR.compare(a!, b!)
}

/**
 * Compare planos hierarchically: program → eixo → plano.
 * Requires a Map from program_id to program.code (built once from usePrograms).
 */
export function comparePlanos(
  a: { code: string; eixo: { code: string } | null; program_id: string | null },
  b: { code: string; eixo: { code: string } | null; program_id: string | null },
  programCodeMap: Map<string, string>,
): number {
  const c0 = compareCodes(
    programCodeMap.get(a.program_id ?? '') ?? '',
    programCodeMap.get(b.program_id ?? '') ?? '',
  )
  if (c0 !== 0) return c0
  const c1 = compareCodes(a.eixo?.code, b.eixo?.code)
  if (c1 !== 0) return c1
  return compareCodes(a.code, b.code)
}

/**
 * Compare eixos hierarchically: program → eixo.
 */
export function compareEixos(
  a: { code: string; program_id: string | null },
  b: { code: string; program_id: string | null },
  programCodeMap: Map<string, string>,
): number {
  const c0 = compareCodes(
    programCodeMap.get(a.program_id ?? '') ?? '',
    programCodeMap.get(b.program_id ?? '') ?? '',
  )
  if (c0 !== 0) return c0
  return compareCodes(a.code, b.code)
}
