import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Configuracoes from './Configuracoes'
import Perfil from './Perfil'
import MRCCompleta from '../components/MRCCompleta'
import {
  calcularPercentualArea,
  calcularIndiceEmpresa,
  getNivelMaturidade,
  PESO_FASE,
} from '../lib/calculoMaturidade'

// ── Dados das fases (pesos fixos da metodologia Polímata) ──────────────────
const FASES = [
  { id: 'F1',   label: 'F1',    nome: 'Diagnóstico Inicial',              peso: PESO_FASE.F1   },
  { id: 'F2E1', label: 'F2-E1', nome: 'Plano de Ação e Teste de Desenho', peso: PESO_FASE.F2E1 },
  { id: 'F2E2', label: 'F2-E2', nome: 'Teste de Aderência',               peso: PESO_FASE.F2E2 },
  { id: 'F3',   label: 'F3',    nome: 'Revisão dos Controles Internos',   peso: PESO_FASE.F3   },
  { id: 'F4C1', label: 'F4-C1', nome: 'Auditoria Contínua — Ciclo 1',    peso: PESO_FASE.F4C1 },
  { id: 'F4C2', label: 'F4-C2', nome: 'Auditoria Contínua — Ciclo 2',    peso: PESO_FASE.F4C2 },
  { id: 'F5',   label: 'F5',    nome: 'Auditoria Independente',           peso: PESO_FASE.F5   },
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
// DASHBOARD DE MATURIDADE — integrado com engine de cálculo (metodologia v3)
// ══════════════════════════════════════════════════════════════════════════════

function HomeDash({ projeto }) {
  const [areasCalc, setAreasCalc] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projeto?.id) loadDados(projeto.id)
  }, [projeto])

  async function loadDados(projetoId) {
    setLoading(true)

    // Buscar áreas com peso
    const { data: areasData } = await supabase
      .from('areas')
      .select('id, nome, prefixo, peso, gerente, ordem')
      .eq('projeto_id', projetoId)
      .order('ordem')

    // Buscar TODOS os controles do projeto (mesma query da MRC)
    const { data: mrcData } = await supabase
      .from('mrc')
      .select('*')
      .eq('projeto_id', projetoId)

    const controles = mrcData || []
    const areas = areasData || []

    // Agrupar controles por área (usando campo 'area' = nome da área)
    // e também por area_id se disponível
    const resultado = areas.map(area => {
      const controlesArea = controles.filter(c =>
        c.area_id === area.id || c.area === area.nome
      )

      // Determinar se F1 está concluída (todos controles têm r1 preenchido)
      const f1Concluida = controlesArea.length > 0 &&
        controlesArea.every(c => c.r1 && c.r1 !== 'Teste Não Realizado')

      // Calcular com a engine real
      const calc = calcularPercentualArea(controlesArea, f1Concluida)

      return {
        ...area,
        controles: controlesArea,
        calc,
      }
    })

    setAreasCalc(resultado)
    setLoading(false)
  }

  // ── Índice consolidado da empresa (média ponderada) ──
  const areasParaConsolidado = areasCalc.map(a => ({
    nome: a.nome,
    peso: a.peso || 0,
    percentual: a.calc?.percentual || 0,
  }))
  const empresa = calcularIndiceEmpresa(areasParaConsolidado)

  // ── Totais ──
  const totalControles = areasCalc.reduce((acc, a) => acc + a.controles.length, 0)
  const totalAtivos = areasCalc.reduce((acc, a) => acc + (a.calc?.totais?.ativos || 0), 0)

  const dist = areasCalc.reduce((acc, a) => {
    a.controles.forEach(c => {
      const r = (c.r1 || '').toLowerCase()
      if (r === 'efetivo') acc.efetivo++
      else if (r === 'inefetivo') acc.inefetivo++
      else if (r === 'gap') acc.gap++
      else acc.pendente++
    })
    return acc
  }, { efetivo: 0, inefetivo: 0, gap: 0, pendente: 0 })

  const totalRegredidos = areasCalc.reduce((acc, a) => acc + (a.calc?.totais?.regredidos || 0), 0)

  // ── Ranking por área (percentual real da engine) ──
  const ranking = [...areasCalc]
    .filter(a => a.controles.length > 0)
    .sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0))

  // ── Progresso por fase (conta controles que já passaram por cada fase) ──
  function calcularProgressoFase(faseId) {
    let total = 0, concluidos = 0
    areasCalc.forEach(a => {
      a.calc?.detalhePorControle?.forEach(d => {
        total++
        const fases = d.detalheFases || {}
        if (faseId === 'F1') {
          if (fases.F1?.resultado) concluidos++
        } else if (faseId === 'F2E1') {
          if (fases.F2E1?.resultado && fases.F2E1.resultado !== 'auto→regrediu') concluidos++
        } else if (faseId === 'F2E2') {
          if (fases.F2E2?.resultado && fases.F2E2.resultado !== 'auto→regrediu') concluidos++
        } else if (faseId === 'F3') {
          if (fases.F3?.resultado) concluidos++
        } else if (faseId === 'F4C1') {
          if (fases.F4C1?.resultado && fases.F4C1.resultado !== 'N/A') concluidos++
        } else if (faseId === 'F4C2') {
          if (fases.F4C2?.resultado && fases.F4C2.resultado !== 'N/A') concluidos++
        } else if (faseId === 'F5') {
          if (fases.F5?.resultado) concluidos++
        }
      })
    })
    return total > 0 ? concluidos / total : 0
  }

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
          valor={`${(empresa.indice * 100).toFixed(1)}%`}
          sub={`${empresa.nivel} — ${empresa.nome}`}
          cor="var(--gold)"
          icon="◎"
        />
        <KPICard
          label="Total de Controles"
          valor={totalControles}
          sub={`${areasCalc.length} área${areasCalc.length !== 1 ? 's' : ''} · ${totalAtivos} ativos`}
          cor="var(--navy-700)"
          icon="⊟"
        />
        <KPICard
          label="Efetivos"
          valor={dist.efetivo}
          sub={totalControles > 0 ? `${((dist.efetivo / totalControles) * 100).toFixed(0)}% do total` : '—'}
          cor="#22D4A0"
          icon="✓"
        />
        <KPICard
          label="GAP + Inefetivos"
          valor={dist.gap + dist.inefetivo}
          sub={totalRegredidos > 0 ? `${totalRegredidos} em regressão` : totalControles > 0 ? `${(((dist.gap + dist.inefetivo) / totalControles) * 100).toFixed(0)}% do total` : '—'}
          cor="#F05656"
          icon="✕"
        />
      </div>

      <div className="dash-section">
        <div className="dash-section-title">Progresso por Fase</div>
        <div className="dash-fases">
          {FASES.map(f => (
            <FaseBar
              key={f.id}
              label={f.label}
              nome={f.nome}
              peso={f.peso}
              progresso={calcularProgressoFase(f.id)}
            />
          ))}
        </div>
      </div>

      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dash-card-title">Ranking por Área</div>
          <div className="dash-ranking">
            {ranking.map((a, i) => {
              const pct = a.calc?.percentual || 0
              const nivel = getNivelMaturidade(pct)
              return (
                <div key={a.id} className="dash-rank-row">
                  <div className="dash-rank-pos" style={{ color: i < 3 ? 'var(--gold)' : 'var(--txt3)' }}>
                    {i + 1}
                  </div>
                  <div className="dash-rank-nome">{a.nome}</div>
                  <div className="dash-rank-bar-wrap">
                    <div className="dash-rank-bar">
                      <div className="dash-rank-bar-fill"
                        style={{ width: `${Math.min(pct * 100, 100)}%`, background: getCorMaturidade(pct) }} />
                    </div>
                  </div>
                  <div className="dash-rank-nivel" style={{ fontSize: 10, color: 'var(--txt3)', minWidth: 20, textAlign: 'center' }}>
                    {nivel.nivel}
                  </div>
                  <div className="dash-rank-pct" style={{ color: getCorMaturidade(pct) }}>
                    {(pct * 100).toFixed(1)}%
                  </div>
                </div>
              )
            })}
            {ranking.length === 0 && <div className="cfg-empty">Sem dados de controles cadastrados.</div>}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-title">Mapa de Calor — Risco</div>
          <HeatMap areas={areasCalc} />
        </div>
      </div>

      <div className="dash-section">
        <div className="dash-section-title">Distribuição por Criticidade</div>
        <div className="dash-crit-grid">
          {[
            { label: 'Crítico',       valor: 4 },
            { label: 'Significativo', valor: 3 },
            { label: 'Moderado',      valor: 2 },
            { label: 'Baixo',         valor: 1 },
          ].map(({ label, valor }) => {
            const total = areasCalc.reduce((acc, a) => acc + a.controles.filter(c => c.crit === valor).length, 0)
            const ef    = areasCalc.reduce((acc, a) => acc + a.controles.filter(c => c.crit === valor && (c.r1 || '').toLowerCase() === 'efetivo').length, 0)
            const inef  = areasCalc.reduce((acc, a) => acc + a.controles.filter(c => c.crit === valor && (c.r1 || '').toLowerCase() === 'inefetivo').length, 0)
            const gap   = areasCalc.reduce((acc, a) => acc + a.controles.filter(c => c.crit === valor && (c.r1 || '').toLowerCase() === 'gap').length, 0)
            const cor   = { Crítico: '#EF4444', Significativo: '#F97316', Moderado: '#F5B942', Baixo: '#22D4A0' }[label]
            return (
              <div key={label} className="dash-crit-card" style={{ borderColor: cor + '44' }}>
                <div className="dash-crit-label" style={{ color: cor }}>{label}</div>
                <div className="dash-crit-total">{total}</div>
                <div className="dash-crit-bars">
                  <span style={{ color: '#22D4A0', fontSize: 11 }}>✓ {ef}</span>
                  <span style={{ color: '#F97316', fontSize: 11 }}>⚠ {gap}</span>
                  <span style={{ color: '#F05656', fontSize: 11 }}>✕ {inef}</span>
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

  // Mapear impacto/probabilidade textual → numérico
  const impMap  = { 'Baixo': 1, 'Moderado': 2, 'Alto': 3, 'Crítico': 4 }
  const probMap = { 'Baixa': 1, 'Média': 2, 'Alta': 3, 'Extrema': 4 }

  const celulas = {}
  areas.forEach(a => {
    a.controles.forEach(c => {
      const impVal  = impMap[c.imp] || c.impacto
      const probVal = probMap[c.prob] || c.probabilidade
      if (impVal && probVal) {
        const key = `${impVal},${probVal}`
        celulas[key] = (celulas[key] || 0) + 1
      }
    })
  })

  const labels = ['Baixo', 'Moderado', 'Alto', 'Crítico']

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

// ── Cor por nível de maturidade ──────────────────────────────────────────────
function getCorMaturidade(pct) {
  if (pct >= 0.81) return '#22D4A0'   /* N5 verde */
  if (pct >= 0.51) return '#66BB6A'   /* N4 verde claro */
  if (pct >= 0.26) return '#F5B942'   /* N3 amarelo */
  if (pct >= 0.11) return '#F97316'   /* N2 laranja */
  return '#F05656'                     /* N1 vermelho */
}
