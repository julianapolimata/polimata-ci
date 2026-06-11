// ═══════════════════════════════════════════════════════════════════════════
// Planejamento.jsx — Módulo Planejamento Estratégico (BSC + OKR integrados)
// Painel (saúde calculada 100% no banco: views v_pe_*) + Estrutura (CRUD
// perspectivas → objetivos → key results) + Check-ins (medições).
// Princípios: parametrizável com metodologia única; zero cálculo manual;
// integração com orçamento via pe_budget_links (origem 'orcamento').
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

export default function Planejamento({ projeto }) {
  const { perfil } = useAuth()
  const isPolimata = ['admin_polimata', 'consultor_polimata'].includes(perfil?.papel)
  const isAdmin = perfil?.papel === 'admin_polimata'
  const [tab, setTab] = useState('painel')
  const [perspectivas, setPerspectivas] = useState([])
  const [objetivos, setObjetivos] = useState([])
  const [krs, setKrs] = useState([])
  const [progresso, setProgresso] = useState([])      // v_pe_kr_progresso
  const [saudeObj, setSaudeObj] = useState([])        // v_pe_objetivo_saude
  const [saudePersp, setSaudePersp] = useState([])    // v_pe_perspectiva_saude
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const loadTudo = useCallback(async () => {
    if (!projeto?.id) return
    setLoading(true); setErro('')
    try {
      const pid = projeto.id
      const [pRes, oRes, kRes, prRes, soRes, spRes] = await Promise.all([
        supabase.from('pe_perspectivas').select('*').eq('projeto_id', pid).order('ordem').order('nome'),
        supabase.from('pe_objetivos').select('*').eq('projeto_id', pid).order('criado_em'),
        supabase.from('pe_key_results').select('*').eq('projeto_id', pid).order('criado_em'),
        supabase.from('v_pe_kr_progresso').select('*').eq('projeto_id', pid),
        supabase.from('v_pe_objetivo_saude').select('*').eq('projeto_id', pid),
        supabase.from('v_pe_perspectiva_saude').select('*').eq('projeto_id', pid),
      ])
      const firstErr = [pRes, oRes, kRes, prRes, soRes, spRes].find(r => r.error)
      if (firstErr) throw firstErr.error
      setPerspectivas(pRes.data || []); setObjetivos(oRes.data || []); setKrs(kRes.data || [])
      setProgresso(prRes.data || []); setSaudeObj(soRes.data || []); setSaudePersp(spRes.data || [])
    } catch (e) {
      console.error(e); setErro('Erro ao carregar o planejamento estratégico.')
    } finally { setLoading(false) }
  }, [projeto?.id])

  useEffect(() => { loadTudo() }, [loadTudo])

  const progPorKr = useMemo(() => Object.fromEntries(progresso.map(p => [p.key_result_id, p])), [progresso])
  const saudePorObj = useMemo(() => Object.fromEntries(saudeObj.map(s => [s.objetivo_id, s])), [saudeObj])
  const saudePorPersp = useMemo(() => Object.fromEntries(saudePersp.map(s => [s.perspectiva_id, s])), [saudePersp])

  if (!projeto) return null

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>
            {formatNomeEmpresa(projeto.clientes?.nome_fantasia || projeto.clientes?.nome)} · {projeto.nome}
          </div>
          <h1 style={{ fontFamily: 'Raleway, Montserrat, sans-serif', fontSize: 24, fontWeight: 300, color: '#00203E', letterSpacing: 0.3, margin: '2px 0 0' }}>Planejamento Estratégico</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--lt-brd)', marginBottom: 16 }}>
        {[['painel', 'Painel'], ['estrutura', 'Estrutura'], ['checkins', 'Check-ins']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: 'none', border: 'none', borderBottom: tab === id ? '2px solid ' + 'var(--prod-planejamento)' : '2px solid transparent', marginBottom: -2, padding: '8px 16px', fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? 'var(--lt-text)' : 'var(--lt-text3)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {erro && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#991B1B', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{erro}</div>}
      {loading ? <div style={{ color: 'var(--lt-text3)', fontSize: 13, padding: 30 }}>Carregando…</div> : (<>
        {tab === 'painel' && <TabPainel perspectivas={perspectivas} objetivos={objetivos} krs={krs} progPorKr={progPorKr} saudePorObj={saudePorObj} saudePorPersp={saudePorPersp} irParaEstrutura={() => setTab('estrutura')} />}
        {tab === 'estrutura' && <TabEstrutura projeto={projeto} perspectivas={perspectivas} objetivos={objetivos} krs={krs} reload={loadTudo} canEdit={isPolimata} isAdmin={isAdmin} setErro={setErro} />}
        {tab === 'checkins' && <TabCheckins projeto={projeto} perfil={perfil} perspectivas={perspectivas} objetivos={objetivos} krs={krs} progPorKr={progPorKr} reload={loadTudo} setErro={setErro} />}
      </>)}
    </div>
  )
}

