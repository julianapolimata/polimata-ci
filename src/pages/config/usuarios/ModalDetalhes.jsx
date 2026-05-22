// ModalDetalhes — extraído de UsuariosConfig.jsx em 22/mai/2026 (fatiamento Etapa 8).
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatNomeEmpresa } from '../../../lib/formatNome'
import { PAPEIS } from './_consts'

function ModalDetalhes({ usuario, meuperfil, projetos, areas, onEditar, onSuspender, onFechar }) {
  const papel = PAPEIS.find(p => p.value === usuario.papel)
  const suspenso = usuario.ativo === false
  const criadoEm = usuario.criado_em ? new Date(usuario.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const isMe = usuario.id === meuperfil?.id

  const [permAreas, setPermAreas] = useState([])
  const [permProjetos, setPermProjetos] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('permissoes_area').select('area_id').eq('perfil_id', usuario.id),
      supabase.from('perfis_projetos').select('projeto_id').eq('perfil_id', usuario.id),
    ]).then(([{ data: pa }, { data: pp }]) => {
      setPermAreas((pa || []).map(x => x.area_id))
      setPermProjetos((pp || []).map(x => x.projeto_id))
    })
  }, [usuario.id])

  const nomesAreas = permAreas.map(id => areas.find(a => a.id === id)?.nome).filter(Boolean)
  const nomesProjetos = permProjetos.map(id => projetos.find(p => p.id === id)?.nome).filter(Boolean)

  return (
    <>
      {/* Header */}
      <div className="usr-modal-header">
        <div className="usr-modal-title">Detalhes do Usuário</div>
        <button className="usr-modal-close" onClick={onFechar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Body */}
      <div className="usr-modal-body">
        {/* Perfil do usuário */}
        <div className="usr-profile-section">
          <div className="usr-avatar-lg" style={{ background: suspenso ? '#6B7280' : (papel?.cor || 'var(--gold)') }}>
            {usuario.avatar_url
              ? <img src={usuario.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : (usuario.nome?.[0]?.toUpperCase() || '?')}
          </div>
          <div>
            <div className="usr-profile-name">
              {usuario.nome}
              {suspenso && <span className="badge-inativo" style={{ marginLeft: 8 }}>Suspenso</span>}
            </div>
            <div className="usr-profile-email">{usuario.email}</div>
            <span className="usuario-papel-badge" style={{ background: papel?.cor + '18', color: papel?.cor, border: `1px solid ${papel?.cor}33`, marginTop: 6, display: 'inline-block' }}>
              {papel?.label || usuario.papel}
            </span>
          </div>
        </div>

        <div className="usr-modal-divider" />

        {/* Grid de informações */}
        <div className="usr-info-grid">
          <div className="usr-info-cell">
            <div className="usr-info-label">Usuário</div>
            <div className="usr-info-value">{usuario.email?.split('@')[0] || '—'}</div>
          </div>
          <div className="usr-info-cell">
            <div className="usr-info-label">Cadastrado em</div>
            <div className="usr-info-value">{criadoEm}</div>
          </div>
          <div className="usr-info-cell">
            <div className="usr-info-label">Status</div>
            <div className="usr-info-value">
              <span className={`status-dot ${suspenso ? 'inativo' : 'ativo'}`} />
              {suspenso ? 'Suspenso' : 'Ativo'}
            </div>
          </div>
          <div className="usr-info-cell">
            <div className="usr-info-label">Perfil</div>
            <div className="usr-info-value" style={{ color: papel?.cor, fontWeight: 600 }}>{papel?.label || usuario.papel}</div>
          </div>
        </div>

        {/* Permissões */}
        <div className="usr-perms-box" style={{ borderLeftColor: papel?.cor }}>
          <div className="usr-perms-title">Permissões deste perfil</div>
          {papel?.pode?.map((p, i) => (
            <div key={i} className="usr-perm-item">
              <span className="usr-perm-dot" style={{ background: papel?.cor }} /> {p}
            </div>
          ))}
        </div>

        {/* Vinculações */}
        <div className="usr-vinculos">
          {usuario.clientes?.nome && (
            <div className="usr-info-cell">
              <div className="usr-info-label">Cliente</div>
              <div className="usr-info-value">{formatNomeEmpresa(usuario.clientes.nome_fantasia || usuario.clientes.nome)}</div>
            </div>
          )}
          {usuario.papel === 'admin_polimata' && (
            <div className="usr-info-cell">
              <div className="usr-info-label">Acesso</div>
              <div className="usr-info-value" style={{ color: 'var(--gold)', fontWeight: 600 }}>Todos os clientes e projetos</div>
            </div>
          )}
          {nomesProjetos.length > 0 && (
            <div className="usr-info-cell" style={{ gridColumn: '1 / -1' }}>
              <div className="usr-info-label">Projetos vinculados</div>
              <div className="usr-tags">{nomesProjetos.map((n, i) => <span key={i} className="usr-tag">{n}</span>)}</div>
            </div>
          )}
          {usuario.papel === 'usuario_cliente' && (
            <div className="usr-info-cell" style={{ gridColumn: '1 / -1' }}>
              <div className="usr-info-label">Áreas</div>
              <div className="usr-info-value">
                {usuario.acesso_todas_areas ? 'Todas as áreas' : (nomesAreas.length > 0
                  ? <div className="usr-tags">{nomesAreas.map((n, i) => <span key={i} className="usr-tag">{n}</span>)}</div>
                  : 'Nenhuma área atribuída')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer com ações */}
      {!isMe && (
        <div className="usr-modal-footer">
          <button className="usr-btn primary" onClick={onEditar}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <div style={{ flex: 1 }} />
          <button className="usr-btn warning" onClick={onSuspender}>
            {suspenso ? '↺ Reativar' : '⊘ Suspender'}
          </button>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════
// FORMULÁRIO NOVO USUÁRIO
// ══════════════════════════════════════════════════════

export default ModalDetalhes
