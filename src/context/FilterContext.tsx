import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getFilterOptions } from '../lib/supabase-client'

interface FilterContextValue {
    n0: string
    n1: string
    n0Options: string[]
    n1Options: string[]
    loading: boolean
    error: Error | null
    setN0: (value: string) => void
    setN1: (value: string) => void
    resetFilters: () => void
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
    const [n0, setN0] = useState('')
    const [n1, setN1] = useState('')
    const [n0Options, setN0Options] = useState<string[]>([])
    const [n1OptionsByN0, setN1OptionsByN0] = useState<Record<string, string[]>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        let isMounted = true

        const loadOptions = async () => {
            try {
                setLoading(true)
                const { n0Options, n1OptionsByN0 } = await getFilterOptions()
                if (!isMounted) return

                setN0Options(n0Options)
                setN1OptionsByN0(n1OptionsByN0)
                setLoading(false)
            } catch (err) {
                if (!isMounted) return
                setError(err instanceof Error ? err : new Error(String(err)))
                setLoading(false)
            }
        }

        loadOptions()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        if (!n0) {
            setN1('')
            return
        }

        const available = n1OptionsByN0[n0] || []
        if (n1 && !available.includes(n1)) {
            setN1('')
        }
    }, [n0, n1, n1OptionsByN0])

    const n1Options = useMemo(() => n1OptionsByN0[n0] || [], [n0, n1OptionsByN0])

    const value = useMemo(
        () => ({
            n0,
            n1,
            n0Options,
            n1Options,
            loading,
            error,
            setN0,
            setN1,
            resetFilters: () => {
                setN0('')
                setN1('')
            },
        }),
        [n0, n1, n0Options, n1Options, loading, error]
    )

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters() {
    const context = useContext(FilterContext)
    if (!context) {
        throw new Error('useFilters must be used within FilterProvider')
    }
    return context
}
