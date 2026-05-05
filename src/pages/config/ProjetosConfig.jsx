import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProjetosConfig({ projetoIdInicial }) {
  const [clientes, setClientes] = useState([])
  const [projetos, setProjetos] = useState([])
  const [projetoSel, setProjetoSel] = useState(null)
  const [modo, setModo] = useState(projetoIdInicial ? 'detalhe' : null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProjetos() }, [])

  async function loadProjetos() {
    setLoading(true)
    const [{ data: projs }, { data: cls }] = await Promise.all([
      supabase.from('projetos').select('*, clientes(id, nome, nome_fantasia)').order('nome'),
      supabase.from('clientes').select('id, nome, nome_fantasia').order('nome'),
    ])
    setProjetos(projs || [])
    setClientes(cls || [])
    if (projetoIdInicial && !projetoSel) {
      const p = (projs || []).find(x => x.id === projetoIdInicial)
      if (p) { setProjetoSel(p); setModo('detalhe') }
    }
    setLoading(false)
  }

  function fechar() { setModo(null); setProjetoSel(null); loadProjetos() }

  if (loading) return <div className="cfg-loading"><div className="spinner" /></div>

  return (
    <div className="cfg-section">
      {!modo && (
        <>
          <div className="cfg-section-hdr">
            <div>
              <div className="cfg-section-title">Projetos</div>
              <div className="cfg-section-sub">{projetos.length} projeto{projetos.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="btn-cfg-add" onClick={() => setModo('novo')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Novo Projeto
            </button>
          </div>
          <div className="cfg-cards">
            {projetos.map(p => (
              <div key={p.id} className="cfg-card" onClick={() => { setProjetoSel(p); setModo('detalhe') }}>
                <div className="cfg-card-avatar" style={{borderRadius:8,fontSize:14}}>{(p.nome||'P')[0]}</div>
                <div className="cfg-card-info">
                  <div className="cfg-card-nome">{p.nome}</div>
                  <div className="cfg-card-meta">
                    {p.clientes?.nome_fantasia || p.clientes?.nome || '—'}
                    <span style={{margin:'0 4px',opacity:0.3}}>·</span>
                    {p.num_fases ?? 5} fases · {(p.matriz_tamanho??4)}×{(p.matriz_tamanho??4)}
                    {p.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
                  </div>
                </div>
                <div className="cfg-card-arrow">›</div>
              </div>
            ))}
            {!projetos.length && <div className="cfg-empty">Nenhum projeto cadastrado.</div>}
          </div>
        </>
      )}
      {modo === 'novo' && <NovoProjetoForm clientes={clientes} onSave={fechar} onCancel={fechar} />}
      {modo === 'detalhe' && projetoSel && <DetalheProjeto projeto={projetoSel} onBack={fechar} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// NOVO PROJETO
// ══════════════════════════════════════════════════════
function NovoProjetoForm({ clientes, onSave, onCancel }) {
  const [form, setForm] = useState({
    nome: '', cliente_id: '', ativo: true,
    num_fases: 5, matriz_tamanho: 4,
    sponsor_nome: '', sponsor_sobrenome: '', sponsor_cargo: '', sponsor_email: '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome do projeto é obrigatório'); return }
    if (!form.cliente_id) { setErro('Selecione o cliente'); return }
    setSaving(true); setErro('')
    try {
      const { error } = await supabase.from('projetos').insert({
        nome: form.nome.trim(),
        cliente_id: form.cliente_id,
        ativo: form.ativo,
        num_fases: form.num_fases,
        matriz_tamanho: form.matriz_tamanho,
        sponsor_nome: form.sponsor_nome.trim() || null,
        sponsor_sobrenome: form.sponsor_sobrenome.trim() || null,
        sponsor_cargo: form.sponsor_cargo.trim() || null,
        sponsor_email: form.sponsor_email.trim() || null,
      })
      if (error) throw new Error(error.message)
      onSave()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-form">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onCancel}>← Voltar</button>
        <div><div className="cfg-form-title">Novo Projeto</div><div className="cfg-form-sub">Configure as informações do projeto</div></div>
      </div>
      {erro && <div className="cfg-erro">{erro}</div>}

      <div className="cfg-group">
        <div className="cfg-group-title">Dados do Projeto</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome do Projeto <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Controles Internos 2026" /></div>
          <div className="cfg-field"><label>Cliente <span className="req">*</span></label>
            <select className="input-light" value={form.cliente_id} onChange={e=>u('cliente_id',e.target.value)}>
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia || c.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="cfg-row3">
          <div className="cfg-field"><label>Fases</label>
            <select className="input-light" value={form.num_fases} onChange={e=>u('num_fases',parseInt(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n===1?'fase':'fases'}</option>)}
            </select>
          </div>
          <div className="cfg-field"><label>Matriz de Calor</label>
            <select className="input-light" value={form.matriz_tamanho} onChange={e=>u('matriz_tamanho',parseInt(e.target.value))}>
              <option value={4}>4 × 4</option><option value={5}>5 × 5</option>
            </select>
          </div>
          <div className="cfg-field"><label>Status</label>
            <select className="input-light" value={form.ativo?'ativo':'inativo'} onChange={e=>u('ativo',e.target.value==='ativo')}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cfg-group">
        <div className="cfg-group-title">Sponsor do Projeto</div>
        <div className="cfg-form-sub" style={{marginTop:-6,marginBottom:4}}>Responsável executivo que receberá o relatório geral do projeto</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.sponsor_nome} onChange={e=>u('sponsor_nome',e.target.value)} placeholder="Nome" /></div>
          <div className="cfg-field"><label>Sobrenome</label><input className="input-light" value={form.sponsor_sobrenome} onChange={e=>u('sponsor_sobrenome',e.target.value)} placeholder="Sobrenome" /></div>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Cargo</label><input className="input-light" value={form.sponsor_cargo} onChange={e=>u('sponsor_cargo',e.target.value)} placeholder="Ex: Diretor Financeiro" /></div>
          <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.sponsor_email} onChange={e=>u('sponsor_email',e.target.value)} placeholder="sponsor@empresa.com" /></div>
        </div>
      </div>

      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving?'Salvando...':'✓ Criar Projeto'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// DETALHE PROJETO (abas: Características, Estrutura, Responsáveis)
// ══════════════════════════════════════════════════════
function DetalheProjeto({ projeto, onBack }) {
  const [dados, setDados] = useState(null)
  const [areas, setAreas] = useState([])
  const [subprocessos, setSubprocessos] = useState([])
  // responsaveis removido — gerência e resp. área já estão na Estrutura Organizacional
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('caract')
  const [editandoCaract, setEditandoCaract] = useState(false)

  const loadDados = useCallback(async () => {
    setLoading(true)
    const [{ data: proj }, { data: ars }, { data: subs }] = await Promise.all([
      supabase.from('projetos').select('*, clientes(nome, nome_fantasia)').eq('id', projeto.id).single(),
      supabase.from('areas').select('*').eq('projeto_id', projeto.id).order('ordem'),
      supabase.from('subprocessos').select('*').order('ordem'),
    ])
    setDados(proj)
    setAreas(ars || [])
    const areaIds = new Set((ars || []).map(a => a.id))
    setSubprocessos((subs || []).filter(s => areaIds.has(s.area_id)))
    setLoading(false)
  }, [projeto.id])

  useEffect(() => { loadDados() }, [loadDados])

  if (loading || !dados) return <div className="cfg-loading"><div className="spinner"/></div>

  return (
    <div className="cfg-detalhe">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onBack}>← Voltar</button>
        <div style={{flex:1}}>
          <div className="cfg-form-title">{dados.nome}</div>
          <div className="cfg-form-sub" style={{display:'flex',gap:8,alignItems:'center'}}>
            {dados.clientes?.nome_fantasia || dados.clientes?.nome}
            <span style={{opacity:0.3}}>·</span>
            {dados.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
          </div>
        </div>
      </div>

      <div className="cfg-tabs" style={{marginBottom:20,marginTop:16}}>
        {[
          {id:'caract', label:'Características'},
          {id:'estrutura', label:'Estrutura Organizacional'},
        ].map(t => (
          <button key={t.id} className={`cfg-tab ${aba===t.id?'active':''}`} onClick={()=>setAba(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'caract' && (
        <AbaCaracteristicas dados={dados} onUpdate={loadDados} editando={editandoCaract} setEditando={setEditandoCaract} />
      )}
      {aba === 'estrutura' && (
        <AbaEstrutura projetoId={projeto.id} areas={areas} subprocessos={subprocessos} onReload={loadDados} />
      )}
    </div>
  )
}

// ── Aba Características ──
function AbaCaracteristicas({ dados, onUpdate, editando, setEditando }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [temControles, setTemControles] = useState(false)
  const [faseMinima, setFaseMinima] = useState(1)

  useEffect(() => {
    setForm({
      nome: dados.nome || '',
      ativo: dados.ativo !== false,
      num_fases: dados.num_fases ?? 5,
      matriz_tamanho: dados.matriz_tamanho ?? 4,
      sponsor_nome: dados.sponsor_nome || '',
      sponsor_sobrenome: dados.sponsor_sobrenome || '',
      sponsor_cargo: dados.sponsor_cargo || '',
      sponsor_email: dados.sponsor_email || '',
    })
    // Check constraints
    ;(async () => {
      const { count } = await supabase.from('mrc').select('id', { count:'exact', head:true }).eq('projeto_id', dados.id)
      const tem = (count || 0) > 0
      setTemControles(tem)
      if (!tem) return
      const { data: rows } = await supabase.from('mrc').select('r1, r_ader, r3, r_f4c1, r_f4c2, r_f5').eq('projeto_id', dados.id)
      let max = 1
      for (const r of (rows||[])) {
        if (r.r_f5) { max = 5; break }
        if (r.r_f4c1 || r.r_f4c2) max = Math.max(max, 4)
        if (r.r3) max = Math.max(max, 3)
        if (r.r_ader) max = Math.max(max, 2)
      }
      setFaseMinima(max)
    })()
  }, [dados])

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    setSaving(true); setErro('')
    try {
      const payload = {
        nome: form.nome.trim(), ativo: form.ativo,
        num_fases: form.num_fases,
        sponsor_nome: form.sponsor_nome.trim() || null,
        sponsor_sobrenome: form.sponsor_sobrenome.trim() || null,
        sponsor_cargo: form.sponsor_cargo.trim() || null,
        sponsor_email: form.sponsor_email.trim() || null,
      }
      if (!temControles) payload.matriz_tamanho = form.matriz_tamanho
      const { error } = await supabase.from('projetos').update(payload).eq('id', dados.id)
      if (error) throw new Error(error.message)
      setEditando(false); onUpdate()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  if (!editando) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:20}}>
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <button className="btn-cfg-sm" onClick={()=>setEditando(true)}>✏ Editar</button>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Dados do Projeto</div>
          <div className="usr-info-grid">
            <InfoCell label="Nome" value={dados.nome} />
            <InfoCell label="Status" value={dados.ativo ? 'Ativo' : 'Inativo'} />
            <InfoCell label="Fases" value={`${dados.num_fases ?? 5} fases`} />
            <InfoCell label="Matriz de Calor" value={`${dados.matriz_tamanho??4}×${dados.matriz_tamanho??4}`} />
          </div>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Sponsor do Projeto</div>
          <div className="usr-info-grid">
            <InfoCell label="Nome" value={[dados.sponsor_nome, dados.sponsor_sobrenome].filter(Boolean).join(' ') || null} />
            <InfoCell label="Cargo" value={dados.sponsor_cargo} />
            <InfoCell label="Email" value={dados.sponsor_email} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-form" style={{gap:16}}>
      {erro && <div className="cfg-erro">{erro}</div>}
      <div className="cfg-group">
        <div className="cfg-group-title">Dados do Projeto</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} /></div>
          <div className="cfg-field"><label>Status</label>
            <select className="input-light" value={form.ativo?'ativo':'inativo'} onChange={e=>u('ativo',e.target.value==='ativo')}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Fases</label>
            <select className="input-light" value={form.num_fases} onChange={e=>u('num_fases',parseInt(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n} disabled={n<faseMinima}>{n} {n===1?'fase':'fases'}{n<faseMinima?' (há dados)':''}</option>)}
            </select>
            {faseMinima > 1 && <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Fase mínima: F{faseMinima}</span>}
          </div>
          <div className="cfg-field"><label>Matriz de Calor</label>
            {temControles ? (
              <><select className="input-light" value={form.matriz_tamanho} disabled style={{opacity:0.6}}><option>{form.matriz_tamanho}×{form.matriz_tamanho}</option></select>
              <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Travada — projeto com controles</span></>
            ) : (
              <select className="input-light" value={form.matriz_tamanho} onChange={e=>u('matriz_tamanho',parseInt(e.target.value))}>
                <option value={4}>4 × 4</option><option value={5}>5 × 5</option>
              </select>
            )}
          </div>
        </div>
      </div>
      <div className="cfg-group">
        <div className="cfg-group-title">Sponsor do Projeto</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.sponsor_nome} onChange={e=>u('sponsor_nome',e.target.value)} /></div>
          <div className="cfg-field"><label>Sobrenome</label><input className="input-light" value={form.sponsor_sobrenome} onChange={e=>u('sponsor_sobrenome',e.target.value)} /></div>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Cargo</label><input className="input-light" value={form.sponsor_cargo} onChange={e=>u('sponsor_cargo',e.target.value)} /></div>
          <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.sponsor_email} onChange={e=>u('sponsor_email',e.target.value)} /></div>
        </div>
      </div>
      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={()=>setEditando(false)}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving?'Salvando...':'✓ Salvar'}</button>
      </div>
    </div>
  )
}

// ── Aba Estrutura Organizacional ──
function AbaEstrutura({ projetoId, areas, subprocessos, onReload }) {
  const [novaArea, setNovaArea] = useState(false)
  const [editandoArea, setEditandoArea] = useState(null)
  const [saving, setSaving] = useState(false)
  const [novoSub, setNovoSub] = useState({}) // { [areaId]: nome }
  const [expandido, setExpandido] = useState({}) // { [areaId]: bool }

  function toggleExpand(areaId) { setExpandido(p => ({...p, [areaId]: !p[areaId]})) }

  async function salvarArea(area) {
    setSaving(true)
    const subNomes = area._subprocessos || []
    const payload = {
      nome: area.nome, prefixo: (area.prefixo||'').toUpperCase(),
      peso: parseFloat(area.peso) || 0,
      gerencia: area.gerencia || null,
      gerencia_email: area.gerencia_email || null,
      gerencia_recebe_email_mensal: !!area.gerencia_recebe_email_mensal,
      resp_area_nome: area.resp_area_nome || null,
      resp_area_email: area.resp_area_email || null,
      resp_area_recebe_email_mensal: !!area.resp_area_recebe_email_mensal,
    }
    let areaId = area.id
    if (area.id) {
      await supabase.from('areas').update(payload).eq('id', area.id)
    } else {
      const numAreas = areas.length + 1
      if (!payload.peso) payload.peso = parseFloat((1 / numAreas).toFixed(4))
      const { data: inserted } = await supabase.from('areas').insert({ projeto_id: projetoId, ...payload, ordem: areas.length + 1 }).select('id').single()
      areaId = inserted?.id
      await recalcPesos(projetoId, numAreas)
    }
    // Sincronizar subprocessos: remover antigos, inserir novos
    if (areaId) {
      const existentes = subprocessos.filter(s => s.area_id === areaId)
      const existentesNomes = existentes.map(s => s.nome)
      // Remover os que foram apagados
      const remover = existentes.filter(s => !subNomes.includes(s.nome))
      for (const s of remover) { await supabase.from('subprocessos').delete().eq('id', s.id) }
      // Inserir os novos
      const novos = subNomes.filter(n => !existentesNomes.includes(n))
      if (novos.length > 0) {
        const baseOrdem = existentes.length - remover.length
        await supabase.from('subprocessos').insert(novos.map((n, i) => ({ area_id: areaId, nome: n, ordem: baseOrdem + i + 1 })))
      }
    }
    setEditandoArea(null); setNovaArea(false); setSaving(false)
    onReload()
    window.dispatchEvent(new CustomEvent('polimata:areas-updated'))
  }

  async function removerArea(id) {
    if (!confirm('Remover esta área e todos os seus subprocessos?')) return
    await supabase.from('areas').delete().eq('id', id)
    onReload()
    window.dispatchEvent(new CustomEvent('polimata:areas-updated'))
  }

  async function adicionarSubprocesso(areaId) {
    const nome = (novoSub[areaId] || '').trim()
    if (!nome) return
    const count = subprocessos.filter(s => s.area_id === areaId).length
    await supabase.from('subprocessos').insert({ area_id: areaId, nome, ordem: count + 1 })
    setNovoSub(p => ({...p, [areaId]: ''}))
    onReload()
  }

  async function removerSubprocesso(id) {
    await supabase.from('subprocessos').delete().eq('id', id)
    onReload()
  }

  const subsMap = {}
  subprocessos.forEach(s => { if (!subsMap[s.area_id]) subsMap[s.area_id] = []; subsMap[s.area_id].push(s) })

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:11,color:'var(--txt3)'}}>
          {areas.length} área{areas.length !== 1 ? 's' : ''} · Peso total: {(areas.reduce((s,a) => s + (a.peso||0), 0) * 100).toFixed(1)}%
        </div>
        <button className="btn-cfg-sm" onClick={() => setNovaArea(true)}>+ Nova Área</button>
      </div>

      {novaArea && (
        <AreaFormV2 area={{nome:'',prefixo:'',peso:'',gerencia:'',gerencia_email:'',gerencia_recebe_email_mensal:false,resp_area_nome:'',resp_area_email:'',resp_area_recebe_email_mensal:false}}
          onSave={salvarArea} onCancel={()=>setNovaArea(false)} saving={saving} />
      )}

      {areas.map(a => (
        <div key={a.id} style={{marginBottom:12}}>
          {editandoArea?.id === a.id ? (
            <AreaFormV2 area={editandoArea} onSave={salvarArea} onCancel={()=>setEditandoArea(null)} saving={saving} subprocessosExistentes={subsMap[editandoArea.id]||[]} />
          ) : (
            <div className="cfg-group" style={{padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,flex:1,cursor:'pointer'}} onClick={()=>toggleExpand(a.id)}>
                  <span style={{fontSize:10,color:'var(--txt3)',transition:'transform .15s',transform:expandido[a.id]?'rotate(90deg)':'rotate(0)'}}>{'▶'}</span>
                  <span className="tag-prefixo">{a.prefixo}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--txt1)'}}>{a.nome}</div>
                    {!expandido[a.id] && (
                      <div style={{fontSize:10,color:'var(--txt3)',marginTop:2}}>
                        {a.gerencia && <span>Gerência: {a.gerencia} · </span>}
                        {a.resp_area_nome && <span>Resp: {a.resp_area_nome} · </span>}
                        Peso: {(a.peso*100).toFixed(1)}%
                        <span style={{margin:'0 4px',opacity:0.3}}>·</span>
                        {(subsMap[a.id]||[]).length} subprocesso{(subsMap[a.id]||[]).length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn-tbl-edit" onClick={()=>setEditandoArea({...a})}>✏</button>
                  <button className="btn-tbl-del" onClick={()=>removerArea(a.id)}>✕</button>
                </div>
              </div>

              {expandido[a.id] && (
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                  {/* Dados gerais */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px 20px',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Área / Processo</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.nome || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Prefixo</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.prefixo || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Peso (%)</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.peso ? (a.peso*100).toFixed(1)+'%' : '—'}</div>
                    </div>
                  </div>

                  {/* Gerência */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Gerência</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.gerencia || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Email da Gerência {a.gerencia_recebe_email_mensal && <span style={{fontSize:10,color:'var(--copper-text)',marginLeft:4,fontWeight:700}} title="Recebe e-mail mensal">✉</span>}</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.gerencia_email || '—'}</div>
                    </div>
                  </div>

                  {/* Responsável */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Responsável da Área</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.resp_area_nome || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Email do Responsável {a.resp_area_recebe_email_mensal && <span style={{fontSize:10,color:'var(--copper-text)',marginLeft:4,fontWeight:700}} title="Recebe e-mail mensal">✉</span>}</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.resp_area_email || '—'}</div>
                    </div>
                  </div>

                  {/* Subprocessos */}
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>Subprocessos</div>
                    {(subsMap[a.id]||[]).length > 0 ? (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 20px'}}>
                        {(subsMap[a.id]||[]).map(s => (
                          <div key={s.id} style={{fontSize:12,color:'var(--txt2)',padding:'4px 0'}}>• {s.nome}</div>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:11,color:'var(--txt3)',fontStyle:'italic'}}>Nenhum subprocesso cadastrado</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {!areas.length && !novaArea && <div className="cfg-empty">Nenhuma área cadastrada. Clique em "+ Nova Área" para começar.</div>}
    </div>
  )
}

async function recalcPesos(projetoId, totalAreas) {
  if (totalAreas < 1) return
  const pesoIgual = parseFloat((1 / totalAreas).toFixed(4))
  const { data: ars } = await supabase.from('areas').select('id, peso').eq('projeto_id', projetoId)
  // Only recalc if all weights are 0 or if there's a new area with 0
  const allZero = (ars || []).every(a => !a.peso || a.peso === 0)
  if (allZero) {
    for (const a of (ars || [])) {
      await supabase.from('areas').update({ peso: pesoIgual }).eq('id', a.id)
    }
  }
}

function AreaFormV2({ area, onSave, onCancel, saving, subprocessosExistentes }) {
  const [form, setForm] = useState({...area})
  const existentes = (subprocessosExistentes || []).map(s => s.nome)
  const iniciais = existentes.length > 0 ? existentes : Array(10).fill('')
  // Garantir pelo menos 10 campos
  while (iniciais.length < 10) iniciais.push('')
  const [subs, setSubs] = useState(iniciais)
  const u = (f,v) => setForm(p=>({...p,[f]:v}))
  const uSub = (i,v) => { const n = [...subs]; n[i] = v; setSubs(n) }
  const addMoreSubs = () => setSubs(p => [...p, ...Array(5).fill('')])

  function handleSave() {
    const subNomes = subs.map(s => s.trim()).filter(Boolean)
    onSave({ ...form, _subprocessos: subNomes })
  }

  return (
    <div className="cfg-area-block" style={{marginBottom:12}}>
      <div className="cfg-row3">
        <div className="cfg-field"><label>Área / Processo <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Compras" /></div>
        <div className="cfg-field"><label>Prefixo <span className="req">*</span></label><input className="input-light" value={form.prefixo} onChange={e=>u('prefixo',e.target.value.toUpperCase())} placeholder="COM" maxLength={8} /></div>
        <div className="cfg-field"><label>Peso (%)</label><input className="input-light" type="number" value={form.peso ? (form.peso * 100).toFixed(1) : ''} onChange={e=>u('peso', e.target.value ? parseFloat(e.target.value)/100 : 0)} placeholder="Auto" min="0" step="0.1" />
          <span style={{fontSize:10,color:'var(--txt3)'}}>Deixe vazio para calcular automaticamente</span>
        </div>
      </div>
      <div className="cfg-row2" style={{marginTop:10}}>
        <div className="cfg-field"><label>Gerência</label><input className="input-light" value={form.gerencia||''} onChange={e=>u('gerencia',e.target.value)} placeholder="Ex: Diretoria Financeira" /></div>
        <div className="cfg-field">
          <label>Email da Gerência</label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <label style={{display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:10,color:'var(--txt3, #94a3b8)',whiteSpace:'nowrap',padding:'0 6px',border:'1px solid var(--lt-border, rgba(0,32,62,0.12))',borderRadius:6,height:32}} title="Marque para receber o e-mail de reporte mensal">
              <input type="checkbox" checked={!!form.gerencia_recebe_email_mensal} onChange={e=>u('gerencia_recebe_email_mensal', e.target.checked)} />
              ✉ mensal
            </label>
            <input className="input-light" style={{flex:1}} type="email" value={form.gerencia_email||''} onChange={e=>u('gerencia_email',e.target.value)} placeholder="gerencia@empresa.com" />
          </div>
        </div>
      </div>
      <div className="cfg-row2" style={{marginTop:10}}>
        <div className="cfg-field"><label>Responsável da Área</label><input className="input-light" value={form.resp_area_nome||''} onChange={e=>u('resp_area_nome',e.target.value)} placeholder="Nome do responsável" /></div>
        <div className="cfg-field">
          <label>Email do Responsável</label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <label style={{display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:10,color:'var(--txt3, #94a3b8)',whiteSpace:'nowrap',padding:'0 6px',border:'1px solid var(--lt-border, rgba(0,32,62,0.12))',borderRadius:6,height:32}} title="Marque para receber o e-mail de reporte mensal">
              <input type="checkbox" checked={!!form.resp_area_recebe_email_mensal} onChange={e=>u('resp_area_recebe_email_mensal', e.target.checked)} />
              ✉ mensal
            </label>
            <input className="input-light" style={{flex:1}} type="email" value={form.resp_area_email||''} onChange={e=>u('resp_area_email',e.target.value)} placeholder="resp@empresa.com" />
          </div>
        </div>
      </div>

      {/* Subprocessos inline */}
      <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.08)'}}>
        <label style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:10,display:'block'}}>Subprocessos</label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px'}}>
          {subs.map((s,i) => (
            <input key={i} className="input-light" style={{fontSize:11}} value={s} onChange={e=>uSub(i,e.target.value)}
              placeholder={`Subprocesso ${i+1}`} />
          ))}
        </div>
        <button type="button" onClick={addMoreSubs}
          style={{background:'none',border:'none',color:'var(--copper, #CC915E)',cursor:'pointer',fontSize:11,fontWeight:500,marginTop:8,padding:'4px 0',fontFamily:'inherit'}}>
          + Mais campos
        </button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={handleSave} disabled={saving||!form.nome?.trim()||!form.prefixo?.trim()}>{saving?'Salvando...':'✓ Salvar'}</button>
      </div>
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
