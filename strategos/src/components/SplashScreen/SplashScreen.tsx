import { useEffect, useState } from 'react'
import StratgosWordmark from '../Brand/StratgosWordmark'
import './SplashScreen.css'

interface SplashScreenProps {
  fadeOut?: boolean
}

export default function SplashScreen({ fadeOut = false }: SplashScreenProps) {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (fadeOut) {
      const t = setTimeout(() => setGone(true), 300)
      return () => clearTimeout(t)
    }
  }, [fadeOut])

  if (gone) return null

  return (
    <div className={`splash-screen${fadeOut ? ' splash-fade-out' : ''}`}>
      <StratgosWordmark size={80} onDark={false} />
    </div>
  )
}
