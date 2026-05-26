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

/** Build the legacy `planos.owner` string from FK selection + label override.
 *  Used during the dual-write transition (commit 2). Will be unused after commit 3. */
export function buildLegacyOwnerString(
  ownerPersonIds: string[],
  ownerLabelOverride: string | null,
  peopleMap: Map<string, Person>,
): string {
  const names: string[] = []
  for (const id of ownerPersonIds) {
    const p = peopleMap.get(id)
    if (p) names.push(p.name)
  }
  if (ownerLabelOverride && ownerLabelOverride.trim() !== '') {
    names.push(ownerLabelOverride.trim())
  }
  return names.join(' | ')
}

/** Build the legacy `planos.sponsor` string from FK selection + label override.
 *  Used during the dual-write transition (commit 2). Will be unused after commit 3. */
export function buildLegacySponsorString(
  sponsorPersonIds: string[],
  sponsorLabelOverride: string | null,
  peopleMap: Map<string, Person>,
): string {
  const names: string[] = []
  for (const id of sponsorPersonIds) {
    const p = peopleMap.get(id)
    if (p) names.push(p.name)
  }
  if (sponsorLabelOverride && sponsorLabelOverride.trim() !== '') {
    names.push(sponsorLabelOverride.trim())
  }
  return names.join(' | ')
}
