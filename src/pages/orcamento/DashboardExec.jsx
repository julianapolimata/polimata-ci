// Dashboard Executivo — tela inicial do orçamento.
// Conta a história: KPIs com sinal, evolução mensal (receita×saídas×resultado, realizado+orçado),
// DRE gerencial (realizado + projeção), receita por situação fiscal e maiores rubricas (explosíveis).
import { useState, useMemo, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { supabase } from '../../lib/supabase'
import { useOrcDados, useItens, PageHeader, Card, KPICard, KPIGrid, BotaoSec, fmtBRL, MESES_ABREV, ErroBox } from './_shared'

const ANO_ATUAL = new Date().getFullYear()
const NAVY = '#00203E', COBRE = '#CC915E', VERDE = '#22B98A', RED = '#A32D2D'
const COBRE_L = 'rgba(204,145,94,0.4)', VERDE_L = 'rgba(34,185,138,0.4)'

const CATALOGO = [
  { id: 'receita', nome: 'Receita realizada', dep: 'receita', info: 'Total de receitas reconhecidas no período (pelo fato gerador, com ou sem nota).' },
  { id: 'margem', nome: 'Resultado operacional', dep: 'receita', info: 'Receita menos deduções, custos e despesas no período. É o que sobra (ou falta) da operação.' },
  { id: 'aFaturar', nome: 'Receita a faturar', dep: 'receita', info: 'Receita já reconhecida que ainda não tem nota fiscal emitida (situação "A faturar").' },
  { id: 'bruta', nome: 'Margem bruta', dep: 'receita', info: 'Receita líquida menos o custo dos produtos vendidos (CPV) — quanto sobra da venda antes das despesas.' },
  { id: 'saidas', nome: 'Saídas realizadas', dep: 'none', info: 'Total de saídas (deduções + custos + despesas) no período.' },
  { id: 'burn', nome: 'Saída média mensal', dep: 'none', info: 'Ritmo médio de consumo de recursos: média de saídas por mês no período (burn rate).' },
  { id: 'maiorRub', nome: 'Maior rubrica de saída', dep: 'none', info: 'A categoria que mais consome recursos no período.' },
  { id: 'exec', nome: 'Execução orçamentária', dep: 'orcado', info: 'Percentual do orçado já consumido pelo realizado (realizado ÷ orçado).' },
]
const DEFAULT_ON = ['receita', 'margem', 'aFaturar', 'saidas']
const soma = (arr, de, ate) => (arr || []).slice(de, ate + 1).reduce((s, v) => s + (v || 0), 0)
const pct = (n) => (n >= 0 ? '' : '−') + Math.abs(n).toFixed(1) + '%'

function GraficoMensal({ receita, saidas, resultado, lastReal }) {
  const W = 720, H = 250, T = 16, B = 40, L = 6, R = 6
  const plotH = H - T - B
  const vals = [...receita, ...saidas, ...resultado].filter(v => v !== null && v !== undefined)
  const max = Math.max(1, ...vals) * 1.08
  const min = Math.min(0, ...vals) * 1.08
  const y = (v) => T + plotH * (max - v) / (max - min)
  const zeroY = y(0)
  const slot = (W - L - R) / 12
  const bw = Math.min(13, slot / 2 - 3)
  const pts = (arr, pred) => arr.map((v, i) => (v === null || v === undefined || !pred(i)) ? null : `${L + slot * i + slot / 2},${y(v)}`).filter(Boolean).join(' ')
  const ptsReal = pts(resultado, i => i <= lastReal)
  const ptsOrc = pts(resultado, i => i >= lastReal)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receita, saídas e resultado por mês — realizado e orçado" style={{ display: 'block' }}>
      <line x1={L} y1={zeroY} x2={W - R} y2={zeroY} stroke="var(--lt-brd, #ddd)" strokeWidth="1" />
      {receita.map((_, i) => {
        const cx = L + slot * i + slot / 2, orc = i > lastReal
        const rv = receita[i], sv = saidas[i]
        return (
          <g key={i}>
            {rv != null && <rect x={cx - bw - 1} y={Math.min(zeroY, y(rv))} width={bw} height={Math.abs(zeroY - y(rv))} rx="2" fill={orc ? VERDE_L : VERDE} />}
            {sv != null && <rect x={cx + 1} y={Math.min(zeroY, y(sv))} width={bw} height={Math.abs(zeroY - y(sv))} rx="2" fill={orc ? COBRE_L : COBRE} />}
            <text x={cx} y={H - 24} textAnchor="middle" fontSize="11" fill="var(--lt-text3, #888)">{MESES_ABREV[i]}</text>
          </g>
        )
      })}
      {ptsReal && <polyline points={ptsReal} fill="none" stroke={NAVY} strokeWidth="2" />}
      {ptsOrc && <polyline points={ptsOrc} fill="none" stroke={NAVY} strokeWidth="2" strokeDasharray="5 4" opacity="0.8" />}
      {resultado.map((v, i) => v == null ? null : <circle key={i} cx={L + slot * i + slot / 2} cy={y(v)} r="2.6" fill={NAVY} />)}
    </svg>
  )
}

