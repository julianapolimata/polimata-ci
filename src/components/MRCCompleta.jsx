import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportarMRCExcel } from '../lib/exportMRC'
import { getFaseInfo as getFaseInfoUtil } from '../lib/fases'
import { useSort, useColumnResize } from '../lib/useTableFeatures'
import { getStatusConfig } from '../lib/statusWorkflow'

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
          const bgMap = { C4: 'rgba(239,68,68,.18)', C3: 'rgba(249,115,22,.18)', C2: 'rgba(234,179,8,.18)', C1: 'rgba(34,197,94,.18)' }
          const borderMap = { C4: 'rgba(239,68,68,.35)', C3: 'rgba(249,115,22,.35)', C2: 'rgba(234,179,8,.35)', C1: 'rgba(34,197,94,.35)' }
          return (
            <div key={cv} className="hm-leg" style={{ background: bgMap[k], borderColor: borderMap[k] }}>
              <div className="hm-lnum" style={{ color }}>{t.n}</div>
              <div className="hm-lbl" style={{ color }}>{legLabels[k]}</div>
              <div className="hm-lsub">E:{t.e} · I:{t.i} · G:{t.g}</div>
            </div>
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
  const bgMap = { rn1: { bg: 'rgba(245,185,66,.15)', bc: 'rgba(245,185,66,.4)', c: '#B8860B' }, rn2: { bg: 'rgba(240,86,86,.15)', bc: 'rgba(240,86,86,.4)', c: '#DC2626' }, rn5: { bg: 'rgba(34,197,94,.15)', bc: 'rgba(34,197,94,.4)', c: '#059669' } }
  return (
    <div className="regua">
      {NIVEIS.map(n => {
        const s = bgMap[n.cls] || {}
        return (<div key={n.id} className={`rn ${filtroNivel === n.id ? 'ativo' : ''}`} style={{ background: s.bg, borderLeftColor: s.bc, cursor: 'pointer' }} onClick={() => onToggleNivel(filtroNivel === n.id ? '' : n.id)}>
          <div className="rn-n">{n.nome}</div>
          <div className="rn-c" style={{ color: s.c }}>{c[n.id]}</div>
        </div>)
      })}
    </div>
  )
}

// ─── PAINEL COLUNAS ──────────────────────────────────────────────────────────

// ─── MODAL ───────────────────────────────────────────────────────────────────

