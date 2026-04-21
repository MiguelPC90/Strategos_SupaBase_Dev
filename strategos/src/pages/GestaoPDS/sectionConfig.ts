export type PdsSection = 'commitments' | 'progress' | 'next_steps' | 'attention'

export interface SectionCfg {
  hasStatus: boolean
  hasTargetDate: boolean
  hasCompletedAt: boolean
}

export const SECTION_CONFIG: Record<PdsSection, SectionCfg> = {
  commitments: { hasStatus: true,  hasTargetDate: true,  hasCompletedAt: true },
  progress:    { hasStatus: false, hasTargetDate: false, hasCompletedAt: false },
  next_steps:  { hasStatus: true,  hasTargetDate: true,  hasCompletedAt: true },
  attention:   { hasStatus: false, hasTargetDate: false, hasCompletedAt: false },
}