function Linha({ label, valor, w, cor, forte, sufixo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0', fontSize: 12.5 }}>
      <span style={{ width: 168, flex: 'none', fontWeight: forte ? 600 : 400, color: 'var(--lt-text)' }}>{label}</span>
      <span style={{ flex: 1 }}><span style={{ display: 'block', height: 16, width: Math.max(1.5, w) + '%', background: cor, borderRadius: 3 }} /></span>
      <span style={{ width: 150, flex: 'none', textAlign: 'right', fontWeight: forte ? 600 : 500, color: cor === RED ? RED : 'var(--lt-text)' }}>{fmtBRL(valor)}{sufixo || ''}</span>
    </div>
  )
}

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

  useEffect(() => { try { const s = localStorage.getItem('orc_dash_v2_' + projeto.id); if (s) setCardsOn(JSON.parse(s)) } catch (e) { /* segue */ } }, [projeto?.id])
  function toggleCard(id) {
    setCardsOn(prev => { const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; try { localStorage.setItem('orc_dash_v2_' + projeto.id, JSON.stringify(n)) } catch (e) { /* segue */ } return n })
  }

  const temOrcado = useMemo(() => Object.values(porCat || {}).some(p => (p.valores || []).some(v => v != null && v !== 0)), [porCat])
  useEffect(() => { if (!temOrcado) setModo('analise') }, [temOrcado])

  useEffect(() => {
    let max = -1
    d.realizado.forEach(r => { const dt = new Date(r.competencia + 'T00:00:00'); if (dt.getFullYear() === ano) max = Math.max(max, dt.getMonth()) })
    setDe(0); setAte(max >= 0 ? max : 11)
  }, [ano, d.realizado])

  const W = useMemo(() => {
    const catTipo = {}; d.categorias.forEach(c => { catTipo[c.id] = c.tipo })
    const tipoArr = (tipo, fonte) => {
      const out = Array(12).fill(0)
      d.catsAtivas.filter(c => c.tipo === tipo).forEach(c => {
        const a = fonte === 'real' ? (d.realPorCat[c.id] && d.realPorCat[c.id][ano]) : (porCat[c.id] && porCat[c.id].valores)
        for (let m = 0; m < 12; m++) out[m] += (a && a[m]) || 0
      })
      return out
    }
    const rReceita = tipoArr('receita', 'real'), rDeducao = tipoArr('deducao', 'real'), rCusto = tipoArr('custo', 'real'), rDespesa = tipoArr('despesa', 'real')
    const oReceita = tipoArr('receita', 'orc'), oDeducao = tipoArr('deducao', 'orc'), oCusto = tipoArr('custo', 'orc'), oDespesa = tipoArr('despesa', 'orc')
    const saidaR = rDeducao.map((v, m) => v + rCusto[m] + rDespesa[m])
    const saidaO = oDeducao.map((v, m) => v + oCusto[m] + oDespesa[m])
    const resR = rReceita.map((v, m) => v - saidaR[m])
    const resO = oReceita.map((v, m) => v - saidaO[m])

    let lastReceita = -1, lastSaida = -1
    for (let m = 0; m < 12; m++) { if (rReceita[m]) lastReceita = m; if (saidaR[m]) lastSaida = m }
    const lastReal = Math.max(lastReceita, lastSaida)
    const incompleto = lastReceita > lastSaida ? lastReceita : -1

    const gReceita = rReceita.map((v, m) => m <= lastReal ? (v || null) : (oReceita[m] || null))
    const gSaida = saidaR.map((v, m) => m <= lastReal ? (v || null) : (saidaO[m] || null))
    const gRes = resR.map((v, m) => {
      if (m === incompleto) return null
      if (m <= lastReal) return (rReceita[m] || saidaR[m]) ? v : null
      return (oReceita[m] || saidaO[m]) ? resO[m] : null
    })

    const pReceita = soma(rReceita, de, ate), pDeducao = soma(rDeducao, de, ate), pCusto = soma(rCusto, de, ate), pDespesa = soma(rDespesa, de, ate)
    const pSaida = pDeducao + pCusto + pDespesa
    const pReceitaLiq = pReceita - pDeducao, pLucroBruto = pReceitaLiq - pCusto, pResultado = pLucroBruto - pDespesa

    const projT = (rA, oA) => { let s = 0; for (let m = 0; m < 12; m++) s += rA[m] || oA[m] || 0; return s }
    const aReceita = projT(rReceita, oReceita), aDeducao = projT(rDeducao, oDeducao), aCusto = projT(rCusto, oCusto), aDespesa = projT(rDespesa, oDespesa)
    const aReceitaLiq = aReceita - aDeducao, aLucroBruto = aReceitaLiq - aCusto, aResultado = aLucroBruto - aDespesa

    const sit = { Faturado: 0, 'A faturar': 0, 'Sem nota': 0 }
    d.realizado.forEach(r => {
      const dt = new Date(r.competencia + 'T00:00:00'); if (dt.getFullYear() !== ano) return
      const m = dt.getMonth(); if (m < de || m > ate) return
      if (catTipo[r.categoria_id] !== 'receita') return
      const s = sit[r.situacao] !== undefined ? r.situacao : 'Sem nota'; sit[s] += Number(r.valor)
    })

    const cats = d.catsAtivas.map(c => {
      const rArr = (d.realPorCat[c.id] && d.realPorCat[c.id][ano]) || []
      const oArr = (porCat[c.id] && porCat[c.id].valores) || []
      return { id: c.id, nome: c.nome, tipo: c.tipo, real: soma(rArr, de, ate), orc: soma(oArr, de, ate), rArr, oArr }
    })
    const saidasCats = cats.filter(c => c.tipo !== 'receita')
    const topRub = saidasCats.filter(c => c.real > 0).sort((a, b) => b.real - a.real).slice(0, 6)
    const maior = topRub[0]

    return {
      cats, saidasCats, topRub, maior, sit, lastReal, incompleto,
      gReceita, gSaida, gRes,
      pReceita, pDeducao, pCusto, pDespesa, pSaida, pReceitaLiq, pLucroBruto, pResultado,
      aReceita, aDeducao, aCusto, aDespesa, aReceitaLiq, aLucroBruto, aResultado,
      nMes: ate - de + 1, baseAV: pReceitaLiq > 0 ? pReceitaLiq : pSaida,
    }
  }, [d.catsAtivas, d.categorias, d.realPorCat, d.realizado, porCat, ano, de, ate])

  function appOk(dep) { if (dep === 'receita') return W.pReceita > 0; if (dep === 'orcado') return temOrcado; return true }
  function naoAplic(dep) { return dep === 'receita' ? 'Aplicável com as receitas importadas.' : 'Aplicável no cenário comparativo (com orçado cadastrado).' }

  function indicador(id) {
    switch (id) {
      case 'receita': return { v: fmtBRL(W.pReceita), s: 'receita reconhecida' }
      case 'margem': return { v: fmtBRL(W.pResultado), s: W.pReceita ? pct(W.pResultado / W.pReceita * 100) + ' da receita' : '' }
      case 'aFaturar': return { v: fmtBRL(W.sit['A faturar'] || 0), s: 'entregue, sem nota emitida' }
      case 'bruta': return { v: fmtBRL(W.pReceitaLiq - W.pCusto), s: 'receita líquida − CPV' }
      case 'saidas': return { v: fmtBRL(W.pSaida), s: MESES_ABREV[de] + '–' + MESES_ABREV[ate] }
      case 'burn': return { v: fmtBRL(Math.round(W.pSaida / W.nMes)), s: 'saída média por mês' }
      case 'maiorRub': return { v: W.maior ? fmtBRL(W.maior.real) : '—', s: W.maior ? W.maior.nome : '' }
      case 'exec': { const so = W.saidasCats.reduce((s, c) => s + c.orc, 0); return { v: so ? Math.round(W.pSaida / so * 100) + '%' : '—', s: 'realizado ÷ orçado' } }
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
    setModal({ titulo: c.nome + ' · composição', corpo: <div style={{ fontSize: 13, color: 'var(--lt-text3)' }}>Carregando…</div> })
    let lancs = []
    try {
      const { data } = await supabase.from('orc_realizado').select('competencia, valor, conta_erp, detalhe, parceiro, documento, situacao')
        .eq('projeto_id', projeto.id).eq('categoria_id', c.id).gte('competencia', compIni).lte('competencia', compFim).order('competencia')
      lancs = data || []
    } catch (e) { /* segue */ }
    setModal({ titulo: c.nome + ' · composição', corpo: (<>
      {barras}
      <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)' }}>Lançamentos no período ({lancs.length})</div>
      <div style={{ maxHeight: '46vh', overflowY: 'auto', marginTop: 6 }}>
        {lancs.length === 0 && <div style={{ fontSize: 12, color: 'var(--lt-text3)' }}>Sem lançamentos detalhados.</div>}
        {lancs.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--lt-brd)' }}>
            <span style={{ color: 'var(--lt-text3)', whiteSpace: 'nowrap' }}>{(l.competencia || '').slice(0, 7)}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.parceiro || l.detalhe || l.conta_erp || '—'}{l.documento ? ' · ' + l.documento : ''}{l.situacao ? ' · ' + l.situacao : ''}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(Number(l.valor))}</span>
          </div>))}
      </div>
    </>) })
  }

  function linhasTabela() {
    return W.cats.filter(c => c.real !== 0 || c.orc !== 0).sort((a, b) => b.real - a.real).map(c => {
      const varp = c.orc ? Math.round((c.real - c.orc) / c.orc * 100) : null
      const av = W.baseAV ? +(c.real / W.baseAV * 100).toFixed(1) : null
      const ah = (ate > de && c.rArr[ate - 1]) ? Math.round((c.rArr[ate] - c.rArr[ate - 1]) / c.rArr[ate - 1] * 100) : null
      return { ...c, varp, av, ah }
    })
  }

  async function exportar() {
    setMsg('')
    try {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Dashboard')
      const comp = modo === 'comparativo'
      const hr = ws.addRow(['Categoria', ...(comp ? ['Orçado'] : []), 'Realizado', ...(comp ? ['Variação %'] : []), 'AV %', 'AH %'])
      hr.eachCell(c => { c.font = { name: 'Montserrat', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00203E' } } })
      linhasTabela().forEach(r => { ws.addRow([r.nome, ...(comp ? [r.orc] : []), r.real, ...(comp ? [r.varp] : []), r.av, r.ah]).eachCell(c => { c.font = { name: 'Montserrat' } }) })
      ws.columns.forEach((c, i) => { c.width = i === 0 ? 36 : 14 })
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = `Dashboard_${projeto.nome}_${MESES_ABREV[de]}-${MESES_ABREV[ate]}_${ano}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e) { setMsg('Erro ao exportar: ' + e.message) }
  }

  const comp = modo === 'comparativo'
  const cardsVisiveis = CATALOGO.filter(k => cardsOn.includes(k.id) && appOk(k.dep))
  const linhas = linhasTabela()
  const dreCol = temOrcado
  const sitTot = (W.sit.Faturado || 0) + (W.sit['A faturar'] || 0) + (W.sit['Sem nota'] || 0)
  const baseDRE = Math.max(1, dreCol ? W.aReceita : W.pReceita)

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Visão Geral do Orçamento" subtitulo={`${projeto?.nome || ''} · ${MESES_ABREV[de]}–${MESES_ABREV[ate]}/${ano}`}>
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
        <span style={{ flex: 1 }} />
        {[['analise', 'Análise'], ['comparativo', 'Orçado × Realizado']].map(([id, lbl]) => (
          <button key={id} onClick={() => (id === 'comparativo' && !temOrcado) ? null : setModo(id)} disabled={id === 'comparativo' && !temOrcado}
            style={{ fontSize: 12, borderRadius: 999, padding: '5px 13px', cursor: (id === 'comparativo' && !temOrcado) ? 'not-allowed' : 'pointer', border: '1px solid var(--lt-brd)', background: modo === id ? 'rgba(204,145,94,0.12)' : 'transparent', color: modo === id ? 'var(--copper, #A6512F)' : 'var(--lt-text3)', opacity: (id === 'comparativo' && !temOrcado) ? 0.5 : 1 }}
            title={(id === 'comparativo' && !temOrcado) ? 'Disponível quando houver orçado cadastrado' : ''}>{lbl}</button>
        ))}
      </div>

      {libOpen && (
        <Card titulo="Indicadores do topo" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>ligue/desligue · ⓘ explica cada um</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CATALOGO.map(k => {
              const ok = appOk(k.dep), on = cardsOn.includes(k.id)
              return (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => ok ? toggleCard(k.id) : abrirInfo(k)} style={{ flex: 1, textAlign: 'left', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, cursor: ok ? 'pointer' : 'not-allowed', border: '1px solid var(--lt-brd)', background: (ok && on) ? 'rgba(204,145,94,0.12)' : 'transparent', color: ok ? (on ? 'var(--copper, #A6512F)' : 'var(--lt-text)') : 'var(--lt-text3)', opacity: ok ? 1 : 0.65 }}>
                    {ok ? (on ? '✓ ' : '+ ') : '🔒 '}{k.nome}{!ok && <span style={{ fontSize: 10.5 }}> · {k.dep === 'receita' ? 'requer receita' : 'requer orçado'}</span>}
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

      <Card titulo="Evolução mensal — receita, saídas e resultado" extra={
        <span style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--lt-text3)', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: VERDE, marginRight: 4 }} />Receita</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: COBRE, marginRight: 4 }} />Saídas</span>
          <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px solid ' + NAVY, marginRight: 4, verticalAlign: 'middle' }} />Resultado</span>
          <span style={{ opacity: 0.75 }}>tom claro = orçado</span>
        </span>}>
        <GraficoMensal receita={W.gReceita} saidas={W.gSaida} resultado={W.gRes} lastReal={W.lastReal} />
        {W.incompleto >= 0 && <p style={{ fontSize: 11, color: 'var(--lt-text3)', margin: '4px 2px 0' }}>{MESES_ABREV[W.incompleto]} é o mês corrente (parcial) — receita lançada, saídas ainda não fechadas.</p>}
      </Card>

      <Card titulo={dreCol ? 'DRE gerencial — realizado e projeção do ano' : 'DRE gerencial do período'} extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>barra = % da receita · explosível nas rubricas abaixo</span>}>
        {[
          ['Receita bruta', dreCol ? W.aReceita : W.pReceita, VERDE, true],
          ['(−) Deduções', dreCol ? W.aDeducao : W.pDeducao, COBRE, false],
          ['= Receita líquida', dreCol ? W.aReceitaLiq : W.pReceitaLiq, NAVY, true],
          ['(−) Custos (CPV)', dreCol ? W.aCusto : W.pCusto, COBRE, false],
          ['= Lucro bruto', dreCol ? W.aLucroBruto : W.pLucroBruto, NAVY, true],
          ['(−) Despesas', dreCol ? W.aDespesa : W.pDespesa, COBRE, false],
          ['= Resultado', dreCol ? W.aResultado : W.pResultado, (dreCol ? W.aResultado : W.pResultado) < 0 ? RED : VERDE, true],
        ].map((r, i) => <Linha key={i} label={r[0]} valor={r[1]} w={Math.abs(r[1]) / baseDRE * 100} cor={r[2]} forte={r[3]} sufixo={baseDRE ? '  ·  ' + pct(r[1] / baseDRE * 100) : ''} />)}
        {dreCol && <p style={{ fontSize: 11, color: 'var(--lt-text3)', margin: '8px 2px 0' }}>Projeção = realizado dos meses fechados + orçado dos meses futuros.</p>}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {appOk('receita') && (
          <Card titulo="Receita por situação fiscal" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>tudo conta como receita</span>}>
            {[['Faturado (com NF)', W.sit.Faturado || 0, VERDE], ['A faturar (sem NF ainda)', W.sit['A faturar'] || 0, COBRE], ['Sem nota', W.sit['Sem nota'] || 0, '#A6512F']].map((r, i) => (
              <Linha key={i} label={r[0]} valor={r[1]} w={sitTot ? r[1] / sitTot * 100 : 0} cor={r[2]} sufixo={sitTot ? '  ·  ' + pct(r[1] / sitTot * 100) : ''} />
            ))}
          </Card>
        )}
        <Card titulo="Para onde vai o dinheiro" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>maiores saídas · clique p/ explodir</span>}>
          {W.topRub.map(c => (
            <div key={c.id} onClick={() => drill(c)} style={{ cursor: 'pointer' }}>
              <Linha label={c.nome} valor={c.real} w={W.maior ? c.real / W.maior.real * 100 : 0} cor={NAVY} />
            </div>
          ))}
          {W.topRub.length === 0 && <p style={{ fontSize: 12, color: 'var(--lt-text3)', margin: 0 }}>Sem saídas no período.</p>}
        </Card>
      </div>

      <Card titulo={comp ? 'Orçado × Realizado por categoria' : 'Realizado por categoria'} extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>{W.pReceitaLiq > 0 ? 'AV = % da receita líquida' : 'AV = % das saídas'} · AH = último mês vs anterior · clique p/ explodir</span>} pad={false}>
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
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{comp && c.orc ? <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: desfav ? RED : VERDE, marginRight: 6 }} /> : null}{c.nome}</td>
                  {comp && <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--lt-text3)' }}>{fmtBRL(c.orc)}</td>}
                  <td style={{ textAlign: 'right', padding: '8px 8px' }}>{fmtBRL(c.real)}</td>
                  {comp && <td style={{ textAlign: 'right', padding: '8px 8px', color: c.varp === null ? 'var(--lt-text3)' : (desfav ? RED : VERDE) }}>{c.varp === null ? '—' : (c.varp >= 0 ? '+' : '') + c.varp + '%'}</td>}
                  <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--lt-text3)' }}>{c.av === null ? '—' : c.av + '%'}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: c.ah === null ? 'var(--lt-text3)' : (c.ah > 0 ? RED : VERDE) }}>{c.ah === null ? '—' : (c.ah > 0 ? '+' : '') + c.ah + '%'}</td>
                </tr>)
            })}
            {linhas.length === 0 && <tr><td colSpan={comp ? 6 : 4} style={{ padding: 24, textAlign: 'center', color: 'var(--lt-text3)' }}>Sem dados no período. Importe o realizado ou ajuste o filtro.</td></tr>}
          </tbody>
        </table>
      </Card>

      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ width: 'min(860px, 95%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--lt-card, #fff)', border: '1px solid var(--lt-brd)', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lt-text)' }}>{modal.titulo}</div>
              <button onClick={() => setModal(null)} aria-label="Fechar" style={{ border: '1px solid var(--lt-brd)', background: 'transparent', borderRadius: 8, cursor: 'pointer', width: 30, height: 28, color: 'var(--lt-text3)' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--lt-text3)', lineHeight: 1.55 }}>{modal.corpo}</div>
          </div>
        </div>
      )}
    </div>
  )
}
