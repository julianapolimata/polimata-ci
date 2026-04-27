import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { exportarMRCExcel } from '../lib/exportMRC'
import { getFaseInfo as getFaseInfoUtil } from '../lib/fases'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const CRIT_MAP = {
  4: { label: '4. Crítico',       cls: 'c4' },
  3: { label: '3. Significativo', cls: 'c3' },
  2: { label: '2. Moderado',      cls: 'c2' },
  1: { label: '1. Baixo',         cls: 'c1' },
}

const R1_MAP  = { Efetivo:'b-ef', efetivo:'b-ef', Inefetivo:'b-in', GAP:'b-gp', 'Em desenvolvimento':'b-pa', pendente:'b-pa', 'Teste Não Realizado':'b-tnr', 'N/A':'b-na' }
const IMP_MAP = { Crítico:'i-crit', Alto:'i-alto', Moderado:'i-mod', Baixo:'i-bx', 'N/A':'i-na' }
const PROB_MAP= { Extrema:'p-ext', Alta:'p-alt', Média:'p-med', Baixa:'p-bx' }

const HM_IMPS   = ['Crítico', 'Alto', 'Moderado', 'Baixo']
const HM_PROBS  = ['Extrema', 'Alta', 'Média', 'Baixa']

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('pt-BR')
}
// Cores do heatmap (mesmo padrão PorArea) — [imp][prob] com Extrema=col0
const HM_COLORS = [
  ['#EF4444', '#EF4444', '#F97316', '#EAB308'],
  ['#EF4444', '#F97316', '#EAB308', '#EAB308'],
  ['#F97316', '#EAB308', '#EAB308', '#22C55E'],
  ['#EAB308', '#22C55E', '#22C55E', '#22C55E'],
]
const CRIT_LABELS_HM = ['Crítico', 'Significativo', 'Moderado', 'Baixo']
const CRIT_CORES_HM = ['#EF4444', '#F97316', '#EAB308', '#22C55E']
function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[(v || '')] ?? -1 }
function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[(v || '')] ?? -1 }

const NIVEIS = [
  { id: 'N1', label: 'N1', nome: 'Inefetivo', cls: 'rn1', resultado: 'Inefetivo' },
  { id: 'N2', label: 'N2', nome: 'GAP',       cls: 'rn2', resultado: 'GAP' },
  { id: 'N5', label: 'N5', nome: 'Efetivo',   cls: 'rn5', resultado: 'Efetivo' },
]

const MAX_ROWS = 200

const COL_GROUPS = [
  { label: 'Identificação', cols: [
    { id: 'dt_ult', label: 'Data Últ. Atualização', default: true },
    { id: 'ger', label: 'Gerência', default: true },
    { id: 'resp_sub', label: 'Resp. Processo', default: true },
    { id: 'area', label: 'Processo', default: true },
    { id: 'sub', label: 'Subprocesso', default: true },
  ]},
  { label: 'Risco & Controle', cols: [
    { id: 'rr', label: 'Ref. Risco', default: true },
    { id: 'dr', label: 'Descrição do Risco', default: true },
    { id: 'rc', label: 'Ref. Controle', default: true },
    { id: 'dc', label: 'Descrição do Controle', default: true },
  ]},
  { label: 'Atributos', cols: [
    { id: 'cat', label: 'Categoria', default: true },
    { id: 'freq', label: 'Frequência', default: true },
    { id: 'nat', label: 'Natureza', default: true },
    { id: 'car', label: 'Característica', default: true },
    { id: 'sis', label: 'Sistema', default: true },
    { id: 'chave', label: 'Ctrl Chave?', default: true },
  ]},
  { label: 'Teste & Resultado', cols: [
    { id: 'passos_f1', label: 'Passos de Teste', default: true },
    { id: 'r1', label: 'Diagnóstico', default: true },
    { id: 'incons', label: 'Descrição da Inconsistência', default: true },
    { id: 'rec', label: 'Recomendação / Melhoria', default: true },
    { id: 'r_ader', label: 'Aderência', default: false },
    { id: 'r3', label: 'Revisão CI', default: false },
    { id: 'r_f4c1', label: 'Auditoria C1', default: false },
    { id: 'r_f4c2', label: 'Auditoria C2', default: false },
    { id: 'r_f5', label: 'Auditoria Indep.', default: false },
  ]},
  { label: 'Avaliação', cols: [
    { id: 'imp', label: 'Impacto', default: true },
    { id: 'prob', label: 'Probabilidade', default: true },
    { id: 'crit', label: 'Criticidade', default: true },
  ]},
  { label: 'Fase', cols: [
    { id: 'fase', label: 'Fase Atual', default: true },
  ]},
]

