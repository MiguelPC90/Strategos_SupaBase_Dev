import { useState, useEffect } from 'react'
import Modal from '../Modal/Modal'
import SearchableSelect from '../SearchableSelect/SearchableSelect'
import type { SelectOption } from '../SearchableSelect/SearchableSelect'

export interface ContractForm {
  id: string | null
  supplier: string
  category: string
  total_amount: string
  currency: string
  exchange_rate_ref: string
  award_date: string
  end_date: string
  description: string
}

interface CurrencyOption { code: string; symbol: string }
interface CategoryOption { id: string; name: string; is_capex: boolean }

interface ContratoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (planoId?: string) => void | Promise<void>
  onDelete?: () => void
  form: ContractForm | null
  setForm: (f: ContractForm) => void
  categories: CategoryOption[]
  currencies: CurrencyOption[]
  errorMessage?: string | null
  planoOptions?: SelectOption[]
  defaultPlanoId?: string
}

export default function ContratoModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  form,
  setForm,
  categories,
  currencies,
  errorMessage,
  planoOptions,
  defaultPlanoId,
}: ContratoModalProps) {
  const set = (patch: Partial<ContractForm>) => form && setForm({ ...form, ...patch })

  const [selectedPlanoId, setSelectedPlanoId] = useState<string>(
    planoOptions?.length === 1 ? planoOptions[0].value : (defaultPlanoId ?? '')
  )

  useEffect(() => {
    if (!isOpen) return
    setSelectedPlanoId(
      planoOptions?.length === 1 ? planoOptions[0].value : (defaultPlanoId ?? '')
    )
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={form?.id ? 'Editar Contrato' : 'Novo Contrato'}
      width={500}
      footer={
        <>
          {onDelete && (
            <button className="btn-danger" onClick={onDelete} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => onSave(selectedPlanoId || undefined)}>Guardar</button>
          {errorMessage && <span className="gf-panel-err">{errorMessage}</span>}
        </>
      }
    >
      {form && (
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
            <label className="gf-field-label">Fornecedor *</label>
            <input
              className="gf-field-input"
              value={form.supplier}
              onChange={e => set({ supplier: e.target.value })}
              placeholder="Nome do fornecedor"
            />
          </div>
          <div className="gf-field">
            <label className="gf-field-label">Categoria</label>
            <select
              className="styled-select-sm"
              value={form.category}
              onChange={e => set({ category: e.target.value })}
            >
              <option value="">— categoria —</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="gf-field">
            <label className="gf-field-label">Descrição</label>
            <textarea
              className="gf-field-textarea"
              value={form.description}
              onChange={e => set({ description: e.target.value })}
              placeholder="Objecto do contrato…"
            />
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Valor Total *</label>
              <input
                className="gf-field-input"
                type="number"
                value={form.total_amount}
                onChange={e => set({ total_amount: e.target.value })}
                placeholder="0"
              />
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
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Taxa Câmbio</label>
              <input
                className="gf-field-input"
                type="number"
                value={form.exchange_rate_ref}
                onChange={e => set({ exchange_rate_ref: e.target.value })}
                placeholder="1.0"
              />
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Data Adjudicação</label>
              <input
                className="gf-field-input"
                type="date"
                value={form.award_date}
                onChange={e => set({ award_date: e.target.value })}
              />
            </div>
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Data Fim</label>
              <input
                className="gf-field-input"
                type="date"
                value={form.end_date}
                onChange={e => set({ end_date: e.target.value })}
              />
            </div>
            <div className="gf-field" />
          </div>
        </div>
      )}
    </Modal>
  )
}
