import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ClientesConfig() {
  const [clientes, setClientes] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [modo, setModo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    // Buscar clientes
    const { data: clientesData, error } = await supabase
      .from('clientes')
      .select('id, nome, ativo, cnpj')
      .order('nome')
    if (error) console.error("CLIENTES ERROR:", error)

    // Buscar projetos separadamente e agrupar por cliente
    const { data: projetosData } = await supabase
      .from('projetos')
      .select('id, nome, ativo, cliente_id')

    const clientes = (clientesData || []).map(c => ({
      ...c,
      projetos: (projetosData || []).filter(p => p.cliente_id === c.id)
    }))

    setClientes(clientes)
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
                <div className="cfg-card-avatar">{c.nome[0]}</div>
                <div className="cfg-card-info">
                  <div className="cfg-card-nome">{c.nome}</div>
                  <div className="cfg-card-meta">
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
      {modo === 'novo' && <NovoClienteForm onSave={fechar} onCancel={fechar} />}
      {modo === 'detalhe' && clienteSel && <DetalheCliente cliente={clienteSel} onBack={fechar} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// NOVO CLIENTE
// ══════════════════════════════════════════════════════
function NovoClienteForm({ onSave, onCancel }) {
  const [cnpj, setCnpj] = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjErro, setCnpjErro] = useState('')
  const [nome, setNome] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function formatCNPJ(v) {
    return v.replace(/\D/g,'').slice(0,14)
      .replace(/^(\d{2})(\d)/,'$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
      .replace(/\.(\d{3})(\d)/,'.$1/$2')
      .replace(/(\d{4})(\d)/,'$1-$2')
  }

  async function buscarCNPJ() {
    const nums = cnpj.replace(/\D/g,'')
    if (nums.length !== 14) { setCnpjErro('CNPJ deve ter 14 dígitos'); return }
    setCnpjLoading(true); setCnpjErro('')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${nums}`)
      if (!res.ok) throw new Error('CNPJ não encontrado')
      const data = await res.json()
      setNome(data.razao_social || '')
      setNomeFantasia(data.nome_fantasia || '')
    } catch(e) {
      setCnpjErro('CNPJ não encontrado na Receita Federal')
    }
    setCnpjLoading(false)
  }

  function toSlug(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Razão Social é obrigatória'); return }
    setSaving(true); setErro('')
    try {
      const { error: eCli } = await supabase
        .from('clientes').insert({ nome: nome.trim(), nome_fantasia: nomeFantasia.trim() || null, slug: toSlug(nome), cnpj: cnpj.replace(/\D/g,'') || null }).select().single()
      if (eCli) throw new Error(eCli.message)
      onSave()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-form">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onCancel}>← Voltar</button>
        <div><div className="cfg-form-title">Novo Cliente</div><div className="cfg-form-sub">Busque pelo CNPJ ou preencha manualmente</div></div>
      </div>
      {erro && <div className="cfg-erro">{erro}</div>}
      <div className="cfg-group">
        <div className="cfg-group-title">Identificação</div>
        <div className="cnpj-row">
          <div className="cfg-field" style={{flex:1}}>
            <label>CNPJ</label>
            <input className="input-light" value={cnpj} onChange={e => setCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
            {cnpjErro && <span className="field-erro">{cnpjErro}</span>}
          </div>
          <button className="btn-cnpj" onClick={buscarCNPJ} disabled={cnpjLoading}>{cnpjLoading ? 'Buscando...' : '🔍 Buscar Receita'}</button>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Razão Social <span className="req">*</span></label><input className="input-light" value={nome} onChange={e => setNome(e.target.value)} placeholder="Razão Social" /></div>
          <div className="cfg-field"><label>Nome Fantasia</label><input className="input-light" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Nome Fantasia" /></div>
        </div>
      </div>
      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving?'Salvando...':'✓ Salvar Cliente'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// DETALHE CLIENTE
// ══════════════════════════════════════════════════════
function DetalheCliente({ cliente, onBack }) {
  const [areas, setAreas] = useState([])
  const [sistemas, setSistemas] = useState([])
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('areas')
  const [editandoArea, setEditandoArea] = useState(null)
  const [novaArea, setNovaArea] = useState(false)
  const [novaSisNome, setNovaSisNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [editandoProj, setEditandoProj] = useState(null)
  const [novoProj, setNovoProj] = useState(false)

  // usa o primeiro projeto como padrão para áreas
  const projetoId = projetos[0]?.id || cliente.projetos?.[0]?.id

  useEffect(() => { loadDados() }, [])

  async function loadDados() {
    setLoading(true)
    const [{ data: projs }, { data: sis }] = await Promise.all([
      supabase.from('projetos').select('*').eq('cliente_id', cliente.id).order('nome'),
      supabase.from('sistemas').select('*').eq('cliente_id', cliente.id).order('nome')
    ])
    const projetosList = projs || []
    setProjetos(projetosList)
    setSistemas(sis || [])

    if (projetosList.length > 0) {
      const { data: ars } = await supabase
        .from('areas').select('*').eq('projeto_id', projetosList[0].id).order('ordem')
      setAreas(ars || [])
    }
    setLoading(false)
  }

  async function salvarArea(area) {
    setSaving(true)
    if (area.id) {
      await supabase.from('areas').update({ nome: area.nome, prefixo: area.prefixo.toUpperCase(), peso: parseFloat(area.peso)||0, gerente: area.gerente }).eq('id', area.id)
    } else {
      await supabase.from('areas').insert({ projeto_id: projetoId, nome: area.nome, prefixo: area.prefixo.toUpperCase(), peso: parseFloat(area.peso)||0, gerente: area.gerente, ordem: areas.length+1 })
    }
    setEditandoArea(null); setNovaArea(false); await loadDados(); setSaving(false)
    // Notifica o Dashboard para recarregar as áreas
    window.dispatchEvent(new CustomEvent('polimata:areas-updated'))
  }

  async function removerArea(id) {
    if (!confirm('Remover esta área?')) return
    await supabase.from('areas').delete().eq('id', id); loadDados()
  }

  async function adicionarSistema() {
    if (!novaSisNome.trim()) return
    await supabase.from('sistemas').insert({ cliente_id: cliente.id, nome: novaSisNome.trim() })
    setNovaSisNome(''); loadDados()
  }

  async function removerSistema(id) {
    await supabase.from('sistemas').delete().eq('id', id); loadDados()
  }

  async function salvarProjeto(proj) {
    setSaving(true)
    const payload = {
      nome: proj.nome,
      ativo: proj.ativo,
      num_fases: proj.num_fases ?? 5,
      matriz_tamanho: proj.matriz_tamanho ?? 4,
    }
    if (proj.id) {
      // Se projeto já tem controles, não permitir alterar matriz
      const { count } = await supabase
        .from('mrc').select('id', { count: 'exact', head: true })
        .eq('projeto_id', proj.id)
      if ((count || 0) > 0) delete payload.matriz_tamanho
      await supabase.from('projetos').update(payload).eq('id', proj.id)
    } else {
      await supabase.from('projetos').insert({ cliente_id: cliente.id, ...payload })
    }
    setEditandoProj(null); setNovoProj(false); await loadDados(); setSaving(false)
  }

  async function removerProjeto(id) {
    if (!confirm('Remover este projeto? Esta ação não pode ser desfeita.')) return
    await supabase.from('projetos').delete().eq('id', id); loadDados()
  }

  return (
    <div className="cfg-detalhe">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onBack}>← Voltar</button>
        <div style={{flex:1}}>
          <div className="cfg-form-title">{cliente.nome}</div>
          <div className="cfg-form-sub" style={{display:'flex',gap:8,alignItems:'center'}}>
            {cliente.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
          </div>
        </div>
      </div>
      <div className="cfg-tabs" style={{marginBottom:20}}>
        {['areas','sistemas','projetos'].map(t => (
          <button key={t} className={`cfg-tab ${aba===t?'active':''}`} onClick={()=>setAba(t)}>
            {t==='areas'?'Processos / Áreas':t==='sistemas'?'Sistemas':'Projetos'}
          </button>
        ))}
      </div>
      {loading ? <div className="cfg-loading"><div className="spinner"/></div> : (
        <>
          {/* ── ABA ÁREAS ── */}
          {aba==='areas' && (
            <div>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
                <button className="btn-cfg-sm" onClick={()=>setNovaArea(true)}>+ Nova Área</button>
              </div>
              {novaArea && <AreaForm area={{nome:'',prefixo:'',peso:'',gerente:''}} onSave={salvarArea} onCancel={()=>setNovaArea(false)} saving={saving} />}
              <div className="cfg-table-wrap">
                <table className="cfg-table">
                  <thead><tr><th>Processo</th><th>Prefixo</th><th>Peso</th><th>Gerente</th><th style={{width:80}}></th></tr></thead>
                  <tbody>
                    {areas.map(a => (
                      editandoArea?.id===a.id ? (
                        <tr key={a.id}><td colSpan={5}><AreaForm area={editandoArea} onSave={salvarArea} onCancel={()=>setEditandoArea(null)} saving={saving} inline /></td></tr>
                      ) : (
                        <tr key={a.id}>
                          <td>{a.nome}</td>
                          <td><span className="tag-prefixo">{a.prefixo}</span></td>
                          <td>{(a.peso*100).toFixed(1)}%</td>
                          <td style={{color:'var(--txt2)'}}>{a.gerente||'—'}</td>
                          <td><div style={{display:'flex',gap:6}}><button className="btn-tbl-edit" onClick={()=>setEditandoArea({...a})}>✏</button><button className="btn-tbl-del" onClick={()=>removerArea(a.id)}>✕</button></div></td>
                        </tr>
                      )
                    ))}
                    {!areas.length && <tr><td colSpan={5} style={{textAlign:'center',color:'var(--txt3)',padding:24}}>Nenhuma área cadastrada.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ABA SISTEMAS ── */}
          {aba==='sistemas' && (
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

          {/* ── ABA PROJETOS ── */}
          {aba==='projetos' && (
            <div>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
                <button className="btn-cfg-sm" onClick={()=>setNovoProj(true)}>+ Novo Projeto</button>
              </div>

              {novoProj && (
                <ProjetoForm
                  projeto={{nome:'', ativo: true}}
                  onSave={salvarProjeto}
                  onCancel={()=>setNovoProj(false)}
                  saving={saving}
                />
              )}

              <div className="cfg-table-wrap">
                <table className="cfg-table">
                  <thead><tr><th>Nome do Projeto</th><th>Fases</th><th>Matriz</th><th>Status</th><th style={{width:80}}></th></tr></thead>
                  <tbody>
                    {projetos.map(p => (
                      editandoProj?.id === p.id ? (
                        <tr key={p.id}>
                          <td colSpan={5}>
                            <ProjetoForm projeto={editandoProj} onSave={salvarProjeto} onCancel={()=>setEditandoProj(null)} saving={saving} inline />
                          </td>
                        </tr>
                      ) : (
                        <tr key={p.id}>
                          <td style={{fontWeight:500}}>{p.nome}</td>
                          <td style={{textAlign:'center'}}>{p.num_fases ?? 5}</td>
                          <td style={{textAlign:'center'}}>{(p.matriz_tamanho ?? 4)}×{(p.matriz_tamanho ?? 4)}</td>
                          <td>{p.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}</td>
                          <td>
                            <div style={{display:'flex',gap:6}}>
                              <button className="btn-tbl-edit" onClick={()=>setEditandoProj({...p})}>✏</button>
                              <button className="btn-tbl-del" onClick={()=>removerProjeto(p.id)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                    {!projetos.length && <tr><td colSpan={5} style={{textAlign:'center',color:'var(--txt3)',padding:24}}>Nenhum projeto cadastrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FORM ÁREA
// ══════════════════════════════════════════════════════
function AreaForm({ area, onSave, onCancel, saving, inline }) {
  const [form, setForm] = useState({...area})
  const u = (f,v) => setForm(p=>({...p,[f]:v}))
  return (
    <div className={inline?'area-form-inline':'cfg-area-block'} style={{marginBottom:12}}>
      <div className="cfg-row3">
        <div className="cfg-field"><label>Processo <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Compras" /></div>
        <div className="cfg-field"><label>Prefixo <span className="req">*</span></label><input className="input-light" value={form.prefixo} onChange={e=>u('prefixo',e.target.value.toUpperCase())} placeholder="COM" maxLength={8} /></div>
        <div className="cfg-field">
          <label>Peso (%) <span className="req">*</span></label>
          <input className="input-light" type="number" value={form.peso} onChange={e=>u('peso',e.target.value)} placeholder="13.5" min="0.1" step="0.1"
            style={form.peso !== '' && !(parseFloat(form.peso) > 0) ? {borderColor:'#EF4444'} : {}} />
          {form.peso !== '' && !(parseFloat(form.peso) > 0) && <span className="field-erro">Peso deve ser maior que 0%</span>}
        </div>
      </div>
      <div className="cfg-field" style={{marginTop:10}}><label>Gerente</label><input className="input-light" value={form.gerente} onChange={e=>u('gerente',e.target.value)} placeholder="Nome do gerente" /></div>
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={()=>onSave(form)} disabled={saving||!form.nome.trim()||!form.prefixo.trim()||!(parseFloat(form.peso)>0)}>{saving?'Salvando...':'✓ Salvar'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FORM PROJETO
// ══════════════════════════════════════════════════════
function ProjetoForm({ projeto, onSave, onCancel, saving, inline }) {
  const [form, setForm] = useState({
    nome: projeto.nome || '',
    ativo: projeto.ativo !== false,
    num_fases: projeto.num_fases ?? 5,
    matriz_tamanho: projeto.matriz_tamanho ?? 4,
  })
  const [temControles, setTemControles] = useState(false)
  const [faseMinima, setFaseMinima] = useState(1)
  const u = (f,v) => setForm(p=>({...p,[f]:v}))

  // Ao editar projeto existente, verificar travas
  useEffect(() => {
    if (!projeto.id) return
    ;(async () => {
      // Verificar se tem controles → trava matriz
      const { count } = await supabase
        .from('mrc').select('id', { count: 'exact', head: true })
        .eq('projeto_id', projeto.id)
      const tem = (count || 0) > 0
      setTemControles(tem)
      if (!tem) return

      // Descobrir fase mais alta com dados para limitar redução
      const { data: rows } = await supabase
        .from('mrc').select('r1, r_ader, r3, r_f4c1, r_f4c2, r_f5')
        .eq('projeto_id', projeto.id)
      let max = 1
      for (const r of (rows || [])) {
        if (r.r_f5)               { max = 5; break }
        if (r.r_f4c1 || r.r_f4c2) { max = Math.max(max, 4) }
        if (r.r3)                  { max = Math.max(max, 3) }
        if (r.r_ader)              { max = Math.max(max, 2) }
      }
      setFaseMinima(max)
    })()
  }, [projeto.id])

  return (
    <div className={inline ? 'area-form-inline' : 'cfg-area-block'} style={{marginBottom:12}}>
      <div className="cfg-row2">
        <div className="cfg-field">
          <label>Nome do Projeto <span className="req">*</span></label>
          <input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Controles Internos 2025" />
        </div>
        <div className="cfg-field">
          <label>Status</label>
          <select className="input-light" value={form.ativo ? 'ativo' : 'inativo'} onChange={e=>u('ativo', e.target.value === 'ativo')}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>
      <div className="cfg-row2" style={{marginTop:10}}>
        <div className="cfg-field">
          <label>Fases da Trilha</label>
          <select className="input-light" value={form.num_fases} onChange={e=>u('num_fases', parseInt(e.target.value))}>
            {[1,2,3,4,5].map(n => (
              <option key={n} value={n} disabled={n < faseMinima}>
                {n} {n===1?'fase':'fases'} — até F{n}{n < faseMinima ? ' (há dados)' : ''}
              </option>
            ))}
          </select>
          {faseMinima > 1 && (
            <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>
              Fase mínima: F{faseMinima} (já possui resultados registrados)
            </span>
          )}
        </div>
        <div className="cfg-field">
          <label>Matriz de Calor</label>
          {temControles ? (
            <>
              <select className="input-light" value={form.matriz_tamanho} disabled style={{opacity:0.6,cursor:'not-allowed'}}>
                <option value={form.matriz_tamanho}>{form.matriz_tamanho} × {form.matriz_tamanho}</option>
              </select>
              <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>
                Não pode ser alterada — projeto já possui controles cadastrados
              </span>
            </>
          ) : (
            <select className="input-light" value={form.matriz_tamanho} onChange={e=>u('matriz_tamanho', parseInt(e.target.value))}>
              <option value={4}>4 × 4 (Padrão)</option>
              <option value={5}>5 × 5</option>
            </select>
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={()=>onSave({...projeto, ...form})} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':'✓ Salvar'}</button>
      </div>
    </div>
  )
}
