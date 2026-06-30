// Dashboard Executivo — tela inicial do orçamento.
// Conta a história: KPIs com sinal, evolução mensal (receita×saídas×resultado, realizado+orçado),
// DRE gerencial (realizado + projeção), receita por situação fiscal e maiores rubricas (explosíveis).
import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrcDados, useItens, PageHeader, Card, KPICard, KPIGrid, BotaoSec, fmtBRL, MESES_ABREV, ErroBox } from './_shared'

const ANO_ATUAL = new Date().getFullYear()
const NAVY = '#00203E', COBRE = '#CC915E', VERDE = '#22B98A', RED = '#A32D2D'
const COBRE_L = 'rgba(204,145,94,0.4)', VERDE_L = 'rgba(34,185,138,0.4)'
const AMBER = '#E0972F'
const fmtC = (v) => v == null ? '—' : (Math.abs(v) >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : 'R$ ' + Math.round(v / 1e3) + 'k')
const corCons = (pct, pace) => { const r = pace ? pct / pace : 0; if (pct > 100) return RED; if (r <= 1.05) return VERDE; if (r <= 1.45) return AMBER; return RED }
const corReceita = (pct, pace) => { const r = pace ? pct / pace : 0; if (r >= 0.95) return VERDE; if (r >= 0.7) return AMBER; return RED }
const polar = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)] }
const arcPath = (cx, cy, r, d0, d1) => { let p = '', n = Math.max(2, Math.round(Math.abs(d1 - d0))); for (let i = 0; i <= n; i++) { const d = d0 + (d1 - d0) * i / n, q = polar(cx, cy, r, d); p += (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ' ' } return p }

const CATALOGO = [
  { id: 'receita', nome: 'Receita realizada', dep: 'receita', info: 'Total de receitas reconhecidas no período (pelo fato gerador, com ou sem nota).' },
  { id: 'margem', nome: 'Resultado operacional', dep: 'receita', info: 'Receita menos deduções, custos e despesas no período. É o que sobra (ou falta) da operação.' },
  { id: 'aFaturar', nome: 'Receita a faturar', dep: 'receita', info: 'Receita já reconhecida que ainda não tem nota fiscal emitida (situação "A faturar").' },
  { id: 'margemPct', nome: 'Margem líquida', dep: 'receita', info: 'Resultado dividido pela receita do período — quanto sobra de cada real de receita.' },
  { id: 'bruta', nome: 'Margem bruta', dep: 'receita', info: 'Receita líquida menos o custo dos produtos vendidos (CPV) — quanto sobra da venda antes das despesas.' },
  { id: 'saidas', nome: 'Saídas realizadas', dep: 'none', info: 'Total de saídas (deduções + custos + despesas) no período.' },
  { id: 'burn', nome: 'Saída média mensal', dep: 'none', info: 'Ritmo médio de consumo de recursos: média de saídas por mês no período (burn rate).' },
  { id: 'maiorRub', nome: 'Maior rubrica de saída', dep: 'none', info: 'A categoria que mais consome recursos no período.' },
  { id: 'exec', nome: 'Execução orçamentária', dep: 'orcado', info: 'Percentual do orçado já consumido pelo realizado (realizado ÷ orçado).' },
]
const DEFAULT_ON = ['pnlConsumo', 'receita', 'aFaturar', 'margem', 'margemPct']
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

function BateriaHero({ pct, pace, real, orc, inv }) {
  const WB = 230, HB = 64, fill = Math.min(Math.max(pct, 0), 100) / 100, paceX = 8 + (WB - 16) * pace / 100
  const col = inv ? corReceita(pct, pace) : corCons(pct, pace)
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="100%" viewBox="0 0 262 96" role="img" aria-label={`Bateria do orçamento: ${pct.toFixed(0)}% consumido`} style={{ maxWidth: 300, display: 'block', margin: '0 auto' }}>
        <rect x="6" y="14" width={WB} height={HB} rx="11" fill="#fff" stroke={NAVY} strokeWidth="2.5" />
        <rect x={WB + 6} y="30" width="9" height="34" rx="3" fill={NAVY} />
        <rect x="10" y="18" width={(WB - 8) * fill} height={HB - 8} rx="7" fill={col} />
        <line x1={paceX} y1="9" x2={paceX} y2={HB + 19} stroke={NAVY} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={paceX} y="92" textAnchor="middle" fontSize="9.5" fill={NAVY}>ritmo {pace.toFixed(0)}%</text>
        <text x={6 + WB / 2} y="53" textAnchor="middle" fontSize="22" fontWeight="700" fontFamily="'Raleway', sans-serif" fill={NAVY} stroke="#fff" strokeWidth="3.5" paintOrder="stroke">{pct.toFixed(0)}%</text>
      </svg>
      <div style={{ fontSize: 12, color: 'var(--lt-text3)', marginTop: 4 }}>{fmtBRL(real)} de {fmtBRL(orc)} consumidos</div>
    </div>
  )
}

