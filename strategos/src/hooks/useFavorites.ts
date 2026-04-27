import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Favorite {
  user_id: string
  plano_id: string
  sort_order: number
  created_at: string
}

export const MAX_FAVORITES = 5

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('user_favorites')
      .select('*')
      .order('sort_order', { ascending: true })
    setFavorites((data ?? []) as Favorite[])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

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

  return { favorites, loading, isFavorite, add, remove, toggle, reload, canAddMore, MAX_FAVORITES }
}