const DEFAULT_COLS = new Set(COL_GROUPS.flatMap(g => g.cols.filter(c => c.default).map(c => c.id)))

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function badge(cls, text) {
  if (!text || text === 'N/A') return <span style={{ color: 'var(--txt3)', fontSize: 10 }}>—</span>
  return <span className={`bd ${cls}`}>{text}</span>
}

function critBadge(crit) {
  if (!crit) return null
  const m = CRIT_MAP[crit]
  if (!m) return null
  return <span className={`cb ${m.cls}`}><span className="cdot" />{m.label}</span>
}

function ExpCell({ text, maxLen = 80, expanded = false }) {
  const [open, setOpen] = useState(false)
  const isOpen = expanded || open
  if (!text || text === 'N/A' || text.trim() === '') return <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
  if (text.length <= maxLen) return <span style={{ fontSize: 11.5, lineHeight: 1.5 }}>{text}</span>
  return (
    <div className="exp-row">
      <span className="exp-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>{isOpen ? '−' : '+'}</span>
      {isOpen ? <span className="exp-open">{text}</span> : <span className="exp-col">{text.slice(0, maxLen)}…</span>}
    </div>
  )
}

// ─── FASE ATUAL (centralizado em lib/fases.js) ─────────────────────────────

function getFaseInfo(row) {
  return getFaseInfoUtil(row)
}

function FaseAtual({ row }) {
  const { label, resultado, cor } = getFaseInfo(row)
  return (
    <div className="fase-atual-cell">
      <div className="fase-atual-label" style={{ borderLeftColor: cor }}>{label}</div>
      <div className="fase-atual-resultado"><span className={`bd ${R1_MAP[resultado] || 'b-na'}`}>{resultado}</span></div>
    </div>
  )
}

// ─── HEATMAP COM E/I/G ──────────────────────────────────────────────────────

