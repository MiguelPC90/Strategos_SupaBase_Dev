import type { Plano, Person } from '../types/index'

type OwnerFields = Pick<
  Plano,
  'owner_person_ids' | 'owner_primary_id' | 'owner_label_override' | 'owner'
>

type SponsorFields = Pick<
  Plano,
  'sponsor_person_ids' | 'sponsor_primary_id' | 'sponsor_label_override' | 'sponsor'
>

/** Resolves display names for the plano owner(s).
 *  Priority: person_ids array → label_override → legacy owner string. */
export function resolveOwnerNames(
  plano: OwnerFields,
  peopleMap: Map<string, Person>,
): string[] {
  if (plano.owner_person_ids.length > 0) {
    return plano.owner_person_ids
      .map(id => peopleMap.get(id)?.name)
      .filter((n): n is string => n !== undefined)
  }
  if (plano.owner_label_override) return [plano.owner_label_override]
  if (plano.owner) {
    return plano.owner.split(/\s*[|,]\s*/).map(s => s.trim()).filter(Boolean)
  }
  return []
}

/** Resolves display names for the plano sponsor(s).
 *  Priority: person_ids array → label_override → legacy sponsor string. */
export function resolveSponsorNames(
  plano: SponsorFields,
  peopleMap: Map<string, Person>,
): string[] {
  if (plano.sponsor_person_ids.length > 0) {
    return plano.sponsor_person_ids
      .map(id => peopleMap.get(id)?.name)
      .filter((n): n is string => n !== undefined)
  }
  if (plano.sponsor_label_override) return [plano.sponsor_label_override]
  if (plano.sponsor) {
    return plano.sponsor.split(/\s*[|,]\s*/).map(s => s.trim()).filter(Boolean)
  }
  return []
}

/** Returns the email of the primary owner person, or null if none found. */
export function resolveOwnerPrimaryEmail(
  plano: OwnerFields,
  peopleMap: Map<string, Person>,
): string | null {
  const primaryId = plano.owner_primary_id ?? plano.owner_person_ids[0] ?? null
  if (primaryId) return peopleMap.get(primaryId)?.email ?? null
  return null
}

/** Joins a list of names with a separator (default ' · '). */
export function formatPeopleList(names: string[], separator = ' · '): string {
  return names.join(separator)
}
