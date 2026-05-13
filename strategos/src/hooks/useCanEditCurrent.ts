import { useFilters } from '../context/FilterContext'
import { usePermissions } from './usePermissions'
import { usePlanos } from './usePlanos'
import type { PageKey } from '../types/index'

/**
 * Returns true when the current user can edit the given gestao page,
 * considering all currently-selected programs. If multiple programs
 * are selected, edit is only allowed if the user can edit ALL of them.
 *
 * Pass planId explicitly when operating within a single plan (embedded mode).
 * When omitted, the hook resolves planId from the breadcrumb filter context.
 */
export function useCanEditCurrent(page: PageKey, planId?: string): boolean {
  const { filters } = useFilters()
  const { canEdit } = usePermissions()
  const { planos } = usePlanos(filters.programIds[0])

  const resolvedPlanId = planId ?? (
    filters.n2Values[0]
      ? planos.find(p => p.name === filters.n2Values[0])?.id
      : undefined
  )

  const programIds = filters.programIds ?? []
  if (programIds.length === 0) return canEdit(page, undefined, resolvedPlanId)
  if (programIds.length === 1) return canEdit(page, programIds[0], resolvedPlanId)
  return programIds.every(pid => canEdit(page, pid, resolvedPlanId))
}
