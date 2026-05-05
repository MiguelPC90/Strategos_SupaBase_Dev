import './BudgetPage.css'
import { useFilters } from '../../context/FilterContext'
import { useAccessiblePrograms } from '../../hooks/useAccessiblePrograms'
import { usePlanos } from '../../hooks/usePlanos'

export default function BudgetPage() {
  const { filters } = useFilters()
  const programs    = useAccessiblePrograms('gestao-financeira')
  const programId   = filters.programIds[0] ?? programs[0]?.id
  const n1Name      = filters.n1Values[0]   ?? null
  const n2Name      = filters.n2Values[0]   ?? null
  const { planos }  = usePlanos(programId)

  const scopeLabel = n2Name
    ? `plano "${n2Name}"`
    : n1Name
    ? `eixo "${n1Name}"`
    : programId
    ? programs.find(p => p.id === programId)?.name ?? 'programa seleccionado'
    : 'todos os programas acessíveis'

  return (
    <div className="bp-page">
      <div className="bp-placeholder">
        {n2Name
          ? 'Vista de plano específico — agregação a 1 plano implementada na próxima sessão'
          : 'Vista agregada em desenvolvimento'
        }
        <div className="bp-placeholder-scope">
          Âmbito actual: {scopeLabel}
          {planos.length > 0 && ` · ${planos.length} plano${planos.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  )
}
