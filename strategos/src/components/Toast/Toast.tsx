import './Toast.css'
import { useToast } from '../../context/ToastContext'

const ICONS: Record<string, string> = {
  success: '✓',
  error:   '×',
  warning: '!',
  info:    'i',
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
          <button className="toast-close" onClick={() => hideToast(t.id)} aria-label="Fechar">✕</button>
        </div>
      ))}
    </div>
  )
}
