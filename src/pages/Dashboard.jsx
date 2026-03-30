import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useMemo } from 'react'
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: sw, minWidth: sw, background: 'var(--bg1)', borderRight: '1px solid var(--brd)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'width .25s ease, min-width .25s ease',
      }}>
        {/* Brand */}
        <div style={{
          padding: sidebarOpen ? '12px 12px' : '12px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '1px solid var(--brd)', minHeight: 56,
        }}>
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
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg0)' }}>
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
  { label: 'F1', nome: 'Diagnóstico Inicial', peso: '10%' },
  { label: 'F2', nome: 'Planos de Ação e Teste de Aderência', peso: '25%' },
  { label: 'F3', nome: 'Revisão dos Controles Internos', peso: '25%' },
  { label: 'F4', nome: 'Auditoria Contínua', peso: '30%' },
  { label: 'F5', nome: 'Auditoria Independente', peso: '10%' },
]

function getCorNivel(pct) {
  if (pct >= 0.81) return '#1B5E20'
  if (pct >= 0.51) return '#558B2F'
  if (pct >= 0.26) return '#F9A825'
  if (pct >= 0.11) return '#E65100'
  return '#B71C1C'
}

// ══════════════════════════════════════════════════════════════════════════════
// DASH MATURIDADE — Layout em blocos horizontais
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
  const ranking = useMemo(() =>
    [...areasCalc].filter(a => a.controles.length > 0).sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0)),
    [areasCalc]
  )

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
  const nivelEmpresa = getNivelMaturidade(empresa.indice)
  const nivelArea = getNivelMaturidade(areaAtiva?.calc?.percentual || 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F3EEE4' }}>
      <div className="spinner" />
    </div>
  )

  if (!projeto) return (
    <div style={{ background: '#F3EEE4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48, opacity: 0.3 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>Nenhum projeto ativo</div>
    </div>
  )

  const nomeCliente = projeto.clientes?.nome || 'Cliente'

  return (
    <div style={S.page}>
      {/* ─── HEADER ─── */}
      <div style={S.header}>
        <div style={S.headerTitle}>Maturidade do Ambiente de Controles Internos</div>
        <div style={S.headerRight}>
          <span style={{ fontSize: 11, color: 'rgba(243,238,228,0.5)' }}>Cliente</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#CC915E' }}>{nomeCliente}</span>
        </div>
      </div>

      {/* ─── BLOCO EMPRESA ─── */}
      <div style={S.bloco}>
        <div style={S.blocoLabel}>Visão Consolidada</div>
        <div style={S.blocoRow}>
          {/* Índice grande */}
          <div style={S.indiceWrap}>
            <div style={{ fontSize: 32, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>
              {(empresa.indice * 100).toFixed(2)}%
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#fff',
              background: getCorNivel(empresa.indice),
              padding: '2px 10px', borderRadius: 3, marginTop: 4, textTransform: 'uppercase',
            }}>
              {nivelEmpresa.nivel} — {nivelEmpresa.nome}
            </div>
          </div>
          {/* Fases */}
          <FasesBoxes fases={cfe} />
        </div>
        <GaugeBar pct={empresa.indice} />
      </div>

      {/* ─── BLOCO ÁREA ─── */}
      <div style={S.bloco}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={S.blocoLabel}>Visão</div>
          <select value={areaSel} onChange={e => setAreaSel(e.target.value)} style={S.areaSelect}>
            {areasCalc.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
          </select>
        </div>
        <div style={S.blocoRow}>
          <div style={S.indiceWrap}>
            <div style={{ fontSize: 28, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>
              {((areaAtiva?.calc?.percentual || 0) * 100).toFixed(2)}%
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#fff',
              background: getCorNivel(areaAtiva?.calc?.percentual || 0),
              padding: '2px 10px', borderRadius: 3, marginTop: 4, textTransform: 'uppercase',
            }}>
              {nivelArea.nivel} — {nivelArea.nome}
            </div>
          </div>
          <FasesBoxes fases={cfa} />
        </div>
        <GaugeBar pct={areaAtiva?.calc?.percentual || 0} />
      </div>

      {/* ─── BLOCO INFERIOR: Ranking + Régua/Fases ─── */}
      <div style={S.blocoInferior}>

        {/* Ranking — 60% */}
        <div style={{ ...S.card, flex: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={S.secTitle}>Ranking por Área</div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 30 }}>#</th>
                  <th style={{ ...S.th, textAlign: 'left' }}>Departamento</th>
                  <th style={{ ...S.th, width: 65 }}>Índice</th>
                  <th style={{ ...S.th, width: 55 }}>Nível</th>
                  <th style={{ ...S.th, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((a, i) => {
                  const p = a.calc?.percentual || 0
                  const nv = getNivelMaturidade(p)
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 700, color: '#00203E', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '5px 8px', fontSize: 11, color: '#333' }}>{a.nome}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 700, fontSize: 11, color: getCorNivel(p) }}>
                        {(p * 100).toFixed(2)}%
                      </td>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#fff',
                          background: getCorNivel(p), padding: '2px 6px', borderRadius: 3,
                        }}>
                          {nv.nivel}
                        </span>
                      </td>
                      <td style={{ padding: '5px 4px' }}>
                        <div style={{ width: '100%', height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(p * 100, 100)}%`, height: '100%',
                            borderRadius: 3, background: getCorNivel(p), transition: 'width .4s',
                          }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {ranking.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 11 }}>Sem dados de controles cadastrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Painel direito — Régua + Fases */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {/* Régua de Maturidade */}
          <div style={S.card}>
            <div style={S.secTitle}>Métrica de Maturidade</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {NIVEIS.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: n.cor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: n.cor, minWidth: 24 }}>{n.id}</span>
                  <span style={{ fontSize: 11, color: '#555', flex: 1 }}>{n.nome}</span>
                  <span style={{ fontSize: 10, color: '#999' }}>{n.faixa}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fases informativo */}
          <div style={S.card}>
            <div style={S.secTitle}>Fases do Programa</div>
            {FASES_INFO.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0 5px 10px', borderLeft: `3px solid ${FASES_CORES[i]}`, marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#fff',
                  background: FASES_CORES[i], padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
                }}>{f.label}</span>
                <span style={{ fontSize: 10, color: '#444', flex: 1 }}>{f.nome}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#888' }}>{f.peso}</span>
              </div>
            ))}
          </div>

          {/* Última atualização */}
          <div style={{ ...S.card, textAlign: 'center', padding: '8px 14px' }}>
            <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: .5 }}>Última Atualização: </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#00203E' }}>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Fases boxes ──
function FasesBoxes({ fases }) {
  return (
    <div style={{ display: 'flex', gap: 5, flex: 1 }}>
      {fases.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: FASES_CORES[i], borderRadius: 5, padding: '8px 4px',
          textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3, opacity: .8 }}>Fase {i + 1}</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{(v * 100).toFixed(2)}%</div>
        </div>
      ))}
    </div>
  )
}

// ── Gauge Bar ──
function GaugeBar({ pct }) {
  const pos = Math.max(0, Math.min(pct * 100, 100))
  return (
    <div style={{ position: 'relative', height: 38, marginTop: 6 }}>
      <div style={{
        position: 'absolute', left: `${pos}%`, top: 0, transform: 'translateX(-50%)', zIndex: 2,
        transition: 'left .6s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
          borderTop: '10px solid #00203E',
        }} />
      </div>
      <div style={{
        position: 'absolute', top: 13, left: 0, right: 0, height: 10, borderRadius: 5,
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #B71C1C 0%, #E65100 20%, #F9A825 40%, #558B2F 65%, #1B5E20 100%)',
      }} />
      <div style={{
        position: 'absolute', top: 26, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', padding: '0 2%',
      }}>
        {['N1', 'N2', 'N3', 'N4', 'N5'].map(n => (
          <span key={n} style={{ fontSize: 9, fontWeight: 600, color: '#999' }}>{n}</span>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS — Layout horizontal, preenchimento total
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  page: {
    background: '#F3EEE4',
    height: '100vh',
    padding: '12px 16px',
    fontFamily: "'Montserrat', sans-serif",
    color: '#333',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'hidden',
  },
  header: {
    background: '#00203E',
    borderRadius: 6,
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14, fontWeight: 400, color: '#F3EEE4',
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: .3,
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  bloco: {
    background: '#fff',
    borderRadius: 6,
    padding: '12px 18px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  blocoLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    color: '#00203E', letterSpacing: .8, marginBottom: 8,
  },
  blocoRow: {
    display: 'flex', alignItems: 'center', gap: 16,
  },
  indiceWrap: {
    minWidth: 130, flexShrink: 0,
  },
  areaSelect: {
    fontSize: 14, fontWeight: 700, color: '#00203E', background: 'transparent',
    border: 'none', borderBottom: '2px solid #CC915E', outline: 'none', cursor: 'pointer',
    fontFamily: "'Montserrat', sans-serif", padding: '2px 4px',
  },
  blocoInferior: {
    display: 'flex',
    gap: 10,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  card: {
    background: '#fff',
    borderRadius: 6,
    padding: '12px 14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  secTitle: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    color: '#00203E', letterSpacing: .6, marginBottom: 8, textAlign: 'center',
  },
  th: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    color: '#fff', background: '#00203E', padding: '6px 6px',
    textAlign: 'center',
    position: 'sticky', top: 0, zIndex: 2,
  },
}
