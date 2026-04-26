import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSort } from '../../lib/useTableFeatures'
import { gerarTemplateMRC } from '../../lib/templateMRC'

const FASES_DESC = {
  1: 'F1 – Diagnóstico',
  2: 'F2 – TOD e TOE',
  3: 'F3 – Revisão Integral',
  4: 'F4 – Sustentação',
  5: 'F5 – Melhoria Contínua',
}

function ErroMsg({ msg }) {
  if (!msg) return null
  return (
    <div className="cfg-erro-v2">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span>{msg}</span>
    </div>
  )
}

function traduzirErro(msg) {
  if (!msg) return 'Ocorreu um erro inesperado. Tente novamente.'
  if (msg.includes('row-level security')) return 'Sem permissão para esta ação. Apenas administradores Polímata podem realizar operações de cadastro.'
  if (msg.includes('duplicate') || msg.includes('unique')) return 'Já existe um registro com estes dados. Verifique se o nome ou CNPJ já está cadastrado.'
  if (msg.includes('not-null') || msg.includes('null value')) return 'Campos obrigatórios não foram preenchidos.'
  if (msg.includes('foreign key')) return 'Referência inválida. O registro vinculado não existe ou foi removido.'
  if (msg.includes('check constraint')) return 'Os valores informados estão fora do permitido. Verifique os campos.'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) return 'Erro de conexão. Verifique sua internet e tente novamente.'
  return msg
}

