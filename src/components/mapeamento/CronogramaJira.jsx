// ═══════════════════════════════════════════════════════════════════════════
// CronogramaJira.jsx — cronograma estilo Jira do módulo Mapeamento.
// Agrupa por área (expandir/recolher), zoom semana/mês/trimestre, barras com as
// 6 etapas do ciclo como segmentos + % de progresso, cores por situação,
// dependência em cascata (cada processo começa quando o anterior termina) e
// recálculo automático de atraso (empurra os seguintes + sinaliza impacto).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { ETAPAS, computeTimeline } from '../../lib/mapeamento/cronograma'

const DAY = 86400000, COBRE = '#A6512F', AZUL = '#00203E'
const VERDE = '#1D9E75', VERMELHO = '#E24B4A'
const MES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
const PXD = { semana: 20, mes: 7, tri: 2.6 }
const LBL = 220, HEAD = 34, AH = 34, PH = 50

function ms(str) { return str ? new Date((str.length <= 10 ? str + 'T12:00:00' : str)).getTime() : null }
function fmt(t) { const d = new Date(t); return d.getDate() + ' ' + MES[d.getMonth()].replace('.', '') }
function progresso(map) {
  const st = computeTimeline(map)
  const done = st.filter((s) => s.estado === 'concluido').length
  const atual = st.findIndex((s) => s.estado === 'andamento' || s.estado === 'ajustes')
  return { st, done, atual, pct: Math.round((done / 6) * 100), vigente: st[5].estado === 'concluido' }
}

