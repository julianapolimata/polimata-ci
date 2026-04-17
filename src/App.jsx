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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
    </Routes>
  )
}
