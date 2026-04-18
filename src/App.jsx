import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useState, useEffect } from 'react'
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
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #C8895C', background: '#C8895C', color: '#fff', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
          >
            Recarregar página
          </button>
        </div>
      )}
    </div>
  )
}

function PasswordSetupModal() {
  const { updatePassword } = useAuth()
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

  const S = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,32,62,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontFamily: "'Montserrat', sans-serif" },
    card: { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, overflow: 'hidden' },
    header: { background: '#00203E', padding: '24px 28px', textAlign: 'center' },
    body: { padding: '28px' },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #D0D0D0', borderRadius: 6, fontSize: 14, fontFamily: "'Montserrat', sans-serif", marginTop: 4, boxSizing: 'border-box' },
    btn: { width: '100%', padding: '12px', background: '#C8895C', color: '#fff', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", marginTop: 16 },
  }

  if (ok) return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.header}>
          <img src="/logotipo-branco.png" alt="Polímata" style={{ width: 160 }} />
        </div>
        <div style={{ ...S.body, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#10003;</div>
          <h3 style={{ color: '#00203E', margin: '0 0 8px', fontSize: 16 }}>Senha configurada!</h3>
          <p style={{ color: '#666', fontSize: 13 }}>Seu acesso está pronto. Bem-vindo(a) ao Polímata GRC.</p>
          <button onClick={() => window.location.reload()} style={S.btn}>Acessar o Sistema</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.header}>
          <img src="/logotipo-branco.png" alt="Polímata" style={{ width: 160 }} />
        </div>
        <div style={S.body}>
          <h3 style={{ color: '#00203E', margin: '0 0 4px', fontSize: 16 }}>Configure sua senha</h3>
          <p style={{ color: '#888', fontSize: 12, margin: '0 0 20px' }}>Crie uma senha para acessar o sistema Polímata GRC.</p>
          {erro && <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', color: '#C62828', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>{erro}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#444' }}>Nova senha</label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={S.input} placeholder="Mínimo 6 caracteres" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#444' }}>Confirmar senha</label>
              <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={S.input} placeholder="Repita a senha" />
            </div>
            <button type="submit" disabled={saving} style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Criar Senha e Acessar'}
            </button>
          </form>
        </div>
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

  return (
    <>
      {needsPasswordSetup && <PasswordSetupModal />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      </Routes>
    </>
  )
}
