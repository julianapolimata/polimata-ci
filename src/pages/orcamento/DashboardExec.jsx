// Dashboard Executivo — filtro de período, modo análise/comparativo,
// biblioteca de indicadores, tabela por categoria (AV/AH), drill-down e export.
import { useState, useMemo, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { supabase } from '../../lib/supabase'
import { useOrcDados, useItens, PageHeader, Card, KPICard, KPIGrid, BotaoSec, HelpTag, fmtBRL, MESES_ABREV, ErroBox } from './_shared'

const ANO_ATUAL = new Date().getFullYear()

const CATALOGO = [
  { id: 'saidas', nome: 'Saídas realizadas no ano', dep: 'none', info: 'Total de saídas (custos + despesas) no período selecionado.' },
  { id: 'burn', nome: 'Burn rate', dep: 'none', info: 'Ritmo médio de consumo de recursos: média de saídas por mês no período.' },
  { id: 'maiorRub', nome: 'Maior rubrica de despesa', dep: 'none', info: 'A categoria que mais consome recursos no período — evidencia onde o gasto se concentra.' },
  { id: 'pico', nome: 'Pico de desembolso', dep: 'none', info: 'Mês de maior volume de saídas no período — indica concentração e sazonalidade do desembolso.' },
  { id: 'exec', nome: 'Execução orçamentária', dep: 'orcado', info: 'Percentual do orçado já consumido pelo realizado (realizado ÷ orçado).' },
  { id: 'desvio', nome: 'Maior desvio orçamentário', dep: 'orcado', info: 'Categoria com maior variação entre realizado e orçado no período.' },
  { id: 'receita', nome: 'Receita realizada no ano', dep: 'receita', info: 'Total de receitas reconhecidas no período. Requer a importação do relatório de receitas.' },
  { id: 'margem', nome: 'Margem operacional', dep: 'receita', info: 'Resultado da operação no período: receita menos custos e despesas.' },
  { id: 'ebitda', nome: 'EBITDA gerencial', dep: 'receita', info: 'Resultado antes de juros, impostos, depreciação e amortização — aproxima a geração de caixa operacional.' },
  { id: 'bruta', nome: 'Margem bruta', dep: 'receita', info: 'Receita menos o custo dos produtos vendidos (CPV) — quanto sobra da venda antes das despesas.' },
]
const DEFAULT_ON = ['saidas', 'burn', 'maiorRub', 'pico']
const somaJanela = (arr, de, ate) => (arr || []).slice(de, ate + 1).reduce((s, v) => s + (v || 0), 0)

export default function DashboardExec({ projeto }) {
  const [ano, setAno] = useState(ANO_ATUAL)
  const d = useOrcDados(projeto, ano)
  const aprovado = d.cenarios.find(c => c.status === 'aprovado') || d.cenarios[d.cenarios.length - 1]
  const { porCat } = useItens(aprovado?.id)
  const [de, setDe] = useState(0)
  const [ate, setAte] = useState(11)
  const [modo, setModo] = useState('analise')
  const [libOpen, setLibOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [cardsOn, setCardsOn] = useState(DEFAULT_ON)
  const [msg, setMsg] = useState('')

  useEffect(() => { try { const s = localStorage.getItem('orc_dash_cards_' + projeto.id); if (s) setCardsOn(JSON.parse(s)) } catch (e) { /* segue */ } }, [projeto?.id])
  function toggleCard(id) {
    setCardsOn(prev => { const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; try { localStorage.setItem('orc_dash_cards_' + projeto.id, JSON.stringify(n)) } catch (e) { /* segue */ } return n })
  }

  const temOrcado = useMemo(() => Object.values(porCat || {}).some(p => (p.valores || []).some(v => v != null && v !== 0)), [porCat])
  useEffect(() => { if (!temOrcado) setModo('analise') }, [temOrcado])

  // período padrão: do início ao último mês com realizado no ano
  useEffect(() => {
    let max = -1
    d.realizado.forEach(r => { const dt = new Date(r.competencia + 'T00:00:00'); if (dt.getFullYear() === ano) max = Math.max(max, dt.getMonth()) })
    setDe(0); setAte(max >= 0 ? max : 11)
  }, [ano, d.realizado])

  const W = useMemo(() => {
    const cats = d.catsAtivas.map(c => {
      const rArr = (d.realPorCat[c.id] && d.realPorCat[c.id][ano]) || []
      const oArr = (porCat[c.id] && porCat[c.id].valores) || []
      return { id: c.id, nome: c.nome, tipo: c.tipo, real: somaJanela(rArr, de, ate), orc: somaJanela(oArr, de, ate), rArr, oArr }
    })
    const saidasCats = cats.filter(c => c.tipo !== 'receita')
    const saidasReal = saidasCats.reduce((s, c) => s + c.real, 0)
    const saidasOrc = saidasCats.reduce((s, c) => s + c.orc, 0)
    const receitaReal = cats.filter(c => c.tipo === 'receita').reduce((s, c) => s + c.real, 0)
    const deducaoReal = cats.filter(c => c.tipo === 'deducao').reduce((s, c) => s + c.real, 0)
    const custoReal = cats.filter(c => c.tipo === 'custo').reduce((s, c) => s + c.real, 0)
    const receitaLiq = receitaReal - deducaoReal
    const margem = receitaReal - saidasReal
    const deprec = cats.filter(c => /deprecia/i.test(c.nome)).reduce((s, c) => s + c.real, 0)
    const mesTot = []; for (let j = de; j <= ate; j++) mesTot.push(saidasCats.reduce((s, c) => s + (c.rArr[j] || 0), 0))
    let pl = 0; for (let i = 1; i < mesTot.length; i++) if (mesTot[i] > mesTot[pl]) pl = i
    const maior = saidasCats.slice().sort((a, b) => b.real - a.real)[0]
    return {
      cats, saidasCats, saidasReal, saidasOrc, receitaReal, receitaLiq, custoReal, margem, deprec, mesTot,
      nMes: ate - de + 1, maior, picoMes: mesTot.length ? MESES_ABREV[de + pl] : '—', picoVal: mesTot[pl] || 0,
      baseAV: receitaLiq > 0 ? receitaLiq : saidasReal,
    }
  }, [d.catsAtivas, d.realPorCat, porCat, ano, de, ate])

  function appOk(dep) { if (dep === 'receita') return W.receitaReal > 0; if (dep === 'orcado') return temOrcado; return true }
  function naoAplic(dep) { return dep === 'receita' ? 'Aplicável com as receitas importadas.' : 'Aplicável no cenário comparativo (com orçado cadastrado).' }

  function indicador(id) {
    switch (id) {
      case 'saidas': return { v: fmtBRL(W.saidasReal), s: MESES_ABREV[de] + '–' + MESES_ABREV[ate] }
      case 'burn': return { v: fmtBRL(Math.round(W.saidasReal / W.nMes)), s: 'média de saídas por mês' }
      case 'maiorRub': return { v: W.maior ? fmtBRL(W.maior.real) : '—', s: W.maior ? W.maior.nome : '' }
      case 'pico': return { v: W.picoMes, s: fmtBRL(Math.round(W.picoVal)) }
      case 'exec': return { v: W.saidasOrc ? Math.round(W.saidasReal / W.saidasOrc * 100) + '%' : '—', s: 'realizado ÷ orçado' }
      case 'desvio': { const w = W.saidasCats.filter(c => c.orc).slice().sort((a, b) => Math.abs(b.real - b.orc) - Math.abs(a.real - a.orc))[0]; return { v: w ? (w.real >= w.orc ? '+' : '') + Math.round((w.real - w.orc) / w.orc * 100) + '%' : '—', s: w ? w.nome : '' } }
      case 'receita': return { v: fmtBRL(W.receitaReal), s: 'receita bruta' }
      case 'margem': return { v: fmtBRL(W.margem), s: W.receitaReal ? (W.margem / W.receitaReal * 100).toFixed(1) + '% da receita' : '' }
      case 'ebitda': return { v: fmtBRL(W.margem + W.deprec), s: 'margem + deprec./amort.' }
      case 'bruta': return { v: fmtBRL(W.receitaReal - W.custoReal), s: 'receita − CPV' }
      default: return { v: '—', s: '' }
    }
  }

  function abrirInfo(k) {
    setModal({ titulo: k.nome, corpo: (<>
      <p style={{ margin: '0 0 8px' }}>{k.info}</p>
      {!appOk(k.dep) && <p style={{ margin: 0, color: 'var(--lt-text3)' }}>🔒 {naoAplic(k.dep)}</p>}
    </>) })
  }

  async function drill(c) {
    const compIni = `${ano}-${String(de + 1).padStart(2, '0')}-01`
    const compFim = `${ano}-${String(ate + 1).padStart(2, '0')}-01`
    setModal({ titulo: c.nome + ' · composição', corpo: <div style={{ fontSize: 13, color: 'var(--lt-text3)' }}>Carregando…</div> })
    const max = Math.max(1, ...c.rArr.slice(de, ate + 1).map(v => v || 0))
    const barras = []
    for (let j = de; j <= ate; j++) {
      const v = c.rArr[j] || 0
      barras.push(
        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '5px 0' }}>
          <span style={{ width: 30, fontSize: 12, color: 'var(--lt-text3)' }}>{MESES_ABREV[j]}</span>
          <span style={{ flex: 1, height: 10, background: 'var(--lt-bg2, #eee)', borderRadius: 5, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (v / max * 100) + '%', background: 'var(--prod-orcamento, #22B98A)' }} /></span>
          <span style={{ width: 100, textAlign: 'right', fontSize: 12 }}>{fmtBRL(v)}</span>
        </div>)
    }
    let lancs = []
    try {
      const { data } = await supabase.from('orc_realizado').select('competencia, valor, conta_erp, detalhe, parceiro, documento, origem')
        .eq('projeto_id', projeto.id).eq('categoria_id', c.id).gte('competencia', compIni).lte('competencia', compFim).order('competencia')
      lancs = data || []
    } catch (e) { /* segue */ }
    setModal({ titulo: c.nome + ' · composição', corpo: (<>
      {barras}
      <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)' }}>Lançamentos no período ({lancs.length})</div>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
        {lancs.length === 0 && <div style={{ fontSize: 12, color: 'var(--lt-text3)' }}>Sem lançamentos detalhados (realizado agregado). Reimporte o realizado linha a linha para explodir até a nota.</div>}
        {lancs.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--lt-brd)' }}>
            <span style={{ color: 'var(--lt-text3)', whiteSpace: 'nowrap' }}>{(l.competencia || '').slice(0, 7)}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.parceiro || l.detalhe || l.conta_erp || '—'}{l.documento ? ' · ' + l.documento : ''}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(Number(l.valor))}</span>
          </div>))}
      </div>
    </>) })
  }

  async function exportar() {
    setMsg('')
    try {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Dashboard')
      const comp = modo === 'comparativo'
      const head = ['Categoria', ...(comp ? ['Orçado'] : []), 'Realizado', ...(comp ? ['Variação %'] : []), 'AV %', 'AH %']
      const hr = ws.addRow(head)
      hr.eachCell(c => { c.font = { name: 'Montserrat', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00203E' } } })
      linhasTabela().forEach(r => {
        const row = [r.nome, ...(comp ? [r.orc] : []), r.real, ...(comp ? [r.varp] : []), r.av, r.ah]
        ws.addRow(row).eachCell(c => { c.font = { name: 'Montserrat' } })
      })
      ws.columns.forEach((c, i) => { c.width = i === 0 ? 36 : 14 })
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = `Dashboard_${projeto.nome}_${MESES_ABREV[de]}-${MESES_ABREV[ate]}_${ano}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e) { setMsg('Erro ao exportar: ' + e.message) }
  }

  function linhasTabela() {
    return W.cats.filter(c => c.real !== 0 || c.orc !== 0).sort((a, b) => b.real - a.real).map(c => {
      const varp = c.orc ? Math.round((c.real - c.orc) / c.orc * 100) : null
      const av = W.baseAV ? +(c.real / W.baseAV * 100).toFixed(1) : null
      const ah = (ate > de && c.rArr[ate - 1]) ? Math.round((c.rArr[ate] - c.rArr[ate - 1]) / c.rArr[ate - 1] * 100) : null
      return { ...c, varp, av, ah }
    })
  }

  const RED = 'var(--lt-danger, #C62828)', GREEN = 'var(--res-ef, #15803D)'
  const comp = modo === 'comparativo'
  const cardsVisiveis = CATALOGO.filter(k => cardsOn.includes(k.id) && appOk(k.dep))
  const linhas = linhasTabela()

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1280, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Dashboard Executivo" subtitulo={`${projeto?.nome || ''} · ${MESES_ABREV[de]}–${MESES_ABREV[ate]}/${ano}`}>
        <BotaoSec onClick={() => setLibOpen(o => !o)}>⊞ Personalizar</BotaoSec>
        <BotaoSec onClick={exportar}>↓ Exportar</BotaoSec>
      </PageHeader>
      <ErroBox erro={d.erro || msg} onClose={() => { d.setErro(''); setMsg('') }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: 12.5 }}>
        <span style={{ color: 'var(--lt-text3)' }}>Exercício</span>
        <select className="input-light" style={{ width: 'auto' }} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ color: 'var(--lt-text3)', marginLeft: 6 }}>Período</span>
        <select className="input-light" style={{ width: 'auto' }} value={de} onChange={e => { const v = parseInt(e.target.value); setDe(v); if (ate < v) setAte(v) }}>{MESES_ABREV.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
        <span style={{ color: 'var(--lt-text3)' }}>até</span>
        <select className="input-light" style={{ width: 'auto' }} value={ate} onChange={e => { const v = parseInt(e.target.value); setAte(v); if (de > v) setDe(v) }}>{MESES_ABREV.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['analise', 'Análise (sem orçado)'], ['comparativo', 'Comparativo (com orçado)']].map(([id, lbl]) => (
          <button key={id} onClick={() => (id === 'comparativo' && !temOrcado) ? null : setModo(id)} disabled={id === 'comparativo' && !temOrcado}
            style={{ fontSize: 12.5, borderRadius: 999, padding: '6px 14px', cursor: (id === 'comparativo' && !temOrcado) ? 'not-allowed' : 'pointer', border: '1px solid var(--lt-brd)', background: modo === id ? 'rgba(204,145,94,0.12)' : 'transparent', color: modo === id ? 'var(--copper, #A6512F)' : 'var(--lt-text3)', opacity: (id === 'comparativo' && !temOrcado) ? 0.5 : 1 }}
            title={(id === 'comparativo' && !temOrcado) ? 'Disponível quando houver orçado cadastrado' : ''}>{lbl}</button>
        ))}
      </div>

      {modo === 'analise' && (
        <HelpTag><strong>Modo análise:</strong> este projeto ainda não tem orçado. Conheça os números do período aqui — depois projete o orçado no Gerador de Sugestão a partir do realizado.</HelpTag>
      )}

      {libOpen && (
        <Card titulo="Biblioteca de indicadores" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>ligue/desligue e toque no ⓘ</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CATALOGO.map(k => {
              const ok = appOk(k.dep), on = cardsOn.includes(k.id)
              return (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => ok ? toggleCard(k.id) : abrirInfo(k)} style={{ flex: 1, textAlign: 'left', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, cursor: ok ? 'pointer' : 'not-allowed', border: '1px solid var(--lt-brd)', background: (ok && on) ? 'rgba(204,145,94,0.12)' : 'transparent', color: ok ? (on ? 'var(--copper, #A6512F)' : 'var(--lt-text)') : 'var(--lt-text3)', opacity: ok ? 1 : 0.65 }}>
                    {ok ? (on ? '✓ ' : '+ ') : '🔒 '}{k.nome}{!ok && <span style={{ fontSize: 10.5 }}> · {k.dep === 'receita' ? 'requer receita' : 'cenário comparativo'}</span>}
                  </button>
                  <button onClick={() => abrirInfo(k)} aria-label={'O que é ' + k.nome} style={{ width: 32, padding: '6px 0', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--lt-brd)', background: 'transparent', color: 'var(--lt-text3)' }}>ⓘ</button>
                </div>)
            })}
          </div>
        </Card>
      )}

      <KPIGrid>
        {cardsVisiveis.map(k => { const r = indicador(k.id); return <KPICard key={k.id} label={k.nome} value={r.v} delta={r.s} /> })}
      </KPIGrid>

      <Card titulo={comp ? 'Orçado vs Realizado por categoria' : 'Realizado por categoria'} extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>{W.receitaLiq > 0 ? 'AV = % da receita líquida' : 'AV = % do total de saídas'} · AH = último mês vs anterior · clique p/ explodir</span>} pad={false}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ background: 'var(--lt-bg2, #f3f3f3)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Categoria</th>
            {comp && <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>Orçado</th>}
            <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>Realizado</th>
            {comp && <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>Var.</th>}
            <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>AV</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>AH</th>
          </tr></thead>
          <tbody>
            {linhas.map(c => {
              const desfav = c.tipo === 'receita' ? c.real < c.orc : c.real > c.orc
              return (
                <tr key={c.id} onClick={() => drill(c)} style={{ borderTop: '1px solid var(--lt-brd)', cursor: 'pointer' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{comp && c.orc ? <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: desfav ? RED : GREEN, marginRight: 6 }} /> : null}{c.nome}</td>
                  {comp && <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--lt-text3)' }}>{fmtBRL(c.orc)}</td>}
                  <td style={{ textAlign: 'right', padding: '8px 8px' }}>{fmtBRL(c.real)}</td>
                  {comp && <td style={{ textAlign: 'right', padding: '8px 8px', color: c.varp === null ? 'var(--lt-text3)' : (desfav ? RED : GREEN) }}>{c.varp === null ? '—' : (c.varp >= 0 ? '+' : '') + c.varp + '%'}</td>}
                  <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--lt-text3)' }}>{c.av === null ? '—' : c.av + '%'}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: c.ah === null ? 'var(--lt-text3)' : (c.ah > 0 ? RED : GREEN) }}>{c.ah === null ? '—' : (c.ah > 0 ? '+' : '') + c.ah + '%'}</td>
                </tr>)
            })}
            {linhas.length === 0 && <tr><td colSpan={comp ? 6 : 4} style={{ padding: 24, textAlign: 'center', color: 'var(--lt-text3)' }}>Sem dados no período. Importe o realizado ou ajuste o filtro.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card titulo="Evolução mensal das saídas (análise horizontal)">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, padding: '8px 0' }}>
          {W.mesTot.map((v, i) => {
            const mx = Math.max(1, ...W.mesTot)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10.5, color: 'var(--lt-text3)' }}>{fmtBRL(Math.round(v))}</div>
                <div style={{ width: '70%', height: (v / mx * 130) + 'px', background: 'var(--navy, #00203E)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontSize: 11, color: 'var(--lt-text3)' }}>{MESES_ABREV[de + i]}</div>
              </div>)
          })}
        </div>
      </Card>

      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ width: 'min(460px, 94%)', maxHeight: '85vh', overflowY: 'auto', background: 'var(--lt-card, #fff)', border: '1px solid var(--lt-brd)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lt-text)' }}>{modal.titulo}</div>
              <button onClick={() => setModal(null)} aria-label="Fechar" style={{ border: '1px solid var(--lt-brd)', background: 'transparent', borderRadius: 8, cursor: 'pointer', width: 30, height: 28, color: 'var(--lt-text3)' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--lt-text3)', lineHeight: 1.55 }}>{modal.corpo}</div>
          </div>
        </div>
      )}
    </div>
  )
}
