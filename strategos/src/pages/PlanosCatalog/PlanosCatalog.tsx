import './PlanosCatalog.css'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Star, LayoutList, LayoutGrid } from 'lucide-react'
import { usePlanos } from '../../hooks/usePlanos'
import { usePrograms } from '../../hooks/usePrograms'
import { useFavorites } from '../../hooks/useFavorites'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { rollupStatus, rollupPct } from '../../lib/rollup'
import MultiSelect from '../../components/MultiSelect/MultiSelect'
import EmptyState from '../../components/EmptyState/EmptyState'
import Spinner from '../../components/Spinner/Spinner'
import type { Activity } from '../../types/index'

const STATUS_ORDER = ['Em atraso', 'Em risco', 'Em dia', 'Concluída']

function statusPillClass(status: string): string {
  if (status === 'Em atraso') return 'status-pill pc-pill-late'
  if (status === 'Em risco')  return 'status-pill pc-pill-risk'
  if (status === 'Em dia')    return 'status-pill pc-pill-ontrack'
  if (status === 'Concluída') return 'status-pill pc-pill-done'
  return 'status-pill'
}

interface FavoriteToggleProps {
  planoId: string
  isFav: boolean
  canAdd: boolean
  onToggle: () => void
}

function FavoriteToggle({ planoId: _planoId, isFav, canAdd, onToggle }: FavoriteToggleProps) {
  return (
    <button
      className={`pc-fav-btn${isFav ? ' pc-fav-active' : ''}`}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
      title={isFav ? 'Remover dos favoritos' : canAdd ? 'Adicionar aos favoritos' : 'Máximo de 5 favoritos atingido'}
      disabled={!isFav && !canAdd}
    >
      <Star size={14} fill={isFav ? 'currentColor' : 'none'} strokeWidth={1.5} />
    </button>
  )
}

function MiniProgressBar({ pct }: { pct: number }) {
  return (
    <div className="pc-prog-wrap">
      <div className="pc-prog-bar-outer">
        <div className="pc-prog-bar" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <span className="pc-prog-label">{Math.round(pct)}%</span>
    </div>
  )
}

