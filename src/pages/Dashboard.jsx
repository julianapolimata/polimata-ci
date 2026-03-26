import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Configuracoes from './Configuracoes'

export default function Dashboard() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [projetos, setProjetos] = useState([])
  const [projetoAtivo, setProjetoAtivo] = useState(null)

  useEffect(() => { loadProjetos() }, [])

  async function loadProjetos() {
    const { data } = await supabase
      .from('projetos')
      .select('*, clientes(nome, slug)')
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
    if (data) {
      setProjetos(data)
      if (data.length > 0) setProjetoAtivo(data[0])
    }
  }

  const isAdmin = perfil?.papel === 'admin_polimata'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-brand" style={{ padding: '20px 16px 16px', justifyContent: 'center' }}>
          <img
            src="/logotipo-2cores.png"
            alt="Polímata"
            style={{ height: 38, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {projetos.length > 0 && (
          <div className="sb-projeto">
            <div className="sb-projeto-label">Projeto ativo</div>
            <select
              className="sb-projeto-sel"
              value={projetoAtivo?.id || ''}
              onChange={e => setProjetoAtivo(projetos.find(p => p.id === e.target.value))}
            >
              {projetos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.clientes?.nome} · {p.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="sb-nav">
          <NavItem icon="⊞" label="Dashboard" active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon="⊟" label="MRC Completa" active={location.pathname === '/mrc'} onClick={() => navigate('/mrc')} />
          {isAdmin && (
            <>
              <div className="sb-sep">Administração</div>
              <NavItem icon="◎" label="Clientes" active={location.pathname === '/clientes'} onClick={() => navigate('/clientes')} />
              <NavItem icon="◈" label="Usuários" active={location.pathname === '/usuarios'} onClick={() => navigate('/usuarios')} />
              <NavItem icon="⚙" label="Configurações" active={location.pathname.startsWith('/configuracoes')} onClick={() => navigate('/configuracoes')} />
            </>
          )}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-user-avatar">{perfil?.nome?.[0]?.toUpperCase() || '?'}</div>
            <div>
              <div className="sb-user-nome">{perfil?.nome}</div>
              <div className="sb-user-papel">{papelLabel(perfil?.papel)}</div>
            </div>
          </div>
          <button className="sb-sair" onClick={signOut} title="Sair">↩</button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Home projeto={projetoAtivo} />} />
          <Route path="/mrc" element={<MRCPlaceholder projeto={projetoAtivo} />} />
          <Route path="/clientes" element={<ClientesPlaceholder />} />
          <Route path="/usuarios" element={<UsuariosPlaceholder />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
        </Routes>
      </main>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function papelLabel(papel) {
  const map = {
    admin_polimata: 'Admin Polímata',
    consultor_polimata: 'Consultor',
    gestor_cliente: 'Gestor',
    usuario_cliente: 'Usuário',
  }
  return map[papel] || papel || '—'
}

function Home({ projeto }) {
  return (
    <div className="page-wrap">
      <div className="page-hdr">
        <h1 className="page-title">Dashboard</h1>
        {projeto && <span className="page-badge">{projeto.clientes?.nome} · {projeto.nome}</span>}
      </div>
      <div className="empty-state">
        <div className="empty-icon">◎</div>
        <div className="empty-title">Dashboard em construção</div>
        <div className="empty-desc">Em breve: índice de maturidade, mapa de calor e KPIs por área.</div>
      </div>
    </div>
  )
}

function MRCPlaceholder({ projeto }) {
  return (
    <div className="page-wrap">
      <div className="page-hdr">
        <h1 className="page-title">MRC Completa</h1>
        {projeto && <span className="page-badge">{projeto.clientes?.nome} · {projeto.nome}</span>}
      </div>
      <div className="empty-state">
        <div className="empty-icon">⊟</div>
        <div className="empty-title">Matriz em construção</div>
        <div className="empty-desc">A MRC completa será carregada do Supabase aqui.</div>
      </div>
    </div>
  )
}

function ClientesPlaceholder() {
  return (
    <div className="page-wrap">
      <div className="page-hdr"><h1 className="page-title">Clientes</h1></div>
      <div className="empty-state">
        <div className="empty-icon">◎</div>
        <div className="empty-title">Gestão de clientes</div>
        <div className="empty-desc">Cadastro e configuração de clientes em construção.</div>
      </div>
    </div>
  )
}

function UsuariosPlaceholder() {
  return (
    <div className="page-wrap">
      <div className="page-hdr"><h1 className="page-title">Usuários</h1></div>
      <div className="empty-state">
        <div className="empty-icon">◈</div>
        <div className="empty-title">Gestão de usuários</div>
        <div className="empty-desc">Cadastro e permissões de usuários em construção.</div>
      </div>
    </div>
  )
}
