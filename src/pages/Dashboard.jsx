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

// ══════════════════════════════════════════════════════════════════════════════
// SHELL — Sidebar (dark) + Main (rotas)
// ══════════════════════════════════════════════════════════════════════════════

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
          <NavItem icon="⊞" label="Dashboard" active={location.pathname === '/'} onClick={() => navigate('/')} />
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
          <Route path="/" element={<HomeDash projeto={projetoAtivo} />} />
          <Route path="/mrc" element={<MRCCompleta projetoId={projetoAtivo?.id} />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
          <Route path="/perfil" element={<Perfil />} />
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
// CONSTANTES DO DASH MATURIDADE
// ══════════════════════════════════════════════════════════════════════════════

const NIVEIS = [
  { id: 'N5', nome: 'Otimizado', faixa: '81% à 100%', cor: '#1B5E20' },
  { id: 'N4', nome: 'Monitorado', faixa: '51% à 80%', cor: '#558B2F' },
  { id: 'N3', nome: 'Padronizado', faixa: '26% à 50%', cor: '#F9A825' },
  { id: 'N2', nome: 'Informal', faixa: '11% à 25%', cor: '#E65100' },
  { id: 'N1', nome: 'Não confiável', faixa: '0% à 10%', cor: '#B71C1C' },
]

const FASES_INFO = [
  { id: 'F1', label: 'Fase 1', nome: 'Diagnóstico Inicial', peso: '10%', cor: '#5C6B7A' },
  { id: 'F2', label: 'Fase 2', nome: 'Planos de Ação e Teste de Aderência', peso: '25%', cor: '#7A8A5C' },
  { id: 'F3', label: 'Fase 3', nome: 'Revisão dos Controles Internos', peso: '25%', cor: '#C4A35A' },
  { id: 'F4', label: 'Fase 4', nome: 'Auditoria Contínua', peso: '30%', cor: '#C47A5A' },
  { id: 'F5', label: 'Fase 5', nome: 'Auditoria Independente', peso: '10%', cor: '#8B4A5A' },
]

const GAUGE_GRADIENT = 'linear-gradient(90deg, #B71C1C 0%, #E65100 20%, #F9A825 40%, #558B2F 65%, #1B5E20 100%)'

function getCorNivel(pct) {
  if (pct >= 0.81) return '#1B5E20'
  if (pct >= 0.51) return '#558B2F'
  if (pct >= 0.26) return '#F9A825'
  if (pct >= 0.11) return '#E65100'
  return '#B71C1C'
}

// ══════════════════════════════════════════════════════════════════════════════
// DASH MATURIDADE — Réplica da aba Excel
// ══════════════════════════════════════════════════════════════════════════════

function HomeDash({ projeto }) {
  const [areasCalc, setAreasCalc] = useState([])
  const [loading, setLoading] = useState(true)
  const [areaSel, setAreaSel] = useState('')

  useEffect(() => {
    if (projeto?.id) loadDados(projeto.id)
  }, [projeto])

  async function loadDados(projetoId) {
    setLoading(true)
    const { data: areasData } = await supabase
      .from('areas')
      .select('id, nome, prefixo, peso, gerente, ordem')
      .eq('projeto_id', projetoId)
      .order('ordem')

    const { data: mrcData } = await supabase
      .from('mrc')
      .select('*')
      .eq('projeto_id', projetoId)

    const controles = mrcData || []
    const areas = areasData || []

    const resultado = areas.map(area => {
      const controlesArea = controles.filter(c =>
        c.area_id === area.id || c.area === area.nome
      )
      const f1Concluida = controlesArea.length > 0 &&
        controlesArea.every(c => c.r1 && c.r1 !== 'Teste Não Realizado')
      const calc = calcularPercentualArea(controlesArea, f1Concluida)
      return { ...area, controles: controlesArea, calc }
    })

    setAreasCalc(resultado)
    if (resultado.length > 0) setAreaSel(resultado[0].nome)
    setLoading(false)
  }

  // Índice consolidado empresa
  const areasParaConsolidado = areasCalc.map(a => ({
    nome: a.nome,
    peso: a.peso || 0,
    percentual: a.calc?.percentual || 0,
  }))
  const empresa = calcularIndiceEmpresa(areasParaConsolidado)

  // Área selecionada
  const areaAtiva = areasCalc.find(a => a.nome === areaSel)

  // Ranking ordenado
  const ranking = [...areasCalc]
    .filter(a => a.controles.length > 0)
    .sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0))

  // Contribuição por fase (empresa) — média ponderada das contribuições de cada área
  function calcContribFaseEmpresa() {
    const somaPesos = areasCalc.reduce((s, x) => s + (x.peso || 0), 0) || 1
    let f1 = 0, f2 = 0, f3 = 0, f4 = 0, f5 = 0
    areasCalc.forEach(a => {
      const pesoArea = (a.peso || 0) / somaPesos
      const ca = calcContribFaseArea(a)
      f1 += ca.f1 * pesoArea
      f2 += ca.f2 * pesoArea
      f3 += ca.f3 * pesoArea
      f4 += ca.f4 * pesoArea
      f5 += ca.f5 * pesoArea
    })
    return { f1, f2, f3, f4, f5 }
  }

  // Contribuição por fase (área)
  function calcContribFaseArea(area) {
    if (!area?.calc) return { f1: 0, f2: 0, f3: 0, f4: 0, f5: 0 }
    const f1 = area.calc.percentual > 0 ? 0.10 : 0
    let f2 = 0, f3 = 0, f4 = 0, f5 = 0
    ;(area.calc.detalhePorControle || []).forEach(d => {
      const fases = d.detalheFases || {}
      f2 += (fases.F2E1?.contribuicao || 0) + (fases.F2E2?.contribuicao || 0)
      f3 += fases.F3?.contribuicao || 0
      f4 += (fases.F4C1?.contribuicao || 0) + (fases.F4C2?.contribuicao || 0)
      f5 += fases.F5?.contribuicao || 0
    })
    return { f1, f2, f3, f4, f5 }
  }

  const contribEmpresa = calcContribFaseEmpresa()
  const contribArea = calcContribFaseArea(areaAtiva)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F3EEE4' }}>
      <div className="spinner" />
    </div>
  )

  if (!projeto) return (
    <div style={{ background: '#F3EEE4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>⊞</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#555', marginTop: 12 }}>Nenhum projeto ativo</div>
        <div style={{ fontSize: 13, color: '#888' }}>Selecione ou cadastre um projeto.</div>
      </div>
    </div>
  )

  return (
    <div className="dm-page">
      {/* ─── Título ─── */}
      <div className="dm-title-bar">
        <span className="dm-title">Maturidade do Ambiente de Controles Internos</span>
        <span className="dm-badge">{projeto.clientes?.nome} · {projeto.nome}</span>
      </div>

      {/* ─── Grid 3 colunas ─── */}
      <div className="dm-grid">

        {/* ── Coluna Esquerda ── */}
        <div className="dm-col-left">
          <div className="dm-card">
            <div className="dm-meta-label">Última Atualização</div>
            <div className="dm-meta-value">{new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="dm-card">
            <div className="dm-meta-label">Métrica de Maturidade</div>
            <div className="dm-regua">
              {NIVEIS.map(n => (
                <div key={n.id} className="dm-regua-item">
                  <div className="dm-regua-dot" style={{ background: n.cor }} />
                  <div>
                    <div className="dm-regua-nome" style={{ color: n.cor }}>{n.id} - {n.nome}</div>
                    <div className="dm-regua-faixa">{n.faixa}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Coluna Central ── */}
        <div className="dm-col-center">

          {/* Visão Empresa */}
          <div className="dm-card">
            <div className="dm-visao-header">
              <span className="dm-visao-label">Visão</span>
              <span className="dm-visao-nome">{projeto.clientes?.nome || 'Empresa'}</span>
            </div>
            <div className="dm-visao-body">
              <div className="dm-index-big">{(empresa.indice * 100).toFixed(2)}%</div>
              <div className="dm-fases-row">
                {[
                  { label: 'Fase 1', val: contribEmpresa.f1 },
                  { label: 'Fase 2', val: contribEmpresa.f2 },
                  { label: 'Fase 3', val: contribEmpresa.f3 },
                  { label: 'Fase 4', val: contribEmpresa.f4 },
                  { label: 'Fase 5', val: contribEmpresa.f5 },
                ].map((f, i) => (
                  <div key={i} className="dm-fase-box" style={{ background: FASES_INFO[i].cor }}>
                    <div className="dm-fase-box-label">{f.label}</div>
                    <div className="dm-fase-box-val">{(f.val * 100).toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </div>
            <GaugeBar percentual={empresa.indice} />
          </div>

          {/* Visão Área */}
          <div className="dm-card">
            <div className="dm-visao-header">
              <span className="dm-visao-label">Visão</span>
              <select className="dm-area-select" value={areaSel} onChange={e => setAreaSel(e.target.value)}>
                {areasCalc.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
              </select>
            </div>
            <div className="dm-visao-body">
              <div className="dm-index-big">{((areaAtiva?.calc?.percentual || 0) * 100).toFixed(2)}%</div>
              <div className="dm-fases-row">
                {[
                  { label: 'Fase 1', val: contribArea.f1 },
                  { label: 'Fase 2', val: contribArea.f2 },
                  { label: 'Fase 3', val: contribArea.f3 },
                  { label: 'Fase 4', val: contribArea.f4 },
                  { label: 'Fase 5', val: contribArea.f5 },
                ].map((f, i) => (
                  <div key={i} className="dm-fase-box" style={{ background: FASES_INFO[i].cor }}>
                    <div className="dm-fase-box-label">{f.label}</div>
                    <div className="dm-fase-box-val">{(f.val * 100).toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </div>
            <GaugeBar percentual={areaAtiva?.calc?.percentual || 0} />
          </div>
        </div>

        {/* ── Coluna Direita ── */}
        <div className="dm-col-right">

          {/* Ranking */}
          <div className="dm-card">
            <div className="dm-section-title">Ranking</div>
            <table className="dm-rank-table">
              <thead>
                <tr>
                  <th className="dm-rank-th" style={{ width: 44 }}>Posição</th>
                  <th className="dm-rank-th" style={{ textAlign: 'left' }}>Departamento</th>
                  <th className="dm-rank-th" style={{ width: 60 }}>%</th>
                  <th className="dm-rank-th" style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((a, i) => {
                  const pct = a.calc?.percentual || 0
                  const cor = getCorNivel(pct)
                  return (
                    <tr key={a.id} className="dm-rank-row">
                      <td className="dm-rank-pos">{i + 1}</td>
                      <td className="dm-rank-nome">{a.nome}</td>
                      <td className="dm-rank-pct" style={{ color: cor }}>{(pct * 100).toFixed(2)}%</td>
                      <td className="dm-rank-bar-cell">
                        <div className="dm-rank-bar-track">
                          <div className="dm-rank-bar-fill" style={{ width: `${Math.min(pct * 100, 100)}%`, background: cor }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Fases Info */}
          <div className="dm-card">
            <div className="dm-section-title">Fases</div>
            {FASES_INFO.map(f => (
              <div key={f.id} className="dm-fase-info-row" style={{ borderLeftColor: f.cor }}>
                <span className="dm-fase-info-label" style={{ background: f.cor }}>{f.label}</span>
                <span className="dm-fase-info-nome">{f.nome}</span>
                <span className="dm-fase-info-peso">Peso: {f.peso}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CSS Scoped ao Dashboard ─── */}
      <style>{`
        .dm-page {
          background: #F3EEE4;
          min-height: 100vh;
          padding: 24px 28px;
          font-family: 'Montserrat', sans-serif;
          color: #333;
        }
        .dm-title-bar {
          background: #00203E;
          border-radius: 8px;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .dm-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.5px;
        }
        .dm-badge {
          font-size: 11px;
          font-weight: 500;
          color: #CC915E;
          background: rgba(204,145,94,0.12);
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(204,145,94,0.25);
        }
        .dm-grid {
          display: grid;
          grid-template-columns: 180px 1fr 320px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .dm-grid {
            grid-template-columns: 1fr;
          }
        }
        .dm-col-left, .dm-col-center, .dm-col-right {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .dm-card {
          background: #fff;
          border-radius: 8px;
          padding: 16px 18px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .dm-meta-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #00203E;
          letter-spacing: 0.8px;
          margin-bottom: 6px;
        }
        .dm-meta-value {
          font-size: 14px;
          color: #555;
        }
        .dm-regua {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        .dm-regua-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dm-regua-dot {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .dm-regua-nome {
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
        }
        .dm-regua-faixa {
          font-size: 10px;
          color: #888;
          line-height: 1.2;
        }
        .dm-visao-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        .dm-visao-label {
          font-size: 11px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .dm-visao-nome {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          font-weight: 700;
          color: #00203E;
        }
        .dm-area-select {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          font-weight: 700;
          color: #00203E;
          background: transparent;
          border: none;
          border-bottom: 2px solid #CC915E;
          outline: none;
          cursor: pointer;
          padding-bottom: 2px;
          padding-right: 8px;
        }
        .dm-visao-body {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 16px;
        }
        .dm-index-big {
          font-family: 'Montserrat', sans-serif;
          font-size: 32px;
          font-weight: 300;
          color: #00203E;
          min-width: 110px;
        }
        .dm-fases-row {
          display: flex;
          gap: 6px;
          flex: 1;
        }
        .dm-fase-box {
          flex: 1;
          border-radius: 6px;
          padding: 8px 4px;
          text-align: center;
          color: #fff;
        }
        .dm-fase-box-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 2px;
        }
        .dm-fase-box-val {
          font-size: 12px;
          font-weight: 400;
        }
        .dm-section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          color: #00203E;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
          text-align: center;
        }
        .dm-rank-table {
          width: 100%;
          border-collapse: collapse;
        }
        .dm-rank-th {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #888;
          padding: 4px 6px;
          border-bottom: 1px solid #ddd;
          text-align: center;
        }
        .dm-rank-row {
          border-bottom: 1px solid #f0f0f0;
        }
        .dm-rank-row:hover {
          background: #faf8f4;
        }
        .dm-rank-pos {
          text-align: center;
          padding: 5px 4px;
          font-weight: 700;
          color: #00203E;
          font-size: 11px;
        }
        .dm-rank-nome {
          padding: 5px 6px;
          font-size: 11px;
          color: #444;
        }
        .dm-rank-pct {
          text-align: center;
          padding: 5px 4px;
          font-weight: 700;
          font-size: 11px;
        }
        .dm-rank-bar-cell {
          padding: 5px 4px;
        }
        .dm-rank-bar-track {
          width: 100%;
          height: 6px;
          background: #eee;
          border-radius: 3px;
          overflow: hidden;
        }
        .dm-rank-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .dm-fase-info-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 0 7px 10px;
          border-left: 4px solid;
          margin-bottom: 4px;
        }
        .dm-fase-info-label {
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          padding: 2px 8px;
          border-radius: 3px;
          white-space: nowrap;
        }
        .dm-fase-info-nome {
          font-size: 11px;
          color: #444;
          flex: 1;
        }
        .dm-fase-info-peso {
          font-size: 10px;
          font-weight: 700;
          color: #888;
          white-space: nowrap;
        }
        /* Gauge */
        .dm-gauge-wrap {
          position: relative;
          height: 50px;
          margin-top: 4px;
        }
        .dm-gauge-indicator {
          position: absolute;
          top: 0;
          transform: translateX(-50%);
          z-index: 2;
          transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dm-gauge-triangle {
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 12px solid #00203E;
        }
        .dm-gauge-bar {
          position: absolute;
          top: 16px;
          left: 0;
          right: 0;
          height: 16px;
          border-radius: 8px;
          overflow: hidden;
          background: ${GAUGE_GRADIENT};
        }
        .dm-gauge-labels {
          position: absolute;
          top: 36px;
          left: 0;
          right: 0;
        }
        .dm-gauge-label {
          position: absolute;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 600;
          color: #888;
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// GAUGE BAR — Barra gradiente N1→N5 com triângulo indicador
// ══════════════════════════════════════════════════════════════════════════════

function GaugeBar({ percentual }) {
  const pct = Math.max(0, Math.min(percentual * 100, 100))

  return (
    <div className="dm-gauge-wrap">
      <div className="dm-gauge-indicator" style={{ left: `${pct}%` }}>
        <div className="dm-gauge-triangle" />
      </div>
      <div className="dm-gauge-bar" />
      <div className="dm-gauge-labels">
        <span className="dm-gauge-label" style={{ left: '5%' }}>N1</span>
        <span className="dm-gauge-label" style={{ left: '18%' }}>N2</span>
        <span className="dm-gauge-label" style={{ left: '38%' }}>N3</span>
        <span className="dm-gauge-label" style={{ left: '65%' }}>N4</span>
        <span className="dm-gauge-label" style={{ left: '90%' }}>N5</span>
      </div>
    </div>
  )
}
