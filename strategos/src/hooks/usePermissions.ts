import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useRole } from './useRole'
import type { UserPermission, PageKey } from '../types/index'

// Pages accessible to viewers (read-only, no edit)
const VIEWER_PAGES: PageKey[] = [
  'dashboard',
  'actividades',
  'gantt',
  'evolucao',
  'ponto-situacao',
  'exec-financeira',
  'recursos',
]

interface UsePermissionsResult {
  permissions: UserPermission[]
  /** Returns true if the user can view the given page (optionally scoped to a program) */
  hasAccess: (page: PageKey, programId?: string) => boolean
  /** Returns true if the user can edit data on the given page (optionally scoped to a program) */
  canEdit: (page: PageKey, programId?: string) => boolean
  loading: boolean
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth()
  const { role, isAdmin, isGestor, loading: roleLoading } = useRole()

  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!user || roleLoading) return
    // Admins and gestors don't need per-row permission records
    if (isAdmin || isGestor) {
      setPermissions([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setPermissions((data ?? []) as UserPermission[])
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [user, roleLoading, isAdmin, isGestor])

  const findPermission = useCallback(
    (page: PageKey, programId?: string): UserPermission | undefined => {
      // Most-specific match first: same page + same program
      if (programId) {
        const exact = permissions.find(
          p => p.page === page && p.program_id === programId
        )
        if (exact) return exact
      }
      // Page-level permission (program_id null = applies to all programs)
      return permissions.find(p => p.page === page && p.program_id === null)
    },
    [permissions]
  )

  const hasAccess = useCallback(
    (page: PageKey, programId?: string): boolean => {
      if (isAdmin) return true

      if (isGestor) return true

      // viewer fallback — no specific row required
      const perm = findPermission(page, programId)
      if (perm) return perm.access_level !== 'none'

      // Default viewer access: view-only pages only
      if (role === 'viewer') return VIEWER_PAGES.includes(page)

      return false
    },
    [isAdmin, isGestor, role, findPermission]
  )

  const canEdit = useCallback(
    (page: PageKey, programId?: string): boolean => {
      if (isAdmin) return true
      if (isGestor) return true

      const perm = findPermission(page, programId)
      if (perm) return perm.access_level === 'edit'

      return false
    },
    [isAdmin, isGestor, findPermission]
  )

  return {
    permissions,
    hasAccess,
    canEdit,
    loading: loading || roleLoading,
  }
}
