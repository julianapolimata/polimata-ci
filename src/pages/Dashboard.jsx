import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useMemo, useRef } from 'react'
import { getFaseNumero, getResultadoVitrine, getFaseLabel, getStatusComputado, getFaseDisplayOverride, normalizeFaseValue } from '../lib/fases'
import { formatNomeEmpresa } from '../lib/formatNome'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import Configuracoes from './Configuracoes'
import AdminPanel from './AdminPanel'
import Perfil from './Perfil'
import MRCCompleta, { ModalDetalhe } from '../components/MRCCompleta'
import ModalAtualizar from '../components/ModalAtualizar'
import ModalNovoRisco from '../components/ModalNovoRisco'
import ModalRegistrarResultado from '../components/ModalRegistrarResultado'
import ModalRevisar from '../components/ModalRevisar'
import NotificacoesPanel from '../components/NotificacoesPanel'
import ImportarMRC from '../components/ImportarMRC'
import Relatorios from './Relatorios'
import {
  calcularIndiceEmpresa,
  getNivelMaturidade,
  getTipoEntrega,
  calcularDiagnosticoProjeto,
} from '../lib/calculoMaturidade'
import { exportarMRCExcel } from '../lib/exportMRC'
import { gerarTemplateMRC } from '../lib/templateMRC'
import { getStatusConfig, canEditControl, canRegisterResult, isDevolvido, isAguardandoRevisao, STATUS, getProximaAcao, PROXIMA_ACAO_OPCOES } from '../lib/statusWorkflow'
import { carregarConstantes } from '../lib/constantesLoader'

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

function getFaseAtual(c) { return getFaseNumero(c) }
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
    const r = getResultadoVitrine(c)
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

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  // Rejeita datas claramente inválidas (Excel epoch 1899/1900, Unix epoch 1970)
  if (d.getFullYear() < 2000) return '—'
  return d.toLocaleDateString('pt-BR')
}

// Mapeia imp/prob string para index (0=mais grave)
function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[(v || '')] ?? -1 }
function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[(v || '')] ?? -1 }
// crit integer to idx: 4→0 (Crítico), 3→1, 2→2, 1→3 (Baixo)
function critToIdx(c) { return Math.max(0, Math.min(3, 4 - (c || 1))) }

// ══════════════════════════════════════════════════════════════════════════════
// SELETOR DE PROJETOS (tela pós-login)
// ══════════════════════════════════════════════════════════════════════════════

