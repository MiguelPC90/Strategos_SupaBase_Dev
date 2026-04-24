import { useMemo } from 'react'
import { usePrograms } from './usePrograms'
import { usePermissions } from './usePermissions'
import { useRole } from './useRole'
import type { PageKey, Program } from '../types/index'

const GESTAO_PAGES: ReadonlyArray<PageKey> = [
  'gestao-iniciativas',
  'gestao-pds',
  'gestao-riscos',
  'gestao-financeira',
  'gestao-recursos',
]

export function useAccessiblePrograms(page?: PageKey): Program[] {
  const { programs } = usePrograms()
  const { hasAccess } = usePermissions()
  const { isAdmin } = useRole()

  return useMemo(() => {
    if (isAdmin) return programs
    if (!page || !(GESTAO_PAGES as ReadonlyArray<string>).includes(page)) return programs
    return programs.filter(p => hasAccess(page, p.id))
  }, [programs, hasAccess, isAdmin, page])
}