export default function ClientesConfig() {
  const [clientes, setClientes] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [modo, setModo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    const { data: clientesData, error } = await supabase
      .from('clientes')
      .select('id, nome, ativo, cnpj')
      .order('nome')
    if (error) console.error("CLIENTES ERROR:", error)

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
                <div className="cfg-card-arrow">&rsaquo;</div>
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
// NOVO CLIENTE (apenas dados do cliente)
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
      let data = null
      const apis = [
        `https://brasilapi.com.br/api/cnpj/v1/${nums}`,
        `https://publica.cnpj.ws/cnpj/${nums}`,
      ]
      for (const url of apis) {
        try {
          const res = await fetch(url)
          if (res.ok) { data = await res.json(); break }
        } catch { /* tenta próxima */ }
      }
      if (!data) throw new Error('not found')
      setNome(data.razao_social || '')
      setNomeFantasia(data.nome_fantasia || '')
    } catch(e) {
      setCnpjErro('CNPJ não encontrado. Verifique o número ou tente novamente em instantes.')
    }
    setCnpjLoading(false)
  }

  function toSlug(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Preencha a Razão Social do cliente para continuar.'); return }
    setSaving(true); setErro('')
    try {
      const { error: eCli } = await supabase
        .from('clientes').insert({ nome: nome.trim(), slug: toSlug(nome), cnpj: cnpj.replace(/\D/g,'') || null }).select().single()
      if (eCli) throw new Error(eCli.message)
      onSave()
    } catch(e) { setErro(traduzirErro(e.message)); setSaving(false) }
  }

  return (
    <div className="cfg-form">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onCancel}>&larr; Voltar</button>
        <div><div className="cfg-form-title">Novo Cliente</div><div className="cfg-form-sub">Busque pelo CNPJ ou preencha manualmente. Projetos e áreas são cadastrados depois, na aba do cliente.</div></div>
      </div>
      <ErroMsg msg={erro} />
      <div className="cfg-group">
        <div className="cfg-group-title">Identificação</div>
        <div className="cnpj-row">
          <div className="cfg-field" style={{flex:1}}>
            <label>CNPJ</label>
            <input className="input-light" value={cnpj} onChange={e => setCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
            {cnpjErro && <span className="field-erro">{cnpjErro}</span>}
          </div>
          <button className="btn-cnpj" onClick={buscarCNPJ} disabled={cnpjLoading}>{cnpjLoading ? 'Buscando...' : 'Buscar Receita'}</button>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Razão Social <span className="req">*</span></label><input className="input-light" value={nome} onChange={e => setNome(e.target.value)} placeholder="Razão Social" /></div>
          <div className="cfg-field"><label>Nome Fantasia</label><input className="input-light" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Nome Fantasia" /></div>
        </div>
      </div>
      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving?'Salvando...':'Salvar Cliente'}</button>
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
  const [erro, setErro] = useState('')
  const areaSort = useSort()
  const projSort = useSort()

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
    setSaving(true); setErro('')
    try {
      if (area.id) {
        const { error } = await supabase.from('areas').update({ nome: area.nome, prefixo: area.prefixo.toUpperCase(), peso: parseFloat(area.peso)||0, gerente: area.gerente, resp_processo: (area.resp_processo||'').trim() }).eq('id', area.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('areas').insert({ projeto_id: projetoId, nome: area.nome, prefixo: area.prefixo.toUpperCase(), peso: parseFloat(area.peso)||0, gerente: area.gerente, resp_processo: (area.resp_processo||'').trim(), ordem: areas.length+1 })
        if (error) throw new Error(error.message)
      }
      setEditandoArea(null); setNovaArea(false); await loadDados(); setSaving(false)
      window.dispatchEvent(new CustomEvent('polimata:areas-updated'))
    } catch(e) { setErro(traduzirErro(e.message)); setSaving(false) }
  }

  async function removerArea(id) {
    if (!confirm('Remover esta área?')) return
    const { error } = await supabase.from('areas').delete().eq('id', id)
    if (error) { setErro(traduzirErro(error.message)); return }
    loadDados()
  }

  async function adicionarSistema() {
    if (!novaSisNome.trim()) return
    const { error } = await supabase.from('sistemas').insert({ cliente_id: cliente.id, nome: novaSisNome.trim() })
    if (error) { setErro(traduzirErro(error.message)); return }
    setNovaSisNome(''); loadDados()
  }

  async function removerSistema(id) {
    const { error } = await supabase.from('sistemas').delete().eq('id', id)
    if (error) { setErro(traduzirErro(error.message)); return }
    loadDados()
  }

  async function salvarProjeto(proj) {
    setSaving(true); setErro('')
    try {
      const payload = {
        nome: proj.nome,
        ativo: proj.ativo,
        num_fases: proj.num_fases ?? 5,
        matriz_tamanho: proj.matriz_tamanho ?? 4,
      }
      if (proj.id) {
        const { count } = await supabase
          .from('mrc').select('id', { count: 'exact', head: true })
          .eq('projeto_id', proj.id)
        if ((count || 0) > 0) delete payload.matriz_tamanho
        const { error } = await supabase.from('projetos').update(payload).eq('id', proj.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('projetos').insert({ cliente_id: cliente.id, ...payload })
        if (error) throw new Error(error.message)
      }
      setEditandoProj(null); setNovoProj(false); await loadDados(); setSaving(false)
    } catch(e) { setErro(traduzirErro(e.message)); setSaving(false) }
  }

  async function removerProjeto(id) {
    if (!confirm('Remover este projeto? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('projetos').delete().eq('id', id)
    if (error) { setErro(traduzirErro(error.message)); return }
    loadDados()
  }

  return (
    <div className="cfg-detalhe">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onBack}>&larr; Voltar</button>
        <div style={{flex:1}}>
          <div className="cfg-form-title">{cliente.nome}</div>
          <div className="cfg-form-sub" style={{display:'flex',gap:8,alignItems:'center'}}>
            {cliente.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
          </div>
        </div>
        <button className="btn-cfg-template" onClick={() => gerarTemplateMRC(cliente.nome)} title="Baixar planilha vazia para mapeamento de processos">Template MRC</button>
      </div>
      <ErroMsg msg={erro} />
      <div className="cfg-tabs" style={{marginBottom:20}}>
        {['areas','sistemas','projetos'].map(t => (
          <button key={t} className={`cfg-tab ${aba===t?'active':''}`} onClick={()=>{setAba(t);setErro('')}}>
            {t==='areas'?'Processos / Áreas':t==='sistemas'?'Sistemas':'Projetos'}
          </button>
        ))}
      </div>
      {loading ? <div className="cfg-loading"><div className="spinner"/></div> : (
        <>
          {/* ── ABA ÁREAS ── */}
          {aba==='areas' && (
            <div>
              {!projetoId && <div className="cfg-aviso">Cadastre um projeto primeiro para adicionar áreas.</div>}
              {projetoId && (
                <>
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
                    <button className="btn-cfg-sm" onClick={()=>setNovaArea(true)}>+ Nova Área</button>
                  </div>
                  {novaArea && <AreaForm area={{nome:'',prefixo:'',peso: areas.length === 0 ? '1' : '',gerente:'',resp_processo:''}} totalAreas={areas.length} onSave={salvarArea} onCancel={()=>setNovaArea(false)} saving={saving} />}
                  <div className="cfg-table-wrap">
                    <table className="cfg-table">
                      <thead><tr>
                        {[{h:'Processo',k:'nome'},{h:'Prefixo',k:'prefixo'},{h:'Peso',k:'peso'},{h:'Gerente',k:'gerente'},{h:'Resp. Processo',k:'resp_processo'}].map(c => (
                          <th key={c.k} className={`th-sort${areaSort.sortKey===c.k?' sorted':''}`} onClick={() => areaSort.toggleSort(c.k)} style={{cursor:'pointer',userSelect:'none'}}>{c.h}<span className="sort-arrow">{areaSort.sortIndicator(c.k)}</span></th>
                        ))}
                        <th style={{width:80}}></th>
                      </tr></thead>
                      <tbody>
                        {areaSort.sortData(areas).map(a => (
                          editandoArea?.id===a.id ? (
                            <tr key={a.id}><td colSpan={6}><AreaForm area={editandoArea} totalAreas={areas.length} onSave={salvarArea} onCancel={()=>setEditandoArea(null)} saving={saving} inline /></td></tr>
                          ) : (
                            <tr key={a.id}>
                              <td>{a.nome}</td>
                              <td><span className="tag-prefixo">{a.prefixo}</span></td>
                              <td>{(a.peso*100).toFixed(1)}%</td>
                              <td style={{color:'var(--txt2)'}}>{a.gerente||'—'}</td>
                              <td style={{color:'var(--txt2)'}}>{a.resp_processo||'—'}</td>
                              <td><div style={{display:'flex',gap:6}}><button className="btn-tbl-edit" onClick={()=>setEditandoArea({...a})}>&#9998;</button><button className="btn-tbl-del" onClick={()=>removerArea(a.id)}>&#10005;</button></div></td>
                            </tr>
                          )
                        ))}
                        {!areas.length && <tr><td colSpan={6} style={{textAlign:'center',color:'var(--txt3)',padding:24}}>Nenhuma área cadastrada.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ABA SISTEMAS ── */}
          {aba==='sistemas' && (
            <div>
              <div className="cfg-chips" style={{marginBottom:16}}>
                {sistemas.map(s => (
                  <div key={s.id} className="cfg-chip" style={{display:'flex',alignItems:'center',gap:8}}>
                    {s.nome}
                    <button onClick={()=>removerSistema(s.id)} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:12,padding:0}}>&#10005;</button>
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
                  <thead><tr>
                    {[{h:'Nome do Projeto',k:'nome'},{h:'Fases',k:'num_fases'},{h:'Matriz',k:'matriz_tamanho'},{h:'Status',k:'ativo'}].map(c => (
                      <th key={c.k} className={`th-sort${projSort.sortKey===c.k?' sorted':''}`} onClick={() => projSort.toggleSort(c.k)} style={{cursor:'pointer',userSelect:'none'}}>{c.h}<span className="sort-arrow">{projSort.sortIndicator(c.k)}</span></th>
                    ))}
                    <th style={{width:80}}></th>
                  </tr></thead>
                  <tbody>
                    {projSort.sortData(projetos).map(p => (
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
                          <td style={{textAlign:'center'}}>{(p.matriz_tamanho ?? 4)}&times;{(p.matriz_tamanho ?? 4)}</td>
                          <td>{p.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}</td>
                          <td>
                            <div style={{display:'flex',gap:6}}>
                              <button className="btn-tbl-edit" onClick={()=>setEditandoProj({...p})}>&#9998;</button>
                              <button className="btn-tbl-del" onClick={()=>removerProjeto(p.id)}>&#10005;</button>
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
// FORM ÁREA (com auto-cálculo de peso)
// ══════════════════════════════════════════════════════
function AreaForm({ area, totalAreas, onSave, onCancel, saving, inline }) {
  const isNew = !area.id
  const defaultPeso = isNew && totalAreas >= 0 ? (1 / (totalAreas + 1)) : area.peso
  const [form, setForm] = useState({...area, peso: area.peso || defaultPeso})
  const [pesoEditado, setPesoEditado] = useState(!!area.id)
  const u = (f,v) => setForm(p=>({...p,[f]:v}))

  function handlePesoChange(val) {
    setPesoEditado(true)
    u('peso', val)
  }

  const pesoDisplay = form.peso !== '' ? (parseFloat(form.peso) * 100).toFixed(1) : ''

  return (
    <div className={inline?'area-form-inline':'cfg-area-block'} style={{marginBottom:12}}>
      <div className="cfg-row3">
        <div className="cfg-field"><label>Processo <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Compras" /></div>
        <div className="cfg-field"><label>Prefixo <span className="req">*</span></label><input className="input-light" value={form.prefixo} onChange={e=>u('prefixo',e.target.value.toUpperCase())} placeholder="COM" maxLength={8} /></div>
        <div className="cfg-field">
          <label>Peso (%) {!pesoEditado && isNew && <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:9,color:'var(--txt3)'}}>auto</span>}</label>
          <input className="input-light" type="number" value={pesoDisplay} onChange={e => handlePesoChange(e.target.value ? parseFloat(e.target.value)/100 : '')} placeholder={isNew ? `${(100/(totalAreas+1)).toFixed(1)}` : '13.5'} min="0.1" step="0.1"
            style={form.peso !== '' && !(parseFloat(form.peso) > 0) ? {borderColor:'#EF4444'} : {}} />
          {form.peso !== '' && !(parseFloat(form.peso) > 0) && <span className="field-erro">Peso deve ser maior que 0%</span>}
          {!pesoEditado && isNew && <span style={{fontSize:10,color:'var(--txt3)',marginTop:2}}>Calculado automaticamente. Edite para ajustar.</span>}
        </div>
      </div>
      <div className="cfg-row2" style={{marginTop:10}}>
        <div className="cfg-field"><label>Gerente</label><input className="input-light" value={form.gerente} onChange={e=>u('gerente',e.target.value)} placeholder="Nome do gerente" /></div>
        <div className="cfg-field"><label>Responsável do Processo</label><input className="input-light" value={form.resp_processo||''} onChange={e=>u('resp_processo',e.target.value)} placeholder="Nome do responsável" /></div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={()=>onSave(form)} disabled={saving||!form.nome.trim()||!form.prefixo.trim()||!(parseFloat(form.peso)>0)}>{saving?'Salvando...':'Salvar'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FORM PROJETO (com descrição das fases)
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

  useEffect(() => {
    if (!projeto.id) return
    ;(async () => {
      const { count } = await supabase
        .from('mrc').select('id', { count: 'exact', head: true })
        .eq('projeto_id', projeto.id)
      const tem = (count || 0) > 0
      setTemControles(tem)
      if (!tem) return

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
                {n} {n===1?'fase':'fases'}{n < faseMinima ? ' (há dados)' : ''}
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
                <option value={form.matriz_tamanho}>{form.matriz_tamanho} &times; {form.matriz_tamanho}</option>
              </select>
              <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>
                Não pode ser alterada — projeto já possui controles cadastrados
              </span>
            </>
          ) : (
            <select className="input-light" value={form.matriz_tamanho} onChange={e=>u('matriz_tamanho', parseInt(e.target.value))}>
              <option value={4}>4 &times; 4 (Padrão)</option>
              <option value={5}>5 &times; 5</option>
            </select>
          )}
        </div>
      </div>
      {/* Descrição das fases incluídas */}
      <div className="cfg-fases-desc" style={{marginTop:14}}>
        <div style={{fontSize:10,fontWeight:600,color:'var(--txt2)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Fases incluídas neste projeto</div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {Array.from({length: form.num_fases}, (_,i) => i+1).map(n => (
            <div key={n} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 10px',borderRadius:6,background:'var(--bg3)',border:'1px solid var(--brd)'}}>
              <span style={{fontWeight:600,fontSize:11,color:'var(--gold)',minWidth:22}}>F{n}</span>
              <span style={{fontSize:12,color:'var(--txt1)'}}>{FASES_DESC[n]}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={()=>onSave({...projeto, ...form})} disabled={saving||!form.nome.trim()}>{saving?'Salvando...':'Salvar'}</button>
      </div>
    </div>
  )
}
