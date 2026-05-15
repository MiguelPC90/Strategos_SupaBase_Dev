import './ForgotPasswordModal.css'
import { useState } from 'react'
import Modal from '../Modal/Modal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

interface ForgotPasswordModalProps {
  open: boolean
  onClose: () => void
}

export default function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!email.trim() || !email.includes('@')) {
      showToast('Email inválido', 'error')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      showToast('Email enviado. Verifica a tua caixa de entrada.', 'success')
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro a enviar email'
      showToast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  function handleClose() {
    setEmail('')
    onClose()
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Recuperar palavra-passe"
      width={420}
      footer={
        <>
          <button className="btn" onClick={handleClose}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? 'A enviar…' : 'Enviar'}
          </button>
        </>
      }
    >
      <p className="fpm-subtitle">
        Indica o teu email. Enviaremos-te um link para definir uma nova palavra-passe.
      </p>
      <div className="fpm-field">
        <label className="fpm-label" htmlFor="fpm-email">Email</label>
        <input
          id="fpm-email"
          className="fpm-input"
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="utilizador@org.pt"
          onKeyDown={e => { if (e.key === 'Enter' && !sending) void handleSend() }}
        />
      </div>
    </Modal>
  )
}
