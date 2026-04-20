import type { Activity, ActivityDependency, DependencyType, DependencyValidationError } from '../types/index'

// ── Cycle detection ───────────────────────────────────────────

/**
 * Returns true if adding predecessor→successor would create a cycle.
 * Uses iterative DFS from successor through existing edges.
 */
export function wouldCreateCycle(
  predecessorId: string,
  successorId: string,
  existingDeps: ActivityDependency[]
): boolean {
  if (predecessorId === successorId) return true

  // adjacency: predecessor_id → successor_ids
  const adj = new Map<string, string[]>()
  for (const dep of existingDeps) {
    if (!adj.has(dep.predecessor_id)) adj.set(dep.predecessor_id, [])
    adj.get(dep.predecessor_id)!.push(dep.successor_id)
  }

  // Would create cycle if successorId can already reach predecessorId
  const visited = new Set<string>()
  const stack = [successorId]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === predecessorId) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const n of adj.get(current) ?? []) stack.push(n)
  }

  return false
}

// ── Date validation ───────────────────────────────────────────

function fmt(d: Date): string {
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Validates that the successor's dates respect the constraint imposed
 * by the predecessor + dep type + lag. Returns null if valid.
 */
export function validateDependencyDates(
  predecessor: Activity,
  successor: Activity,
  depType: DependencyType,
  lagDays: number
): DependencyValidationError | null {
  const preStart = predecessor.bs ? new Date(predecessor.bs) : null
  const preEnd   = predecessor.bf ? new Date(predecessor.bf) : null
  const sucStart = successor.bs   ? new Date(successor.bs)   : null
  const sucEnd   = successor.bf   ? new Date(successor.bf)   : null

  if (!preStart || !preEnd || !sucStart || !sucEnd) return null

  const lagMs = lagDays * 24 * 60 * 60 * 1000

  let minTime: number
  let actualTime: number
  let message: string

  if (depType === 'FS') {
    minTime    = preEnd.getTime() + lagMs
    actualTime = sucStart.getTime()
    message    = `FS: Início do sucessor (${fmt(sucStart)}) é anterior a ${fmt(new Date(minTime))} (fim do predecessor + ${lagDays}d)`
  } else if (depType === 'SS') {
    minTime    = preStart.getTime() + lagMs
    actualTime = sucStart.getTime()
    message    = `SS: Início do sucessor (${fmt(sucStart)}) é anterior a ${fmt(new Date(minTime))} (início do predecessor + ${lagDays}d)`
  } else if (depType === 'FF') {
    minTime    = preEnd.getTime() + lagMs
    actualTime = sucEnd.getTime()
    message    = `FF: Fim do sucessor (${fmt(sucEnd)}) é anterior a ${fmt(new Date(minTime))} (fim do predecessor + ${lagDays}d)`
  } else {
    // SF
    minTime    = preStart.getTime() + lagMs
    actualTime = sucEnd.getTime()
    message    = `SF: Fim do sucessor (${fmt(sucEnd)}) é anterior a ${fmt(new Date(minTime))} (início do predecessor + ${lagDays}d)`
  }

  if (actualTime < minTime) {
    return {
      code: 'DATE_VIOLATION',
      message,
      predecessor_id: predecessor.id,
      successor_id:   successor.id,
    }
  }

  return null
}

// ── Date propagation ──────────────────────────────────────────

/**
 * When a predecessor's dates change, compute new dates for all
 * transitive successors. Returns a map of activity_id → { bs, bf }.
 * Only includes activities whose current dates violate the constraint.
 */
export function propagateDateChanges(
  changedActivity: Activity,
  allActivities: Activity[],
  allDeps: ActivityDependency[]
): Map<string, { bs: string; bf: string }> {
  const updates     = new Map<string, { bs: string; bf: string }>()
  const activityById = new Map(allActivities.map(a => [a.id, a]))
  activityById.set(changedActivity.id, changedActivity)

  const queue   = [changedActivity.id]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const predecessor = activityById.get(currentId)
    if (!predecessor?.bs || !predecessor.bf) continue

    for (const dep of allDeps.filter(d => d.predecessor_id === currentId)) {
      const successor = activityById.get(dep.successor_id)
      if (!successor?.bs || !successor.bf) continue

      const newDates = computeSuccessorDates(predecessor, successor, dep)
      if (newDates) {
        activityById.set(successor.id, { ...successor, bs: newDates.bs, bf: newDates.bf })
        updates.set(successor.id, newDates)
        queue.push(successor.id)
      }
    }
  }

  return updates
}

