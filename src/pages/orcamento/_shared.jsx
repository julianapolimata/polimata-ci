// ═══════════════════════════════════════════════════════════════════════════
// _shared.jsx — peças comuns do módulo Gestão Orçamentária
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNomeEmpresa } from '../../lib/formatNome'

export const VERDE = 'var(--prod-orcamento)'
export const TIPOS = [
  { id: 'receita', nome: 'Receita' }, { id: 'deducao', nome: 'Dedução' },
  { id: 'custo', nome: 'Custo (CPV)' }, { id: 'despesa', nome: 'Despesa' }, { id: 'outros', nome: 'Outros' },
]
export const TIPO_ORD = Object.fromEntries(TIPOS.map((t, i) => [t.id, i]))
export const sinal = (tipo) => (tipo === 'receita' ? 1 : -1)
export const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const fmtBRL = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }))
export const fmtNum = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }))
export const fmtPct = (v, casas = 1) => (v === null || v === undefined || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { maximumFractionDigits: casas }) + '%')

export const TH = { padding: '7px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--lt-brd)' }
export const TD = { padding: '6px 10px', fontSize: 12.5, color: 'var(--lt-text)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--lt-brd)' }
export const THL = { ...TH, textAlign: 'left' }
export const TDL = { ...TD, textAlign: 'left' }

// ── Header de página ────────────────────────────────────────────────────────
export function PageHeader({ projeto, titulo, subtitulo, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>
          {formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome)} · {projeto?.nome}
        </div>
        <h1 style={{ fontFamily: "'Raleway', sans-serif", fontSize: 23, fontWeight: 700, color: 'var(--lt-text)', margin: '2px 0 0' }}>{titulo}</h1>
        {subtitulo && <div style={{ fontSize: 12, color: 'var(--lt-text3)', marginTop: 3 }}>{subtitulo}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

export function Card({ titulo, extra, children, pad = true, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--lt-brd)', borderRadius: 12, marginBottom: 16, overflow: 'hidden', ...style }}>
      {titulo && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--lt-brd)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--lt-text)' }}>{titulo}</div>
          {extra}
        </div>
      )}
      <div style={pad ? { padding: 16 } : {}}>{children}</div>
    </div>
  )
}

export function KPICard({ label, value, delta, tone }) {
  const cor = tone === 'success' ? '#15803D' : tone === 'warning' ? '#B45309' : tone === 'danger' ? '#B91C1C' : 'var(--lt-text3)'
  const borda = tone === 'success' ? 'rgba(34,197,94,.4)' : tone === 'warning' ? 'rgba(234,179,8,.45)' : tone === 'danger' ? 'rgba(239,68,68,.4)' : 'var(--lt-brd)'
  return (
    <div style={{ background: '#fff', border: '1px solid ' + borda, borderTop: '3px solid ' + (tone ? cor : VERDE), borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--lt-text3)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--lt-text)', fontFamily: "'Raleway', sans-serif", margin: '4px 0 2px' }}>{value}</div>
      {delta && <div style={{ fontSize: 11.5, color: cor }}>{delta}</div>}
    </div>
  )
}

export function KPIGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>{children}</div>
}

export function HelpTag({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(34,185,138,0.07)', border: '1px solid rgba(34,185,138,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--lt-text)', lineHeight: 1.55, marginBottom: 16 }}>
      <span style={{ fontSize: 15 }}>💡</span><div>{children}</div>
    </div>
  )
}

/** Semáforo de desvio: verde dentro, amarelo atenção, vermelho crítico (considera natureza). */
export function Semaforo({ pct, tipo }) {
  if (pct === null || pct === undefined || !isFinite(pct)) return <span style={{ color: 'var(--lt-text3)' }}>—</span>
  const desfavoravel = (tipo === 'receita' ? -pct : pct)
  const cor = desfavoravel <= 5 ? '#15803D' : desfavoravel <= 10 ? '#B45309' : '#B91C1C'
  const bg = desfavoravel <= 5 ? 'rgba(34,197,94,.12)' : desfavoravel <= 10 ? 'rgba(234,179,8,.14)' : 'rgba(239,68,68,.12)'
  return <span style={{ fontSize: 11, fontWeight: 700, color: cor, background: bg, padding: '2px 8px', borderRadius: 999 }}>{fmtPct(pct)}</span>
}

export function Badge({ tone = 'info', children }) {
  const m = {
    success: ['#15803D', 'rgba(34,197,94,.12)'], warning: ['#B45309', 'rgba(234,179,8,.15)'],
    danger: ['#B91C1C', 'rgba(239,68,68,.12)'], info: ['#1D4ED8', 'rgba(59,130,246,.10)'],
    gold: ['#8a6320', 'rgba(204,145,94,.18)'],
  }[tone] || ['#475569', 'rgba(100,116,139,.12)']
  return <span style={{ fontSize: 10, fontWeight: 700, color: m[0], background: m[1], padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4 }}>{children}</span>
}

