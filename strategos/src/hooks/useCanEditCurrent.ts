import { useFilters } from '../context/FilterContext'
import { usePermissions } from './usePermissions'
import type { PageKey } from '../types/index'

/**
 * Returns true when the current user can edit the given gestao page,
 * considering all currently-selected programs. If multiple programs
 * are selected, edit is only allowed if the user can edit ALL of them.
 */
export function useCanEditCurrent(page: PageKey): boolean {
  const { filters } = useFilters()
  const { canEdit } = usePermissions()
  const programIds = filters.programIds ?? []
  if (programIds.length === 0) return canEdit(page)
  if (programIds.length === 1) return canEdit(page, programIds[0])
  return programIds.every(pid => canEdit(page, pid))
}