export function ModalDetalhe({ row, onClose }) {
  const [tab, setTab] = useState('ident')
  if (!row) return null
  const tabs = [{ id:'ident',label:'Identificação' },{ id:'f1',label:'F1 — Diagnóstico Inicial' },{ id:'f2e1',label:'F2-E1 — Teste de Desenho' },{ id:'f2e2',label:'F2-E2 — Teste de Aderência' },{ id:'f3',label:'F3 — Revisão Controles Internos' },{ id:'f4c1',label:'F4-C1 — Auditoria Contínua' },{ id:'f4c2',label:'F4-C2 — Auditoria Contínua' },{ id:'f5',label:'F5 — Auditoria Independente' }]
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

function TabelaMRC({ rows, onOpenModal }) {
  const { sortKey, toggleSort, sortData, sortIndicator } = useSort()
  const { onResizeStart, getWidth } = useColumnResize({})
  const sorted = sortData(rows)

  const thS = { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: 'var(--lt-card)', padding: '12px 16px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--lt-border)', cursor: 'pointer', userSelect: 'none' }
  const tdS = { padding: '7px 8px', borderBottom: '1px solid var(--lt-border)', fontSize: 11, color: 'var(--lt-text2)', whiteSpace: 'nowrap', verticalAlign: 'top' }
  const bdgS = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600 }

  function badgeR(r) {
    if (!r || r === 'Teste Não Realizado') return <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{r||'—'}</span>
    const v = (r||'').toLowerCase()
    if (v === 'efetivo') return <span style={{ ...bdgS, background: 'rgba(34,197,94,0.1)', color: 'var(--n4-vis)' }}>Efetivo</span>
    if (v === 'inefetivo') return <span style={{ ...bdgS, background: 'rgba(234,179,8,0.1)', color: '#CA8A04' }}>Inefetivo</span>
    if (v === 'gap' || v === 'gap de processo') return <span style={{ ...bdgS, background: 'rgba(239,68,68,0.1)', color: 'var(--n1)' }}>GAP</span>
    return <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{r}</span>
  }
  const CRT_C = { 4: { bg: 'rgba(239,68,68,0.1)', c: '#DC2626', l: '4. Crítico' }, 3: { bg: 'rgba(249,115,22,0.1)', c: '#EA580C', l: '3. Significativo' }, 2: { bg: 'rgba(234,179,8,0.1)', c: '#CA8A04', l: '2. Moderado' }, 1: { bg: 'rgba(34,197,94,0.1)', c: '#16A34A', l: '1. Baixo' } }
  function badgeCrit(v) { const m = CRT_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />{m.l}</span> : <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{v||'—'}</span> }
  function faseBdg(val) {
    if (!val || val === 'Teste Não Realizado') return <span style={{ fontSize: 9, color: 'var(--lt-text3)', fontStyle: 'italic' }}>Não iniciado</span>
    if (val === 'N/A') return <span style={{ fontSize: 9, color: 'var(--lt-text3)' }}>N/A</span>
    const label = val.charAt(0).toUpperCase() + val.slice(1)
    return badgeR(label)
  }
  function Td({ children, w = 150 }) { return <td style={{ ...tdS, width: w, minWidth: w, maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children || '—'}</td> }

  const COLS = [
    { h: 'Data Últ. Atual.', w: 100, k: 'dt_ult' },
    { h: 'Processo', w: 120, k: 'area' },
    { h: 'Subprocesso', w: 120, k: 'sub' },
    { h: 'Ref. Risco', w: 80, k: 'rr' },
    { h: 'Desc. Risco', w: 200, k: 'dr' },
    { h: 'Ref. Controle', w: 90, k: 'rc' },
    { h: 'Desc. Controle', w: 200, k: 'dc' },
    { h: 'Resultado', w: 80, k: 'r1' },
    { h: 'Criticidade', w: 100, k: 'crit' },
  ]
  const FASE_COLS = [
    { h1: 'Fase 1', h2: 'Diagnóstico', w: 110, k: 'r1', color: 'var(--navy)' },
    { h1: 'Fase 2', h2: 'Desenho', w: 110, k: 'st_pa', color: 'var(--navy-soft)' },
    { h1: 'Fase 2', h2: 'Aderência', w: 110, k: 'r_ader', color: 'var(--navy-soft)' },
    { h1: 'Fase 3', h2: 'Revisão Integral', w: 110, k: 'r3', color: 'var(--f3-phase)' },
    { h1: 'Fase 4', h2: 'AI - Ciclo 1', w: 110, k: 'r_f4c1', color: 'var(--f4-phase)' },
    { h1: 'Fase 4', h2: 'AI - Ciclo 2', w: 110, k: 'r_f4c2', color: 'var(--f4-phase)' },
    { h1: 'Fase 5', h2: 'Auditoria Externa', w: 110, k: 'r_f5', color: 'var(--copper-deep)' },
  ]

  return (
    <div style={{ flex: 1, overflowX: 'scroll', overflowY: 'auto', minHeight: 0 }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {COLS.map((col, i) => {
            const cw = getWidth(col.k, col.w)
            return <th key={i} className={`th-sort${sortKey===col.k?' sorted':''}`} onClick={() => toggleSort(col.k)} style={{ ...thS, width: cw, minWidth: cw }}>
              {col.h}<span className="sort-arrow">{sortIndicator(col.k)}</span>
              <span className="resize-handle" onClick={e => e.stopPropagation()} onMouseDown={e => onResizeStart(e, col.k)} />
            </th>
          })}
          {FASE_COLS.map((col, i) => {
            const cw = getWidth(col.k, col.w)
            return <th key={`f${i}`} className={`th-sort${sortKey===col.k?' sorted':''}`} onClick={() => toggleSort(col.k)} style={{ color: 'white', background: col.color, padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 2, width: cw, minWidth: cw, borderBottom: '1px solid var(--lt-border)', borderLeft: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px 8px 0 0', cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85 }}>{col.h1}</div>
              <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2 }}>{col.h2}</div>
              <span className="resize-handle" onClick={e => e.stopPropagation()} onMouseDown={e => onResizeStart(e, col.k)} />
            </th>
          })}
          <th style={{ ...thS, width: 140, minWidth: 140, textAlign: 'center' }}>Status Atual</th>
        </tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={17} style={{ padding: 32, textAlign: 'center', color: 'var(--lt-text3)' }}>Nenhum controle encontrado.</td></tr>}
          {sorted.map((c, i) => (
            <tr key={c.id||i} onClick={() => onOpenModal(c)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
              <Td w={getWidth('dt_ult',100)}>{c.dt_ult ? new Date(c.dt_ult).toLocaleDateString('pt-BR') : '—'}</Td>
              <Td w={getWidth('area',120)}>{c.area}</Td>
              <Td w={getWidth('sub',120)}>{c.sub}</Td>
              <td style={{ ...tdS, color: 'var(--copper)', fontWeight: 600, width: getWidth('rr',80), minWidth: getWidth('rr',80) }}>{c.rr}</td>
              <Td w={getWidth('dr',200)}>{c.dr}</Td>
              <td style={{ ...tdS, color: 'var(--copper)', fontWeight: 600, width: getWidth('rc',90), minWidth: getWidth('rc',90) }}>{c.rc}</td>
              <Td w={getWidth('dc',200)}>{c.dc}</Td>
              <td style={{ ...tdS, width: getWidth('r1',80), minWidth: getWidth('r1',80) }}>{badgeR(c.r1)}</td>
              <td style={{ ...tdS, width: getWidth('crit',100), minWidth: getWidth('crit',100) }}>{badgeCrit(c.crit)}</td>
              {(() => {
                const f1Ef = c.r1 && c.r1.toLowerCase() === 'efetivo'
                const vals = [c.r1, f1Ef ? 'N/A' : c.st_pa, f1Ef ? 'N/A' : c.r_ader, c.r3, c.r_f4c1, c.r_f4c2, c.r_f5]
                const keys = ['r1','st_pa','r_ader','r3','r_f4c1','r_f4c2','r_f5']
                return vals.map((val, fi) => (
                  <td key={fi} style={{ ...tdS, textAlign: 'center', width: getWidth(keys[fi], 100), minWidth: 100 }}>
                    {faseBdg(val)}
                  </td>
                ))
              })()}
              <td style={{ ...tdS, textAlign: 'center', width: 140, minWidth: 140 }}>
                {(() => {
                  const fi = getFaseInfo(c)
                  const cfg = getStatusConfig(c.status_workflow, 'admin_polimata')
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{fi.nome}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</span>
                    </div>
                  )
                })()}
              </td>
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
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalRow, setModalRow] = useState(null)

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
    if (filtroStatus) { const cfg = getStatusConfig(r.status_workflow, 'admin_polimata'); if (cfg.label !== filtroStatus) return false }
    if (busca) { const q = busca.toLowerCase(); return (r.rr||'').toLowerCase().includes(q)||(r.rc||'').toLowerCase().includes(q)||(r.area||'').toLowerCase().includes(q)||(r.sub||'').toLowerCase().includes(q)||(r.dr||'').toLowerCase().includes(q)||(r.dc||'').toLowerCase().includes(q)||(r.incons||'').toLowerCase().includes(q)||(r.passos_f1||'').toLowerCase().includes(q) }
    return true
  })

  const fasesDisponiveis = [...new Set(mrc.map(r => getFaseInfo(r).label))].sort()
  const statusDisponiveis = [...new Set(mrc.map(r => getStatusConfig(r.status_workflow, 'admin_polimata').label).filter(v => v && v !== '—'))].sort()

  const visibleRows = filtered.slice(0, MAX_ROWS); const isLimited = filtered.length > MAX_ROWS
  const handleHeatmapCell = (imp, prob, sel) => { if (sel) { setFiltroImp(''); setFiltroProb('') } else { setFiltroImp(imp); setFiltroProb(prob) } }
  const limparFiltros = () => { setBusca(''); setFiltroArea(''); setFiltroCrit(''); setFiltroImp(''); setFiltroProb(''); setFiltroR1(''); setFiltroNivel(''); setFiltroFase(''); setFiltroStatus('') }
  const temFiltro = busca || filtroArea || filtroCrit || filtroImp || filtroProb || filtroR1 || filtroNivel || filtroFase || filtroStatus

  const FS = { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 10, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }

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

      {(() => {
        const ef = mrc.filter(r => (r.r1||'').toLowerCase() === 'efetivo').length
        const inf = mrc.filter(r => (r.r1||'').toLowerCase() === 'inefetivo').length
        const gp = mrc.filter(r => { const v = (r.r1||'').toLowerCase(); return v === 'gap' || v === 'gap de processo' }).length
        const cr4 = mrc.filter(r => r.crit === 4).length
        const cr3 = mrc.filter(r => r.crit === 3).length
        const cr2 = mrc.filter(r => r.crit === 2).length
        const cr1 = mrc.filter(r => r.crit === 1).length
        // Heatmap 4×4 inline (mesmo estilo PorArea)
        const IMP_L = ['Crítico', 'Alto', 'Moderado', 'Baixo']
        const PRB_L = ['Baixa', 'Média', 'Alta', 'Extrema']
        const CRIT_L = ['Crítico', 'Significativo', 'Moderado', 'Baixo']
        const CRIT_C = ['#EF4444', '#F97316', '#EAB308', '#22C55E']
        const HC = [
          ['#FFC000','#FF0000','#FF0000','#FF0000'],
          ['#00B050','#FFC000','#FF0000','#FF0000'],
          ['#00B050','#00B050','#FFC000','#FF0000'],
          ['#00B050','#00B050','#00B050','#FFC000'],
        ]
        const impIdx = v => ({ 'Crítico':0,'Alto':1,'Moderado':2,'Baixo':3 }[v] ?? -1)
        const prbIdx = v => ({ 'Baixa':0,'Média':1,'Alta':2,'Extrema':3 }[v] ?? -1)
        const hmGrid = Array.from({ length: 4 }, () => Array(4).fill(0))
        mrc.forEach(r => { const ri = impIdx(r.imp), ci = prbIdx(r.prob); if (ri >= 0 && ci >= 0) hmGrid[ri][ci]++ })

        const ZS = {
          zona: { display: 'flex', gap: 10, flexShrink: 0, margin: '6px 0 8px' },
          heatCard: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' },
          title: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--copper)', marginBottom: 8 },
          yLabels: { display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 6, width: 55, flexShrink: 0 },
          yLabel: { fontSize: 8, fontWeight: 600, color: 'var(--lt-text3)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
          gridWrap: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
          row: { display: 'flex', gap: 2, flex: 1 },
          cell: { flex: 1, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', minHeight: 36, cursor: 'pointer' },
          xLabels: { display: 'flex', paddingLeft: 61, paddingTop: 4, gap: 2 },
          xLabel: { flex: 1, textAlign: 'center', fontSize: 8, fontWeight: 600, color: 'var(--lt-text3)' },
          legend: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--lt-border)' },
          legItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'var(--lt-text3)' },
          kpiGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr', gap: 8 },
          kpiCard: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)', cursor: 'pointer' },
          kpiLbl: { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--lt-text3)', marginBottom: 4 },
          kpiVal: { fontSize: 28, fontWeight: 300, lineHeight: 1 },
          kpiSub: { fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 },
        }

        return (
          <div style={ZS.zona}>
            {/* HEATMAP compacto */}
            <div style={ZS.heatCard}>
              <div style={ZS.title}>Mapa de Calor — Impacto × Probabilidade</div>
              <div style={{ display: 'flex', flex: 1 }}>
                <div style={ZS.yLabels}>
                  {IMP_L.map(l => <div key={l} style={ZS.yLabel}>{l}</div>)}
                </div>
                <div style={ZS.gridWrap}>
                  {hmGrid.map((row, ri) => (
                    <div key={ri} style={ZS.row}>
                      {row.map((val, ci) => {
                        const imp = IMP_L[ri], prob = PRB_L[ci]
                        const sel = filtroImp === imp && filtroProb === prob
                        return (
                          <div key={ci}
                            style={{ ...ZS.cell, background: val === 0 ? 'rgba(10,37,64,0.04)' : HC[ri][ci], opacity: val === 0 ? 0.35 : 1, outline: sel ? '2px solid var(--copper)' : 'none', outlineOffset: -2 }}
                            onClick={() => handleHeatmapCell(imp, prob, sel)}>
                            {val}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div style={ZS.xLabels}>
                {PRB_L.map(l => <div key={l} style={ZS.xLabel}>{l}</div>)}
              </div>
              <div style={{ textAlign: 'center', marginTop: 1, fontSize: 7, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--lt-text3)' }}>Probabilidade →</div>
              <div style={ZS.legend}>
                {CRIT_L.map((l, i) => (
                  <div key={l} style={ZS.legItem}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: CRIT_C[i] }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* KPI GRID 3×2 */}
            <div style={ZS.kpiGrid}>
              <div style={{ ...ZS.kpiCard, borderTopColor: '#22C55E' }} onClick={() => setFiltroNivel(filtroNivel === 'N5' ? '' : 'N5')}>
                <div style={ZS.kpiLbl}>Efetivos</div>
                <div style={{ ...ZS.kpiVal, color: 'var(--res-ef)' }}>{ef}</div>
                <div style={ZS.kpiSub}>{mrc.length > 0 ? Math.round(ef / mrc.length * 100) : 0}% do total</div>
              </div>
              <div style={{ ...ZS.kpiCard, borderTopColor: '#FACC15' }} onClick={() => setFiltroNivel(filtroNivel === 'N1' ? '' : 'N1')}>
                <div style={ZS.kpiLbl}>Inefetivos</div>
                <div style={{ ...ZS.kpiVal, color: '#B8860B' }}>{inf}</div>
                <div style={ZS.kpiSub}>Aguardam ação corretiva</div>
              </div>
              <div style={{ ...ZS.kpiCard, borderTopColor: '#EF4444' }} onClick={() => setFiltroNivel(filtroNivel === 'N2' ? '' : 'N2')}>
                <div style={ZS.kpiLbl}>GAP</div>
                <div style={{ ...ZS.kpiVal, color: 'var(--n1)' }}>{gp}</div>
                <div style={ZS.kpiSub}>Riscos sem controle</div>
              </div>
              <div style={{ ...ZS.kpiCard, borderTopColor: '#EF4444', cursor: 'default' }}>
                <div style={ZS.kpiLbl}>Risco Crítico</div>
                <div style={{ ...ZS.kpiVal, color: 'var(--n1)' }}>{cr4}</div>
              </div>
              <div style={{ ...ZS.kpiCard, borderTopColor: '#F97316', cursor: 'default' }}>
                <div style={ZS.kpiLbl}>Risco Significativo</div>
                <div style={{ ...ZS.kpiVal, color: '#EA580C' }}>{cr3}</div>
              </div>
              <div style={{ ...ZS.kpiCard, borderTopColor: '#EAB308', cursor: 'default' }}>
                <div style={ZS.kpiLbl}>Moderado + Baixo</div>
                <div style={{ ...ZS.kpiVal, color: '#B8860B' }}>{cr2 + cr1}</div>
                <div style={ZS.kpiSub}>{cr2} moderado · {cr1} baixo</div>
              </div>
            </div>
          </div>
        )
      })()}

      <div style={{ flex: 1, minHeight: 0, background: 'var(--lt-card)', borderRadius: 12, border: '1px solid var(--lt-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 14px', borderBottom: '1px solid var(--lt-border)' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ref., área, risco, controle, inconsistência, passos…" style={{ flex: 1, minWidth: 200, background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, outline: 'none', color: 'var(--lt-text)' }} />
          <select value={filtroCrit} onChange={e => setFiltroCrit(e.target.value)} style={FS}><option value="">Todas criticidades</option><option value="4">Crítico</option><option value="3">Significativo</option><option value="2">Moderado</option><option value="1">Baixo</option></select>
          <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)} style={FS}><option value="">Todas as fases</option>{fasesDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}</select>
          <select value={filtroR1} onChange={e => setFiltroR1(e.target.value)} style={FS}><option value="">Todos resultados</option><option>Efetivo</option><option>Inefetivo</option><option>GAP</option><option>Teste Não Realizado</option></select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={FS}><option value="">Todos status</option>{statusDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <div style={{ fontSize: 10, color: 'var(--lt-text3)', background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 10px' }}>{filtered.length} controles</div>
          {temFiltro && <button onClick={limparFiltros} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: 'var(--n1)', cursor: 'pointer', fontFamily: 'inherit' }}>✕ Limpar filtros</button>}
          <button onClick={() => exportarMRCExcel(filtered, 'MRC_Completa_' + new Date().toISOString().slice(0,10), 'MRC Completa', clienteNome, projetoNome)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(204,145,94,0.1)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 999, padding: '5px 10px', fontSize: 10, fontWeight: 600, color: 'var(--copper)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }} title="Exportar Excel"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>Excel</button>
        </div>

        {isLimited && <div className="warn-strip">Exibindo {MAX_ROWS} de {filtered.length} — refine os filtros</div>}
        <TabelaMRC rows={visibleRows} onOpenModal={setModalRow} />
      </div>

      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
    </div>
  )
}
