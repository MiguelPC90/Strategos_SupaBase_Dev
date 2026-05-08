import './ItemDetailModal.css'
import Modal from '../Modal/Modal'
import Badge from '../Badge/Badge'
import type { PdsItem } from '../../types/index'
import { fmtDate, displayStatus, statusVariant, renderText } from '../../lib/pdsHelpers'

interface ItemDetailModalProps {
  item: PdsItem
  onClose: () => void
}

export default function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
  const rawTitle = item.text.replace(/\*\*/g, '')
  const title = rawTitle.length > 60 ? rawTitle.slice(0, 60) + '…' : rawTitle
  const dateToShow = item.target_date ?? item.date ?? null
  const ds = displayStatus(item)
  return (
    <Modal isOpen onClose={onClose} title={title} width={720}>
      <div className="pds-item-modal-text">{renderText(item.text)}</div>
      <div className="pds-item-modal-meta">
        {item.created_at && (
          <div className="pds-item-modal-row">
            <span className="pds-item-modal-label">Criado em</span>
            <span>{fmtDate(item.created_at.slice(0, 10))}</span>
          </div>
        )}
        {dateToShow && (
          <div className="pds-item-modal-row">
            <span className="pds-item-modal-label">Data objectivo</span>
            <span>{fmtDate(dateToShow)}</span>
          </div>
        )}
        {ds && (
          <div className="pds-item-modal-row">
            <span className="pds-item-modal-label">Estado</span>
            <Badge variant={statusVariant(ds)}>{ds}</Badge>
          </div>
        )}
        {item.author && (
          <div className="pds-item-modal-row">
            <span className="pds-item-modal-label">Autor</span>
            <span>{item.author}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
