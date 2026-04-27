// Re-export from shared context so all callers share the same favorites state
export type { Favorite } from '../context/FavoritesContext'
export { useFavorites, MAX_FAVORITES } from '../context/FavoritesContext'
