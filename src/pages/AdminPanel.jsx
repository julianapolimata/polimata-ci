import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ClientesConfig from './config/ClientesConfig'
import ProjetosConfig from './config/ProjetosConfig'
import UsuariosConfig from './config/UsuariosConfig'
import AuditLogConfig from './config/AuditLogConfig'
import '../styles/admin.css'

const MENU = [
  { id: 'clientes',  label: 'Clientes',       icon: '◎', desc: 'Cadastro e gestão de clientes' },
  { id: 'projetos',  label: 'Projetos',        icon: '◆', desc: 'Projetos, áreas e estrutura' },
  { id: 'usuarios',  label: 'Usuários',        icon: '◈', desc: 'Contas, papéis e permissões' },
  { id: 'auditoria', label: 'Log de Auditoria', icon: '◉', desc: 'Histórico de alterações e ações' },
]

export default function AdminPanel() {
  const navigate = useNavigate()
  const location = useLocation()
  const [secao, setSecao] = useState('clientes')
  const [projetoIdAbrir, setProjetoIdAbrir] = useState(null)

  function abrirProjeto(projetoId) {
    setProjetoIdAbrir(projetoId)
    setSecao('projetos')
  }

  return (
    <div className="adm-layout">
      {/* Sidebar do admin */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-logo">
          <img src="/logotipo-2cores.png" alt="Polímata" style={{ width: '100%', maxWidth: 160, height: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="adm-sidebar-hdr">
          <button className="adm-voltar" onClick={() => navigate('/ci')} title="Voltar ao projeto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
            <span>Voltar</span>
          </button>
          <div className="adm-sidebar-title">Administração</div>
          <div className="adm-sidebar-sub">Configurações da plataforma</div>
        </div>
        <nav className="adm-nav">
          {MENU.map(m => (
            <button
              key={m.id}
              className={`adm-nav-item${secao === m.id ? ' active' : ''}`}
              onClick={() => { setSecao(m.id); if (m.id !== 'projetos') setProjetoIdAbrir(null) }}
            >
              <span className="adm-nav-icon">{m.icon}</span>
              <div className="adm-nav-text">
                <div className="adm-nav-label">{m.label}</div>
                <div className="adm-nav-desc">{m.desc}</div>
              </div>
            </button>
          ))}
        </nav>
        <div className="adm-sidebar-ftr">
          <div className="adm-sidebar-ftr-txt">Polímata GRC</div>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="adm-main">
        <div className="adm-content">
          <div className="adm-page-hdr">
            <div className="adm-page-eye">POLÍMATA · ADMINISTRAÇÃO</div>
            <h1 className="adm-page-title">
              {MENU.find(m => m.id === secao)?.label || 'Admin'}
            </h1>
            <p className="adm-page-sub">
              {MENU.find(m => m.id === secao)?.desc}
            </p>
          </div>
          <div className="adm-body">
            {secao === 'clientes' && <ClientesConfig onAbrirProjeto={abrirProjeto} />}
            {secao === 'projetos' && <ProjetosConfig projetoIdInicial={projetoIdAbrir} />}
            {secao === 'usuarios' && <UsuariosConfig />}
            {secao === 'auditoria' && <AuditLogConfig />}
          </div>
        </div>
      </main>
    </div>
  )
}
