import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useMemo } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import Configuracoes from './Configuracoes'
import Perfil from './Perfil'
import MRCCompleta, { ModalDetalhe } from '../components/MRCCompleta'
import ModalAtualizar from '../components/ModalAtualizar'
import ImportarMRC from '../components/ImportarMRC'
import {
  calcularPercentualArea,
  calcularIndiceEmpresa,
  getNivelMaturidade,
  PESO_FASE,
} from '../lib/calculoMaturidade'
import { exportarMRCExcel } from '../lib/exportMRC'

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════════════════════

const FASES_CORES = ['#00203E', '#1D3B5C', '#660033', '#660066', '#A6512F']
const FASES_PESOS = [10, 25, 25, 30, 10]
const FASES_NOMES = ['Diagnóstico Inicial', 'Planos de Ação e Aderência', 'Controles Internos', 'Auditoria Contínua', 'Auditoria Independente']

// Cores VIVAS da régua de maturidade
const NIVEL_CORES = { N1: '#DC2626', N2: '#EA580C', N3: '#EAB308', N4: '#16A34A', N5: '#15803D' }
// Cores semânticas (resultado)
const COR_EFETIVO = '#22C55E'
const COR_INEFETIVO = '#FACC15'
const COR_GAP = '#EF4444'
// Cores criticidade
const CRIT_CORES = ['#EF4444', '#F97316', '#EAB308', '#22C55E'] // 4=Crítico, 3=Significativo, 2=Moderado, 1=Baixo
const CRIT_LABELS = ['Crítico', 'Significativo', 'Moderado', 'Baixo']
// Impacto / Probabilidade labels
const IMP_LABELS = ['Crítico', 'Alto', 'Moderado', 'Baixo']
const PROB_LABELS = ['Extrema', 'Alta', 'Média', 'Baixa']
// Heatmap cell colors: criticidade resultante [impacto][probabilidade]
const HEAT_CORES = [
  ['#EF4444', '#EF4444', '#F97316', '#EAB308'],
  ['#EF4444', '#F97316', '#EAB308', '#EAB308'],
  ['#F97316', '#EAB308', '#EAB308', '#22C55E'],
  ['#EAB308', '#22C55E', '#22C55E', '#22C55E'],
]

function getCorNivel(pct) {
  if (pct >= 0.81) return NIVEL_CORES.N5
  if (pct >= 0.51) return NIVEL_CORES.N4
  if (pct >= 0.26) return NIVEL_CORES.N3
  if (pct >= 0.11) return NIVEL_CORES.N2
  return NIVEL_CORES.N1
}

function getBarGradient(pct100) {
  const stops = [
    [0, '#DC2626'], [10, '#EF4444'], [25, '#EA580C'], [40, '#F97316'],
    [50, '#EAB308'], [65, '#84CC16'], [80, '#22C55E'], [100, '#15803D'],
  ]
  const relevant = stops.filter(([p]) => p <= pct100)
  if (relevant.length === 0) return '#DC2626'
  const gradStops = relevant.map(([p, c]) => {
    const norm = pct100 > 0 ? (p / pct100) * 100 : 0
    return `${c} ${norm.toFixed(0)}%`
  })
  return `linear-gradient(90deg, ${gradStops.join(', ')})`
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function getFaseAtual(c) {
  if (c.r3 && c.r3 !== 'Teste Não Realizado') return 3
  if (c.r_ader && c.r_ader !== 'Teste Não Realizado') return 2
  if (c.st_pa && c.st_pa !== '') return 2
  if (c.r1 && c.r1 !== 'Teste Não Realizado') return 1
  return 1
}
function isEfetivo(r) { return (r || '').toLowerCase() === 'efetivo' }
function isInefetivo(r) { return (r || '').toLowerCase() === 'inefetivo' }
function isGap(r) { const v = (r || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }
function precisaPlanoAcao(c) { return isInefetivo(c.r1) || isGap(c.r1) || isInefetivo(c.r_ader) || isGap(c.r_ader) || isInefetivo(c.r3) || isGap(c.r3) }
function planoAcaoConcluido(c) { const st = (c.st_pa || '').toLowerCase(); return st === 'efetivo' || st === 'concluído' || st === 'concluido' || st === 'ok' }

function calcKpisPorFase(controles) {
  const k = { controles: [0,0,0,0,0,0], efetivos: [0,0,0,0,0,0], inefetivos: [0,0,0,0,0,0], gap: [0,0,0,0,0,0], planos: [0,0,0,0,0,0] }
  controles.forEach(c => {
    const f = getFaseAtual(c) - 1
    k.controles[f]++; k.controles[5]++
    const r = f === 0 ? c.r1 : f === 1 ? (c.r_ader || c.st_pa || c.r1) : c.r3 || c.r1
    if (isEfetivo(r)) { k.efetivos[f]++; k.efetivos[5]++ }
    else if (isInefetivo(r)) { k.inefetivos[f]++; k.inefetivos[5]++ }
    else if (isGap(r)) { k.gap[f]++; k.gap[5]++ }
    if (precisaPlanoAcao(c) && !planoAcaoConcluido(c)) { k.planos[f]++; k.planos[5]++ }
  })
  return k
}

function getUltimaAtualizacao(controles) {
  let max = null
  controles.forEach(c => {
    const d = c.dt_ult || c.atualizado_em || c.criado_em
    if (d) { const dt = new Date(d); if (!isNaN(dt) && (!max || dt > max)) max = dt }
  })
  return max ? max.toLocaleDateString('pt-BR') : '—'
}

// Mapeia imp/prob string para index (0=mais grave)
function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[(v || '')] ?? -1 }
function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[(v || '')] ?? -1 }
// crit integer to idx: 4→0 (Crítico), 3→1, 2→2, 1→3 (Baixo)
function critToIdx(c) { return Math.max(0, Math.min(3, 4 - (c || 1))) }

