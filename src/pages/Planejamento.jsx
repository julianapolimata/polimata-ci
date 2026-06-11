// ═══════════════════════════════════════════════════════════════════════════
// Planejamento.jsx — Módulo Planejamento Estratégico (BSC + OKR integrados)
// Painel (saúde 100% calculada no banco: views v_pe_*) · Estrutura (CRUD com
// edição e pesos: perspectivas → objetivos → KRs → iniciativas) · Check-ins ·
// Integração (vínculo OPCIONAL com a Gestão Orçamentária via pe_config +
// pe_budget_links; o realizado alimenta os KRs sozinho por trigger).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatNomeEmpresa } from '../lib/formatNome'

const COR = 'var(--prod-planejamento)'
const TH = { padding: '7px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--lt-brd)' }
const TD = { padding: '6px 10px', fontSize: 12.5, color: 'var(--lt-text)', textAlign: 'left', borderBottom: '1px solid var(--lt-brd)' }

const corSaude = (h) => (h >= 0.7 ? '#15803D' : h >= 0.4 ? '#B45309' : '#B91C1C')
const bgSaude = (h) => (h >= 0.7 ? 'rgba(21,128,61,0.10)' : h >= 0.4 ? 'rgba(180,83,9,0.10)' : 'rgba(185,28,28,0.10)')
const pct = (v) => (v == null ? '—' : Math.round(Number(v) * 100) + '%')
const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }))
const btnPrimario = (disabled) => ({ background: COR, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 })
const btnSecundario = () => ({ background: 'none', border: '1px solid var(--prod-planejamento)', color: COR, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const btnMini = () => ({ background: 'none', border: '1px solid var(--lt-brd)', color: 'var(--lt-text3)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' })
const lblMini = () => ({ fontSize: 10.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 3 })
const STATUS_INI = [['a_fazer', 'A fazer'], ['em_andamento', 'Em andamento'], ['concluida', 'Concluída'], ['bloqueada', 'Bloqueada']]

export default function Planejamento({ projeto }) {
  const { perfil } = useAuth()
  const isPolimata = ['admin_polimata', 'consultor_polimata'].includes(perfil?.papel)
  const isAdmin = perfil?.papel === 'admin_polimata'
  const [tab, setTab] = useState('painel')
  const [perspectivas, setPerspectivas] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [krs, setKrs] = useState([])
  const [iniciativas, setIniciativas] = useState([])
  const [config, setConfig] = useState(null)
  const [links, setLinks] = useState([])
  const [progresso, setProgresso] = useState([])
  const [saudeObj, setSaudeObj] = useState([])
  const [saudePersp, setSaudePersp] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const loadTudo = useCallback(async () => {
    if (!projeto?.id) return
    setLoading(true); setErro('')
    try {
      const pid = projeto.id
      const [pRes, oRes, kRes, prRes, soRes, spRes, perRes, iniRes, cfgRes, lnkRes] = await Promise.all([
        supabase.from('pe_perspectivas').select('*').eq('projeto_id', pid).order('ordem').order('nome'),
        supabase.from('pe_objetivos').select('*').eq('projeto_id', pid).order('criado_em'),
        supabase.from('pe_key_results').select('*').eq('projeto_id', pid).order('criado_em'),
        supabase.from('v_pe_kr_progresso').select('*').eq('projeto_id', pid),
        supabase.from('v_pe_objetivo_saude').select('*').eq('projeto_id', pid),
        supabase.from('v_pe_perspectiva_saude').select('*').eq('projeto_id', pid),
        supabase.from('pe_periodos').select('*').eq('projeto_id', pid).order('data_inicio'),
        supabase.from('pe_iniciativas').select('*').eq('projeto_id', pid).order('criado_em'),
        supabase.from('pe_config').select('*').eq('projeto_id', pid).maybeSingle(),
        supabase.from('pe_budget_links').select('*').eq('projeto_id', pid).order('criado_em'),
      ])
      const firstErr = [pRes, oRes, kRes, prRes, soRes, spRes, perRes, iniRes, lnkRes].find(r => r.error)
      if (firstErr) throw firstErr.error
      setPerspectivas(pRes.data || []); setObjetivos(oRes.data || []); setKrs(kRes.data || [])
      setProgresso(prRes.data || []); setSaudeObj(soRes.data || []); setSaudePersp(spRes.data || [])
      setPeriodos(perRes.data || []); setIniciativas(iniRes.data || [])
      setConfig(cfgRes.data || null); setLinks(lnkRes.data || [])
    } catch (e) {
      console.error(e); setErro('Erro ao carregar o planejamento estratégico.')
    } finally { setLoading(false) }
  }, [projeto?.id])

  useEffect(() => { loadTudo() }, [loadTudo])

  const progPorKr = useMemo(() => Object.fromEntries(progresso.map(p => [p.key_result_id, p])), [progresso])
  const saudePorObj = useMemo(() => Object.fromEntries(saudeObj.map(s => [s.objetivo_id, s])), [saudeObj])
  const saudePorPersp = useMemo(() => Object.fromEntries(saudePersp.map(s => [s.perspectiva_id, s])), [saudePersp])

  if (!projeto) return null
  const vinculoAtivo = !!(config?.orcamento_vinculado && config?.orc_projeto_id)

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>
            {formatNomeEmpresa(projeto.clientes?.nome_fantasia || projeto.clientes?.nome)} · {projeto.nome}
          </div>
          <h1 style={{ fontFamily: 'Raleway, Montserrat, sans-serif', fontSize: 24, fontWeight: 300, color: '#00203E', letterSpacing: 0.3, margin: '2px 0 0' }}>Planejamento Estratégico</h1>
        </div>
        {vinculoAtivo && <span style={{ background: 'rgba(34,185,138,0.12)', color: '#0E7A5A', borderRadius: 999, padding: '4px 12px', fontSize: 11.5, fontWeight: 600 }}>⛓ Vinculado à Gestão Orçamentária</span>}
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--lt-brd)', marginBottom: 16 }}>
        {[['painel', 'Painel'], ['estrutura', 'Estrutura'], ['checkins', 'Check-ins'], ['integracao', 'Integração']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: 'none', border: 'none', borderBottom: tab === id ? '2px solid var(--prod-planejamento)' : '2px solid transparent', marginBottom: -2, padding: '8px 16px', fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? 'var(--lt-text)' : 'var(--lt-text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {erro && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#991B1B', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{erro}</div>}
      {loading ? <div style={{ color: 'var(--lt-text3)', fontSize: 13, padding: 30 }}>Carregando…</div> : (<>
        {tab === 'painel' && <TabPainel perspectivas={perspectivas} objetivos={objetivos} krs={krs} iniciativas={iniciativas} progPorKr={progPorKr} saudePorObj={saudePorObj} saudePorPersp={saudePorPersp} periodos={periodos} irParaEstrutura={() => setTab('estrutura')} />}
        {tab === 'estrutura' && <TabEstrutura projeto={projeto} perspectivas={perspectivas} objetivos={objetivos} krs={krs} periodos={periodos} iniciativas={iniciativas} links={links} reload={loadTudo} canEdit={isPolimata} isAdmin={isAdmin} setErro={setErro} />}
        {tab === 'checkins' && <TabCheckins projeto={projeto} perfil={perfil} perspectivas={perspectivas} objetivos={objetivos} krs={krs} progPorKr={progPorKr} reload={loadTudo} setErro={setErro} />}
        {tab === 'integracao' && <TabIntegracao projeto={projeto} config={config} links={links} krs={krs} objetivos={objetivos} reload={loadTudo} canEdit={isPolimata} isAdmin={isAdmin} setErro={setErro} />}
      </>)}
    </div>
  )
}

function Chip({ texto, tom }) {
  const cores = tom === 'verde' ? ['rgba(34,185,138,0.12)', '#0E7A5A'] : ['rgba(142,124,216,0.12)', '#5B4BA8']
  return <span style={{ background: cores[0], color: cores[1], borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{texto}</span>
}

function Badge({ valor, label, compact }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!compact && <span style={{ fontSize: 10.5, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>}
      <span style={{ background: bgSaude(valor), color: corSaude(valor), borderRadius: 999, padding: compact ? '2px 10px' : '4px 14px', fontSize: compact ? 12 : 14, fontWeight: 800 }}>
        {pct(valor)}
      </span>
    </div>
  )
}

function BtnExcluir({ onClick }) {
  return <button onClick={onClick} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--lt-text3)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>🗑</button>
}
function BtnEditar({ onClick }) {
  return <button onClick={onClick} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--lt-text3)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✏️</button>
}

// ─── Painel BSC ─────────────────────────────────────────────────────────────
function TabPainel({ perspectivas, objetivos, krs, iniciativas, progPorKr, saudePorObj, saudePorPersp, periodos, irParaEstrutura }) {
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  if (perspectivas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 8 }}>Seu plano estratégico começa aqui</div>
        <div style={{ fontSize: 13, color: 'var(--lt-text3)', maxWidth: 520, margin: '0 auto 18px', lineHeight: 1.6 }}>
          O caminho tem 4 passos: <strong>1.</strong> crie as perspectivas do BSC · <strong>2.</strong> defina os objetivos estratégicos de cada uma · <strong>3.</strong> crie os key results com baseline e meta · <strong>4.</strong> registre check-ins. O painel calcula progresso e saúde sozinho.
        </div>
        <button onClick={irParaEstrutura} style={btnPrimario(false)}>Montar a estrutura →</button>
      </div>
    )
  }
  const objFiltrado = (o) => !filtroPeriodo || o.periodo_id === filtroPeriodo
  const perNome = (id) => (periodos.find(x => x.id === id) || {}).nome
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {periodos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <label style={{ fontSize: 11.5, color: 'var(--lt-text3)' }}>Onda / Período</label>
          <select className="input-light" style={{ width: 220, fontSize: 12 }} value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
            <option value="">Todos</option>
            {periodos.map(pe => <option key={pe.id} value={pe.id}>{pe.nome}</option>)}
          </select>
        </div>
      )}
      {perspectivas.map(p => {
        const saude = Number(saudePorPersp[p.id]?.saude ?? 0)
        const objs = objetivos.filter(o => o.perspectiva_id === p.id).filter(objFiltrado)
        if (filtroPeriodo && objs.length === 0) return null
        return (
          <div key={p.id} style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ borderTop: '3px solid ' + COR, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 15, fontWeight: 600, color: '#00203E' }}>{p.nome}</div>
              <Badge valor={saude} label="saúde da perspectiva" />
            </div>
            {objs.length === 0 && <div style={{ padding: '0 18px 14px', fontSize: 12.5, color: 'var(--lt-text3)' }}>Sem objetivos nesta perspectiva.</div>}
            {objs.map(o => {
              const so = Number(saudePorObj[o.id]?.saude ?? 0)
              const oKrs = krs.filter(k => k.objetivo_id === o.id)
              const oIni = iniciativas.filter(i => i.objetivo_id === o.id)
              const iniDone = oIni.filter(i => i.status === 'concluida').length
              return (
                <div key={o.id} style={{ borderTop: '1px solid var(--lt-brd)', padding: '10px 18px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lt-text)' }}>{o.titulo}</span>
                      {o.classificacao && <Chip texto={o.classificacao === 'operacional' ? 'Operacional' : 'Estratégico'} />}
                      {o.periodo_id && perNome(o.periodo_id) && <Chip texto={perNome(o.periodo_id)} />}
                      {Number(o.peso) !== 1 && <Chip texto={'peso ' + fmtNum(o.peso)} />}
                      {oIni.length > 0 && <Chip tom="verde" texto={iniDone + '/' + oIni.length + ' iniciativas'} />}
                    </div>
                    <Badge valor={so} label="saúde" compact />
                  </div>
                  {oKrs.length === 0 && <div style={{ fontSize: 12, color: 'var(--lt-text3)' }}>Sem key results.</div>}
                  {oKrs.map(k => {
                    const pr = progPorKr[k.id]
                    const prog = Number(pr?.progresso ?? 0)
                    return (
                      <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                        <div style={{ flex: '1 1 260px', fontSize: 12.5, color: 'var(--lt-text)' }}>{k.descricao}{Number(k.peso) !== 1 && <span style={{ color: 'var(--lt-text3)', fontSize: 11 }}> · peso {fmtNum(k.peso)}</span>}</div>
                        <div style={{ flex: '0 0 110px', fontSize: 11.5, color: 'var(--lt-text3)', textAlign: 'right' }}>
                          {fmtNum(pr?.valor_atual)} / {fmtNum(k.valor_meta)}
                        </div>
                        <div style={{ flex: '0 0 180px', height: 8, background: 'var(--lt-brd)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: Math.round(prog * 100) + '%', height: '100%', background: corSaude(prog), transition: 'width .3s' }} />
                        </div>
                        <div style={{ flex: '0 0 44px', fontSize: 12, fontWeight: 700, color: corSaude(prog), textAlign: 'right' }}>{pct(prog)}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Estrutura (CRUD com edição) ────────────────────────────────────────────
function TabEstrutura({ projeto, perspectivas, objetivos, krs, periodos, iniciativas, links, reload, canEdit, isAdmin, setErro }) {
  const [novaPersp, setNovaPersp] = useState('')
  const [novoObj, setNovoObj] = useState({})
  const [novoKr, setNovoKr] = useState({})
  const [novaIni, setNovaIni] = useState({})
  const [editObj, setEditObj] = useState(null)   // { id, ...campos }
  const [editKr, setEditKr] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [novoPer, setNovoPer] = useState({ nome: '', inicio: '', fim: '' })

  const uobj = (perspId, campo, v) => setNovoObj(prev => ({ ...prev, [perspId]: { ...(prev[perspId] || {}), [campo]: v } }))
  const ukr = (objId, campo, v) => setNovoKr(prev => ({ ...prev, [objId]: { ...(prev[objId] || {}), [campo]: v } }))

  async function addPerspectiva() {
    if (!novaPersp.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('pe_perspectivas').insert({ projeto_id: projeto.id, nome: novaPersp.trim(), ordem: perspectivas.length })
    setSalvando(false)
    if (error) { setErro('Erro ao criar perspectiva: ' + error.message); return }
    setNovaPersp(''); reload()
  }

  async function criarModeloBSC() {
    setSalvando(true)
    const padrao = ['Financeira', 'Clientes', 'Processos Internos', 'Aprendizado e Crescimento']
    const { error } = await supabase.from('pe_perspectivas').insert(padrao.map((nome, i) => ({ projeto_id: projeto.id, nome, ordem: i })))
    setSalvando(false)
    if (error) { setErro('Erro ao criar modelo: ' + error.message); return }
    reload()
  }

  async function addPeriodo() {
    if (!novoPer.nome.trim() || !novoPer.inicio || !novoPer.fim) { setErro('Período precisa de nome, início e fim.'); return }
    const { error } = await supabase.from('pe_periodos').insert({ projeto_id: projeto.id, nome: novoPer.nome.trim(), tipo: 'custom', data_inicio: novoPer.inicio, data_fim: novoPer.fim })
    if (error) { setErro('Erro ao criar período: ' + error.message); return }
    setNovoPer({ nome: '', inicio: '', fim: '' }); reload()
  }

  async function addObjetivo(perspId) {
    const f = novoObj[perspId] || {}
    const titulo = (f.titulo || '').trim()
    if (!titulo) return
    const { error } = await supabase.from('pe_objetivos').insert({
      projeto_id: projeto.id, perspectiva_id: perspId, titulo,
      classificacao: f.classificacao || null, entregavel: (f.entregavel || '').trim() || null, periodo_id: f.periodo_id || null,
    })
    if (error) { setErro('Erro ao criar objetivo: ' + error.message); return }
    setNovoObj(prev => ({ ...prev, [perspId]: {} })); reload()
  }

  async function salvarObjetivo() {
    const { error } = await supabase.from('pe_objetivos').update({
      titulo: editObj.titulo.trim(), descricao: (editObj.descricao || '').trim() || null,
      classificacao: editObj.classificacao || null, entregavel: (editObj.entregavel || '').trim() || null,
      periodo_id: editObj.periodo_id || null, peso: Number(editObj.peso || 1),
    }).eq('id', editObj.id)
    if (error) { setErro('Erro ao salvar objetivo: ' + error.message); return }
    setEditObj(null); reload()
  }

  async function addKr(objId) {
    const f = novoKr[objId] || {}
    if (!(f.descricao || '').trim() || f.meta === undefined || f.meta === '') { setErro('Key result precisa de descrição e meta.'); return }
    const { error } = await supabase.from('pe_key_results').insert({
      projeto_id: projeto.id, objetivo_id: objId, descricao: f.descricao.trim(),
      valor_baseline: Number(f.baseline || 0), valor_meta: Number(f.meta), direcao: f.direcao || 'aumentar',
      como_medir: (f.como_medir || '').trim() || null, periodicidade: (f.periodicidade || '').trim() || null,
    })
    if (error) { setErro('Erro ao criar key result: ' + error.message); return }
    setNovoKr(prev => ({ ...prev, [objId]: {} })); reload()
  }

  async function salvarKr() {
    const { error } = await supabase.from('pe_key_results').update({
      descricao: editKr.descricao.trim(), valor_baseline: Number(editKr.valor_baseline || 0),
      valor_meta: Number(editKr.valor_meta), direcao: editKr.direcao, peso: Number(editKr.peso || 1),
      como_medir: (editKr.como_medir || '').trim() || null, periodicidade: (editKr.periodicidade || '').trim() || null,
    }).eq('id', editKr.id)
    if (error) { setErro('Erro ao salvar key result: ' + error.message); return }
    setEditKr(null); reload()
  }

  async function addIniciativa(objId) {
    const titulo = (novaIni[objId] || '').trim()
    if (!titulo) return
    const { error } = await supabase.from('pe_iniciativas').insert({ projeto_id: projeto.id, objetivo_id: objId, titulo })
    if (error) { setErro('Erro ao criar iniciativa: ' + error.message); return }
    setNovaIni(prev => ({ ...prev, [objId]: '' })); reload()
  }

  async function setStatusIniciativa(ini, status) {
    const { error } = await supabase.from('pe_iniciativas').update({ status }).eq('id', ini.id)
    if (error) { setErro(error.message); return }
    reload()
  }

  async function remover(tabela, id, rotulo) {
    if (!window.confirm('Excluir ' + rotulo + '? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (error) { setErro('Erro ao excluir: ' + error.message); return }
    reload()
  }

  const krVinculado = (krId) => links.some(l => l.key_result_id === krId && l.ativo)

  return (
    <div style={{ maxWidth: 940 }}>
      {canEdit && (
        <div style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Ondas / Períodos do plano</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {periodos.map(pe => (
              <span key={pe.id} style={{ background: 'rgba(142,124,216,0.12)', color: '#5B4BA8', borderRadius: 999, padding: '4px 12px', fontSize: 11.5, fontWeight: 600 }}>
                {pe.nome}
                {isAdmin && <button onClick={() => remover('pe_periodos', pe.id, 'o período "' + pe.nome + '"')} style={{ background: 'none', border: 'none', color: '#5B4BA8', cursor: 'pointer', marginLeft: 6, padding: 0, fontSize: 11 }}>×</button>}
              </span>
            ))}
            <input className="input-light" style={{ width: 180, fontSize: 12 }} placeholder="Ex: 1ª Onda (0–8 meses)" value={novoPer.nome} onChange={e => setNovoPer(p => ({ ...p, nome: e.target.value }))} />
            <input className="input-light" type="date" style={{ width: 135, fontSize: 12 }} value={novoPer.inicio} onChange={e => setNovoPer(p => ({ ...p, inicio: e.target.value }))} />
            <input className="input-light" type="date" style={{ width: 135, fontSize: 12 }} value={novoPer.fim} onChange={e => setNovoPer(p => ({ ...p, fim: e.target.value }))} />
            <button onClick={addPeriodo} style={btnSecundario()}>+ Período</button>
          </div>
        </div>
      )}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 4 }}>Nova perspectiva (BSC)</label>
            <input className="input-light" value={novaPersp} onChange={e => setNovaPersp(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPerspectiva()} placeholder="Ex: Financeira, Clientes, Processos Internos, Aprendizado e Crescimento" />
          </div>
          <button onClick={addPerspectiva} disabled={salvando || !novaPersp.trim()} style={btnPrimario(salvando || !novaPersp.trim())}>Adicionar</button>
        </div>
      )}
      {perspectivas.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed var(--lt-brd)', borderRadius: 12, padding: '26px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 6 }}>Por onde começar</div>
          <div style={{ fontSize: 12.5, color: 'var(--lt-text3)', maxWidth: 560, margin: '0 auto 8px', lineHeight: 1.6 }}>
            As <strong>perspectivas</strong> são as lentes do Balanced Scorecard. Dentro de cada uma você cria <strong>objetivos estratégicos</strong>; cada objetivo ganha <strong>key results</strong> mensuráveis (baseline → meta); e as medições entram na aba <strong>Check-ins</strong>.
          </div>
          {canEdit ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={criarModeloBSC} disabled={salvando} style={btnPrimario(salvando)}>Usar o modelo BSC clássico (4 perspectivas)</button>
              <span style={{ fontSize: 12, color: 'var(--lt-text3)' }}>ou crie as suas no campo acima</span>
            </div>
          ) : <div style={{ fontSize: 12.5, color: 'var(--lt-text3)' }}>O consultor responsável montará a estrutura inicial.</div>}
        </div>
      )}
      {perspectivas.map(p => (
        <div key={p.id} style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ borderLeft: '4px solid ' + COR, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14.5, fontWeight: 600, color: '#00203E' }}>{p.nome}</div>
            {isAdmin && <BtnExcluir onClick={() => remover('pe_perspectivas', p.id, 'a perspectiva "' + p.nome + '"')} />}
          </div>
          <div style={{ padding: '0 16px 14px' }}>
            {objetivos.filter(o => o.perspectiva_id === p.id).map(o => (
              <div key={o.id} style={{ border: '1px solid var(--lt-brd)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                {editObj?.id === o.id ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
                    <div style={{ flex: '2 1 220px' }}><label style={lblMini()}>Objetivo</label>
                      <input className="input-light" style={{ fontSize: 12.5 }} value={editObj.titulo} onChange={e => setEditObj(s => ({ ...s, titulo: e.target.value }))} /></div>
                    <div><label style={lblMini()}>Classif.</label>
                      <select className="input-light" style={{ width: 125, fontSize: 12 }} value={editObj.classificacao || ''} onChange={e => setEditObj(s => ({ ...s, classificacao: e.target.value }))}>
                        <option value="">—</option><option value="estrategico">Estratégico</option><option value="operacional">Operacional</option>
                      </select></div>
                    <div><label style={lblMini()}>Onda / Período</label>
                      <select className="input-light" style={{ width: 165, fontSize: 12 }} value={editObj.periodo_id || ''} onChange={e => setEditObj(s => ({ ...s, periodo_id: e.target.value }))}>
                        <option value="">—</option>
                        {periodos.map(pe => <option key={pe.id} value={pe.id}>{pe.nome}</option>)}
                      </select></div>
                    <div><label style={lblMini()}>Peso</label>
                      <input className="input-light" type="number" step="0.1" min="0" style={{ width: 70, fontSize: 12 }} value={editObj.peso} onChange={e => setEditObj(s => ({ ...s, peso: e.target.value }))} /></div>
                    <div style={{ flex: '1 1 160px' }}><label style={lblMini()}>Entregável</label>
                      <input className="input-light" style={{ fontSize: 12 }} value={editObj.entregavel || ''} onChange={e => setEditObj(s => ({ ...s, entregavel: e.target.value }))} /></div>
                    <button onClick={salvarObjetivo} style={btnPrimario(false)}>Salvar</button>
                    <button onClick={() => setEditObj(null)} style={btnMini()}>Cancelar</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>🎯 {o.titulo}</span>
                        {o.classificacao && <Chip texto={o.classificacao === 'operacional' ? 'Operacional' : 'Estratégico'} />}
                        {o.periodo_id && (periodos.find(x => x.id === o.periodo_id) || {}).nome && <Chip texto={(periodos.find(x => x.id === o.periodo_id) || {}).nome} />}
                        {Number(o.peso) !== 1 && <Chip texto={'peso ' + fmtNum(o.peso)} />}
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {canEdit && <BtnEditar onClick={() => setEditObj({ ...o })} />}
                        {isAdmin && <BtnExcluir onClick={() => remover('pe_objetivos', o.id, 'o objetivo "' + o.titulo + '"')} />}
                      </div>
                    </div>
                    {o.entregavel && <div style={{ fontSize: 11.5, color: 'var(--lt-text3)', marginBottom: 6 }}>📦 Entregável: {o.entregavel}</div>}
                  </>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={TH}>Key Result / Como medir</th><th style={{ ...TH, textAlign: 'right' }}>Baseline</th><th style={{ ...TH, textAlign: 'right' }}>Meta</th><th style={TH}>Direção</th><th style={{ ...TH, textAlign: 'right' }}>Peso</th><th style={TH}>Periodicidade</th>{canEdit && <th style={TH} />}</tr></thead>
                  <tbody>
                    {krs.filter(k => k.objetivo_id === o.id).map(k => (
                      editKr?.id === k.id ? (
                        <tr key={k.id}>
                          <td style={TD} colSpan={canEdit ? 7 : 6}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', padding: '4px 0' }}>
                              <div style={{ flex: '2 1 200px' }}><label style={lblMini()}>Key Result</label>
                                <input className="input-light" style={{ fontSize: 12 }} value={editKr.descricao} onChange={e => setEditKr(s => ({ ...s, descricao: e.target.value }))} /></div>
                              <div><label style={lblMini()}>Baseline</label>
                                <input className="input-light" type="number" step="0.01" style={{ width: 90, fontSize: 12 }} value={editKr.valor_baseline} onChange={e => setEditKr(s => ({ ...s, valor_baseline: e.target.value }))} /></div>
                              <div><label style={lblMini()}>Meta</label>
                                <input className="input-light" type="number" step="0.01" style={{ width: 90, fontSize: 12 }} value={editKr.valor_meta} onChange={e => setEditKr(s => ({ ...s, valor_meta: e.target.value }))} /></div>
                              <div><label style={lblMini()}>Direção</label>
                                <select className="input-light" style={{ width: 110, fontSize: 12 }} value={editKr.direcao} onChange={e => setEditKr(s => ({ ...s, direcao: e.target.value }))}>
                                  <option value="aumentar">▲ aumentar</option><option value="reduzir">▼ reduzir</option>
                                </select></div>
                              <div><label style={lblMini()}>Peso</label>
                                <input className="input-light" type="number" step="0.1" min="0" style={{ width: 70, fontSize: 12 }} value={editKr.peso} onChange={e => setEditKr(s => ({ ...s, peso: e.target.value }))} /></div>
                              <div style={{ flex: '2 1 200px' }}><label style={lblMini()}>Como medir</label>
                                <input className="input-light" style={{ fontSize: 12 }} value={editKr.como_medir || ''} onChange={e => setEditKr(s => ({ ...s, como_medir: e.target.value }))} /></div>
                              <div><label style={lblMini()}>Periodicidade</label>
                                <input className="input-light" style={{ width: 130, fontSize: 12 }} value={editKr.periodicidade || ''} onChange={e => setEditKr(s => ({ ...s, periodicidade: e.target.value }))} /></div>
                              <button onClick={salvarKr} style={btnPrimario(false)}>Salvar</button>
                              <button onClick={() => setEditKr(null)} style={btnMini()}>Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={k.id}>
                          <td style={TD}>{k.descricao}{krVinculado(k.id) && <span title="Alimentado pela Gestão Orçamentária"> ⛓</span>}{k.como_medir && <div style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 2 }}>{k.como_medir}</div>}</td>
                          <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(k.valor_baseline)}</td>
                          <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(k.valor_meta)}</td>
                          <td style={TD}>{k.direcao === 'reduzir' ? '▼ reduzir' : '▲ aumentar'}</td>
                          <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(k.peso)}</td>
                          <td style={TD}>{k.periodicidade || '—'}</td>
                          {canEdit && <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <BtnEditar onClick={() => setEditKr({ ...k })} />
                            {isAdmin && <BtnExcluir onClick={() => remover('pe_key_results', k.id, 'o key result "' + k.descricao + '"')} />}
                          </td>}
                        </tr>
                      )
                    ))}
                    {krs.filter(k => k.objetivo_id === o.id).length === 0 && <tr><td colSpan={7} style={{ ...TD, color: 'var(--lt-text3)' }}>Sem key results ainda.</td></tr>}
                  </tbody>
                </table>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <input className="input-light" style={{ flex: '2 1 200px', fontSize: 12 }} placeholder="Novo key result — ex: Receita recorrente mensal (R$ mil)"
                      value={(novoKr[o.id] || {}).descricao || ''} onChange={e => ukr(o.id, 'descricao', e.target.value)} />
                    <input className="input-light" type="number" style={{ width: 90, fontSize: 12 }} placeholder="Baseline" value={(novoKr[o.id] || {}).baseline ?? ''} onChange={e => ukr(o.id, 'baseline', e.target.value)} />
                    <input className="input-light" type="number" style={{ width: 90, fontSize: 12 }} placeholder="Meta" value={(novoKr[o.id] || {}).meta ?? ''} onChange={e => ukr(o.id, 'meta', e.target.value)} />
                    <select className="input-light" style={{ width: 110, fontSize: 12 }} value={(novoKr[o.id] || {}).direcao || 'aumentar'} onChange={e => ukr(o.id, 'direcao', e.target.value)}>
                      <option value="aumentar">▲ aumentar</option><option value="reduzir">▼ reduzir</option>
                    </select>
                    <input className="input-light" style={{ flex: '2 1 180px', fontSize: 12 }} placeholder="Como medir (fórmula)" value={(novoKr[o.id] || {}).como_medir || ''} onChange={e => ukr(o.id, 'como_medir', e.target.value)} />
                    <input className="input-light" style={{ width: 130, fontSize: 12 }} placeholder="Periodicidade" value={(novoKr[o.id] || {}).periodicidade || ''} onChange={e => ukr(o.id, 'periodicidade', e.target.value)} />
                    <button onClick={() => addKr(o.id)} style={btnSecundario()}>+ KR</button>
                  </div>
                )}
                {/* Iniciativas (planos de ação que movem os KRs) */}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--lt-brd)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Iniciativas</div>
                  {iniciativas.filter(i => i.objetivo_id === o.id).map(i => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                      {canEdit ? (
                        <select className="input-light" style={{ width: 140, fontSize: 11.5, padding: '3px 6px' }} value={i.status} onChange={e => setStatusIniciativa(i, e.target.value)}>
                          {STATUS_INI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : <Chip texto={(STATUS_INI.find(s => s[0] === i.status) || ['', i.status])[1]} />}
                      <span style={{ fontSize: 12.5, color: 'var(--lt-text)', textDecoration: i.status === 'concluida' ? 'line-through' : 'none', opacity: i.status === 'concluida' ? 0.6 : 1, flex: 1 }}>{i.titulo}</span>
                      {isAdmin && <BtnExcluir onClick={() => remover('pe_iniciativas', i.id, 'a iniciativa "' + i.titulo + '"')} />}
                    </div>
                  ))}
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input className="input-light" style={{ flex: 1, fontSize: 12 }} placeholder="Nova iniciativa / plano de ação que move este objetivo"
                        value={novaIni[o.id] || ''} onChange={e => setNovaIni(prev => ({ ...prev, [o.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addIniciativa(o.id)} />
                      <button onClick={() => addIniciativa(o.id)} style={btnSecundario()}>+ Iniciativa</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {canEdit && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <input className="input-light" style={{ flex: '2 1 200px', fontSize: 12.5 }} placeholder="Novo objetivo / ação nesta perspectiva"
                  value={(novoObj[p.id] || {}).titulo || ''} onChange={e => uobj(p.id, 'titulo', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addObjetivo(p.id)} />
                <select className="input-light" style={{ width: 130, fontSize: 12 }} value={(novoObj[p.id] || {}).classificacao || ''} onChange={e => uobj(p.id, 'classificacao', e.target.value)}>
                  <option value="">Classif.</option><option value="estrategico">Estratégico</option><option value="operacional">Operacional</option>
                </select>
                <select className="input-light" style={{ width: 170, fontSize: 12 }} value={(novoObj[p.id] || {}).periodo_id || ''} onChange={e => uobj(p.id, 'periodo_id', e.target.value)}>
                  <option value="">Onda / Período</option>
                  {periodos.map(pe => <option key={pe.id} value={pe.id}>{pe.nome}</option>)}
                </select>
                <input className="input-light" style={{ flex: '1 1 160px', fontSize: 12 }} placeholder="Entregável esperado (opcional)"
                  value={(novoObj[p.id] || {}).entregavel || ''} onChange={e => uobj(p.id, 'entregavel', e.target.value)} />
                <button onClick={() => addObjetivo(p.id)} style={btnSecundario()}>+ Objetivo</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Check-ins ──────────────────────────────────────────────────────────────
function TabCheckins({ projeto, perfil, perspectivas, objetivos, krs, progPorKr, reload, setErro }) {
  const [form, setForm] = useState({})
  const hoje = new Date().toISOString().slice(0, 10)
  const u = (krId, campo, v) => setForm(prev => ({ ...prev, [krId]: { ...(prev[krId] || {}), [campo]: v } }))

  async function registrar(kr) {
    const f = form[kr.id] || {}
    if (f.valor === undefined || f.valor === '') { setErro('Informe o valor da medição.'); return }
    const { error } = await supabase.from('pe_checkins').insert({
      projeto_id: projeto.id, key_result_id: kr.id, valor: Number(f.valor),
      data_medicao: f.data || hoje, comentario: (f.comentario || '').trim() || null,
      origem: 'manual', criado_por: perfil?.id || null,
    })
    if (error) { setErro('Erro ao registrar check-in: ' + error.message); return }
    setForm(prev => ({ ...prev, [kr.id]: {} })); reload()
  }

  if (krs.length === 0) {
    return <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--lt-text3)', fontSize: 14 }}>
      Nenhum key result cadastrado. Monte a estrutura primeiro — o progresso recalcula sozinho a cada medição.
    </div>
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ fontSize: 12, color: 'var(--lt-text3)', marginBottom: 12 }}>
        Registre a medição de cada key result. Progresso, saúde do objetivo e da perspectiva recalculam automaticamente — nada é calculado à mão. Medições vindas do orçamento entram sozinhas (origem “orçamento”).
      </div>
      {perspectivas.map(p => {
        const objs = objetivos.filter(o => o.perspectiva_id === p.id).filter(o => krs.some(k => k.objetivo_id === o.id))
        if (objs.length === 0) return null
        return (
          <div key={p.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{p.nome}</div>
            {objs.map(o => krs.filter(k => k.objetivo_id === o.id).map(k => {
              const pr = progPorKr[k.id]
              const f = form[k.id] || {}
              return (
                <div key={k.id} style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 240px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)' }}>{k.descricao}</div>
                    <div style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 2 }}>
                      {o.titulo} · atual {fmtNum(pr?.valor_atual)} · meta {fmtNum(k.valor_meta)} · <span style={{ color: corSaude(Number(pr?.progresso ?? 0)), fontWeight: 700 }}>{pct(pr?.progresso)}</span>
                      {pr?.data_ultima_medicao && ' · última medição ' + new Date(pr.data_ultima_medicao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div><label style={lblMini()}>Valor</label>
                    <input className="input-light" type="number" step="0.01" style={{ width: 110, fontSize: 12 }} value={f.valor ?? ''} onChange={e => u(k.id, 'valor', e.target.value)} /></div>
                  <div><label style={lblMini()}>Data</label>
                    <input className="input-light" type="date" style={{ width: 140, fontSize: 12 }} value={f.data || hoje} onChange={e => u(k.id, 'data', e.target.value)} /></div>
                  <div style={{ flex: '1 1 160px' }}><label style={lblMini()}>Comentário (opcional)</label>
                    <input className="input-light" style={{ fontSize: 12 }} value={f.comentario || ''} onChange={e => u(k.id, 'comentario', e.target.value)} /></div>
                  <button onClick={() => registrar(k)} disabled={f.valor === undefined || f.valor === ''} style={btnPrimario(f.valor === undefined || f.valor === '')}>Registrar</button>
                </div>
              )
            }))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Integração com a Gestão Orçamentária (vínculo opcional) ────────────────
function TabIntegracao({ projeto, config, links, krs, objetivos, reload, canEdit, isAdmin, setErro }) {
  const [orcProjetos, setOrcProjetos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [novoLink, setNovoLink] = useState({ kr: '', cat: '', metrica: 'realizado' })
  const vinculado = !!config?.orcamento_vinculado
  const orcId = config?.orc_projeto_id || ''

  useEffect(() => {
    supabase.from('projetos').select('id, nome').eq('cliente_id', projeto.cliente_id).eq('produto', 'orcamento').eq('ativo', true)
      .then(({ data }) => setOrcProjetos(data || []))
  }, [projeto.cliente_id])

  useEffect(() => {
    if (vinculado && orcId) {
      supabase.from('orc_categorias').select('id, nome, tipo').eq('projeto_id', orcId).eq('ativo', true).order('nome')
        .then(({ data }) => setCategorias(data || []))
    } else setCategorias([])
  }, [vinculado, orcId])

  async function salvarConfig(novo) {
    setSalvando(true)
    const { error } = await supabase.from('pe_config').upsert({ projeto_id: projeto.id, ...novo }, { onConflict: 'projeto_id' })
    setSalvando(false)
    if (error) { setErro('Erro ao salvar configuração: ' + error.message); return }
    reload()
  }

  async function addLink() {
    const kr = krs.find(k => k.id === novoLink.kr)
    const cat = categorias.find(c => c.id === novoLink.cat)
    if (!kr || !cat) { setErro('Selecione o key result e a categoria orçamentária.'); return }
    const { error } = await supabase.from('pe_budget_links').insert({
      projeto_id: projeto.id, key_result_id: kr.id, ref_externa: cat.id,
      rotulo_externo: cat.nome, metrica: novoLink.metrica, direcao: kr.direcao,
    })
    if (error) { setErro('Erro ao criar vínculo: ' + error.message); return }
    // dispara o primeiro cálculo imediatamente
    await supabase.rpc('pe_sync_orcamento_categoria', { p_orc_projeto: orcId, p_categoria: cat.id })
    setNovoLink({ kr: '', cat: '', metrica: 'realizado' }); reload()
  }

  async function removerLink(l) {
    if (!window.confirm('Remover o vínculo com "' + (l.rotulo_externo || l.ref_externa) + '"?')) return
    const { error } = await supabase.from('pe_budget_links').delete().eq('id', l.id)
    if (error) { setErro(error.message); return }
    reload()
  }

  const objDoKr = (k) => (objetivos.find(o => o.id === k.objetivo_id) || {}).titulo || ''

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 6 }}>Vínculo com a Gestão Orçamentária</div>
        <div style={{ fontSize: 12.5, color: 'var(--lt-text3)', lineHeight: 1.6, marginBottom: 12 }}>
          Opcional — nem toda empresa tem orçamento estruturado. Quando ligado, o valor <strong>realizado</strong> do módulo de Gestão Orçamentária alimenta automaticamente os key results vinculados (check-ins com origem “orçamento”), sem digitação manual. Quando desligado, os KRs financeiros são medidos por check-in normal.
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--lt-text)', cursor: canEdit ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={vinculado} disabled={!canEdit || salvando}
              onChange={e => salvarConfig({ orcamento_vinculado: e.target.checked, orc_projeto_id: e.target.checked ? (orcId || (orcProjetos[0] || {}).id || null) : null })} />
            Vincular este planejamento ao orçamento
          </label>
          {vinculado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--lt-text3)' }}>Projeto orçamentário</label>
              <select className="input-light" style={{ width: 260, fontSize: 12 }} value={orcId} disabled={!canEdit}
                onChange={e => salvarConfig({ orcamento_vinculado: true, orc_projeto_id: e.target.value || null })}>
                <option value="">Selecione…</option>
                {orcProjetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
        </div>
        {vinculado && orcProjetos.length === 0 && (
          <div style={{ fontSize: 12, color: '#B45309', marginTop: 10 }}>
            Este cliente ainda não tem projeto de Gestão Orçamentária. Crie um projeto do produto “Gestão Orçamentária” para o mesmo cliente e volte aqui.
          </div>
        )}
      </div>

      {vinculado && orcId && (
        <div style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 4 }}>Vínculos KR ↔ categoria orçamentária</div>
          <div style={{ fontSize: 12, color: 'var(--lt-text3)', lineHeight: 1.6, marginBottom: 12 }}>
            Métricas: <strong>Realizado</strong> = soma do realizado da categoria no ano corrente (para KRs de valor, ex.: receita) · <strong>Desvio</strong> = |realizado − orçado| ÷ orçado × 100, acumulado (para KRs de aderência orçamentária — use direção “reduzir”).
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead><tr><th style={TH}>Key Result</th><th style={TH}>Objetivo</th><th style={TH}>Categoria orçamentária</th><th style={TH}>Métrica</th>{canEdit && <th style={TH} />}</tr></thead>
            <tbody>
              {links.filter(l => l.ativo).map(l => {
                const k = krs.find(x => x.id === l.key_result_id)
                return (
                  <tr key={l.id}>
                    <td style={TD}>{k ? k.descricao : '—'}</td>
                    <td style={{ ...TD, color: 'var(--lt-text3)' }}>{k ? objDoKr(k) : '—'}</td>
                    <td style={TD}>{l.rotulo_externo || l.ref_externa}</td>
                    <td style={TD}>{l.metrica === 'desvio' ? 'Desvio (%)' : 'Realizado (R$)'}</td>
                    {canEdit && <td style={{ ...TD, textAlign: 'right' }}><BtnExcluir onClick={() => removerLink(l)} /></td>}
                  </tr>
                )
              })}
              {links.filter(l => l.ativo).length === 0 && <tr><td colSpan={5} style={{ ...TD, color: 'var(--lt-text3)' }}>Nenhum vínculo ainda.</td></tr>}
            </tbody>
          </table>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 220px' }}><label style={lblMini()}>Key Result</label>
                <select className="input-light" style={{ fontSize: 12 }} value={novoLink.kr} onChange={e => setNovoLink(s => ({ ...s, kr: e.target.value }))}>
                  <option value="">Selecione…</option>
                  {krs.map(k => <option key={k.id} value={k.id}>{k.descricao}</option>)}
                </select></div>
              <div style={{ flex: '2 1 200px' }}><label style={lblMini()}>Categoria orçamentária</label>
                <select className="input-light" style={{ fontSize: 12 }} value={novoLink.cat} onChange={e => setNovoLink(s => ({ ...s, cat: e.target.value }))}>
                  <option value="">Selecione…</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
                </select></div>
              <div><label style={lblMini()}>Métrica</label>
                <select className="input-light" style={{ width: 140, fontSize: 12 }} value={novoLink.metrica} onChange={e => setNovoLink(s => ({ ...s, metrica: e.target.value }))}>
                  <option value="realizado">Realizado (R$)</option>
                  <option value="desvio">Desvio (%)</option>
                </select></div>
              <button onClick={addLink} disabled={!novoLink.kr || !novoLink.cat} style={btnPrimario(!novoLink.kr || !novoLink.cat)}>Vincular</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
