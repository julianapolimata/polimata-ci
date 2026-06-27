import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import AdminPanel from './AdminPanel'
import NotificacoesPanel from '../components/NotificacoesPanel'
import Hub from './Hub'
import { formatNomeEmpresa } from '../lib/formatNome'
import { moduloDaRota } from '../lib/modulos'
import { getNivelMaturidade, getTipoEntrega } from '../lib/calculoMaturidade'
import { carregarConstantes } from '../lib/constantesLoader'
import { getUltimaAtualizacao, papelLabel, NoProjeto } from './dashboard/_shared'
import ProjectSelector from './dashboard/ProjectSelector'
import HomeDash from './dashboard/HomeDash'
import HomeDashDiagnostico from './dashboard/HomeDashDiagnostico'

// ══════════════════════════════════════════════════════════════════════════════
// SHELL — orquestra autenticação, carregamento de projetos/dados e roteamento
// ══════════════════════════════════════════════════════════════════════════════

// produto do projeto → módulo e rota base do módulo
// Carrega o pacote do módulo sob demanda. Se o chunk ficou desatualizado após um
// deploy (erro de import dinâmico), recarrega a página UMA vez p/ pegar a versão nova.
function retryImport(factory) {
  return () => factory().catch((err) => {
    const KEY = 'polimata_chunk_reload_ts'
    let last = 0
    try { last = Number(sessionStorage.getItem(KEY) || 0) } catch (e) {}
    if (Date.now() - last > 10000) {
      try { sessionStorage.setItem(KEY, String(Date.now())) } catch (e) {}
      window.location.reload()
      return new Promise(() => {})
    }
    throw err
  })
}

const Configuracoes = lazy(retryImport(() => import('./Configuracoes')))
const Perfil = lazy(retryImport(() => import('./Perfil')))
const MRCCompleta = lazy(retryImport(() => import('../components/MRCCompleta')))
const ImportarMRC = lazy(retryImport(() => import('../components/ImportarMRC')))
const Relatorios = lazy(retryImport(() => import('./Relatorios')))
const Solicitacoes = lazy(retryImport(() => import('./Solicitacoes')))
const Documentos = lazy(retryImport(() => import('./Documentos')))
const Mapeamentos = lazy(retryImport(() => import('./Mapeamentos')))
const Planejamento = lazy(retryImport(() => import('./Planejamento')))
const OrcDashboard = lazy(retryImport(() => import('./orcamento/DashboardExec')))
const OrcAnalise = lazy(retryImport(() => import('./orcamento/AnaliseMensal')))
const OrcComparativo = lazy(retryImport(() => import('./orcamento/Comparativo')))
const OrcGerador = lazy(retryImport(() => import('./orcamento/Gerador')))
const OrcCadastrar = lazy(retryImport(() => import('./orcamento/CadastrarOrcado')))
const OrcImportar = lazy(retryImport(() => import('./orcamento/Importar')))
const OrcCenarios = lazy(retryImport(() => import('./orcamento/Cenarios')))
const OrcPlanoContas = lazy(retryImport(() => import('./orcamento/PlanoContas')))
const OrcCentros = lazy(retryImport(() => import('./orcamento/CentrosCusto')))
const OrcSobre = lazy(retryImport(() => import('./orcamento/Sobre')))
const OrcFluxo = lazy(retryImport(() => import('./orcamento/FluxoCaixa')))
const OrcImportarTitulos = lazy(retryImport(() => import('./orcamento/ImportarTitulos')))
const OrcImportarOrcado = lazy(retryImport(() => import('./orcamento/ImportarOrcado')))
const PorArea = lazy(retryImport(() => import('./dashboard/PorArea')))