// ══════════════════════════════════════════════════════════════════════════════
// SHELL
// ══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [projetos, setProjetos] = useState([])
  const [projetoAtivo, setProjetoAtivo] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [areasCalc, setAreasCalc] = useState([])
  const [todosControles, setTodosControles] = useState([])
  const [loading, setLoading] = useState(true)
  const [areaExpanded, setAreaExpanded] = useState(true)

  useEffect(() => { loadProjetos() }, [])

  async function loadProjetos() {
    const { data } = await supabase.from('projetos').select('*, clientes(nome, slug)').eq('ativo', true).order('criado_em', { ascending: false })
    if (data) { setProjetos(data); if (data.length > 0) setProjetoAtivo(data[0]) }
  }

  useEffect(() => { if (projetoAtivo?.id) loadDados(projetoAtivo.id) }, [projetoAtivo])

  async function loadDados(pid) {
    setLoading(true)
    const { data: ad } = await supabase.from('areas').select('id, nome, prefixo, peso, gerente, ordem').eq('projeto_id', pid).order('ordem')
    const { data: md } = await supabase.from('mrc').select('*').eq('projeto_id', pid).neq('ativo', false)
    const controles = md || [], areas = ad || []
    const res = areas.map(a => {
      const ca = controles.filter(c => c.area_id === a.id || c.area === a.nome)
      const f1c = ca.length > 0 && ca.every(c => c.r1 && c.r1 !== 'Teste Não Realizado')
      return { ...a, controles: ca, calc: calcularPercentualArea(ca, f1c) }
    })
    setAreasCalc(res); setTodosControles(controles); setLoading(false)
  }

  const isAdmin = perfil?.papel === 'admin_polimata'
  const sw = sidebarOpen ? 240 : 56
  const ultimaAtualizacao = useMemo(() => getUltimaAtualizacao(todosControles), [todosControles])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{ width: sw, minWidth: sw, background: 'var(--bg1)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .25s ease, min-width .25s ease' }}>
        <div style={{ padding: sidebarOpen ? '12px' : '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--brd)', minHeight: 56 }}>
          {sidebarOpen
            ? <img src="/logotipo-2cores.png" alt="Polímata" style={{ width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain' }} />
            : <img src="/logotipo-2cores.png" alt="P" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
        </div>
        {sidebarOpen && projetos.length > 0 && (
          <div className="sb-projeto">
            <div className="sb-projeto-label">Projeto ativo</div>
            <select className="sb-projeto-sel" value={projetoAtivo?.id || ''} onChange={e => setProjetoAtivo(projetos.find(p => p.id === e.target.value))}>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.clientes?.nome} · {p.nome}</option>)}
            </select>
          </div>
        )}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sidebarOpen && <div className="sb-sep">Dashboards</div>}
          <SideNavItem icon="📊" label="Dashboard" active={location.pathname === '/'} onClick={() => navigate('/')} open={sidebarOpen} />
          {sidebarOpen && (
            <div className="sb-sep" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setAreaExpanded(x => !x)}>
              Por Área <span style={{ fontSize: 10 }}>{areaExpanded ? '▾' : '▸'}</span>
            </div>
          )}
          {sidebarOpen && areaExpanded && areasCalc.map(a => (
            <button key={a.id} className={`nav-item${location.pathname === '/area/' + a.id ? ' active' : ''}`}
              onClick={() => navigate('/area/' + a.id)}
              style={{ padding: '5px 16px 5px 28px', fontSize: 11, gap: 6 }}>
              <span style={{ fontSize: 10 }}>›</span> {a.nome}
            </button>
          ))}
          {sidebarOpen && <div className="sb-sep">Operação</div>}
          <SideNavItem icon="📋" label="MRC Completa" active={location.pathname === '/mrc'} onClick={() => navigate('/mrc')} open={sidebarOpen}
            badge={todosControles.length > 0 ? todosControles.length : null} />
          {isAdmin && (<>{sidebarOpen && <div className="sb-sep">Administração</div>}
            <SideNavItem icon="⚙️" label="Configurações" active={location.pathname.startsWith('/configuracoes')} onClick={() => navigate('/configuracoes')} open={sidebarOpen} />
            <SideNavItem icon="📥" label="Importar MRC" active={location.pathname === '/importar-mrc'} onClick={() => navigate('/importar-mrc')} open={sidebarOpen} /></>)}
        </nav>
        <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'transparent', border: 'none', borderTop: '1px solid var(--brd)', color: 'var(--txt3)', padding: '10px', cursor: 'pointer', fontSize: 14, textAlign: 'center' }}>
          {sidebarOpen ? '◂' : '▸'}
        </button>
        <div className="sb-footer">
          <div className="sb-user" style={{ cursor: 'pointer' }} onClick={() => navigate('/perfil')}>
            <div className="sb-user-avatar">
              {perfil?.avatar_url ? <img src={perfil.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : perfil?.nome?.[0]?.toUpperCase() || '?'}
            </div>
            {sidebarOpen && <div><div className="sb-user-nome">{perfil?.nome}</div><div className="sb-user-papel">{papelLabel(perfil?.papel)}</div></div>}
          </div>
          {sidebarOpen && <button className="sb-sair" onClick={signOut} title="Sair">↩</button>}
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg0)' }}>
        <Routes>
          <Route path="/" element={<HomeDash projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} ultimaAtualizacao={ultimaAtualizacao} />} />
          <Route path="/area/:areaId" element={<PorArea projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} navigate={navigate} loadDados={loadDados} />} />
          <Route path="/mrc" element={<MRCCompleta projetoId={projetoAtivo?.id} clienteNome={projetoAtivo?.clientes?.nome || ''} projetoNome={projetoAtivo?.nome || ''} />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
          <Route path="/importar-mrc" element={<ImportarMRC projetoId={projetoAtivo?.id} areas={areasCalc} onImported={() => { if (projetoAtivo?.id) loadDados(projetoAtivo.id) }} />} />
          <Route path="/perfil" element={<Perfil />} />
        </Routes>
      </main>
    </div>
  )
}

