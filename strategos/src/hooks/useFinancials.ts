import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { FinBudgetLine, FinContract, FinInvoice } from '../types/index'

interface UseFinancialsResult {
  budgetLines: FinBudgetLine[]
  contracts: FinContract[]
  invoices: FinInvoice[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useFinancials(program_id?: string): UseFinancialsResult {
  const [budgetLines, setBudgetLines] = useState<FinBudgetLine[]>([])
  const [contracts, setContracts]     = useState<FinContract[]>([])
  const [invoices, setInvoices]       = useState<FinInvoice[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [tick, setTick]               = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const budgetQ = (() => {
      let q = supabase
        .from('fin_budget_lines')
        .select('*, cost_categories(id, name, is_capex)')
        .order('sort_order', { ascending: true })
      if (program_id) q = q.eq('program_id', program_id)
      return q
    })()

    const contractQ = (() => {
      let q = supabase
        .from('fin_contracts')
        .select('*')
        .order('sort_order', { ascending: true })
      if (program_id) q = q.eq('program_id', program_id)
      return q
    })()

    const invoiceQ = (() => {
      let q = supabase
        .from('fin_invoices')
        .select('*')
        .order('sort_order', { ascending: true })
      if (program_id) q = q.eq('program_id', program_id)
      return q
    })()

    Promise.all([budgetQ, contractQ, invoiceQ]).then(([bl, ct, inv]) => {
      if (cancelled) return
      const err = bl.error ?? ct.error ?? inv.error
      if (err) {
        setError(err.message)
      } else {
        setBudgetLines((bl.data ?? []) as FinBudgetLine[])
        setContracts((ct.data ?? []) as FinContract[])
        setInvoices((inv.data ?? []) as FinInvoice[])
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [program_id, tick])

  return { budgetLines, contracts, invoices, loading, error, refetch }
}
