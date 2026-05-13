import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getResultadoVitrine, getFaseLabel, getStatusComputado, getFaseDisplayOverride, normalizeFaseValue } from '../../lib/fases'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { getNivelMaturidade } from '../../lib/calculoMaturidade'
import { getStatusConfig, getProximaAcao, PROXIMA_ACAO_OPCOES } from '../../lib/statusWorkflow'
import { exportarMRCExcel } from '../../lib/exportMRC'
import { gerarTemplateMRC } from '../../lib/templateMRC'
import { ModalDetalhe } from '../../components/MRCCompleta'
import ModalAtualizar from '../../components/ModalAtualizar'
import ModalNovoRisco from '../../components/ModalNovoRisco'
import ModalRegistrarResultado from '../../components/ModalRegistrarResultado'
import ModalRevisar from '../../components/ModalRevisar'
import NotificacoesPanel from '../../components/NotificacoesPanel'
import {
  CRIT_CORES, CRIT_LABELS, IMP_LABELS, PROB_LABELS, HEAT_CORES,
  isEfetivo, isInefetivo, isGap, precisaPlanoAcao, planoAcaoConcluido,
  impToIdx, probToIdx,
  fmtDate, getUltimaAtualizacao,
  NivelBadge, Spinner, NoProjeto,
} from './_shared'

// ══════════════════════════════════════════════════════════════════════════════
// TELA 2 — POR ÁREA (REDESIGN v2 — TEMA ESCURO + HEATMAP + KPI GRID)
// ══════════════════════════════════════════════════════════════════════════════

