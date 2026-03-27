import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Configuracoes from './Configuracoes'
import Perfil from './Perfil'
import MRCCompleta from '../components/MRCCompleta'

// ── Dados das fases (pesos fixos da metodologia Polímata) ──────────────────
const FASES = [
  { id: 'f1',   label: 'F1',      nome: 'Diagnóstico Inicial',              peso: 0.10  },
  { id: 'f2e1', label: 'F2-E1',   nome: 'Plano de Ação e Teste de Desenho', peso: 0.125 },
  { id: 'f2e2', label: 'F2-E2',   nome: 'Teste de Aderência',               peso: 0.125 },
  { id: 'f3',   label: 'F3',      nome: 'Revisão dos Controles Internos',   peso: 0.25  },
  { id: 'f4',   label: 'F4',      nome: 'Auditoria Contínua',               peso: 0.40  },
  { id: 'f5',   label: 'F5',      nome: 'Auditoria Externa',                peso: 0.10  },
]

export default function Dashboard() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [projetos, setProjetos] = useState([])
  const [projetoAtivo, setProjetoAtivo] = useState(null)

  useEffect(() => { loadProjetos() }, [])

  async function loadProjetos() {
    const { data } = await supabase
      .from('projetos')
      .select('*, clientes(nome, slug)')
      .eq('ativo', true)
      .order('criado_em', { ascending: false })
    if (data) {
      setProjetos(data)
      if (data.length > 0) setProjetoAtivo(data[0])
    }
  }

  const isAdmin = perfil?.papel === 'admin_polimata'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-brand" style={{ padding: '12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
          <img src="/logotipo-2cores.png" alt="Polímata"
            style={{ width: '100%', maxWidth: 200, height: 'auto', objectFit: 'contain', display: 'block' }} />
        </div>

        {projetos.length > 0 && (
          <div className="sb-projeto">
            <div className="sb-projeto-label">Projeto ativo</div>
            <select className="sb-projeto-sel" value={projetoAtivo?.id || ''}
              onChange={e => setProjetoAtivo(projetos.find(p => p.id === e.target.value))}>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>{p.clientes?.nome} · {p.nome}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="sb-nav">
          <NavItem icon="⊞" label="Dashboard"    active={location.pathname === '/'}    onClick={() => navigate('/')} />
          <NavItem icon="⊟" label="MRC Completa" active={location.pathname === '/mrc'} onClick={() => navigate('/mrc')} />
          {isAdmin && (
            <>
              <div className="sb-sep">Administração</div>
              <NavItem icon="⚙" label="Configurações" active={location.pathname.startsWith('/configuracoes')} onClick={() => navigate('/configuracoes')} />
            </>
          )}
        </nav>

        <div className="sb-footer">
          <div className="sb-user" style={{ cursor: 'pointer' }} onClick={() => navigate('/perfil')}>
            <div className="sb-user-avatar">
              {perfil?.avatar_url
                ? <img src={perfil.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : perfil?.nome?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="sb-user-nome">{perfil?.nome}</div>
              <div className="sb-user-papel">{papelLabel(perfil?.papel)}</div>
            </div>
          </div>
          <button className="sb-sair" onClick={signOut} title="Sair">↩</button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/"              element={<HomeDash projeto={projetoAtivo} />} />
          <Route path="/mrc"           element={<MRCCompleta projetoId={projetoAtivo?.id} />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
          <Route path="/perfil"        element={<Perfil />} />
        </Routes>
      </main>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function papelLabel(papel) {
  const map = { admin_polimata: 'Admin Polímata', consultor_polimata: 'Consultor', gestor_cliente: 'Gestor', usuario_cliente: 'Usuário' }
  return map[papel] || papel || '—'
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD DE MATURIDADE
// ══════════════════════════════════════════════════════════════════════════════
function HomeDash({ projeto }) {
  const [areas, setAreas]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projeto?.id) loadAreas(projeto.id)
  }, [projeto])

  async function loadAreas(projetoId) {
    setLoading(true)
    const { data } = await supabase
      .from('areas')
      .select('id, nome, prefixo, peso, gerente, ordem')
      .eq('projeto_id', projetoId)
      .order('ordem')

    const areasComIndice = await Promise.all((data || []).map(async (area) => {
      const { data: controles } = await supabase
        .from('mrc')
        .select('resultado, impacto, probabilidade, criticidade, fase_atual')
        .eq('area_id', area.id)

      return { ...area, controles: controles || [], indice: calcularIndiceMaturidade(controles || [], area.peso) }
    }))

    setAreas(areasComIndice)
    setLoading(false)
  }

  const indiceGeral = areas.reduce((acc, a) => acc + (a.indice?.geral || 0), 0)
  const totalControles = areas.reduce((acc, a) => acc + a.controles.length, 0)

  const ranking = [...areas]
    .filter(a => a.controles.length > 0)
    .sort((a, b) => (b.indice?.percentual || 0) - (a.indice?.percentual || 0))

  const dist = areas.reduce((acc, a) => {
    a.controles.forEach(c => {
      const r = c.resultado?.toLowerCase()
      if (r === 'efetivo') acc.efetivo++
      else if (r === 'inefetivo') acc.inefetivo++
      else if (r === 'gap') acc.gap++
      else acc.pendente++
    })
    return acc
  }, { efetivo: 0, inefetivo: 0, gap: 0, pendente: 0 })

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (!projeto) return (
    <div className="page-wrap">
      <div className="empty-state">
        <div className="empty-icon">⊞</div>
        <div className="empty-title">Nenhum projeto ativo</div>
        <div className="empty-desc">Selecione ou cadastre um projeto para visualizar o dashboard.</div>
      </div>
    </div>
  )

  return (
    <div className="page-wrap">
      <div className="page-hdr">
        <h1 className="page-title">Dashboard</h1>
        {projeto && <span className="page-badge">{projeto.clientes?.nome} · {projeto.nome}</span>}
      </div>

      <div className="dash-kpis">
        <KPICard
          label="Índice de Maturidade"
          valor={`${(indiceGeral * 100).toFixed(1)}%`}
          sub="Índice geral ponderado"
          cor="var(--gold)"
          icon="◎"
        />
        <KPICard
          label="Total de Controles"
          valor={totalControles}
          sub={`${areas.length} área${areas.length !== 1 ? 's' : ''} mapeadas`}
          cor="var(--navy-700)"
          icon="⊟"
        />
        <KPICard
          label="Efetivos"
          valor={dist.efetivo}
          sub={totalControles > 0 ? `${((dist.efetivo / totalControles) * 100).toFixed(0)}% do total` : '—'}
          cor="var(--gold)"
          icon="✓"
        />
        <KPICard
          label="GAP + Inefetivos"
          valor={dist.gap + dist.inefetivo}
          sub={totalControles > 0 ? `${(((dist.gap + dist.inefetivo) / totalControles) * 100).toFixed(0)}% do total` : '—'}
          cor="var(--gold-md)"
          icon="✕"
        />
      </div>

      <div className="dash-section">
        <div className="dash-section-title">Progresso por Fase</div>
        <div className="dash-fases">
          {FASES.map(f => {
            const progresso = calcularProgressoFase(areas, f.id)
            return (
              <FaseBar
                key={f.id}
                label={f.label}
                nome={f.nome}
                peso={f.peso}
                progresso={progresso}
              />
            )
          })}
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dash-card-title">Ranking por Área</div>
          <div className="dash-ranking">
            {ranking.map((a, i) => (
              <div key={a.id} className="dash-rank-row">
                <div className="dash-rank-pos" style={{ color: i < 3 ? 'var(--gold)' : 'var(--txt3)' }}>
                  {i + 1}
                </div>
                <div className="dash-rank-nome">{a.nome}</div>
                <div className="dash-rank-bar-wrap">
                  <div className="dash-rank-bar">
                    <div className="dash-rank-bar-fill"
                      style={{ width: `${Math.min((a.indice?.percentual || 0) * 100, 100)}%`, background: getCorMaturidade(a.indice?.percentual || 0) }} />
                  </div>
                </div>
                <div className="dash-rank-pct" style={{ color: getCorMaturidade(a.indice?.percentual || 0) }}>
                  {((a.indice?.percentual || 0) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
            {ranking.length === 0 && <div className="cfg-empty">Sem dados de controles cadastrados.</div>}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-title">Mapa de Calor — Risco</div>
          <HeatMap areas={areas} />
        </div>
      </div>

      <div className="dash-section">
        <div className="dash-section-title">Distribuição por Criticidade</div>
        <div className="dash-crit-grid">
          {['Crítico', 'Significativo', 'Moderado', 'Baixo'].map(crit => {
            const total = areas.reduce((acc, a) => acc + a.controles.filter(c => c.criticidade === crit).length, 0)
            const ef    = areas.reduce((acc, a) => acc + a.controles.filter(c => c.criticidade === crit && c.resultado?.toLowerCase() === 'efetivo').length, 0)
            const inef  = areas.reduce((acc, a) => acc + a.controles.filter(c => c.criticidade === crit && c.resultado?.toLowerCase() === 'inefetivo').length, 0)
            const gap   = areas.reduce((acc, a) => acc + a.controles.filter(c => c.criticidade === crit && c.resultado?.toLowerCase() === 'gap').length, 0)
            const cor   = { Crítico: '#A6512F', Significativo: '#CC915E', Moderado: '#DFB080', Baixo: '#1D3B5C' }[crit]
            return (
              <div key={crit} className="dash-crit-card" style={{ borderColor: cor + '44' }}>
                <div className="dash-crit-label" style={{ color: cor }}>{crit}</div>
                <div className="dash-crit-total">{total}</div>
                <div className="dash-crit-bars">
                  <span style={{ color: '#CC915E', fontSize: 11 }}>✓ {ef}</span>
                  <span style={{ color: '#A6512F', fontSize: 11 }}>⚠ {inef}</span>
                  <span style={{ color: '#6C2D10', fontSize: 11 }}>✕ {gap}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, valor, sub, cor, icon }) {
  return (
    <div className="dash-kpi-card">
      <div className="dash-kpi-icon" style={{ color: cor }}>{icon}</div>
      <div className="dash-kpi-body">
        <div className="dash-kpi-label">{label}</div>
        <div className="dash-kpi-valor" style={{ color: cor }}>{valor}</div>
        <div className="dash-kpi-sub">{sub}</div>
      </div>
    </div>
  )
}

// ── Barra de fase ─────────────────────────────────────────────────────────────
function FaseBar({ label, nome, peso, progresso }) {
  const pct = Math.min(progresso * 100, 100)
  const cor = getCorMaturidade(progresso)
  return (
    <div className="fase-bar-wrap">
      <div className="fase-bar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="fase-badge" style={{ background: cor + '22', color: cor, border: `1px solid ${cor}44` }}>{label}</span>
          <span className="fase-nome">{nome}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="fase-peso">Peso {(peso * 100).toFixed(0)}%</span>
          <span className="fase-pct" style={{ color: cor }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="fase-bar-track">
        <div className="fase-bar-fill" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  )
}

// ── Mapa de Calor ─────────────────────────────────────────────────────────────
function HeatMap({ areas }) {
  const cores = {
    '1,1': '#00B050', '1,2': '#00B050', '2,1': '#00B050',
    '1,3': '#FFFF00', '2,2': '#FFFF00', '3,1': '#FFFF00',
    '1,4': '#FFC000', '2,3': '#FFC000', '3,2': '#FFC000', '4,1': '#FFC000',
    '2,4': '#FF0000', '3,3': '#FF0000', '3,4': '#FF0000', '4,2': '#FF0000', '4,3': '#FF0000', '4,4': '#FF0000',
  }

  const celulas = {}
  areas.forEach(a => {
    a.controles.forEach(c => {
      if (c.impacto && c.probabilidade) {
        const key = `${c.impacto},${c.probabilidade}`
        celulas[key] = (celulas[key] || 0) + 1
      }
    })
  })

  const labels = ['Baixo', 'Moderado', 'Significativo', 'Crítico']

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-ylabel">← Probabilidade</div>
      <div className="heatmap-main">
        <div className="heatmap-grid">
          {[4,3,2,1].map(prob => (
            [1,2,3,4].map(imp => {
              const key = `${imp},${prob}`
              const count = celulas[key] || 0
              const cor = cores[key] || '#1a3a5c'
              return (
                <div key={key} className="heatmap-cell" style={{ background: cor + '33', border: `1px solid ${cor}66` }}>
                  {count > 0 && <span style={{ color: cor, fontWeight: 700, fontSize: 13 }}>{count}</span>}
                </div>
              )
            })
          ))}
        </div>
        <div className="heatmap-xlabel">Impacto →</div>
        <div className="heatmap-xlabels">
          {labels.map(l => <span key={l} className="heatmap-axis-label">{l}</span>)}
        </div>
      </div>
      <div className="heatmap-ylabels">
        {[...labels].reverse().map(l => <span key={l} className="heatmap-axis-label">{l}</span>)}
      </div>
    </div>
  )
}

// ── Funções de cálculo ────────────────────────────────────────────────────────
function calcularIndiceMaturidade(controles, pesoArea) {
  if (!controles.length) return { geral: 0, percentual: 0 }

  const PESO_CRIT = { 'Crítico': 0.4, 'Significativo': 0.3, 'Moderado': 0.2, 'Baixo': 0.1 }

  let somaF1 = 0, totalPeso = 0
  controles.forEach(c => {
    const p = PESO_CRIT[c.criticidade] || 0.1
    totalPeso += p
    const r = c.resultado?.toLowerCase()
    if (r === 'efetivo')     somaF1 += p * 1
    else if (r === 'inefetivo') somaF1 += p * -0.75
    else if (r === 'gap')    somaF1 += p * -1
  })

  const indiceF1 = totalPeso > 0 ? somaF1 / totalPeso : 0
  const percentual = Math.max(0, (indiceF1 + 1) / 2)
  const geral = percentual * 0.10 * (pesoArea || 0.1)

  return { geral, percentual, indiceF1 }
}

function calcularProgressoFase(areas, faseId) {
  if (!areas.length) return 0
  const totalControles = areas.reduce((acc, a) => acc + a.controles.length, 0)
  if (!totalControles) return 0

  if (faseId === 'f1') {
    const comResultado = areas.reduce((acc, a) =>
      acc + a.controles.filter(c => c.resultado && c.resultado !== '').length, 0)
    return comResultado / totalControles
  }
  const faseMap = { f1: 'F1', f2e1: 'F2-E1', f2e2: 'F2-E2', f3: 'F3', f4: 'F4', f5: 'F5' }
  const fases_ordem = ['F1', 'F2-E1', 'F2-E2', 'F3', 'F4', 'F5']
  const faseAtual = faseMap[faseId]
  const faseIdx = fases_ordem.indexOf(faseAtual)

  const concluidos = areas.reduce((acc, a) =>
    acc + a.controles.filter(c => {
      const idx = fases_ordem.indexOf(c.fase_atual)
      return idx >= faseIdx
    }).length, 0)

  return concluidos / totalControles
}

function getCorMaturidade(pct) {
  if (pct >= 0.75) return '#CC915E'   /* dourado */
  if (pct >= 0.50) return '#DFB080'   /* dourado claro */
  if (pct >= 0.25) return '#A6512F'   /* terracota */
  return '#6C2D10'                     /* marrom escuro */
}
