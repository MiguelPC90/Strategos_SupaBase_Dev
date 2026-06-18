import { supabase } from './supabase'

const PAGE_SIZE = 1000

export async function fetchAllPaginated<T extends { id: string }>(
  table: string,
  opts: {
    select?: string
    orderBy?: { column: string; ascending?: boolean }
    apply?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
  } = {}
): Promise<T[]> {
  const { select = '*', orderBy, apply } = opts
  const all: T[] = []
  const seen = new Set<string>()
  let offset = 0

  for (;;) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select(select)
    if (apply) q = apply(q)
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true })
    q = q.order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)

    const { data, error } = await q
    if (error) throw new Error(error.message)

    const batch = (data ?? []) as T[]
    for (const row of batch) {
      if (!seen.has(row.id)) {
        seen.add(row.id)
        all.push(row)
      }
    }
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}
