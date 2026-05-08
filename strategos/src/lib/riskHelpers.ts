type BadgeVariant = 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'

export function estadoBadge(status: string): BadgeVariant {
  const s = status.toLowerCase()
  if (s === 'aberto')       return 'red'
  if (s === 'em mitigação') return 'amber'
  if (s === 'mitigado')     return 'grey'
  if (s === 'fechado')      return 'green'
  return 'grey'
}