function ProjectSelector({ projetos, resumos, perfil, onSelect, signOut, onAdmin }) {
  const nome = perfil?.nome?.split(' ')[0] || ''
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #00112C 0%, #00203E 60%, #1D3B5C 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
      {/* Accent radial sutil — eco do login */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '60%', height: '140%', background: 'radial-gradient(ellipse at center, rgba(204,145,94,0.10) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(ellipse at center, rgba(91,143,249,0.06) 0%, transparent 55%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 720, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <img src="/logotipo-2cores.png" alt="Polímata GRC" style={{ height: 64, marginBottom: 28, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 26, fontWeight: 200, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif", letterSpacing: '.5px', margin: '0 0 8px' }}>
            Selecione um projeto
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(247,243,238,0.55)', margin: 0 }}>
            {nome ? `Bem-vindo(a), ${nome}` : 'Bem-vindo(a) ao Polímata GRC'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {projetos.map(p => {
            const r = resumos[p.id] || {}
            const clienteNome = formatNomeEmpresa(p.clientes?.nome_fantasia || p.clientes?.nome) || '—'
            const isAtivo = p.ativo !== false
            const mat = r.maturidade
            const isDiagP = r.isDiag === true
            const matColor = mat ? (mat.nivel === 'N5' ? '#22D4A0' : mat.nivel === 'N4' ? '#5B8FF9' : mat.nivel === 'N3' ? '#D4A030' : mat.nivel === 'N2' ? '#F97316' : '#EF4444') : (isDiagP ? '#CC915E' : null)
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p)}
                style={{
                  background: 'rgba(0,32,62,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(204,145,94,0.18)', borderRadius: 14,
                  padding: '22px 26px', cursor: 'pointer', transition: 'all .2s ease',
                  opacity: isAtivo ? 1 : 0.55, position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(204,145,94,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,17,44,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(204,145,94,0.18)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Linha de cor da maturidade no topo */}
                {matColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${matColor} 0%, ${matColor}88 60%, transparent 100%)` }} />}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Eyebrow: nome do projeto */}
                    <div style={{ fontSize: 10, color: 'var(--copper-soft)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: 6 }}>{p.nome}</div>
                    {/* Título: nome do cliente */}
                    <div style={{ fontSize: 22, fontWeight: 200, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif", letterSpacing: '.3px', lineHeight: 1.2 }}>{clienteNome}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 600, letterSpacing: 0.3,
                      background: isAtivo ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                      color: isAtivo ? '#4ADE80' : 'var(--txt3)',
                      border: `1px solid ${isAtivo ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      {isAtivo ? 'Ativo' : 'Concluído'}
                    </span>
                    {mat && !isDiagP && (
                      <span style={{
                        fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3,
                        background: `${matColor}22`, color: matColor, border: `1px solid ${matColor}55`,
                      }} title={mat.nome}>
                        {mat.nivel}
                      </span>
                    )}
                    {isDiagP && (
                      <span style={{
                        fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3,
                        background: 'rgba(204,145,94,0.15)', color: 'var(--copper)', border: '1px solid rgba(204,145,94,0.4)',
                      }} title="Diagnóstico Apenas (sem teste de efetividade)">
                        Diagnóstico
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 22, fontSize: 11, color: 'rgba(247,243,238,0.55)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span><strong style={{ color: 'var(--cream)', fontWeight: 500 }}>{r.totalControles ?? '—'}</strong> controles</span>
                  <span><strong style={{ color: 'var(--cream)', fontWeight: 500 }}>{r.totalAreas ?? '—'}</strong> áreas</span>
                  {mat && !isDiagP && <span>Maturidade <strong style={{ color: matColor, fontWeight: 600 }}>{mat.nome}</strong></span>}
                  {isDiagP && r.diagnostico && (
                    <>
                      <span><strong style={{ color: '#22C55E', fontWeight: 600 }}>{r.diagnostico.existentes}</strong> Existentes</span>
                      <span><strong style={{ color: '#FACC15', fontWeight: 600 }}>{r.diagnostico.parciais}</strong> Parciais</span>
                      <span><strong style={{ color: '#EF4444', fontWeight: 600 }}>{r.diagnostico.inexistentes}</strong> Inexistentes</span>
                    </>
                  )}
                  {r.ultimaAtividade && <span>Últ. atividade: <strong style={{ color: 'var(--cream)', fontWeight: 500 }}>{r.ultimaAtividade}</strong></span>}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 11, color: 'rgba(247,243,238,0.35)', marginBottom: 12 }}>
            {papelLabel(perfil?.papel)} — {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} disponíve{projetos.length !== 1 ? 'is' : 'l'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {onAdmin && (
              <button onClick={onAdmin} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(204,145,94,0.08)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 8,
                color: 'var(--copper)', fontSize: 11, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Administração
              </button>
            )}
            <button onClick={signOut} style={{ background: 'transparent', border: '1px solid var(--brd)', borderRadius: 8, color: 'var(--txt3)', fontSize: 11, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SHELL
// ══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [projetos, setProjetos] = useState([])
  const [projetosLoaded, setProjetosLoaded] = useState(false)
  const [projetoAtivo, setProjetoAtivo] = useState(null)
  const [projetoResumos, setProjetoResumos] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [areasCalc, setAreasCalc] = useState([])
  const [todosControles, setTodosControles] = useState([])
  const [loading, setLoading] = useState(true)
  const [areaExpanded, setAreaExpanded] = useState(true)

  useEffect(() => {
    carregarConstantes()
      .then(() => loadProjetos())
      .catch(err => {
        console.error('Erro ao inicializar:', err)
        setProjetosLoaded(true)
      })
  }, [])

  async function loadProjetos() {
    try {
      const { data, error } = await supabase.from('projetos').select('*, clientes(nome, nome_fantasia, slug)').eq('ativo', true).order('criado_em', { ascending: false })
      if (error) console.error('Erro ao carregar projetos:', error)
      if (data && data.length > 0) {
        setProjetos(data)
        // Carregar resumos em background (não bloqueia a tela)
        loadResumos(data).catch(err => console.error('Erro ao carregar resumos:', err))
      }
    } catch (err) {
      console.error('Erro ao carregar projetos:', err)
    } finally {
      setProjetosLoaded(true)
    }
  }

  async function loadResumos(projs) {
    const resumos = {}
    try {
      await Promise.all(projs.map(async (p) => {
        try {
          const isDiag = p.f1_tem_teste === false
          const queries = [
            supabase.from('mrc').select('id, dt_ult, atualizado_em, criado_em' + (isDiag ? ', existencia' : ''), { count: 'exact' }).eq('projeto_id', p.id),
            supabase.from('areas').select('id', { count: 'exact' }).eq('projeto_id', p.id),
          ]
          if (!isDiag) queries.push(supabase.from('vw_maturidade_areas').select('percentual').eq('projeto_id', p.id))
          const results = await Promise.all(queries)
          const mrcRes = results[0]; const areaRes = results[1]; const matRes = results[2]
          const totalControles = mrcRes.count || 0
          const totalAreas = areaRes.count || 0
          let maturidade = null
          let diagnostico = null
          if (isDiag) {
            const rows = mrcRes.data || []
            const ex = rows.filter(r => r.existencia === 'Existente').length
            const pc = rows.filter(r => r.existencia === 'Parcial').length
            const ix = rows.filter(r => r.existencia === 'Inexistente').length
            diagnostico = { existentes: ex, parciais: pc, inexistentes: ix, total: rows.length }
          } else if (matRes) {
            const matRows = matRes.data || []
            if (matRows.length > 0) {
              const avg = matRows.reduce((s, m) => s + (m.percentual || 0), 0) / matRows.length
              maturidade = getNivelMaturidade(avg)
            }
          }
          let maxDate = null
          ;(mrcRes.data || []).forEach(c => {
            const d = c.dt_ult || c.atualizado_em || c.criado_em
            if (d) { const dt = new Date(d); if (!isNaN(dt) && (!maxDate || dt > maxDate)) maxDate = dt }
          })
          resumos[p.id] = { totalControles, totalAreas, maturidade, diagnostico, isDiag, ultimaAtividade: maxDate ? maxDate.toLocaleDateString('pt-BR') : null }
        } catch { resumos[p.id] = {} }
      }))
    } catch (err) {
      console.error('Erro ao carregar resumos:', err)
    }
    setProjetoResumos(resumos)
  }

  useEffect(() => { if (projetoAtivo?.id) loadDados(projetoAtivo.id) }, [projetoAtivo])

  // Recarrega quando uma área é criada/editada nas Configurações
  useEffect(() => {
    function handleAreasUpdated() {
      if (projetoAtivo?.id) loadDados(projetoAtivo.id)
    }
    window.addEventListener('polimata:areas-updated', handleAreasUpdated)
    return () => window.removeEventListener('polimata:areas-updated', handleAreasUpdated)
  }, [projetoAtivo])

  async function loadDados(pid) {
    setLoading(true)
    try {
      // Buscar áreas, controles e maturidade em paralelo (maturidade vem do banco via RPC)
      const [areasRes, mrcRes, matRes] = await Promise.all([
        supabase.from('areas').select('id, nome, prefixo, peso, gerente, ordem').eq('projeto_id', pid).order('ordem'),
        supabase.from('mrc').select('*').eq('projeto_id', pid),
        supabase.from('vw_maturidade_areas').select('area_id, percentual, nivel, nome, total, efetivos, inefetivos, gaps, regredidos').eq('projeto_id', pid),
      ])
      const controles = mrcRes.data || [], areas = areasRes.data || []
      const matData = matRes.data || []
      const res = areas.map(a => {
        const ca = controles.filter(c => c.area_id === a.id || c.area === a.nome).map(c => ({ ...c, area: a.nome }))
        const mat = matData.find(m => m.area_id === a.id)
        return {
          ...a,
          controles: ca,
          calc: mat
            ? { percentual: parseFloat(mat.percentual) || 0, nivel: mat.nivel, nome: mat.nome, totais: { ativos: mat.total, efetivos: mat.efetivos, inefetivos: mat.inefetivos, gap: mat.gaps, regredidos: mat.regredidos } }
            : { percentual: 0, nivel: 'N1', nome: 'Não confiável', totais: { ativos: 0, efetivos: 0, inefetivos: 0, gap: 0, regredidos: 0 } },
        }
      })
      const resOrdenado = [...res].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setAreasCalc(resOrdenado); setTodosControles(controles)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = perfil?.papel === 'admin_polimata'
  const sw = sidebarOpen ? 260 : 56
  const isHomeDash = location.pathname === '/'
  const mainLightClass = isHomeDash ? '' : 'main-light'
  const ultimaAtualizacao = useMemo(() => getUltimaAtualizacao(todosControles), [todosControles])

  // Aguardando carregamento inicial dos projetos
  if (!projetosLoaded) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }
  // Painel Admin — tela própria, fora do contexto de projeto
  if (isAdmin && location.pathname.startsWith('/admin')) {
    return <AdminPanel />
  }
  // Seletor de projetos — exibido quando nenhum projeto está selecionado
  if (!projetoAtivo && projetos.length > 0) {
    return <ProjectSelector projetos={projetos} resumos={projetoResumos} perfil={perfil} onSelect={p => { setProjetoAtivo(p); navigate('/') }} signOut={signOut} onAdmin={isAdmin ? () => navigate('/admin') : null} />
  }
  if (!projetoAtivo && projetos.length === 0) {
    return <NoProjeto />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{ width: sw, minWidth: sw, background: 'var(--bg1)', borderRight: '1px solid var(--brd)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .25s ease, min-width .25s ease', position: 'relative', zIndex: 250 }}>
        <div style={{ padding: sidebarOpen ? '12px' : '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--brd)', minHeight: 56 }}>
          {sidebarOpen
            ? <img src="/logotipo-2cores.png" alt="Polímata" style={{ width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain' }} />
            : <img src="/logotipo-2cores.png" alt="P" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
        </div>
        {sidebarOpen && projetoAtivo && (
          <div className="sb-projeto">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="sb-projeto-label">Projeto ativo</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isAdmin && (
                  <button onClick={() => navigate('/admin')}
                    style={{ background: 'none', border: 'none', color: 'var(--txt3)', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'inherit', opacity: 0.7, transition: 'opacity .15s' }}
                    onMouseEnter={e => e.target.style.opacity = 1} onMouseLeave={e => e.target.style.opacity = 0.7}
                    title="Painel de Projetos">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </button>
                )}
                {projetos.length > 1 && (
                  <button onClick={() => { setProjetoAtivo(null); navigate('/') }}
                    style={{ background: 'none', border: 'none', color: 'var(--copper)', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    Trocar
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--cream)', fontWeight: 500, lineHeight: 1.3, marginTop: 4 }}>
              {formatNomeEmpresa(projetoAtivo.clientes?.nome_fantasia || projetoAtivo.clientes?.nome)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
              {projetoAtivo.nome}
            </div>
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
              style={{ padding: '8px 16px 8px 28px', fontSize: 13, gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--copper)' }}>›</span> {a.nome}
            </button>
          ))}
          {sidebarOpen && <div className="sb-sep">Operação</div>}
          <SideNavItem icon="📋" label="MRC Completa" active={location.pathname === '/mrc'} onClick={() => navigate('/mrc')} open={sidebarOpen}
            badge={todosControles.length > 0 ? todosControles.length : null} />
          <SideNavItem icon="📄" label="Relatórios" active={location.pathname === '/relatorios'} onClick={() => navigate('/relatorios')} open={sidebarOpen} />
          {isAdmin && (<>{sidebarOpen && <div className="sb-sep">Administração</div>}
            <SideNavItem icon="📥" label="Manutenção MRC" active={location.pathname === '/importar-mrc'} onClick={() => navigate('/importar-mrc')} open={sidebarOpen} /></>)}
        </nav>
        <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'transparent', border: 'none', borderTop: '1px solid var(--brd)', color: 'var(--txt3)', padding: '10px', cursor: 'pointer', fontSize: 14, textAlign: 'center' }}>
          {sidebarOpen ? '◂' : '▸'}
        </button>
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className={`sb-admin-gear${location.pathname.startsWith('/admin') ? ' active' : ''}`}
            title="Administração da plataforma"
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: location.pathname.startsWith('/admin') ? 'rgba(204,145,94,0.08)' : 'transparent', border: 'none', borderTop: '1px solid var(--brd)', color: location.pathname.startsWith('/admin') ? 'var(--copper)' : 'var(--txt3)', padding: '10px 14px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, transition: 'all .15s' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {sidebarOpen && <span>Administração</span>}
          </button>
        )}
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

      <main className={mainLightClass} style={{ flex: 1, overflowY: 'auto', background: isHomeDash ? 'var(--bg0)' : 'var(--lt-bg)', position: 'relative' }}>
        {/* Notificações — canto superior direito. Oculto na MRC e PorArea (header inclui o sino) */}
        {location.pathname !== '/mrc' && !location.pathname.startsWith('/area/') && (
          <div className="top-bar" style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px 0', background: isHomeDash ? 'var(--bg0)' : 'var(--lt-bg)' }}>
            <NotificacoesPanel />
          </div>
        )}
        <Routes>
          <Route path="/" element={
            getTipoEntrega(projetoAtivo) === 'diagnostico'
              ? <HomeDashDiagnostico projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} ultimaAtualizacao={ultimaAtualizacao} loadDados={loadDados} />
              : <HomeDash projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} ultimaAtualizacao={ultimaAtualizacao} loadDados={loadDados} />
          } />
          <Route path="/area/:areaId" element={<PorArea projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} navigate={navigate} loadDados={loadDados} />} />
          <Route path="/mrc" element={<MRCCompleta projetoId={projetoAtivo?.id} projeto={projetoAtivo} clienteNome={formatNomeEmpresa(projetoAtivo?.clientes?.nome_fantasia || projetoAtivo?.clientes?.nome) || ''} projetoNome={projetoAtivo?.nome || ''} notificacoes={<NotificacoesPanel />} papel={perfil?.papel} />} />
          <Route path="/relatorios" element={<Relatorios projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} clienteNome={formatNomeEmpresa(projetoAtivo?.clientes?.nome_fantasia || projetoAtivo?.clientes?.nome) || ''} projetoNome={projetoAtivo?.nome || ''} />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
          <Route path="/importar-mrc" element={<ImportarMRC projetoId={projetoAtivo?.id} projeto={projetoAtivo} areas={areasCalc} onImported={() => { if (projetoAtivo?.id) loadDados(projetoAtivo.id) }} />} />
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
      {open && badge && <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(204,145,94,.15)', padding: '2px 8px', borderRadius: 999, color: 'var(--copper)' }}>{badge}</span>}
    </button>
  )
}
function papelLabel(p) { return { admin_polimata: 'Admin Polímata', consultor_polimata: 'Consultor', gestor_cliente: 'Gestor', usuario_cliente: 'Usuário' }[p] || p || '—' }

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTILHADOS
// ══════════════════════════════════════════════════════════════════════════════

function NivelBadge({ pct, nivel }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: getCorNivel(pct), padding: '3px 10px', borderRadius: 999, marginTop: 3, textTransform: 'uppercase', display: 'inline-block' }}>{nivel.nivel} — {nivel.nome}</div>
}

function Spinner({ light }) { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: light ? 'var(--lt-bg)' : 'var(--bg0)' }}><div className="spinner" /></div> }
function NoProjeto() {
  return (
    <div style={{ background: 'var(--bg0)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(204,145,94,0.15), rgba(204,145,94,0.05))', border: '1px solid rgba(204,145,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📊</div>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: 'var(--cream)', marginBottom: 8, fontFamily: "'Raleway', sans-serif", letterSpacing: '.3px' }}>Bem-vindo ao Polímata GRC</h2>
        <p style={{ fontSize: 13, color: 'rgba(247,243,238,0.5)', lineHeight: 1.7, marginBottom: 24 }}>
          Nenhum projeto ativo foi encontrado para o seu perfil. Para começar, peça ao administrador que vincule você a um projeto.
        </p>
      </div>
    </div>
  )
}

function EmptyProjectState({ navigate, isAdmin, projetoId, projeto, areasCalc, onImported }) {
  const [showImportModal, setShowImportModal] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 400 }}>
      <div style={{ textAlign: 'center', maxWidth: 520, padding: 40, background: 'var(--lt-bg)', borderRadius: 16, border: '1px dashed rgba(204,145,94,0.3)' }}>
        <div style={{ width: 72, height: 72, margin: '0 auto 20px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(204,145,94,0.12), rgba(204,145,94,0.04))', border: '1px solid rgba(204,145,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🚀</div>
        <h3 style={{ fontSize: 17, fontWeight: 300, color: 'var(--lt-text1)', marginBottom: 8, fontFamily: "'Raleway', sans-serif" }}>Vamos começar?</h3>
        <p style={{ fontSize: 12, color: 'var(--lt-text2)', lineHeight: 1.8, marginBottom: 20 }}>
          Este projeto ainda não possui riscos e controles cadastrados. Você pode importar em massa usando o template da MRC ou cadastrar um a um na visão por área.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => gerarTemplateMRC()}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', color: 'var(--copper)', border: '1px solid var(--copper)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            📄 Baixar Template MRC
          </button>
          <button onClick={() => setShowImportModal(true)}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, var(--gold-md), var(--gold))', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 Importar Template MRC
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--lt-text3)', marginTop: 16 }}>
          Baixe o template para preencher offline e depois solicite a importação ao administrador. Na visão por área (sidebar), use o botão "Novo Risco" para cadastrar controles individualmente.
        </p>
      </div>

      {/* Modal de Importação */}
      {showImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowImportModal(false)}>
          <div style={{ background: 'var(--lt-card)', borderRadius: 16, maxWidth: 920, width: '95%', maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImportModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 18, color: 'var(--lt-text3)', cursor: 'pointer', zIndex: 1 }} title="Fechar">✕</button>
            <ImportarMRC projetoId={projetoId} projeto={projeto} areas={areasCalc} allowNonAdmin={true} onImported={() => { setShowImportModal(false); if (onImported) onImported() }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TELA 1 — DASHBOARD (REDESIGN v7)
// ══════════════════════════════════════════════════════════════════════════════

function HomeDash({ projeto, areasCalc, todosControles, loading, ultimaAtualizacao, loadDados }) {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [areaFiltro, setAreaFiltro] = useState(null)

  const empresa = useMemo(() => calcularIndiceEmpresa(areasCalc.map(a => ({ nome: a.nome, peso: a.peso || 0, percentual: a.calc?.percentual || 0 }))), [areasCalc])
  const ranking = useMemo(() => [...areasCalc].filter(a => a.controles.length > 0).sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0)), [areasCalc])

  const kpis = useMemo(() => {
    let ef = 0, inf = 0, gap = 0, pa = 0
    todosControles.forEach(c => {
      const rv = getResultadoVitrine(c)
      if (isEfetivo(rv)) ef++
      else if (isInefetivo(rv)) inf++
      else if (isGap(rv)) gap++
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
  const clienteNome = formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || 'Cliente'

  function toggleAreaFiltro(nome) {
    setAreaFiltro(prev => prev === nome ? null : nome)
  }

  if (loading) return <Spinner />
  if (!projeto) return <NoProjeto />
  if (todosControles.length === 0) return <EmptyProjectState navigate={navigate} isAdmin={perfil?.papel === 'admin_polimata'} projetoId={projeto?.id} projeto={projeto} areasCalc={areasCalc} onImported={() => { if (projeto?.id) loadDados(projeto.id) }} />

  const D = dashStyles

  return (
    <div style={D.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper)' }}>{clienteNome} · {projeto.nome || 'Controles Internos'}</div>
          <div style={{ fontSize: 22, fontWeight: 200, fontFamily: "'Raleway', sans-serif", color: 'var(--cream)', letterSpacing: 0.3, lineHeight: 1.2 }}>Maturidade do Ambiente de Controles Internos</div>
          <div style={{ fontSize: 11, color: 'rgba(247,243,238,0.65)', marginTop: 2 }}>{areasCalc.length} áreas · {todosControles.length} controles</div>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(247,243,238,0.72)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 14px', whiteSpace: 'nowrap' }}>Última atualização: {ultimaAtualizacao}</div>
      </div>

      <div style={D.kpiRow}>
        <div style={{ ...D.kpiCard, borderTopColor: 'var(--copper)' }}>
          <div style={D.kpiLabel}>Índice de Maturidade Consolidado · {clienteNome}</div>
          <div style={{ ...D.kpiValor, color: 'var(--copper)' }}>{(empresa.indice * 100).toFixed(1)}%</div>
          <div><span style={{ ...D.kpiBadge, background: getCorNivel(empresa.indice) }}>{nivelEmpresa.nivel}</span> <span style={{ fontSize: 10, color: 'rgba(247,243,238,0.65)' }}>{nivelEmpresa.nome}</span></div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: 'var(--cream)' }}>
          <div style={D.kpiLabel}>Total de Controles</div>
          <div style={{ ...D.kpiValor, color: 'var(--cream)' }}>{todosControles.length}</div>
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
          <div style={{ ...D.kpiValor, color: 'var(--copper)' }}>{kpis.pa}</div>
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
          {ranking.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'rgba(247,243,238,0.3)' }}>Sem dados cadastrados.</div>}
        </div>
      </div>

      <div style={D.zonaInferior}>
        <div style={{ ...D.cardDark, flex: 4, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={D.cardTitle}>
            Mapa de Calor — Impacto × Probabilidade
            {areaFiltro && <span style={{ fontWeight: 400, color: 'var(--copper)', marginLeft: 8 }}>({areaFiltro})</span>}
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
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(247,243,238,0.55)' }}>Probabilidade →</div>
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
                  <th style={{ ...D.critTh, color: 'rgba(247,243,238,0.5)' }}>Total</th>
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
                      {a.crit.map((v, i) => <td key={i} style={{ ...D.critTdNum, color: v > 0 ? CRIT_CORES[i] : 'rgba(247,243,238,0.15)' }}>{v}</td>)}
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
  page: { background: 'var(--bg0)', minHeight: '100vh', padding: '0 20px 12px', fontFamily: "'Montserrat', sans-serif", color: 'var(--cream)', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  /* header agora é inline, estilos diretos no JSX */
  kpiRow: { display: 'flex', gap: 8, flexShrink: 0, margin: '8px 0' },
  kpiCard: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid' },
  kpiLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(247,243,238,0.45)', marginBottom: 5 },
  kpiValor: { fontSize: 26, fontWeight: 300, lineHeight: 1 },
  kpiSub: { fontSize: 10, color: 'rgba(247,243,238,0.3)', marginTop: 4 },
  kpiBadge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: '#fff' },
  cardDark: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, flexShrink: 0 },
  cardTitle: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(247,243,238,0.4)', marginBottom: 10 },
  limparFiltro: { background: 'rgba(204,145,94,0.15)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 600, color: 'var(--copper)', cursor: 'pointer', fontFamily: 'inherit' },
  areaList: { maxHeight: 340, overflowY: 'auto', paddingRight: 4 },
  areaRow: { display: 'flex', alignItems: 'center', padding: '6px 4px', gap: 10, borderRadius: 4, transition: 'background .15s' },
  areaRank: { fontSize: 10, fontWeight: 500, color: 'rgba(247,243,238,0.25)', width: 18, textAlign: 'right', flexShrink: 0 },
  areaNome: { fontSize: 12, fontWeight: 500, color: 'var(--cream)', width: 180, flexShrink: 0 },
  areaBarWrap: { flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  areaBar: { height: '100%', borderRadius: 4, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' },
  areaPct: { fontSize: 12, fontWeight: 600, color: 'var(--cream)', width: 50, textAlign: 'right', flexShrink: 0 },
  nivelBadge: { fontSize: 10, fontWeight: 700, color: '#fff', padding: '2px 7px', borderRadius: 999, flexShrink: 0, minWidth: 28, textAlign: 'center' },
  zonaInferior: { display: 'flex', gap: 8, flex: 1, minHeight: 0, overflow: 'hidden' },
  heatYLabels: { display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 8, width: 70, flexShrink: 0 },
  heatYLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(247,243,238,0.5)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  heatBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  heatRow: { display: 'flex', gap: 3, flex: 1 },
  heatCell: { flex: 1, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', minHeight: 50, transition: 'transform .15s', cursor: 'default' },
  heatXLabels: { display: 'flex', paddingLeft: 78, paddingTop: 6, gap: 3 },
  heatXLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'rgba(247,243,238,0.5)' },
  heatLegend: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(247,243,238,0.45)' },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  critTh: { padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', position: 'sticky', top: 0, zIndex: 2, background: 'rgba(7,26,46,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  critTdArea: { padding: '5px 8px', fontSize: 10, fontWeight: 500, color: 'var(--cream)', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' },
  critTdNum: { padding: '5px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  critTdTotal: { padding: '5px 8px', fontSize: 11, fontWeight: 600, color: 'rgba(247,243,238,0.5)', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  critTfoot: { padding: '8px', fontSize: 10, fontWeight: 700, textAlign: 'center', color: 'rgba(247,243,238,0.6)', borderTop: '1px solid rgba(255,255,255,0.1)' },
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
    const rv = (getResultadoVitrine(c) || '').toLowerCase()
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

  const somaPesos = areasCalc.reduce((s, a) => s + (a.peso||0), 0)
  const pesoEmpresa = somaPesos > 0 ? ((area.peso||0)/somaPesos*100).toFixed(1) : '0'
  const p = area.calc?.percentual||0, nv = getNivelMaturidade(p)
  let efetivos=0, inefetivos=0, gaps=0, planosAcao=0
  area.controles.forEach(c => {
    const rv = getResultadoVitrine(c)
    if (isEfetivo(rv)) efetivos++
    else if (isInefetivo(rv)) inefetivos++
    else if (isGap(rv)) gaps++
    if (precisaPlanoAcao(c) && !planoAcaoConcluido(c)) planosAcao++
  })

  // Resultado geral: retorna o resultado da fase mais avançada do controle
  function getResultadoGeral(c) {
    const v = getResultadoVitrine(c)
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
  function paSortVal(row, k) { if (k === '_dt') return row.dt_ult || row.atualizado_em || row.criado_em || ''; if (k === '_resultado') return getResultadoVitrine(row); if (k === '_fase_atual') return getFaseLabel(row); if (k === '_status_atual') return getStatusComputado(row); return row[k] ?? '' }

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
  // Headers de fase coloridos
  const FASE_HDR = [
    { h: 'Fase 1\nDiagnóstico', bg: '#00203E' },
    { h: 'Fase 2\nE1 - Desenho', bg: '#1D3B5C' },
    { h: 'Fase 2\nE2 - Efetividade', bg: '#1D3B5C' },
    { h: 'Fase 3\nRevisão Integral', bg: '#660033' },
    { h: 'Fase 4\nAI - Ciclo 1', bg: '#660066' },
    { h: 'Fase 4\nAI - Ciclo 2', bg: '#660066' },
    { h: 'Fase 5\nAuditoria Indep.', bg: '#A6512F' },
  ]
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

        {/* KPI GRID 3×2 */}
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
        </div>
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
              {FASE_HDR.map((f, i) => <th key={`f${i}`} style={{ ...faseThS, background: f.bg, borderRight: '1px solid rgba(255,255,255,0.28)', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(PA_FASE_KEYS[i])}>{f.h}{sortArrow(PA_FASE_KEYS[i])}</th>)}
              {!isCliente && <th style={{ fontSize: 11, fontWeight: 600, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 12px', position: 'sticky', top: 0, zIndex: 2, width: 120, minWidth: 120, borderBottom: '1px solid var(--lt-border)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Ação</th>}
            </tr></thead>
            <tbody>{cfSorted.map((c, i) => (
              <tr key={c.id||i} onClick={() => setModalRow(c)} style={{ cursor: 'pointer', ...((c.status_risco === 'evitado' || c.status_risco === 'transferido') ? { opacity: 0.55, fontStyle: 'italic' } : {}) }} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ ...tdS, width: 95, minWidth: 95, fontSize: 11, color: 'var(--lt-text3)', textAlign: 'center' }}>{fmtDate(c.dt_ult || c.atualizado_em || c.criado_em)}</td>
                <Td w={120}>{c.sub}</Td>
                <td style={{ ...tdS, color: 'var(--copper-text)', fontWeight: 700, width: 80, minWidth: 80, textAlign: 'center' }}>{c.rr}</td><Td w={200}>{c.dr}</Td>
                <td style={{ ...tdS, color: 'var(--copper-text)', fontWeight: 700, width: 90, minWidth: 90, textAlign: 'center' }}>{c.rc}</td><Td w={200}>{c.dc}</Td>
                <td style={{ ...tdS, width: 90, minWidth: 90, textAlign: 'center' }}>{badgeR(getResultadoVitrine(c))}</td>
                <td style={{ ...tdS, width: 110, minWidth: 110, textAlign: 'center' }}>{badgeCrit(c.crit)}</td>
                <td style={{ ...tdS, width: 130, minWidth: 130, fontSize: 11, fontWeight: 500, textAlign: 'center' }}>{getFaseLabel(c)}{c.num_regressoes > 0 && <RegressaoBadge n={c.num_regressoes} />}</td>
                <td style={{ ...tdS, width: 110, minWidth: 110, textAlign: 'center' }}>{(() => { const st = getStatusComputado(c); const cfg = getStatusBadge(st); return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{cfg.label}</span> })()}</td>
                {/* Colunas de fase */}
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'r1', c.r1))}</td>
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'st_pa', c.st_pa))}</td>
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'r_ader', c.r_ader))}</td>
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'r3', c.r3))}</td>
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'r_f4c1', c.r_f4c1))}</td>
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'r_f4c2', c.r_f4c2))}</td>
                <td style={{ ...tdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFase(faseVal(c, 'r_f5', c.r_f5))}</td>
                {!isCliente && <td style={{ ...tdS, textAlign: 'center', width: 120, minWidth: 120 }}>
                    {(() => {
                      const st = getStatusComputado(c)
                      // Define UMA ação primária por contexto (a "próxima ação" do workflow)
                      let primary = null, secondary = null
                      if (canEdit && st === 'em_analise') {
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
      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
      {atualizarRow && <ModalAtualizar row={atualizarRow} onClose={() => setAtualizarRow(null)} onSaved={() => { setAtualizarRow(null); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} />}
      {modalNovoRisco && <ModalNovoRisco onClose={() => setModalNovoRisco(false)} onSaved={() => { setModalNovoRisco(false); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projeto={projeto} areaFixa={area} />}
      {rowRegistrarResultado && <ModalRegistrarResultado row={rowRegistrarResultado} onClose={() => setRowRegistrarResultado(null)} onSaved={() => { setRowRegistrarResultado(null); if (projeto?.id) loadDados(projeto.id) }} responsaveis={[]} />}
      {rowRevisar && <ModalRevisar row={rowRevisar} onClose={() => setRowRevisar(null)} onAction={() => { setRowRevisar(null); if (projeto?.id) loadDados(projeto.id) }} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS POR ÁREA (tema escuro)
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

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS LEGADO (mantidos para compatibilidade MRC)
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  page: { background: 'var(--lt-bg)', height: '100vh', padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", color: 'var(--lt-text)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' },
  header: { background: 'var(--navy)', borderRadius: 12, padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerText: { fontSize: 13, fontWeight: 400, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif" },
  th: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--navy)', background: 'var(--sand)', padding: '7px 4px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 2, borderBottom: '2px solid var(--lt-border)' },
  tdCenter: { padding: '4px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--navy)' },
}

// ══════════════════════════════════════════════════════════════════════════════
// TELA HOME — DIAGNÓSTICO (projetos com f1_tem_teste=false)
// Para projetos sem teste de efetividade. Mostra Existência × Criticidade
// em vez de Maturidade N1-N5.
// ══════════════════════════════════════════════════════════════════════════════

function HomeDashDiagnostico({ projeto, areasCalc, todosControles, loading, ultimaAtualizacao, loadDados }) {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [areaFiltro, setAreaFiltro] = useState(null)

  const clienteNome = formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || 'Cliente'

  // Diagnóstico agregado
  const diag = useMemo(() => calcularDiagnosticoProjeto(
    todosControles,
    areasCalc.map(a => ({ id: a.id, nome: a.nome, peso: a.peso || 0 }))
  ), [todosControles, areasCalc])

  // Tabela Diagnóstico × Criticidade — matriz crit (4..1) × existência (E/P/I/sem)
  const critPorExistencia = useMemo(() => {
    const m = {
      4: { Existente: 0, Parcial: 0, Inexistente: 0, sem: 0 },
      3: { Existente: 0, Parcial: 0, Inexistente: 0, sem: 0 },
      2: { Existente: 0, Parcial: 0, Inexistente: 0, sem: 0 },
      1: { Existente: 0, Parcial: 0, Inexistente: 0, sem: 0 },
    }
    todosControles.forEach(c => {
      if (c.ativo === false) return
      if ((c.status_risco || '').toLowerCase() === 'descontinuado') return
      const crit = c.crit
      if (!m[crit]) return
      const ex = c.existencia
      if (ex === 'Existente') m[crit].Existente++
      else if (ex === 'Parcial') m[crit].Parcial++
      else if (ex === 'Inexistente') m[crit].Inexistente++
      else m[crit].sem++
    })
    return m
  }, [todosControles])

  // KPIs do diagnóstico
  const total = diag.total || 0
  const pctExistente = total > 0 ? Math.round((diag.existentes / total) * 100) : 0
  const pctParcial = total > 0 ? Math.round((diag.parciais / total) * 100) : 0
  const pctInexistente = total > 0 ? Math.round((diag.inexistentes / total) * 100) : 0

  // Heatmap Impacto × Probabilidade (reutiliza estrutura do HomeDash)
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

  // Tabela Riscos por Área × Criticidade
  const critPorArea = useMemo(() => {
    return areasCalc
      .filter(a => a.controles && a.controles.length > 0)
      .map(a => {
        const cr = [0, 0, 0, 0]
        a.controles.forEach(c => { cr[critToIdx(c.crit)]++ })
        return { nome: a.nome, crit: cr, total: a.controles.length }
      })
  }, [areasCalc])

  const critTotais = useMemo(() => {
    const t = [0, 0, 0, 0]
    critPorArea.forEach(a => a.crit.forEach((v, i) => t[i] += v))
    return t
  }, [critPorArea])

  function toggleAreaFiltro(nome) {
    setAreaFiltro(prev => prev === nome ? null : nome)
  }

  if (loading) return <Spinner />
  if (!projeto) return <NoProjeto />
  if (todosControles.length === 0) return <EmptyProjectState navigate={navigate} isAdmin={perfil?.papel === 'admin_polimata'} projetoId={projeto?.id} projeto={projeto} areasCalc={areasCalc} onImported={() => { if (projeto?.id) loadDados(projeto.id) }} />

  const D = dashStyles

  // Cores Existência (alinhadas ao padrão do app)
  const C_EXISTENTE = COR_EFETIVO    // verde
  const C_PARCIAL = COR_INEFETIVO    // amarelo
  const C_INEXISTENTE = COR_GAP      // vermelho

  // Critérios "prioritários": Inexistentes em risco Crítico ou Significativo
  const inexCritSig = (critPorExistencia[4]?.Inexistente || 0) + (critPorExistencia[3]?.Inexistente || 0)

  return (
    <div style={D.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper)' }}>{clienteNome} · {projeto.nome || 'Controles Internos'}</div>
          <div style={{ fontSize: 22, fontWeight: 200, fontFamily: "'Raleway', sans-serif", color: 'var(--cream)', letterSpacing: 0.3, lineHeight: 1.2 }}>Diagnóstico de Controles Internos</div>
          <div style={{ fontSize: 11, color: 'rgba(247,243,238,0.65)', marginTop: 2 }}>{areasCalc.length} área{areasCalc.length === 1 ? '' : 's'} · {todosControles.length} controles</div>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(247,243,238,0.72)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 14px', whiteSpace: 'nowrap' }}>Última atualização: {ultimaAtualizacao}</div>
      </div>

      <div style={D.kpiRow}>
        <div style={{ ...D.kpiCard, borderTopColor: C_EXISTENTE }}>
          <div style={D.kpiLabel}>Existentes</div>
          <div style={{ ...D.kpiValor, color: C_EXISTENTE }}>{pctExistente}%</div>
          <div style={D.kpiSub}>{diag.existentes} de {total} controles</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: C_PARCIAL }}>
          <div style={D.kpiLabel}>Parciais</div>
          <div style={{ ...D.kpiValor, color: C_PARCIAL }}>{pctParcial}%</div>
          <div style={D.kpiSub}>{diag.parciais} de {total} controles</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: C_INEXISTENTE }}>
          <div style={D.kpiLabel}>Inexistentes</div>
          <div style={{ ...D.kpiValor, color: C_INEXISTENTE }}>{pctInexistente}%</div>
          <div style={D.kpiSub}>{diag.inexistentes} de {total} controles</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: 'var(--cream)' }}>
          <div style={D.kpiLabel}>Total de Controles</div>
          <div style={{ ...D.kpiValor, color: 'var(--cream)' }}>{total}</div>
          <div style={D.kpiSub}>controles mapeados</div>
        </div>
        <div style={{ ...D.kpiCard, borderTopColor: 'var(--copper)' }}>
          <div style={D.kpiLabel}>Riscos Críticos</div>
          <div style={{ ...D.kpiValor, color: 'var(--copper)' }}>{diag.criticos}</div>
          <div style={D.kpiSub}>atenção prioritária</div>
        </div>
      </div>

      <div style={D.cardDark}>
        <div style={D.cardTitle}>Diagnóstico × Criticidade</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...D.critTh, textAlign: 'left' }}>Criticidade</th>
                <th style={{ ...D.critTh, color: C_EXISTENTE }}>Existente</th>
                <th style={{ ...D.critTh, color: C_PARCIAL }}>Parcial</th>
                <th style={{ ...D.critTh, color: C_INEXISTENTE }}>Inexistente</th>
                <th style={{ ...D.critTh, color: 'rgba(247,243,238,0.5)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[4, 3, 2, 1].map(crit => {
                const row = critPorExistencia[crit] || { Existente: 0, Parcial: 0, Inexistente: 0 }
                const totalLinha = row.Existente + row.Parcial + row.Inexistente
                const idx = critToIdx(crit)
                const isPrior = (crit === 4 || crit === 3) && row.Inexistente > 0
                return (
                  <tr key={crit}>
                    <td style={{ ...D.critTdArea, color: CRIT_CORES[idx], fontWeight: 600 }}>{CRIT_LABELS[idx]}</td>
                    <td style={{ ...D.critTdNum, color: row.Existente > 0 ? 'var(--cream)' : 'rgba(247,243,238,0.15)' }}>{row.Existente || '—'}</td>
                    <td style={{ ...D.critTdNum, color: row.Parcial > 0 ? 'var(--cream)' : 'rgba(247,243,238,0.15)' }}>{row.Parcial || '—'}</td>
                    <td style={{ ...D.critTdNum, color: row.Inexistente > 0 ? 'var(--cream)' : 'rgba(247,243,238,0.15)', background: isPrior ? 'rgba(239,68,68,0.10)' : 'transparent', fontWeight: isPrior ? 600 : 'inherit' }}>{row.Inexistente || '—'}</td>
                    <td style={{ ...D.critTdTotal }}>{totalLinha}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...D.critTfoot, textAlign: 'left' }}>TOTAL</td>
                <td style={{ ...D.critTfoot, color: C_EXISTENTE }}>{diag.existentes}</td>
                <td style={{ ...D.critTfoot, color: C_PARCIAL }}>{diag.parciais}</td>
                <td style={{ ...D.critTfoot, color: C_INEXISTENTE }}>{diag.inexistentes}</td>
                <td style={{ ...D.critTfoot }}>{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {inexCritSig > 0 && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.10)', borderLeft: `3px solid ${C_INEXISTENTE}`, fontSize: 11, color: 'var(--cream)' }}>
            <strong style={{ fontWeight: 600 }}>Prioridade #1:</strong> <span style={{ color: 'rgba(247,243,238,0.7)' }}>{inexCritSig} controle{inexCritSig === 1 ? '' : 's'} inexistente{inexCritSig === 1 ? '' : 's'} em risco{inexCritSig === 1 ? '' : 's'} Crítico/Significativo</span>
          </div>
        )}
      </div>

      <div style={D.zonaInferior}>
        <div style={{ ...D.cardDark, flex: 4, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={D.cardTitle}>
            Mapa de Calor — Impacto × Probabilidade
            {areaFiltro && <span style={{ fontWeight: 400, color: 'var(--copper)', marginLeft: 8 }}>({areaFiltro})</span>}
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
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(247,243,238,0.55)' }}>Probabilidade →</div>
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
                  <th style={{ ...D.critTh, color: 'rgba(247,243,238,0.5)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {critPorArea.map(a => {
                  const ativo = areaFiltro === a.nome
                  return (
                    <tr key={a.nome} onClick={() => toggleAreaFiltro(a.nome)} style={{ cursor: 'pointer', background: ativo ? 'rgba(204,145,94,0.08)' : 'transparent' }}>
                      <td style={D.critTdArea}>{a.nome}</td>
                      {a.crit.map((v, i) => <td key={i} style={{ ...D.critTdNum, color: v > 0 ? CRIT_CORES[i] : 'rgba(247,243,238,0.15)' }}>{v}</td>)}
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
