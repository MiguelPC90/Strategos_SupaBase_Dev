import './StratgosGMark.css'

interface StratgosGMarkProps {
  size?: number  // tile size in px, default 28
}

export default function StratgosGMark({ size = 28 }: StratgosGMarkProps) {
  return (
    <img
      src="/stratgos-mark-ember.png"
      alt="Stratgos"
      className="stratgos-g-mark"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  )
}
