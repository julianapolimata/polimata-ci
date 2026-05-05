import { useState } from 'react'
import ClientesConfig from './config/ClientesConfig'
import ProjetosConfig from './config/ProjetosConfig'
import UsuariosConfig from './config/UsuariosConfig'
import { useAuth } from '../contexts/AuthContext'
import '../styles/config.css'

export default function Configuracoes() {
  const { perfil } = useAuth()

  const TABS = [
    { id: 'clientes', label: 'Clientes', icon: '◎' },
    { id: 'projetos', label: 'Projetos', icon: '◆' },
    { id: 'usuarios', label: 'Usuários', icon: '◈' },
  ]

  const [tab, setTab] = useState('clientes')
  const [projetoIdAbrir, setProjetoIdAbrir] = useState(null)

  function abrirProjeto(projetoId) {
    setProjetoIdAbrir(projetoId)
    setTab('projetos')
  }

  return (
    <div className="cfg-wrap">
      <div className="cfg-hdr">
        <div>
          <div className="dash-eye" style={{ marginBottom: 6 }}>POLÍMATA · CONFIGURAÇÕES</div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 300, fontFamily: "'Raleway', sans-serif", color: 'var(--lt-text)', letterSpacing: 0.3, margin: 0 }}>Gestão de clientes, projetos e usuários</h1>
        </div>
      </div>

      <div className="cfg-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cfg-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); if (t.id !== 'projetos') setProjetoIdAbrir(null) }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="cfg-body">
        {tab === 'clientes' && <ClientesConfig onAbrirProjeto={abrirProjeto} />}
        {tab === 'projetos' && <ProjetosConfig projetoIdInicial={projetoIdAbrir} />}
        {tab === 'usuarios' && <UsuariosConfig />}
      </div>
    </div>
  )
}
