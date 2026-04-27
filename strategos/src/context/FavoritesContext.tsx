import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface Favorite {
  user_id: string
  plano_id: string
  sort_order: number
  created_at: string
}

export const MAX_FAVORITES = 5

interface FavoritesCtx {
  favorites: Favorite[]
  loading: boolean
  isFavorite: (id: string) => boolean
  add: (id: string) => Promise<{ ok: boolean; error?: string }>
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>
  toggle: (id: string) => Promise<{ ok: boolean; error?: string }>
  reload: () => Promise<void>
  canAddMore: boolean
  MAX_FAVORITES: number
}

const FavCtx = createContext<FavoritesCtx | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading]     = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('user_favorites')
      .select('*')
      .order('sort_order', { ascending: true })
    setFavorites((data ?? []) as Favorite[])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN')  reload()
      if (event === 'SIGNED_OUT') { setFavorites([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [reload])

  const isFavorite = useCallback(
    (planoId: string) => favorites.some(f => f.plano_id === planoId),
    [favorites],
  )

  const canAddMore = favorites.length < MAX_FAVORITES

  const add = useCallback(async (planoId: string): Promise<{ ok: boolean; error?: string }> => {
    if (favorites.length >= MAX_FAVORITES) {
      return { ok: false, error: `Máximo de ${MAX_FAVORITES} favoritos atingido` }
    }
    const { error } = await supabase
      .from('user_favorites')
      .insert({ plano_id: planoId, sort_order: favorites.length })
    if (error) return { ok: false, error: error.message }
    await reload()
    return { ok: true }
  }, [favorites, reload])

  const remove = useCallback(async (planoId: string): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('plano_id', planoId)
    if (error) return { ok: false, error: error.message }
    await reload()
    return { ok: true }
  }, [reload])

  const toggle = useCallback(async (planoId: string): Promise<{ ok: boolean; error?: string }> => {
    if (isFavorite(planoId)) return remove(planoId)
    return add(planoId)
  }, [isFavorite, add, remove])

  return (
    <FavCtx.Provider value={{ favorites, loading, isFavorite, add, remove, toggle, reload, canAddMore, MAX_FAVORITES }}>
      {children}
    </FavCtx.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavCtx)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
