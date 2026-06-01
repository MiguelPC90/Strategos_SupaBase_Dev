import { createContext, useContext, type ReactNode } from 'react'
import { useAppConfig } from '../hooks/useAppConfig'

export type BrandingMode = 'stratgos' | 'cobrand'

interface BrandingValue {
  mode:           BrandingMode
  clientTitle:    string
  clientSubtitle: string
  clientLogoUrl:  string
  loading:        boolean
  refresh:        () => void
}

const BrandingContext = createContext<BrandingValue | undefined>(undefined)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { config, loading, invalidate } = useAppConfig()

  const rawMode = config['branding_mode'] ?? 'stratgos'
  const mode: BrandingMode = rawMode === 'cobrand' ? 'cobrand' : 'stratgos'

  return (
    <BrandingContext.Provider value={{
      mode,
      clientTitle:    config['client_title']     ?? '',
      clientSubtitle: config['client_subtitle']  ?? '',
      clientLogoUrl:  config['client_logo_url']  ?? '',
      loading,
      refresh: invalidate,
    }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingValue {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider')
  return ctx
}
