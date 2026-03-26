import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const CRIT_MAP = {
  4: { label: '4. Crítico',       cls: 'c4', nivel: 'N1' },
  3: { label: '3. Significativo', cls: 'c3', nivel: 'N2' },
  2: { label: '2. Moderado',      cls: 'c2', nivel: 'N3' },
  1: { label: '1. Baixo',         cls: 'c1', nivel: 'N5' },
}

const R1_MAP  = { Efetivo:'b-ef', Inefetivo:'b-in', GAP:'b-gp', 'Concluído':'b-co', 'Em desenvolvimento':'b-pa', 'Teste Não Realizado':'b-tnr', 'N/A':'b-na' }
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

// Régua N1–N5
const NIVEIS = [
  { id: 'N1', label: 'N1', nome: 'Inefetivo',     cls: 'rn1', resultado: 'Inefetivo' },
  { id: 'N2', label: 'N2', nome: 'GAP',            cls: 'rn2', resultado: 'GAP' },
  { id: 'N3', label: 'N3', nome: 'Em Desenv.',     cls: 'rn3', resultado: 'Em desenvolvimento' },
  { id: 'N4', label: 'N4', nome: 'Concluído',      cls: 'rn4', resultado: 'Concluído' },
  { id: 'N5', label: 'N5', nome: 'Efetivo',        cls: 'rn5', resultado: 'Efetivo' },
]

// Definição de colunas visíveis (agrupadas)
const COL_GROUPS = [
  { label: 'Identificação', cols: [
    { id: 'ref',  label: 'Referência',  default: true },
    { id: 'area', label: 'Área',        default: true },
    { id: 'sub',  label: 'Subprocesso', default: true },
  ]},
  { label: 'Risco & Controle', cols: [
    { id: 'dr',  label: 'Descrição do Risco',    default: true },
    { id: 'dc',  label: 'Descrição do Controle', default: true },
  ]},
  { label: 'Características', cols: [
    { id: 'cat',  label: 'Categoria',  default: false },
    { id: 'freq', label: 'Frequência', default: false },
    { id: 'nat',  label: 'Natureza',   default: false },
    { id: 'car',  label: 'Caráter',    default: false },
    { id: 'sis',  label: 'Sistema',    default: false },
    { id: 'chave',label: 'Ctrl Chave', default: false },
  ]},
  { label: 'Avaliação', cols: [
    { id: 'imp',  label: 'Impacto',      default: false },
    { id: 'prob', label: 'Probabilidade', default: false },
    { id: 'crit', label: 'Criticidade',   default: true },
  ]},
  { label: 'Resultados', cols: [
    { id: 'r1',    label: 'Result. F1',   default: true },
    { id: 'r_ader',label: 'Result. F2',   default: false },
    { id: 'r3',    label: 'Result. F3',   default: false },
    { id: 'fase',  label: 'Fase Atual',   default: true },
  ]},
]

const DEFAULT_COLS = new Set(
  COL_GROUPS.flatMap(g => g.cols.filter(c => c.default).map(c => c.id))
)

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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

// ─── EXPANSOR DE CÉLULA ──────────────────────────────────────────────────────

function ExpCell({ text, maxLen = 80 }) {
  const [open, setOpen] = useState(false)
  if (!text || text === 'N/A' || text.trim() === '') return <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
  if (text.length <= maxLen) return <span style={{ fontSize: 11.5, lineHeight: 1.5 }}>{text}</span>
  return (
    <div className="exp-row">
      <span className="exp-btn" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>{open ? '−' : '+'}</span>
      {open
        ? <span className="exp-open">{text}</span>
        : <span className="exp-col">{text.slice(0, maxLen)}…</span>
      }
    </div>
  )
}

// ─── MODAL DE DETALHE ────────────────────────────────────────────────────────

