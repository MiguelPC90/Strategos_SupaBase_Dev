import './UserPermissionsForm.css'
import { useState, useEffect, useRef } from 'react'
import { X, Trash2 } from 'lucide-react'
import { usePrograms } from '../../hooks/usePrograms'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import type { Plano } from '../../types/index'

export const PERM_PAGES: { key: string; label: string }[] = [
  { key: 'dashboard',           label: 'Dashboard'          },
  { key: 'actividades',         label: 'Actividades'        },
  { key: 'gantt',               label: 'Gantt'              },
  { key: 'ponto-situacao',      label: 'Ponto de Situação'  },
  { key: 'exec-financeira',     label: 'Exec. Financeira'   },
  { key: 'recursos',            label: 'Recursos'           },
  { key: 'evolucao',            label: 'Evolução'           },
  { key: 'gestao-iniciativas',  label: 'Gestão Iniciativas' },
  { key: 'gestao-pds',          label: 'Gestão PDS'         },
  { key: 'gestao-riscos',       label: 'Gestão Riscos'      },
  { key: 'gestao-financeira',   label: 'Gestão Financeira'  },
  { key: 'gestao-recursos',     label: 'Gestão Recursos'    },
]

export type CellValue = '' | 'full' | 'ops' | 'view' | 'view_ops' | 'denied'

export interface PermRow {
  program_id: string | null
  plan_id: string | null
  page: string
  access_level: CellValue
}

interface UserPermissionsFormProps {
  userId?: string | null
  userRole: string
  onChange: (rows: PermRow[]) => void
}

