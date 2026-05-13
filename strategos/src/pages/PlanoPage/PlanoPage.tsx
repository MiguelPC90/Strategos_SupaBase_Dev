import './PlanoPage.css'
import { useMemo, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Star, ChevronLeft } from 'lucide-react'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFavorites } from '../../hooks/useFavorites'
import { usePermissions } from '../../hooks/usePermissions'
import { useActivities } from '../../hooks/useActivities'
import EmptyState from '../../components/EmptyState/EmptyState'
import Spinner from '../../components/Spinner/Spinner'
import VisaoExecutiva from './VisaoExecutiva'
import GestaoPDS from '../GestaoPDS/GestaoPDS'
import GestaoRiscos from '../GestaoRiscos/GestaoRiscos'
import GestaoRecursos from '../GestaoRecursos/GestaoRecursos'
import GestaoFinanceira from '../GestaoFinanceira/GestaoFinanceira'
import GestaoIniciativas from '../GestaoIniciativas/GestaoIniciativas'
import NovoPlanoModal from '../../components/NovoPlanoModal/NovoPlanoModal'
import { rollupStatus, rollupPct, rollupPctPrev, leafStatus, rollupDateRange } from '../../lib/rollup'
import { useProgramLabels } from '../../hooks/useProgramLabels'
import { statusColor } from '../../lib/tokens'
import { generateStatusNarrative } from '../../lib/statusNarrative'

const TABS = [
  { id: 'visao',        label: 'Visão Executiva' },
  { id: 'actividades',  label: 'Actividades'     },
  { id: 'pds',          label: 'PDS'             },
  { id: 'riscos',       label: 'Riscos'          },
  { id: 'financeira',   label: 'Financeira'      },
  { id: 'recursos',     label: 'Recursos'        },
] as const

type TabId = (typeof TABS)[number]['id']

function isValidTab(t: string | null): t is TabId {
  return TABS.some(tab => tab.id === t)
}

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtDateMY(d: string | null | undefined): string {
  if (!d) return ''
  const parts = d.split('-')
  const m = parseInt(parts[1], 10)
  return `${PT_MONTHS[m - 1]} ${parts[0]}`
}

function planoStatusKey(s: string): 'ontrack' | 'late' | 'done' | 'risk' {
  if (s === 'Concluída') return 'done'
  if (s === 'Em atraso') return 'late'
  if (s === 'Em risco')  return 'risk'
  return 'ontrack'
}

