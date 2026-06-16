import { useMemo } from 'react'
import { useAppConfig } from './useAppConfig'

export interface ProgramLabels {
  n0:      string
  n1:      string
  n2:      string
  owner:   string
  sponsor: string
}

export const DEFAULT_LABELS: ProgramLabels = {
  n0:      'Programa',
  n1:      'Eixo',
  n2:      'Plano de Acção',
  owner:   'Responsável',
  sponsor: 'Patrocinador',
}

export function useProgramLabels(programId: string | null | undefined): ProgramLabels {
  const { config } = useAppConfig()
  return useMemo(() => {
    if (!programId) return DEFAULT_LABELS
    const raw = config[`filter_labels_${programId}`]
    if (!raw) return DEFAULT_LABELS
    try {
      const parsed = JSON.parse(raw) as Partial<ProgramLabels>
      return {
        n0:      parsed.n0      || DEFAULT_LABELS.n0,
        n1:      parsed.n1      || DEFAULT_LABELS.n1,
        n2:      parsed.n2      || DEFAULT_LABELS.n2,
        owner:   parsed.owner   || DEFAULT_LABELS.owner,
        sponsor: parsed.sponsor || DEFAULT_LABELS.sponsor,
      }
    } catch { return DEFAULT_LABELS }
  }, [config, programId])
}
