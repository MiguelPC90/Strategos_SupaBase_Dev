import type { InvoiceStatus } from '../types'

export interface InvoiceStatusStyle {
  bg: string
  color: string
  label: string
}

export function invoiceStatusStyle(status: string): InvoiceStatusStyle {
  switch (status as InvoiceStatus) {
    case 'Prevista':
      return { bg: 'var(--bg3)',      color: 'var(--text3)',  label: 'Prevista'  }
    case 'Recebida':
      return { bg: 'var(--blue-bg)',  color: 'var(--blue)',   label: 'Recebida'  }
    case 'Aprovada':
      return { bg: 'var(--amber-bg)', color: 'var(--amber)',  label: 'Aprovada'  }
    case 'Paga':
      return { bg: 'var(--green-bg)', color: 'var(--green)',  label: 'Paga'      }
    case 'Rejeitada':
      return { bg: 'var(--red-bg)',   color: 'var(--red)',    label: 'Rejeitada' }
    default:
      return { bg: 'var(--bg3)',      color: 'var(--text3)',  label: status      }
  }
}

export function invoiceTermPct(issue: string | null, due: string | null): number | null {
  if (!issue || !due) return null
  const issueD = new Date(issue).getTime()
  const dueD   = new Date(due).getTime()
  const today  = Date.now()
  const total  = dueD - issueD
  if (total <= 0) return null
  const elapsed = today - issueD
  return (elapsed / total) * 100
}

export interface InvoiceAlertThresholds {
  overdue:  number   // default 100
  due_soon: number   // default 85
}

export type InvoiceAlert = 'overdue' | 'due_soon' | null

export function invoiceAlert(
  invoice: { issue_date: string | null; due_date: string | null; status: string },
  thresholds: InvoiceAlertThresholds
): InvoiceAlert {
  if (invoice.status === 'Paga' || invoice.status === 'Rejeitada') return null
  const pct = invoiceTermPct(invoice.issue_date, invoice.due_date)
  if (pct === null) return null
  if (pct >= thresholds.overdue)  return 'overdue'
  if (pct >= thresholds.due_soon) return 'due_soon'
  return null
}
