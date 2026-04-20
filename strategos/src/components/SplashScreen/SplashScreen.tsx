import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  logoUrl?: string | null
  visible: boolean
}

export default function SplashScreen({ logoUrl, visible }: SplashScreenProps) {
  const [mounted, setMounted] = useState(visible)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    if (!visible && mounted) {
      setFadingOut(true)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    } else if (visible && !mounted) {
      setMounted(true)
      setFadingOut(false)
    }
  }, [visible, mounted])

  if (!mounted) return null

  return (
    <div className={`splash-screen${fadingOut ? ' fading-out' : ''}`}>
      <div className="splash-logo-container">
        {logoUrl ? (
          <img src={logoUrl} alt="Strategos" className="splash-logo" />
        ) : (
          <div className="splash-logo-fallback">
            <span className="splash-logo-text">Strategos</span>
          </div>
        )}
      </div>
    </div>
  )
}
