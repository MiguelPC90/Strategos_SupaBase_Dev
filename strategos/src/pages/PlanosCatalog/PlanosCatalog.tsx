import './PlanosCatalog.css'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import EmptyState from '../../components/EmptyState/EmptyState'
import Spinner from '../../components/Spinner/Spinner'

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function PlanosCatalog() {
  const { planos, loading } = usePlanos()
  const { programs } = usePrograms()

  const programMap = useMemo(
    () => new Map(programs.map(p => [p.id, p])),
    [programs],
  )

  // Group planos by program
  const grouped = useMemo(() => {
    const map = new Map<string, { programName: string; items: typeof planos }>()
    for (const plano of planos) {
      const progId = plano.program_id ?? '__none__'
      const prog = plano.program_id ? programMap.get(plano.program_id) : null
      const progName = prog?.name ?? 'Sem programa'
      const grp = map.get(progId) ?? { programName: progName, items: [] }
      grp.items.push(plano)
      map.set(progId, grp)
    }
    return Array.from(map.values())
  }, [planos, programMap])

  if (loading) return <Spinner />

  return (
    <div className="pc-wrap">
      <div className="pc-header">
        <h1 className="pc-title">Planos</h1>
        <span className="pc-count">{planos.length} plano{planos.length !== 1 ? 's' : ''}</span>
      </div>

      {planos.length === 0 ? (
        <EmptyState
          icon="folder"
          title="Sem planos acessíveis"
          description="Não tens acesso a nenhum plano. Contacta o administrador."
        />
      ) : (
        <div className="pc-groups">
          {grouped.map(g => (
            <div key={g.programName} className="pc-group">
              <div className="pc-group-label">{g.programName}</div>
              <div className="pc-list">
                {g.items.map(plano => (
                  <Link
                    key={plano.id}
                    to={`/planos/${plano.id}`}
                    className="pc-row"
                  >
                    <div className="pc-row-main">
                      <span className="pc-row-name">{plano.name}</span>
                      <span className="pc-row-code">{plano.code}</span>
                    </div>
                    <div className="pc-row-meta">
                      {plano.eixo?.name && (
                        <span className="pc-meta-item">{plano.eixo.name}</span>
                      )}
                      {plano.owner && (
                        <span className="pc-meta-item">Owner: {plano.owner}</span>
                      )}
                      {(plano.start_date || plano.end_date) && (
                        <span className="pc-meta-item pc-meta-dates">
                          {fmtDate(plano.start_date)}{plano.start_date && plano.end_date ? ' → ' : ''}{fmtDate(plano.end_date)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