function ModalDetalhe({ row, onClose }) {
  const [tab, setTab] = useState('f1')
  if (!row) return null

  const tabs = [
    { id: 'f1',   label: 'F1 — Diagnóstico' },
    { id: 'f2',   label: 'F2 — Redesenho' },
    { id: 'f3',   label: 'F3 — Teste Final' },
    { id: 'info', label: 'Informações' },
  ]

  const field = (label, value, fullWidth = false) => {
    if (!value || value === 'N/A' || value === '') return null
    return (
      <div style={fullWidth ? { marginBottom: 12 } : {}}>
        <div className="ml">{label}</div>
        <div className="mv">{value}</div>
      </div>
    )
  }

  const fieldText = (label, value) => {
    if (!value || value === 'N/A' || value === '') return null
    return (
      <div style={{ marginBottom: 14 }}>
        {label && <div className="ml">{label}</div>}
        <div className="mv-t">{value}</div>
      </div>
    )
  }

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-ttl">{row.rc}</div>
            <div className="modal-sub">{row.area} · {row.sub} · {row.rr}</div>
          </div>
          <button className="modal-cls" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          {tabs.map(t => (
            <div key={t.id} className={`mtab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </div>
          ))}
        </div>

        <div className="modal-body">
          {/* F1 — DIAGNÓSTICO */}
          {tab === 'f1' && (
            <div className="tp active">
              <div className="ms">
                <div className="ms-t">Risco</div>
                <div className="mr">
                  {field('Ref. Risco', row.rr)}
                  {field('Criticidade', row.crit ? critBadge(row.crit) : null)}
                </div>
                {fieldText('Descrição do Risco', row.dr)}
              </div>
              <div className="ms">
                <div className="ms-t">Controle</div>
                <div className="mr">
                  {field('Ref. Controle', row.rc)}
                  {field('Resultado F1', row.r1 ? <span className={`bd ${R1_MAP[row.r1] || 'b-na'}`}>{row.r1}</span> : null)}
                </div>
                <div className="mr3">
                  {field('Categoria', row.cat)}
                  {field('Frequência', row.freq)}
                  {field('Natureza', row.nat)}
                </div>
                <div className="mr3">
                  {field('Caráter', row.car)}
                  {field('Sistema', row.sis)}
                  {field('Tipo', row.chave)}
                </div>
                {fieldText('Descrição do Controle (F1)', row.dc)}
              </div>
              {row.passos_f1 && row.passos_f1 !== 'N/A' && (
                <div className="ms">
                  <div className="ms-t">Passos de Teste F1</div>
                  {fieldText(null, row.passos_f1)}
                </div>
              )}
              {row.incons && row.incons !== 'N/A' && (
                <div className="ms">
                  <div className="ms-t">Inconsistências Identificadas</div>
                  {fieldText(null, row.incons)}
                </div>
              )}
              {row.rec && row.rec !== 'N/A' && (
                <div className="ms">
                  <div className="ms-t">Recomendações</div>
                  {fieldText(null, row.rec)}
                </div>
              )}
            </div>
          )}

          {/* F2 — REDESENHO */}
          {tab === 'f2' && (
            <div className="tp active">
              <div className="ms">
                <div className="ms-t">Plano de Ação</div>
                <div className="mr3">
                  {field('Demanda PA', row.dem_pa)}
                  {field('Status PA', row.st_pa ? <span className={`bd ${R1_MAP[row.st_pa] || 'b-na'}`}>{row.st_pa}</span> : null)}
                  {field('Data Conclusão', row.dt_ult ? new Date(row.dt_ult).toLocaleDateString('pt-BR') : null)}
                </div>
                {field('Responsável PA', row.resp_pa, true)}
                {fieldText('Comentário PA', row.coment_pa)}
              </div>
              <div className="ms">
                <div className="ms-t">Controle Redesenhado (F2 — E1)</div>
                {fieldText('Novo Descritivo de Controle', row.dc_novo)}
              </div>
              {row.r_ader && (
                <div className="ms">
                  <div className="ms-t">Resultado Aderência (F2 — E2)</div>
                  <div className="mr">
                    {field('Resultado', <span className={`bd ${R1_MAP[row.r_ader] || 'b-na'}`}>{row.r_ader}</span>)}
                    {row.dt_teste && field('Data Teste', new Date(row.dt_teste).toLocaleDateString('pt-BR'))}
                  </div>
                  {row.melhoria === 'Sim' && <div style={{ marginBottom: 8 }}><span className="tag">Oportunidade de Melhoria</span></div>}
                  {fieldText('Inconsistências F2-E2', row.incons_ader)}
                  {fieldText('Comentários F2-E2', row.coment_ader)}
                </div>
              )}
            </div>
          )}

          {/* F3 — TESTE FINAL */}
          {tab === 'f3' && (
            <div className="tp active">
              <div className="ms">
                <div className="ms-t">Controle em F3</div>
                <div className="mr">
                  {field('Status F3', row.st_f3 ? <span className={`bd ${R1_MAP[row.st_f3] || 'b-na'}`}>{row.st_f3}</span> : null)}
                  {field('Resultado F3', row.r3 ? <span className={`bd ${R1_MAP[row.r3] || 'b-na'}`}>{row.r3}</span> : null)}
                </div>
                {fieldText('Inconsistências F3', row.incons_f3)}
                {fieldText('Recomendações F3', row.rec_f3)}
              </div>
            </div>
          )}

          {/* INFORMAÇÕES */}
          {tab === 'info' && (
            <div className="tp active">
              <div className="ms">
                <div className="ms-t">Localização</div>
                <div className="mr3">
                  {field('Área', row.area)}
                  {field('Subprocesso', row.sub)}
                  {field('Gerente', row.ger)}
                </div>
                {field('Resp. Subprocesso', row.resp_sub, true)}
              </div>
              <div className="ms">
                <div className="ms-t">Risco</div>
                <div className="mr3">
                  {field('Impacto', row.imp ? <span className={`bd ${IMP_MAP[row.imp] || ''}`}>{row.imp}</span> : null)}
                  {field('Probabilidade', row.prob ? <span className={`bd ${PROB_MAP[row.prob] || ''}`}>{row.prob}</span> : null)}
                  {field('Criticidade', critBadge(row.crit))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-ftr">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── HEATMAP ─────────────────────────────────────────────────────────────────

function Heatmap({ data, filtroImp, filtroProb, onFilterCell }) {
  const counts = {}
  HM_IMPS.forEach(i => HM_PROBS.forEach(p => { counts[`${i}|${p}`] = 0 }))
  data.forEach(r => {
    const key = `${r.imp}|${r.prob}`
    if (counts[key] !== undefined) counts[key]++
  })

  const totais = { C4: 0, C3: 0, C2: 0, C1: 0 }
  data.forEach(r => { if (r.crit) totais[`C${r.crit}`]++ })

  const legColors = { C4: '#FF0000', C3: '#FFC000', C2: '#FFFF00', C1: '#00B050' }
  const legLabels = { C4: '4. Crítico', C3: '3. Significativo', C2: '2. Moderado', C1: '1. Baixo' }

  return (
    <div className="hm-wrap">
      <div className="hm-grid-area">
        <div className="hm-title">Mapa de Calor — Impacto × Probabilidade</div>
        <div style={{ display: 'flex', gap: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 64, paddingBottom: 24 }}>
            {HM_IMPS.map(imp => (
              <div key={imp} className="hm-ylabel" style={{ minHeight: 66 }}>{imp}</div>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
              {HM_IMPS.map((imp, ri) =>
                HM_PROBS.map((prob, ci) => {
                  const key = `${imp}|${prob}`
                  const n = counts[key] || 0
                  const bg = HM_COLORS[ri][ci]
                  const sel = filtroImp === imp && filtroProb === prob
                  return (
                    <div key={key} className={`hm-cell ${sel ? 'sel' : ''}`}
                      style={{ background: bg, opacity: n === 0 ? 0.25 : 1 }}
                      onClick={() => onFilterCell(imp, prob, sel)}
                    >
                      <div className="hm-n" style={{ color: bg === '#FFFF00' ? '#333' : '#fff' }}>{n}</div>
                      <div className="hm-eig" style={{ color: bg === '#FFFF00' ? '#555' : 'rgba(255,255,255,0.8)' }}>
                        <span>{imp.slice(0,3)}</span><span>×</span><span>{prob.slice(0,3)}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3, marginTop: 4 }}>
              {HM_PROBS.map(p => <div key={p} className="hm-xlabel">{p}</div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="hm-legend">
        {[4,3,2,1].map(c => (
          <div key={c} className="hm-leg">
            <div className="hm-ldot" style={{ background: legColors[`C${c}`] }} />
            <div>
              <div className="hm-lbl">{legLabels[`C${c}`]}</div>
              <div className="hm-lnum" style={{ color: legColors[`C${c}`] === '#FFFF00' ? '#D4A030' : legColors[`C${c}`] }}>{totais[`C${c}`]}</div>
              <div className="hm-lsub">controles</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── RÉGUA DE NÍVEIS ─────────────────────────────────────────────────────────

function Regua({ data, filtroNivel, onToggleNivel }) {
  const contagem = {}
  NIVEIS.forEach(n => { contagem[n.id] = 0 })

  data.forEach(r => {
    const res = r.r1
    if (res === 'Inefetivo')            contagem.N1++
    else if (res === 'GAP')             contagem.N2++
    else if (res === 'Em desenvolvimento') contagem.N3++
    else if (res === 'Concluído')       contagem.N4++
    else if (res === 'Efetivo')         contagem.N5++
  })

  return (
    <div className="regua">
      {NIVEIS.map(n => (
        <div key={n.id}
          className={`rn ${n.cls} ${filtroNivel === n.id ? 'ativo' : ''}`}
          onClick={() => onToggleNivel(filtroNivel === n.id ? '' : n.id)}
        >
          <div className="rn-c">{contagem[n.id]}</div>
          <div className="rn-n">{n.nome}</div>
        </div>
      ))}
    </div>
  )
}

// ─── PAINEL DE COLUNAS VISÍVEIS ──────────────────────────────────────────────

function ColunasPanel({ visCols, setVisCols, open, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  const toggle = (colId) => {
    setVisCols(prev => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      return next
    })
  }

  return (
    <div ref={ref} className={`col-panel ${open ? 'open' : ''}`}>
      <div className="cp-ttl">Colunas Visíveis</div>
      {COL_GROUPS.map(g => (
        <div key={g.label}>
          <div className="cp-grp">{g.label}</div>
          {g.cols.map(c => (
            <label key={c.id} className="cp-row">
              <input type="checkbox" checked={visCols.has(c.id)} onChange={() => toggle(c.id)} />
              {c.label}
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── FASE ATUAL ──────────────────────────────────────────────────────────────

function FaseAtual({ row }) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado')
    return <span className="fp" style={{ color: 'var(--f3c)' }}>F3</span>
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado')
    return <span className="fp" style={{ color: 'var(--f2e2c)' }}>F2 — E2</span>
  if (row.dc_novo && row.dc_novo.trim() !== '')
    return <span className="fp" style={{ color: 'var(--f2e1c)' }}>F2 — E1</span>
  return <span className="fp" style={{ color: 'var(--f1c)' }}>F1</span>
}

// ─── TABELA MRC ──────────────────────────────────────────────────────────────

function TabelaMRC({ rows, visCols, onOpenModal }) {
  const v = id => visCols.has(id)

  return (
    <div className="tbl-sc">
      <table>
        <thead>
          <tr>
            {v('ref')    && <th style={{ width: 90 }}>Referência</th>}
            {v('area')   && <th style={{ width: 130 }}>Área</th>}
            {v('sub')    && <th style={{ width: 160 }}>Subprocesso</th>}
            {v('dr')     && <th>Descrição do Risco</th>}
            {v('dc')     && <th>Descrição do Controle</th>}
            {v('cat')    && <th style={{ width: 80 }}>Categoria</th>}
            {v('freq')   && <th style={{ width: 70 }}>Frequência</th>}
            {v('nat')    && <th style={{ width: 70 }}>Natureza</th>}
            {v('car')    && <th style={{ width: 70 }}>Caráter</th>}
            {v('sis')    && <th style={{ width: 80 }}>Sistema</th>}
            {v('chave')  && <th style={{ width: 60 }}>Chave</th>}
            {v('imp')    && <th style={{ width: 80 }}>Impacto</th>}
            {v('prob')   && <th style={{ width: 80 }}>Prob.</th>}
            {v('crit')   && <th style={{ width: 90 }}>Criticidade</th>}
            {v('r1')     && <th style={{ width: 90 }}>Result. F1</th>}
            {v('r_ader') && <th style={{ width: 90 }}>Result. F2</th>}
            {v('r3')     && <th style={{ width: 90 }}>Result. F3</th>}
            {v('fase')   && <th style={{ width: 100 }}>Fase Atual</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={18} className="empty">Nenhum controle encontrado com os filtros aplicados.</td></tr>
          )}
          {rows.map(row => (
            <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => onOpenModal(row)}>
              {v('ref') && <td>
                <div style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 600 }}>{row.rr}</div>
                <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{row.rc}</div>
              </td>}
              {v('area')   && <td><span className="tc" style={{ maxWidth: 120 }}>{row.area}</span></td>}
              {v('sub')    && <td><span className="tc" style={{ maxWidth: 150 }}>{row.sub}</span></td>}
              {v('dr')     && <td><ExpCell text={row.dr} maxLen={70} /></td>}
              {v('dc')     && <td><ExpCell text={row.dc} maxLen={70} /></td>}
              {v('cat')    && <td><span className="tc" style={{ maxWidth: 75, fontSize: 11 }}>{row.cat}</span></td>}
              {v('freq')   && <td><span style={{ fontSize: 11 }}>{row.freq}</span></td>}
              {v('nat')    && <td><span style={{ fontSize: 11 }}>{row.nat}</span></td>}
              {v('car')    && <td><span style={{ fontSize: 11 }}>{row.car}</span></td>}
              {v('sis')    && <td><span style={{ fontSize: 11 }}>{row.sis}</span></td>}
              {v('chave')  && <td><span style={{ fontSize: 11 }}>{row.chave}</span></td>}
              {v('imp')    && <td>{badge(IMP_MAP[row.imp] || 'b-na', row.imp)}</td>}
              {v('prob')   && <td>{badge(PROB_MAP[row.prob] || 'b-na', row.prob)}</td>}
              {v('crit')   && <td>{critBadge(row.crit)}</td>}
              {v('r1')     && <td>{badge(R1_MAP[row.r1] || 'b-na', row.r1)}</td>}
              {v('r_ader') && <td>{row.r_ader ? badge(R1_MAP[row.r_ader] || 'b-na', row.r_ader) : <span style={{ color: 'var(--txt3)', fontSize: 10 }}>—</span>}</td>}
              {v('r3')     && <td>{row.r3 ? badge(R1_MAP[row.r3] || 'b-na', row.r3) : <span style={{ color: 'var(--txt3)', fontSize: 10 }}>—</span>}</td>}
              {v('fase')   && <td><FaseAtual row={row} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function MRCCompleta({ projetoId }) {
  const [mrc, setMrc]         = useState([])
  const [areas, setAreas]     = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState(null)

  // Filtros
  const [busca, setBusca]         = useState('')
  const [filtroArea, setFiltroArea]   = useState('')
  const [filtroCrit, setFiltroCrit]   = useState('')
  const [filtroImp, setFiltroImp]     = useState('')
  const [filtroProb, setFiltroProb]   = useState('')
  const [filtroR1, setFiltroR1]       = useState('')
  const [filtroNivel, setFiltroNivel] = useState('')

  // Colunas visíveis
  const [visCols, setVisCols] = useState(new Set(DEFAULT_COLS))
  const [colPanelOpen, setColPanelOpen] = useState(false)

  // Modal
  const [modalRow, setModalRow] = useState(null)

  // ── Carrega dados ──
  useEffect(() => {
    if (!projetoId) return
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('mrc')
        .select('*')
        .eq('projeto_id', projetoId)
        .order('id')
      if (error) { setErro(error.message); setLoading(false); return }
      setMrc(data || [])
      const areasUnicas = [...new Set((data || []).map(r => r.area))].filter(Boolean).sort()
      setAreas(areasUnicas)
      setLoading(false)
    }
    load()
  }, [projetoId])

  // ── Filtragem ──
  const filtered = mrc.filter(r => {
    if (filtroArea && r.area !== filtroArea) return false
    if (filtroCrit && r.crit !== parseInt(filtroCrit)) return false
    if (filtroImp  && r.imp  !== filtroImp)  return false
    if (filtroProb && r.prob !== filtroProb) return false
    if (filtroR1   && r.r1   !== filtroR1)   return false

    // Filtro da régua de níveis
    if (filtroNivel) {
      const nivel = NIVEIS.find(n => n.id === filtroNivel)
      if (nivel && r.r1 !== nivel.resultado) return false
    }

    if (busca) {
      const q = busca.toLowerCase()
      return (
        (r.rr || '').toLowerCase().includes(q) ||
        (r.rc || '').toLowerCase().includes(q) ||
        (r.area || '').toLowerCase().includes(q) ||
        (r.sub || '').toLowerCase().includes(q) ||
        (r.dr || '').toLowerCase().includes(q) ||
        (r.dc || '').toLowerCase().includes(q) ||
        (r.incons || '').toLowerCase().includes(q) ||
        (r.passos_f1 || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Filtro pelo heatmap ──
  const handleHeatmapCell = (imp, prob, sel) => {
    if (sel) { setFiltroImp(''); setFiltroProb('') }
    else { setFiltroImp(imp); setFiltroProb(prob) }
  }

  // ── Limpar todos os filtros ──
  const limparFiltros = () => {
    setBusca(''); setFiltroArea(''); setFiltroCrit('')
    setFiltroImp(''); setFiltroProb(''); setFiltroR1('')
    setFiltroNivel('')
  }

  const temFiltro = busca || filtroArea || filtroCrit || filtroImp || filtroProb || filtroR1 || filtroNivel

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--txt3)' }}>
      <div className="spinner" style={{ marginRight: 10 }} />
      <span>Carregando MRC…</span>
    </div>
  )

  if (erro) return (
    <div style={{ padding: 32, color: 'var(--in)' }}>Erro ao carregar MRC: {erro}</div>
  )

  return (
    <div className="mrc-wrap">
      {/* CABEÇALHO */}
      <div className="dash-eye">Matriz de Riscos e Controles</div>
      <div className="dash-ttl" style={{ marginBottom: 14 }}>MRC Completa</div>

      {/* HEATMAP */}
      <Heatmap data={filtered} filtroImp={filtroImp} filtroProb={filtroProb} onFilterCell={handleHeatmapCell} />

      {/* RÉGUA DE NÍVEIS */}
      <Regua data={mrc} filtroNivel={filtroNivel} onToggleNivel={setFiltroNivel} />

      {/* BARRA DE AÇÕES */}
      <div className="mrc-actions">
        <span className="chip">{filtered.length} de {mrc.length} controles</span>
        {temFiltro && (
          <button className="btn btn-ghost btn-sm" onClick={limparFiltros}>✕ Limpar filtros</button>
        )}

        <div className="mrc-actions-right">
          <button className="btn-export btn-export-xl" title="Exportar para Excel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
            Excel
          </button>
          <button className="btn-export btn-export-pdf" title="Exportar para PDF">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </button>

          <div className="col-panel-wrap">
            <button className="btn btn-xs" onClick={() => setColPanelOpen(o => !o)}>
              ⊞ Colunas
            </button>
            <ColunasPanel visCols={visCols} setVisCols={setVisCols} open={colPanelOpen} onClose={() => setColPanelOpen(false)} />
          </div>
        </div>
      </div>

      {/* TABELA COM FILTROS */}
      <div className="card">
        <div className="filters">
          <input type="text" placeholder="Buscar ref., área, risco, controle, inconsistência, passos…"
            value={busca} onChange={e => setBusca(e.target.value)} />
          <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
            <option value="">Todas as áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroCrit} onChange={e => setFiltroCrit(e.target.value)}>
            <option value="">Todas criticidades</option>
            <option value="4">Crítico</option>
            <option value="3">Significativo</option>
            <option value="2">Moderado</option>
            <option value="1">Baixo</option>
          </select>
          <select value={filtroR1} onChange={e => setFiltroR1(e.target.value)}>
            <option value="">Todos resultados</option>
            <option>Efetivo</option>
            <option>Inefetivo</option>
            <option>GAP</option>
            <option>Concluído</option>
            <option>Em desenvolvimento</option>
            <option>Teste Não Realizado</option>
          </select>
        </div>

        <TabelaMRC rows={filtered} visCols={visCols} onOpenModal={setModalRow} />
      </div>

      {/* MODAL */}
      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
    </div>
  )
}
