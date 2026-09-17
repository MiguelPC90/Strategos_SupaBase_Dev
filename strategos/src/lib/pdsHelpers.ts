import { createElement, type ReactNode } from 'react'
import type { PdsItem } from '../types/index'

export const TODAY = new Date().toISOString().slice(0, 10)

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

/** "2026-03-14" → "Mar 2026". Empty string when the date is missing. */
export function fmtDateMY(d: string | null | undefined): string {
  if (!d) return ''
  const parts = d.split('-')
  const m = parseInt(parts[1], 10)
  return `${PT_MONTHS[m - 1]} ${parts[0]}`
}

/** Maps a RowState to the shared status-pill / statusColor key. */
export function planoStatusKey(s: string): 'ontrack' | 'late' | 'done' | 'risk' {
  if (s === 'Concluída') return 'done'
  if (s === 'Em atraso') return 'late'
  if (s === 'Em risco')  return 'risk'
  return 'ontrack'
}

export type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'

export function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase()
  if (s === 'concluído' || s === 'concluída') return 'green'
  if (s === 'em curso') return 'blue'
  if (s === 'em atraso') return 'red'
  return 'grey'
}

export function displayStatus(item: PdsItem): string | null {
  if (!item.status) return null
  const s = item.status.toLowerCase()
  if (s !== 'concluído' && s !== 'concluída' && item.date && item.date < TODAY) {
    return 'Em atraso'
  }
  return item.status
}

export function renderText(text: string): ReactNode[] {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((p, i) =>
    i % 2 === 1 ? createElement('strong', { key: i }, p) : createElement('span', { key: i }, p)
  )
}
