import { useState, type ReactNode } from 'react'

export interface Column {
  key: string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode
}

interface TableProps {
  columns?: Column[]
  rows?: Record<string, unknown>[]
  emptyMessage?: string
}

export default function Table({ columns = [], rows = [], emptyMessage = 'Sem dados' }: TableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rows

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={[
                  col.sortable ? 'sortable' : '',
                  sortKey === col.key ? `sort-${sortDir}` : '',
                ].filter(Boolean).join(' ')}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && (
                  <span className="sort-icon">
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr key={String(row['id'] ?? i)}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
