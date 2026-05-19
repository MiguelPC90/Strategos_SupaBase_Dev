import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './NotFound.css'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="notfound-page">
      <div className="notfound-content">
        <h1 className="notfound-code">404</h1>
        <h2 className="notfound-title">Página não encontrada</h2>
        <p className="notfound-message">
          A página que procura não existe ou foi movida.
        </p>
        <div className="notfound-actions">
          <button
            className="notfound-btn-back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <button
            className="notfound-btn-primary"
            onClick={() => navigate('/dashboard')}
          >
            Ir para Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
