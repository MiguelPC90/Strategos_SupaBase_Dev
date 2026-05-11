import './DuplicatePlanoModal.css'
import { useState, useEffect } from 'react'
import Modal from '../Modal/Modal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import type { Plano } from '../../types/index'

function shiftDate(iso: string | null, offsetDays: number): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() + offsetDays * 86_400_000
  return new Date(ms).toISOString().split('T')[0]
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.round(
    (new Date(isoB).getTime() - new Date(isoA).getTime()) / 86_400_000,
  )
}

interface DuplicatePlanoModalProps {
  isOpen: boolean
  onClose: () => void
  onDuplicated: (newPlanoId: string) => void
  source: Plano | null
}

export default function DuplicatePlanoModal({
  isOpen,
  onClose,
  onDuplicated,
  source,
}: DuplicatePlanoModalProps) {
  const { showToast } = useToast()
  const [name,      setName]      = useState('')
  const [code,      setCode]      = useState('')
  const [strategy,  setStrategy]  = useState<'shift' | 'clear'>('shift')
  const [startDate, setStartDate] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!source) return
    setName(source.name + ' (cópia)')
    setCode(source.code + '-C')
    setStrategy('shift')
    setStartDate(new Date().toISOString().split('T')[0])
    setError(null)
  }, [source?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDuplicate = async () => {
    if (!source) return
    setSaving(true)
    setError(null)

    try {
      // 1. Compute date offset (shift strategy only)
      let offsetDays = 0
      if (strategy === 'shift' && startDate) {
        const { data: earliest } = await supabase
          .from('activities')
          .select('bs')
          .eq('plano_id', source.id)
          .not('bs', 'is', null)
          .order('bs', { ascending: true })
          .limit(1)
        const earliestBs = (earliest as { bs: string }[] | null)?.[0]?.bs ?? null
        if (earliestBs) {
          offsetDays = daysBetween(earliestBs, startDate)
        }
      }

      // 2. Compute sort_order for new plano
      const { data: maxResult } = await supabase
        .from('planos')
        .select('sort_order')
        .eq('eixo_id', source.eixo_id)
        .order('sort_order', { ascending: false })
        .limit(1)
      const nextSort = ((maxResult as { sort_order: number }[] | null)?.[0]?.sort_order ?? 0) + 1

      // 3. Insert new plano (copy metadata, no financial/pds/risks/resources)
      const { data: newPlano, error: pErr } = await supabase
        .from('planos')
        .insert({
          eixo_id:              source.eixo_id,
          program_id:           source.program_id,
          code:                 code.trim().toUpperCase(),
          name:                 name.trim(),
          sort_order:           nextSort,
          owner:                source.owner,
          sponsor:              source.sponsor,
          objective:            source.objective,
          threshold_leaves:     source.threshold_leaves,
          threshold_aggregates: source.threshold_aggregates,
        })
        .select('id, name')
        .single()
      if (pErr || !newPlano) throw pErr ?? new Error('Erro ao criar plano')

      const { id: newPlanoId, name: newPlanoName } =
        newPlano as { id: string; name: string }

      // 4. Fetch all source activities
      const { data: srcActs, error: aErr } = await supabase
        .from('activities')
        .select('*')
        .eq('plano_id', source.id)
      if (aErr) throw aErr

      if (srcActs && srcActs.length > 0) {
        // 5. Build clone rows + id map
        const idMap = new Map<string, string>()
        const clonedActs = (srcActs as Record<string, unknown>[]).map(a => {
          const newId = crypto.randomUUID()
          idMap.set(a.id as string, newId)
          return {
            ...a,
            id:       newId,
            plano_id: newPlanoId,
            n2:       newPlanoName,   // sync_plano_id trigger uses n2 — must match new plano name
            pct:      0,
            pct_prev: a.pct_prev,
            rs:       null,
            rf:       null,
            status:   'Em dia',
            source:   'manual',
            bs: strategy === 'clear' ? null : shiftDate(a.bs as string | null, offsetDays),
            bf: strategy === 'clear' ? null : shiftDate(a.bf as string | null, offsetDays),
          }
        })

        // 6. Batch insert activities
        const { error: insErr } = await supabase.from('activities').insert(clonedActs)
        if (insErr) throw insErr

        // 7. Remap internal activity_dependencies
        const srcIds = (srcActs as Record<string, unknown>[]).map(a => a.id as string)
        const { data: deps } = await supabase
          .from('activity_dependencies')
          .select('*')
          .in('successor_id', srcIds)

        const internalDeps = ((deps ?? []) as Record<string, unknown>[]).filter(
          d => idMap.has(d.predecessor_id as string) && idMap.has(d.successor_id as string),
        )

        if (internalDeps.length > 0) {
          await supabase.from('activity_dependencies').insert(
            internalDeps.map(d => ({
              successor_id:   idMap.get(d.successor_id as string)!,
              predecessor_id: idMap.get(d.predecessor_id as string)!,
              dep_type:       d.dep_type,
              lag_days:       d.lag_days,
            })),
          )
        }
      }

      showToast(`Plano "${name.trim()}" duplicado.`, 'success')
      onDuplicated(newPlanoId)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao duplicar plano'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicar plano"
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleDuplicate}
            disabled={saving || !name.trim() || !code.trim()}
          >
            {saving ? 'A duplicar…' : 'Duplicar'}
          </button>
        </>
      }
    >
      <div className="dpm-body">
        <div className="dpm-field">
          <label className="dpm-label">Nome *</label>
          <input
            className="dpm-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do plano duplicado"
          />
        </div>

        <div className="dpm-field">
          <label className="dpm-label">Código *</label>
          <input
            className="dpm-input"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Código único"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <fieldset className="dpm-strategy">
          <legend className="dpm-legend">Datas das actividades</legend>
          <label className="dpm-radio-label">
            <input
              type="radio"
              name="dpm-strategy"
              value="shift"
              checked={strategy === 'shift'}
              onChange={() => setStrategy('shift')}
            />
            Manter cadência (deslocar datas)
          </label>
          <label className="dpm-radio-label">
            <input
              type="radio"
              name="dpm-strategy"
              value="clear"
              checked={strategy === 'clear'}
              onChange={() => setStrategy('clear')}
            />
            Limpar datas (definir depois)
          </label>
        </fieldset>

        {strategy === 'shift' && (
          <div className="dpm-field">
            <label className="dpm-label">Data de início da 1.ª actividade</label>
            <input
              type="date"
              className="dpm-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
        )}

        <p className="dpm-info">
          Dados financeiros, PDS, riscos e recursos não são copiados.
        </p>

        {error && <p className="dpm-error">{error}</p>}
      </div>
    </Modal>
  )
}
