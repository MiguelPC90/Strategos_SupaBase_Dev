import './PlanosCatalog.css'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Star, LayoutList, LayoutGrid, Plus, MoreHorizontal } from 'lucide-react'
import { usePlanos } from '../../hooks/usePlanos'
import { usePeople } from '../../hooks/usePeople'
import { useProgramLabels } from '../../hooks/useProgramLabels'
import { usePrograms } from '../../hooks/usePrograms'
import { useFavorites } from '../../hooks/useFavorites'
import { useToast } from '../../context/ToastContext'
import { useRole } from '../../hooks/useRole'
import { useCanEditCurrent } from '../../hooks/useCanEditCurrent'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import { useEffectiveValues } from '../../hooks/useEffectiveValues'
import { computeGroupStatusFromEff } from '../../lib/rollup'
import { useBandResolver } from '../../hooks/useThresholdsMap'
import { resolveOwnerNames, resolveSponsorNames } from '../../lib/owners'
import { comparePlanos } from '../../lib/sort'
import MultiSelect from '../../components/MultiSelect/MultiSelect'
import EmptyState from '../../components/EmptyState/EmptyState'
import Spinner from '../../components/Spinner/Spinner'
import NovoPlanoModal from '../../components/NovoPlanoModal/NovoPlanoModal'
import DuplicatePlanoModal from '../../components/DuplicatePlanoModal/DuplicatePlanoModal'
import type { Activity, Plano } from '../../types/index'


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

const PROG_BAR_COLORS: Record<string, string> = {
  'Concluída': 'var(--status-done)',
  'Em dia':    'var(--status-ontrack)',
  'Em risco':  'var(--status-risk)',
  'Em atraso': 'var(--status-late)',
}

function MiniProgressBar({ pct, estado }: { pct: number; estado?: string }) {
  const color = estado && PROG_BAR_COLORS[estado] ? PROG_BAR_COLORS[estado] : 'var(--stratgos-ink-300)'
  return (
    <div className="pc-prog-wrap">
      <div className="pc-prog-bar-outer">
        <div
          className="pc-prog-bar"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            background: color,
          }}
        />
      </div>
      <span className="pc-prog-label">{Math.round(pct)}%</span>
    </div>
  )
}

interface PlanoRowMenuProps {
  planoId: string
  openId: string | null
  onOpen: (id: string | null) => void
  onEdit: () => void
  onDuplicate: () => void
}

function PlanoRowMenu({ planoId, openId, onOpen, onEdit, onDuplicate }: PlanoRowMenuProps) {
  const isOpen = openId === planoId
  return (
    <div className="pc-row-actions">
      <button
        className="pc-row-menu-btn"
        onClick={e => { e.preventDefault(); e.stopPropagation(); onOpen(isOpen ? null : planoId) }}
        title="Acções"
      >
        <MoreHorizontal size={14} strokeWidth={1.5} />
      </button>
      {isOpen && (
        <div className="pc-row-menu-dropdown" onClick={e => e.stopPropagation()}>
          <button
            className="pc-row-menu-item"
            onClick={() => { onEdit(); onOpen(null) }}
          >
            Editar
          </button>
          <button
            className="pc-row-menu-item"
            onClick={() => { onDuplicate(); onOpen(null) }}
          >
            Duplicar
          </button>
        </div>
      )}
    </div>
  )
}

