import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getResultadoVitrine, getFaseLabel, getStatusComputado, getFaseDisplayOverride, normalizeFaseValue } from '../../lib/fases'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { getNivelMaturidade } from '../../lib/calculoMaturidade'
import { getStatusConfig, getProximaAcao, PROXIMA_ACAO_OPCOES } from '../../lib/statusWorkflow'
import { exportarMRCExcel } from '../../lib/exportMRC'
import { exportarSolicitacoesExcel } from '../../lib/exportSolicitacoes'
import { supabase } from '../../lib/supabase'
import { gerarTemplateMRC } from '../../lib/templateMRC'
import { gerarRelatorioExcel } from '../../lib/gerarRelatorio'
import { ModalDetalhe } from '../../components/MRCCompleta'
import ModalAtualizar from '../../components/ModalAtualizar'
import ModalNovoRisco from '../../components/ModalNovoRisco'
import ModalRegistrarResultado from '../../components/ModalRegistrarResultado'
import ModalRegistrarCriticidade from '../../components/ModalRegistrarCriticidade'
import ModalRevisar from '../../components/ModalRevisar'
import NotificacoesPanel from '../../components/NotificacoesPanel'
import {
  CRIT_CORES, CRIT_LABELS, IMP_LABELS, PROB_LABELS, HEAT_CORES,
  isEfetivo, isInefetivo, isGap, precisaPlanoAcao, planoAcaoConcluido,
  impToIdx, probToIdx,
  fmtDate, getUltimaAtualizacao,
  NivelBadge, Spinner, NoProjeto,
} from './_shared'
import { paStyles } from './porArea/styles'
import PorAreaTopo from './porArea/PorAreaTopo'
import PorAreaFiltros from './porArea/PorAreaFiltros'
import PorAreaTabela from './porArea/PorAreaTabela'

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
  const [rowCriticidade, setRowCriticidade] = useState(null)
  const [excelMenuAberto, setExcelMenuAberto] = useState(false)
  const excelMenuRef = useRef(null)
  useEffect(() => {
    if (!excelMenuAberto) return
    function onDocClick(e) {
      if (excelMenuRef.current && !excelMenuRef.current.contains(e.target)) setExcelMenuAberto(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [excelMenuAberto])

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
  // Alertas com onClick viram botões clicáveis; sem onClick ficam apenas como tag visual.
  function getAlertas(c) {
    const alertas = []
    const sw = c.status_workflow
    const rv = (getResultadoVitrine(c, projeto) || '').toLowerCase()
    const faltaCriticidade = rv && rv !== '—' && rv !== 'teste não realizado' && (!c.imp || !c.prob)
    // Devolvido (reprovado na revisão) — prioridade máxima
    if (sw === 'reprovado') alertas.push({ label: 'Devolvido', color: '#DC2626', bg: 'rgba(239,68,68,0.08)' })
    // Ficha pendente: salvou dados mas não baixou a ficha de teste
    if (sw === 'teste_pendente') alertas.push({ label: 'Ficha Pendente', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' })
    // Resultado pendente: tem dados na fase (em_analise) mas não registrou resultado formal
    if (sw === 'em_analise') alertas.push({ label: 'Resultado Pendente', color: '#CA8A04', bg: 'rgba(234,179,8,0.08)' })
    // Pendente Aprovação: em revisão (substitui Criticidade Pendente nesse estágio — aprovação vem antes)
    if (sw === 'em_revisao') {
      alertas.push({
        label: 'Pendente Aprovação', color: '#1D4ED8', bg: 'rgba(59,130,246,0.10)',
        onClick: isAdmin ? () => setRowRevisar(c) : null,
      })
    } else if (faltaCriticidade && sw === 'aprovado') {
      // Criticidade pendente: só faz sentido após aprovação (antes, o gargalo é aprovar)
      alertas.push({
        label: 'Criticidade Pendente', color: '#EA580C', bg: 'rgba(234,88,12,0.08)',
        onClick: canEdit ? () => setRowCriticidade(c) : null,
      })
    }
    return alertas
  }

  // Exportar Lista de Solicitações filtrada pela área atual (Solicitações v2)
  async function exportarSolicitacoesDaArea() {
    if (!projeto?.id || !area?.id) return
    const [solRes, ctrlRes, arRes] = await Promise.all([
      supabase.from('solicitacoes').select('*').eq('projeto_id', projeto.id).eq('area_id', area.id).order('criado_em', { ascending: false }),
      supabase.from('mrc').select('id, rr, rc, dr, dc, area_id').eq('projeto_id', projeto.id).eq('area_id', area.id),
      supabase.from('areas').select('id, nome, prefixo').eq('id', area.id),
    ])
    await exportarSolicitacoesExcel({
      solicitacoes: solRes.data || [],
      controles: ctrlRes.data || [],
      areas: arRes.data || [],
      clienteNome: formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || '',
      projetoNome: `${projeto?.nome || ''} · ${area?.nome || ''}`,
    })
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


  // ctx — state, refs, computed e helpers para os 3 blocos extraídos
  const ctx = {
    CRT_C, F1_HDR, FASE_HDR, FASE_HDR_FULL, FASE_KEYS_VISIVEIS, FASE_W, cf, cfSorted, crits, exportarSolicitacoesDaArea, ress,
    FASE_W_PARA, IMP_C, PA, PA_DATA_COLS, PA_FASE_KEYS, PRB_C,
    RegressaoBadge, Td, area, areaHeatmap, areasCalc, atualizarRow,
    badgeCrit, badgeExistencia, badgeFase, badgeImp, badgeProb, badgeR,
    bdgS, busca, canEdit, controles, controlesVisiveis,
    dashCollapsed, efetivos, excelMenuAberto, excelMenuRef, expandirFiltros, exportarMRCExcel,
    exportarSolicitacoesExcel, faseLabel, faseThS, faseVal, fasesDisponiveis, filtAcao,
    filtCrit, filtFase, filtImp, filtRes, filtSit, filtStatus,
    gaps, gerarRelatorioExcel, gerarTemplateMRC, getAlertas, getFaseCodigo, getResultadoGeral,
    getStatusBadge, idxFases, inefetivos, isAdmin, isCliente, isDiagnostico,
    isRealAdmin, loadDados, loading, modalNovoRisco, modalRow, navigate,
    nome, numFases, paSortVal, pa_crit, pa_ex, pa_ix,
    pa_pc, pa_pct, pa_total, papelAtivo, pesoEmpresa, planosAcao,
    projeto, renderFaseCell, rowCriticidade, rowRegistrarResultado, rowRevisar, setAtualizarRow,
    setBusca, setDashCollapsed, setExcelMenuAberto, setExpandirFiltros, setFiltAcao, setFiltCrit,
    setFiltFase, setFiltImp, setFiltRes, setFiltSit, setFiltStatus, setModalNovoRisco,
    setModalRow, setRowCriticidade, setRowRegistrarResultado, setRowRevisar, setSimularPerfil, setSortCol,
    setSortDir, simularPerfil, somaPesos, sortArrow, sortCol, sortDir,
    tableScrollRef, tdS, todosControles, toggleSort, ultAtualArea,
  }

  return (
    <div style={PA.page}>
      <PorAreaTopo ctx={ctx} />

      <PorAreaFiltros ctx={ctx} />
      <PorAreaTabela ctx={ctx} />
      {modalRow && <ModalDetalhe row={modalRow} projeto={projeto} onClose={() => setModalRow(null)} onEditar={canEdit ? () => { setAtualizarRow(modalRow); setModalRow(null) } : undefined} />}
      {atualizarRow && <ModalAtualizar row={atualizarRow} onClose={() => setAtualizarRow(null)} onSaved={() => { setAtualizarRow(null); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} />}
      {modalNovoRisco && <ModalNovoRisco onClose={() => setModalNovoRisco(false)} onSaved={() => { setModalNovoRisco(false); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} areaFixa={area} />}
      {rowRegistrarResultado && <ModalRegistrarResultado row={rowRegistrarResultado} onClose={() => setRowRegistrarResultado(null)} onSaved={() => { setRowRegistrarResultado(null); if (projeto?.id) loadDados(projeto.id) }} responsaveis={[]} />}
      {rowCriticidade && <ModalRegistrarCriticidade row={rowCriticidade} onClose={() => setRowCriticidade(null)} onSaved={() => { setRowCriticidade(null); if (projeto?.id) loadDados(projeto.id) }} />}
      {rowRevisar && <ModalRevisar row={rowRevisar} onClose={() => setRowRevisar(null)} onAction={() => { setRowRevisar(null); if (projeto?.id) loadDados(projeto.id) }} />}
    </div>
  )
}

