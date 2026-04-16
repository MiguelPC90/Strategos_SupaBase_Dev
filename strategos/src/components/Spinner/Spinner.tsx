import './Spinner.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export default function Spinner({ size = 'md' }: SpinnerProps) {
  return <span className={`spinner spinner--${size}`} />
}