function computeSuccessorDates(
  predecessor: Activity,
  successor: Activity,
  dep: ActivityDependency
): { bs: string; bf: string } | null {
  if (!predecessor.bs || !predecessor.bf || !successor.bs || !successor.bf) return null

  const preStart = new Date(predecessor.bs)
  const preEnd   = new Date(predecessor.bf)
  const sucStart = new Date(successor.bs)
  const sucEnd   = new Date(successor.bf)

  const duration = sucEnd.getTime() - sucStart.getTime()
  const lagMs    = dep.lag_days * 24 * 60 * 60 * 1000

  // Determine the anchor point and whether it constrains start or end
  let anchorTime: number
  let anchorIsSucStart: boolean

  if (dep.dep_type === 'FS') {
    anchorTime       = preEnd.getTime() + lagMs
    anchorIsSucStart = true
  } else if (dep.dep_type === 'SS') {
    anchorTime       = preStart.getTime() + lagMs
    anchorIsSucStart = true
  } else if (dep.dep_type === 'FF') {
    anchorTime       = preEnd.getTime() + lagMs
    anchorIsSucStart = false
  } else {
    // SF
    anchorTime       = preStart.getTime() + lagMs
    anchorIsSucStart = false
  }

  const currentAnchor = anchorIsSucStart ? sucStart.getTime() : sucEnd.getTime()
  if (currentAnchor >= anchorTime) return null

  const newStart = anchorIsSucStart
    ? new Date(anchorTime)
    : new Date(anchorTime - duration)
  const newEnd = anchorIsSucStart
    ? new Date(anchorTime + duration)
    : new Date(anchorTime)

  return {
    bs: newStart.toISOString().slice(0, 10),
    bf: newEnd.toISOString().slice(0, 10),
  }
}

// ── Leaf check ────────────────────────────────────────────────

/** Only leaf activities (level 4+) may have dependencies. */
export function canHaveDependencies(activity: Activity): boolean {
  return activity.level >= 4
}

// ── Full pre-insert validation ────────────────────────────────

/**
 * Runs all checks before inserting a new dependency.
 * Returns null if valid, or the first validation error found.
 */
export function validateNewDependency(
  predecessor: Activity,
  successor: Activity,
  depType: DependencyType,
  lagDays: number,
  existingDeps: ActivityDependency[]
): DependencyValidationError | null {
  if (predecessor.id === successor.id) {
    return {
      code: 'SELF_DEPENDENCY',
      message: 'Uma actividade não pode depender de si própria.',
      predecessor_id: predecessor.id,
      successor_id:   successor.id,
    }
  }

  if (!canHaveDependencies(predecessor) || !canHaveDependencies(successor)) {
    return {
      code: 'NON_LEAF',
      message: 'Dependências só são permitidas entre actividades folha (N4+).',
      predecessor_id: predecessor.id,
      successor_id:   successor.id,
    }
  }

  if (existingDeps.some(d => d.predecessor_id === predecessor.id && d.successor_id === successor.id)) {
    return {
      code: 'DUPLICATE',
      message: 'Esta dependência já existe.',
      predecessor_id: predecessor.id,
      successor_id:   successor.id,
    }
  }

  if (wouldCreateCycle(predecessor.id, successor.id, existingDeps)) {
    return {
      code: 'CYCLE',
      message: 'Esta dependência criaria um ciclo entre actividades.',
      predecessor_id: predecessor.id,
      successor_id:   successor.id,
    }
  }

  return validateDependencyDates(predecessor, successor, depType, lagDays)
}
