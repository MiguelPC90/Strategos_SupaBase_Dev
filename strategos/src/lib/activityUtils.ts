import type { Activity } from '../types/index'

export function applyStatusCutoff(activity: Activity, cutoffDate: string): Activity {
  if (activity.rf || activity.status === 'concluida') return activity
  const deadline = activity.finish ?? activity.bf
  if (!deadline) return activity
  if (deadline < cutoffDate && activity.pct < 100) {
    return { ...activity, status: 'atrasada' }
  }
  return activity
}
