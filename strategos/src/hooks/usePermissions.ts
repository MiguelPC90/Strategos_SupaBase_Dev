import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { useRole } from './useRole'
import type { UserPermission, PageKey } from '../types/index'

interface UsePermissionsResult {
  permissions: UserPermission[]
  /** Can the current user view/access this page (sidebar visibility + direct URL)? */
  hasAccess: (page: PageKey, programId?: string) => boolean
  /** Can the current user mutate data on this page? */
  canEdit: (page: PageKey, programId?: string) => boolean
  /** True while the role profile is still loading */
  loading: boolean
}

function isAllowed(level: string): boolean {
  return level === 'view' || level === 'edit'
}

export function usePermissions(): UsePermissionsResult {
  // Permissions are fetched centrally in AuthContext
  const { permissions } = useAuth()
  const { role, isAdmin, loading: roleLoading } = useRole()

  const hasAccess = useCallback(
    (page: PageKey, programId?: string): boolean => {
      // Admin bypasses all checks
      if (isAdmin) return true
      // No permission rows at all → no restrictions configured
      if (permissions.length === 0) return true

      const pagePerms = permissions.filter(p => p.page === page)
      // Permissions exist globally but none granted for this page → blocked
      if (pagePerms.length === 0) return false

      if (programId) {
        // Most specific: page + program match
        const specific = pagePerms.find(p => p.program_id === programId)
        if (specific) return isAllowed(specific.access_level)
        // Fallback: page-level row (program_id = null covers all programs)
        const pageLevel = pagePerms.find(p => p.program_id === null)
        if (pageLevel) return isAllowed(pageLevel.access_level)
      }

      // Sidebar / no-programId check: allow if any row grants access
      return pagePerms.some(p => isAllowed(p.access_level))
    },
    [isAdmin, permissions],
  )

  const canEdit = useCallback(
    (page: PageKey, programId?: string): boolean => {
      if (isAdmin) return true
      if (role === 'viewer') return false
      // editor:
      if (permissions.length === 0) return true
      const pagePerms = permissions.filter(p => p.page === page)
      if (pagePerms.length === 0) return true
      if (programId) {
        const specific = pagePerms.find(p => p.program_id === programId)
        if (specific) return specific.access_level === 'edit'
        const pageLevel = pagePerms.find(p => p.program_id === null)
        if (pageLevel) return pageLevel.access_level === 'edit'
      }
      return pagePerms.some(p => p.access_level === 'edit')
    },
    [isAdmin, role, permissions],
  )

  return { permissions, hasAccess, canEdit, loading: roleLoading }
}
