import { useMemo } from 'react'
import { usePeople } from './usePeople'
import { resolveOwnerNames, resolveSponsorNames } from '../lib/owners'
import type { Plano } from '../types/index'

export interface PlanoPeopleNames {
  ownerNames:   string[]
  sponsorNames: string[]
}

/**
 * Display names for one plano's owner(s) and sponsor(s).
 *
 * The resolution itself was already shared (lib/owners.ts); what was duplicated per
 * page was the usePeople + peopleMap + two-memo boilerplate. PlanHeader needs these
 * names on BOTH PlanoPage and PontoSituacao, so that boilerplate lives here once.
 */
export function usePlanoPeopleNames(plano: Plano | null | undefined): PlanoPeopleNames {
  const { people } = usePeople()
  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people])

  const ownerNames = useMemo(
    () => plano ? resolveOwnerNames(plano, peopleMap) : [],
    [plano, peopleMap],
  )
  const sponsorNames = useMemo(
    () => plano ? resolveSponsorNames(plano, peopleMap) : [],
    [plano, peopleMap],
  )

  return { ownerNames, sponsorNames }
}
