import { type ReactNode } from 'react'

type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

export default function Badge({ children, variant = 'grey' }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`}>{children}</span>
  )
}
