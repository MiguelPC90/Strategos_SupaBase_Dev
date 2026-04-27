import './PlanoPage.css'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import EmptyState from '../../components/EmptyState/EmptyState'
import Spinner from '../../components/Spinner/Spinner'

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

function TabContent({ activeTab }: { activeTab: TabId }) {
  const labels: Record<TabId, string> = {
    visao:       'Visão Executiva',
    actividades: 'Actividades',
    pds:         'PDS',
    riscos:      'Riscos',
    financeira:  'Financeira',
    recursos:    'Recursos',
  }
  return (
    <div className="pp-empty-tab">
      <span className="pp-empty-tab-label">{labels[activeTab]} — em construção</span>
    </div>
  )
}

export default function PlanoPage() {
  const { planoId } = useParams<{ planoId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const { planos, loading: planosLoading } = usePlanos()
  const { programs, loading: programsLoading } = usePrograms()

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

        <h1 className="pp-title">{plano.name}</h1>
        <span className="pp-code">{plano.code}</span>

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
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  )
}
