import './EmptyState.css'
import { type ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: 'data' | 'list' | 'target' | 'inbox' | 'chart' | 'calendar' | 'folder'
  title: string
  description?: string
  actionLabel?: ReactNode
  onAction?: () => void
  actionHref?: string
  size?: 'sm' | 'md' | 'lg'
}

const icons: Record<NonNullable<EmptyStateProps['icon']>, (size: number) => React.ReactElement> = {
  data: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/>
      <path d="M7 12v5"/>
      <path d="M11 8v9"/>
      <path d="M15 4v13"/>
      <path d="M19 10v7"/>
    </svg>
  ),
  list: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="4" cy="6" r="1"/>
      <circle cx="4" cy="12" r="1"/>
      <circle cx="4" cy="18" r="1"/>
    </svg>
  ),
  target: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  inbox: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  chart: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/>
      <path d="M7 14l4-4 3 3 5-7"/>
    </svg>
  ),
  calendar: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  folder: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
}

export default function EmptyState({
  icon = 'data',
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  size = 'md',
}: EmptyStateProps) {
  const iconSize = size === 'sm' ? 32 : size === 'lg' ? 64 : 48

  return (
    <div className={`empty-state empty-state-${size}`}>
      <div className="empty-state-icon">
        {icons[icon](iconSize)}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {actionLabel && (onAction || actionHref) && (
        actionHref ? (
          <a href={actionHref} className="empty-state-action">
            {actionLabel}
          </a>
        ) : (
          <button className="empty-state-action" onClick={onAction}>
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}