export default function PorArea({ projeto, areasCalc, todosControles, loading, navigate, loadDados }) {
  const { areaId } = useParams()
  const { perfil } = useAuth()
  const area = areasCalc.find(a => a.id === areaId)
  const nome = area?.nome || ''
  const [busca, setBusca] = useState('')
  const [filtCrit, setFiltCrit] = useState('')
  const [filtImp, setFiltImp] = useState('')
  const [filtRes, setFiltRes] = useState('')
  const [filtFase, setFiltFase] = useState('')
  const [filtSit, setFiltSit] = useState('existente')
  const [filtStatus, setFiltStatus] = useState('')      // visão Polímata: status_workflow
  const [filtAcao, setFiltAcao] = useState('')          // visão Polímata: próxima ação
  const [expandirFiltros, setExpandirFiltros] = useState(false)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [simularPerfil, setSimularPerfil] = useState(null)
  const [modalRow, setModalRow] = useState(null)
  const [atualizarRow, setAtualizarRow] = useState(null)
  const [modalNovoRisco, setModalNovoRisco] = useState(false)
  const [rowRegistrarResultado, setRowRegistrarResultado] = useState(null)
  const [rowRevisar, setRowRevisar] = useState(null)
  const [dashCollapsed, setDashCollapsed] = useState(false)
  // topBarRef removido
  const tableScrollRef = useRef(null)
  // syncScroll removido
  const papelAtivo = simularPerfil || perfil?.papel
  const canEdit = papelAtivo === 'admin_polimata' || papelAtivo === 'consultor_polimata'
  const isAdmin = papelAtivo === 'admin_polimata'
  const isCliente = papelAtivo === 'gestor_cliente' || papelAtivo === 'usuario_cliente'
  const isRealAdmin = perfil?.papel === 'admin_polimata'

  // HOOKS devem ficar ANTES de qualquer early return (React rules of hooks)
  const controles = area?.controles || []
  const ultAtualArea = useMemo(() => getUltimaAtualizacao(controles), [controles])
  const areaHeatmap = useMemo(() => {
    const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
    controles.forEach(c => {
      const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
      if (ri >= 0 && ci >= 0) grid[ri][ci]++
    })
    return grid
  }, [controles])

  // Retorna config de status (label, color, bg) baseado no perfil ativo (real ou simulado)
  function getStatusBadge(sw) {
    return getStatusConfig(sw, papelAtivo)
  }

  // Alertas pendentes para coluna Ação
  function getAlertas(c) {
    const alertas = []
    const sw = c.status_workflow
    const rv = (getResultadoVitrine(c, projeto) || '').toLowerCase()
    // Devolvido (reprovado na revisão) — prioridade máxima
    if (sw === 'reprovado') alertas.push({ label: 'Devolvido', color: '#DC2626', bg: 'rgba(239,68,68,0.08)' })
    // Ficha pendente: salvou dados mas não baixou a ficha de teste
    if (sw === 'teste_pendente') alertas.push({ label: 'Ficha Pendente', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' })
    // Resultado pendente: tem dados na fase (em_analise) mas não registrou resultado formal
    if (sw === 'em_analise') alertas.push({ label: 'Resultado Pendente', color: '#CA8A04', bg: 'rgba(234,179,8,0.08)' })
    // Criticidade pendente: tem resultado mas falta impacto ou probabilidade
    if (rv && rv !== '—' && rv !== 'teste não realizado' && (!c.imp || !c.prob)) alertas.push({ label: 'Criticidade Pendente', color: '#EA580C', bg: 'rgba(234,88,12,0.08)' })
    return alertas
  }

  if (loading) return <Spinner light />
  if (!projeto) return <NoProjeto />
  if (!area) return <div style={{ background: 'var(--lt-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, fontFamily: "'Montserrat', sans-serif" }}><div style={{ color: 'var(--lt-text3)' }}>Área não encontrada.</div><button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid var(--lt-border)', background: 'var(--lt-card)', color: 'var(--lt-text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>← Voltar</button></div>

  const isDiagnostico = projeto?.f1_tem_teste === false
  const somaPesos = areasCalc.reduce((s, a) => s + (a.peso||0), 0)
  const pesoEmpresa = somaPesos > 0 ? ((area.peso||0)/somaPesos*100).toFixed(1) : '0'
  const p = area.calc?.percentual||0, nv = getNivelMaturidade(p)
  let efetivos=0, inefetivos=0, gaps=0, planosAcao=0
  let pa_ex=0, pa_pc=0, pa_ix=0, pa_crit=0
  area.controles.forEach(c => {
    const rv = getResultadoVitrine(c, projeto)
    if (isEfetivo(rv)) efetivos++
    else if (isInefetivo(rv)) inefetivos++
    else if (isGap(rv)) gaps++
    if (precisaPlanoAcao(c) && !planoAcaoConcluido(c)) planosAcao++
    if (c.existencia === 'Existente') pa_ex++
    else if (c.existencia === 'Parcial') pa_pc++
    else if (c.existencia === 'Inexistente') pa_ix++
    if (c.crit === 4) pa_crit++
  })
  const pa_total = area.controles.length
  const pa_pct = (n) => pa_total > 0 ? Math.round(n / pa_total * 100) : 0

  // Resultado geral: retorna o resultado da fase mais avançada do controle
  function getResultadoGeral(c) {
    const v = getResultadoVitrine(c, projeto)
    if (!v || v === '—') return null
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
  }

  function getFaseCodigo(c) {
    return faseLabel(c).f
  }

  const controlesVisiveis = area.controles.filter(c => {
    const sr = (c.status_risco || '').toLowerCase()
    if (filtSit === 'existente') return sr === 'existente' || sr === 'ativo' || sr === '' || !c.status_risco
    if (filtSit === 'evitado') return sr === 'evitado'
    if (filtSit === 'transferido') return sr === 'transferido'
    return true // 'todos'
  })
  const cf = controlesVisiveis.filter(c => {
    if (busca) { const b = busca.toLowerCase(); if (![c.rr,c.rc,c.dr,c.dc,c.incons,c.rec].some(f => (f||'').toLowerCase().includes(b))) return false }
    if (filtCrit && String(c.crit_label||c.crit||'') !== filtCrit) return false
    if (filtImp && String(c.imp||'') !== filtImp) return false
    if (filtRes) { const rg = getResultadoGeral(c); if (!rg || rg !== filtRes) return false }
    if (filtFase) { const fc = getFaseCodigo(c); if (fc !== filtFase) return false }
    if (!isCliente && filtStatus) { if (getStatusComputado(c) !== filtStatus) return false }
    if (!isCliente && filtAcao) { if (getProximaAcao(getStatusComputado(c)) !== filtAcao) return false }
    return true
  })

  const PA_DATA_COLS = [
    { h: 'Última Alteração', w: 95, k: '_dt', align: 'center' },
    { h: 'Subprocesso', w: 120, k: 'sub' }, { h: 'Ref. Risco', w: 80, k: 'rr', align: 'center' },
    { h: 'Desc. Risco', w: 200, k: 'dr' }, { h: 'Ref. Controle', w: 90, k: 'rc', align: 'center' }, { h: 'Desc. Controle', w: 200, k: 'dc' },
    { h: 'Resultado', w: 90, k: '_resultado', align: 'center' }, { h: 'Criticidade', w: 110, k: 'crit', align: 'center' },
    { h: 'Fase Atual', w: 130, k: '_fase_atual', align: 'center' }, { h: 'Status Atual', w: 110, k: '_status_atual', align: 'center' },
  ]
  const PA_FASE_KEYS = ['r1', 'st_pa', 'r_ader', 'r3', 'r_f4c1', 'r_f4c2', 'r_f5']
  const toggleSort = (k) => { if (sortCol === k) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setSortCol(k); setSortDir('asc') } }
  const sortArrow = (k) => sortCol === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
  function paSortVal(row, k) { if (k === '_dt') return row.dt_ult || row.atualizado_em || row.criado_em || ''; if (k === '_resultado') return getResultadoVitrine(row, projeto); if (k === '_fase_atual') return getFaseLabel(row); if (k === '_status_atual') return getStatusComputado(row); return row[k] ?? '' }

  const cfSorted = !sortCol ? cf : [...cf].sort((a, b) => {
    let va = paSortVal(a, sortCol), vb = paSortVal(b, sortCol)
    if (sortCol === '_dt') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; return sortDir === 'asc' ? va - vb : vb - va }
    va = String(va).toLowerCase(); vb = String(vb).toLowerCase()
    const cmp = va.localeCompare(vb, 'pt-BR')
    return sortDir === 'asc' ? cmp : -cmp
  })

  const crits = [...new Set(area.controles.map(c => String(c.crit_label||'')).filter(v => v))].sort()
  const imps = [...new Set(area.controles.map(c => String(c.imp||'')).filter(v => v))].sort()
  const ress = [...new Set(area.controles.map(c => { const r = getResultadoGeral(c); return r ? String(r) : '' }).filter(v => v))].sort()
  const fasesDisponiveis = [...new Set(area.controles.map(c => getFaseCodigo(c)).filter(v => v))].sort()

  function faseLabel(c) {
    if (c.r_f5 && c.r_f5 !== 'Teste Não Realizado') return { f: 'Auditoria Independente', s: c.r_f5 }
    if (c.r_f4c2 && c.r_f4c2 !== 'Teste Não Realizado') return { f: 'Auditoria Contínua — Ciclo 2', s: c.r_f4c2 }
    if (c.r_f4c1 && c.r_f4c1 !== 'Teste Não Realizado') return { f: 'Auditoria Contínua — Ciclo 1', s: c.r_f4c1 }
    if (c.r3 && c.r3 !== 'Teste Não Realizado') return { f: 'Revisão Controles Internos', s: c.r3 }
    if (c.r_ader && c.r_ader !== 'Teste Não Realizado') return { f: 'Teste de Aderência', s: c.r_ader }
    if (c.st_pa && c.st_pa !== '') return { f: 'Teste de Desenho', s: c.st_pa }
    if (c.r1 && c.r1 !== 'Teste Não Realizado') return { f: 'Teste de Aderência', s: 'Teste Não Realizado' }
    return { f: 'Diagnóstico Inicial', s: 'Teste Não Realizado' }
  }

  // Badge helpers (tema light)
  const bdgS = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600 }
  function badgeR(r) {
    if (!r || r === 'Teste Não Realizado') return <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{r||'—'}</span>
    if (isEfetivo(r)) return <span style={{ ...bdgS, background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}>Efetivo</span>
    if (isInefetivo(r)) return <span style={{ ...bdgS, background: 'rgba(234,179,8,0.1)', color: '#CA8A04' }}>Inefetivo</span>
    if (isGap(r)) return <span style={{ ...bdgS, background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>GAP</span>
    return <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{r}</span>
  }
  const IMP_C = { Crítico: { bg: 'rgba(239,68,68,0.1)', c: '#DC2626' }, Alto: { bg: 'rgba(249,115,22,0.1)', c: '#EA580C' }, Moderado: { bg: 'rgba(234,179,8,0.1)', c: '#CA8A04' }, Baixo: { bg: 'rgba(34,197,94,0.1)', c: '#16A34A' } }
  const PRB_C = { Extrema: { bg: 'rgba(239,68,68,0.1)', c: '#DC2626' }, Alta: { bg: 'rgba(249,115,22,0.1)', c: '#EA580C' }, Média: { bg: 'rgba(234,179,8,0.1)', c: '#CA8A04' }, Baixa: { bg: 'rgba(34,197,94,0.1)', c: '#16A34A' } }
  const CRT_C = { 4: { bg: 'rgba(239,68,68,0.1)', c: '#DC2626', l: '4. Crítico' }, 3: { bg: 'rgba(249,115,22,0.1)', c: '#EA580C', l: '3. Significativo' }, 2: { bg: 'rgba(234,179,8,0.1)', c: '#CA8A04', l: '2. Moderado' }, 1: { bg: 'rgba(34,197,94,0.1)', c: '#16A34A', l: '1. Baixo' } }
  function badgeImp(v) { const m = IMP_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}>{v}</span> : <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{v||'—'}</span> }
  function badgeProb(v) { const m = PRB_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}>{v}</span> : <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{v||'—'}</span> }
  function badgeCrit(v) { const m = CRT_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />{m.l}</span> : <span style={{ ...bdgS, background: 'rgba(10,37,64,0.05)', color: 'var(--lt-text3)' }}>{v||'—'}</span> }

  // Badge de fase — resultado ou "Não iniciado"
  function badgeFase(val) {
    if (val === 'N/A') return <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--lt-text3)' }}>N/A</span>
    if (val === 'Evitado') return <span style={{ ...bdgS, background: 'rgba(107,114,128,0.1)', color: '#6B7280', fontStyle: 'italic' }}>Evitado</span>
    if (val === 'Transferido') return <span style={{ ...bdgS, background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontStyle: 'italic' }}>Transferido</span>
    if (!val || val === 'Teste Não Realizado') return <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--lt-text3)' }}>Não iniciado</span>
    return badgeR(val)
  }
  // Helper: resolve o valor de exibição de uma fase, considerando F1 efetivo e evitado/transferido
  function faseVal(c, key, rawVal) {
    const override = getFaseDisplayOverride(c, key)
    if (override !== null) return override
    // F1 efetivo → F2 columns show N/A (pula F2 inteira, vai direto p/ F3)
    if ((key === 'st_pa' || key === 'r_ader') && (c.r1||'').toLowerCase() === 'efetivo') return 'N/A'
    return normalizeFaseValue(rawVal)
  }
  // Badge de regressão (triângulo amarelo com número)
  function RegressaoBadge({ n }) {
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
  // Badge para diagnóstico (Existente/Parcial/Inexistente)
  function badgeExistencia(val) {
    if (!val) return <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--lt-text3)' }}>Não iniciado</span>
    const cores = {
      'Existente':   { bg: 'rgba(34,197,94,0.12)', color: '#15803D' },
      'Parcial':     { bg: 'rgba(250,204,21,0.18)', color: '#92400E' },
      'Inexistente': { bg: 'rgba(239,68,68,0.12)',  color: '#991B1B' },
    }
    const c = cores[val] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--lt-text2)' }
    return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{val}</span>
  }

  // Quais colunas de fase mostrar conforme o escopo do projeto (num_fases)
  const numFases = projeto?.num_fases ?? 5
  const idxFases =
    numFases >= 5 ? [0, 1, 2, 3, 4, 5, 6] :
    numFases === 4 ? [0, 1, 2, 3, 4, 5] :
    numFases === 3 ? [0, 1, 2, 3] :
    numFases === 2 ? [0, 1, 2] :
    numFases === 1 ? [0] :
    [0, 1, 2, 3, 4, 5, 6]

  // Headers de fase coloridos
  const FASE_HDR_FULL = [
    { h: 'Fase 1\nDiagnóstico', bg: '#00203E' },
    { h: 'Fase 2\nE1 - Desenho', bg: '#1D3B5C' },
    { h: 'Fase 2\nE2 - Efetividade', bg: '#1D3B5C' },
    { h: 'Fase 3\nRevisão Integral', bg: '#660033' },
    { h: 'Fase 4\nAI - Ciclo 1', bg: '#660066' },
    { h: 'Fase 4\nAI - Ciclo 2', bg: '#660066' },
    { h: 'Fase 5\nAuditoria Indep.', bg: '#A6512F' },
  ]
  // F1 vira "Diagnóstico" em projeto sem teste de efetividade
  const F1_HDR = isDiagnostico ? { h: 'Fase 1\nDiagnóstico', bg: '#00203E' } : FASE_HDR_FULL[0]
  const FASE_HDR = idxFases.map(i => i === 0 ? F1_HDR : FASE_HDR_FULL[i])
  const FASE_KEYS_VISIVEIS = idxFases.map(i => (isDiagnostico && i === 0) ? 'existencia' : PA_FASE_KEYS[i])
  // Width por fase: largura padrão 90; em diagnóstico, F1 fica 130 (cabe "INEXISTENTE")
  const FASE_W_PARA = (idx) => (isDiagnostico && idx === 0) ? 130 : 90
  // Render de cada fase para uma linha
  function renderFaseCell(c, idx) {
    if (isDiagnostico && idx === 0) return badgeExistencia(c.existencia)
    const key = PA_FASE_KEYS[idx]
    return badgeFase(faseVal(c, key, c[key]))
  }
  const FASE_W = 90
  const faseThS = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff', padding: '6px 6px', textAlign: 'center', whiteSpace: 'pre-line', position: 'sticky', top: 0, zIndex: 2, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, borderBottom: 'none', borderRadius: '8px 8px 0 0' }

  const PA = paStyles
  const tdS = { padding: '7px 10px', borderBottom: '1px solid var(--lt-border)', borderRight: '1px solid var(--lt-border)', fontSize: 12, color: 'var(--lt-text2)', whiteSpace: 'nowrap', verticalAlign: 'middle' }
  function Td({ children, w = 150, wrap = false }) { return <td style={{ ...tdS, width: w, minWidth: w, maxWidth: w, overflow: 'hidden', textOverflow: wrap ? undefined : 'ellipsis', whiteSpace: wrap ? 'normal' : 'nowrap', lineHeight: wrap ? 1.4 : undefined }}>{children || '—'}</td> }

  return (
    <div style={PA.page}>
      {/* HEADER — padrão MRC Completa */}
      <div className="mrc-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={PA.btnVoltar}>← VOLTAR</button>
          <div>
            <div className="dash-eye">Matriz de Riscos e Controles</div>
            <div className="dash-ttl" style={{ marginBottom: 0, fontSize: 18 }}>{nome}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="mrc-header-stats">
            <div className="mrc-stat"><span className="mrc-stat-n">{area.controles.length}</span><span className="mrc-stat-l">controles</span></div>
            <div className="mrc-stat"><span className="mrc-stat-n">{pesoEmpresa}%</span><span className="mrc-stat-l">peso empresa</span></div>
          </div>
          <NotificacoesPanel />
        </div>
      </div>

      {/* TOGGLE COLAPSAR DASH */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
        <button onClick={() => setDashCollapsed(c => !c)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 999, padding: '2px 18px', cursor: 'pointer', fontSize: 10, color: 'var(--lt-text3)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
          {dashCollapsed ? '▼ Expandir painel' : '▲ Recolher painel'}
        </button>
      </div>

      {/* ZONA SUPERIOR — HEATMAP + KPI GRID */}
      {!dashCollapsed && <div style={PA.zonaSuperior}>
        {/* HEATMAP */}
        <div style={PA.heatCard}>
          <div style={PA.cardTitle}>Mapa de Calor — Impacto × Probabilidade</div>
          <div style={{ display: 'flex', flex: 1 }}>
            <div style={PA.heatYLabels}>
              {IMP_LABELS.map(l => <div key={l} style={PA.heatYLabel}>{l}</div>)}
            </div>
            <div style={PA.heatGrid}>
              {areaHeatmap.map((row, ri) => (
                <div key={ri} style={PA.heatRow}>
                  {row.map((val, ci) => (
                    <div key={ci} style={{ ...PA.heatCell, background: val === 0 ? 'rgba(10,37,64,0.04)' : HEAT_CORES[ri][ci] }}>
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={PA.heatXLabels}>
            {PROB_LABELS.map(l => <div key={l} style={PA.heatXLabel}>{l}</div>)}
          </div>
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--lt-text3)' }}>Probabilidade →</div>
          <div style={PA.heatLegend}>
            {CRIT_LABELS.map((l, i) => (
              <div key={l} style={PA.legendItem}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CRIT_CORES[i] }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* KPI GRID — versão diagnóstico ou maturidade */}
        {isDiagnostico ? (
          <div style={PA.kpiGrid}>
            <div style={{ ...PA.kpiCard, borderTopColor: 'var(--navy)' }}>
              <div style={PA.kpiLabel}>Total de Controles</div>
              <div style={{ ...PA.kpiValor, color: 'var(--navy)' }}>{pa_total}</div>
              <div style={PA.kpiSub}>Peso empresa: {pesoEmpresa}%</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: '#22C55E' }}>
              <div style={PA.kpiLabel}>Existentes</div>
              <div style={{ ...PA.kpiValor, color: '#22C55E' }}>{pa_ex}</div>
              <div style={PA.kpiSub}>{pa_pct(pa_ex)}% do total</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: '#FACC15' }}>
              <div style={PA.kpiLabel}>Parciais</div>
              <div style={{ ...PA.kpiValor, color: '#FACC15' }}>{pa_pc}</div>
              <div style={PA.kpiSub}>{pa_pct(pa_pc)}% do total</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: '#EF4444' }}>
              <div style={PA.kpiLabel}>Inexistentes</div>
              <div style={{ ...PA.kpiValor, color: '#EF4444' }}>{pa_ix}</div>
              <div style={PA.kpiSub}>{pa_pct(pa_ix)}% do total</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: 'var(--copper)' }}>
              <div style={PA.kpiLabel}>Riscos Críticos</div>
              <div style={{ ...PA.kpiValor, color: 'var(--copper)' }}>{pa_crit}</div>
              <div style={PA.kpiSub}>atenção prioritária</div>
            </div>
          </div>
        ) : (
        <div style={PA.kpiGrid}>
          <div style={{ ...PA.kpiCard, borderTopColor: 'var(--copper)' }}>
            <div style={PA.kpiLabel}>Maturidade</div>
            <div style={{ ...PA.kpiValor, color: 'var(--copper)' }}>{(p*100).toFixed(1)}%</div>
            <NivelBadge pct={p} nivel={nv} />
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: 'var(--navy)' }}>
            <div style={PA.kpiLabel}>Total de Controles</div>
            <div style={{ ...PA.kpiValor, color: 'var(--navy)' }}>{area.controles.length}</div>
            <div style={PA.kpiSub}>Peso empresa: {pesoEmpresa}%</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#22C55E' }}>
            <div style={PA.kpiLabel}>Efetivos</div>
            <div style={{ ...PA.kpiValor, color: '#22C55E' }}>{efetivos}</div>
            <div style={PA.kpiSub}>{area.controles.length > 0 ? Math.round(efetivos / area.controles.length * 100) : 0}% do total</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#FACC15' }}>
            <div style={PA.kpiLabel}>Inefetivos</div>
            <div style={{ ...PA.kpiValor, color: '#FACC15' }}>{inefetivos}</div>
            <div style={PA.kpiSub}>Aguardam ação corretiva</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#EF4444' }}>
            <div style={PA.kpiLabel}>GAP</div>
            <div style={{ ...PA.kpiValor, color: '#EF4444' }}>{gaps}</div>
            <div style={PA.kpiSub}>Riscos sem controle</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTop: 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #CC915E, #A6512F)' }} />
            <div style={PA.kpiLabel}>Planos de Ação</div>
            <div style={{ ...PA.kpiValor, color: 'var(--copper)' }}>{planosAcao}</div>
            <div style={PA.kpiSub}>Em desenvolvimento</div>
          </div>
        </div>)}
      </div>}

      {/* FILTROS — duas linhas: essenciais (sempre) + drawer "Mais filtros" (colapsável) */}
      {(() => {
        const drawerFiltrosAtivos = (filtCrit ? 1 : 0) + (filtFase ? 1 : 0) + (filtRes ? 1 : 0) + (filtStatus ? 1 : 0) + (filtAcao ? 1 : 0)
        const drawerAberto = expandirFiltros || drawerFiltrosAtivos > 0
        const temAlgumFiltro = busca || filtCrit || filtImp || filtRes || filtFase || filtSit !== 'existente' || filtStatus || filtAcao
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginBottom: 6 }}>
            {/* Linha 1: busca + situação + toggle + contagem + limpar | toolbar de ações */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar risco, controle, inconsistência..." style={{ ...PA.filtroInput, flex: 1, minWidth: 220 }} />
              <select value={filtSit} onChange={e => setFiltSit(e.target.value)} style={PA.filtroSel}><option value="existente">Existentes</option><option value="evitado">Evitados</option><option value="transferido">Transferidos</option><option value="todos">Todos</option></select>
              <button onClick={() => setExpandirFiltros(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: drawerAberto ? 'rgba(204,145,94,0.10)' : 'var(--lt-card)', border: `1px solid ${drawerAberto ? 'rgba(204,145,94,0.35)' : 'var(--lt-border)'}`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 500, color: drawerAberto ? 'var(--copper-text)' : 'var(--lt-text2)', cursor: 'pointer', fontFamily: 'inherit' }} title="Mostrar/ocultar filtros adicionais">
                {drawerAberto ? '▾' : '▸'} Mais filtros
                {drawerFiltrosAtivos > 0 && <span style={{ background: 'var(--copper-text)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 9, fontWeight: 700, lineHeight: '14px', minWidth: 14, textAlign: 'center' }}>{drawerFiltrosAtivos}</span>}
              </button>
              <div style={{ fontSize: 11, color: 'var(--lt-text3)', background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 12px', fontWeight: 500 }}>{cf.length} controles</div>
              {temAlgumFiltro && <button onClick={() => { setBusca(''); setFiltCrit(''); setFiltImp(''); setFiltRes(''); setFiltFase(''); setFiltSit('existente'); setFiltStatus(''); setFiltAcao('') }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✕ Limpar</button>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                {canEdit && <button onClick={() => setModalNovoRisco(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#00203E', border: '1px solid #00203E', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }} title="Criar novo risco"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo Risco</button>}
                <button onClick={() => gerarTemplateMRC()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--copper-text)', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit' }} title="Baixar template MRC em branco"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Template</button>
                <button onClick={() => exportarMRCExcel(cf, `MRC_${nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}`, nome, formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || '', projeto?.nome || '')} style={PA.btnExport} title="Exportar Excel da área">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                  Excel
                </button>
                {isRealAdmin && (
                  <button onClick={() => setSimularPerfil(prev => prev ? null : 'gestor_cliente')} style={{ background: simularPerfil ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit' }} title="Simular visão do cliente">
                    {simularPerfil ? '← Voltar Admin' : 'Visão Cliente'}
                  </button>
                )}
              </div>
            </div>
            {/* Linha 2: drawer com filtros adicionais — visível quando aberto OU quando há filtros ativos */}
            {drawerAberto && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', marginRight: 4 }}>Filtros adicionais:</span>
                <select value={filtCrit} onChange={e => setFiltCrit(e.target.value)} style={PA.filtroSel}><option value="">Todas criticidades</option>{crits.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select value={filtFase} onChange={e => setFiltFase(e.target.value)} style={PA.filtroSel}><option value="">Todas as fases</option>{fasesDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}</select>
                <select value={filtRes} onChange={e => setFiltRes(e.target.value)} style={PA.filtroSel}><option value="">Todos resultados</option>{ress.map(c => <option key={c} value={c}>{c}</option>)}</select>
                {!isCliente && <select value={filtStatus} onChange={e => setFiltStatus(e.target.value)} style={{ ...PA.filtroSel, borderColor: 'var(--copper-text)' }} title="Filtro interno Polímata">
                  <option value="">Todos status</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="nao_iniciado">Não Iniciado</option>
                  <option value="em_analise">Em Análise</option>
                  <option value="teste_pendente">Teste Pendente</option>
                  <option value="em_revisao">Em Revisão</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Devolvido</option>
                </select>}
                {!isCliente && <select value={filtAcao} onChange={e => setFiltAcao(e.target.value)} style={{ ...PA.filtroSel, borderColor: 'var(--copper-text)' }} title="Filtro interno Polímata">
                  <option value="">Todas ações</option>
                  {PROXIMA_ACAO_OPCOES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>}
              </div>
            )}
          </div>
        )
      })()}
      {simularPerfil && (
        <div style={{ fontSize: 10, color: '#1D4ED8', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 6, padding: '4px 12px', marginBottom: 4, flexShrink: 0, textAlign: 'center', fontWeight: 500 }}>
          Simulando visão: Cliente
        </div>
      )}

      {/* TABELA MRC */}
      <div style={PA.tabelaWrap}>
        <div ref={tableScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {PA_DATA_COLS.map((col, i) =>
                <th key={i} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 12px', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, width: col.w, minWidth: col.w, borderBottom: '1px solid var(--lt-border)', borderRight: '1px solid var(--lt-border)', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(col.k)}>{col.h}{sortArrow(col.k)}</th>)}
              {FASE_HDR.map((f, i) => { const w = FASE_W_PARA(idxFases[i]); return (<th key={`f${i}`} style={{ ...faseThS, width: w, minWidth: w, maxWidth: w, background: f.bg, borderRight: '1px solid rgba(255,255,255,0.28)', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(FASE_KEYS_VISIVEIS[i])}>{f.h}{sortArrow(FASE_KEYS_VISIVEIS[i])}</th>) })}
              {!isCliente && <th style={{ fontSize: 11, fontWeight: 600, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 12px', position: 'sticky', top: 0, zIndex: 2, width: 120, minWidth: 120, borderBottom: '1px solid var(--lt-border)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Ação</th>}
            </tr></thead>
            <tbody>{cfSorted.map((c, i) => (
              <tr key={c.id||i} onClick={() => setModalRow(c)} style={{ cursor: 'pointer', ...((c.status_risco === 'evitado' || c.status_risco === 'transferido') ? { opacity: 0.55, fontStyle: 'italic' } : {}) }} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ ...tdS, width: 95, minWidth: 95, fontSize: 11, color: 'var(--lt-text3)', textAlign: 'center' }}>{fmtDate(c.dt_ult || c.atualizado_em || c.criado_em)}</td>
                <Td w={120}>{c.sub}</Td>
                <td style={{ ...tdS, color: 'var(--copper-text)', fontWeight: 700, width: 80, minWidth: 80, textAlign: 'center' }}>{c.rr}</td><Td w={200}>{c.dr}</Td>
                <td style={{ ...tdS, color: 'var(--copper-text)', fontWeight: 700, width: 90, minWidth: 90, textAlign: 'center' }}>{c.rc}</td><Td w={200}>{c.dc}</Td>
                <td style={{ ...tdS, width: 90, minWidth: 90, textAlign: 'center' }}>{badgeR(getResultadoVitrine(c, projeto))}</td>
                <td style={{ ...tdS, width: 110, minWidth: 110, textAlign: 'center' }}>{badgeCrit(c.crit)}</td>
                <td style={{ ...tdS, width: 130, minWidth: 130, fontSize: 11, fontWeight: 500, textAlign: 'center' }}>{getFaseLabel(c)}{c.num_regressoes > 0 && <RegressaoBadge n={c.num_regressoes} />}</td>
                <td style={{ ...tdS, width: 110, minWidth: 110, textAlign: 'center' }}>{(() => { const st = getStatusComputado(c); const cfg = getStatusBadge(st); return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{cfg.label}</span> })()}</td>
                {/* Colunas de fase */}
                {idxFases.map(idx => { const w = FASE_W_PARA(idx); return (<td key={`fc${idx}`} style={{ ...tdS, width: w, minWidth: w, maxWidth: w, textAlign: 'center' }}>{renderFaseCell(c, idx)}</td>) })}
                {!isCliente && <td style={{ ...tdS, textAlign: 'center', width: 120, minWidth: 120 }}>
                    {(() => {
                      const st = getStatusComputado(c)
                      // Define UMA ação primária por contexto (a "próxima ação" do workflow)
                      let primary = null, secondary = null
                      // Em projeto diagnóstico (sem teste de efetividade), workflow simplificado:
                      // sempre permite editar o controle (existência, criticidade, etc.)
                      if (isDiagnostico && canEdit) {
                        primary = { label: '✏ Editar', color: 'var(--copper-text)', bg: 'rgba(204,145,94,0.12)', border: 'rgba(204,145,94,0.30)', onClick: () => setAtualizarRow(c) }
                      } else if (canEdit && st === 'rascunho') {
                        primary = { label: '▶ Continuar', color: '#92400E', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.40)', onClick: () => setAtualizarRow(c) }
                      } else if (canEdit && st === 'em_analise') {
                        primary = { label: 'Registrar Resultado', color: '#15803D', bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.35)', onClick: () => setRowRegistrarResultado(c) }
                        secondary = { label: '✏ Editar premissas', onClick: () => setAtualizarRow(c) }
                      } else if (isAdmin && st === 'em_revisao') {
                        primary = { label: 'Revisar', color: '#1D4ED8', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', onClick: () => setRowRevisar(c) }
                      } else if (canEdit && (st === 'nao_iniciado' || st === 'teste_pendente' || st === 'reprovado')) {
                        primary = { label: 'Atualizar', color: 'var(--copper-text)', bg: 'rgba(204,145,94,0.12)', border: 'rgba(204,145,94,0.30)', onClick: () => setAtualizarRow(c) }
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          {primary && <button onClick={e => { e.stopPropagation(); primary.onClick() }} style={{ background: primary.bg, border: `1px solid ${primary.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: primary.color, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>{primary.label}</button>}
                          {secondary && <button onClick={e => { e.stopPropagation(); secondary.onClick() }} style={{ background: 'transparent', border: 'none', padding: '2px 4px', fontSize: 10, fontWeight: 500, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{secondary.label}</button>}
                          {getAlertas(c).filter(a => a.label !== 'Resultado Pendente' || !primary).map((a, idx) => <span key={idx} style={{ fontSize: 10, fontWeight: 700, color: a.color, background: a.bg, padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', lineHeight: 1.2 }}>{a.label}</span>)}
                        </div>
                      )
                    })()}
                </td>}
              </tr>))}{cf.length === 0 && <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center', color: 'var(--lt-text3)' }}>Nenhum controle encontrado.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      {modalRow && <ModalDetalhe row={modalRow} projeto={projeto} onClose={() => setModalRow(null)} onEditar={canEdit ? () => { setAtualizarRow(modalRow); setModalRow(null) } : undefined} />}
      {atualizarRow && <ModalAtualizar row={atualizarRow} onClose={() => setAtualizarRow(null)} onSaved={() => { setAtualizarRow(null); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} />}
      {modalNovoRisco && <ModalNovoRisco onClose={() => setModalNovoRisco(false)} onSaved={() => { setModalNovoRisco(false); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} areaFixa={area} />}
      {rowRegistrarResultado && <ModalRegistrarResultado row={rowRegistrarResultado} onClose={() => setRowRegistrarResultado(null)} onSaved={() => { setRowRegistrarResultado(null); if (projeto?.id) loadDados(projeto.id) }} responsaveis={[]} />}
      {rowRevisar && <ModalRevisar row={rowRevisar} onClose={() => setRowRevisar(null)} onAction={() => { setRowRevisar(null); if (projeto?.id) loadDados(projeto.id) }} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS POR ÁREA (tema light)
// ══════════════════════════════════════════════════════════════════════════════

const paStyles = {
  page: { background: 'var(--lt-bg)', height: '100vh', padding: '0 20px 12px', fontFamily: "'Montserrat', sans-serif", color: 'var(--lt-text)', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  btnVoltar: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 999, padding: '4px 12px', fontSize: 10, fontWeight: 600, color: 'var(--lt-text2)', cursor: 'pointer', fontFamily: 'inherit' },
  zonaSuperior: { display: 'flex', gap: 10, flexShrink: 0, margin: '6px 0 8px' },
  cardTitle: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--lt-text3)', marginBottom: 8 },
  heatCard: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' },
  heatYLabels: { display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 6, width: 55, flexShrink: 0 },
  heatYLabel: { fontSize: 10, fontWeight: 600, color: 'var(--lt-text3)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  heatGrid: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  heatRow: { display: 'flex', gap: 2, flex: 1 },
  heatCell: { flex: 1, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', minHeight: 36 },
  heatXLabels: { display: 'flex', paddingLeft: 61, paddingTop: 4, gap: 2 },
  heatXLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--lt-text3)' },
  heatLegend: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--lt-border)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--lt-text3)' },
  kpiGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr', gap: 8 },
  kpiCard: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' },
  kpiLabel: { fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lt-text3)', marginBottom: 4 },
  kpiValor: { fontSize: 28, fontWeight: 300, lineHeight: 1 },
  kpiSub: { fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 },
  filtroInput: { flex: 1, minWidth: 200, background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, outline: 'none', color: 'var(--lt-text)' },
  filtroSel: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text2)', cursor: 'pointer', outline: 'none' },
  btnExport: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 999, padding: '5px 10px', fontSize: 10, fontWeight: 600, color: '#16A34A', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' },
  tabelaWrap: { flex: 1, minHeight: 0, background: 'var(--lt-card)', borderRadius: 12, border: '1px solid var(--lt-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' },
}
