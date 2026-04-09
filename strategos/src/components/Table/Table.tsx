import './Table.css'
import { useState, type ReactNode } from 'react'

export interface Column {
  key: string
  label: string
  sortable?: boolean
  /** Text alignment. Defaults to 'left' for the first column, 'center' for all others. */
  align?: 'left' | 'center' | 'right'
  /** Fixed column width, e.g. "70px". Used in <colgroup> with table-layout:fixed. */
  width?: string
  /** Minimum column width applied to th/td, e.g. "250px". */
  minWidth?: string
  /** Optional color applied to the header label, e.g. "var(--green)". */
  headerColor?: string
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode
}

interface TableProps {
  columns?: Column[]
  rows?: Record<string, unknown>[]
  emptyMessage?: string
  layout?: 'auto' | 'fixed'
  footerRow?: Record<string, unknown>
  /** Called when a data row is clicked. Footer row is never clickable. */
  onRowClick?: (row: Record<string, unknown>) => void
}

export default function Table({ columns = [], rows = [], emptyMessage = 'Sem dados', layout = 'auto', footerRow, onRowClick }: TableProps) {
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
      <table className="tbl" style={layout === 'fixed' ? { tableLayout: 'fixed', width: '100%' } : undefined}>
        {layout === 'fixed' && (
          <colgroup>
            {columns.map(col => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key}
                className={[
                  col.sortable ? 'sortable' : '',
                  sortKey === col.key ? `sort-${sortDir}` : '',
                ].filter(Boolean).join(' ')}
                style={{ textAlign: col.align ?? (idx === 0 ? 'left' : 'center'), minWidth: col.minWidth, color: col.headerColor }}
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
              <tr
                key={String(row['id'] ?? i)}
                className={onRowClick ? 'tbl-row-clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col, idx) => (
                  <td key={col.key} style={{ textAlign: col.align ?? (idx === 0 ? 'left' : 'center'), minWidth: col.minWidth }}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
          {footerRow && (
            <tr className="tbl-footer-row">
              {columns.map((col, idx) => (
                <td key={col.key} style={{ textAlign: col.align ?? (idx === 0 ? 'left' : 'center'), minWidth: col.minWidth }}>
                  {col.render
                    ? col.render(footerRow[col.key], footerRow)
                    : (footerRow[col.key] as ReactNode) ?? '—'}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