function Heatmap({ data, filtroImp, filtroProb, onFilterCell }) {
  const cells = {}
  HM_IMPS.forEach(i => HM_PROBS.forEach(p => { cells[`${i}|${p}`] = { n: 0, e: 0, i: 0, g: 0 } }))
  data.forEach(r => {
    const key = `${r.imp}|${r.prob}`
    if (!cells[key]) return
    cells[key].n++
    const res = (r.r1 || '').toLowerCase()
    if (res === 'efetivo') cells[key].e++
    else if (res === 'inefetivo') cells[key].i++
    else if (res === 'gap') cells[key].g++
  })

  const totais = { C4: { n:0,e:0,i:0,g:0 }, C3: { n:0,e:0,i:0,g:0 }, C2: { n:0,e:0,i:0,g:0 }, C1: { n:0,e:0,i:0,g:0 } }
  data.forEach(r => {
    if (!r.crit) return
    const k = `C${r.crit}`; if (!totais[k]) return
    totais[k].n++
    const res = (r.r1 || '').toLowerCase()
    if (res === 'efetivo') totais[k].e++; else if (res === 'inefetivo') totais[k].i++; else if (res === 'gap') totais[k].g++
  })

  const legColors = { C4: '#FF0000', C3: '#FFC000', C2: '#FFFF00', C1: '#00B050' }
  const legLabels = { C4: 'Risco Crítico', C3: 'Risco Significativo', C2: 'Risco Moderado', C1: 'Baixo Risco' }

  return (
    <div className="hm-wrap">
      <div className="hm-grid-area">
        <div className="hm-title">Mapa de Calor — Impacto × Probabilidade</div>
        <div style={{ display: 'flex', gap: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 64, paddingBottom: 24 }}>
            {HM_IMPS.map(imp => (<div key={imp} className="hm-ylabel" style={{ minHeight: 66 }}>{imp}</div>))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
              {HM_IMPS.map((imp, ri) => HM_PROBS.map((prob, ci) => {
                const key = `${imp}|${prob}`; const c = cells[key]; const bg = HM_COLORS[ri][ci]
                const sel = filtroImp === imp && filtroProb === prob
                const txtColor = bg === '#FFFF00' ? '#00203E' : '#fff'
                const subColor = bg === '#FFFF00' ? '#555' : 'rgba(255,255,255,0.8)'
                return (
                  <div key={key} className={`hm-cell ${sel ? 'sel' : ''}`} style={{ background: bg, opacity: c.n === 0 ? 0.25 : 1 }} onClick={() => onFilterCell(imp, prob, sel)}>
                    <div className="hm-n" style={{ color: txtColor }}>{c.n}</div>
                    <div className="hm-eig" style={{ color: subColor }}><span>E:{c.e}</span><span>I:{c.i}</span><span>G:{c.g}</span></div>
                  </div>
                )
              }))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3, marginTop: 4 }}>
              {HM_PROBS.map(p => <div key={p} className="hm-xlabel">{p}</div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="hm-legend">
        {[4,3,2,1].map(cv => {
          const k = `C${cv}`; const t = totais[k]; const color = legColors[k] === '#FFFF00' ? '#D4A030' : legColors[k]
          return (
            <div key={cv} className="hm-leg" style={{ borderLeftColor: legColors[k] }}><div>
              <div className="hm-lbl">{legLabels[k]}</div>
              <div className="hm-lnum" style={{ color }}>{t.n}</div>
              <div className="hm-lsub">E:{t.e} · I:{t.i} · G:{t.g}</div>
            </div></div>
          )
        })}
      </div>
    </div>
  )
}

// ─── RÉGUA ───────────────────────────────────────────────────────────────────

function Regua({ data, filtroNivel, onToggleNivel }) {
  const c = {}; NIVEIS.forEach(n => { c[n.id] = 0 })
  data.forEach(r => { const res = r.r1; if (res === 'Inefetivo') c.N1++; else if (res === 'GAP') c.N2++; else if (res === 'Efetivo') c.N5++ })
  return (
    <div className="regua">
      {NIVEIS.map(n => (<div key={n.id} className={`rn ${n.cls} ${filtroNivel === n.id ? 'ativo' : ''}`} onClick={() => onToggleNivel(filtroNivel === n.id ? '' : n.id)}><div className="rn-c">{c[n.id]}</div><div className="rn-n">{n.nome}</div></div>))}
    </div>
  )
}

// ─── PAINEL COLUNAS ──────────────────────────────────────────────────────────

function ColunasPanel({ visCols, setVisCols, open, onClose }) {
  const ref = useRef(null)
  useEffect(() => { function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }; if (open) document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [open, onClose])
  const toggle = id => { setVisCols(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  return (
    <div ref={ref} className={`col-panel ${open ? 'open' : ''}`}>
      <div className="cp-ttl">Colunas Visíveis</div>
      {COL_GROUPS.map(g => (<div key={g.label}><div className="cp-grp">{g.label}</div>{g.cols.map(c => (<label key={c.id} className="cp-row"><input type="checkbox" checked={visCols.has(c.id)} onChange={() => toggle(c.id)} />{c.label}</label>))}</div>))}
    </div>
  )
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

export function ModalDetalhe({ row, onClose }) {
  const [tab, setTab] = useState('ident')
  if (!row) return null
  const tabs = [{ id:'ident',label:'Identificação' },{ id:'f1',label:'Diagnóstico Inicial' },{ id:'f2e1',label:'Teste de Desenho' },{ id:'f2e2',label:'Teste de Aderência' },{ id:'f3',label:'Revisão Controles Internos' },{ id:'f4c1',label:'Auditoria Contínua C1' },{ id:'f4c2',label:'Auditoria Contínua C2' },{ id:'f5',label:'Auditoria Independente' }]
  const field = (l, v, fw) => { if (!v || v === 'N/A' || v === '') return null; return <div style={fw ? { marginBottom: 12 } : {}}><div className="ml">{l}</div><div className="mv">{v}</div></div> }
  const fieldTag = (l, v) => { if (!v || v === 'N/A' || v === '') return null; return <div><div className="ml">{l}</div><div style={{ marginTop: 3 }}><span className="tag">{v}</span></div></div> }
  const fieldText = (l, v) => { if (!v || v === 'N/A' || v === '') return null; return <div style={{ marginBottom: 14 }}>{l && <div className="ml">{l}</div>}<div className="mv-t">{v}</div></div> }
  const faseInfo = getFaseInfo(row)
  const impIdx = HM_IMPS.indexOf(row.imp); const probIdx = HM_PROBS.indexOf(row.prob)

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr"><div><div className="modal-ttl">{row.rc}{row.area ? ` · ${row.area}` : ''}</div><div className="modal-sub">{row.sub}</div></div><button className="modal-cls" onClick={onClose}>×</button></div>
        <div className="modal-tabs">{tabs.map(t => (<div key={t.id} className={`mtab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>))}</div>
        <div className="modal-body">

          {tab === 'ident' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Identificação do Controle</div><div className="mr">{field('Ref. Risco', row.rr)}{field('Ref. Controle', row.rc)}</div><div className="mr">{field('Área', row.area)}{field('Subprocesso', row.sub)}</div><div className="mr">{field('Gerência', row.ger)}{field('Responsável Processo', row.resp_sub)}</div></div>
            <div className="ms"><div className="ms-t">Descrição do Risco</div>{fieldText(null, row.dr)}</div>
            <div className="ms"><div className="ms-t">Descrição do Controle</div>{fieldText(null, row.dc)}</div>
            <div className="ms"><div className="ms-t">Atributos do Controle</div><div className="mr3">{fieldTag('Categoria', row.cat)}{fieldTag('Frequência', row.freq)}{fieldTag('Natureza', row.nat)}</div><div className="mr3">{fieldTag('Característica', row.car)}{fieldTag('Sistema', row.sis)}{fieldTag('Controle Chave', row.chave)}</div>
              <div className="mr" style={{ marginTop: 12 }}>
                <div><div className="ml">Fase Atual</div><div style={{ display:'flex',alignItems:'center',gap:8,marginTop:4 }}><span className="fp" style={{ borderLeft:`3px solid ${faseInfo.cor}`,color:faseInfo.cor }}>{faseInfo.label.split(' — ')[0]}</span><span className={`bd ${R1_MAP[faseInfo.resultado]||'b-na'}`}>{faseInfo.resultado}</span></div></div>
                <div><div className="ml">Peso no Cálculo</div><div style={{ fontSize:22,fontWeight:300,fontFamily:"'Montserrat',sans-serif",marginTop:4 }}>{(({4:0.4,3:0.3,2:0.2,1:0.1}[row.crit]||0.1)/522*100).toFixed(3)}%</div></div>
              </div>
            </div>
            <div className="ms"><div className="ms-t">Posição no Mapa de Calor</div>
              <div style={{ display:'flex',gap:20,alignItems:'flex-start' }}>
                <div style={{ display:'grid',gridTemplateColumns:'60px repeat(4,1fr)',gap:3,maxWidth:260,flexShrink:0 }}>
                  {HM_IMPS.map((imp,ri) => (<div key={`row-${ri}`} style={{ display:'contents' }}><div style={{ fontSize:10,color:'var(--txt3)',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6 }}>{imp}</div>{HM_PROBS.map((prob,ci) => { const bg=HM_COLORS[ri][ci]; const isThis=ri===impIdx&&ci===probIdx; return (<div key={`${ri}-${ci}`} style={{ background:bg,borderRadius:4,aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',opacity:isThis?1:0.35,outline:isThis?'3px solid var(--gold)':'none',outlineOffset:-2 }}>{isThis&&<div style={{ width:10,height:10,borderRadius:'50%',background:'#fff',boxShadow:'0 0 6px rgba(0,0,0,.4)' }}/>}</div>) })}</div>))}
                  <div/>{HM_PROBS.map(p => <div key={p} style={{ fontSize:9,color:'var(--txt3)',textAlign:'center',paddingTop:2 }}>{p}</div>)}
                </div>
                <div style={{ flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:6 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,border:'1px solid var(--lt-border)',background:'var(--lt-bg)' }}>
                    <span className="ml" style={{ marginBottom:0,minWidth:80 }}>Impacto</span>
                    {row.imp ? <span className={`bd ${IMP_MAP[row.imp]||''}`}>{row.imp}</span> : <span style={{ color:'var(--txt3)',fontSize:11 }}>—</span>}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,border:'1px solid var(--lt-border)',background:'var(--lt-bg)' }}>
                    <span className="ml" style={{ marginBottom:0,minWidth:80 }}>Probabilidade</span>
                    {row.prob ? <span className={`bd ${PROB_MAP[row.prob]||''}`}>{row.prob}</span> : <span style={{ color:'var(--txt3)',fontSize:11 }}>—</span>}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,border:'1px solid var(--lt-border)',background:'var(--lt-bg)' }}>
                    <span className="ml" style={{ marginBottom:0,minWidth:80 }}>Criticidade</span>
                    {critBadge(row.crit) || <span style={{ color:'var(--txt3)',fontSize:11 }}>—</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>)}

          {tab === 'f1' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Resultado do Diagnóstico</div><div className="mr3">{field('Resultado Diagnóstico', row.r1 ? badge(R1_MAP[row.r1]||'b-na', row.r1) : null)}{field('Impacto', row.imp ? badge(IMP_MAP[row.imp]||'', row.imp) : null)}{field('Probabilidade', row.prob ? badge(PROB_MAP[row.prob]||'', row.prob) : null)}</div><div className="mr">{field('Criticidade', critBadge(row.crit))}</div></div>
            {row.passos_f1 && row.passos_f1 !== 'N/A' && <div className="ms"><div className="ms-t">Passos de Teste</div>{fieldText(null, row.passos_f1)}</div>}
            {row.incons && row.incons !== 'N/A' && <div className="ms"><div className="ms-t">Inconsistências Identificadas</div>{fieldText(null, row.incons)}</div>}
            {row.rec && row.rec !== 'N/A' && <div className="ms"><div className="ms-t">Recomendações</div>{fieldText(null, row.rec)}</div>}
          </div>)}

          {tab === 'f2e1' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Teste de Desenho</div><div className="mr3">{field('Demanda PA', row.dem_pa)}{field('Status PA', row.st_pa ? badge(R1_MAP[row.st_pa]||'b-na', row.st_pa) : null)}{field('Data Conclusão', row.dt_ult ? new Date(row.dt_ult).toLocaleDateString('pt-BR') : null)}</div>{field('Responsável PA', row.resp_pa, true)}{fieldText('Comentário PA', row.coment_pa)}</div>
            <div className="ms"><div className="ms-t">Controle Redesenhado</div>{fieldText('Novo Descritivo de Controle', row.dc_novo)}</div>
          </div>)}

          {tab === 'f2e2' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Resultado do Teste de Aderência</div><div className="mr">{field('Resultado', row.r_ader ? badge(R1_MAP[row.r_ader]||'b-na', row.r_ader) : null)}{row.dt_teste && field('Data Teste', new Date(row.dt_teste).toLocaleDateString('pt-BR'))}</div>{row.melhoria==='Sim'&&<div style={{marginBottom:8}}><span className="tag">Oportunidade de Melhoria</span></div>}{fieldText('Inconsistências', row.incons_ader)}{fieldText('Comentários', row.coment_ader)}</div>
          </div>)}

          {tab === 'f3' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Revisão dos Controles</div><div className="mr">{field('Status Revisão', row.st_f3 ? badge(R1_MAP[row.st_f3]||'b-na', row.st_f3) : null)}{field('Resultado Revisão', row.r3 ? badge(R1_MAP[row.r3]||'b-na', row.r3) : null)}</div>{fieldText('Inconsistências F3', row.incons_f3)}{fieldText('Recomendações F3', row.rec_f3)}</div>
          </div>)}

          {tab === 'f4c1' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Auditoria Contínua — Ciclo 1</div><div className="mr">{field('Resultado', row.r_f4c1 ? badge(R1_MAP[row.r_f4c1]||'b-na', row.r_f4c1) : null)}</div>{fieldText('Inconsistências', row.incons_f4c1)}{fieldText('Recomendações', row.rec_f4c1)}</div>
          </div>)}

          {tab === 'f4c2' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Auditoria Contínua — Ciclo 2</div><div className="mr">{field('Resultado', row.r_f4c2 ? badge(R1_MAP[row.r_f4c2]||'b-na', row.r_f4c2) : null)}</div>{fieldText('Inconsistências', row.incons_f4c2)}{fieldText('Recomendações', row.rec_f4c2)}</div>
          </div>)}

          {tab === 'f5' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Auditoria Independente</div><div className="mr">{field('Resultado', row.r_f5 ? badge(R1_MAP[row.r_f5]||'b-na', row.r_f5) : null)}</div>{fieldText('Inconsistências', row.incons_f5)}{fieldText('Recomendações', row.rec_f5)}</div>
          </div>)}

        </div>
        <div className="modal-ftr"><button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  )
}

// ─── TABELA MRC ──────────────────────────────────────────────────────────────

// Headers de fase coloridos (padrão PorArea)
const MRC_FASE_HDR = [
  { h: 'Fase 1\nDiagnóstico', bg: '#00203E' },
  { h: 'Fase 2\nE1 - Desenho', bg: '#1D3B5C' },
  { h: 'Fase 2\nE2 - Efetividade', bg: '#1D3B5C' },
  { h: 'Fase 3\nRevisão Integral', bg: '#660033' },
  { h: 'Fase 4\nAI - Ciclo 1', bg: '#660066' },
  { h: 'Fase 4\nAI - Ciclo 2', bg: '#660066' },
  { h: 'Fase 5\nAuditoria Indep.', bg: '#A6512F' },
]
const FASE_W = 90
const mrcFaseThS = { fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff', padding: '4px 6px', textAlign: 'center', whiteSpace: 'pre-line', position: 'sticky', top: 0, zIndex: 2, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, borderBottom: 'none', borderRadius: '8px 8px 0 0' }
const mrcThS = { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: 'var(--lt-card)', padding: '10px 10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--lt-border)' }
const mrcTdS = { padding: '5px 8px', borderBottom: '1px solid var(--lt-border)', fontSize: 11, color: 'var(--lt-text2)', whiteSpace: 'nowrap', verticalAlign: 'middle' }

function badgeFaseMRC(val) {
  if (!val || val === 'Teste Não Realizado' || val === 'N/A') return <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--lt-text3)' }}>Não iniciado</span>
  return badge(R1_MAP[val] || 'b-na', val)
}

function badgeResultado(val) {
  if (!val || val === 'N/A') return <span style={{ color: 'var(--lt-text3)', fontSize: 10 }}>—</span>
  return <span className={`bd ${R1_MAP[val] || 'b-na'}`}>{val}</span>
}

function TdMRC({ children, w = 150, wrap = false }) {
  return <td style={{ ...mrcTdS, width: w, minWidth: w, maxWidth: w, overflow: 'hidden', textOverflow: wrap ? undefined : 'ellipsis', whiteSpace: wrap ? 'normal' : 'nowrap', lineHeight: wrap ? 1.4 : undefined }}>{children || '—'}</td>
}

const MRC_DATA_COLS = [
  { h: 'Última Alteração', w: 95, k: '_dt' },
  { h: 'Processo', w: 120, k: 'area' }, { h: 'Subprocesso', w: 120, k: 'sub' }, { h: 'Ref. Risco', w: 80, k: 'rr' },
  { h: 'Desc. Risco', w: 200, k: 'dr' }, { h: 'Ref. Controle', w: 90, k: 'rc' }, { h: 'Desc. Controle', w: 200, k: 'dc' },
  { h: 'Resultado', w: 90, k: 'r1' }, { h: 'Criticidade', w: 110, k: 'crit' },
]
const MRC_FASE_KEYS = ['r1', 'st_pa', 'r_ader', 'r3', 'r_f4c1', 'r_f4c2', 'r_f5']

function sortVal(row, k) {
  if (k === '_dt') return row.dt_ult || row.atualizado_em || row.criado_em || ''
  return row[k] ?? ''
}

function TabelaMRC({ rows, onOpenModal }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const toggle = (k) => { if (sortCol === k) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setSortCol(k); setSortDir('asc') } }
  const arrow = (k) => sortCol === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  const sorted = useMemo(() => {
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      let va = sortVal(a, sortCol), vb = sortVal(b, sortCol)
      if (sortCol === '_dt') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; return sortDir === 'asc' ? va - vb : vb - va }
      va = String(va).toLowerCase(); vb = String(vb).toLowerCase()
      const cmp = va.localeCompare(vb, 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  const thClick = { cursor: 'pointer', userSelect: 'none' }
  return (
    <div style={{ flex: 1, overflowX: 'scroll', overflowY: 'auto', minHeight: 0 }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {MRC_DATA_COLS.map((col, i) => <th key={i} style={{ ...mrcThS, width: col.w, minWidth: col.w, ...thClick }} onClick={() => toggle(col.k)}>{col.h}{arrow(col.k)}</th>)}
          {MRC_FASE_HDR.map((f, i) => <th key={`f${i}`} style={{ ...mrcFaseThS, background: f.bg, ...thClick }} onClick={() => toggle(MRC_FASE_KEYS[i])}>{f.h}{arrow(MRC_FASE_KEYS[i])}</th>)}
        </tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={16} style={{ textAlign: 'center', padding: 24, color: 'var(--lt-text3)', fontSize: 12 }}>Nenhum controle encontrado com os filtros aplicados.</td></tr>}
          {sorted.map(row => (
            <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => onOpenModal(row)} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
              <td style={{ ...mrcTdS, width: 95, minWidth: 95, fontSize: 10, color: 'var(--lt-text3)' }}>{fmtDate(row.dt_ult || row.atualizado_em || row.criado_em)}</td>
              <TdMRC w={120}>{row.area}</TdMRC>
              <TdMRC w={120}>{row.sub}</TdMRC>
              <td style={{ ...mrcTdS, color: 'var(--copper)', fontWeight: 600, width: 80, minWidth: 80 }}>{row.rr}</td>
              <TdMRC w={200}>{row.dr}</TdMRC>
              <td style={{ ...mrcTdS, color: 'var(--copper)', fontWeight: 600, width: 90, minWidth: 90 }}>{row.rc}</td>
              <TdMRC w={200}>{row.dc}</TdMRC>
              <td style={{ ...mrcTdS, width: 90, minWidth: 90 }}>{badgeResultado(row.r1)}</td>
              <td style={{ ...mrcTdS, width: 110, minWidth: 110 }}>{critBadge(row.crit)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.r1)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.st_pa)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.r_ader)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.r3)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.r_f4c1)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.r_f4c2)}</td>
              <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(row.r_f5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function MRCCompleta({ projetoId, clienteNome, projetoNome, notificacoes }) {
  const [mrc, setMrc] = useState([]); const [areas, setAreas] = useState([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState(''); const [filtroArea, setFiltroArea] = useState(''); const [filtroCrit, setFiltroCrit] = useState('')
  const [filtroImp, setFiltroImp] = useState(''); const [filtroProb, setFiltroProb] = useState(''); const [filtroR1, setFiltroR1] = useState(''); const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroFase, setFiltroFase] = useState('')
  const [modalRow, setModalRow] = useState(null)
  const [dashCollapsed, setDashCollapsed] = useState(false)

  useEffect(() => {
    if (!projetoId) return
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('mrc').select('*').eq('projeto_id', projetoId).order('id')
      if (error) { setErro(error.message); setLoading(false); return }
      setMrc(data || []); setAreas([...new Set((data||[]).map(r=>r.area))].filter(Boolean).sort()); setLoading(false)
    }
    load()
  }, [projetoId])

  // KPIs — iguala padrão PorArea
  const kpis = useMemo(() => {
    let ef = 0, inf = 0, gap = 0, pa = 0
    mrc.forEach(c => {
      const r = (c.r1 || '').toLowerCase()
      if (r === 'efetivo') ef++
      else if (r === 'inefetivo') inf++
      else if (r === 'gap' || r === 'gap de processo') gap++
      const needsPA = ['inefetivo','gap','gap de processo'].some(v =>
        (c.r1||'').toLowerCase() === v || (c.r_ader||'').toLowerCase() === v || (c.r3||'').toLowerCase() === v
      )
      const paDone = ['efetivo','concluído','concluido','ok'].includes((c.st_pa||'').toLowerCase())
      if (needsPA && !paDone) pa++
    })
    return { ef, inf, gap, pa }
  }, [mrc])

  const heatGrid = useMemo(() => {
    const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
    mrc.forEach(c => {
      const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
      if (ri >= 0 && ci >= 0) grid[ri][ci]++
    })
    return grid
  }, [mrc])

  const filtered = mrc.filter(r => {
    if (filtroArea && r.area !== filtroArea) return false
    if (filtroCrit && r.crit !== parseInt(filtroCrit)) return false
    if (filtroImp && r.imp !== filtroImp) return false
    if (filtroProb && r.prob !== filtroProb) return false
    if (filtroR1 && r.r1 !== filtroR1) return false
    if (filtroNivel) { const nivel = NIVEIS.find(n => n.id === filtroNivel); if (nivel && r.r1 !== nivel.resultado) return false }
    if (filtroFase) { const fi = getFaseInfo(r); if (fi.label !== filtroFase) return false }
    if (busca) { const q = busca.toLowerCase(); return (r.rr||'').toLowerCase().includes(q)||(r.rc||'').toLowerCase().includes(q)||(r.area||'').toLowerCase().includes(q)||(r.sub||'').toLowerCase().includes(q)||(r.dr||'').toLowerCase().includes(q)||(r.dc||'').toLowerCase().includes(q)||(r.incons||'').toLowerCase().includes(q)||(r.passos_f1||'').toLowerCase().includes(q) }
    return true
  })

  const fasesDisponiveis = [...new Set(mrc.map(r => getFaseInfo(r).label))].sort()

  const visibleRows = filtered.slice(0, MAX_ROWS); const isLimited = filtered.length > MAX_ROWS
  const handleHeatmapCell = (imp, prob, sel) => { if (sel) { setFiltroImp(''); setFiltroProb('') } else { setFiltroImp(imp); setFiltroProb(prob) } }
  const limparFiltros = () => { setBusca(''); setFiltroArea(''); setFiltroCrit(''); setFiltroImp(''); setFiltroProb(''); setFiltroR1(''); setFiltroNivel(''); setFiltroFase('') }
  const temFiltro = busca || filtroArea || filtroCrit || filtroImp || filtroProb || filtroR1 || filtroNivel || filtroFase

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'var(--txt3)' }}><div className="spinner" style={{marginRight:10}}/><span>Carregando MRC…</span></div>
  if (erro) return <div style={{ padding:32,color:'var(--in)' }}>Erro ao carregar MRC: {erro}</div>

  return (
    <div className="mrc-wrap">
      <div className="mrc-header-bar">
        <div>
          <div className="dash-eye">Matriz de Riscos e Controles</div>
          <div className="dash-ttl" style={{ marginBottom: 0 }}>MRC Completa</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:20 }}>
          <div className="mrc-header-stats">
            <div className="mrc-stat"><span className="mrc-stat-n">{mrc.length}</span><span className="mrc-stat-l">controles</span></div>
            <div className="mrc-stat"><span className="mrc-stat-n">{areas.length}</span><span className="mrc-stat-l">áreas</span></div>
          </div>
          {notificacoes}
        </div>
      </div>

      {/* TOGGLE COLAPSAR DASH */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
        <button onClick={() => setDashCollapsed(c => !c)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 999, padding: '2px 18px', cursor: 'pointer', fontSize: 10, color: 'var(--lt-text3)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
          {dashCollapsed ? '▼ Expandir painel' : '▲ Recolher painel'}
        </button>
      </div>

      {/* ZONA SUPERIOR — HEATMAP + KPIs (padrão PorArea) */}
      {!dashCollapsed && <div style={{ display: 'flex', gap: 10, flexShrink: 0, margin: '6px 0 8px' }}>
        <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--lt-text3)', marginBottom: 8 }}>Mapa de Calor — Impacto × Probabilidade</div>
          <div style={{ display: 'flex', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 6, width: 55, flexShrink: 0 }}>
              {HM_IMPS.map(l => <div key={l} style={{ fontSize: 9, fontWeight: 600, color: 'var(--lt-text3)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>{l}</div>)}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {heatGrid.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 2, flex: 1 }}>
                  {row.map((val, ci) => (
                    <div key={ci} style={{ flex: 1, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', minHeight: 36, background: val === 0 ? 'rgba(10,37,64,0.04)' : HM_COLORS[ri][ci], cursor: 'pointer' }}
                      onClick={() => handleHeatmapCell(HM_IMPS[ri], HM_PROBS[ci], filtroImp === HM_IMPS[ri] && filtroProb === HM_PROBS[ci])}>
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', paddingLeft: 61, paddingTop: 4, gap: 2 }}>
            {HM_PROBS.map(l => <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--lt-text3)' }}>{l}</div>)}
          </div>
          <div style={{ textAlign: 'center', marginTop: 1, fontSize: 7, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--lt-text3)' }}>Probabilidade →</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--lt-border)' }}>
            {CRIT_LABELS_HM.map((l, i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--lt-text3)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CRIT_CORES_HM[i] }} />
                {l}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid var(--navy)', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
            <div style={kpiLabelS}>Total de Controles</div>
            <div style={{ ...kpiValorS, color: 'var(--navy)' }}>{mrc.length}</div>
            <div style={kpiSubS}>{areas.length} áreas · Metodologia Polímata</div>
          </div>
          <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid var(--copper)', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
            <div style={kpiLabelS}>Áreas</div>
            <div style={{ ...kpiValorS, color: 'var(--copper)' }}>{areas.length}</div>
            <div style={kpiSubS}>{clienteNome} · {projetoNome}</div>
          </div>
          <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid #22C55E', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
            <div style={kpiLabelS}>Efetivos</div>
            <div style={{ ...kpiValorS, color: '#22C55E' }}>{kpis.ef}</div>
            <div style={kpiSubS}>{mrc.length > 0 ? Math.round(kpis.ef / mrc.length * 100) : 0}% do total</div>
          </div>
          <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid #FACC15', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
            <div style={kpiLabelS}>Inefetivos</div>
            <div style={{ ...kpiValorS, color: '#FACC15' }}>{kpis.inf}</div>
            <div style={kpiSubS}>Aguardam ação corretiva</div>
          </div>
          <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid #EF4444', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
            <div style={kpiLabelS}>GAP</div>
            <div style={{ ...kpiValorS, color: '#EF4444' }}>{kpis.gap}</div>
            <div style={kpiSubS}>Riscos sem controle</div>
          </div>
          <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: 'none', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #CC915E, #A6512F)' }} />
            <div style={kpiLabelS}>Planos de Ação</div>
            <div style={{ ...kpiValorS, color: 'var(--copper)' }}>{kpis.pa}</div>
            <div style={kpiSubS}>Em desenvolvimento</div>
          </div>
        </div>
      </div>}

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', marginBottom: 6 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ref., área, risco, controle, inconsistência…" style={{ flex: 1, minWidth: 200, background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, outline: 'none', color: 'var(--lt-text)' }} />
        <select value={filtroCrit} onChange={e => setFiltroCrit(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todas criticidades</option><option value="4">Crítico</option><option value="3">Significativo</option><option value="2">Moderado</option><option value="1">Baixo</option></select>
        <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todas as fases</option>{fasesDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}</select>
        <select value={filtroR1} onChange={e => setFiltroR1(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todos resultados</option><option>Efetivo</option><option>Inefetivo</option><option>GAP</option><option>Teste Não Realizado</option></select>
        <span style={{ fontSize: 10, color: 'var(--lt-text3)', fontWeight: 600 }}>{filtered.length} controles</span>
        {temFiltro && <button onClick={limparFiltros} style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--copper)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✕ Limpar</button>}
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(204,145,94,0.1)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 999, padding: '5px 10px', fontSize: 10, fontWeight: 600, color: 'var(--copper)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }} onClick={() => exportarMRCExcel(filtered, 'MRC_Completa_' + new Date().toISOString().slice(0,10), 'MRC Completa', clienteNome, projetoNome)}>Excel</button>
      </div>

      {/* TABELA */}
      <div style={{ flex: 1, minHeight: 0, background: 'var(--lt-card)', borderRadius: 12, border: '1px solid var(--lt-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
        {isLimited && <div style={{ background: 'rgba(234,179,8,0.1)', color: '#92400E', fontSize: 10, padding: '4px 14px', borderBottom: '1px solid var(--lt-border)', fontWeight: 500 }}>Exibindo {MAX_ROWS} de {filtered.length} — refine os filtros</div>}
        <TabelaMRC rows={visibleRows} onOpenModal={setModalRow} />
      </div>

      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
    </div>
  )
}

// Estilos KPI (padrão PorArea)
const kpiLabelS = { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lt-text3)', marginBottom: 4 }
const kpiValorS = { fontSize: 28, fontWeight: 300, lineHeight: 1 }
const kpiSubS = { fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 }
