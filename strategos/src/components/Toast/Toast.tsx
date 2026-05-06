import './Toast.css'
import { useToast } from '../../context/ToastContext'
import { Check, X, AlertTriangle, Info } from 'lucide-react'

const ICONS = {
  success: <Check size={14} strokeWidth={1.5} />,
  error:   <X size={14} strokeWidth={1.5} />,
  warning: <AlertTriangle size={14} strokeWidth={1.5} />,
  info:    <Info size={14} strokeWidth={1.5} />,
}

export function ToastList() {
  const { toasts, hideToast } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className={`toast-icon toast-icon--${t.type}`}>{ICONS[t.type]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => hideToast(t.id)} aria-label="Fechar"><X size={14} strokeWidth={1.5} /></button>
        </div>
      ))}
    </div>
  )
}