function Bullet({ nome, pct, pace, real, orc, onClick }) {
  const col = corCons(pct, pace)
  const over = pct > 100
  const fillW = Math.min(Math.max(pct, 0), 100)
  const paceX = Math.min(Math.max(pace, 0), 100)
  return (
    <div onClick={onClick} title={`${nome}: ${fmtBRL(real)} de ${fmtBRL(orc)} orçado`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--lt-brd)', fontSize: 12.5, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ width: 156, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{nome}</span>
      <span style={{ flex: 1, position: 'relative', height: 18, background: 'var(--lt-bg2, #eee)', borderRadius: 4, minWidth: 80 }}>
        <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: fillW + '%', background: col, borderRadius: 4 }} />
        <span title={`ritmo do ano ${pace.toFixed(0)}%`} style={{ position: 'absolute', left: `calc(${paceX}% - 1px)`, top: -3, height: 24, width: 2, background: 'var(--lt-text)' }} />
        {over && <span style={{ position: 'absolute', right: 4, top: 0, height: '100%', display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>▸</span>}
      </span>
      <span style={{ width: 150, flex: 'none', textAlign: 'right' }}>
        <span style={{ fontWeight: 700, color: over ? RED : 'var(--lt-text)' }}>{pct.toFixed(0)}%</span>
        <span style={{ color: 'var(--lt-text3)', fontSize: 11 }}> · {fmtC(real)}/{fmtC(orc)}</span>
      </span>
    </div>
  )
}

