import './StratgosWordmark.css'

interface StratgosWordmarkProps {
  size?: number    // height in px, default 18
  onDark?: boolean // true: cream-text variant for dark bg; false: dark-text variant for light bg
}

export default function StratgosWordmark({
  size = 18,
  onDark = true,
}: StratgosWordmarkProps) {
  const src = onDark
    ? '/stratgos-horizontal-reversed.png'
    : '/stratgos-primary.png'

  return (
    <img
      src={src}
      alt="Stratgos"
      className="stratgos-wordmark"
      style={{ height: `${size}px`, width: 'auto' }}
    />
  )
}
