// ═══════════════════════════════════════════════════════════════════════════
// CronogramaUI.jsx — componentes do cronograma do mapeamento:
//  · Timeline   — evolução em 6 etapas (consultor e cliente)
//  · Historico  — log de aprovações/transições
//  · BlocoConsultor — ações do consultor (enviar para aprovação, etc.)
//  · VisaoCliente — página do cliente (acompanhar + aprovar / solicitar ajustes)
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { computeTimeline, ESTADO_CFG, etapaAtualLabel, podeAprovar, docsProntos } from '../../lib/mapeamento/cronograma'
import { baixarArtefato, codigoBaseDe } from '../../lib/mapeamento/artefatos'

const COBRE = '#A6512F', AZUL = '#00203E'

function fmtData(d) {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return null }
}
function fmtDataHora(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

// ─── Timeline ───────────────────────────────────────────────────────────────
export function Timeline({ map }) {
  const stages = computeTimeline(map)
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stages.map((s, i) => {
        const cfg = ESTADO_CFG[s.estado]
        const last = i === stages.length - 1
        return (
          <div key={s.key} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: s.estado === 'concluido' ? cfg.dot : '#fff',
                border: `2.5px solid ${cfg.dot}`,
                boxShadow: s.estado === 'andamento' ? `0 0 0 4px ${cfg.bg}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.estado === 'concluido' && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              {!last && <div style={{ flex: 1, width: 2, background: s.estado === 'concluido' ? cfg.dot : 'rgba(0,32,62,0.12)', minHeight: 26 }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 18, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.estado === 'pendente' ? '#9CA3AF' : AZUL }}>{s.label}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.erro ? 'Travado por erro' : cfg.label}</span>
                {s.data && <span style={{ fontSize: 11, color: '#6B7280' }}>{fmtData(s.data)}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 3, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Histórico de aprovações ──────────────────────────────────────────────────
const ACAO_LABEL = {
  enviar_aprovacao: 'Enviado para aprovação do cliente',
  aprovar: 'Procedimento aprovado',
  solicitar_ajustes: 'Ajustes solicitados',
  voltar_producao: 'Reaberto para ajustes',
}
export function useAprovacoes(mapeamentoId) {
  const [itens, setItens] = useState([])
  const carregar = useCallback(async () => {
    if (!mapeamentoId) return
    const { data } = await supabase.from('mapeamento_aprovacoes').select('*').eq('mapeamento_id', mapeamentoId).order('criado_em', { ascending: false })
    setItens(data || [])
  }, [mapeamentoId])
  useEffect(() => { carregar() }, [carregar])
  return { itens, recarregar: carregar }
}

export function Historico({ itens }) {
  if (!itens?.length) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Histórico de aprovações</div>
      {itens.map((it) => (
        <div key={it.id} style={{ borderLeft: `2px solid ${it.acao === 'aprovar' ? '#22C55E' : it.acao === 'solicitar_ajustes' ? '#EA580C' : COBRE}`, padding: '4px 0 8px 12px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: AZUL }}>{ACAO_LABEL[it.acao] || it.acao}</div>
          <div style={{ fontSize: 10.5, color: '#6B7280' }}>{it.autor_nome || 'Usuário'} · {fmtDataHora(it.criado_em)}</div>
          {it.comentario && <div style={{ fontSize: 12, color: '#1F2937', marginTop: 4, background: 'rgba(0,32,62,0.04)', padding: '6px 10px', borderRadius: 6 }}>“{it.comentario}”</div>}
        </div>
      ))}
    </div>
  )
}

async function registrar(mapId, acao, comentario) {
  const { data, error } = await supabase.rpc('mapeamento_registrar_aprovacao', { p_mapeamento_id: mapId, p_acao: acao, p_comentario: comentario || null })
  if (error) throw new Error(error.message)
  // notifica o lado oposto (cliente/consultor) por e-mail — não bloqueia a UI
  supabase.functions.invoke('mapeamento-notificar', { body: { mapeamento_id: mapId, acao, comentario: comentario || null } }).catch(() => {})
  return data
}

// ─── Resumo macro do projeto (visão de evolução geral p/ o cliente) ───────────
function progressoDe(map) {
  const stages = computeTimeline(map)
  const ok = stages.filter((s) => s.estado === 'concluido').length
  return ok / stages.length
}
export function ResumoProjeto({ lista }) {
  if (!lista?.length) return null
  const total = lista.length
  const cont = { producao: 0, aprovacao: 0, ajustes: 0, vigente: 0 }
  lista.forEach((m) => {
    const e = m.etapa === 'vigente' ? 'vigente' : m.etapa === 'aprovacao' ? 'aprovacao' : m.etapa === 'ajustes' ? 'ajustes' : 'producao'
    cont[e]++
  })
  const pct = Math.round((lista.reduce((a, m) => a + progressoDe(m), 0) / total) * 100)
  const cards = [
    { label: 'Em produção', n: cont.producao, cor: '#0E7490', bg: 'rgba(6,182,212,0.10)' },
    { label: 'Aguardando você', n: cont.aprovacao, cor: '#92400E', bg: 'rgba(234,179,8,0.15)' },
    { label: 'Em ajustes', n: cont.ajustes, cor: '#9A3412', bg: 'rgba(234,88,12,0.12)' },
    { label: 'Vigentes', n: cont.vigente, cor: '#15803D', bg: 'rgba(34,197,94,0.12)' },
  ]
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6 }}>Evolução geral</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}><b style={{ color: AZUL, fontSize: 15 }}>{pct}%</b> concluído · {cont.vigente}/{total} vigentes</div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(0,32,62,0.08)', overflow: 'hidden', margin: '12px 0 16px' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${COBRE}, #CC915E)`, transition: 'width .4s' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.cor, lineHeight: 1 }}>{c.n}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.cor, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Bloco de ações do consultor ──────────────────────────────────────────────
export function BlocoConsultor({ map, onMudou }) {
  const { itens, recarregar } = useAprovacoes(map.id)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const etapa = map.etapa || 'producao'

  const acao = async (tipo) => {
    setBusy(true); setErro('')
    try { await registrar(map.id, tipo); await recarregar(); onMudou?.() }
    catch (e) { setErro(e.message) }
    setBusy(false)
  }

  const Btn = ({ onClick, children, primario, disabled }) => (
    <button onClick={onClick} disabled={disabled || busy} style={{
      background: primario ? `linear-gradient(135deg, ${COBRE}, #CC915E)` : 'rgba(204,145,94,0.10)',
      color: primario ? '#fff' : COBRE, border: primario ? 'none' : '1px solid rgba(204,145,94,0.35)',
      borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat',
      cursor: (disabled || busy) ? 'not-allowed' : 'pointer', opacity: (disabled || busy) ? 0.5 : 1,
    }}>{children}</button>
  )

  return (
    <div style={{ marginTop: 18, background: '#fff', border: '1px solid rgba(0,32,62,0.08)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Cronograma & aprovação do cliente</div>
      <Timeline map={map} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        {(etapa === 'producao' || etapa === 'ajustes') && (
          <Btn primario disabled={!docsProntos(map)} onClick={() => acao('enviar_aprovacao')}>
            {etapa === 'ajustes' ? '↻ Reenviar para aprovação' : '→ Enviar para aprovação do cliente'}
          </Btn>
        )}
        {!docsProntos(map) && (etapa === 'producao') && (
          <span style={{ fontSize: 11, color: '#6B7280' }}>Gere os documentos antes de enviar para aprovação.</span>
        )}
        {etapa === 'aprovacao' && <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>⏳ Aguardando a aprovação do cliente.</span>}
        {etapa === 'vigente' && <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>✓ Procedimento aprovado e vigente.</span>}
        {(etapa === 'aprovacao' || etapa === 'vigente') && <Btn onClick={() => acao('voltar_producao')}>Reabrir para ajustes</Btn>}
      </div>
      {erro && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{erro}</div>}
      <Historico itens={itens} />
    </div>
  )
}

// ─── Visão do cliente (página inteira) ────────────────────────────────────────
export function VisaoCliente({ projeto }) {
  const [lista, setLista] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState(null)
  const clienteNome = formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || 'Cliente'

  const carregar = useCallback(async () => {
    if (!projeto?.id) { setLoading(false); return }
    const { data } = await supabase.from('mapeamentos').select('*').eq('projeto_id', projeto.id).order('criado_em', { ascending: false })
    setLista(data || []); setLoading(false)
  }, [projeto?.id])
  useEffect(() => { setLoading(true); carregar() }, [carregar])
  useEffect(() => {
    if (!projeto?.id) return
    supabase.from('areas').select('id, nome').eq('projeto_id', projeto.id).order('ordem').then(({ data }) => setAreas(data || []))
  }, [projeto?.id])

  const sel = lista.find((m) => m.id === selId) || null

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Montserrat' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: COBRE }}>Mapeamento de Processos</div>
        <div style={{ fontSize: 22, fontWeight: 300, color: AZUL, fontFamily: 'Raleway, Montserrat' }}>Acompanhamento dos seus processos</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Acompanhe a evolução de cada procedimento e aprove quando estiver pronto.</div>
      </div>

      <ResumoProjeto lista={lista} />

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: '#F3EEE4' }}>
            {['Processo', 'Área', 'Situação', 'Iniciado em', ''].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: AZUL }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Carregando…</td></tr>}
            {!loading && lista.length === 0 && <tr><td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#6B7280' }}>Nenhum mapeamento de processo disponível ainda.</td></tr>}
            {lista.map((m) => {
              const aprovavel = podeAprovar(m)
              return (
                <tr key={m.id} onClick={() => setSelId(m.id === selId ? null : m.id)} style={{ borderTop: '1px solid rgba(0,32,62,0.06)', cursor: 'pointer', background: m.id === selId ? 'rgba(204,145,94,0.07)' : 'transparent' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: AZUL }}>{m.nome_processo}</td>
                  <td style={{ padding: '11px 14px' }}>{areas.find((a) => a.id === m.area_id)?.nome || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: aprovavel ? '#92400E' : (m.etapa === 'vigente' ? '#15803D' : '#0E7490'), background: aprovavel ? 'rgba(234,179,8,0.15)' : (m.etapa === 'vigente' ? 'rgba(34,197,94,0.12)' : 'rgba(6,182,212,0.10)'), padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{etapaAtualLabel(m)}</span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#6B7280' }}>{fmtData(m.criado_em)}</td>
                  <td style={{ padding: '11px 14px', color: COBRE, fontWeight: 600 }}>{m.id === selId ? '▲' : '▼'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sel && <DetalheCliente map={sel} clienteNome={clienteNome} onMudou={carregar} />}
    </div>
  )
}

function DetalheCliente({ map, clienteNome, onMudou }) {
  const { itens, recarregar } = useAprovacoes(map.id)
  const [modo, setModo] = useState(null)
  const [comentario, setComentario] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState('')
  const prontos = docsProntos(map)
  const aprovavel = podeAprovar(map)

  const agir = async (acao, com) => {
    setBusy(true); setErro('')
    try { await registrar(map.id, acao, com); setModo(null); setComentario(''); await recarregar(); onMudou?.() }
    catch (e) { setErro(e.message) }
    setBusy(false)
  }
  const baixar = async (tipo) => {
    setGerando(tipo)
    try { await baixarArtefato(map, tipo, clienteNome) } catch (e) { setErro('Falha ao gerar arquivo: ' + e.message) }
    setGerando('')
  }
  const Btn = ({ onClick, children, primario, disabled, cor }) => (
    <button onClick={onClick} disabled={disabled || busy} style={{
      background: primario ? (cor || `linear-gradient(135deg, ${COBRE}, #CC915E)`) : 'rgba(204,145,94,0.10)',
      color: primario ? '#fff' : COBRE, border: primario ? 'none' : '1px solid rgba(204,145,94,0.35)',
      borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat',
      cursor: (disabled || busy) ? 'not-allowed' : 'pointer', opacity: (disabled || busy) ? 0.5 : 1,
    }}>{children}</button>
  )

  return (
    <div style={{ marginTop: 16, background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', padding: 22 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: AZUL, marginBottom: 16 }}>{map.nome_processo} <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>· {codigoBaseDe(map, clienteNome)}</span></div>

      <Timeline map={map} />

      {prontos && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Documentos do processo</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn primario onClick={() => baixar('pop')} disabled={!!gerando}>{gerando === 'pop' ? 'Gerando…' : '📄 POP (.docx)'}</Btn>
            <Btn primario onClick={() => baixar('matriz')} disabled={!!gerando}>{gerando === 'matriz' ? 'Gerando…' : '📊 Matriz de Riscos + RACI'}</Btn>
            <Btn primario onClick={() => baixar('fluxo')} disabled={!!gerando}>{gerando === 'fluxo' ? 'Gerando…' : '🔀 Fluxograma BPMN'}</Btn>
          </div>
        </div>
      )}

      {aprovavel && (
        <div style={{ marginTop: 18, padding: 16, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#92400E', marginBottom: 10 }}>Este procedimento está pronto para a sua aprovação.</div>
          {modo !== 'ajustes' ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn primario cor="linear-gradient(135deg,#15803D,#22C55E)" onClick={() => agir('aprovar')}>✓ Aprovar procedimento</Btn>
              <Btn onClick={() => setModo('ajustes')}>Solicitar ajustes</Btn>
            </div>
          ) : (
            <div>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Descreva os ajustes que precisam ser feitos…"
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 12, padding: 10, borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <Btn primario cor="linear-gradient(135deg,#9A3412,#EA580C)" disabled={!comentario.trim()} onClick={() => agir('solicitar_ajustes', comentario)}>Enviar solicitação de ajustes</Btn>
                <Btn onClick={() => { setModo(null); setComentario('') }}>Cancelar</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {erro && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 10 }}>{erro}</div>}
      <Historico itens={itens} />
    </div>
  )
}
