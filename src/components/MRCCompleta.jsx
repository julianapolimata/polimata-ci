import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { exportarMRCExcel } from '../lib/exportMRC'
import { getResultadoVitrine, getStatusComputado } from '../lib/fases'
import { getProximaAcao, PROXIMA_ACAO_OPCOES } from '../lib/statusWorkflow'
import {
  getFaseInfo, NIVEIS, MAX_ROWS,
  HM_IMPS, HM_PROBS, HM_COLORS, CRIT_LABELS_HM, CRIT_CORES_HM, impToIdx, probToIdx,
} from './mrc/badges'
import TabelaMRC from './mrc/TabelaMRC'
import { ModalDetalhe } from './mrc/ModalDetalhe'

export { ModalDetalhe }

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function MRCCompleta({ projetoId, projeto, clienteNome, projetoNome, notificacoes, papel }) {
  const isClienteMRC = papel === 'gestor_cliente' || papel === 'usuario_cliente'
  const isDiagnostico = projeto?.f1_tem_teste === false
  const [mrc, setMrc] = useState([]); const [areas, setAreas] = useState([]); const [loading, setLoading] = useState(true); const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState(''); const [filtroArea, setFiltroArea] = useState(''); const [filtroCrit, setFiltroCrit] = useState('')
  const [filtroImp, setFiltroImp] = useState(''); const [filtroProb, setFiltroProb] = useState(''); const [filtroR1, setFiltroR1] = useState(''); const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroFase, setFiltroFase] = useState('')
  const [filtroSit, setFiltroSit] = useState('existente')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [modalRow, setModalRow] = useState(null)
  const [dashCollapsed, setDashCollapsed] = useState(false)

  useEffect(() => {
    if (!projetoId) return
    async function load() {
      setLoading(true)
      const [mrcRes, areasRes] = await Promise.all([
        supabase.from('mrc').select('*').eq('projeto_id', projetoId).order('id'),
        supabase.from('areas').select('id, nome').eq('projeto_id', projetoId),
      ])
      if (mrcRes.error) { setErro(mrcRes.error.message); setLoading(false); return }
      const areasMap = Object.fromEntries((areasRes.data || []).map(a => [a.id, a.nome]))
      const rows = (mrcRes.data || []).map(r => ({ ...r, area: areasMap[r.area_id] || r.area || '' }))
      setMrc(rows); setAreas([...new Set(rows.map(r=>r.area))].filter(Boolean).sort()); setLoading(false)
    }
    load()
  }, [projetoId])

  // KPIs — iguala padrão PorArea
  const kpis = useMemo(() => {
    let ef = 0, inf = 0, gap = 0, pa = 0
    let ex = 0, pc = 0, ix = 0, crit = 0
    mrc.forEach(c => {
      const r = (getResultadoVitrine(c, projeto) || '').toLowerCase()
      if (r === 'efetivo') ef++
      else if (r === 'inefetivo') inf++
      else if (r === 'gap' || r === 'gap de processo') gap++
      const needsPA = ['inefetivo','gap','gap de processo'].some(v =>
        (getResultadoVitrine(c, projeto)||'').toLowerCase() === v
      )
      const paDone = ['efetivo','concluído','concluido','ok'].includes((c.st_pa||'').toLowerCase())
      if (needsPA && !paDone) pa++
      // Existência (diagnóstico)
      if (c.existencia === 'Existente') ex++
      else if (c.existencia === 'Parcial') pc++
      else if (c.existencia === 'Inexistente') ix++
      if (c.crit === 4) crit++
    })
    return { ef, inf, gap, pa, ex, pc, ix, crit }
  }, [mrc])

  const heatGrid = useMemo(() => {
    const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
    mrc.forEach(c => {
      const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
      if (ri >= 0 && ci >= 0) grid[ri][ci]++
    })
    return grid
  }, [mrc])

  const mrcVisiveis = mrc.filter(r => {
    const sr = (r.status_risco || '').toLowerCase()
    if (filtroSit === 'existente') return sr === 'existente' || sr === 'ativo' || sr === '' || !r.status_risco
    if (filtroSit === 'evitado') return sr === 'evitado'
    if (filtroSit === 'transferido') return sr === 'transferido'
    return true // 'todos'
  })
  const filtered = mrcVisiveis.filter(r => {
    if (filtroArea && r.area !== filtroArea) return false
    if (filtroCrit && r.crit !== parseInt(filtroCrit)) return false
    if (filtroImp && r.imp !== filtroImp) return false
    if (filtroProb && r.prob !== filtroProb) return false
    if (filtroR1) {
      if (isDiagnostico) { if ((r.existencia || '') !== filtroR1) return false }
      else if (getResultadoVitrine(r, projeto) !== filtroR1) return false
    }
    if (filtroNivel) { const nivel = NIVEIS.find(n => n.id === filtroNivel); if (nivel && getResultadoVitrine(r, projeto) !== nivel.resultado) return false }
    if (filtroFase) { const fi = getFaseInfo(r); if (fi.label !== filtroFase) return false }
    if (!isClienteMRC && filtroStatus) { if (getStatusComputado(r) !== filtroStatus) return false }
    if (!isClienteMRC && filtroAcao) { if (getProximaAcao(getStatusComputado(r)) !== filtroAcao) return false }
    if (busca) { const q = busca.toLowerCase(); return (r.rr||'').toLowerCase().includes(q)||(r.rc||'').toLowerCase().includes(q)||(r.area||'').toLowerCase().includes(q)||(r.sub||'').toLowerCase().includes(q)||(r.dr||'').toLowerCase().includes(q)||(r.dc||'').toLowerCase().includes(q)||(r.incons||'').toLowerCase().includes(q)||(r.passos_f1||'').toLowerCase().includes(q) }
    return true
  })

  const fasesDisponiveis = [...new Set(mrc.map(r => getFaseInfo(r).label))].sort()

  const visibleRows = filtered.slice(0, MAX_ROWS); const isLimited = filtered.length > MAX_ROWS
  const handleHeatmapCell = (imp, prob, sel) => { if (sel) { setFiltroImp(''); setFiltroProb('') } else { setFiltroImp(imp); setFiltroProb(prob) } }
  const limparFiltros = () => { setBusca(''); setFiltroArea(''); setFiltroCrit(''); setFiltroImp(''); setFiltroProb(''); setFiltroR1(''); setFiltroNivel(''); setFiltroFase(''); setFiltroSit('existente'); setFiltroStatus(''); setFiltroAcao('') }
  const temFiltro = busca || filtroArea || filtroCrit || filtroImp || filtroProb || filtroR1 || filtroNivel || filtroFase || filtroSit !== 'existente' || filtroStatus || filtroAcao

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
              {HM_IMPS.map(l => <div key={l} style={{ fontSize: 10, fontWeight: 600, color: 'var(--lt-text3)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>{l}</div>)}
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
            {HM_PROBS.map(l => <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--lt-text3)' }}>{l}</div>)}
          </div>
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--lt-text3)' }}>Probabilidade →</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--lt-border)' }}>
            {CRIT_LABELS_HM.map((l, i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--lt-text3)' }}>
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
          {isDiagnostico ? (<>
            <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid #22C55E', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
              <div style={kpiLabelS}>Existentes</div>
              <div style={{ ...kpiValorS, color: '#22C55E' }}>{kpis.ex}</div>
              <div style={kpiSubS}>{mrc.length > 0 ? Math.round(kpis.ex / mrc.length * 100) : 0}% do total</div>
            </div>
            <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid #FACC15', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
              <div style={kpiLabelS}>Parciais</div>
              <div style={{ ...kpiValorS, color: '#FACC15' }}>{kpis.pc}</div>
              <div style={kpiSubS}>{mrc.length > 0 ? Math.round(kpis.pc / mrc.length * 100) : 0}% do total</div>
            </div>
            <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid #EF4444', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
              <div style={kpiLabelS}>Inexistentes</div>
              <div style={{ ...kpiValorS, color: '#EF4444' }}>{kpis.ix}</div>
              <div style={kpiSubS}>{mrc.length > 0 ? Math.round(kpis.ix / mrc.length * 100) : 0}% do total</div>
            </div>
            <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid var(--copper)', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
              <div style={kpiLabelS}>Riscos Críticos</div>
              <div style={{ ...kpiValorS, color: 'var(--copper)' }}>{kpis.crit}</div>
              <div style={kpiSubS}>atenção prioritária</div>
            </div>
          </>) : (<>
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
          </>)}
        </div>
      </div>}

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', marginBottom: 6 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ref., área, risco, controle, inconsistência…" style={{ flex: 1, minWidth: 200, background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, outline: 'none', color: 'var(--lt-text)' }} />
        <select value={filtroCrit} onChange={e => setFiltroCrit(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todas criticidades</option><option value="4">Crítico</option><option value="3">Significativo</option><option value="2">Moderado</option><option value="1">Baixo</option></select>
        <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todas as fases</option>{fasesDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}</select>
        {isDiagnostico ? (
          <select value={filtroR1} onChange={e => setFiltroR1(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todas existências</option><option value="Existente">Existente</option><option value="Parcial">Parcial</option><option value="Inexistente">Inexistente</option></select>
        ) : (
          <select value={filtroR1} onChange={e => setFiltroR1(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="">Todos resultados</option><option>Efetivo</option><option>Inefetivo</option><option>GAP</option><option>Teste Não Realizado</option></select>
        )}
        <select value={filtroSit} onChange={e => setFiltroSit(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }}><option value="existente">Existentes</option><option value="evitado">Evitados</option><option value="transferido">Transferidos</option><option value="todos">Todos</option></select>
        {!isClienteMRC && <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--copper)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }} title="Filtro interno Polímata"><option value="">Todos status</option><option value="rascunho">Rascunho</option><option value="nao_iniciado">Não Iniciado</option><option value="em_analise">Em Análise</option><option value="teste_pendente">Teste Pendente</option><option value="em_revisao">Em Revisão</option><option value="aprovado">Aprovado</option><option value="reprovado">Em Correção</option></select>}
        {!isClienteMRC && <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)} style={{ background: 'var(--lt-card)', border: '1px solid var(--copper)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' }} title="Filtro interno Polímata"><option value="">Todas ações</option>{PROXIMA_ACAO_OPCOES.map(a => <option key={a} value={a}>{a}</option>)}</select>}
        <span style={{ fontSize: 10, color: 'var(--lt-text3)', fontWeight: 600 }}>{filtered.length} controles</span>
        {temFiltro && <button onClick={limparFiltros} style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--copper)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✕ Limpar</button>}
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 999, padding: '5px 10px', fontSize: 10, fontWeight: 600, color: '#16A34A', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }} onClick={() => exportarMRCExcel(filtered, 'MRC_Completa_' + new Date().toISOString().slice(0,10), 'MRC Completa', clienteNome, projetoNome)}>Excel</button>
      </div>

      {/* TABELA */}
      <div style={{ flex: 1, minHeight: 0, background: 'var(--lt-card)', borderRadius: 12, border: '1px solid var(--lt-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
        {isLimited && <div style={{ background: 'rgba(234,179,8,0.1)', color: '#92400E', fontSize: 10, padding: '4px 14px', borderBottom: '1px solid var(--lt-border)', fontWeight: 500 }}>Exibindo {MAX_ROWS} de {filtered.length} — refine os filtros</div>}
        <TabelaMRC rows={visibleRows} onOpenModal={setModalRow} isDiagnostico={isDiagnostico} projeto={projeto} />
      </div>

      {modalRow && <ModalDetalhe row={modalRow} projeto={projeto} onClose={() => setModalRow(null)} />}
    </div>
  )
}

// Estilos KPI (padrão PorArea)
const kpiLabelS = { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lt-text3)', marginBottom: 4 }
const kpiValorS = { fontSize: 28, fontWeight: 300, lineHeight: 1 }
const kpiSubS = { fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 }
