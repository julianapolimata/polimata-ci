// NovoUsuarioForm — extraído de UsuariosConfig.jsx em 22/mai/2026 (fatiamento Etapa 8).
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatNomeEmpresa } from '../../../lib/formatNome'
import { PAPEIS } from './_consts'

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
                  <span>{formatNomeEmpresa(p.clientes?.nome_fantasia || p.clientes?.nome)} · {p.nome}</span>
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

export default NovoUsuarioForm
