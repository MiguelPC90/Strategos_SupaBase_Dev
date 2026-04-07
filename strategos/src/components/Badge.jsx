// variant: 'green' | 'blue' | 'red' | 'amber' | 'grey' | 'navy'
export default function Badge({ children, variant = 'grey' }) {
  return (
    <span className={`badge badge-${variant}`}>{children}</span>
  )
}
