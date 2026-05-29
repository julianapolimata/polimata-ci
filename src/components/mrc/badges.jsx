import { useState, useEffect, useRef } from 'react'
import { getFaseInfo as getFaseInfoUtil, getResultadoVitrine, getFaseDisplayOverride, normalizeFaseValue, getStatusComputado, getFaseLabel } from '../../lib/fases'


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
  if (isNaN(d.getTime())) return '—'
  // Rejeita datas claramente inválidas (Excel epoch 1899/1900, Unix epoch 1970)
  if (d.getFullYear() < 2000) return '—'
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

function FaseAtual({ row, projeto }) {
  const { label, cor } = getFaseInfo(row)
  const resultado = getResultadoVitrine(row, projeto)
  return (
    <div className="fase-atual-cell">
      <div className="fase-atual-label" style={{ borderLeftColor: cor }}>{label}</div>
      <div className="fase-atual-resultado"><span className={`bd ${R1_MAP[resultado] || 'b-na'}`}>{resultado}</span></div>
    </div>
  )
}

// ─── HEATMAP COM E/I/G ──────────────────────────────────────────────────────

function Heatmap({ data, filtroImp, filtroProb, onFilterCell, projeto }) {
  const cells = {}
  HM_IMPS.forEach(i => HM_PROBS.forEach(p => { cells[`${i}|${p}`] = { n: 0, e: 0, i: 0, g: 0 } }))
  data.forEach(r => {
    const key = `${r.imp}|${r.prob}`
    if (!cells[key]) return
    cells[key].n++
    const res = (getResultadoVitrine(r, projeto) || '').toLowerCase()
    if (res === 'efetivo') cells[key].e++
    else if (res === 'inefetivo') cells[key].i++
    else if (res === 'gap') cells[key].g++
  })

  const totais = { C4: { n:0,e:0,i:0,g:0 }, C3: { n:0,e:0,i:0,g:0 }, C2: { n:0,e:0,i:0,g:0 }, C1: { n:0,e:0,i:0,g:0 } }
  data.forEach(r => {
    if (!r.crit) return
    const k = `C${r.crit}`; if (!totais[k]) return
    totais[k].n++
    const res = (getResultadoVitrine(r, projeto) || '').toLowerCase()
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

function Regua({ data, filtroNivel, onToggleNivel, projeto }) {
  const c = {}; NIVEIS.forEach(n => { c[n.id] = 0 })
  data.forEach(r => { const res = getResultadoVitrine(r, projeto); if (res === 'Inefetivo') c.N1++; else if (res === 'GAP') c.N2++; else if (res === 'Efetivo' || res === 'efetivo') c.N5++ })
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
const mrcFaseThS = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff', padding: '6px 6px', textAlign: 'center', whiteSpace: 'pre-line', position: 'sticky', top: 0, zIndex: 2, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, borderRight: '1px solid rgba(255,255,255,0.28)', borderBottom: 'none', borderRadius: '8px 8px 0 0' }
const mrcThS = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--lt-border)', borderRight: '1px solid var(--lt-border)' }
const mrcTdS = { padding: '7px 10px', borderBottom: '1px solid var(--lt-border)', borderRight: '1px solid var(--lt-border)', fontSize: 12, color: 'var(--lt-text2)', whiteSpace: 'nowrap', verticalAlign: 'middle' }

function badgeFaseMRC(val) {
  if (val === 'N/A') return <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--lt-text3)' }}>N/A</span>
  if (val === 'Evitado') return <span className="bd b-na" style={{ fontStyle: 'italic', background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}>Evitado</span>
  if (val === 'Transferido') return <span className="bd b-na" style={{ fontStyle: 'italic', background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>Transferido</span>
  if (!val || val === 'Teste Não Realizado') return <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--lt-text3)' }}>Não iniciado</span>
  return badge(R1_MAP[val] || 'b-na', val)
}
function faseValMRC(row, key, rawVal) {
  const override = getFaseDisplayOverride(row, key)
  if (override !== null) return override
  if ((key === 'st_pa' || key === 'r_ader') && (row.r1||'').toLowerCase() === 'efetivo') return 'N/A'
  return normalizeFaseValue(rawVal)
}

function RegressaoBadgeMRC({ n }) {
  if (!n || n <= 0) return null
  return (
    <span title={`Regressão #${n} — controle retornou à F2-E1`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 10, fontWeight: 700, color: '#7A5700',
      background: '#FFF3CD', border: '1px solid #F9A825',
      borderRadius: 3, padding: '1px 4px', marginLeft: 4,
      verticalAlign: 'middle', lineHeight: 1, whiteSpace: 'nowrap',
    }}>&#9888;{n}</span>
  )
}

function badgeResultado(val) {
  if (!val || val === 'N/A') return <span style={{ color: 'var(--lt-text3)', fontSize: 10 }}>—</span>
  return <span className={`bd ${R1_MAP[val] || 'b-na'}`}>{val}</span>
}

function TdMRC({ children, w = 150, wrap = false }) {
  return <td style={{ ...mrcTdS, width: w, minWidth: w, maxWidth: w, overflow: 'hidden', textOverflow: wrap ? undefined : 'ellipsis', whiteSpace: wrap ? 'normal' : 'nowrap', lineHeight: wrap ? 1.4 : undefined }}>{children || '—'}</td>
}

const MRC_DATA_COLS = [
  { h: 'Última Alteração', w: 95, k: '_dt', align: 'center' },
  { h: 'Processo', w: 120, k: 'area' }, { h: 'Subprocesso', w: 120, k: 'sub' }, { h: 'Ref. Risco', w: 80, k: 'rr', align: 'center' },
  { h: 'Desc. Risco', w: 200, k: 'dr' }, { h: 'Ref. Controle', w: 90, k: 'rc', align: 'center' }, { h: 'Desc. Controle', w: 200, k: 'dc' },
  { h: 'Resultado', w: 90, k: '_resultado', align: 'center' }, { h: 'Criticidade', w: 110, k: 'crit', align: 'center' },
  { h: 'Fase Atual', w: 130, k: '_fase_atual', align: 'center' }, { h: 'Status Atual', w: 110, k: '_status_atual', align: 'center' },
]
const MRC_FASE_KEYS = ['r1', 'st_pa', 'r_ader', 'r3', 'r_f4c1', 'r_f4c2', 'r_f5']

function sortVal(row, k, projeto) {
  if (k === '_dt') return row.dt_ult || row.atualizado_em || row.criado_em || ''
  if (k === '_resultado') return getResultadoVitrine(row, projeto)
  if (k === '_fase_atual') return getFaseLabel(row)
  if (k === '_status_atual') return getStatusComputado(row)
  return row[k] ?? ''
}

// Badge para coluna F1 quando projeto é Diagnóstico (Existente/Parcial/Inexistente)
function badgeExistencia(val) {
  if (!val) return <span style={{ fontSize: 10, color: 'var(--lt-text3)' }}>—</span>
  const colors = {
    'Existente': { bg: 'rgba(34,197,94,0.12)', color: '#15803D' },
    'Parcial': { bg: 'rgba(250,204,21,0.18)', color: '#92400E' },
    'Inexistente': { bg: 'rgba(239,68,68,0.12)', color: '#991B1B' },
  }
  const c = colors[val] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--lt-text2)' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{val}</span>
}


export {
  CRIT_MAP, R1_MAP, IMP_MAP, PROB_MAP,
  HM_IMPS, HM_PROBS, fmtDate, HM_COLORS, CRIT_LABELS_HM, CRIT_CORES_HM, impToIdx, probToIdx,
  NIVEIS, MAX_ROWS, COL_GROUPS, DEFAULT_COLS,
  badge, critBadge, ExpCell, getFaseInfo,
  FaseAtual, Heatmap, Regua, ColunasPanel,
  MRC_FASE_HDR, FASE_W, mrcFaseThS, mrcThS, mrcTdS,
  badgeFaseMRC, faseValMRC, RegressaoBadgeMRC, badgeResultado, TdMRC,
  MRC_DATA_COLS, MRC_FASE_KEYS, sortVal, badgeExistencia,
}