export default function PlanosCatalog() {
  const { planos, loading } = usePlanos()
  const { programs } = usePrograms()
  const { isFavorite, toggle, canAddMore } = useFavorites()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // ── Fetch level=4 leaves for status computation ───────────────
  const [leaves, setLeaves] = useState<Activity[]>([])
  useEffect(() => {
    let cancelled = false
    supabase
      .from('activities')
      .select('id, level, plano_id, pct, pct_prev, bf, bs, finish, status')
      .eq('level', 4)
      .then(({ data }) => {
        if (!cancelled) setLeaves((data ?? []) as unknown as Activity[])
      })
    return () => { cancelled = true }
  }, [])

  // ── Lookup maps ───────────────────────────────────────────────
  const programMap = useMemo(
    () => new Map(programs.map(p => [p.id, p])),
    [programs],
  )

  const leavesByPlano = useMemo(() => {
    const m = new Map<string, Activity[]>()
    for (const a of leaves) {
      if (!a.plano_id) continue
      const arr = m.get(a.plano_id) ?? []
      arr.push(a)
      m.set(a.plano_id, arr)
    }
    return m
  }, [leaves])

  // ── Filter state ──────────────────────────────────────────────
  const [progFilter,    setProgFilter]    = useState<string[]>([])
  const [eixoFilter,    setEixoFilter]    = useState<string[]>([])
  const [statusFilter,  setStatusFilter]  = useState<string[]>([])
  const [ownerFilter,   setOwnerFilter]   = useState<string[]>([])
  const [sponsorFilter, setSponsorFilter] = useState<string[]>([])
  const [search,        setSearch]        = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [viewMode,      setViewMode]      = useState<'table' | 'cards'>('table')

  // ── Enrich planos with computed status + pct ──────────────────
  const enriched = useMemo(() => planos.map(plano => {
    const lv      = leavesByPlano.get(plano.id) ?? []
    const status  = rollupStatus(lv, today)
    const pct     = rollupPct(lv)
    const program = plano.program_id ? programMap.get(plano.program_id) ?? null : null
    return { ...plano, status, pct, program }
  }), [planos, leavesByPlano, today, programMap])

  // ── Cascading filter options ──────────────────────────────────
  // Program options: all programs that have at least one accessible plano
  const progOptions = useMemo(
    () => [...new Set(enriched.map(p => p.program?.name).filter((n): n is string => !!n))].sort(),
    [enriched],
  )

  // Eixo options: narrowed to selected programs
  const eixoOptions = useMemo(() => {
    const base = progFilter.length > 0
      ? enriched.filter(p => progFilter.includes(p.program?.name ?? ''))
      : enriched
    return [...new Set(base.map(p => p.eixo?.name).filter((n): n is string => !!n))].sort()
  }, [enriched, progFilter])

  // Owner options: narrowed to selected programs + selected eixos
  const ownerOptions = useMemo(() => {
    let base = enriched
    if (progFilter.length  > 0) base = base.filter(p => progFilter.includes(p.program?.name ?? ''))
    if (eixoFilter.length  > 0) base = base.filter(p => eixoFilter.includes(p.eixo?.name ?? ''))
    return [...new Set(base.map(p => p.owner).filter((o): o is string => !!o))].sort()
  }, [enriched, progFilter, eixoFilter])

  // Sponsor options: narrowed to selected programs + selected eixos
  const sponsorOptions = useMemo(() => {
    let base = enriched
    if (progFilter.length  > 0) base = base.filter(p => progFilter.includes(p.program?.name ?? ''))
    if (eixoFilter.length  > 0) base = base.filter(p => eixoFilter.includes(p.eixo?.name ?? ''))
    return [...new Set(base.map(p => p.sponsor).filter((s): s is string => !!s))].sort()
  }, [enriched, progFilter, eixoFilter])

  const statusOptions = ['Em atraso', 'Em risco', 'Em dia', 'Concluída']

  // ── Auto-clear downstream selections when parent filter narrows options ──
  // Use a ref so the effect doesn't run on the initial mount
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (eixoFilter.length > 0) {
      const valid = new Set(eixoOptions)
      const still = eixoFilter.filter(e => valid.has(e))
      if (still.length !== eixoFilter.length) setEixoFilter(still)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eixoOptions])

  useEffect(() => {
    if (ownerFilter.length > 0) {
      const valid = new Set(ownerOptions)
      const still = ownerFilter.filter(o => valid.has(o))
      if (still.length !== ownerFilter.length) setOwnerFilter(still)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerOptions])

  useEffect(() => {
    if (sponsorFilter.length > 0) {
      const valid = new Set(sponsorOptions)
      const still = sponsorFilter.filter(s => valid.has(s))
      if (still.length !== sponsorFilter.length) setSponsorFilter(still)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorOptions])

  // Apply query params (programa / eixo) once enriched data is ready
  const appliedQueryParamsRef = useRef(false)
  useEffect(() => {
    if (enriched.length === 0) return
    if (appliedQueryParamsRef.current) return
    appliedQueryParamsRef.current = true
    const progId = searchParams.get('programa')
    const eixoId = searchParams.get('eixo')
    if (progId) {
      const name = programMap.get(progId)?.name
      if (name) setProgFilter([name])
    }
    if (eixoId) {
      const name = enriched.find(p => p.eixo_id === eixoId)?.eixo?.name
      if (name) setEixoFilter([name])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched])

  // ── Apply filters ─────────────────────────────────────────────
  const filtered = useMemo(() => enriched.filter(p => {
    if (onlyFavorites && !isFavorite(p.id)) return false
    if (progFilter.length    > 0 && !progFilter.includes(p.program?.name ?? ''))  return false
    if (eixoFilter.length    > 0 && !eixoFilter.includes(p.eixo?.name ?? ''))     return false
    if (statusFilter.length  > 0 && !statusFilter.includes(p.status))             return false
    if (ownerFilter.length   > 0 && !ownerFilter.includes(p.owner ?? ''))         return false
    if (sponsorFilter.length > 0 && !sponsorFilter.includes(p.sponsor ?? ''))     return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false
    }
    return true
  }), [enriched, onlyFavorites, progFilter, eixoFilter, statusFilter, ownerFilter, sponsorFilter, search, isFavorite])

  // ── Sort: by program then by status priority ──────────────────
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const pa = a.program?.name ?? ''
    const pb = b.program?.name ?? ''
    if (pa !== pb) return pa.localeCompare(pb)
    return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  }), [filtered])

  const activeFilterCount =
    progFilter.length + eixoFilter.length + statusFilter.length +
    ownerFilter.length + sponsorFilter.length +
    (onlyFavorites ? 1 : 0) + (search.trim() ? 1 : 0)

  const handleToggle = async (planoId: string) => {
    const result = await toggle(planoId)
    if (!result.ok) showToast(result.error ?? 'Erro ao atualizar favorito', 'error')
  }

  const clearFilters = () => {
    setProgFilter([])
    setEixoFilter([])
    setStatusFilter([])
    setOwnerFilter([])
    setSponsorFilter([])
    setSearch('')
    setOnlyFavorites(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="pc-wrap">
      {/* ── Header ── */}
      <div className="pc-header">
        <div className="pc-header-left">
          <h1 className="pc-title">Planos</h1>
          <span className="pc-count">
            {filtered.length !== planos.length
              ? `${filtered.length} de ${planos.length}`
              : `${planos.length} plano${planos.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="pc-header-right">
          <div className="pc-view-toggle">
            <button
              className={`pc-view-btn${viewMode === 'table' ? ' pc-view-btn-active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Vista de tabela"
            >
              <LayoutList size={15} />
            </button>
            <button
              className={`pc-view-btn${viewMode === 'cards' ? ' pc-view-btn-active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Vista de cards"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="pc-filters">
        <input
          type="text"
          className="pc-search"
          placeholder="Pesquisar nome ou código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="pc-ms" style={{ width: 220 }}>
          <MultiSelect label="Programa"  options={progOptions}    value={progFilter}    onChange={setProgFilter} />
        </div>
        <div className="pc-ms" style={{ width: 200 }}>
          <MultiSelect label="Eixo"      options={eixoOptions}    value={eixoFilter}    onChange={setEixoFilter} />
        </div>
        <div className="pc-ms" style={{ width: 160 }}>
          <MultiSelect label="Status"    options={statusOptions}  value={statusFilter}  onChange={setStatusFilter} />
        </div>
        <div className="pc-ms" style={{ width: 200 }}>
          <MultiSelect label="Owner"     options={ownerOptions}   value={ownerFilter}   onChange={setOwnerFilter} />
        </div>
        <div className="pc-ms" style={{ width: 200 }}>
          <MultiSelect label="Sponsor"   options={sponsorOptions} value={sponsorFilter} onChange={setSponsorFilter} />
        </div>
        <button
          className={`pc-fav-filter${onlyFavorites ? ' pc-fav-filter-active' : ''}`}
          onClick={() => setOnlyFavorites(v => !v)}
          title="Mostrar só favoritos"
        >
          <Star size={13} fill={onlyFavorites ? 'currentColor' : 'none'} strokeWidth={1.5} />
          Favoritos
        </button>
        {activeFilterCount > 0 && (
          <button className="pc-clear-btn" onClick={clearFilters}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {sorted.length === 0 ? (
        <EmptyState
          icon="folder"
          title={activeFilterCount > 0 ? 'Sem resultados' : 'Sem planos acessíveis'}
          description={
            activeFilterCount > 0
              ? 'Nenhum plano corresponde aos filtros selecionados.'
              : 'Não tens acesso a nenhum plano. Contacta o administrador.'
          }
        />
      ) : viewMode === 'table' ? (
        <div className="pc-table-wrap">
          <table className="pc-table">
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="pc-th pc-th-star" />
                <th className="pc-th">Nome</th>
                <th className="pc-th">Programa</th>
                <th className="pc-th">Eixo</th>
                <th className="pc-th">Owner</th>
                <th className="pc-th">Status</th>
                <th className="pc-th pc-th-prog">% Exec</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} className="pc-tr">
                  <td className="pc-td pc-td-star">
                    <FavoriteToggle
                      planoId={p.id}
                      isFav={isFavorite(p.id)}
                      canAdd={canAddMore}
                      onToggle={() => handleToggle(p.id)}
                    />
                  </td>
                  <td className="pc-td">
                    <Link to={`/planos/${p.id}`} className="pc-row-link">
                      <span className="pc-row-name">{p.name}</span>
                      <span className="pc-row-code">{p.code}</span>
                    </Link>
                  </td>
                  <td className="pc-td pc-td-meta">{p.program?.name ?? '—'}</td>
                  <td className="pc-td pc-td-meta">{p.eixo?.name ?? '—'}</td>
                  <td className="pc-td pc-td-meta">{p.owner ?? '—'}</td>
                  <td className="pc-td">
                    <span className={statusPillClass(p.status)}>{p.status}</span>
                  </td>
                  <td className="pc-td pc-td-bar">
                    <MiniProgressBar pct={p.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pc-cards">
          {sorted.map(p => (
            <div key={p.id} className="pc-card">
              <div className="pc-card-top">
                <Link to={`/planos/${p.id}`} className="pc-card-name-wrap">
                  <span className="pc-card-name">{p.name}</span>
                  <span className="pc-card-code">{p.code}</span>
                </Link>
                <FavoriteToggle
                  planoId={p.id}
                  isFav={isFavorite(p.id)}
                  canAdd={canAddMore}
                  onToggle={() => handleToggle(p.id)}
                />
              </div>
              {(p.program?.name || p.eixo?.name) && (
                <div className="pc-card-prog-line">
                  {p.program?.name && <span className="pc-card-prog">{p.program.name}</span>}
                  {p.program?.name && p.eixo?.name && <span className="pc-card-dot">·</span>}
                  {p.eixo?.name && <span className="pc-card-eixo">{p.eixo.name}</span>}
                </div>
              )}
              <MiniProgressBar pct={p.pct} />
              <div className="pc-card-footer">
                <span className={statusPillClass(p.status)}>{p.status}</span>
                <div className="pc-card-people">
                  {p.owner   && <span className="pc-card-person">{p.owner}</span>}
                  {p.sponsor && <span className="pc-card-person pc-card-sponsor">{p.sponsor}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
