import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const PAPEIS = [
  { value: 'admin_polimata',    label: 'Admin Polímata',    desc: 'Acesso total a todos os clientes e configurações', cor: '#CC915E' },
  { value: 'consultor_polimata',label: 'Consultor Polímata',desc: 'Edita análises, faz upload de fichas, baixa relatórios', cor: '#3B82F6' },
  { value: 'gestor_cliente',    label: 'Gestor do Cliente', desc: 'Vê todas as áreas do projeto, somente consulta e download', cor: '#22C55E' },
  { value: 'usuario_cliente',   label: 'Usuário Cliente',   desc: 'Acesso às áreas atribuídas, somente consulta e download', cor: '#A78BFA' },
]

export default function UsuariosConfig() {
  const { perfil: meuperfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])
  const [areas, setAreas] = useState([])
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNovo, setShowNovo] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null)

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
    const novoAtivo = u.ativo === false ? true : false
    await supabase.from('perfis').update({ ativo: novoAtivo }).eq('id', u.id)
    loadDados()
  }

  if (loading) return <div className="cfg-loading"><div className="spinner"/></div>

  return (
    <div className="cfg-section">
      <div className="cfg-section-hdr">
        <div>
          <div className="cfg-section-title">Usuários</div>
          <div className="cfg-section-sub">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn-cfg-add" onClick={() => setShowNovo(true)}>
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

      {usuarioEditando && (
        <EditarUsuarioForm
          usuario={usuarioEditando}
          clientes={clientes} areas={areas} projetos={projetos}
          onSave={() => { setUsuarioEditando(null); loadDados() }}
          onCancel={() => setUsuarioEditando(null)}
        />
      )}

      <div className="usuarios-grid">
        {usuarios.map(u => {
          const papel = PAPEIS.find(p => p.value === u.papel)
          const suspenso = u.ativo === false
          return (
            <div key={u.id} className="usuario-card" style={suspenso ? { opacity: 0.55 } : {}}>
              <div className="usuario-avatar" style={{ background: suspenso ? '#6B7280' : (papel?.cor || 'var(--gold)') }}>
                {u.nome?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="usuario-info">
                <div className="usuario-nome">
                  {u.nome}
                  {u.id === meuperfil?.id && <span className="badge-voce">você</span>}
                  {suspenso && <span className="badge-inativo" style={{ marginLeft: 4 }}>Suspenso</span>}
                </div>
                <div className="usuario-email">{u.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="usuario-papel-badge" style={{ background: papel?.cor + '22', color: papel?.cor, border: `1px solid ${papel?.cor}44` }}>
                    {papel?.label || u.papel}
                  </span>
                  {u.clientes?.nome && <span className="badge-cliente">{u.clientes.nome}</span>}
                  {u.papel === 'admin_polimata' && (
                    <span className="badge-cliente" style={{ background: 'rgba(204,145,94,0.1)', color: 'var(--gold)' }}>Todos os clientes</span>
                  )}
                </div>
              </div>
              {u.id !== meuperfil?.id && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn-tbl-edit" onClick={() => setUsuarioEditando(u)} title="Editar">✏</button>
                  <button
                    onClick={() => suspenderUsuario(u)}
                    style={{
                      background: suspenso ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)',
                      color: suspenso ? '#22C55E' : '#FBBF24',
                      border: `1px solid ${suspenso ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
                      borderRadius: 5, padding: '3px 8px', fontSize: 11,
                      cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    {suspenso ? '↺ Reativar' : '⊘ Suspender'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {!usuarios.length && <div className="cfg-empty">Nenhum usuário cadastrado.</div>}
      </div>
    </div>
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

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) { setErro('Nome e email são obrigatórios'); return }
    if (isConsultor && clientesSel.length === 0) { setErro('Selecione pelo menos um cliente'); return }
    if (isConsultor && projetosSel.length === 0) { setErro('Selecione pelo menos um projeto'); return }
    if (precisaCliente && !clienteId) { setErro('Selecione o cliente'); return }
    if (precisaCliente && !projetoId) { setErro('Selecione o projeto'); return }
    setSaving(true); setErro('')
    try {
      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email.trim(), password: tempPassword, email_confirm: true,
        user_metadata: { nome: form.nome.trim(), papel: form.papel }
      })
      if (authErr) throw new Error(authErr.message)

      await supabase.from('perfis').update({
        nome: form.nome.trim(), papel: form.papel,
        cliente_id: precisaCliente ? clienteId : null,
        projeto_id: precisaCliente ? projetoId : null,
        acesso_todas_areas: form.acesso_todas_areas, ativo: true
      }).eq('id', authData.user.id)

      if (isConsultor && projetosSel.length > 0) {
        await supabase.from('perfis_projetos').insert(projetosSel.map(pid => ({ perfil_id: authData.user.id, projeto_id: pid })))
      }
      if (form.papel === 'usuario_cliente' && !form.acesso_todas_areas && areasSel.length > 0) {
        await supabase.from('permissoes_area').insert(areasSel.map(aid => ({ perfil_id: authData.user.id, area_id: aid, pode_editar: false })))
      }
      await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo: window.location.origin })
      setSucesso(`Usuário criado! Email enviado para ${form.email}`)
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
        <div className="perfil-grid">
          {PAPEIS.map(p => (
            <div key={p.value} className={`perfil-card ${form.papel === p.value ? 'selected' : ''}`}
              onClick={() => u('papel', p.value)}
              style={form.papel === p.value ? { borderColor: p.cor, background: p.cor + '11' } : {}}>
              <div className="perfil-card-nome" style={form.papel === p.value ? { color: p.cor } : {}}>{p.label}</div>
              <div className="perfil-card-desc">{p.desc}</div>
            </div>
          ))}
        </div>
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
// FORMULÁRIO EDITAR USUÁRIO
// ══════════════════════════════════════════════════════
function EditarUsuarioForm({ usuario, clientes, areas, projetos, onSave, onCancel }) {
  const [form, setForm] = useState({
    nome: usuario.nome || '', papel: usuario.papel || 'usuario_cliente',
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
      await supabase.from('perfis').update({
        nome: form.nome, papel: form.papel,
        cliente_id: precisaCliente ? clienteId : null,
        projeto_id: precisaCliente ? projetoId : null,
        acesso_todas_areas: form.acesso_todas_areas
      }).eq('id', usuario.id)

      await supabase.from('perfis_projetos').delete().eq('perfil_id', usuario.id)
      if (isConsultor && projetosSel.length > 0) {
        await supabase.from('perfis_projetos').insert(projetosSel.map(pid => ({ perfil_id: usuario.id, projeto_id: pid })))
      }

      await supabase.from('permissoes_area').delete().eq('perfil_id', usuario.id)
      if (form.papel === 'usuario_cliente' && !form.acesso_todas_areas && areasSel.length > 0) {
        await supabase.from('permissoes_area').insert(areasSel.map(aid => ({ perfil_id: usuario.id, area_id: aid, pode_editar: false })))
      }
      onSave()
    } catch (e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-inline-form" style={{ borderColor: 'rgba(204,145,94,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="cfg-group-title" style={{ fontSize: 13 }}>Editando: {usuario.nome}</div>
        <button className="btn-cfg-remove" onClick={onCancel}>✕</button>
      </div>
      {erro && <div className="cfg-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.nome} onChange={e => u('nome', e.target.value)} /></div>

      <div className="cfg-field">
        <label>Perfil de Acesso</label>
        <div className="perfil-grid">
          {PAPEIS.map(p => (
            <div key={p.value} className={`perfil-card ${form.papel === p.value ? 'selected' : ''}`}
              onClick={() => u('papel', p.value)}
              style={form.papel === p.value ? { borderColor: p.cor, background: p.cor + '11' } : {}}>
              <div className="perfil-card-nome" style={form.papel === p.value ? { color: p.cor } : {}}>{p.label}</div>
              <div className="perfil-card-desc">{p.desc}</div>
            </div>
          ))}
        </div>
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
            <div style={{ fontSize: 10, color: 'var(--txt3)', marginBottom: 6 }}>Sem projeto selecionado o consultor não verá nada.</div>
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

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '✓ Salvar'}</button>
      </div>
    </div>
  )
}
