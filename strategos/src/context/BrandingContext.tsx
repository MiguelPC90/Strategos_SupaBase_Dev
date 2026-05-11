import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type BrandingMode = 'stratgos' | 'cobrand'

interface BrandingValue {
  mode:           BrandingMode
  clientTitle:    string
  clientSubtitle: string
  clientLogoUrl:  string
  loading:        boolean
  refresh:        () => Promise<void>
}

const BrandingContext = createContext<BrandingValue | undefined>(undefined)

const KEYS = ['branding_mode', 'client_title', 'client_subtitle', 'client_logo_url']

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [mode,           setMode]           = useState<BrandingMode>('stratgos')
  const [clientTitle,    setClientTitle]    = useState('')
  const [clientSubtitle, setClientSubtitle] = useState('')
  const [clientLogoUrl,  setClientLogoUrl]  = useState('')
  const [loading,        setLoading]        = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('app_config')
      .select('config_key, data')
      .in('config_key', KEYS)

    const byKey = new Map((data ?? []).map(r => [r.config_key, r.data]))

    const rawMode = byKey.get('branding_mode') ?? 'stratgos'
    setMode(rawMode === 'cobrand' ? 'cobrand' : 'stratgos')
    setClientTitle(byKey.get('client_title')     ?? '')
    setClientSubtitle(byKey.get('client_subtitle') ?? '')
    setClientLogoUrl(byKey.get('client_logo_url')  ?? '')
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <BrandingContext.Provider value={{
      mode, clientTitle, clientSubtitle, clientLogoUrl, loading, refresh,
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
