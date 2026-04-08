import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Person } from '../types/index'

interface UsePeopleResult {
  people: Person[]
  loading: boolean
  error: string | null
}

export function usePeople(): UsePeopleResult {
  const [people, setPeople]   = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('people')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
        } else {
          setPeople((data ?? []) as Person[])
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { people, loading, error }
}
