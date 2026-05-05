import { useMemo } from 'react'
import Modal from '../Modal/Modal'
import type { FinContract } from '../../types/index'

export interface InvoiceForm {
  id: string | null
  ref: string
  supplier: string
  app_contract_id: string
  doc_type: string
  amount: string
  currency: string
  exchange_rate: string
  issue_date: string
  due_date: string
  payment_date: string
  status: string
}

interface CurrencyOption { code: string; symbol: string }

const DOC_TYPES    = ['Factura', 'Recibo', 'Nota de Crédito', 'Pró-forma', 'Outro']
const INV_STATUSES = ['Prevista', 'Recebida', 'Aprovada', 'Paga', 'Rejeitada']

interface FacturaModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  onDelete?: () => void
  form: InvoiceForm | null
  setForm: (f: InvoiceForm) => void
  contracts: FinContract[]
  currencies: CurrencyOption[]
  supplierFilter: string
  setSupplierFilter: (s: string) => void
  errorMessage?: string | null
}

export default function FacturaModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  form,
  setForm,
  contracts,
  currencies,
  supplierFilter,
  setSupplierFilter,
  errorMessage,
}: FacturaModalProps) {
  const set = (patch: Partial<InvoiceForm>) => form && setForm({ ...form, ...patch })

  const suppliers = useMemo(() => {
    const seen = new Set(contracts.map(c => c.supplier).filter(Boolean))
    return Array.from(seen).sort()
  }, [contracts])

  const filteredContracts = supplierFilter
    ? contracts.filter(c => c.supplier === supplierFilter)
    : contracts

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={form?.id ? 'Editar Factura' : 'Nova Factura'}
      width={500}
      footer={
        <>
          {onDelete && (
            <button className="btn-danger" onClick={onDelete} style={{ marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={onSave}>Guardar</button>
          {errorMessage && <span className="gf-panel-err">{errorMessage}</span>}
        </>
      }
    >
      {form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Fornecedor</label>
              <select
                className="styled-select-sm"
                value={supplierFilter}
                onChange={e => {
                  setSupplierFilter(e.target.value)
                  set({ app_contract_id: '', supplier: e.target.value })
                }}
              >
                <option value="">— fornecedor —</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Contrato</label>
              <select
                className="styled-select-sm"
                value={form.app_contract_id}
                onChange={e => {
                  const c = contracts.find(x => x.app_id === e.target.value)
                  set({ app_contract_id: e.target.value, ...(c ? { supplier: c.supplier } : {}) })
                }}
                disabled={!supplierFilter}
              >
                <option value="">— contrato —</option>
                {filteredContracts.map(c => (
                  <option key={c.app_id} value={c.app_id}>{c.description || c.supplier}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Referência</label>
              <input
                className="gf-field-input"
                value={form.ref}
                onChange={e => set({ ref: e.target.value })}
                placeholder="Nº da factura"
              />
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Tipo Doc.</label>
              <select
                className="styled-select-sm"
                value={form.doc_type}
                onChange={e => set({ doc_type: e.target.value })}
              >
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Montante *</label>
              <input
                className="gf-field-input"
                type="number"
                value={form.amount}
                onChange={e => set({ amount: e.target.value })}
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
              <label className="gf-field-label">Data Emissão</label>
              <input
                className="gf-field-input"
                type="date"
                value={form.issue_date}
                onChange={e => set({ issue_date: e.target.value })}
              />
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Data Vencimento</label>
              <input
                className="gf-field-input"
                type="date"
                value={form.due_date}
                onChange={e => set({ due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="gf-field-row">
            <div className="gf-field">
              <label className="gf-field-label">Data Pagamento</label>
              <input
                className="gf-field-input"
                type="date"
                value={form.payment_date}
                onChange={e => set({ payment_date: e.target.value })}
              />
            </div>
            <div className="gf-field">
              <label className="gf-field-label">Estado</label>
              <select
                className="styled-select-sm"
                value={form.status}
                onChange={e => set({ status: e.target.value })}
              >
                {INV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
