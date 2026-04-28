import './PlanoPage.css'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFavorites } from '../../hooks/useFavorites'
import { usePermissions } from '../../hooks/usePermissions'
import EmptyState from '../../components/EmptyState/EmptyState'
import Spinner from '../../components/Spinner/Spinner'
import VisaoExecutiva from './VisaoExecutiva'
import GestaoPDS from '../GestaoPDS/GestaoPDS'
import GestaoRiscos from '../GestaoRiscos/GestaoRiscos'
import GestaoRecursos from '../GestaoRecursos/GestaoRecursos'
import GestaoFinanceira from '../GestaoFinanceira/GestaoFinanceira'

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

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="pp-empty-tab">
      <span className="pp-empty-tab-label">{label} — em construção</span>
    </div>
  )
}

export default function PlanoPage() {
  const { planoId } = useParams<{ planoId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const { planos, loading: planosLoading } = usePlanos()
  const { programs, loading: programsLoading } = usePrograms()
  const { isFavorite, toggle: toggleFav, canAddMore } = useFavorites()
  const { canEdit } = usePermissions()

  const loading = planosLoading || programsLoading

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = isValidTab(rawTab) ? rawTab : 'visao'

  const plano = planos.find(p => p.id === planoId)
  const program = programs.find(p => p.id === plano?.program_id)

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
          actionLabel="← Ver todos os planos"
          onAction={() => navigate('/planos')}
        />
      </div>
    )
  }

  const eixoName = plano.eixo?.name ?? null
  const dateLine = [fmtDate(plano.start_date), fmtDate(plano.end_date)].filter(Boolean).join(' → ')

  const isFav       = planoId ? isFavorite(planoId) : false
  const canEditPlano = canEdit('gestao-iniciativas', plano.program_id ?? undefined)

  return (
    <div className="pp-wrap">
      {/* Header */}
      <div className="pp-header">
        <button className="pp-back-btn" onClick={() => navigate('/planos')}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Planos
        </button>

        <div className="pp-breadcrumb">
          {program?.name && <span>{program.name}</span>}
          {eixoName && <><span className="pp-bc-sep">›</span><span>{eixoName}</span></>}
          <span className="pp-bc-sep">›</span>
          <span className="pp-bc-current">{plano.name}</span>
        </div>

        <div className="pp-title-row">
          <div className="pp-title-left">
            <h1 className="pp-title">{plano.name}</h1>
            <span className="pp-code">{plano.code}</span>
          </div>
          <div className="pp-header-actions">
            {canEditPlano && (
              <button
                className="pp-btn-edit"
                onClick={() => navigate('/gestao-iniciativas')}
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
          {plano.owner   && <span className="pp-meta-item"><span className="pp-meta-lbl">Owner</span>{plano.owner}</span>}
          {plano.sponsor && <span className="pp-meta-item"><span className="pp-meta-lbl">Sponsor</span>{plano.sponsor}</span>}
          {dateLine      && <span className="pp-meta-item pp-meta-dates">{dateLine}</span>}
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
        {activeTab === 'actividades' && <PlaceholderTab label="Actividades" />}
        {activeTab === 'pds' && planoId && (
          <GestaoPDS
            mode="embedded"
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'riscos' && planoId && (
          <GestaoRiscos
            mode="embedded"
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'financeira' && planoId && (
          <GestaoFinanceira
            mode="embedded"
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
        {activeTab === 'recursos' && planoId && (
          <GestaoRecursos
            mode="embedded"
            planoId={planoId}
            programId={plano.program_id ?? undefined}
          />
        )}
      </div>
    </div>
  )
}