export default function UserPermissionsForm({ userId, userRole, onChange }: UserPermissionsFormProps) {
  const { programs } = usePrograms()
  const [permissions,     setPermissions]     = useState<PermRow[]>([])
  const [planosByProg,    setPlanosByProg]     = useState<Record<string, Plano[]>>({})
  const [loading,              setLoading]              = useState(false)
  const [expandedProgs,        setExpandedProgs]        = useState<Set<string>>(new Set())
  const [showRestrPicker,      setShowRestrPicker]      = useState<Record<string, boolean>>({})
  const [removeProgramConfirm, setRemoveProgramConfirm] = useState<{ id: string; name: string } | null>(null)
  const loadingProgs = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) {
      setPermissions([])
      return
    }
    setLoading(true)
    supabase
      .from('user_permissions')
      .select('program_id, plan_id, page, access_level')
      .eq('user_id', userId)
      .then(({ data }) => {
        const perms = (data ?? []) as PermRow[]
        setPermissions(perms)
        setLoading(false)
        const progsWithRestr = [...new Set(
          perms.filter(p => p.plan_id !== null && p.program_id !== null).map(p => p.program_id as string),
        )]
        progsWithRestr.forEach(progId => fetchPlanosForProg(progId))
      })
  }, [userId])

  useEffect(() => {
    onChange(permissions)
  }, [permissions, onChange])

  async function fetchPlanosForProg(programId: string) {
    if (loadingProgs.current.has(programId)) return
    loadingProgs.current.add(programId)
    const { data } = await supabase
      .from('planos')
      .select('id, name, program_id, sort_order')
      .eq('program_id', programId)
      .order('name')
    setPlanosByProg(prev => {
      loadingProgs.current.delete(programId)
      return { ...prev, [programId]: (data ?? []) as Plano[] }
    })
  }

  function loadPlanosForProg(programId: string) {
    if (planosByProg[programId] || loadingProgs.current.has(programId)) return
    fetchPlanosForProg(programId)
  }

  function getPageLevel(programId: string, page: string): CellValue {
    return (permissions.find(
      p => p.program_id === programId && p.plan_id === null && p.page === page,
    )?.access_level ?? '') as CellValue
  }

  function getPlanLevel(programId: string, planId: string): CellValue {
    return (permissions.find(
      p => p.program_id === programId && p.plan_id === planId,
    )?.access_level ?? '') as CellValue
  }

  function handlePageLevel(programId: string, page: string, value: CellValue) {
    setPermissions(perms => {
      const rest = perms.filter(p => !(p.program_id === programId && p.plan_id === null && p.page === page))
      if (value === '') return rest
      return [...rest, { program_id: programId, plan_id: null, page, access_level: value }]
    })
  }

  function handlePlanLevel(programId: string, planId: string, value: CellValue) {
    setPermissions(perms => {
      const rest = perms.filter(p => !(p.program_id === programId && p.plan_id === planId))
      if (value === '') return rest
      return [...rest, ...PERM_PAGES.map(pg => ({
        program_id: programId, plan_id: planId, page: pg.key, access_level: value,
      }))]
    })
  }

  function addProgram(programId: string) {
    PERM_PAGES.forEach(pg => handlePageLevel(programId, pg.key, 'view'))
    setExpandedProgs(s => { const n = new Set(s); n.add(programId); return n })
    loadPlanosForProg(programId)
  }

  function requestRemoveProgram(programId: string) {
    const prog = programs.find(p => p.id === programId)
    const name = prog?.name ?? prog?.code ?? 'este programa'
    setRemoveProgramConfirm({ id: programId, name })
  }

  function handleConfirmRemoveProgram() {
    if (!removeProgramConfirm) return
    setPermissions(perms => perms.filter(p => p.program_id !== removeProgramConfirm.id))
    setRemoveProgramConfirm(null)
  }

  function toggleProg(programId: string) {
    setExpandedProgs(s => {
      const n = new Set(s)
      if (n.has(programId)) { n.delete(programId) } else { n.add(programId); loadPlanosForProg(programId) }
      return n
    })
  }

  const isEditableRole = ['admin', 'program_manager', 'editor'].includes(userRole)
  const programsWithPerms    = programs.filter(prog => permissions.some(p => p.program_id === prog.id))
  const programsWithoutPerms = programs.filter(prog => !permissions.some(p => p.program_id === prog.id))

  if (loading) return <p className="upf-loading">A carregar…</p>

  return (
    <div className="upf-body">
      {programsWithoutPerms.length > 0 && (
        <div className="upf-add-prog">
          <span className="upf-add-prog-label">Adicionar programa</span>
          <select
            className="styled-select-sm"
            defaultValue=""
            onChange={e => { if (e.target.value) { addProgram(e.target.value); e.target.value = '' } }}
          >
            <option value="">— seleccionar —</option>
            {programsWithoutPerms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {programsWithPerms.length === 0 && (
        <p className="upf-empty">Sem acesso atribuído. Selecciona um programa acima para começar.</p>
      )}

      {programsWithPerms.map(prog => {
        const expanded   = expandedProgs.has(prog.id)
        const allPlanos  = planosByProg[prog.id] ?? []
        const planosLoaded = !!planosByProg[prog.id]

        const restrictedPlanIds = [...new Set(
          permissions
            .filter(p => p.program_id === prog.id && p.plan_id !== null)
            .map(p => p.plan_id as string),
        )]
        const restrictedSet  = new Set(restrictedPlanIds)
        const planoMap       = Object.fromEntries(allPlanos.map(pl => [pl.id, pl]))
        const availablePlanos = allPlanos
          .filter(pl => !restrictedSet.has(pl.id))
          .sort((a, b) => a.name.localeCompare(b.name))
        const sortedRestrPlanIds = [...restrictedPlanIds].sort((a, b) =>
          (planoMap[a]?.name ?? 'zzz').localeCompare(planoMap[b]?.name ?? 'zzz'),
        )

        return (
          <div key={prog.id} className="upf-prog-block">
            <div className="upf-prog-header" onClick={() => toggleProg(prog.id)}>
              <span className="upf-prog-name">{prog.name}</span>
              <button
                className="upf-icon-btn"
                style={{ color: 'var(--red)' }}
                title="Remover todas as permissões para este programa"
                onClick={e => { e.stopPropagation(); requestRemoveProgram(prog.id) }}
              >
                <Trash2 size={14} />
              </button>
              <span className="upf-chevron">{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
              <div className="upf-prog-body">
                <div className="upf-section">
                  <p className="upf-section-label">Acesso por página</p>
                  <div className="upf-page-list">
                    {PERM_PAGES.map(pg => (
                      <div key={pg.key} className="upf-row">
                        <span className="upf-row-label">{pg.label}</span>
                        <select
                          className="styled-select-sm upf-select"
                          value={getPageLevel(prog.id, pg.key)}
                          onChange={e => handlePageLevel(prog.id, pg.key, e.target.value as CellValue)}
                        >
                          <option value="">– Sem acesso –</option>
                          {isEditableRole && (
                            <>
                              <option value="full">Editar total</option>
                              <option value="ops">Editar (ops)</option>
                            </>
                          )}
                          <option value="view">Visualização</option>
                          <option value="view_ops">Visualização (ops)</option>
                          <option value="denied">Bloqueado</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="upf-section">
                  <p className="upf-section-label">Restrições por plano específico</p>
                  <p className="upf-helper">
                    Sobrepõe o acesso por página para o plano. Usa apenas para restringir (nunca para ampliar).
                  </p>

                  {sortedRestrPlanIds.length > 0 && (
                    <div className="upf-page-list">
                      {sortedRestrPlanIds.map(planId => (
                        <div key={planId} className="upf-row upf-row--restr">
                          <span className="upf-row-label">
                            {planosLoaded ? (planoMap[planId]?.name ?? '(plano eliminado)') : 'A carregar…'}
                          </span>
                          <select
                            className="styled-select-sm upf-select"
                            value={getPlanLevel(prog.id, planId)}
                            onChange={e => handlePlanLevel(prog.id, planId, e.target.value as CellValue)}
                          >
                            <option value="view">Forçar visualização</option>
                            <option value="denied">Bloqueado</option>
                          </select>
                          <button
                            className="upf-icon-btn"
                            title="Remover restrição"
                            onClick={() => handlePlanLevel(prog.id, planId, '')}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showRestrPicker[prog.id] ? (
                    <div className="upf-row upf-row--new">
                      <select
                        className="styled-select-sm upf-picker-select"
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) {
                            handlePlanLevel(prog.id, e.target.value, 'view')
                            setShowRestrPicker(s => ({ ...s, [prog.id]: false }))
                          }
                        }}
                      >
                        <option value="">— seleccionar plano —</option>
                        {availablePlanos.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                      </select>
                      <button
                        className="upf-icon-btn"
                        title="Cancelar"
                        onClick={() => setShowRestrPicker(s => ({ ...s, [prog.id]: false }))}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    availablePlanos.length > 0 && (
                      <button
                        className="btn-secondary upf-add-restr-btn"
                        onClick={() => {
                          loadPlanosForProg(prog.id)
                          setShowRestrPicker(s => ({ ...s, [prog.id]: true }))
                        }}
                      >
                        + Adicionar restrição
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {removeProgramConfirm && (
        <ConfirmModal
          open
          title="Remover permissões do programa"
          message={`Pretende remover todas as permissões para o programa "${removeProgramConfirm.name}"? Esta acção não pode ser desfeita.`}
          confirmLabel="Remover"
          cancelLabel="Cancelar"
          destructive
          onConfirm={handleConfirmRemoveProgram}
          onCancel={() => setRemoveProgramConfirm(null)}
        />
      )}
    </div>
  )
}