export function BotaoVerde({ onClick, disabled, children, title }) {
  return <button onClick={onClick} disabled={disabled} title={title} style={{ background: VERDE, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 }}>{children}</button>
}
export function BotaoSec({ onClick, disabled, children, title }) {
  return <button onClick={onClick} disabled={disabled} title={title} style={{ background: '#fff', color: 'var(--lt-text)', border: '1px solid var(--lt-brd)', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 }}>{children}</button>
}

export function ErroBox({ erro, onClose }) {
  if (!erro) return null
  return <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#991B1B', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>{erro}{onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer' }}>✕</button>}</div>
}

// ── Hook central de dados do módulo ─────────────────────────────────────────
export function useOrcDados(projeto, ano) {
  const [categorias, setCategorias] = useState([])
  const [centros, setCentros] = useState([])
  const [cenarios, setCenarios] = useState([])   // orc_orcamentos do ano
  const [realizado, setRealizado] = useState([]) // todos os anos (p/ histórico)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const reload = useCallback(async () => {
    if (!projeto?.id) return
    setLoading(true)
    try {
      const [cat, cc, orc, rea] = await Promise.all([
        supabase.from('orc_categorias').select('*').eq('projeto_id', projeto.id).order('ordem').order('nome'),
        supabase.from('orc_centros_custo').select('*').eq('projeto_id', projeto.id).order('ordem').order('codigo'),
        supabase.from('orc_orcamentos').select('*').eq('projeto_id', projeto.id).eq('ano', ano).order('versao'),
        supabase.from('orc_realizado').select('id, categoria_id, centro_custo_id, competencia, valor, origem, detalhe, conta_erp, situacao, tipo_mov').eq('projeto_id', projeto.id),
      ])
      setCategorias(cat.data || []); setCentros(cc.data || []); setCenarios(orc.data || []); setRealizado(rea.data || [])
      if (cat.error) setErro(cat.error.message)
    } catch (e) { setErro(String(e.message || e)) } finally { setLoading(false) }
  }, [projeto?.id, ano])
  useEffect(() => { reload() }, [reload])

  // catId -> ano -> [12] (somas por competência)
  const realPorCat = useMemo(() => {
    const m = {}
    realizado.forEach(r => {
      const d = new Date(r.competencia + 'T00:00:00'); const a = d.getFullYear(); const mes = d.getMonth()
      m[r.categoria_id] = m[r.categoria_id] || {}; m[r.categoria_id][a] = m[r.categoria_id][a] || Array(12).fill(null)
      m[r.categoria_id][a][mes] = (m[r.categoria_id][a][mes] || 0) + Number(r.valor)
    })
    return m
  }, [realizado])

  const catsAtivas = useMemo(() =>
    categorias.filter(c => c.ativo).sort((a, b) => (TIPO_ORD[a.tipo] - TIPO_ORD[b.tipo]) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')),
  [categorias])

  return { categorias, catsAtivas, centros, cenarios, realizado, realPorCat, loading, erro, setErro, reload }
}

/** Itens de um orçamento/cenário: map catId -> {valores:[12], sugerido:[12], just, conf, status} */
export function useItens(orcamentoId) {
  const [itens, setItens] = useState([])
  const reload = useCallback(async () => {
    if (!orcamentoId) { setItens([]); return }
    const { data } = await supabase.from('orc_orcamento_itens').select('*').eq('orcamento_id', orcamentoId)
    setItens(data || [])
  }, [orcamentoId])
  useEffect(() => { reload() }, [reload])
  const porCat = useMemo(() => {
    const m = {}
    itens.forEach(i => {
      m[i.categoria_id] = m[i.categoria_id] || { valores: Array(12).fill(null), sugerido: Array(12).fill(null), just: null, conf: null, status: null, metodo: null }
      m[i.categoria_id].valores[i.mes - 1] = i.valor === null ? null : Number(i.valor)
      m[i.categoria_id].sugerido[i.mes - 1] = i.sugerido === null ? null : Number(i.sugerido)
      if (i.justificativa_ia) m[i.categoria_id].just = i.justificativa_ia
      if (i.confianca !== null) m[i.categoria_id].conf = i.confianca
      if (i.status_revisao) m[i.categoria_id].status = i.status_revisao
      if (i.metodo) m[i.categoria_id].metodo = i.metodo
    })
    return m
  }, [itens])
  return { itens, porCat, reload }
}

export function SeletorAno({ ano, setAno }) {
  const hoje = new Date().getFullYear()
  return (
    <select className="input-light" style={{ width: 96 }} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
      {Array.from({ length: 6 }, (_, i) => hoje - 3 + i).map(a => <option key={a} value={a}>{a}</option>)}
    </select>
  )
}
