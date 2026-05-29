import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PAPEIS } from './usuarios/_consts'
import ModalDetalhes from './usuarios/ModalDetalhes'
import NovoUsuarioForm from './usuarios/NovoUsuarioForm'
import EditarUsuarioForm from './usuarios/EditarUsuarioForm'

export default function UsuariosConfig() {
  const { perfil: meuperfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])
  const [areas, setAreas] = useState([])
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNovo, setShowNovo] = useState(false)
  const [selecionado, setSelecionado] = useState(null)
  const [editando, setEditando] = useState(false)

  useEffect(() => { loadDados() }, [])

  async function loadDados() {
    setLoading(true)
    const [{ data: us }, { data: cls }, { data: ars }, { data: projs }] = await Promise.all([
      supabase.from('perfis').select('*, clientes(id, nome)').order('nome'),
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase.from('areas').select('id, nome, projeto_id').order('nome'),
      supabase.from('projetos').select('id, nome, ativo, cliente_id, clientes(nome)').order('nome'),
    ])
    setUsuarios(us || [])
    setClientes(cls || [])
    setAreas(ars || [])
    setProjetos(projs || [])
    setLoading(false)
  }

  async function suspenderUsuario(u) {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'suspend', user_id: u.id, ativo_atual: u.ativo !== false }
    })
    if (error || data?.error) alert(data?.error || 'Erro ao atualizar')
    setSelecionado(prev => prev ? { ...prev, ativo: prev.ativo === false } : null)
    loadDados()
  }

  function fecharModal() { setSelecionado(null); setEditando(false) }

  if (loading) return <div className="cfg-loading"><div className="spinner"/></div>

  return (
    <div className="cfg-section">
      <div className="cfg-section-hdr">
        <div>
          <div className="cfg-section-title">Usuários</div>
          <div className="cfg-section-sub">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn-cfg-add" onClick={() => { setShowNovo(true); setSelecionado(null) }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Usuário
        </button>
      </div>

      {showNovo && (
        <NovoUsuarioForm
          clientes={clientes} areas={areas} projetos={projetos}
          onSave={() => { setShowNovo(false); loadDados() }}
          onCancel={() => setShowNovo(false)}
        />
      )}

      {/* Lista de usuários */}
      <div className="usuarios-lista">
        {usuarios.map(u => {
          const papel = PAPEIS.find(p => p.value === u.papel)
          const suspenso = u.ativo === false
          return (
            <div key={u.id}
              className={`usuario-card-v2 ${suspenso ? 'suspenso' : ''}`}
              onClick={() => { setSelecionado(u); setEditando(false); setShowNovo(false) }}>
              <div className="usuario-avatar" style={{ background: suspenso ? '#6B7280' : (papel?.cor || 'var(--gold)') }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : (u.nome?.[0]?.toUpperCase() || '?')}
              </div>
              <div className="usuario-info">
                <div className="usuario-nome">
                  {u.nome}
                  {u.id === meuperfil?.id && <span className="badge-voce">você</span>}
                  {suspenso && <span className="badge-inativo">Suspenso</span>}
                </div>
                <div className="usuario-email">{u.email}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                  <span className="usuario-papel-badge" style={{ background: papel?.cor + '18', color: papel?.cor, border: `1px solid ${papel?.cor}33` }}>
                    {papel?.label || u.papel}
                  </span>
                </div>
              </div>
              <svg className="usuario-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          )
        })}
        {!usuarios.length && <div className="cfg-empty">Nenhum usuário cadastrado.</div>}
      </div>

      {/* Modal de detalhes / edição */}
      {selecionado && (
        <div className="usr-modal-overlay" onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="usr-modal">
            {editando ? (
              <EditarUsuarioForm
                usuario={selecionado}
                clientes={clientes} areas={areas} projetos={projetos}
                onSave={() => { setEditando(false); setSelecionado(null); loadDados() }}
                onCancel={() => setEditando(false)}
              />
            ) : (
              <ModalDetalhes
                usuario={selecionado}
                meuperfil={meuperfil}
                projetos={projetos}
                areas={areas}
                onEditar={() => setEditando(true)}
                onSuspender={() => suspenderUsuario(selecionado)}
                onFechar={fecharModal}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// MODAL DE DETALHES (visualização)
// ══════════════════════════════════════════════════════