function Velocimetro({ valor }) {
  const max = 150, ang = v => 180 - Math.min(Math.max(v, 0), max) / max * 180
  const col = valor > 120 ? RED : valor > 100 ? AMBER : VERDE
  const nd = polar(80, 86, 52, ang(valor))
  return (
    <svg width="100%" viewBox="0 0 160 102" role="img" aria-label={`Projeção do ano: ${valor.toFixed(0)}% do orçado`} style={{ maxWidth: 220, display: 'block', margin: '0 auto' }}>
      <path d={arcPath(80, 86, 60, 180, ang(100))} fill="none" stroke={VERDE} strokeWidth="13" strokeLinecap="round" />
      <path d={arcPath(80, 86, 60, ang(100), ang(120))} fill="none" stroke={AMBER} strokeWidth="13" />
      <path d={arcPath(80, 86, 60, ang(120), 0)} fill="none" stroke={RED} strokeWidth="13" strokeLinecap="round" />
      <line x1="80" y1="86" x2={nd[0].toFixed(1)} y2={nd[1].toFixed(1)} stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="80" cy="86" r="6" fill={NAVY} />
      <text x="80" y="100" textAnchor="middle" fontSize="16" fontWeight="700" fontFamily="'Raleway', sans-serif" fill={col}>{valor.toFixed(0)}%</text>
    </svg>
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
  const [tabOpen, setTabOpen] = useState(false)

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
      return { id: c.id, nome: c.nome, tipo: c.tipo, real: soma(rArr, de, ate), orc: soma(oArr, de, ate), orcAno: soma(oArr, 0, 11), realYtd: soma(rArr, 0, 11), rArr, oArr }
    })
    const saidasCats = cats.filter(c => c.tipo !== 'receita')
    const topRub = saidasCats.filter(c => c.real > 0).sort((a, b) => b.real - a.real).slice(0, 6)
    const maior = topRub[0]
    const mesesSaida = lastSaida + 1
    const consumoCats = saidasCats.filter(c => c.orcAno > 0).sort((a, b) => b.orcAno - a.orcAno)
    const semOrcCats = saidasCats.filter(c => c.orcAno === 0 && c.realYtd > 0).sort((a, b) => b.realYtd - a.realYtd)
    const totOrcAno = saidasCats.reduce((sx, c) => sx + c.orcAno, 0)
    const totRealYtd = saidasCats.reduce((sx, c) => sx + c.realYtd, 0)
    const recCats = cats.filter(c => c.tipo === 'receita')
    const receitaOrcAno = recCats.reduce((sx, c) => sx + c.orcAno, 0)
    const receitaRealYtd = recCats.reduce((sx, c) => sx + soma(c.rArr, 0, lastSaida), 0)

    return {
      cats, saidasCats, topRub, maior, sit, lastReal, incompleto,
      consumoCats, semOrcCats, totOrcAno, totRealYtd, mesesSaida, receitaOrcAno, receitaRealYtd,
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
      case 'margemPct': return { v: W.pReceita ? pct(W.pResultado / W.pReceita * 100) : '—', s: 'resultado ÷ receita' }
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
        .eq('projeto_id', projeto.id).eq('categoria_id', c.id).eq('em_quarentena', false).gte('competencia', compIni).lte('competencia', compFim).order('competencia')
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
      const ExcelJS = (await import('exceljs')).default
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
      <PageHeader projeto={projeto} titulo="Visão Geral do Orçamento" subtitulo={`${projeto?.nome || ''} · ${MESES_ABREV[de]}–${MESES_ABREV[ate]}/${ano} · regime de competência`}>
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

      {(d.importacoes && d.importacoes[0]) || W.incompleto >= 0 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, fontSize: 11, color: 'var(--lt-text3)' }}>
          {d.importacoes && d.importacoes[0] && <span><i>Última importação:</i> {d.importacoes[0].arquivo_nome || '—'}{d.importacoes[0].criado_em ? ' · ' + new Date(d.importacoes[0].criado_em).toLocaleDateString('pt-BR') : ''}</span>}
          {W.incompleto >= 0 && <span style={{ background: 'rgba(204,145,94,0.15)', color: '#A6512F', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{MESES_ABREV[W.incompleto]} parcial</span>}
        </div>
      ) : null}

      {libOpen && (
        <Card titulo="Indicadores do topo" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>ligue/desligue · ⓘ explica cada um</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => toggleCard('pnlConsumo')} style={{ textAlign: 'left', fontSize: 12.5, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--lt-brd)', background: cardsOn.includes('pnlConsumo') ? 'rgba(204,145,94,0.12)' : 'transparent', color: cardsOn.includes('pnlConsumo') ? 'var(--copper, #A6512F)' : 'var(--lt-text)', fontWeight: 600 }}>
              {cardsOn.includes('pnlConsumo') ? '✓ ' : '+ '}Painel de consumo (baterias, anéis e velocímetro){!temOrcado && <span style={{ fontSize: 10.5, fontWeight: 400 }}> · requer orçado</span>}
            </button>
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

      {temOrcado && cardsOn.includes('pnlConsumo') && (() => {
        const paceP = W.mesesSaida / 12 * 100
        const pctTot = W.totOrcAno ? W.totRealYtd / W.totOrcAno * 100 : 0
        const annual = W.mesesSaida ? W.totRealYtd / W.mesesSaida * 12 : 0
        const projPct = W.totOrcAno ? annual / W.totOrcAno * 100 : 0
        const pctRec = W.receitaOrcAno ? W.receitaRealYtd / W.receitaOrcAno * 100 : 0
        const annualRec = W.mesesSaida ? W.receitaRealYtd / W.mesesSaida * 12 : 0
        const projRecPct = W.receitaOrcAno ? annualRec / W.receitaOrcAno * 100 : 0
        const mesesRest = Math.max(0, 12 - W.mesesSaida)
        const ritmoSaida = W.mesesSaida ? W.totRealYtd / W.mesesSaida : 0
        const runSaida = mesesRest ? Math.max(0, W.totOrcAno - W.totRealYtd) / mesesRest : 0
        const ritmoRec = W.mesesSaida ? W.receitaRealYtd / W.mesesSaida : 0
        const runRec = mesesRest ? Math.max(0, W.receitaOrcAno - W.receitaRealYtd) / mesesRest : 0
        const deltaSaida = ritmoSaida ? (runSaida - ritmoSaida) / ritmoSaida * 100 : 0
        const deltaRec = ritmoRec ? (runRec - ritmoRec) / ritmoRec * 100 : 0
        const sinalPct = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0) + '%'
        return (
          <Card titulo="Consumo do orçamento — quanto do ano já foi gasto" extra={
            <span style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--lt-text3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: VERDE, marginRight: 4 }} />no ritmo</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: AMBER, marginRight: 4 }} />atenção</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: RED, marginRight: 4 }} />acelerado</span>
              <span style={{ opacity: 0.8 }}>tracejado = ritmo ({paceP.toFixed(0)}%) · receita abaixo do ritmo = vermelho</span>
            </span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, alignItems: 'start' }}>
              {W.receitaOrcAno > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 10 }}>Receita vs meta anual</div>
                  <BateriaHero pct={pctRec} pace={paceP} real={W.receitaRealYtd} orc={W.receitaOrcAno} inv />
                  <div style={{ fontSize: 11.5, color: projRecPct < 90 ? RED : 'var(--lt-text3)', textAlign: 'center', marginTop: 6 }}>
                    {`Projeção ${fmtBRL(annualRec)} · ${projRecPct.toFixed(0)}% da meta`}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 10 }}>Orçamento anual de saídas</div>
                <BateriaHero pct={pctTot} pace={paceP} real={W.totRealYtd} orc={W.totOrcAno} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 10 }}>Projeção do ano (ritmo atual)</div>
                <Velocimetro valor={projPct} />
                <div style={{ fontSize: 11.5, color: projPct > 100 ? RED : 'var(--lt-text3)', textAlign: 'center', marginTop: 2 }}>
                  {projPct > 100 ? `Fecha em ${fmtBRL(annual)} · ${pct(projPct - 100)} acima do orçado` : `Projeção ${fmtBRL(annual)} · dentro do orçado`}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,32,62,0.04)', border: '1px solid var(--lt-brd)', borderRadius: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)', marginBottom: 8 }}>Cenário redistribuição <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--lt-text3)' }}>· manter o teto/meta do ano nos {mesesRest} meses restantes</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--lt-text3)' }}>Saídas — cabe por mês: </span>
                  <span style={{ fontWeight: 700 }}>{fmtBRL(runSaida)}</span>
                  <div style={{ fontSize: 11, color: deltaSaida < 0 ? RED : 'var(--lt-text3)' }}>ritmo atual {fmtBRL(ritmoSaida)}/mês · precisa {sinalPct(deltaSaida)}</div>
                </div>
                {W.receitaOrcAno > 0 && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--lt-text3)' }}>Receita — precisa por mês: </span>
                    <span style={{ fontWeight: 700 }}>{fmtBRL(runRec)}</span>
                    <div style={{ fontSize: 11, color: deltaRec > 0 ? RED : 'var(--lt-text3)' }}>ritmo atual {fmtBRL(ritmoRec)}/mês · precisa {sinalPct(deltaRec)}</div>
                  </div>
                )}
              </div>
            </div>
            {W.consumoCats.length > 0 && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lt-text)', margin: '20px 0 12px' }}>Por categoria <span style={{ fontWeight: 400, color: 'var(--lt-text3)', fontSize: 11 }}>· % do orçado anual consumido · clique p/ explodir</span></div>
                <div>
                  {W.consumoCats.map(c => <Bullet key={c.id} nome={c.nome} pct={c.orcAno ? c.realYtd / c.orcAno * 100 : 0} pace={paceP} real={c.realYtd} orc={c.orcAno} onClick={() => drill(c)} />)}
                </div>
              </>
            )}
            {W.semOrcCats.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(204,145,94,0.08)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#A6512F', marginBottom: 6 }}>Gasto sem orçado <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--lt-text3)' }}>· realizado sem linha no orçamento — vale orçar nos próximos ciclos</span></div>
                {W.semOrcCats.map(c => (
                  <div key={c.id} onClick={() => drill(c)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', cursor: 'pointer', borderBottom: '1px solid var(--lt-brd)' }}>
                    <span>{c.nome}</span><span style={{ fontWeight: 600, color: '#A6512F' }}>{fmtBRL(c.realYtd)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })()}

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

      <Card titulo={comp ? 'Orçado × Realizado por categoria' : 'Realizado por categoria'} extra={<span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--lt-text3)' }}><span>{W.pReceitaLiq > 0 ? 'AV = % da receita líquida' : 'AV = % das saídas'} · AH = último mês vs anterior</span><button onClick={() => setTabOpen(o => !o)} style={{ fontSize: 11, borderRadius: 999, padding: '4px 12px', cursor: 'pointer', border: '1px solid var(--lt-brd)', background: tabOpen ? 'rgba(204,145,94,0.12)' : 'transparent', color: tabOpen ? 'var(--copper, #A6512F)' : 'var(--lt-text3)' }}>{tabOpen ? 'ocultar' : 'ver tabela (' + linhas.length + ')'}</button></span>} pad={false}>
        {tabOpen && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
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
        </table>}
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