export default function CronogramaJira({ lista, projeto, carregar, onEditar, onAbrir, onMover, duracaoPadrao, onDuracaoPadrao }) {
  const [zoom, setZoom] = useState('mes')
  const [collapsed, setCollapsed] = useState({})

  const ordered = [...lista].sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || (new Date(a.criado_em) - new Date(b.criado_em)))
  const hoje = Date.now()
  const anchor = ms(ordered.find((p) => p.data_inicio)?.data_inicio) || hoje

  // cascata: planejado (sem atraso) e previsto (empurra processos vencidos e não vigentes)
  let curP = anchor, curF = anchor, fimPlan = anchor, fimPrev = anchor
  const sc = {}
  ordered.forEach((p) => {
    const dur = Math.max(p.duracao_dias ?? duracaoPadrao ?? 30, 1)
    const pStart = curP, pEnd = pStart + dur * DAY; curP = pEnd; fimPlan = pEnd
    const prog = progresso(p)
    const fStart = curF, plannedEnd = fStart + dur * DAY
    const atrasado = !prog.vigente && plannedEnd < hoje
    const fEnd = atrasado ? Math.max(plannedEnd, hoje) : plannedEnd
    curF = fEnd; fimPrev = fEnd
    sc[p.id] = { start: fStart, end: fEnd, atrasado, prog, dur }
  })
  const impacto = Math.round((fimPrev - fimPlan) / DAY)

  const minMs = anchor, maxMs = Math.max(fimPrev, anchor + 7 * DAY)
  const sd = new Date(minMs), start = new Date(sd.getFullYear(), sd.getMonth(), 1).getTime()
  const ed = new Date(maxMs), end = new Date(ed.getFullYear(), ed.getMonth() + 1, 1).getTime()
  const pxd = PXD[zoom]
  const spanPx = Math.max(((end - start) / DAY) * pxd, 560)
  const X = (t) => ((t - start) / DAY) * pxd

  const cor = (p) => sc[p.id].atrasado ? VERMELHO : (sc[p.id].prog.vigente ? VERDE : COBRE)
  const grupos = []
  ordered.forEach((p) => { const g = p.area_nome || null; if (!grupos.some((x) => x === g)) grupos.push(g) })

  // linhas (área header + processos) com posição vertical
  const rows = []; let y = 0; const tops = {}
  grupos.forEach((g) => {
    const key = g || 'sem'
    rows.push({ type: 'area', aid: key, nome: g || 'Sem área' })
    y += AH
    if (!collapsed[key]) {
      ordered.filter((p) => (p.area_nome || null) === g).forEach((p) => {
        rows.push({ type: 'proc', p, top: y }); tops[p.id] = y + PH / 2; y += PH
      })
    }
  })
  let yy = 0; rows.forEach((r) => { r.top = yy; yy += (r.type === 'area' ? AH : PH) })
  rows.forEach((r) => { if (r.type === 'proc') tops[r.p.id] = r.top + PH / 2 })
  const totalH = yy

  // ticks do cabeçalho
  const ticks = []
  if (zoom === 'tri') {
    let c = new Date(start)
    while (c.getTime() < end) { ticks.push({ x: X(c.getTime()), t: 'T' + (Math.floor(c.getMonth() / 3) + 1) + ' ' + c.getFullYear() }); c = new Date(c.getFullYear(), c.getMonth() + 3, 1) }
  } else if (zoom === 'mes') {
    let m = new Date(start)
    while (m.getTime() < end) { ticks.push({ x: X(m.getTime()), t: MES[m.getMonth()] + (m.getMonth() === 0 ? ' ' + m.getFullYear() : '') }); m = new Date(m.getFullYear(), m.getMonth() + 1, 1) }
  } else {
    let w = new Date(start)
    while (w.getTime() < end) { ticks.push({ x: X(w.getTime()), t: fmt(w.getTime()) }); w = new Date(w.getTime() + 7 * DAY) }
  }
  const vlines = []; { let m = new Date(start); while (m.getTime() < end) { vlines.push(X(m.getTime())); m = (zoom === 'semana') ? new Date(m.getTime() + 7 * DAY) : new Date(m.getFullYear(), m.getMonth() + 1, 1) } }

  const zBtn = (z, lbl) => (
    <button key={z} onClick={() => setZoom(z)} style={{ border: 'none', borderLeft: z !== 'semana' ? '1px solid rgba(0,32,62,0.12)' : 'none', background: zoom === z ? '#F3EEE4' : 'transparent', color: zoom === z ? AZUL : '#6B7280', fontWeight: zoom === z ? 600 : 500, padding: '7px 13px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Montserrat' }}>{lbl}</button>
  )

  const arrows = []
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i], b = ordered[i + 1]
    if (tops[a.id] == null || tops[b.id] == null) continue
    const x1 = X(sc[a.id].end), y1 = tops[a.id], y2 = tops[b.id], x2 = X(sc[b.id].start), midY = (y1 + y2) / 2
    arrows.push(<path key={i} d={`M${x1},${y1} L${x1 + 8},${y1} L${x1 + 8},${midY} L${x2},${midY} L${x2},${y2}`} fill="none" stroke="#A8A29A" strokeWidth="1.4" markerEnd="url(#ahJira)" />)
  }

  return (
    <div style={{ fontFamily: 'Montserrat' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', border: '1px solid rgba(0,32,62,0.15)', borderRadius: 8, overflow: 'hidden' }}>
          {zBtn('semana', 'Semana')}{zBtn('mes', 'Mês')}{zBtn('tri', 'Trimestre')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B7280' }}>
          Prazo médio por processo:
          <input type="number" min={1} defaultValue={duracaoPadrao || 30} key={duracaoPadrao} onBlur={(ev) => { const v = Math.max(Number(ev.target.value) || 1, 1); if (onDuracaoPadrao && v !== (duracaoPadrao || 30)) onDuracaoPadrao(v) }} style={{ width: 58, fontFamily: 'Montserrat', fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
          dias
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5 }}>
          <span style={{ color: '#6B7280' }}>Prazo final: <b style={{ color: AZUL }}>{fmt(fimPrev)} {new Date(fimPrev).getFullYear()}</b></span>
          {impacto > 0 && <span style={{ color: VERMELHO, fontWeight: 600 }}>+{impacto} {impacto === 1 ? 'dia' : 'dias'} de atraso</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11.5, color: '#6B7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 2, background: COBRE }} />Em produção</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 2, background: VERDE }} />Vigente</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 2, background: VERMELHO }} />Atrasado</span>
        <span>· barra dividida nas 6 etapas (Entrevista → Vigente)</span>
      </div>

      <div style={{ border: '1px solid rgba(0,32,62,0.08)', borderRadius: 12, overflowX: 'auto', background: '#fff' }}>
        <div style={{ position: 'relative', width: (LBL + spanPx) + 'px', height: (HEAD + totalH) + 'px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: LBL, height: HEAD, background: '#fff', borderBottom: '1px solid rgba(0,32,62,0.10)', zIndex: 4 }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEAD, borderBottom: '1px solid rgba(0,32,62,0.10)' }}>
            {ticks.map((tk, i) => <div key={i} style={{ position: 'absolute', left: (LBL + tk.x) + 'px', top: 0, height: '100%', borderLeft: '1px solid rgba(0,32,62,0.08)', paddingLeft: 5, fontSize: 10.5, color: '#9CA3AF', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{tk.t}</div>)}
          </div>
          <div style={{ position: 'absolute', top: HEAD, left: 0, right: 0, bottom: 0 }}>
            {vlines.map((vx, i) => <div key={i} style={{ position: 'absolute', left: (LBL + vx) + 'px', top: 0, bottom: 0, width: 1, background: 'rgba(0,32,62,0.05)' }} />)}
            {hoje >= start && hoje <= end && <div style={{ position: 'absolute', left: (LBL + X(hoje)) + 'px', top: 0, bottom: 0, width: 2, background: 'rgba(226,75,74,0.55)', zIndex: 3 }} />}
          </div>

          <svg style={{ position: 'absolute', left: LBL, top: HEAD, width: spanPx, height: totalH, pointerEvents: 'none', zIndex: 1 }}>
            <defs><marker id="ahJira" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#A8A29A" /></marker></defs>
            {arrows}
          </svg>

          <div style={{ position: 'absolute', top: HEAD, left: 0, right: 0 }}>
            {rows.map((r, idx) => {
              if (r.type === 'area') return <div key={idx} style={{ position: 'absolute', top: r.top, left: LBL, right: 0, height: AH, background: '#FAF8F3', borderTop: '1px solid rgba(0,32,62,0.06)' }} />
              const p = r.p, c = cor(p), s = sc[p.id], bx = X(s.start), bw = Math.max(s.dur * pxd, 14)
              return (
                <div key={idx}>
                  <div style={{ position: 'absolute', top: r.top, left: LBL, right: 0, height: PH, borderTop: '1px solid rgba(0,32,62,0.06)' }} />
                  <div onClick={() => onAbrir && onAbrir(p)} title={`${p.nome_processo} — ${fmt(s.start)} a ${fmt(s.end)}`} style={{ position: 'absolute', top: r.top + (PH - 22) / 2, left: LBL + bx, width: bw, height: 22, border: '1px solid ' + c, borderRadius: 5, overflow: 'hidden', display: 'flex', zIndex: 2, boxSizing: 'border-box', cursor: 'pointer' }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      const est = s.prog.st[i].estado
                      const fill = est === 'concluido' ? c : (est === 'andamento' || est === 'ajustes' ? c : 'transparent')
                      const op = (est === 'andamento' || est === 'ajustes') ? 0.34 : 1
                      return <div key={i} style={{ flex: 1, marginRight: i < 5 ? 1 : 0, background: fill, opacity: op }} />
                    })}
                  </div>
                  <div style={{ position: 'absolute', top: r.top + (PH - 22) / 2 + 4, left: LBL + bx + bw + 6, fontSize: 10.5, fontWeight: 600, color: c, zIndex: 2, whiteSpace: 'nowrap' }}>{s.prog.pct}%</div>
                </div>
              )
            })}
          </div>

          <div style={{ position: 'absolute', top: HEAD, left: 0, width: LBL, zIndex: 5, background: '#fff' }}>
            {rows.map((r, idx) => {
              if (r.type === 'area') {
                const col = !!collapsed[r.aid || 'sem']
                return (
                  <div key={idx} onClick={() => setCollapsed((s) => ({ ...s, [r.aid || 'sem']: !col }))} style={{ height: AH, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', boxSizing: 'border-box', cursor: 'pointer', background: '#FAF8F3', borderTop: '1px solid rgba(0,32,62,0.06)' }}>
                    <span style={{ fontSize: 13, color: '#6B7280', width: 12 }}>{col ? '▸' : '▾'}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</span>
                  </div>
                )
              }
              const p = r.p, lbl = ETAPAS[Math.max(sc[p.id].prog.atual, 0)]?.label || (sc[p.id].prog.vigente ? 'Vigente' : ETAPAS[0].label)
              return (
                <div key={idx} onClick={() => onAbrir && onAbrir(p)} style={{ height: PH, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 14px', boxSizing: 'border-box', borderTop: '1px solid rgba(0,32,62,0.06)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <button onClick={(ev) => { ev.stopPropagation(); onMover && onMover(p, -1) }} title="Subir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 10, lineHeight: 1, padding: 0 }}>▲</button>
                    <button onClick={(ev) => { ev.stopPropagation(); onMover && onMover(p, 1) }} title="Descer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 10, lineHeight: 1, padding: 0 }}>▼</button>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: AZUL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome_processo}</div>
                    <div style={{ fontSize: 10.5, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{Math.max(p.duracao_dias ?? duracaoPadrao ?? 30, 1)} dias · {lbl}</div>
                  </div>
                  {onEditar && <button onClick={(ev) => { ev.stopPropagation(); onEditar(p) }} title="Editar processo" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: COBRE, flexShrink: 0 }}>✎</button>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 8 }}>A linha vermelha marca hoje. As setas mostram a dependência em cascata: cada processo começa quando o anterior termina. Use ▲▼ para reordenar a sequência. Clique num processo para abrir (gravar/agendar/documentos).</div>
    </div>
  )
}
