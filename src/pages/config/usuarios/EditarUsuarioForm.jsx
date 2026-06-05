// EditarUsuarioForm — extraído de UsuariosConfig.jsx em 22/mai/2026 (fatiamento Etapa 8).
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatNomeEmpresa } from '../../../lib/formatNome'
import { PAPEIS } from './_consts'
import { notificarVinculoConsultor } from '../../../lib/vinculoConsultor'

function EditarUsuarioForm({ usuario, clientes, areas, projetos, onSave, onCancel }) {
  const [form, setForm] = useState({
    nome: usuario.nome || '', email: usuario.email || '', papel: usuario.papel || 'usuario_cliente',
    acesso_todas_areas: usuario.acesso_todas_areas !== false
  })
  const [clientesSel, setClientesSel] = useState([])
  const [projetosSel, setProjetosSel] = useState([])
  const [projetosOrig, setProjetosOrig] = useState([])
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
      setProjetosOrig((pprojs || []).map(p => p.projeto_id))
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
      // Consultor ganhou projeto(s) novo(s): e-mail de aviso
      if (isConsultor) {
        const novos = projetosSel.filter(id => !projetosOrig.includes(id))
        if (novos.length > 0) notificarVinculoConsultor(usuario.id, novos)
      }
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
                    <span>{formatNomeEmpresa(p.clientes?.nome_fantasia || p.clientes?.nome)} · {p.nome}</span>
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

export default EditarUsuarioForm
