import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [erro, setErro]         = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await signIn(email, senha)
    if (error) setErro('Email ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg" width="36">
              <path d="M7 5 L7 45" stroke="#CC915E" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M7 5 Q26 5 26 16 Q26 27 7 27" stroke="#CC915E" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
              <path d="M7 27 Q22 27 22 36 Q22 45 7 45" stroke="#A6512F" strokeWidth="3" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <div>
            <div className="login-brand">Polímata</div>
            <div className="login-brand-sub">Consultoria em GRC</div>
          </div>
        </div>

        <div className="login-divider" />

        <h1 className="login-title">Acesse sua conta</h1>
        <p className="login-subtitle">Sistema de Controles Internos</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {erro && <div className="login-erro">{erro}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          Polímata Consultoria em GRC · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
