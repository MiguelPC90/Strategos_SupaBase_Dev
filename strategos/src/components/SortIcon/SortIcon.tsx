import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

interface SortIconProps {
  active: boolean
  dir: 'asc' | 'desc'
}

export default function SortIcon({ active, dir }: SortIconProps) {
  if (!active) {
    return <ArrowUpDown size={12} strokeWidth={1.5} style={{ opacity: 0.3 }} />
  }
  return dir === 'asc'
    ? <ArrowUp size={12} strokeWidth={1.5} />
    : <ArrowDown size={12} strokeWidth={1.5} />
}
