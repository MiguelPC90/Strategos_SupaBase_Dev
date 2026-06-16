import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  const qc = useQueryClient()
  const key = useMemo(() => ['financials', program_id ?? null], [program_id])

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      let blQ = supabase
        .from('fin_budget_lines')
        .select('*, cost_categories(id, name, is_capex)')
        .order('sort_order', { ascending: true })
      let ctQ = supabase
        .from('fin_contracts')
        .select('*')
        .order('sort_order', { ascending: true })
      let ivQ = supabase
        .from('fin_invoices')
        .select('*')
        .order('sort_order', { ascending: true })
      if (program_id) {
        blQ = blQ.eq('program_id', program_id)
        ctQ = ctQ.eq('program_id', program_id)
        ivQ = ivQ.eq('program_id', program_id)
      }
      const [blR, ctR, ivR] = await Promise.all([blQ, ctQ, ivQ])
      if (blR.error) throw blR.error
      if (ctR.error) throw ctR.error
      if (ivR.error) throw ivR.error
      return {
        budgetLines: (blR.data ?? []) as FinBudgetLine[],
        contracts:   (ctR.data ?? []) as FinContract[],
        invoices:    (ivR.data ?? []) as FinInvoice[],
      }
    },
  })

  return {
    budgetLines: query.data?.budgetLines ?? [],
    contracts:   query.data?.contracts   ?? [],
    invoices:    query.data?.invoices    ?? [],
    loading:     query.isLoading,
    error:       query.error ? String(query.error) : null,
    refetch:     () => { void qc.invalidateQueries({ queryKey: key }) },
  }
}
