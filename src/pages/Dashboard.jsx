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
// SHELL — Sidebar recolhível + Main
// ══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [projetos, setProjetos] = useState([])
  const [projetoAtivo, setProjetoAtivo] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
  const sw = sidebarOpen ? 240 : 56

  return (
    <div className="app" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: sw, minWidth: sw, background: 'var(--bg1)', borderRight: '1px solid var(--brd)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .25s ease, min-width .25s ease',
      }}>
        {/* Brand */}
        <div style={{ padding: sidebarOpen ? '12px 12px' : '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--brd)', minHeight: 56 }}>
          {sidebarOpen
            ? <img src="/logotipo-2cores.png" alt="Polímata" style={{ width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain' }} />
            : <img src="/logotipo-2cores.png" alt="P" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          }
        </div>

        {/* Projeto ativo */}
        {sidebarOpen && projetos.length > 0 && (
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

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SideNavItem icon="📊" label="Dashboard" active={location.pathname === '/'} onClick={() => navigate('/')} open={sidebarOpen} />
          <SideNavItem icon="📋" label="MRC Completa" active={location.pathname === '/mrc'} onClick={() => navigate('/mrc')} open={sidebarOpen} />
          {isAdmin && (
            <>
              {sidebarOpen && <div className="sb-sep">Administração</div>}
              <SideNavItem icon="⚙️" label="Configurações" active={location.pathname.startsWith('/configuracoes')} onClick={() => navigate('/configuracoes')} open={sidebarOpen} />
            </>
          )}
        </nav>

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(o => !o)} style={{
          background: 'transparent', border: 'none', borderTop: '1px solid var(--brd)',
          color: 'var(--txt3)', padding: '10px', cursor: 'pointer', fontSize: 14, textAlign: 'center',
          transition: 'color .15s',
        }}
          onMouseEnter={e => e.target.style.color = 'var(--gold)'}
          onMouseLeave={e => e.target.style.color = 'var(--txt3)'}
        >
          {sidebarOpen ? '◂' : '▸'}
        </button>

        {/* Footer */}
        <div className="sb-footer">
          <div className="sb-user" style={{ cursor: 'pointer' }} onClick={() => navigate('/perfil')}>
            <div className="sb-user-avatar">
              {perfil?.avatar_url
                ? <img src={perfil.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : perfil?.nome?.[0]?.toUpperCase() || '?'}
            </div>
            {sidebarOpen && (
              <div>
                <div className="sb-user-nome">{perfil?.nome}</div>
                <div className="sb-user-papel">{papelLabel(perfil?.papel)}</div>
              </div>
            )}
          </div>
          {sidebarOpen && <button className="sb-sair" onClick={signOut} title="Sair">↩</button>}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main" style={{ flex: 1, overflowY: 'auto' }}>
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

function SideNavItem({ icon, label, active, onClick, open }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}
      style={open ? {} : { justifyContent: 'center', padding: '9px 0' }}
      title={open ? undefined : label}>
      <span className="nav-icon">{icon}</span>
      {open && <span>{label}</span>}
    </button>
  )
}

function papelLabel(papel) {
  const map = { admin_polimata: 'Admin Polímata', consultor_polimata: 'Consultor', gestor_cliente: 'Gestor', usuario_cliente: 'Usuário' }
  return map[papel] || papel || '—'
}

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════════════════════

const NIVEIS = [
  { id: 'N5', nome: 'Otimizado', faixa: '81–100%', cor: '#1B5E20' },
  { id: 'N4', nome: 'Monitorado', faixa: '51–80%', cor: '#558B2F' },
  { id: 'N3', nome: 'Padronizado', faixa: '26–50%', cor: '#F9A825' },
  { id: 'N2', nome: 'Informal', faixa: '11–25%', cor: '#E65100' },
  { id: 'N1', nome: 'Não confiável', faixa: '0–10%', cor: '#B71C1C' },
]

const FASES_CORES = ['#00203E', '#1D3B5C', '#660033', '#660066', '#A6512F']
const FASES_INFO = [
  { label: 'Fase 1', nome: 'Diagnóstico Inicial', peso: '10%' },
  { label: 'Fase 2', nome: 'Planos de Ação e Teste de Aderência', peso: '25%' },
  { label: 'Fase 3', nome: 'Revisão dos Controles Internos', peso: '25%' },
  { label: 'Fase 4', nome: 'Auditoria Contínua', peso: '30%' },
  { label: 'Fase 5', nome: 'Auditoria Independente', peso: '10%' },
]

function getCorNivel(pct) {
  if (pct >= 0.81) return '#1B5E20'
  if (pct >= 0.51) return '#558B2F'
  if (pct >= 0.26) return '#F9A825'
  if (pct >= 0.11) return '#E65100'
  return '#B71C1C'
}

// ══════════════════════════════════════════════════════════════════════════════
// DASH MATURIDADE
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
      .from('areas').select('id, nome, prefixo, peso, gerente, ordem')
      .eq('projeto_id', projetoId).order('ordem')
    const { data: mrcData } = await supabase
      .from('mrc').select('*').eq('projeto_id', projetoId)

    const controles = mrcData || []
    const areas = areasData || []
    const resultado = areas.map(area => {
      const ca = controles.filter(c => c.area_id === area.id || c.area === area.nome)
      const f1c = ca.length > 0 && ca.every(c => c.r1 && c.r1 !== 'Teste Não Realizado')
      return { ...area, controles: ca, calc: calcularPercentualArea(ca, f1c) }
    })
    setAreasCalc(resultado)
    if (resultado.length > 0) setAreaSel(resultado[0].nome)
    setLoading(false)
  }

  const empresa = calcularIndiceEmpresa(areasCalc.map(a => ({ nome: a.nome, peso: a.peso || 0, percentual: a.calc?.percentual || 0 })))
  const areaAtiva = areasCalc.find(a => a.nome === areaSel)
  const ranking = [...areasCalc].filter(a => a.controles.length > 0).sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0))

  function contribFaseArea(area) {
    if (!area?.calc) return [0, 0, 0, 0, 0]
    const f1 = area.calc.percentual > 0 ? 0.10 : 0
    let f2 = 0, f3 = 0, f4 = 0, f5 = 0
    ;(area.calc.detalhePorControle || []).forEach(d => {
      const f = d.detalheFases || {}
      f2 += (f.F2E1?.contribuicao || 0) + (f.F2E2?.contribuicao || 0)
      f3 += f.F3?.contribuicao || 0
      f4 += (f.F4C1?.contribuicao || 0) + (f.F4C2?.contribuicao || 0)
      f5 += f.F5?.contribuicao || 0
    })
    return [f1, f2, f3, f4, f5]
  }

  function contribFaseEmpresa() {
    const sp = areasCalc.reduce((s, x) => s + (x.peso || 0), 0) || 1
    return areasCalc.reduce((acc, a) => {
      const pw = (a.peso || 0) / sp
      const cf = contribFaseArea(a)
      return acc.map((v, i) => v + cf[i] * pw)
    }, [0, 0, 0, 0, 0])
  }

  const cfe = contribFaseEmpresa()
  const cfa = contribFaseArea(areaAtiva)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F3EEE4' }}><div className="spinner" /></div>
  if (!projeto) return <div style={{ background: '#F3EEE4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}><div style={{ fontSize: 48, opacity: 0.3 }}>📊</div><div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>Nenhum projeto ativo</div></div>

  const nomeCliente = projeto.clientes?.nome || 'Cliente'

  return (
    <div style={DM.page}>
      {/* ─── Header ─── */}
      <div style={DM.header}>
        <span style={DM.headerLeft}>Cliente: {nomeCliente}</span>
        <span style={DM.headerRight}>Maturidade do Ambiente de Controles Internos</span>
      </div>

      {/* ─── Grid 3 colunas — compacto one-page ─── */}
      <div style={DM.grid}>

        {/* COL ESQUERDA — Meta + Régua */}
        <div style={DM.colL}>
          <div style={DM.card}>
            <div style={DM.lbl}>Última Atualização</div>
            <div style={{ fontSize: 13, color: '#444' }}>{new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div style={DM.card}>
            <div style={DM.lbl}>Métrica de Maturidade</div>
            {NIVEIS.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: n.cor, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: n.cor, lineHeight: 1.1 }}>{n.id} - {n.nome}</div>
                  <div style={{ fontSize: 9, color: '#999', lineHeight: 1.1 }}>{n.faixa}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COL CENTRAL — Visão Empresa + Visão Área */}
        <div style={DM.colC}>
          <VisaoCard titulo="Visão" nome={nomeCliente} pct={empresa.indice} fases={cfe} />
          <VisaoCardArea nome={areaSel} areas={areasCalc} onSelect={setAreaSel} pct={areaAtiva?.calc?.percentual || 0} fases={cfa} />
        </div>

        {/* COL DIREITA — Ranking + Fases Info */}
        <div style={DM.colR}>
          <div style={{ ...DM.card, flex: 1, overflow: 'auto' }}>
            <div style={DM.secTitle}>Ranking</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #00203E' }}>
                  <th style={DM.th}>#</th>
                  <th style={{ ...DM.th, textAlign: 'left' }}>Departamento</th>
                  <th style={DM.th}>%</th>
                  <th style={{ ...DM.th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((a, i) => {
                  const p = a.calc?.percentual || 0
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 700, color: '#00203E', fontSize: 10 }}>{i + 1}</td>
                      <td style={{ padding: '4px 6px', fontSize: 10, color: '#444' }}>{a.nome}</td>
                      <td style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: getCorNivel(p) }}>{(p * 100).toFixed(2)}%</td>
                      <td style={{ padding: '4px 4px' }}>
                        <div style={{ width: '100%', height: 5, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(p * 100, 100)}%`, height: '100%', borderRadius: 3, background: getCorNivel(p), transition: 'width .4s' }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={DM.card}>
            <div style={DM.secTitle}>Fases</div>
            {FASES_INFO.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0 5px 8px', borderLeft: `3px solid ${FASES_CORES[i]}`, marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', background: FASES_CORES[i], padding: '1px 6px', borderRadius: 2, whiteSpace: 'nowrap' }}>{f.label}</span>
                <span style={{ fontSize: 10, color: '#444', flex: 1 }}>{f.nome}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#888' }}>Peso: {f.peso}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Visão Card (Empresa) ──
function VisaoCard({ titulo, nome, pct, fases }) {
  return (
    <div style={DM.card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: .5 }}>{titulo}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#00203E' }}>{nome}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 300, color: '#00203E', minWidth: 95 }}>{(pct * 100).toFixed(2)}%</div>
        <FasesBoxes fases={fases} />
      </div>
      <GaugeBar pct={pct} />
    </div>
  )
}

// ── Visão Card (Área com dropdown) ──
function VisaoCardArea({ nome, areas, onSelect, pct, fases }) {
  return (
    <div style={DM.card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: .5 }}>Visão</span>
        <select value={nome} onChange={e => onSelect(e.target.value)} style={{
          fontSize: 16, fontWeight: 700, color: '#00203E', background: 'transparent',
          border: 'none', borderBottom: '2px solid #CC915E', outline: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
        }}>
          {areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 300, color: '#00203E', minWidth: 95 }}>{(pct * 100).toFixed(2)}%</div>
        <FasesBoxes fases={fases} />
      </div>
      <GaugeBar pct={pct} />
    </div>
  )
}

// ── Fases boxes ──
function FasesBoxes({ fases }) {
  return (
    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
      {fases.map((v, i) => (
        <div key={i} style={{ flex: 1, background: FASES_CORES[i], borderRadius: 5, padding: '6px 3px', textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2 }}>Fase {i + 1}</div>
          <div style={{ fontSize: 11, fontWeight: 400 }}>{(v * 100).toFixed(2)}%</div>
        </div>
      ))}
    </div>
  )
}

// ── Gauge Bar ──
function GaugeBar({ pct }) {
  const pos = Math.max(0, Math.min(pct * 100, 100))
  return (
    <div style={{ position: 'relative', height: 40, marginTop: 2 }}>
      <div style={{ position: 'absolute', left: `${pos}%`, top: 0, transform: 'translateX(-50%)', zIndex: 2, transition: 'left .6s cubic-bezier(.4,0,.2,1)' }}>
        <div style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '10px solid #00203E' }} />
      </div>
      <div style={{ position: 'absolute', top: 13, left: 0, right: 0, height: 12, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(90deg, #B71C1C 0%, #E65100 20%, #F9A825 40%, #558B2F 65%, #1B5E20 100%)' }} />
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 2%' }}>
        {['N1', 'N2', 'N3', 'N4', 'N5'].map(n => (
          <span key={n} style={{ fontSize: 9, fontWeight: 600, color: '#999' }}>{n}</span>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS INLINE — Dashboard Maturidade (light theme, compacto)
// ══════════════════════════════════════════════════════════════════════════════

const DM = {
  page: {
    background: '#F3EEE4',
    minHeight: '100vh',
    padding: '14px 18px',
    fontFamily: "'Montserrat', sans-serif",
    color: '#333',
    fontSize: 12,
  },
  header: {
    background: '#00203E',
    borderRadius: 6,
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    fontSize: 14,
    fontWeight: 600,
    color: '#CC915E',
    fontFamily: "'Montserrat', sans-serif",
  },
  headerRight: {
    fontSize: 14,
    fontWeight: 400,
    color: '#F3EEE4',
    fontFamily: "'Montserrat', sans-serif",
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 280px',
    gap: 12,
    alignItems: 'start',
    maxHeight: 'calc(100vh - 90px)',
  },
  colL: { display: 'flex', flexDirection: 'column', gap: 10 },
  colC: { display: 'flex', flexDirection: 'column', gap: 12 },
  colR: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 90px)', overflow: 'hidden' },
  card: {
    background: '#fff',
    borderRadius: 6,
    padding: '12px 14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  lbl: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#00203E',
    letterSpacing: .6,
    marginBottom: 4,
  },
  secTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#00203E',
    letterSpacing: .6,
    marginBottom: 8,
    textAlign: 'center',
  },
  th: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#fff',
    background: '#00203E',
    padding: '5px 6px',
    textAlign: 'center',
  },
}