function produtoModulo(produto) {
  if (produto === 'mapeamento') return 'mapeamento'
  if (produto === 'orcamento') return 'orcamento'
  if (produto === 'planejamento') return 'planejamento'
  return 'ci'
}
const ROTA_BASE_MODULO = { ci: '/ci', mapeamento: '/mapeamentos', orcamento: '/orcamento', planejamento: '/planejamento' }

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
  const [simularCliente, setSimularCliente] = useState(false)  // admin pré-visualiza a visão do cliente

  useEffect(() => {
    if (!perfil) return
    carregarConstantes()
      .then(() => loadProjetos())
      .catch(err => {
        console.error('Erro ao inicializar:', err)
        setProjetosLoaded(true)
      })
  }, [perfil?.id])

  async function loadProjetos() {
    try {
      const isCli = ['usuario_cliente', 'gestor_cliente'].includes(perfil?.papel)
      let q = supabase.from('projetos').select('*, clientes(nome, nome_fantasia, slug)').eq('ativo', true)
      if (isCli && perfil?.projeto_id) q = q.eq('id', perfil.projeto_id)
      let { data, error } = await q.order('criado_em', { ascending: false })
      if (error) console.error('Erro ao carregar projetos:', error)
      // Cliente: só enxerga projetos dos módulos liberados (defesa extra)
      if (isCli && Array.isArray(perfil?.modulos)) {
        data = (data || []).filter(p => perfil.modulos.includes(produtoModulo(p.produto)))
      }
      if (data && data.length > 0) {
        setProjetos(data)
        if (isCli) {
          // Cliente entra DIRETO no projeto vinculado — sem seletor, sem trocar
          const alvo = data[0]
          try { localStorage.setItem('polimata_projeto_ativo_id', alvo.id) } catch (e) {}
          setProjetoAtivo(alvo)
          navigate(ROTA_BASE_MODULO[produtoModulo(alvo.produto)], { replace: true })
        } else {
          // Restaurar projeto ativo salvo (mantém usuária na mesma tela após F5)
          try {
            const savedId = localStorage.getItem('polimata_projeto_ativo_id')
            if (savedId) {
              const saved = data.find(p => p.id === savedId)
              if (saved) setProjetoAtivo(saved)
              else localStorage.removeItem('polimata_projeto_ativo_id')
            }
          } catch (e) { /* localStorage indisponível — segue normal */ }
          loadResumos(data).catch(err => console.error('Erro ao carregar resumos:', err))
        }
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

  // Mantém o módulo exibido coerente com o produto do projeto ativo.
  // Sem isto, um projeto de orçamento aberto numa URL de GRC (/ci) exibe o chrome
  // de Controles Internos (estado vazio "Importar Template MRC") em vez do orçamento.
  useEffect(() => {
    if (!projetoAtivo) return
    const path = location.pathname
    // rotas transversais — não atreladas a um produto
    if (path === '/' || path.startsWith('/admin') || path.startsWith('/perfil') || path.startsWith('/configuracoes')) return
    const modProjeto = produtoModulo(projetoAtivo.produto)
    if (moduloDaRota(path) !== modProjeto) {
      navigate(ROTA_BASE_MODULO[modProjeto], { replace: true })
      return
    }
    // Cliente de orçamento (ou admin simulando): acesso só às telas de consulta
    const isCli = ['usuario_cliente', 'gestor_cliente'].includes(perfil?.papel) || (perfil?.papel === 'admin_polimata' && simularCliente)
    if (isCli && modProjeto === 'orcamento') {
      const permitido = ['/orcamento', '/orcamento/analise', '/orcamento/comparativo', '/orcamento/sobre', '/perfil']
      if (!permitido.includes(path)) navigate('/orcamento', { replace: true })
    }
  }, [projetoAtivo, location.pathname, perfil?.papel, simularCliente])

  async function loadDados(pid) {
    setLoading(true)
    try {
      // Buscar áreas, controles e maturidade em paralelo (maturidade vem do banco via RPC)
      const [areasRes, mrcRes, matRes, projRes] = await Promise.all([
        supabase.from('areas').select('id, nome, prefixo, peso, gerente, ordem').eq('projeto_id', pid).order('ordem'),
        supabase.from('mrc').select('*').eq('projeto_id', pid),
        supabase.from('vw_maturidade_areas').select('area_id, percentual, nivel, nome, total_controles, efetivos, inefetivos, gaps, regredidos').eq('projeto_id', pid),
        supabase.from('projetos').select('*, clientes(nome, nome_fantasia, slug)').eq('id', pid).single(),
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
            ? { percentual: parseFloat(mat.percentual) || 0, nivel: mat.nivel, nome: mat.nome, totais: { ativos: mat.total_controles, efetivos: mat.efetivos, inefetivos: mat.inefetivos, gap: mat.gaps, regredidos: mat.regredidos } }
            : { percentual: 0, nivel: 'N1', nome: 'Não confiável', totais: { ativos: 0, efetivos: 0, inefetivos: 0, gap: 0, regredidos: 0 } },
        }
      })
      const resOrdenado = [...res].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setAreasCalc(resOrdenado); setTodosControles(controles)
      // Atualiza o objeto do projeto se a config mudou (ex.: promoção liga f1_tem_teste/num_fases),
      // pra a visão (e a barra de maturidade) trocar sozinha — sem F5. Mantém a referência se nada mudou (evita loop).
      const proj = projRes?.data
      if (proj) setProjetoAtivo(prev => (prev && prev.id === proj.id && prev.f1_tem_teste === proj.f1_tem_teste && prev.num_fases === proj.num_fases && prev.matriz_tamanho === proj.matriz_tamanho) ? prev : proj)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = perfil?.papel === 'admin_polimata'
  const isClienteReal = ['usuario_cliente', 'gestor_cliente'].includes(perfil?.papel)
  const isCliente = isClienteReal || (isAdmin && simularCliente)
  const sw = sidebarOpen ? 260 : 56
  const modulo = moduloDaRota(location.pathname)
  // sidebar/telas seguem o PRODUTO do projeto ativo (não a URL) — evita vazar GRC no orçamento
  const moduloView = projetoAtivo ? produtoModulo(projetoAtivo.produto) : modulo
  const isHomeDash = location.pathname === '/ci'
  const mainLightClass = isHomeDash ? '' : 'main-light'
  const ultimaAtualizacao = useMemo(() => getUltimaAtualizacao(todosControles), [todosControles])
  // Contador da barra lateral: só controles ativos (exclui evitado/transferido/descontinuado), igual ao resto
  const totalControlesAtivos = useMemo(() => (todosControles || []).filter(c => c.ativo !== false && String(c.status_risco || '').toLowerCase() !== 'descontinuado').length, [todosControles])

  // Aguardando carregamento inicial dos projetos
  if (!projetosLoaded) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }
  // Painel Admin — tela própria, fora do contexto de projeto
  if (isAdmin && location.pathname.startsWith('/admin')) {
    return <AdminPanel />
  }
  // Hub de produtos — porta de entrada do Polímata App
  if (modulo === 'hub') {
    return <Hub onProjetos={() => { try { localStorage.removeItem('polimata_projeto_ativo_id') } catch (e) {} ; setProjetoAtivo(null); navigate('/ci') }} onAbrirModulo={(rota) => { if (projetoAtivo && produtoModulo(projetoAtivo.produto) !== moduloDaRota(rota)) { try { localStorage.removeItem('polimata_projeto_ativo_id') } catch (e) {} ; setProjetoAtivo(null) } navigate(rota) }} />
  }
  // Seletor de projetos — exibido quando nenhum projeto está selecionado
  if (!projetoAtivo && projetos.length > 0) {
    return <ProjectSelector projetos={projetos} resumos={projetoResumos} perfil={perfil} produtoAlvo={['ci', 'mapeamento', 'orcamento', 'planejamento'].includes(modulo) ? modulo : null} onProjetoCriado={async (novoId) => {
      const { data } = await supabase.from('projetos').select('*, clientes(nome, nome_fantasia, slug)').eq('id', novoId).single()
      if (data) {
        setProjetos(prev => [data, ...prev])
        try { localStorage.setItem('polimata_projeto_ativo_id', data.id) } catch (e) { /* segue */ }
        setProjetoAtivo(data)
        navigate(data.produto === 'mapeamento' ? '/mapeamentos' : data.produto === 'orcamento' ? '/orcamento' : data.produto === 'planejamento' ? '/planejamento' : '/ci')
      }
    }} onSelect={p => { try { localStorage.setItem('polimata_projeto_ativo_id', p.id) } catch (e) {} ; setProjetoAtivo(p); navigate(p.produto === 'mapeamento' ? '/mapeamentos' : p.produto === 'orcamento' ? '/orcamento' : p.produto === 'planejamento' ? '/planejamento' : '/ci') }} signOut={signOut} onAdmin={isAdmin ? () => navigate('/admin') : null} onHub={isAdmin ? () => navigate('/') : null} />
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
                {projetos.length > 1 && !isCliente && (
                  <button onClick={() => { try { localStorage.removeItem('polimata_projeto_ativo_id') } catch (e) {} ; setProjetoAtivo(null) }}
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
          {isAdmin && <SideNavItem icon="⌂" label="Hub de produtos" active={false} onClick={() => navigate('/')} open={sidebarOpen} />}
          {moduloView === 'ci' && (<>
          {sidebarOpen && <div className="sb-sep">Dashboards</div>}
          <SideNavItem icon="📊" label="Dashboard" active={location.pathname === '/ci'} onClick={() => navigate('/ci')} open={sidebarOpen} />
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
            badge={totalControlesAtivos > 0 ? totalControlesAtivos : null} />
          <SideNavItem icon="📄" label="Relatórios" active={location.pathname === '/relatorios'} onClick={() => navigate('/relatorios')} open={sidebarOpen} />
          {projetoAtivo?.f1_tem_teste !== false && <SideNavItem icon="📝" label="Solicitações" active={location.pathname === '/solicitacoes'} onClick={() => navigate('/solicitacoes')} open={sidebarOpen} />}
          {['admin_polimata', 'consultor_polimata'].includes(perfil?.papel) && <SideNavItem icon="📁" label="Documentos" active={location.pathname === '/documentos'} onClick={() => navigate('/documentos')} open={sidebarOpen} />}
          {isAdmin && (<>{sidebarOpen && <div className="sb-sep">Administração</div>}
            <SideNavItem icon="📥" label="Manutenção MRC" active={location.pathname === '/importar-mrc'} onClick={() => navigate('/importar-mrc')} open={sidebarOpen} /></>)}
          </>)}
          {moduloView === 'mapeamento' && (<>
          {sidebarOpen && <div className="sb-sep">Mapeamento de Processos</div>}
          <SideNavItem icon="🎙" label="Mapeamentos" active={location.pathname === '/mapeamentos'} onClick={() => navigate('/mapeamentos')} open={sidebarOpen} />
          </>)}
          {moduloView === 'orcamento' && (<>
          {isAdmin && sidebarOpen && (
            <button onClick={() => setSimularCliente(v => !v)} title="Pré-visualizar a visão do cliente"
              style={{ margin: '6px 12px 4px', background: simularCliente ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 999, padding: '7px 12px', fontSize: 11, fontWeight: 600, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit', width: 'calc(100% - 24px)' }}>
              {simularCliente ? '← Voltar à visão Admin' : '👁 Visão do Cliente'}
            </button>
          )}
          {sidebarOpen && <div className="sb-sep">Gestão Orçamentária</div>}
          <SideNavItem icon="📊" label="Dashboard Executivo" active={location.pathname === '/orcamento'} onClick={() => navigate('/orcamento')} open={sidebarOpen} />
          <SideNavItem icon="📅" label="Análise Mensal" active={location.pathname === '/orcamento/analise'} onClick={() => navigate('/orcamento/analise')} open={sidebarOpen} />
          <SideNavItem icon="⚖️" label="Orçado vs Realizado" active={location.pathname === '/orcamento/comparativo'} onClick={() => navigate('/orcamento/comparativo')} open={sidebarOpen} />
          {!isCliente && (<>
          {sidebarOpen && <div className="sb-sep">Planejamento</div>}
          <SideNavItem icon="⚡" label="Gerador de Sugestão" active={location.pathname === '/orcamento/gerador'} onClick={() => navigate('/orcamento/gerador')} open={sidebarOpen} />
          <SideNavItem icon="✏️" label="Cadastrar Orçado" active={location.pathname === '/orcamento/orcado'} onClick={() => navigate('/orcamento/orcado')} open={sidebarOpen} />
          <SideNavItem icon="🎭" label="Cenários" active={location.pathname === '/orcamento/cenarios'} onClick={() => navigate('/orcamento/cenarios')} open={sidebarOpen} />
          <SideNavItem icon="💵" label="Fluxo de Caixa" badge="em dev" active={location.pathname === '/orcamento/fluxo'} onClick={() => navigate('/orcamento/fluxo')} open={sidebarOpen} />
          {sidebarOpen && <div className="sb-sep">Operação</div>}
          <SideNavItem icon="🧾" label="Importar Títulos" active={location.pathname === '/orcamento/importar-titulos'} onClick={() => navigate('/orcamento/importar-titulos')} open={sidebarOpen} />
          <SideNavItem icon="📥" label="Importar Realizado" active={location.pathname === '/orcamento/importar'} onClick={() => navigate('/orcamento/importar')} open={sidebarOpen} />
          <SideNavItem icon="📈" label="Importar Orçado" active={location.pathname === '/orcamento/importar-orcado'} onClick={() => navigate('/orcamento/importar-orcado')} open={sidebarOpen} />
          <SideNavItem icon="🗂" label="Plano de Contas" active={location.pathname === '/orcamento/plano-contas'} onClick={() => navigate('/orcamento/plano-contas')} open={sidebarOpen} />
          <SideNavItem icon="🏭" label="Centros de Custo" active={location.pathname === '/orcamento/centros'} onClick={() => navigate('/orcamento/centros')} open={sidebarOpen} />
          </>)}
          <SideNavItem icon="📖" label="Sobre o Sistema" active={location.pathname === '/orcamento/sobre'} onClick={() => navigate('/orcamento/sobre')} open={sidebarOpen} />
          </>)}
          {moduloView === 'planejamento' && (<>
          {sidebarOpen && <div className="sb-sep">Planejamento Estratégico</div>}
          <SideNavItem icon="🧭" label="Planejamento" active={location.pathname === '/planejamento'} onClick={() => navigate('/planejamento')} open={sidebarOpen} />
          </>)}
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
        <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
        <Routes>
          <Route path="/ci" element={
            getTipoEntrega(projetoAtivo) === 'diagnostico'
              ? <HomeDashDiagnostico projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} ultimaAtualizacao={ultimaAtualizacao} loadDados={loadDados} />
              : <HomeDash projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} ultimaAtualizacao={ultimaAtualizacao} loadDados={loadDados} />
          } />
          <Route path="/area/:areaId" element={<PorArea projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} loading={loading} navigate={navigate} loadDados={loadDados} />} />
          <Route path="/mrc" element={<MRCCompleta projetoId={projetoAtivo?.id} projeto={projetoAtivo} clienteNome={formatNomeEmpresa(projetoAtivo?.clientes?.nome_fantasia || projetoAtivo?.clientes?.nome) || ''} projetoNome={projetoAtivo?.nome || ''} notificacoes={<NotificacoesPanel />} papel={perfil?.papel} />} />
          <Route path="/relatorios" element={<Relatorios projeto={projetoAtivo} areasCalc={areasCalc} todosControles={todosControles} clienteNome={formatNomeEmpresa(projetoAtivo?.clientes?.nome_fantasia || projetoAtivo?.clientes?.nome) || ''} projetoNome={projetoAtivo?.nome || ''} />} />
          <Route path="/solicitacoes" element={<Solicitacoes projeto={projetoAtivo} />} />
          <Route path="/documentos" element={<Documentos projeto={projetoAtivo} />} />
          <Route path="/mapeamentos" element={<Mapeamentos projeto={projetoAtivo} />} />
          <Route path="/planejamento" element={<Planejamento projeto={projetoAtivo} />} />
          <Route path="/orcamento" element={<OrcDashboard projeto={projetoAtivo} />} />
          <Route path="/orcamento/analise" element={<OrcAnalise projeto={projetoAtivo} />} />
          <Route path="/orcamento/fluxo" element={<OrcFluxo projeto={projetoAtivo} />} />
          <Route path="/orcamento/comparativo" element={<OrcComparativo projeto={projetoAtivo} />} />
          <Route path="/orcamento/gerador" element={<OrcGerador projeto={projetoAtivo} />} />
          <Route path="/orcamento/orcado" element={<OrcCadastrar projeto={projetoAtivo} />} />
          <Route path="/orcamento/cenarios" element={<OrcCenarios projeto={projetoAtivo} />} />
          <Route path="/orcamento/importar" element={<OrcImportar projeto={projetoAtivo} />} />
          <Route path="/orcamento/importar-orcado" element={<OrcImportarOrcado projeto={projetoAtivo} />} />
          <Route path="/orcamento/importar-titulos" element={<OrcImportarTitulos projeto={projetoAtivo} />} />
          <Route path="/orcamento/plano-contas" element={<OrcPlanoContas projeto={projetoAtivo} />} />
          <Route path="/orcamento/centros" element={<OrcCentros projeto={projetoAtivo} />} />
          <Route path="/orcamento/sobre" element={<OrcSobre projeto={projetoAtivo} />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
          <Route path="/importar-mrc" element={<ImportarMRC projetoId={projetoAtivo?.id} projeto={projetoAtivo} areas={areasCalc} onImported={() => { if (projetoAtivo?.id) loadDados(projetoAtivo.id) }} />} />
          <Route path="/perfil" element={<Perfil />} />
        </Routes>
        </Suspense>
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
