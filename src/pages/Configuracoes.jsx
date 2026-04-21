import { useState } from 'react'
import ClientesConfig from './config/ClientesConfig'
import UsuariosConfig from './config/UsuariosConfig'
import FerramentasConfig from './config/FerramentasConfig'
import { useAuth } from '../contexts/AuthContext'
import '../styles/config.css'

export default function Configuracoes() {
  const { perfil } = useAuth()
  const isAdmin = perfil?.papel === 'admin_polimata'

  const TABS = [
    { id: 'clientes', label: 'Clientes', icon: '◎' },
    { id: 'usuarios', label: 'Usuários', icon: '◈' },
    ...(isAdmin ? [{ id: 'ferramentas', label: 'Ferramentas', icon: '⚡' }] : []),
  ]

  const [tab, setTab] = useState('clientes')

  return (
    <div className="cfg-wrap">
      <div className="cfg-hdr">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Gestão de clientes, projetos, áreas e usuários</p>
        </div>
      </div>

      <div className="cfg-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cfg-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="cfg-body">
        {tab === 'clientes' && <ClientesConfig />}
        {tab === 'usuarios' && <UsuariosConfig />}
        {tab === 'ferramentas' && isAdmin && <FerramentasConfig />}
      </div>
    </div>
  )
}
