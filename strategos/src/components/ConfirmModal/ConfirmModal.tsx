import './ConfirmModal.css'
import Modal from '../Modal/Modal'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <button className="btn" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button
            className={destructive ? 'btn-danger' : 'btn-primary'}
            onClick={() => { void onConfirm() }}
            disabled={loading}
          >
            {loading ? 'A processar…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="cm-message">{message}</p>
    </Modal>
  )
}
