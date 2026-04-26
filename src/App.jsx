import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useState, useEffect } from 'react'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Dashboard from './pages/Dashboard'

function LoadingScreen() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="loading-screen">
      <div className="spinner" />
      {slow && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ color: '#8b9cb6', fontSize: 13, marginBottom: 12 }}>Carregando...</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #CC915E', background: '#CC915E', color: '#fff', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
          >
            Recarregar página
          </button>
        </div>
      )}
    </div>
  )
}

function PasswordSetupPage() {
  const { updatePassword, signOut } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (pw.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres'); return }
    if (pw !== pw2) { setErro('As senhas não coincidem'); return }
    setSaving(true); setErro('')
    const { error } = await updatePassword(pw)
    if (error) { setErro(error.message); setSaving(false) }
    else setOk(true)
  }

  async function handleAcessar() {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img src="/icon.png" alt="Polímata" style={{ height: 80, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="login-divider" />
        {ok ? (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8, color: 'var(--res-ef)' }}>&#10003;</div>
              <h1 className="login-title" style={{ marginBottom: 6 }}>Senha configurada!</h1>
              <p className="login-subtitle">Seu acesso está pronto. Faça login para acessar o sistema.</p>
            </div>
            <button onClick={handleAcessar} className="login-btn" style={{ width: '100%', marginTop: 16 }}>
              Ir para o Login
            </button>
          </>
        ) : (
          <>
            <h1 className="login-title">Configure sua senha</h1>
            <p className="login-subtitle">Crie uma senha para acessar o sistema Polímata GRC</p>
            {erro && <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C62828', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>{erro}</div>}
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label>Nova senha</label>
                <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus required />
              </div>
              <div className="login-field">
                <label>Confirmar senha</label>
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Repita a senha" required />
              </div>
              <button type="submit" disabled={saving} className="login-btn" style={{ width: '100%', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Criar Senha e Acessar'}
              </button>
            </form>
          </>
        )}
        <div className="login-footer">Polímata Consultoria em GRC · {new Date().getFullYear()}</div>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user, loading, needsPasswordSetup } = useAuth()
  if (loading) return <LoadingScreen />

  if (needsPasswordSetup) return <PasswordSetupPage />

  return (
    <ToastProvider>
      <ConfirmProvider>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        </Routes>
      </ConfirmProvider>
    </ToastProvider>
  )
}
