import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const PAPEIS = [
  { value: 'admin_polimata',     label: 'Admin Polímata',     desc: 'Acesso total a todos os clientes e configurações', cor: '#CC915E',
    pode: ['Visualizar todos os clientes e projetos', 'Criar e gerenciar usuários', 'Editar todas as análises', 'Configurar o sistema'] },
  { value: 'consultor_polimata', label: 'Consultor Polímata', desc: 'Edita análises, faz upload de fichas, baixa relatórios', cor: '#3B82F6',
    pode: ['Editar análises nos projetos vinculados', 'Upload de fichas e documentos', 'Download de relatórios'] },
  { value: 'gestor_cliente',     label: 'Gestor do Cliente',  desc: 'Vê todas as áreas do projeto, somente consulta e download', cor: '#22C55E',
    pode: ['Visualizar todas as áreas do projeto', 'Download de relatórios', 'Consulta somente (sem edição)'] },
  { value: 'usuario_cliente',    label: 'Usuário Cliente',    desc: 'Acesso às áreas atribuídas, somente consulta e download', cor: '#A78BFA',
    pode: ['Visualizar áreas atribuídas', 'Download de relatórios', 'Consulta somente (sem edição)'] },
]

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

  async function excluirUsuario(u) {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o usuário "${u.nome}"?\n\nEssa ação não pode ser desfeita.`)) return
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'delete', user_id: u.id }
    })
    if (error || data?.error) alert(data?.error || 'Erro ao excluir')
    else { setSelecionado(null); setEditando(false); loadDados() }
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
                onExcluir={() => excluirUsuario(selecionado)}
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
function ModalDetalhes({ usuario, meuperfil, projetos, areas, onEditar, onSuspender, onExcluir, onFechar }) {
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
              <div className="usr-info-value">{usuario.clientes.nome}</div>
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
          <button className="usr-btn danger" onClick={onExcluir}>✕ Excluir</button>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════
// FORMULÁRIO NOVO USUÁRIO
// ══════════════════════════════════════════════════════
function NovoUsuarioForm({ clientes, areas, projetos, onSave, onCancel }) {
  const [form, setForm] = useState({ nome: '', email: '', papel: 'usuario_cliente', acesso_todas_areas: true })
  const [clientesSel, setClientesSel] = useState([])
  const [projetosSel, setProjetosSel] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [areasSel, setAreasSel] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const isConsultor = form.papel === 'consultor_polimata'
  const precisaCliente = ['gestor_cliente', 'usuario_cliente'].includes(form.papel)
  const projetosDoCliente = projetos.filter(p => p.cliente_id === clienteId)
  const areasDoProj = areas.filter(a => a.projeto_id === projetoId)
  const projetosDisponiveis = clientesSel.length > 0 ? projetos.filter(p => clientesSel.includes(p.cliente_id)) : projetos
  const papelSel = PAPEIS.find(p => p.value === form.papel)

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) { setErro('Nome e email são obrigatórios'); return }
    if (isConsultor && clientesSel.length === 0) { setErro('Selecione pelo menos um cliente'); return }
    if (isConsultor && projetosSel.length === 0) { setErro('Selecione pelo menos um projeto'); return }
    if (precisaCliente && !clienteId) { setErro('Selecione o cliente'); return }
    if (precisaCliente && !projetoId) { setErro('Selecione o projeto'); return }
    setSaving(true); setErro('')
    try {
      const projetoRef = isConsultor
        ? projetos.find(p => projetosSel.includes(p.id))
        : projetos.find(p => p.id === projetoId)
      const pNome = projetoRef?.nome || 'Polímata GRC'
      const clienteRef = isConsultor
        ? clientes.find(c => clientesSel.includes(c.id))
        : clientes.find(c => c.id === clienteId)
      const cNome = clienteRef?.nome || ''

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          nome: form.nome.trim(),
          email: form.email.trim(),
          papel: form.papel,
          cliente_id: precisaCliente ? clienteId : null,
          projeto_id: precisaCliente ? projetoId : null,
          acesso_todas_areas: form.acesso_todas_areas,
          projetos_ids: isConsultor ? projetosSel : [],
          areas_ids: (form.papel === 'usuario_cliente' && !form.acesso_todas_areas) ? areasSel : [],
          projeto_nome: pNome,
          cliente_nome: cNome,
        }
      })
      if (error) throw new Error(error.message || 'Erro ao criar usuário')
      if (data?.error) throw new Error(data.error)

      setSucesso(`Usuário criado! Email de boas-vindas enviado para ${form.email}`)
      setTimeout(() => onSave(), 1500)
    } catch (e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-inline-form">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="cfg-group-title" style={{ fontSize: 13 }}>Novo Usuário</div>
        <button className="btn-cfg-remove" onClick={onCancel}>✕ Fechar</button>
      </div>
      {erro && <div className="cfg-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      {sucesso && <div className="cfg-sucesso" style={{ marginBottom: 12 }}>{sucesso}</div>}

      <div className="cfg-row2">
        <div className="cfg-field"><label>Nome Completo <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e => u('nome', e.target.value)} placeholder="Nome completo" /></div>
        <div className="cfg-field"><label>Email <span className="req">*</span></label><input className="input-light" type="email" value={form.email} onChange={e => u('email', e.target.value)} placeholder="email@empresa.com" /></div>
      </div>

      <div className="cfg-field">
        <label>Perfil de Acesso <span className="req">*</span></label>
        <select className="input-light" value={form.papel} onChange={e => u('papel', e.target.value)}>
          {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {papelSel && (
          <div className="perfil-resumo" style={{ borderLeftColor: papelSel.cor }}>
            <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>{papelSel.desc}</div>
            {papelSel.pode?.map((p, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--txt3)', padding: '1px 0', display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ color: papelSel.cor, fontSize: 10 }}>●</span> {p}
              </div>
            ))}
          </div>
        )}
      </div>

      {isConsultor && (
        <>
          <div className="cfg-field">
            <label>Clientes vinculados <span className="req">*</span></label>
            <div className="areas-check-grid">
              {clientes.map(c => (
                <label key={c.id} className="area-check">
                  <input type="checkbox" checked={clientesSel.includes(c.id)}
                    onChange={() => { setClientesSel(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]); setProjetosSel([]) }} />
                  <span>{c.nome}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="cfg-field">
            <label>Projetos vinculados <span className="req">*</span></label>
            <div style={{ fontSize: 10, color: 'var(--txt3)', marginBottom: 6 }}>Obrigatório — sem projeto selecionado o consultor não verá nada.</div>
            <div className="areas-check-grid">
              {projetosDisponiveis.map(p => (
                <label key={p.id} className="area-check">
                  <input type="checkbox" checked={projetosSel.includes(p.id)}
                    onChange={() => setProjetosSel(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} />
                  <span>{p.clientes?.nome} · {p.nome}</span>
                </label>
              ))}
              {projetosDisponiveis.length === 0 && <div className="cfg-empty">Selecione um cliente primeiro.</div>}
            </div>
          </div>
        </>
      )}

      {precisaCliente && (
        <div className="cfg-row2">
          <div className="cfg-field">
            <label>Cliente <span className="req">*</span></label>
            <select className="input-light" value={clienteId} onChange={e => { setClienteId(e.target.value); setProjetoId(''); setAreasSel([]) }}>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="cfg-field">
            <label>Projeto <span className="req">*</span></label>
            <select className="input-light" value={projetoId} onChange={e => { setProjetoId(e.target.value); setAreasSel([]) }} disabled={!clienteId}>
              <option value="">Selecione o projeto...</option>
              {projetosDoCliente.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>
      )}

      {form.papel === 'usuario_cliente' && projetoId && (
        <div className="cfg-field">
          <label>Acesso a Áreas</label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <label className="radio-opt"><input type="radio" checked={form.acesso_todas_areas} onChange={() => u('acesso_todas_areas', true)} /><span>Todas as áreas</span></label>
            <label className="radio-opt"><input type="radio" checked={!form.acesso_todas_areas} onChange={() => u('acesso_todas_areas', false)} /><span>Áreas específicas</span></label>
          </div>
          {!form.acesso_todas_areas && (
            <div className="areas-check-grid">
              {areasDoProj.map(a => (
                <label key={a.id} className="area-check">
                  <input type="checkbox" checked={areasSel.includes(a.id)} onChange={e => setAreasSel(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))} />
                  <span>{a.nome}</span>
                </label>
              ))}
              {!areasDoProj.length && <div className="cfg-empty">Nenhuma área cadastrada.</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving ? 'Criando...' : '✓ Criar Usuário'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FORMULÁRIO EDITAR USUÁRIO (dentro do modal)
// ══════════════════════════════════════════════════════
function EditarUsuarioForm({ usuario, clientes, areas, projetos, onSave, onCancel }) {
  const [form, setForm] = useState({
    nome: usuario.nome || '', email: usuario.email || '', papel: usuario.papel || 'usuario_cliente',
    acesso_todas_areas: usuario.acesso_todas_areas !== false
  })
  const [clientesSel, setClientesSel] = useState([])
  const [projetosSel, setProjetosSel] = useState([])
  const [clienteId, setClienteId] = useState(usuario.cliente_id || '')
  const [projetoId, setProjetoId] = useState(usuario.projeto_id || '')
  const [areasSel, setAreasSel] = useState([])
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const isConsultor = form.papel === 'consultor_polimata'
  const precisaCliente = ['gestor_cliente', 'usuario_cliente'].includes(form.papel)
  const projetosDoCliente = projetos.filter(p => p.cliente_id === clienteId)
  const areasDoProj = areas.filter(a => a.projeto_id === projetoId)
  const projetosDisponiveis = clientesSel.length > 0 ? projetos.filter(p => clientesSel.includes(p.cliente_id)) : projetos
  const papelSel = PAPEIS.find(p => p.value === form.papel)
  const criadoEm = usuario.criado_em ? new Date(usuario.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  useEffect(() => {
    Promise.all([
      supabase.from('permissoes_area').select('area_id').eq('perfil_id', usuario.id),
      supabase.from('perfis_projetos').select('projeto_id, projetos(cliente_id)').eq('perfil_id', usuario.id),
    ]).then(([{ data: perms }, { data: pprojs }]) => {
      setAreasSel((perms || []).map(p => p.area_id))
      setProjetosSel((pprojs || []).map(p => p.projeto_id))
      setClientesSel([...new Set((pprojs || []).map(p => p.projetos?.cliente_id).filter(Boolean))])
    })
  }, [])

  async function salvar() {
    setSaving(true); setErro('')
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'update',
          user_id: usuario.id,
          nome: form.nome,
          email: form.email !== usuario.email ? form.email : undefined,
          papel: form.papel,
          cliente_id: precisaCliente ? clienteId : null,
          projeto_id: precisaCliente ? projetoId : null,
          acesso_todas_areas: form.acesso_todas_areas,
          projetos_ids: isConsultor ? projetosSel : [],
          areas_ids: (form.papel === 'usuario_cliente' && !form.acesso_todas_areas) ? areasSel : [],
        }
      })
      if (error) throw new Error(error.message || 'Erro ao salvar')
      if (data?.error) throw new Error(data.error)
      onSave()
    } catch (e) { setErro(e.message); setSaving(false) }
  }

  return (
    <>
      <div className="usr-modal-header">
        <div className="usr-modal-title">Editar Usuário</div>
        <button className="usr-modal-close" onClick={onCancel}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="usr-modal-body">
        {erro && <div className="cfg-erro" style={{ marginBottom: 14 }}>{erro}</div>}

        {/* Read-only */}
        <div className="usr-info-grid" style={{ marginBottom: 18 }}>
          <div className="usr-info-cell">
            <div className="usr-info-label">Usuário</div>
            <div className="usr-info-value">{usuario.email?.split('@')[0] || '—'}</div>
          </div>
          <div className="usr-info-cell">
            <div className="usr-info-label">Cadastrado em</div>
            <div className="usr-info-value">{criadoEm}</div>
          </div>
        </div>

        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.nome} onChange={e => u('nome', e.target.value)} /></div>
          <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.email} onChange={e => u('email', e.target.value)} /></div>
        </div>

        <div className="cfg-field">
          <label>Perfil de Acesso</label>
          <select className="input-light" value={form.papel} onChange={e => u('papel', e.target.value)}>
            {PAPEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {papelSel && (
            <div className="perfil-resumo" style={{ borderLeftColor: papelSel.cor }}>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 4 }}>{papelSel.desc}</div>
              {papelSel.pode?.map((p, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--txt3)', padding: '1px 0', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ color: papelSel.cor, fontSize: 10 }}>●</span> {p}
                </div>
              ))}
            </div>
          )}
        </div>

        {isConsultor && (
          <>
            <div className="cfg-field">
              <label>Clientes vinculados</label>
              <div className="areas-check-grid">
                {clientes.map(c => (
                  <label key={c.id} className="area-check">
                    <input type="checkbox" checked={clientesSel.includes(c.id)}
                      onChange={() => { setClientesSel(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]); setProjetosSel([]) }} />
                    <span>{c.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="cfg-field">
              <label>Projetos vinculados</label>
              <div className="areas-check-grid">
                {projetosDisponiveis.map(p => (
                  <label key={p.id} className="area-check">
                    <input type="checkbox" checked={projetosSel.includes(p.id)}
                      onChange={() => setProjetosSel(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} />
                    <span>{p.clientes?.nome} · {p.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {precisaCliente && (
          <div className="cfg-row2">
            <div className="cfg-field">
              <label>Cliente</label>
              <select className="input-light" value={clienteId} onChange={e => { setClienteId(e.target.value); setProjetoId('') }}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="cfg-field">
              <label>Projeto</label>
              <select className="input-light" value={projetoId} onChange={e => setProjetoId(e.target.value)} disabled={!clienteId}>
                <option value="">Selecione...</option>
                {projetosDoCliente.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
        )}

        {form.papel === 'usuario_cliente' && projetoId && (
          <div className="cfg-field">
            <label>Acesso a Áreas</label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <label className="radio-opt"><input type="radio" checked={form.acesso_todas_areas} onChange={() => u('acesso_todas_areas', true)} /><span>Todas</span></label>
              <label className="radio-opt"><input type="radio" checked={!form.acesso_todas_areas} onChange={() => u('acesso_todas_areas', false)} /><span>Específicas</span></label>
            </div>
            {!form.acesso_todas_areas && (
              <div className="areas-check-grid">
                {areasDoProj.map(a => (
                  <label key={a.id} className="area-check">
                    <input type="checkbox" checked={areasSel.includes(a.id)} onChange={e => setAreasSel(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))} />
                    <span>{a.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="usr-modal-footer">
        <button className="usr-btn secondary" onClick={onCancel}>← Voltar</button>
        <div style={{ flex: 1 }} />
        <button className="usr-btn primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '✓ Salvar Alterações'}</button>
      </div>
    </>
  )
}
