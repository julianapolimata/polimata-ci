// Gerador de Sugestão Orçamentária — config por categoria, 6 métodos (peso igual), índices BCB
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrcDados, PageHeader, Card, HelpTag, SeletorAno, Badge, BotaoVerde, BotaoSec, ErroBox, fmtPct, THL, TH, TDL, TD } from './_shared'
import { METODOS, sugerir, sugerirIntraAno } from '../../lib/orcamento/sugestao'
import { carregarIndices, INDICES } from '../../lib/orcamento/bcb'
import { iaSugerir } from '../../lib/orcamento/ia'

const ICONE_METODO = { repeticao: '📋', media_movel: '📊', tendencia: '📈', sazonalidade: '📅', indice: '💰', ia: '🤖' }

export default function Gerador({ projeto }) {
  const [ano, setAno] = useState(new Date().getFullYear())
  const d = useOrcDados(projeto, ano)
  const [cenarioId, setCenarioId] = useState(null)
  const cenario = d.cenarios.find(c => c.id === cenarioId) || d.cenarios.find(c => c.status === 'aprovado') || d.cenarios[d.cenarios.length - 1]
  const [config, setConfig] = useState({}) // catId -> {metodo, params}
  const [indices, setIndices] = useState(null)
  const [gerando, setGerando] = useState(false)
  const [msg, setMsg] = useState('')
  const [base, setBase] = useState('anterior') // 'anterior' = ano N-1 | 'intra' = completar ano corrente
  const ehIntra = base === 'intra'
  const defMet = ehIntra ? 'media_movel' : 'repeticao'
  const temAlgum = (serie) => !!(serie && serie.some(v => v !== null && v !== undefined))
  // no ano corrente, ignora o mês em aberto (ainda não fechado) como base da projeção
  const hojeRef = new Date()
  const mesesExcluir = ehIntra && ano === hojeRef.getFullYear() ? [hojeRef.getMonth()] : []

  useEffect(() => { carregarIndices().then(setIndices).catch(() => setIndices([])) }, [])
  useEffect(() => {
    if (!cenario?.id) return
    supabase.from('orc_sugestao_config').select('*').eq('orcamento_id', cenario.id).then(({ data }) => {
      const m = {}; (data || []).forEach(r => { m[r.categoria_id] = { metodo: r.metodo, params: r.params || {} } }); setConfig(m)
    })
  }, [cenario?.id])

  const u = (catId, campo, valor) => setConfig(prev => {
    const atual = prev[catId] || { metodo: 'repeticao', params: {} }
    return { ...prev, [catId]: campo === 'metodo' ? { ...atual, metodo: valor } : { ...atual, params: { ...atual.params, ...valor } } }
  })

  async function salvarConfig() {
    if (!cenario) return
    const rows = Object.entries(config).map(([catId, c]) => ({ orcamento_id: cenario.id, categoria_id: catId, metodo: c.metodo, params: c.params }))
    if (!rows.length) return
    const { error } = await supabase.from('orc_sugestao_config').upsert(rows, { onConflict: 'orcamento_id,categoria_id' })
    setMsg(error ? 'Erro: ' + error.message : 'Configuração salva.')
  }

  async function gerar() {
    if (!cenario) { d.setErro('Crie um cenário em "Cenários" antes de gerar.'); return }
    setGerando(true); setMsg('')
    try {
      await salvarConfig()
      const idxResumo = (indices || []).map(i => ({ nome: i.nome, variacao_12m: i.variacao12m }))
      const catsIA = [], linhas = []
      d.catsAtivas.forEach(c => {
        const cfg = config[c.id] || { metodo: defMet, params: {} }
        if (ehIntra) {
          const serie = d.realPorCat[c.id]?.[ano]
          if (!temAlgum(serie)) return
          const met = METODOS.find(m => m.id === cfg.metodo)?.intraAno ? cfg.metodo : 'media_movel'
          const vals = sugerirIntraAno(met, serie, { janela: cfg.params.janela, mesInicio: 6, excluirMeses: mesesExcluir })
          if (!vals.some(v => v !== null && v !== undefined)) return
          linhas.push({ cat: c, vals, metodo: met, just: `Método ${METODOS.find(m => m.id === met)?.nome} — projeção do 2º semestre (Jul–Dez) sobre o realizado de ${ano}.`, conf: 70 })
          return
        }
        const s1 = d.realPorCat[c.id]?.[ano - 1] || null
        const s2 = d.realPorCat[c.id]?.[ano - 2] || null
        if (!s1 && !s2) return
        if (cfg.metodo === 'ia') { catsIA.push({ c, cfg, s1, s2 }); return }
        const idxSel = (indices || []).find(i => i.serie === Number(cfg.params.indice_serie))
        const pct = cfg.metodo === 'indice' ? (cfg.params.percentual ?? idxSel?.variacao12m ?? 0) : cfg.params.percentual
        const vals = sugerir(cfg.metodo, s1, s2, { ...cfg.params, percentual: pct })
        linhas.push({ cat: c, vals, metodo: cfg.metodo, just: `Método ${METODOS.find(m => m.id === cfg.metodo)?.nome}${cfg.metodo === 'indice' && idxSel ? ` (${idxSel.nome} ${fmtPct(idxSel.variacao12m)})` : ''} sobre o realizado de ${ano - 1}.`, conf: 75 })
      })
      if (!ehIntra && catsIA.length) {
        const sug = await iaSugerir(
          catsIA.map(x => ({ categoria: x.c.nome, tipo: x.c.tipo, serie_ano_anterior: x.s1, serie_2_anos: x.s2, contexto: x.cfg.params.observacoes || null })),
          ano, idxResumo, null)
        sug.forEach(sg => {
          const x = catsIA.find(y => y.c.nome === sg.categoria)
          if (x) linhas.push({ cat: x.c, vals: sg.valores, metodo: 'ia', just: sg.justificativa, conf: sg.confianca })
        })
      }
      const rows = []
      linhas.forEach(l => l.vals.forEach((v, m) => {
        if (v === null || v === undefined) return
        rows.push({
          orcamento_id: cenario.id, categoria_id: l.cat.id, mes: m + 1,
          valor: v, sugerido: v, metodo: l.metodo, justificativa_ia: l.just, confianca: l.conf,
          status_revisao: (l.conf ?? 100) < 60 ? 'revisar' : 'sugerido',
        })
      }))
      if (!rows.length) { setMsg('Nenhuma categoria com histórico para sugerir — importe ou lance o realizado primeiro.'); return }
      const { error } = await supabase.from('orc_orcamento_itens').upsert(rows, { onConflict: 'orcamento_id,categoria_id,mes' })
      if (error) throw error
      setMsg(`✓ ${linhas.length} categorias sugeridas (${rows.length} células). Revise em "Cadastrar Orçado".`)
    } catch (e) { d.setErro(e.message) } finally { setGerando(false) }
  }

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1280, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Gerador de Sugestão Orçamentária" subtitulo={ehIntra ? `Projeta o 2º semestre de ${ano} a partir do realizado já lançado` : `Cria o orçamento de ${ano} a partir do realizado do ano anterior`}>
        <select className="input-light" style={{ width: 210 }} value={base} onChange={e => setBase(e.target.value)} title="Base da projeção">
          <option value="anterior">Base: ano anterior</option>
          <option value="intra">Base: completar ano corrente</option>
        </select>
        <SeletorAno ano={ano} setAno={setAno} />
        <select className="input-light" style={{ width: 160 }} value={cenario?.id || ''} onChange={e => setCenarioId(e.target.value)}>
          {d.cenarios.map(c => <option key={c.id} value={c.id}>{(c.nome || 'v' + c.versao) + (c.status === 'aprovado' ? ' ★' : '')}</option>)}
          {!d.cenarios.length && <option value="">— crie um cenário —</option>}
        </select>
        <BotaoSec onClick={salvarConfig}>Salvar configuração</BotaoSec>
        <BotaoVerde onClick={gerar} disabled={gerando || !cenario}>{gerando ? 'Gerando…' : '⚡ Gerar Sugestões'}</BotaoVerde>
      </PageHeader>
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />
      {msg && <div style={{ background: 'rgba(34,185,138,0.08)', border: '1px solid rgba(34,185,138,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{msg}</div>}
      <HelpTag><strong>Ponto de partida inteligente:</strong> em vez de orçar do zero, o sistema analisa o realizado histórico, identifica padrões, busca índices de mercado e propõe valores. Você edita só o que precisa de ajuste.</HelpTag>
      {ehIntra && <div style={{ background: 'rgba(204,145,94,0.10)', border: '1px solid rgba(204,145,94,0.4)', borderRadius: 8, padding: '9px 14px', fontSize: 12, margin: '0 0 14px' }}><strong>Modo completar o ano corrente:</strong> sem histórico de anos anteriores, o sistema projeta os meses de <strong>Jul–Dez</strong> a partir do que já foi realizado em {ano}. Aplicam-se <strong>Média móvel</strong> e <strong>Tendência linear</strong>; os demais métodos exigem um ano fechado e ficam indisponíveis. Com poucos meses, a tendência tende a oscilar — a média móvel costuma ser mais estável. O mês corrente em aberto é ignorado automaticamente como base, para não distorcer a projeção.</div>}

      <Card titulo="Configuração de Método por Categoria" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>Os 6 métodos têm o mesmo peso — escolha o que faz sentido para cada conta</span>} pad={false}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={THL}>Categoria Gerencial</th><th style={THL}>Método de Projeção</th><th style={THL}>Parâmetro</th><th style={TH}>Histórico</th></tr></thead>
          <tbody>
            {d.catsAtivas.map(c => {
              const cfg = config[c.id] || { metodo: defMet, params: {} }
              const metodoSel = ehIntra && !METODOS.find(m => m.id === cfg.metodo)?.intraAno ? 'media_movel' : cfg.metodo
              const temHist = ehIntra ? temAlgum(d.realPorCat[c.id]?.[ano]) : !!(d.realPorCat[c.id]?.[ano - 1] || d.realPorCat[c.id]?.[ano - 2])
              return (
                <tr key={c.id}>
                  <td style={{ ...TDL, fontWeight: 600 }}>{c.nome}<br /><span style={{ fontSize: 10.5, color: 'var(--lt-text3)', fontWeight: 400 }}>{c.tipo}</span></td>
                  <td style={TDL}>
                    <select className="input-light" style={{ width: 230, padding: '5px 8px', fontSize: 12 }} value={metodoSel} onChange={e => u(c.id, 'metodo', e.target.value)}>
                      {METODOS.map(m => <option key={m.id} value={m.id} disabled={ehIntra && !m.intraAno}>{ICONE_METODO[m.id]} {m.nome}{ehIntra && !m.intraAno ? ' — exige ano anterior' : ''}</option>)}
                    </select>
                  </td>
                  <td style={TDL}>
                    {cfg.metodo === 'indice' && (
                      <select className="input-light" style={{ width: 180, padding: '5px 8px', fontSize: 12 }} value={cfg.params.indice_serie || 433} onChange={e => u(c.id, 'params', { indice_serie: parseInt(e.target.value) })}>
                        {INDICES.map(i => <option key={i.serie} value={i.serie}>{i.nome} — {i.aplicacao}</option>)}
                      </select>
                    )}
                    {cfg.metodo === 'media_movel' && (
                      <select className="input-light" style={{ width: 130, padding: '5px 8px', fontSize: 12 }} value={cfg.params.janela || 3} onChange={e => u(c.id, 'params', { janela: parseInt(e.target.value) })}>
                        {[3, 6, 12].map(j => <option key={j} value={j}>Média {j} meses</option>)}
                      </select>
                    )}
                    {cfg.metodo === 'ia' && (
                      <input className="input-light" style={{ width: 230, padding: '5px 8px', fontSize: 12 }} placeholder="Contexto p/ IA (opcional)" value={cfg.params.observacoes || ''} onChange={e => u(c.id, 'params', { observacoes: e.target.value })} />
                    )}
                    {['repeticao', 'tendencia', 'sazonalidade'].includes(cfg.metodo) && <span style={{ fontSize: 11.5, color: 'var(--lt-text3)' }}>automático sobre o histórico</span>}
                  </td>
                  <td style={TD}>{temHist ? <Badge tone="success">OK</Badge> : <Badge tone="warning">Sem dados</Badge>}</td>
                </tr>
              )
            })}
            {!d.catsAtivas.length && <tr><td colSpan={4} style={{ ...TDL, textAlign: 'center', padding: 22, color: 'var(--lt-text3)' }}>Cadastre as categorias gerenciais no Plano de Contas.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card titulo="Métodos Disponíveis">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {METODOS.map(m => (
            <div key={m.id} style={{ border: '1px solid var(--lt-brd)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 17 }}>{ICONE_METODO[m.id]}</div>
              <div style={{ fontWeight: 700, fontSize: 12.5, margin: '4px 0' }}>{m.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--lt-text3)', lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card titulo="Índices de Mercado" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>Fonte: Banco Central do Brasil (SGS) · busca automática</span>} pad={false}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={THL}>Índice</th><th style={THL}>Descrição</th><th style={TH}>Variação 12m</th><th style={TH}>Acumulado YTD</th><th style={THL}>Aplicação típica</th></tr></thead>
          <tbody>
            {indices === null && <tr><td colSpan={5} style={{ ...TDL, textAlign: 'center', padding: 18, color: 'var(--lt-text3)' }}>Buscando índices no BCB…</td></tr>}
            {(indices || []).map(i => (
              <tr key={i.serie}>
                <td style={{ ...TDL, fontWeight: 700 }}>{i.nome}</td>
                <td style={TDL}>{i.desc}</td>
                <td style={{ ...TD, fontWeight: 600 }}>{fmtPct(i.variacao12m)}</td>
                <td style={TD}>{fmtPct(i.ytd)}</td>
                <td style={{ ...TDL, color: 'var(--lt-text3)' }}>{i.aplicacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
