import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ESTADOS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]

export default function ClientesConfig({ onAbrirProjeto }) {
  const [clientes, setClientes] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [modo, setModo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, cnpj, ativo, telefone, email, segmento, cidade, estado, contato_nome, contato_cargo, contato_telefone, contato_email')
      .order('nome')
    const { data: projetosData } = await supabase
      .from('projetos')
      .select('id, nome, ativo, cliente_id')
    setClientes((clientesData || []).map(c => ({
      ...c,
      projetos: (projetosData || []).filter(p => p.cliente_id === c.id)
    })))
    setLoading(false)
  }

  function fechar() { setModo(null); setClienteSel(null); loadClientes() }

  if (loading) return <div className="cfg-loading"><div className="spinner" /></div>

  return (
    <div className="cfg-section">
      {!modo && (
        <>
          <div className="cfg-section-hdr">
            <div>
              <div className="cfg-section-title">Clientes cadastrados</div>
              <div className="cfg-section-sub">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="btn-cfg-add" onClick={() => setModo('novo')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Novo Cliente
            </button>
          </div>
          <div className="cfg-cards">
            {clientes.map(c => (
              <div key={c.id} className="cfg-card" onClick={() => { setClienteSel(c); setModo('detalhe') }}>
                <div className="cfg-card-avatar">{(c.nome_fantasia || c.nome || '?')[0]}</div>
                <div className="cfg-card-info">
                  <div className="cfg-card-nome">{c.nome_fantasia || c.nome}</div>
                  <div className="cfg-card-meta">
                    {c.cnpj ? formatCNPJ(c.cnpj) : 'Sem CNPJ'}
                    <span style={{margin:'0 4px',opacity:0.3}}>·</span>
                    {c.projetos?.length || 0} projeto{c.projetos?.length !== 1 ? 's' : ''}
                    {c.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
                  </div>
                </div>
                <div className="cfg-card-arrow">›</div>
              </div>
            ))}
            {!clientes.length && <div className="cfg-empty">Nenhum cliente cadastrado.</div>}
          </div>
        </>
      )}
      {modo === 'novo' && <ClienteForm onSave={fechar} onCancel={fechar} />}
      {modo === 'detalhe' && clienteSel && (
        <DetalheCliente
          cliente={clienteSel}
          onBack={fechar}
          onAbrirProjeto={onAbrirProjeto}
        />
      )}
    </div>
  )
}

function formatCNPJ(v) {
  const n = (v||'').replace(/\D/g,'')
  if (n.length !== 14) return v
  return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')
}

// ══════════════════════════════════════════════════════
// FORMULÁRIO NOVO / EDITAR CLIENTE
// ══════════════════════════════════════════════════════
function ClienteForm({ cliente, onSave, onCancel }) {
  const isEdit = !!cliente?.id
  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    nome_fantasia: cliente?.nome_fantasia || '',
    cnpj: cliente?.cnpj ? formatCNPJ(cliente.cnpj) : '',
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    segmento: cliente?.segmento || '',
    cidade: cliente?.cidade || '',
    estado: cliente?.estado || '',
    contato_nome: cliente?.contato_nome || '',
    contato_cargo: cliente?.contato_cargo || '',
    contato_telefone: cliente?.contato_telefone || '',
    contato_email: cliente?.contato_email || '',
    ativo: cliente?.ativo !== false,
  })
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjErro, setCnpjErro] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))

  function fmtCNPJ(v) {
    return v.replace(/\D/g,'').slice(0,14)
      .replace(/^(\d{2})(\d)/,'$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
      .replace(/\.(\d{3})(\d)/,'.$1/$2')
      .replace(/(\d{4})(\d)/,'$1-$2')
  }

  // Validação dos dígitos verificadores do CNPJ (algoritmo oficial da Receita)
  function isCnpjValido(nums) {
    if (nums.length !== 14) return false
    if (/^(\d)\1{13}$/.test(nums)) return false  // todos iguais (000…, 111…)
    const calc = (s, p) => {
      let sum = 0
      for (let i = 0; i < s.length; i++) sum += parseInt(s[i]) * p[i]
      const r = sum % 11
      return r < 2 ? 0 : 11 - r
    }
    const p1 = [5,4,3,2,9,8,7,6,5,4,3,2]
    const p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
    const d1 = calc(nums.slice(0, 12), p1)
    const d2 = calc(nums.slice(0, 13), p2)
    return d1 === parseInt(nums[12]) && d2 === parseInt(nums[13])
  }

  async function buscarCNPJ() {
    const nums = form.cnpj.replace(/\D/g,'')
    if (nums.length !== 14) { setCnpjErro('CNPJ deve ter 14 dígitos'); return }
    if (!isCnpjValido(nums)) { setCnpjErro('CNPJ inválido — verifique os dígitos'); return }
    setCnpjLoading(true); setCnpjErro('')
    let lastErr = null
    // Tenta endpoints em sequência (BrasilAPI v1 → ReceitaWS via brasilapi v2 fallback)
    const fontes = [
      `https://brasilapi.com.br/api/cnpj/v1/${nums}`,
    ]
    for (const url of fontes) {
      try {
        const res = await fetch(url)
        if (res.status === 429) { lastErr = 'Limite de consultas atingido — aguarde alguns segundos e tente novamente.'; continue }
        if (res.status === 404) { lastErr = 'CNPJ não encontrado na Receita Federal'; continue }
        if (!res.ok) { lastErr = `Erro ${res.status} ao consultar a Receita`; continue }
        const data = await res.json()
        setForm(p => ({
          ...p,
          nome: data.razao_social || p.nome,
          nome_fantasia: data.nome_fantasia || p.nome_fantasia,
          cidade: data.municipio || p.cidade,
          estado: data.uf || p.estado,
        }))
        setCnpjLoading(false); setCnpjErro(''); return
      } catch (e) {
        lastErr = 'Falha de conexão — verifique sua rede ou se há bloqueio (ad-blocker, firewall)'
      }
    }
    setCnpjErro(lastErr || 'Não foi possível consultar a Receita')
    setCnpjLoading(false)
  }

  function toSlug(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Razão Social é obrigatória'); return }
    setSaving(true); setErro('')
    try {
      const payload = {
        nome: form.nome.trim(),
        nome_fantasia: form.nome_fantasia.trim() || null,
        cnpj: form.cnpj.replace(/\D/g,'') || null,
        slug: toSlug(form.nome),
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        segmento: form.segmento.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado || null,
        contato_nome: form.contato_nome.trim() || null,
        contato_cargo: form.contato_cargo.trim() || null,
        contato_telefone: form.contato_telefone.trim() || null,
        contato_email: form.contato_email.trim() || null,
        ativo: form.ativo,
      }
      if (isEdit) {
        const { error } = await supabase.from('clientes').update(payload).eq('id', cliente.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('clientes').insert(payload).select().single()
        if (error) throw new Error(error.message)
      }
      onSave()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-form">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onCancel}>← Voltar</button>
        <div>
          <div className="cfg-form-title">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</div>
          <div className="cfg-form-sub">{isEdit ? 'Atualize os dados do cliente' : 'Busque pelo CNPJ ou preencha manualmente'}</div>
        </div>
      </div>

      {erro && <div className="cfg-erro">{erro}</div>}

      {/* ── Identificação ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Identificação</div>
        <div className="cnpj-row">
          <div className="cfg-field" style={{flex:1}}>
            <label>CNPJ</label>
            <input className="input-light" value={form.cnpj} onChange={e => u('cnpj', fmtCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
            {cnpjErro && <span className="field-erro">{cnpjErro}</span>}
          </div>
          <button className="btn-cnpj" onClick={buscarCNPJ} disabled={cnpjLoading}>{cnpjLoading ? 'Buscando...' : '🔍 Buscar Receita'}</button>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Razão Social <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e => u('nome', e.target.value)} placeholder="Razão Social" /></div>
          <div className="cfg-field"><label>Nome Fantasia</label><input className="input-light" value={form.nome_fantasia} onChange={e => u('nome_fantasia', e.target.value)} placeholder="Nome Fantasia" /></div>
        </div>
        <div className="cfg-row3">
          <div className="cfg-field"><label>Segmento / Setor</label><input className="input-light" value={form.segmento} onChange={e => u('segmento', e.target.value)} placeholder="Ex: Indústria, Varejo, Serviços..." /></div>
          <div className="cfg-field"><label>Telefone</label><input className="input-light" value={form.telefone} onChange={e => u('telefone', e.target.value)} placeholder="(00) 0000-0000" /></div>
          <div className="cfg-field"><label>Email corporativo</label><input className="input-light" type="email" value={form.email} onChange={e => u('email', e.target.value)} placeholder="contato@empresa.com.br" /></div>
        </div>
        <div className="cfg-row3">
          <div className="cfg-field"><label>Cidade</label><input className="input-light" value={form.cidade} onChange={e => u('cidade', e.target.value)} placeholder="Cidade" /></div>
          <div className="cfg-field"><label>Estado</label>
            <select className="input-light" value={form.estado} onChange={e => u('estado', e.target.value)}>
              <option value="">Selecione...</option>
              {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="cfg-field"><label>Status</label>
            <select className="input-light" value={form.ativo ? 'ativo' : 'inativo'} onChange={e => u('ativo', e.target.value === 'ativo')}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Contato Principal ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Contato Principal</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.contato_nome} onChange={e => u('contato_nome', e.target.value)} placeholder="Nome do contato" /></div>
          <div className="cfg-field"><label>Cargo</label><input className="input-light" value={form.contato_cargo} onChange={e => u('contato_cargo', e.target.value)} placeholder="Ex: Diretor, Gerente" /></div>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Telefone</label><input className="input-light" value={form.contato_telefone} onChange={e => u('contato_telefone', e.target.value)} placeholder="(00) 00000-0000" /></div>
          <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.contato_email} onChange={e => u('contato_email', e.target.value)} placeholder="contato@empresa.com.br" /></div>
        </div>
      </div>

      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : isEdit ? '✓ Salvar Alterações' : '✓ Salvar Cliente'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// DETALHE CLIENTE
// ══════════════════════════════════════════════════════
function DetalheCliente({ cliente, onBack, onAbrirProjeto }) {
  const [dados, setDados] = useState(null)
  const [sistemas, setSistemas] = useState([])
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('info')
  const [novaSisNome, setNovaSisNome] = useState('')
  const [editando, setEditando] = useState(false)

  useEffect(() => { loadDados() }, [])

  async function loadDados() {
    setLoading(true)
    const [{ data: cli }, { data: sis }, { data: projs }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', cliente.id).single(),
      supabase.from('sistemas').select('*').eq('cliente_id', cliente.id).order('nome'),
      supabase.from('projetos').select('id, nome, ativo, num_fases, matriz_tamanho, criado_em').eq('cliente_id', cliente.id).order('nome'),
    ])
    setDados(cli)
    setSistemas(sis || [])
    setProjetos(projs || [])
    setLoading(false)
  }

  async function adicionarSistema() {
    if (!novaSisNome.trim()) return
    await supabase.from('sistemas').insert({ cliente_id: cliente.id, nome: novaSisNome.trim() })
    setNovaSisNome(''); loadDados()
  }

  async function removerSistema(id) {
    await supabase.from('sistemas').delete().eq('id', id); loadDados()
  }

  if (loading || !dados) return <div className="cfg-loading"><div className="spinner"/></div>

  if (editando) {
    return <ClienteForm cliente={dados} onSave={() => { setEditando(false); loadDados() }} onCancel={() => setEditando(false)} />
  }

  return (
    <div className="cfg-detalhe">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onBack}>← Voltar</button>
        <div style={{flex:1}}>
          <div className="cfg-form-title">{dados.nome_fantasia || dados.nome}</div>
          <div className="cfg-form-sub" style={{display:'flex',gap:8,alignItems:'center'}}>
            {dados.cnpj && <span>{formatCNPJ(dados.cnpj)}</span>}
            {dados.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
          </div>
        </div>
        <button className="btn-cfg-sm" onClick={() => setEditando(true)}>✏ Editar</button>
      </div>

      <div className="cfg-tabs" style={{marginBottom:20,marginTop:16}}>
        {[
          {id:'info', label:'Informações'},
          {id:'sistemas', label:'Sistemas'},
          {id:'projetos', label:`Projetos (${projetos.length})`},
        ].map(t => (
          <button key={t.id} className={`cfg-tab ${aba===t.id?'active':''}`} onClick={()=>setAba(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA INFO ── */}
      {aba === 'info' && (
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="cfg-group">
            <div className="cfg-group-title">Dados da Empresa</div>
            <div className="usr-info-grid">
              <InfoCell label="Razão Social" value={dados.nome} />
              <InfoCell label="Nome Fantasia" value={dados.nome_fantasia} />
              <InfoCell label="CNPJ" value={dados.cnpj ? formatCNPJ(dados.cnpj) : null} />
              <InfoCell label="Segmento" value={dados.segmento} />
              <InfoCell label="Telefone" value={dados.telefone} />
              <InfoCell label="Email" value={dados.email} />
              <InfoCell label="Cidade" value={dados.cidade} />
              <InfoCell label="Estado" value={dados.estado} />
            </div>
          </div>

          {(dados.contato_nome || dados.contato_email) && (
            <div className="cfg-group">
              <div className="cfg-group-title">Contato Principal</div>
              <div className="usr-info-grid">
                <InfoCell label="Nome" value={dados.contato_nome} />
                <InfoCell label="Cargo" value={dados.contato_cargo} />
                <InfoCell label="Telefone" value={dados.contato_telefone} />
                <InfoCell label="Email" value={dados.contato_email} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA SISTEMAS ── */}
      {aba === 'sistemas' && (
        <div>
          <div className="cfg-chips" style={{marginBottom:16}}>
            {sistemas.map(s => (
              <div key={s.id} className="cfg-chip" style={{display:'flex',alignItems:'center',gap:8}}>
                {s.nome}
                <button onClick={()=>removerSistema(s.id)} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:12,padding:0}}>✕</button>
              </div>
            ))}
            {!sistemas.length && <div className="cfg-empty">Nenhum sistema cadastrado.</div>}
          </div>
          <div style={{display:'flex',gap:8,maxWidth:400}}>
            <input className="input-light" style={{flex:1}} value={novaSisNome} onChange={e=>setNovaSisNome(e.target.value)} placeholder="Nome do sistema..." onKeyDown={e=>e.key==='Enter'&&adicionarSistema()} />
            <button className="btn-cfg-sm" onClick={adicionarSistema}>+ Adicionar</button>
          </div>
        </div>
      )}

      {/* ── ABA PROJETOS (somente leitura + link) ── */}
      {aba === 'projetos' && (
        <div>
          {projetos.length > 0 ? (
            <div className="cfg-table-wrap">
              <table className="cfg-table">
                <thead><tr><th>Projeto</th><th>Fases</th><th>Matriz</th><th>Status</th><th style={{width:80}}></th></tr></thead>
                <tbody>
                  {projetos.map(p => (
                    <tr key={p.id}>
                      <td style={{fontWeight:500}}>{p.nome}</td>
                      <td style={{textAlign:'center'}}>{p.num_fases ?? 5}</td>
                      <td style={{textAlign:'center'}}>{(p.matriz_tamanho ?? 4)}×{(p.matriz_tamanho ?? 4)}</td>
                      <td>{p.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}</td>
                      <td>
                        {onAbrirProjeto && (
                          <button className="btn-cfg-sm" onClick={() => onAbrirProjeto(p.id)} style={{fontSize:10}}>
                            Abrir →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cfg-empty">
              Nenhum projeto cadastrado para este cliente.
              {onAbrirProjeto && <div style={{marginTop:8,fontSize:11}}>Crie um projeto na aba <strong>Projetos</strong> das Configurações.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div className="usr-info-cell">
      <div className="usr-info-label">{label}</div>
      <div className="usr-info-value">{value || <span style={{color:'var(--txt3)',fontStyle:'italic'}}>—</span>}</div>
    </div>
  )
}