export default function PlanoPage() {
  const { planoId } = useParams<{ planoId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const { planos, loading: planosLoading, refetch: refetchPlano } = usePlanos()
  const { programs, loading: programsLoading } = usePrograms()
  const { isFavorite, toggle: toggleFav, canAddMore } = useFavorites()
  const { canEdit, hasAccess } = usePermissions()

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const { activities: planActivities } = useActivities(planoId ? { plano_id: planoId } : {})
  const planLeaves = useMemo(() => planActivities.filter(a => a.level === 4), [planActivities])
  const planoStatus = useMemo(() => rollupStatus(planLeaves, today), [planLeaves, today])

  const execMedia    = useMemo(() => rollupPct(planLeaves),            [planLeaves])
  const execTarget   = useMemo(() => rollupPctPrev(planLeaves, today), [planLeaves, today])
  const delayedCount = useMemo(
    () => planLeaves.filter(a => leafStatus(a, today) === 'Em atraso').length,
    [planLeaves, today],
  )
  const narrative = useMemo(() => {
    if (planLeaves.length === 0) return ''
    return generateStatusNarrative({ status: planoStatus, execMedia, execTarget, delayedCount })
  }, [planoStatus, execMedia, execTarget, delayedCount, planLeaves.length])

  const planDateRange = useMemo(() => rollupDateRange(planLeaves), [planLeaves])

  const loading = planosLoading || programsLoading

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = isValidTab(rawTab) ? rawTab : 'visao'

  const plano = planos.find(p => p.id === planoId)
  const program = programs.find(p => p.id === plano?.program_id)
  const labels = useProgramLabels(plano?.program_id)

  const [planoEditOpen, setPlanoEditOpen] = useState(false)

  function setTab(tabId: TabId) {
    setSearchParams({ tab: tabId }, { replace: false })
  }

  if (loading) return <Spinner />

  if (!plano) {
    return (
      <div className="pp-wrap">
        <EmptyState
          icon="folder"
          title="Plano não encontrado"
          description="Este plano não existe ou não tens acesso."
          actionLabel={<><ChevronLeft size={14} strokeWidth={1.5} /> Ver todos os planos</>}
          onAction={() => navigate('/planos')}
        />
      </div>
    )
  }

  if (!hasAccess('gestao-iniciativas', plano.program_id ?? undefined, plano.id)) {
    return (
      <div className="pp-wrap">
        <EmptyState
          icon="folder"
          title="Sem acesso a este plano"
          description="Não tens permissão para visualizar este plano."
          actionLabel={<><ChevronLeft size={14} strokeWidth={1.5} /> Ver todos os planos</>}
          onAction={() => navigate('/planos')}
        />
      </div>
    )
  }

  const eixoName = plano.eixo?.name ?? null
  const dateLine = [fmtDateMY(planDateRange.bs), fmtDateMY(planDateRange.bf)].filter(Boolean).join(' → ')

  const isFav        = planoId ? isFavorite(planoId) : false
  const canEditPlano = canEdit('gestao-iniciativas', plano.program_id ?? undefined, plano.id)

  return (
    <div className="pp-wrap">
      {/* Header */}
      <div className="pp-header">
        {/* Nav strip */}
        <div className="pp-nav-strip">
          <button className="pp-nav-back" onClick={() => navigate('/planos')}>
            <ChevronLeft size={13} />
            Voltar
          </button>
          {program?.name && (
            <>
              <span className="pp-nav-sep">·</span>
              <button
                className="pp-nav-link"
                onClick={() => navigate(`/planos?programa=${program.id}`)}
              >
                {program.name}
              </button>
            </>
          )}
          {eixoName && (
            <>
              <span className="pp-nav-sep">›</span>
              {program ? (
                <button
                  className="pp-nav-link"
                  onClick={() => navigate(`/planos?programa=${program.id}&eixo=${plano.eixo_id}`)}
                >
                  {eixoName}
                </button>
              ) : (
                <span className="pp-nav-crumb">{eixoName}</span>
              )}
            </>
          )}
          <span className="pp-nav-sep">›</span>
          <span className="pp-nav-current">{plano.name}</span>
        </div>

        <div className="pp-title-row">
          <div className="pp-title-left">
            <div className="pp-title-line">
              <span
                className="pp-status-dot"
                style={{ backgroundColor: statusColor(planoStatusKey(planoStatus)) }}
              />
              <h1 className="pp-title">{plano.name}</h1>
            </div>
          </div>
          <div className="pp-header-actions">
            {canEditPlano && (
              <button
                className="pp-btn-edit"
                onClick={() => setPlanoEditOpen(true)}
                type="button"
              >
                Editar plano
              </button>
            )}
            <button
              className={`pp-fav-btn${isFav ? ' pp-fav-active' : ''}`}
              onClick={() => planoId && toggleFav(planoId)}
              disabled={!isFav && !canAddMore}
              title={isFav ? 'Remover dos favoritos' : canAddMore ? 'Adicionar aos favoritos' : 'Limite de favoritos atingido'}
              type="button"
            >
              <Star size={16} fill={isFav ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="pp-meta">
          {plano.owner   && <span className="pp-meta-item"><span className="pp-meta-lbl">{labels.owner}</span>{plano.owner}</span>}
          {plano.sponsor && <span className="pp-meta-item"><span className="pp-meta-lbl">{labels.sponsor}</span>{plano.sponsor}</span>}
          {dateLine      && (
            <span className="pp-meta-item">
              <span className="pp-meta-lbl">Datas</span>
              <span className="pp-meta-dates">{dateLine}</span>
            </span>
          )}
          {narrative && <span className="pp-narrative t-body-l">{narrative}</span>}
        </div>

        {plano.objective && (
          <p className="pp-objective">{plano.objective}</p>
        )}
      </div>

      {/* Tab nav */}
      <div className="pp-tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`pp-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pp-tab-content">
        {activeTab === 'visao' && planoId && (
          <VisaoExecutiva planoId={planoId} programId={plano.program_id} />
        )}
        {activeTab === 'actividades' && planoId && (
          <GestaoIniciativas
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'pds' && planoId && (
          <GestaoPDS
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'riscos' && planoId && (
          <GestaoRiscos
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'financeira' && planoId && (
          <GestaoFinanceira
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'recursos' && planoId && (
          <GestaoRecursos
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
      </div>

      <NovoPlanoModal
        isOpen={planoEditOpen}
        onClose={() => setPlanoEditOpen(false)}
        onSaved={() => { setPlanoEditOpen(false); refetchPlano() }}
        planoToEdit={plano}
        programId={plano.program_id ?? null}
      />
    </div>
  )
}
