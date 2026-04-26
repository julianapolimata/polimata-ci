import { useState, useEffect, useRef } from 'react'
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
const HM_PROBS  = ['Baixa', 'Média', 'Alta', 'Extrema']
const HM_COLORS = [
  ['#FFC000','#FF0000','#FF0000','#FF0000'],
  ['#00B050','#FFC000','#FF0000','#FF0000'],
  ['#00B050','#00B050','#FFC000','#FF0000'],
  ['#00B050','#00B050','#00B050','#FFC000'],
]

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
                const txtColor = bg === '#FFFF00' ? '#333' : '#fff'
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
        <div className="modal-hdr"><div><div className="modal-ttl">{row.rc} · {row.area}</div><div className="modal-sub">{row.sub}</div></div><button className="modal-cls" onClick={onClose}>×</button></div>
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
                  {HM_IMPS.map((imp,ri) => (<div key={`row-${ri}`} style={{ display:'contents' }}><div style={{ fontSize:9,color:'var(--txt3)',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6 }}>{imp}</div>{HM_PROBS.map((prob,ci) => { const bg=HM_COLORS[ri][ci]; const isThis=ri===impIdx&&ci===probIdx; return (<div key={`${ri}-${ci}`} style={{ background:bg,borderRadius:4,aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',opacity:isThis?1:0.35,outline:isThis?'3px solid var(--gold)':'none',outlineOffset:-2 }}>{isThis&&<div style={{ width:10,height:10,borderRadius:'50%',background:'#fff',boxShadow:'0 0 6px rgba(0,0,0,.4)' }}/>}</div>) })}</div>))}
                  <div/>{HM_PROBS.map(p => <div key={p} style={{ fontSize:8,color:'var(--txt3)',textAlign:'center',paddingTop:2 }}>{p}</div>)}
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

function TabelaMRC({ rows, visCols, onOpenModal, expandAll }) {
  const v = id => visCols.has(id); const ml = expandAll ? 9999 : 70
  return (
    <div className="tbl-sc"><table><thead><tr>
      {v('dt_ult')&&<th>Data Últ. Atualização</th>}
      {v('ger')&&<th>Gerência</th>}
      {v('resp_sub')&&<th>Resp. Processo</th>}
      {v('area')&&<th>Processo</th>}
      {v('sub')&&<th>Subprocesso</th>}
      {v('rr')&&<th>Ref. Risco</th>}
      {v('dr')&&<th>Descrição do Risco</th>}
      {v('rc')&&<th>Ref. Controle</th>}
      {v('dc')&&<th>Descrição do Controle</th>}
      {v('cat')&&<th>Categoria de Controle</th>}
      {v('freq')&&<th>Frequência</th>}
      {v('nat')&&<th>Natureza</th>}
      {v('car')&&<th>Característica</th>}
      {v('sis')&&<th>Sistema</th>}
      {v('chave')&&<th>Ctrl Chave?</th>}
      {v('passos_f1')&&<th>Passos de Teste</th>}
      {v('r1')&&<th>F1 Resultado</th>}
      {v('incons')&&<th>Descrição da Inconsistência</th>}
      {v('rec')&&<th>Recomendação / Melhoria</th>}
      {v('r_ader')&&<th>F2 Aderência</th>}
      {v('r3')&&<th>F3 Resultado</th>}
      {v('r_f4c1')&&<th>F4-C1 Resultado</th>}
      {v('r_f4c2')&&<th>F4-C2 Resultado</th>}
      {v('r_f5')&&<th>F5 Resultado</th>}
      {v('imp')&&<th>Impacto</th>}
      {v('prob')&&<th>Probabilidade</th>}
      {v('crit')&&<th>Criticidade</th>}
      {v('fase')&&<th>Fase Atual</th>}
    </tr></thead><tbody>
      {rows.length === 0 && <tr><td colSpan={23} className="empty">Nenhum controle encontrado com os filtros aplicados.</td></tr>}
      {rows.map(row => (
        <tr key={row.id} style={{ cursor:'pointer' }} onClick={() => onOpenModal(row)}>
          {v('dt_ult')&&<td><span style={{fontSize:11,whiteSpace:'nowrap'}}>{row.dt_ult||'—'}</span></td>}
          {v('ger')&&<td><span style={{fontSize:11}}>{row.ger||'—'}</span></td>}
          {v('resp_sub')&&<td><span style={{fontSize:11}}>{row.resp_sub||'—'}</span></td>}
          {v('area')&&<td><span style={{fontSize:11}}>{row.area}</span></td>}
          {v('sub')&&<td><span style={{fontSize:11}}>{row.sub}</span></td>}
          {v('rr')&&<td><span style={{fontSize:11,color:'var(--gold)',fontWeight:600}}>{row.rr}</span></td>}
          {v('dr')&&<td><ExpCell text={row.dr} maxLen={ml} expanded={expandAll}/></td>}
          {v('rc')&&<td><span style={{fontSize:11,color:'var(--gold)',fontWeight:600}}>{row.rc}</span></td>}
          {v('dc')&&<td><ExpCell text={row.dc} maxLen={ml} expanded={expandAll}/></td>}
          {v('cat')&&<td><span style={{fontSize:11}}>{row.cat||'—'}</span></td>}
          {v('freq')&&<td><span style={{fontSize:11}}>{row.freq||'—'}</span></td>}
          {v('nat')&&<td><span style={{fontSize:11}}>{row.nat||'—'}</span></td>}
          {v('car')&&<td><span style={{fontSize:11}}>{row.car||'—'}</span></td>}
          {v('sis')&&<td><span style={{fontSize:11}}>{row.sis||'—'}</span></td>}
          {v('chave')&&<td><span style={{fontSize:11}}>{row.chave||'—'}</span></td>}
          {v('passos_f1')&&<td><ExpCell text={row.passos_f1} maxLen={ml} expanded={expandAll}/></td>}
          {v('r1')&&<td>{badge(R1_MAP[row.r1]||'b-na', row.r1)}</td>}
          {v('incons')&&<td><ExpCell text={row.incons} maxLen={ml} expanded={expandAll}/></td>}
          {v('rec')&&<td><ExpCell text={row.rec} maxLen={ml} expanded={expandAll}/></td>}
          {v('r_ader')&&<td>{badge(R1_MAP[row.r_ader]||'b-na', row.r_ader)}</td>}
          {v('r3')&&<td>{badge(R1_MAP[row.r3]||'b-na', row.r3)}</td>}
          {v('r_f4c1')&&<td>{badge(R1_MAP[row.r_f4c1]||'b-na', row.r_f4c1)}</td>}
          {v('r_f4c2')&&<td>{badge(R1_MAP[row.r_f4c2]||'b-na', row.r_f4c2)}</td>}
          {v('r_f5')&&<td>{badge(R1_MAP[row.r_f5]||'b-na', row.r_f5)}</td>}
          {v('imp')&&<td>{badge(IMP_MAP[row.imp]||'b-na', row.imp)}</td>}
          {v('prob')&&<td>{badge(PROB_MAP[row.prob]||'b-na', row.prob)}</td>}
          {v('crit')&&<td>{critBadge(row.crit)}</td>}
          {v('fase')&&<td><FaseAtual row={row}/></td>}
        </tr>
      ))}
    </tbody></table></div>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function MRCCompleta({ projetoId, clienteNome, projetoNome, notificacoes }) {
  const [mrc, setMrc] = useState([]); const [areas, setAreas] = useState([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState(''); const [filtroArea, setFiltroArea] = useState(''); const [filtroCrit, setFiltroCrit] = useState('')
  const [filtroImp, setFiltroImp] = useState(''); const [filtroProb, setFiltroProb] = useState(''); const [filtroR1, setFiltroR1] = useState(''); const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroFase, setFiltroFase] = useState('')
  const [visCols, setVisCols] = useState(new Set(DEFAULT_COLS)); const [colPanelOpen, setColPanelOpen] = useState(false)
  const [expandAll, setExpandAll] = useState(false); const [modalRow, setModalRow] = useState(null)

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

      <div className="mrc-hm-compact">
        <Heatmap data={filtered} filtroImp={filtroImp} filtroProb={filtroProb} onFilterCell={handleHeatmapCell} />
      </div>
      <Regua data={mrc} filtroNivel={filtroNivel} onToggleNivel={setFiltroNivel} />

      <div className="card">
        <div className="filters">
          <input type="text" placeholder="Buscar ref., área, risco, controle, inconsistência, passos…" value={busca} onChange={e => setBusca(e.target.value)} />
          <select value={filtroCrit} onChange={e => setFiltroCrit(e.target.value)}><option value="">Todas criticidades</option><option value="4">Crítico</option><option value="3">Significativo</option><option value="2">Moderado</option><option value="1">Baixo</option></select>
          <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)}><option value="">Todas as fases</option>{fasesDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}</select>
          <select value={filtroR1} onChange={e => setFiltroR1(e.target.value)}><option value="">Todos resultados</option><option>Efetivo</option><option>Inefetivo</option><option>GAP</option><option>Teste Não Realizado</option></select>
          <span className="chip">{filtered.length} controles</span>
        </div>

        <div className="mrc-actions" style={{ padding:'8px 14px',borderBottom:'1px solid var(--brd)' }}>
          <button className="btn btn-xs" onClick={() => setExpandAll(o => !o)}>⊞ {expandAll ? 'Recolher Tudo' : 'Expandir Tudo'}</button>
          {temFiltro && <button className="btn btn-ghost btn-sm" onClick={limparFiltros}>✕ Limpar filtros</button>}
          <div className="mrc-actions-right">
            <button className="btn-export btn-export-xl" title="Exportar para Excel" onClick={() => exportarMRCExcel(filtered, 'MRC_Completa_' + new Date().toISOString().slice(0,10), 'MRC Completa', clienteNome, projetoNome)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>Excel</button>
            <button className="btn-export btn-export-pdf" title="Exportar para PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF</button>
            <div className="col-panel-wrap"><button className="btn btn-xs" onClick={() => setColPanelOpen(o => !o)}>⊞ Colunas</button><ColunasPanel visCols={visCols} setVisCols={setVisCols} open={colPanelOpen} onClose={() => setColPanelOpen(false)} /></div>
          </div>
        </div>

        {isLimited && <div className="warn-strip">Exibindo {MAX_ROWS} de {filtered.length} — refine os filtros</div>}
        <TabelaMRC rows={visibleRows} visCols={visCols} onOpenModal={setModalRow} expandAll={expandAll} />
      </div>

      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
    </div>
  )
}
