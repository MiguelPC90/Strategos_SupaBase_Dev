import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface DefaultCurrency { code: string; symbol: string }

export function useDefaultCurrency(): DefaultCurrency {
  const [currency, setCurrency] = useState<DefaultCurrency>({ code: 'EUR', symbol: '€' })

  useEffect(() => {
    let active = true
    supabase
      .from('currencies')
      .select('code, symbol')
      .eq('is_default', true)
      .maybeSingle()
      .then(({ data }) => { if (active && data) setCurrency(data) })
    return () => { active = false }
  }, [])

  return currency
}