export default function PlanosCatalog() {
  const qc = useQueryClient()
  const { planos, loading, refetch } = usePlanos()
  const { programs } = usePrograms()
  const { people } = usePeople()
  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const { isFavorite, toggle, canAddMore } = useFavorites()
  const { showToast } = useToast()
  const { isAdmin, isProgramManager } = useRole()
  const canEdit = useCanEditCurrent('gestao-iniciativas')
  const { hasAccess } = usePermissions()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [newPlanoOpen,     setNewPlanoOpen]     = useState(false)
  const [menuId,           setMenuId]           = useState<string | null>(null)
  const [editPlano,        setEditPlano]        = useState<Plano | null>(null)
  const [duplicateSource,  setDuplicateSource]  = useState<Plano | null>(null)
  const [duplicateOpen,    setDuplicateOpen]    = useState(false)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // ── Fetch level=4 leaves for status computation ───────────────
  const [leaves, setLeaves] = useState<Activity[]>([])
  useEffect(() => {
    let cancelled = false
    const PAGE_SIZE = 1000
    async function fetchAllLeaves(): Promise<Activity[]> {
      const all: Activity[] = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('activities')
          .select('id, level, plano_id, pct, pct_prev, bf, bs, finish, status')
          .eq('level', 4)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (err) throw err
        const batch = (data ?? []) as unknown as Activity[]
        all.push(...batch)
        if (batch.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return all
    }
    fetchAllLeaves()
      .then(rows => { if (!cancelled) setLeaves(rows) })
      .catch(() => { /* leaves stay empty; enriched statuses degrade gracefully */ })
    return () => { cancelled = true }
  }, [])

  // ── Lookup maps ───────────────────────────────────────────────
  const programMap = useMemo(
    () => new Map(programs.map(p => [p.id, p])),
    [programs],
  )

  const programCodeMap = useMemo(
    () => new Map(programs.map(p => [p.id, p.code])),
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

  const eff = useEffectiveValues(leaves, today)
  const bandResolver = useBandResolver()

  // ── Filter state ──────────────────────────────────────────────
  const [progFilter,    setProgFilter]    = useState<string[]>([])
  const [eixoFilter,    setEixoFilter]    = useState<string[]>([])
  const [statusFilter,  setStatusFilter]  = useState<string[]>([])
  const [ownerFilter,   setOwnerFilter]   = useState<string[]>([])
  const [sponsorFilter, setSponsorFilter] = useState<string[]>([])
  const [search,        setSearch]        = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [viewMode,      setViewMode]      = useState<'table' | 'cards'>('table')

  const activeProgramId = useMemo(
    () => {
      if (progFilter.length !== 1) return null
      return programs.find(p => progFilter.includes(p.name))?.id ?? null
    },
    [progFilter, programs],
  )
  const labels = useProgramLabels(activeProgramId)

  // ── Enrich planos with computed status + pct ──────────────────
  const enriched = useMemo(() => planos.map(plano => {
    const lv           = leavesByPlano.get(plano.id) ?? []
    const status       = computeGroupStatusFromEff(lv, eff, 2, today, bandResolver)
    const pct          = lv.length === 0 ? 0 : lv.reduce((s, a) => s + (eff.get(a.id)?.pct ?? a.pct), 0) / lv.length
    const program      = plano.program_id ? programMap.get(plano.program_id) ?? null : null
    const ownerNames   = resolveOwnerNames(plano, peopleMap).join(', ') || null
    const sponsorNames = resolveSponsorNames(plano, peopleMap).join(', ') || null
    return { ...plano, status, pct, program, ownerNames, sponsorNames }
  }), [planos, leavesByPlano, eff, programMap, peopleMap, bandResolver])

  // ── Plan-level access filter ──────────────────────────────────
  const accessiblePlanIds = useMemo(
    () => new Set(planos.filter(p => hasAccess('gestao-iniciativas', p.program_id ?? undefined, p.id)).map(p => p.id)),
    [planos, hasAccess],
  )

  const visibleEnriched = useMemo(
    () => enriched.filter(p => accessiblePlanIds.has(p.id)),
    [enriched, accessiblePlanIds],
  )

  // ── Cascading filter options ──────────────────────────────────
  // Program options: all programs that have at least one accessible plano
  const progOptions = useMemo(
    () => [...new Set(visibleEnriched.map(p => p.program?.name).filter((n): n is string => !!n))].sort(),
    [visibleEnriched],
  )

  // Eixo options: narrowed to selected programs
  const eixoOptions = useMemo(() => {
    const base = progFilter.length > 0
      ? visibleEnriched.filter(p => progFilter.includes(p.program?.name ?? ''))
      : visibleEnriched
    return [...new Set(base.map(p => p.eixo?.name).filter((n): n is string => !!n))].sort()
  }, [visibleEnriched, progFilter])

  // Owner options: narrowed to selected programs + selected eixos
  const ownerOptions = useMemo(() => {
    let base = visibleEnriched
    if (progFilter.length  > 0) base = base.filter(p => progFilter.includes(p.program?.name ?? ''))
    if (eixoFilter.length  > 0) base = base.filter(p => eixoFilter.includes(p.eixo?.name ?? ''))
    const ids = new Set(base.flatMap(p => p.owner_person_ids))
    return [...ids].map(id => peopleMap.get(id)?.name).filter((n): n is string => !!n).sort()
  }, [visibleEnriched, progFilter, eixoFilter, peopleMap])

  // Sponsor options: narrowed to selected programs + selected eixos
  const sponsorOptions = useMemo(() => {
    let base = visibleEnriched
    if (progFilter.length  > 0) base = base.filter(p => progFilter.includes(p.program?.name ?? ''))
    if (eixoFilter.length  > 0) base = base.filter(p => eixoFilter.includes(p.eixo?.name ?? ''))
    const ids = new Set(base.flatMap(p => p.sponsor_person_ids))
    return [...ids].map(id => peopleMap.get(id)?.name).filter((n): n is string => !!n).sort()
  }, [visibleEnriched, progFilter, eixoFilter, peopleMap])

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
    if (visibleEnriched.length === 0) return
    if (appliedQueryParamsRef.current) return
    appliedQueryParamsRef.current = true
    const progId = searchParams.get('programa')
    const eixoId = searchParams.get('eixo')
    if (progId) {
      const name = programMap.get(progId)?.name
      if (name) setProgFilter([name])
    }
    if (eixoId) {
      const name = visibleEnriched.find(p => p.eixo_id === eixoId)?.eixo?.name
      if (name) setEixoFilter([name])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEnriched])

  // ── Apply filters ─────────────────────────────────────────────
  const filtered = useMemo(() => visibleEnriched.filter(p => {
    if (onlyFavorites && !isFavorite(p.id)) return false
    if (progFilter.length    > 0 && !progFilter.includes(p.program?.name ?? ''))  return false
    if (eixoFilter.length    > 0 && !eixoFilter.includes(p.eixo?.name ?? ''))     return false
    if (statusFilter.length  > 0 && !statusFilter.includes(p.status))             return false
    if (ownerFilter.length   > 0) {
      const names = p.owner_person_ids.map(id => peopleMap.get(id)?.name).filter(Boolean) as string[]
      if (!ownerFilter.some(f => names.includes(f))) return false
    }
    if (sponsorFilter.length > 0) {
      const names = p.sponsor_person_ids.map(id => peopleMap.get(id)?.name).filter(Boolean) as string[]
      if (!sponsorFilter.some(f => names.includes(f))) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false
    }
    return true
  }), [visibleEnriched, onlyFavorites, progFilter, eixoFilter, statusFilter, ownerFilter, sponsorFilter, search, isFavorite])

  // ── Sort: hierarchical (program → eixo → plano) ──────────────
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => comparePlanos(a, b, programCodeMap)),
    [filtered, programCodeMap],
  )

  const activeFilterCount =
    progFilter.length + eixoFilter.length + statusFilter.length +
    ownerFilter.length + sponsorFilter.length +
    (onlyFavorites ? 1 : 0) + (search.trim() ? 1 : 0)

  useEffect(() => {
    if (!menuId) return
    const handler = () => setMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuId])

  const handleEditPlano = (planoId: string) => {
    const p = planos.find(pl => pl.id === planoId) ?? null
    setEditPlano(p)
    setMenuId(null)
  }

  const handleOpenDuplicate = (planoId: string) => {
    const p = planos.find(pl => pl.id === planoId) ?? null
    if (!p) return
    setDuplicateSource(p)
    setDuplicateOpen(true)
  }

  const handleDuplicated = (newPlanoId: string) => {
    setDuplicateOpen(false)
    setDuplicateSource(null)
    void qc.invalidateQueries({ queryKey: ['activities'] })
    navigate(`/planos/${newPlanoId}`)
  }

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
          {(isAdmin || isProgramManager) && (
            <button
              className="btn-secondary"
              onClick={() => setNewPlanoOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              Novo Plano
            </button>
          )}
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
          <MultiSelect label={labels.n1}  options={eixoOptions}    value={eixoFilter}    onChange={setEixoFilter} />
        </div>
        <div className="pc-ms" style={{ width: 160 }}>
          <MultiSelect label="Status"    options={statusOptions}  value={statusFilter}  onChange={setStatusFilter} />
        </div>
        <div className="pc-ms" style={{ width: 200 }}>
          <MultiSelect label={labels.owner} options={ownerOptions} value={ownerFilter}   onChange={setOwnerFilter} />
        </div>
        <div className="pc-ms" style={{ width: 200 }}>
          <MultiSelect label={labels.sponsor} options={sponsorOptions} value={sponsorFilter} onChange={setSponsorFilter} />
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
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="pc-th pc-th-star" />
                <th className="pc-th">Nome</th>
                <th className="pc-th">Programa</th>
                <th className="pc-th">{labels.n1}</th>
                <th className="pc-th">{labels.owner}</th>
                <th className="pc-th">Status</th>
                <th className="pc-th pc-th-prog">% Exec</th>
                <th className="pc-th" />
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
                  <td className="pc-td pc-td-meta">{p.ownerNames ?? '—'}</td>
                  <td className="pc-td">
                    <span className={statusPillClass(p.status)}>{p.status}</span>
                  </td>
                  <td className="pc-td pc-td-bar">
                    <MiniProgressBar pct={p.pct} estado={p.status} />
                  </td>
                  <td className="pc-td" style={{ padding: '8px 4px' }}>
                    {canEdit && (
                      <PlanoRowMenu
                        planoId={p.id}
                        openId={menuId}
                        onOpen={setMenuId}
                        onEdit={() => handleEditPlano(p.id)}
                        onDuplicate={() => handleOpenDuplicate(p.id)}
                      />
                    )}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {canEdit && (
                    <PlanoRowMenu
                      planoId={p.id}
                      openId={menuId}
                      onOpen={setMenuId}
                      onEdit={() => handleEditPlano(p.id)}
                      onDuplicate={() => handleOpenDuplicate(p.id)}
                    />
                  )}
                  <FavoriteToggle
                    planoId={p.id}
                    isFav={isFavorite(p.id)}
                    canAdd={canAddMore}
                    onToggle={() => handleToggle(p.id)}
                  />
                </div>
              </div>
              {(p.program?.name || p.eixo?.name) && (
                <div className="pc-card-prog-line">
                  {p.program?.name && <span className="pc-card-prog">{p.program.name}</span>}
                  {p.program?.name && p.eixo?.name && <span className="pc-card-dot">·</span>}
                  {p.eixo?.name && <span className="pc-card-eixo">{p.eixo.name}</span>}
                </div>
              )}
              <MiniProgressBar pct={p.pct} estado={p.status} />
              <div className="pc-card-footer">
                <span className={statusPillClass(p.status)}>{p.status}</span>
                <div className="pc-card-people">
                  {p.ownerNames   && <span className="pc-card-person">{p.ownerNames}</span>}
                  {p.sponsorNames && <span className="pc-card-person pc-card-sponsor">{p.sponsorNames}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NovoPlanoModal
        isOpen={newPlanoOpen}
        onClose={() => setNewPlanoOpen(false)}
        onSaved={() => { refetch(); void qc.invalidateQueries({ queryKey: ['activities'] }) }}
        programId={programs.find(p => progFilter.includes(p.name))?.id ?? null}
        defaultEixoId={
          eixoFilter.length > 0
            ? enriched.find(p => eixoFilter.includes(p.eixo?.name ?? ''))?.eixo_id ?? undefined
            : undefined
        }
      />
      <NovoPlanoModal
        isOpen={editPlano !== null}
        onClose={() => setEditPlano(null)}
        onSaved={() => { refetch(); void qc.invalidateQueries({ queryKey: ['activities'] }); setEditPlano(null) }}
        planoToEdit={editPlano}
        programId={editPlano?.program_id ?? null}
      />
      <DuplicatePlanoModal
        isOpen={duplicateOpen}
        onClose={() => { setDuplicateOpen(false); setDuplicateSource(null) }}
        onDuplicated={handleDuplicated}
        source={duplicateSource}
      />
    </div>
  )
}
