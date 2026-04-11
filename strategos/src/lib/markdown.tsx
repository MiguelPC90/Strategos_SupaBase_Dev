import type { ReactNode } from 'react'

/**
 * Render minimal markdown — **bold** and *italic* — to React nodes.
 * Use this in read-only display views (PontoSituacao, etc.).
 */
export function renderMd(text: string): ReactNode {
  if (!text) return null
  // Split on **bold** first, then *italic*; alternation order matters
  const parts = text.split(/(\*\*[^*]+\*\*|\*(?!\*)[^*]+\*)/)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return part
  })
}