function SideNavItem({ icon, label, active, onClick, open, badge }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} style={open ? {} : { justifyContent: 'center', padding: '9px 0' }} title={open ? undefined : label}>
      <span className="nav-icon">{icon}</span>
      {open && <span>{label}</span>}
      {open && badge && <span style={{ marginLeft: 'auto', fontSize: 9, background: 'rgba(204,145,94,.15)', padding: '1px 6px', borderRadius: 8, color: 'var(--gold)' }}>{badge}</span>}
    </button>
  )
}
function papelLabel(p) { return { admin_polimata: 'Admin Polímata', consultor_polimata: 'Consultor', gestor_cliente: 'Gestor', usuario_cliente: 'Usuário' }[p] || p || '—' }

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTILHADOS
// ══════════════════════════════════════════════════════════════════════════════

function NivelBadge({ pct, nivel }) {
  return <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: getCorNivel(pct), padding: '2px 8px', borderRadius: 3, marginTop: 3, textTransform: 'uppercase', display: 'inline-block' }}>{nivel.nivel} — {nivel.nome}</div>
}

function Spinner() { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#00112C' }}><div className="spinner" /></div> }
function NoProjeto() { return <div style={{ background: '#00112C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}><div style={{ fontSize: 48, opacity: 0.3 }}>📊</div><div style={{ fontSize: 15, fontWeight: 600, color: '#F3EEE4' }}>Nenhum projeto ativo</div></div> }

// ══════════════════════════════════════════════════════════════════════════════
// TELA 1 — DASHBOARD (REDESIGN v7)
// ══════════════════════════════════════════════════════════════════════════════

function HomeDash({ projeto, areasCalc, todosControles, loading, ultimaAtualizacao }) {
  const navigate = useNavigate()
  const [areaFiltro, setAreaFiltro] = useState(null)

  const empresa = useMemo(() => calcularIndiceEmpresa(areasCalc.map(a => ({ nome: a.nome, peso: a.peso || 0, percentual: a.calc?.percentual || 0 }))), [areasCalc])
  const ranking = useMemo(() => [...areasCalc].filter(a => a.controles.length > 0).sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0)), [areasCalc])

  const kpis = useMemo(() => {
    let ef = 0, inf = 0, gap = 0, pa = 0
    todosControles.forEach(c => {
      if (isEfetivo(c.r1)) ef++
      else if (isInefetivo(c.r1)) inf++
      else if (isGap(c.r1)) gap++
      if (precisaPlanoAcao(c) && !planoAcaoConcluido(c)) pa++
    })
    return { ef, inf, gap, pa }
  }, [todosControles])

  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
    const controles = areaFiltro
      ? todosControles.filter(c => {
          const area = areasCalc.find(a => a.nome === areaFiltro)
          return area && (c.area_id === area.id || c.area === area.nome)
        })
      : todosControles
    controles.forEach(c => {
      const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
      if (ri >= 0 && ci >= 0) grid[ri][ci]++
    })
    return grid
  }, [todosControles, areasCalc, areaFiltro])

  const critPorArea = useMemo(() => {
    return ranking.map(a => {
      const cr = [0, 0, 0, 0]
      a.controles.forEach(c => { cr[critToIdx(c.crit)]++ })
      return { nome: a.nome, crit: cr, total: a.controles.length }
    })
  }, [ranking])

  const critTotais = useMemo(() => {
    const t = [0, 0, 0, 0]
    critPorArea.forEach(a => a.crit.forEach((v, i) => t[i] += v))
    return t
  }, [critPorArea])

  const nivelEmpresa = getNivelMaturidade(empresa.indice)
  const clienteNome = projeto?.clientes?.nome || 'Cliente'

  function toggleAreaFiltro(nome) {
    setAreaFiltro(prev => prev === nome ? null : nome)
  }

  if (loading) return <Spinner />
  if (!projeto) return <NoProjeto />

  const D = dashStyles

  return (
    <div style={D.page}>
      <div style={{ ...D.header, position: 'relative' }}>
        <div style={D.headerCliente}>{clienteNome} · {projeto.nome || 'Controles Internos'}</div>
        <div style={D.headerTitulo}>Maturidade do Ambiente de Controles Internos</div>
        <div style={D.headerSub}>Visão consolidada · {areasCalc.length} áreas · {todosControles.length} controles · Metodologia Polímata</div>
        <div style={{ position: 'absolute', top: 14, right: 0, fontSize: 10, color: 'rgba(243,238,228,0.5)', fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 10px' }}>Última atualização: {ultimaAtualizacao}</div>
      </div>

      <div style={D.kpiRow}>
        <div style={{ ...D.kpiCard, borderTopColor: '#CC915E' }}>
          <div style={D.kpiLabel}>Índice de Maturidade Consolidado · {clienteNome}</div>
          <div style={{ ...D.kpiValor, color: '#CC915E' }}>{(empresa.indice * 100).toFixed(1)}%</div>
          <div><span style={{ ...D.kpiBadge, background: getCorNivel(empresa.indice) }}>{nivelEmpresa.nivel}</span> <span style={{ fontSize: 9, color: 'rgba(243,238,228,0.35)' }}>{nivelEmpresa.nome}</span></div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: '#F3EEE4' }}>
          <div style={D.kpiLabel}>Total de Controles</div>
          <div style={{ ...D.kpiValor, color: '#F3EEE4' }}>{todosControles.length}</div>
          <div style={D.kpiSub}>{areasCalc.length} áreas · Metodologia Polímata</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: COR_EFETIVO }}>
          <div style={D.kpiLabel}>Efetivos</div>
          <div style={{ ...D.kpiValor, color: COR_EFETIVO }}>{kpis.ef}</div>
          <div style={D.kpiSub}>{todosControles.length > 0 ? Math.round(kpis.ef / todosControles.length * 100) : 0}% do total</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: COR_INEFETIVO }}>
          <div style={D.kpiLabel}>Inefetivos</div>
          <div style={{ ...D.kpiValor, color: COR_INEFETIVO }}>{kpis.inf}</div>
          <div style={D.kpiSub}>Aguardam ação corretiva</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: COR_GAP }}>
          <div style={D.kpiLabel}>GAP</div>
          <div style={{ ...D.kpiValor, color: COR_GAP }}>{kpis.gap}</div>
          <div style={D.kpiSub}>Riscos sem controle identificado</div>
        </div>
        <div style={{ ...D.kpiCard, borderTop: 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #CC915E, #A6512F)' }} />
          <div style={D.kpiLabel}>Planos de Ação</div>
          <div style={{ ...D.kpiValor, color: '#CC915E' }}>{kpis.pa}</div>
          <div style={D.kpiSub}>Em desenvolvimento</div>
        </div>
      </div>

      <div style={D.cardDark}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={D.cardTitle}>Maturidade por Área</div>
          {areaFiltro && <button onClick={() => setAreaFiltro(null)} style={D.limparFiltro}>✕ Limpar filtro: {areaFiltro}</button>}
        </div>
        <div style={D.areaList}>
          {ranking.map((a, i) => {
            const p = (a.calc?.percentual || 0) * 100
            const nv = getNivelMaturidade(a.calc?.percentual || 0)
            return (
              <div key={a.id} onClick={() => navigate('/area/' + a.id)} style={{ ...D.areaRow, background: 'transparent', cursor: 'pointer', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <span style={D.areaRank}>{i + 1}</span>
                <span style={D.areaNome}>{a.nome}</span>
                <div style={D.areaBarWrap}>
                  <div style={{ ...D.areaBar, width: `${p}%`, background: getBarGradient(p) }} />
                </div>
                <span style={D.areaPct}>{p.toFixed(1)}%</span>
                <span style={{ ...D.nivelBadge, background: NIVEL_CORES[nv.nivel] || '#EAB308' }}>{nv.nivel}</span>
              </div>
            )
          })}
          {ranking.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'rgba(243,238,228,0.3)' }}>Sem dados cadastrados.</div>}
        </div>
      </div>

      <div style={D.zonaInferior}>
        <div style={{ ...D.cardDark, flex: 4, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={D.cardTitle}>
            Mapa de Calor — Impacto × Probabilidade
            {areaFiltro && <span style={{ fontWeight: 400, color: '#CC915E', marginLeft: 8 }}>({areaFiltro})</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', flex: 1 }}>
              <div style={D.heatYLabels}>
                {IMP_LABELS.map(l => <div key={l} style={D.heatYLabel}>{l}</div>)}
              </div>
              <div style={D.heatBody}>
                {heatmapData.map((row, ri) => (
                  <div key={ri} style={D.heatRow}>
                    {row.map((val, ci) => (
                      <div key={ci} style={{ ...D.heatCell, background: val === 0 ? 'rgba(255,255,255,0.04)' : HEAT_CORES[ri][ci] }}>
                        {val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div style={D.heatXLabels}>
              {PROB_LABELS.map(l => <div key={l} style={D.heatXLabel}>{l}</div>)}
            </div>
            <div style={{ textAlign: 'center', marginTop: 2, fontSize: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(243,238,228,0.25)' }}>Probabilidade →</div>
          </div>
          <div style={D.heatLegend}>
            {CRIT_LABELS.map((l, i) => (
              <div key={l} style={D.legendItem}>
                <div style={{ ...D.legendDot, background: CRIT_CORES[i] }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...D.cardDark, flex: 5, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={D.cardTitle}>Riscos por Área × Criticidade</div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  <th style={{ ...D.critTh, textAlign: 'left' }}>Área</th>
                  {CRIT_LABELS.map((l, i) => <th key={l} style={{ ...D.critTh, color: CRIT_CORES[i], minWidth: 60 }}>{l}</th>)}
                  <th style={{ ...D.critTh, color: 'rgba(243,238,228,0.5)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {critPorArea.map(a => {
                  const ativo = areaFiltro === a.nome
                  return (
                    <tr key={a.nome} onClick={() => toggleAreaFiltro(a.nome)} style={{ cursor: 'pointer', background: ativo ? 'rgba(204,145,94,0.08)' : 'transparent' }}
                      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = 'rgba(204,145,94,0.04)' }}
                      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = '' }}>
                      <td style={D.critTdArea}>{a.nome}</td>
                      {a.crit.map((v, i) => <td key={i} style={{ ...D.critTdNum, color: v > 0 ? CRIT_CORES[i] : 'rgba(243,238,228,0.15)' }}>{v}</td>)}
                      <td style={D.critTdTotal}>{a.total}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...D.critTfoot, textAlign: 'left' }}>TOTAL</td>
                  {critTotais.map((v, i) => <td key={i} style={{ ...D.critTfoot, color: CRIT_CORES[i] }}>{v}</td>)}
                  <td style={D.critTfoot}>{todosControles.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS DASHBOARD (tema escuro)
// ══════════════════════════════════════════════════════════════════════════════

const dashStyles = {
  page: { background: '#00112C', minHeight: '100vh', padding: '0 20px 12px', fontFamily: "'Montserrat', sans-serif", color: '#F3EEE4', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '14px 0 4px', flexShrink: 0 },
  headerCliente: { fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#CC915E' },
  headerTitulo: { fontSize: 20, fontWeight: 300, color: '#F3EEE4', marginTop: 2 },
  headerSub: { fontSize: 10, fontWeight: 400, color: 'rgba(243,238,228,0.4)', marginTop: 2 },
  kpiRow: { display: 'flex', gap: 8, flexShrink: 0, margin: '8px 0' },
  kpiCard: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px', borderTop: '3px solid' },
  kpiLabel: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(243,238,228,0.45)', marginBottom: 5 },
  kpiValor: { fontSize: 26, fontWeight: 300, lineHeight: 1 },
  kpiSub: { fontSize: 9, color: 'rgba(243,238,228,0.3)', marginTop: 4 },
  kpiBadge: { display: 'inline-block', fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 3, color: '#fff' },
  cardDark: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, flexShrink: 0 },
  cardTitle: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(243,238,228,0.4)', marginBottom: 10 },
  limparFiltro: { background: 'rgba(204,145,94,0.15)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 4, padding: '3px 10px', fontSize: 9, fontWeight: 600, color: '#CC915E', cursor: 'pointer', fontFamily: 'inherit' },
  areaList: { maxHeight: 340, overflowY: 'auto', paddingRight: 4 },
  areaRow: { display: 'flex', alignItems: 'center', padding: '6px 4px', gap: 10, borderRadius: 4, transition: 'background .15s' },
  areaRank: { fontSize: 10, fontWeight: 500, color: 'rgba(243,238,228,0.25)', width: 18, textAlign: 'right', flexShrink: 0 },
  areaNome: { fontSize: 11, fontWeight: 500, color: '#F3EEE4', width: 180, flexShrink: 0 },
  areaBarWrap: { flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  areaBar: { height: '100%', borderRadius: 4, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' },
  areaPct: { fontSize: 12, fontWeight: 600, color: '#F3EEE4', width: 50, textAlign: 'right', flexShrink: 0 },
  nivelBadge: { fontSize: 9, fontWeight: 700, color: '#fff', padding: '2px 7px', borderRadius: 4, flexShrink: 0, minWidth: 28, textAlign: 'center' },
  zonaInferior: { display: 'flex', gap: 8, flex: 1, minHeight: 0, overflow: 'hidden' },
  heatYLabels: { display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 8, width: 70, flexShrink: 0 },
  heatYLabel: { fontSize: 9, fontWeight: 600, color: 'rgba(243,238,228,0.5)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  heatBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  heatRow: { display: 'flex', gap: 3, flex: 1 },
  heatCell: { flex: 1, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', minHeight: 50, transition: 'transform .15s', cursor: 'default' },
  heatXLabels: { display: 'flex', paddingLeft: 78, paddingTop: 6, gap: 3 },
  heatXLabel: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'rgba(243,238,228,0.5)' },
  heatLegend: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'rgba(243,238,228,0.45)' },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  critTh: { padding: '6px 8px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', position: 'sticky', top: 0, zIndex: 2, background: 'rgba(0,17,44,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  critTdArea: { padding: '5px 8px', fontSize: 10, fontWeight: 500, color: '#F3EEE4', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' },
  critTdNum: { padding: '5px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  critTdTotal: { padding: '5px 8px', fontSize: 11, fontWeight: 600, color: 'rgba(243,238,228,0.5)', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  critTfoot: { padding: '8px', fontSize: 10, fontWeight: 700, textAlign: 'center', color: 'rgba(243,238,228,0.6)', borderTop: '1px solid rgba(255,255,255,0.1)' },
}

// ══════════════════════════════════════════════════════════════════════════════
// TELA 2 — POR ÁREA (REDESIGN v2 — TEMA ESCURO + HEATMAP + KPI GRID)
// ══════════════════════════════════════════════════════════════════════════════

function PorArea({ projeto, areasCalc, todosControles, loading, navigate, loadDados }) {
  const { areaId } = useParams()
  const { perfil } = useAuth()
  const area = areasCalc.find(a => a.id === areaId)
  const nome = area?.nome || ''
  const [busca, setBusca] = useState('')
  const [filtCrit, setFiltCrit] = useState('')
  const [filtImp, setFiltImp] = useState('')
  const [filtRes, setFiltRes] = useState('')
  const [modalRow, setModalRow] = useState(null)
  const [atualizarRow, setAtualizarRow] = useState(null)
  const canEdit = perfil?.papel === 'admin_polimata' || perfil?.papel === 'consultor_polimata'

  if (loading) return <Spinner />
  if (!projeto) return <NoProjeto />
  if (!area) return <div style={{ background: '#00112C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, fontFamily: "'Montserrat', sans-serif" }}><div style={{ color: 'rgba(243,238,228,0.4)' }}>Área não encontrada.</div><button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 4, border: '1px solid rgba(243,238,228,0.1)', background: 'rgba(255,255,255,0.05)', color: '#F3EEE4', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>← Voltar</button></div>

  const somaPesos = areasCalc.reduce((s, a) => s + (a.peso||0), 0)
  const pesoEmpresa = somaPesos > 0 ? ((area.peso||0)/somaPesos*100).toFixed(1) : '0'
  const p = area.calc?.percentual||0, nv = getNivelMaturidade(p)
  let efetivos=0, inefetivos=0, gaps=0, planosAcao=0
  area.controles.forEach(c => {
    if (isEfetivo(c.r1)) efetivos++
    else if (isInefetivo(c.r1)) inefetivos++
    else if (isGap(c.r1)) gaps++
    if (precisaPlanoAcao(c) && !planoAcaoConcluido(c)) planosAcao++
  })

  const ultAtualArea = useMemo(() => getUltimaAtualizacao(area.controles), [area.controles])

  // Heatmap da área
  const areaHeatmap = useMemo(() => {
    const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
    area.controles.forEach(c => {
      const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
      if (ri >= 0 && ci >= 0) grid[ri][ci]++
    })
    return grid
  }, [area.controles])

  const cf = area.controles.filter(c => {
    if (busca) { const b = busca.toLowerCase(); if (![c.rr,c.rc,c.dr,c.dc,c.incons,c.rec].some(f => (f||'').toLowerCase().includes(b))) return false }
    if (filtCrit && String(c.crit_label||c.crit||'') !== filtCrit) return false
    if (filtImp && String(c.imp||'') !== filtImp) return false
    if (filtRes && String(c.r1||'') !== filtRes) return false
    return true
  })

  const crits = [...new Set(area.controles.map(c => String(c.crit_label||'')).filter(v => v))].sort()
  const imps = [...new Set(area.controles.map(c => String(c.imp||'')).filter(v => v))].sort()
  const ress = [...new Set(area.controles.map(c => String(c.r1||'')).filter(v => v))].sort()

  function faseLabel(c) {
    if (c.r3 && c.r3 !== 'Teste Não Realizado') return { f: 'F3 — Revisão', s: c.r3 }
    if (c.r_ader && c.r_ader !== 'Teste Não Realizado') return { f: 'F2-E2 — Teste de Aderência', s: c.r_ader }
    if (c.st_pa && c.st_pa !== '') return { f: 'F2-E1 — Plano de Ação', s: c.st_pa }
    if (c.r1 && c.r1 !== 'Teste Não Realizado') return { f: 'F2-E2 — Teste de Aderência', s: 'Teste Não Realizado' }
    return { f: 'F1 — Diagnóstico', s: 'Teste Não Realizado' }
  }

  // Badge helpers (tema escuro)
  const bdgS = { display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600 }
  function badgeR(r) {
    if (!r || r === 'Teste Não Realizado') return <span style={{ ...bdgS, background: 'rgba(255,255,255,0.04)', color: 'rgba(243,238,228,0.3)' }}>{r||'—'}</span>
    if (isEfetivo(r)) return <span style={{ ...bdgS, background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>Efetivo</span>
    if (isInefetivo(r)) return <span style={{ ...bdgS, background: 'rgba(250,204,21,0.12)', color: '#FACC15' }}>Inefetivo</span>
    if (isGap(r)) return <span style={{ ...bdgS, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>GAP</span>
    return <span style={{ ...bdgS, background: 'rgba(255,255,255,0.04)', color: 'rgba(243,238,228,0.3)' }}>{r}</span>
  }
  const IMP_C = { Crítico: { bg: 'rgba(239,68,68,0.12)', c: '#EF4444' }, Alto: { bg: 'rgba(249,115,22,0.12)', c: '#F97316' }, Moderado: { bg: 'rgba(234,179,8,0.12)', c: '#EAB308' }, Baixo: { bg: 'rgba(34,197,94,0.12)', c: '#22C55E' } }
  const PRB_C = { Extrema: { bg: 'rgba(239,68,68,0.12)', c: '#EF4444' }, Alta: { bg: 'rgba(249,115,22,0.12)', c: '#F97316' }, Média: { bg: 'rgba(234,179,8,0.12)', c: '#EAB308' }, Baixa: { bg: 'rgba(34,197,94,0.12)', c: '#22C55E' } }
  const CRT_C = { 4: { bg: 'rgba(239,68,68,0.12)', c: '#EF4444', l: '4. Crítico' }, 3: { bg: 'rgba(249,115,22,0.12)', c: '#F97316', l: '3. Significativo' }, 2: { bg: 'rgba(234,179,8,0.12)', c: '#EAB308', l: '2. Moderado' }, 1: { bg: 'rgba(34,197,94,0.12)', c: '#22C55E', l: '1. Baixo' } }
  function badgeImp(v) { const m = IMP_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}>{v}</span> : <span style={{ ...bdgS, background: 'rgba(255,255,255,0.04)', color: 'rgba(243,238,228,0.3)' }}>{v||'—'}</span> }
  function badgeProb(v) { const m = PRB_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}>{v}</span> : <span style={{ ...bdgS, background: 'rgba(255,255,255,0.04)', color: 'rgba(243,238,228,0.3)' }}>{v||'—'}</span> }
  function badgeCrit(v) { const m = CRT_C[v]; return m ? <span style={{ ...bdgS, background: m.bg, color: m.c }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />{m.l}</span> : <span style={{ ...bdgS, background: 'rgba(255,255,255,0.04)', color: 'rgba(243,238,228,0.3)' }}>{v||'—'}</span> }

  const PA = paStyles
  const tdS = { padding: '7px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(243,238,228,0.7)', whiteSpace: 'nowrap', verticalAlign: 'top' }
  function Td({ children, w = 150 }) { return <td style={{ ...tdS, width: w, minWidth: w, maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children || '—'}</td> }

  return (
    <div style={PA.page}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 6px', flexShrink: 0, position: 'relative' }}>
        <button onClick={() => navigate('/')} style={PA.btnVoltar}>← VOLTAR</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#F3EEE4' }}>{nome}</div>
          <div style={{ fontSize: 10, color: 'rgba(243,238,228,0.35)', marginTop: 1 }}>{area.controles.length} controles · Peso empresa: {pesoEmpresa}%</div>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 0, fontSize: 10, color: 'rgba(243,238,228,0.5)', fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 10px' }}>Última atualização: {ultAtualArea}</div>
      </div>

      {/* ZONA SUPERIOR — HEATMAP + KPI GRID */}
      <div style={PA.zonaSuperior}>
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
                    <div key={ci} style={{ ...PA.heatCell, background: val === 0 ? 'rgba(255,255,255,0.04)' : HEAT_CORES[ri][ci] }}>
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
          <div style={{ textAlign: 'center', marginTop: 1, fontSize: 7, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(243,238,228,0.2)' }}>Probabilidade →</div>
          <div style={PA.heatLegend}>
            {CRIT_LABELS.map((l, i) => (
              <div key={l} style={PA.legendItem}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CRIT_CORES[i] }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* KPI GRID 3×2 */}
        <div style={PA.kpiGrid}>
          <div style={{ ...PA.kpiCard, borderTopColor: '#CC915E' }}>
            <div style={PA.kpiLabel}>Maturidade</div>
            <div style={{ ...PA.kpiValor, color: '#CC915E' }}>{(p*100).toFixed(1)}%</div>
            <NivelBadge pct={p} nivel={nv} />
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#F3EEE4' }}>
            <div style={PA.kpiLabel}>Total de Controles</div>
            <div style={{ ...PA.kpiValor, color: '#F3EEE4' }}>{area.controles.length}</div>
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
            <div style={{ ...PA.kpiValor, color: '#CC915E' }}>{planosAcao}</div>
            <div style={PA.kpiSub}>Em desenvolvimento</div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', marginBottom: 6 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar risco, controle, inconsistência..." style={PA.filtroInput} />
        <select value={filtCrit} onChange={e => setFiltCrit(e.target.value)} style={PA.filtroSel}><option value="">Todas criticidades</option>{crits.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={filtImp} onChange={e => setFiltImp(e.target.value)} style={PA.filtroSel}><option value="">Todos impactos</option>{imps.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={filtRes} onChange={e => setFiltRes(e.target.value)} style={PA.filtroSel}><option value="">Todos resultados F1</option>{ress.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <div style={{ fontSize: 10, color: 'rgba(243,238,228,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '5px 10px' }}>{cf.length} controles</div>
        <button onClick={() => exportarMRCExcel(cf, `MRC_${nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}`, nome, projeto?.clientes?.nome || '', projeto?.nome || '')} style={PA.btnExport} title="Exportar Excel da área">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          Excel
        </button>
      </div>

      {/* TABELA MRC */}
      <div style={PA.tabelaWrap}>
        <div style={{ flex: 1, overflowX: 'scroll', overflowY: 'auto', minHeight: 0 }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {[
                { h: 'Data Últ. Atual.', w: 100 }, { h: 'Gerência', w: 120 }, { h: 'Resp. Subproc.', w: 120 },
                { h: 'Processo', w: 140 }, { h: 'Subprocesso', w: 120 }, { h: 'Ref. Risco', w: 80 },
                { h: 'Desc. Risco', w: 200 }, { h: 'Ref. Controle', w: 90 }, { h: 'Desc. Controle', w: 200 },
                { h: 'Categoria', w: 110 }, { h: 'Frequência', w: 90 }, { h: 'Natureza', w: 80 },
                { h: 'Caract.', w: 80 }, { h: 'Sistema', w: 80 }, { h: 'Ctrl Chave?', w: 80 },
                { h: 'Passos Teste', w: 180 }, { h: 'Resultado', w: 80 }, { h: 'Desc. Inconsist.', w: 180 },
                { h: 'Recomendação', w: 180 }, { h: 'Impacto', w: 80 }, { h: 'Probab.', w: 80 },
                { h: 'Criticidade', w: 100 }, { h: 'Fase Atual', w: 160 },
              ].map((col, i) =>
                <th key={i} style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#F3EEE4', background: '#00203E', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, width: col.w, minWidth: col.w }}>{col.h}</th>)}
              <th style={{ fontSize: 8, fontWeight: 700, color: '#F3EEE4', background: '#00203E', padding: '6px 8px', position: 'sticky', top: 0, zIndex: 2, width: 70, minWidth: 70 }}></th>
            </tr></thead>
            <tbody>{cf.map((c, i) => { const fl = faseLabel(c); return (
              <tr key={c.id||i} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <Td w={100}>{c.dt_ult || '—'}</Td>
                <Td w={120}>{c.ger}</Td><Td w={120}>{c.resp_sub}</Td><Td w={140}>{c.area}</Td><Td w={120}>{c.sub}</Td>
                <td style={{ ...tdS, color: '#CC915E', fontWeight: 600, width: 80, minWidth: 80 }}>{c.rr}</td><Td w={200}>{c.dr}</Td>
                <td style={{ ...tdS, color: '#CC915E', fontWeight: 600, width: 90, minWidth: 90 }}>{c.rc}</td><Td w={200}>{c.dc}</Td>
                <Td w={110}>{c.cat}</Td><Td w={90}>{c.freq}</Td><Td w={80}>{c.nat}</Td><Td w={80}>{c.car}</Td><Td w={80}>{c.sis}</Td><Td w={80}>{c.chave}</Td>
                <Td w={180}>{c.passos_f1}</Td><td style={{ ...tdS, width: 80, minWidth: 80 }}>{badgeR(c.r1)}</td><Td w={180}>{c.incons}</Td><Td w={180}>{c.rec}</Td>
                <td style={{ ...tdS, width: 80, minWidth: 80 }}>{badgeImp(c.imp)}</td><td style={{ ...tdS, width: 80, minWidth: 80 }}>{badgeProb(c.prob)}</td><td style={{ ...tdS, width: 100, minWidth: 100 }}>{badgeCrit(c.crit)}</td>
                <td style={{ ...tdS, width: 160, minWidth: 160 }}><div style={{ fontSize: 10, fontWeight: 500, color: '#F3EEE4', borderLeft: '3px solid #CC915E', paddingLeft: 6, lineHeight: 1.3 }}>{fl.f}</div><div style={{ fontSize: 9, color: 'rgba(243,238,228,0.3)', paddingLeft: 9 }}>{fl.s}</div></td>
                <td style={{ ...tdS, textAlign: 'center', width: 70, minWidth: 70 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                    <button onClick={() => setModalRow(c)} style={{ background: 'rgba(243,238,228,0.06)', border: '1px solid rgba(243,238,228,0.1)', borderRadius: 3, padding: '2px 10px', fontSize: 10, fontWeight: 600, color: 'rgba(243,238,228,0.6)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Ver</button>
                    {canEdit && <button onClick={() => setAtualizarRow(c)} style={{ background: 'rgba(204,145,94,0.1)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 3, padding: '2px 10px', fontSize: 10, fontWeight: 600, color: '#CC915E', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Atualizar</button>}
                    {c.status_workflow === 'em_analise' && <span style={{ fontSize: 8, fontWeight: 700, color: '#CC915E', background: 'rgba(204,145,94,0.15)', padding: '1px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Em Análise</span>}
                    {c.status_workflow === 'teste_pendente' && <span style={{ fontSize: 8, fontWeight: 700, color: '#EAB308', background: 'rgba(234,179,8,0.15)', padding: '1px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Teste Pendente</span>}
                  </div>
                </td>
              </tr>)})}{cf.length === 0 && <tr><td colSpan={24} style={{ padding: 32, textAlign: 'center', color: 'rgba(243,238,228,0.3)' }}>Nenhum controle encontrado.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
      {atualizarRow && <ModalAtualizar row={atualizarRow} onClose={() => setAtualizarRow(null)} onSaved={() => { setAtualizarRow(null); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS POR ÁREA (tema escuro)
// ══════════════════════════════════════════════════════════════════════════════

const paStyles = {
  page: { background: '#00112C', height: '100vh', padding: '0 20px 12px', fontFamily: "'Montserrat', sans-serif", color: '#F3EEE4', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  btnVoltar: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(243,238,228,0.06)', border: '1px solid rgba(243,238,228,0.1)', borderRadius: 4, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: 'rgba(243,238,228,0.5)', cursor: 'pointer', fontFamily: 'inherit' },
  zonaSuperior: { display: 'flex', gap: 10, flexShrink: 0, margin: '6px 0 8px' },
  cardTitle: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(243,238,228,0.4)', marginBottom: 8 },
  heatCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column' },
  heatYLabels: { display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 6, width: 55, flexShrink: 0 },
  heatYLabel: { fontSize: 8, fontWeight: 600, color: 'rgba(243,238,228,0.45)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  heatGrid: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  heatRow: { display: 'flex', gap: 2, flex: 1 },
  heatCell: { flex: 1, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', minHeight: 36 },
  heatXLabels: { display: 'flex', paddingLeft: 61, paddingTop: 4, gap: 2 },
  heatXLabel: { flex: 1, textAlign: 'center', fontSize: 8, fontWeight: 600, color: 'rgba(243,238,228,0.45)' },
  heatLegend: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.04)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: 'rgba(243,238,228,0.4)' },
  kpiGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr', gap: 8 },
  kpiCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px', borderTop: '3px solid', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  kpiLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(243,238,228,0.45)', marginBottom: 4 },
  kpiValor: { fontSize: 28, fontWeight: 300, lineHeight: 1 },
  kpiSub: { fontSize: 10, color: 'rgba(243,238,228,0.3)', marginTop: 4 },
  filtroInput: { flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, outline: 'none', color: '#F3EEE4' },
  filtroSel: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '5px 8px', fontFamily: 'inherit', fontSize: 10, color: 'rgba(243,238,228,0.6)', cursor: 'pointer', outline: 'none' },
  btnExport: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(204,145,94,0.12)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 4, padding: '5px 10px', fontSize: 10, fontWeight: 600, color: '#CC915E', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' },
  tabelaWrap: { flex: 1, minHeight: 0, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS LEGADO (mantidos para compatibilidade MRC)
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  page: { background: '#F3EEE4', height: '100vh', padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", color: '#333', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' },
  header: { background: '#00203E', borderRadius: 6, padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerText: { fontSize: 13, fontWeight: 400, color: '#F3EEE4', fontFamily: "'Montserrat', sans-serif" },
  th: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: '#00203E', padding: '5px 4px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 2 },
  tdCenter: { padding: '4px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#00203E' },
}
