import { useState, useEffect } from 'react'
import Modal from '../Modal/Modal'
import SearchableSelect from '../SearchableSelect/SearchableSelect'
import type { SelectOption } from '../SearchableSelect/SearchableSelect'

export interface RubricaForm {
  category_id: string | null
  currency: string
  values: Record<string, number>
  note: string
}

interface CategoryOption { id: string; name: string; is_capex: boolean }
interface CurrencyOption { code: string; symbol: string }

interface RubricaModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (planoId: string, form: RubricaForm) => Promise<void>
  form: RubricaForm
  setForm: (form: RubricaForm) => void
  categories: CategoryOption[]
  currencies: CurrencyOption[]
  managementYears: string[]
  errorMessage?: string | null
  planoOptions?: SelectOption[]
  defaultPlanoId?: string
  mode: 'create' | 'edit'
}

export default function RubricaModal({
  isOpen,
  onClose,
  onSave,
  form,
  setForm,
  categories,
  currencies,
  managementYears,
  errorMessage,
  planoOptions,
  defaultPlanoId,
  mode,
}: RubricaModalProps) {
  const set = (patch: Partial<RubricaForm>) => setForm({ ...form, ...patch })

  const [selectedPlanoId, setSelectedPlanoId] = useState<string>(
    planoOptions?.length === 1 ? planoOptions[0].value : (defaultPlanoId ?? '')
  )

  useEffect(() => {
    if (!isOpen) return
    setSelectedPlanoId(
      planoOptions?.length === 1 ? planoOptions[0].value : (defaultPlanoId ?? '')
    )
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const planoRequired = planoOptions !== undefined
  const canSave       = !!form.category_id && (!planoRequired || !!selectedPlanoId)

  const handleSave = async () => {
    const planoId = selectedPlanoId || defaultPlanoId
    if (!planoId) return
    await onSave(planoId, form)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Nova Rubrica' : 'Editar Rubrica'}
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            Guardar
          </button>
          {errorMessage && <span className="gf-panel-err">{errorMessage}</span>}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {planoOptions !== undefined && (
          <div className="gf-field">
            <label className="gf-field-label">Plano *</label>
            <SearchableSelect
              options={planoOptions}
              value={selectedPlanoId || null}
              onChange={val => setSelectedPlanoId(val ?? '')}
              placeholder="Seleccionar plano…"
              disabled={planoOptions.length === 1}
              required
            />
          </div>
        )}
        <div className="gf-field">
          <label className="gf-field-label">Categoria *</label>
          <select
            className="styled-select-sm"
            value={form.category_id ?? ''}
            onChange={e => set({ category_id: e.target.value || null })}
          >
            <option value="">— categoria —</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.is_capex ? 'CAPEX' : 'OPEX'})
              </option>
            ))}
          </select>
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Moeda</label>
          <select
            className="styled-select-sm"
            value={form.currency}
            onChange={e => set({ currency: e.target.value })}
          >
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Valores por ano</label>
          {managementYears.length === 0 ? (
            <span style={{ color: 'var(--text2)', fontSize: 12 }}>
              Nenhum ano configurado. Configura em Admin → Financeiro.
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {managementYears.map(y => (
                <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 48, fontSize: 13, color: 'var(--text2)', flexShrink: 0 }}>{y}</span>
                  <input
                    className="gf-field-input"
                    type="number"
                    value={form.values[y] ?? 0}
                    onChange={e => set({ values: { ...form.values, [y]: parseFloat(e.target.value) || 0 } })}
                    placeholder="0"
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="gf-field">
          <label className="gf-field-label">Nota</label>
          <textarea
            className="gf-field-textarea"
            value={form.note}
            onChange={e => set({ note: e.target.value })}
            placeholder="Observações…"
            rows={2}
          />
        </div>
      </div>
    </Modal>
  )
}
