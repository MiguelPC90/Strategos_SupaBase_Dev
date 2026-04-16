import './Card.css'
import { type ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  children: ReactNode
  className?: string
  actions?: ReactNode
}

export default function Card({ title, children, className = '', actions }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header">
          <span className="card-title-accent" />
          <h3 className="card-title">{title}</h3>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}
