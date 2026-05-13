import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { useRole } from './useRole'
import type { AccessLevel, UserPermission, PageKey } from '../types/index'

interface UsePermissionsResult {
  permissions: UserPermission[]
  /** Can the current user view/access this page (sidebar visibility + direct URL)? */
  hasAccess: (page: PageKey, programId?: string, planId?: string) => boolean
  /** Alias for hasAccess */
  canView: (page: PageKey, programId?: string, planId?: string) => boolean
  /** Can the current user mutate data on this page? full=always, ops=non-financial only */
  canEdit: (page: PageKey, programId?: string, planId?: string) => boolean
  /** Can the current user see cost fields? True only for full or view access levels */
  canViewCosts: (page: PageKey, programId?: string, planId?: string) => boolean
  /** Resolve the effective access level for a page + program combination */
  resolveAccessLevel: (page: PageKey, programId?: string, planId?: string) => AccessLevel | null
  /** True while the role profile is still loading */
  loading: boolean
}

const FINANCIAL_PAGES: PageKey[] = ['gestao-financeira', 'exec-financeira']

function isAccessible(level: string): boolean {
  return level === 'full' || level === 'ops' || level === 'view' || level === 'view_ops'
}

function resolveLevel(
  permissions: UserPermission[],
  page: string,
  programId?: string,
  planId?: string,
): string | null {
  const pagePerms = permissions.filter(p => p.page === page)
  if (pagePerms.length === 0) return null

  if (programId) {
    const programPerms = pagePerms.filter(p => p.program_id === programId)
    if (planId) {
      // Plan-specific row wins over program-wide row (restrict-only override)
      const planSpecific = programPerms.find(p => p.plan_id === planId)
      if (planSpecific) return planSpecific.access_level
    }
    const programWide = programPerms.find(p => p.plan_id === null)
    if (programWide) return programWide.access_level
    const fallback = pagePerms.find(p => p.program_id === null)
    if (fallback) return fallback.access_level
    return null
  }

  // No programId: return the best level across all rows for this page
  const ORDER = ['full', 'ops', 'view', 'view_ops', 'denied']
  const levels = pagePerms.map(p => p.access_level)
  const sorted = [...levels].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  return sorted[0] ?? null
}

export function usePermissions(): UsePermissionsResult {
  const { permissions } = useAuth()
  const { isAdmin, canPotentiallyEdit, loading: roleLoading } = useRole()

  const resolveAccessLevel = useCallback(
    (page: PageKey, programId?: string, planId?: string): AccessLevel | null => {
      if (isAdmin) return 'full'
      if (permissions.length === 0) return null
      return resolveLevel(permissions, page, programId, planId) as AccessLevel | null
    },
    [isAdmin, permissions],
  )

  const hasAccess = useCallback(
    (page: PageKey, programId?: string, planId?: string): boolean => {
      if (isAdmin) return true
      if (permissions.length === 0) return false
      const level = resolveLevel(permissions, page, programId, planId)
      if (!level) return false
      return isAccessible(level)
    },
    [isAdmin, permissions],
  )

  const canEdit = useCallback(
    (page: PageKey, programId?: string, planId?: string): boolean => {
      if (isAdmin) return true
      if (!canPotentiallyEdit) return false
      if (permissions.length === 0) return false
      const level = resolveLevel(permissions, page, programId, planId)
      if (!level) return false
      if (level === 'full') return true
      if (level === 'ops') return !FINANCIAL_PAGES.includes(page)
      return false
    },
    [isAdmin, canPotentiallyEdit, permissions],
  )

  const canViewCosts = useCallback(
    (page: PageKey, programId?: string, planId?: string): boolean => {
      if (isAdmin) return true
      if (permissions.length === 0) return false
      const level = resolveLevel(permissions, page, programId, planId)
      if (!level) return false
      return level === 'full' || level === 'view'
    },
    [isAdmin, permissions],
  )

  return {
    permissions,
    hasAccess,
    canView: hasAccess,
    canEdit,
    canViewCosts,
    resolveAccessLevel,
    loading: roleLoading,
  }

}