// ─── Painel BSC ─────────────────────────────────────────────────────────────
function TabPainel({ perspectivas, objetivos, krs, progPorKr, saudePorObj, saudePorPersp, irParaEstrutura }) {
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {perspectivas.map(p => {
        const saude = Number(saudePorPersp[p.id]?.saude ?? 0)
        const objs = objetivos.filter(o => o.perspectiva_id === p.id)
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
              return (
                <div key={o.id} style={{ borderTop: '1px solid var(--lt-brd)', padding: '10px 18px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lt-text)' }}>{o.titulo}</div>
                    <Badge valor={so} label="saúde" compact />
                  </div>
                  {oKrs.length === 0 && <div style={{ fontSize: 12, color: 'var(--lt-text3)' }}>Sem key results.</div>}
                  {oKrs.map(k => {
                    const pr = progPorKr[k.id]
                    const prog = Number(pr?.progresso ?? 0)
                    return (
                      <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                        <div style={{ flex: '1 1 260px', fontSize: 12.5, color: 'var(--lt-text)' }}>{k.descricao}</div>
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

// ─── Estrutura (CRUD) ───────────────────────────────────────────────────────
function TabEstrutura({ projeto, perspectivas, objetivos, krs, reload, canEdit, isAdmin, setErro }) {
  const [novaPersp, setNovaPersp] = useState('')
  const [novoObj, setNovoObj] = useState({})   // perspId -> titulo
  const [novoKr, setNovoKr] = useState({})     // objId -> { descricao, baseline, meta, direcao }
  const [salvando, setSalvando] = useState(false)

  async function addPerspectiva() {
    if (!novaPersp.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('pe_perspectivas').insert({ projeto_id: projeto.id, nome: novaPersp.trim(), ordem: perspectivas.length })
    setSalvando(false)
    if (error) { setErro('Erro ao criar perspectiva: ' + error.message); return }
    setNovaPersp(''); reload()
  }

  async function addObjetivo(perspId) {
    const titulo = (novoObj[perspId] || '').trim()
    if (!titulo) return
    const { error } = await supabase.from('pe_objetivos').insert({ projeto_id: projeto.id, perspectiva_id: perspId, titulo })
    if (error) { setErro('Erro ao criar objetivo: ' + error.message); return }
    setNovoObj(prev => ({ ...prev, [perspId]: '' })); reload()
  }

  async function addKr(objId) {
    const f = novoKr[objId] || {}
    if (!(f.descricao || '').trim() || f.meta === undefined || f.meta === '') { setErro('Key result precisa de descrição e meta.'); return }
    const { error } = await supabase.from('pe_key_results').insert({
      projeto_id: projeto.id, objetivo_id: objId, descricao: f.descricao.trim(),
      valor_baseline: Number(f.baseline || 0), valor_meta: Number(f.meta), direcao: f.direcao || 'aumentar',
    })
    if (error) { setErro('Erro ao criar key result: ' + error.message); return }
    setNovoKr(prev => ({ ...prev, [objId]: {} })); reload()
  }

  async function remover(tabela, id, rotulo) {
    if (!window.confirm('Excluir ' + rotulo + '? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (error) { setErro('Erro ao excluir: ' + error.message); return }
    reload()
  }

  const ukr = (objId, campo, v) => setNovoKr(prev => ({ ...prev, [objId]: { ...(prev[objId] || {}), [campo]: v } }))

  async function criarModeloBSC() {
    setSalvando(true)
    const padrao = ['Financeira', 'Clientes', 'Processos Internos', 'Aprendizado e Crescimento']
    const { error } = await supabase.from('pe_perspectivas').insert(
      padrao.map((nome, i) => ({ projeto_id: projeto.id, nome, ordem: i })))
    setSalvando(false)
    if (error) { setErro('Erro ao criar modelo: ' + error.message); return }
    reload()
  }

  return (
    <div style={{ maxWidth: 900 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>🎯 {o.titulo}</div>
                  {isAdmin && <BtnExcluir onClick={() => remover('pe_objetivos', o.id, 'o objetivo "' + o.titulo + '"')} />}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={TH}>Key Result</th><th style={{ ...TH, textAlign: 'right' }}>Baseline</th><th style={{ ...TH, textAlign: 'right' }}>Meta</th><th style={TH}>Direção</th>{isAdmin && <th style={TH} />}</tr></thead>
                  <tbody>
                    {krs.filter(k => k.objetivo_id === o.id).map(k => (
                      <tr key={k.id}>
                        <td style={TD}>{k.descricao}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(k.valor_baseline)}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(k.valor_meta)}</td>
                        <td style={TD}>{k.direcao === 'reduzir' ? '▼ reduzir' : '▲ aumentar'}</td>
                        {isAdmin && <td style={{ ...TD, textAlign: 'right' }}><BtnExcluir onClick={() => remover('pe_key_results', k.id, 'o key result "' + k.descricao + '"')} /></td>}
                      </tr>
                    ))}
                    {krs.filter(k => k.objetivo_id === o.id).length === 0 && <tr><td colSpan={5} style={{ ...TD, color: 'var(--lt-text3)' }}>Sem key results ainda.</td></tr>}
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
                    <button onClick={() => addKr(o.id)} style={btnSecundario()}>+ KR</button>
                  </div>
                )}
              </div>
            ))}
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input className="input-light" style={{ flex: 1, fontSize: 12.5 }} placeholder="Novo objetivo estratégico nesta perspectiva"
                  value={novoObj[p.id] || ''} onChange={e => setNovoObj(prev => ({ ...prev, [p.id]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addObjetivo(p.id)} />
                <button onClick={() => addObjetivo(p.id)} style={btnSecundario()}>+ Objetivo</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const btnPrimario = (disabled) => ({ background: COR, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 })
const btnSecundario = () => ({ background: 'none', border: '1px solid ' + 'var(--prod-planejamento)', color: COR, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })

function BtnExcluir({ onClick }) {
  return <button onClick={onClick} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--lt-text3)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>🗑</button>
}

// ─── Check-ins ──────────────────────────────────────────────────────────────
function TabCheckins({ projeto, perfil, perspectivas, objetivos, krs, progPorKr, reload, setErro }) {
  const [form, setForm] = useState({})  // krId -> { valor, data, comentario }
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

const lblMini = () => ({ fontSize: 10.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 3 })
