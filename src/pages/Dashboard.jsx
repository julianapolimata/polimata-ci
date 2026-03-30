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
const FASES_PESOS = [10, 25, 25, 30, 10]
const FASES_NOMES = [
  'Diagnóstico Inicial',
  'Planos de Ação e Aderência',
  'Controles Internos',
  'Auditoria Contínua',
  'Auditoria Independente',
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
        <span style={S.headerText}>Cliente: <strong>{nomeCliente}</strong></span>
        <span style={S.headerText}>Maturidade do Ambiente de Controles Internos</span>
      </div>

      {/* ─── ZONA PRINCIPAL: Visões (esq) + Ranking (dir) ─── */}
      <div style={S.zonaPrincipal}>

        {/* Coluna esquerda — Visão Consolidada + Visão Área */}
        <div style={S.colVisoes}>
          {/* Visão Consolidada */}
          <div style={S.card}>
            <div style={S.blocoLabel}>Visão Consolidada</div>
            <div style={S.visaoRow}>
              <div style={S.indiceWrap}>
                <div style={{ fontSize: 30, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>
                  {(empresa.indice * 100).toFixed(2)}%
                </div>
                <NivelBadge pct={empresa.indice} nivel={nivelEmpresa} />
              </div>
              <FasesBoxes fases={cfe} />
            </div>
            <GaugeBar pct={empresa.indice} />
          </div>

          {/* Visão Área */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={S.blocoLabel}>Visão</div>
              <select value={areaSel} onChange={e => setAreaSel(e.target.value)} style={S.areaSelect}>
                {areasCalc.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
              </select>
            </div>
            <div style={S.visaoRow}>
              <div style={S.indiceWrap}>
                <div style={{ fontSize: 26, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>
                  {((areaAtiva?.calc?.percentual || 0) * 100).toFixed(2)}%
                </div>
                <NivelBadge pct={areaAtiva?.calc?.percentual || 0} nivel={nivelArea} />
              </div>
              <FasesBoxes fases={cfa} />
            </div>
            <GaugeBar pct={areaAtiva?.calc?.percentual || 0} />
          </div>
        </div>

        {/* Coluna direita — Ranking */}
        <div style={{ ...S.card, flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={S.secTitle}>Ranking por Área</div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 28 }}>#</th>
                  <th style={{ ...S.th, textAlign: 'left' }}>Departamento</th>
                  <th style={{ ...S.th, width: 62 }}>Índice</th>
                  <th style={{ ...S.th, width: 40 }}>Nível</th>
                  <th style={{ ...S.th, width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((a, i) => {
                  const p = a.calc?.percentual || 0
                  const nv = getNivelMaturidade(p)
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={S.tdCenter}>{i + 1}</td>
                      <td style={{ padding: '4px 8px', fontSize: 11, color: '#333' }}>{a.nome}</td>
                      <td style={{ ...S.tdCenter, fontWeight: 700, color: getCorNivel(p) }}>{(p * 100).toFixed(2)}%</td>
                      <td style={S.tdCenter}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#fff',
                          background: getCorNivel(p), padding: '2px 5px', borderRadius: 3,
                        }}>{nv.nivel}</span>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <div style={{ width: '100%', height: 5, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
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
                  <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 11 }}>Sem dados cadastrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── ZONA INFERIOR: Trilha de Desenvolvimento + Métrica ─── */}
      <div style={S.zonaInferior}>
        {/* Trilha de Desenvolvimento */}
        <div style={{ ...S.card, flex: 3 }}>
          <div style={S.secTitle}>Trilha de Desenvolvimento</div>
          {/* Caixas de fases */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {FASES_NOMES.map((nome, i) => (
              <div key={i} style={{
                flex: FASES_PESOS[i], background: FASES_CORES[i], borderRadius: 5,
                padding: '8px 4px', textAlign: 'center', color: '#fff',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', opacity: .85, marginBottom: 2 }}>
                  Fase {i + 1}
                </div>
                <div style={{ fontSize: 9, lineHeight: 1.2, marginBottom: 3 }}>{nome}</div>
                <div style={{
                  display: 'inline-block', background: 'rgba(255,255,255,0.2)',
                  borderRadius: 3, padding: '1px 7px', fontSize: 10, fontWeight: 600,
                }}>
                  {FASES_PESOS[i]}%
                </div>
              </div>
            ))}
          </div>
          {/* Barra de evolução */}
          <div>
            <div style={{ fontSize: 9, color: '#888', marginBottom: 3, fontWeight: 500 }}>Apresentação da Evolução</div>
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden' }}>
              {FASES_PESOS.map((peso, i) => (
                <div key={i} style={{
                  flex: peso, background: FASES_CORES[i],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 7, color: '#fff', fontWeight: 600, textTransform: 'uppercase' }}>
                    Fase {i + 1}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', marginTop: 2 }}>
              {(() => {
                let acc = 0
                return FASES_PESOS.map((peso, i) => {
                  const start = acc
                  acc += peso
                  return (
                    <div key={i} style={{ flex: peso, display: 'flex', justifyContent: 'space-between', padding: '0 1px' }}>
                      {i === 0 && <span style={{ fontSize: 8, color: '#999' }}>{start}%</span>}
                      <span style={{ fontSize: 8, color: '#999', marginLeft: 'auto' }}>{acc}%</span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>

        {/* Métrica de Maturidade */}
        <div style={{ ...S.card, flex: 2 }}>
          <div style={S.secTitle}>Métrica de Maturidade</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NIVEIS.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 13, height: 13, borderRadius: 3, background: n.cor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: n.cor, minWidth: 22 }}>{n.id}</span>
                <span style={{ fontSize: 11, color: '#555', flex: 1 }}>{n.nome}</span>
                <span style={{ fontSize: 10, color: '#999' }}>{n.faixa}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Badge de nível ──
function NivelBadge({ pct, nivel }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#fff',
      background: getCorNivel(pct),
      padding: '2px 10px', borderRadius: 3, marginTop: 4,
      textTransform: 'uppercase', display: 'inline-block',
    }}>
      {nivel.nivel} — {nivel.nome}
    </div>
  )
}

// ── Fases boxes compactos ──
function FasesBoxes({ fases }) {
  return (
    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
      {fases.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: FASES_CORES[i], borderRadius: 5,
          padding: '6px 3px', textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .2, opacity: .85 }}>
            Fase {i + 1}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, marginTop: 1 }}>
            {(v * 100).toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Gauge Bar ──
function GaugeBar({ pct }) {
  const pos = Math.max(0, Math.min(pct * 100, 100))
  return (
    <div style={{ position: 'relative', height: 30, marginTop: 4 }}>
      <div style={{
        position: 'absolute', left: `${pos}%`, top: 0, transform: 'translateX(-50%)', zIndex: 2,
        transition: 'left .6s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
          borderTop: '8px solid #00203E',
        }} />
      </div>
      <div style={{
        position: 'absolute', top: 10, left: 0, right: 0, height: 8, borderRadius: 4,
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #B71C1C 0%, #E65100 20%, #F9A825 40%, #558B2F 65%, #1B5E20 100%)',
      }} />
      <div style={{
        position: 'absolute', top: 21, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', padding: '0 2%',
      }}>
        {['N1', 'N2', 'N3', 'N4', 'N5'].map(n => (
          <span key={n} style={{ fontSize: 8, fontWeight: 600, color: '#999' }}>{n}</span>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  page: {
    background: '#F3EEE4',
    height: '100vh',
    padding: '10px 14px',
    fontFamily: "'Montserrat', sans-serif",
    color: '#333',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
  headerText: {
    fontSize: 13,
    fontWeight: 400,
    color: '#F3EEE4',
    fontFamily: "'Montserrat', sans-serif",
  },
  zonaPrincipal: {
    display: 'flex',
    gap: 10,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  colVisoes: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 3,
    minHeight: 0,
  },
  card: {
    background: '#fff',
    borderRadius: 6,
    padding: '10px 14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  blocoLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    color: '#00203E', letterSpacing: .8, marginBottom: 6,
  },
  visaoRow: {
    display: 'flex', alignItems: 'center', gap: 14,
  },
  indiceWrap: {
    minWidth: 120, flexShrink: 0,
  },
  areaSelect: {
    fontSize: 14, fontWeight: 700, color: '#00203E', background: 'transparent',
    border: 'none', borderBottom: '2px solid #CC915E', outline: 'none', cursor: 'pointer',
    fontFamily: "'Montserrat', sans-serif", padding: '2px 4px',
  },
  secTitle: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    color: '#00203E', letterSpacing: .6, marginBottom: 8, textAlign: 'center',
  },
  th: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    color: '#fff', background: '#00203E', padding: '5px 6px',
    textAlign: 'center', position: 'sticky', top: 0, zIndex: 2,
  },
  tdCenter: {
    padding: '4px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#00203E',
  },
  zonaInferior: {
    display: 'flex',
    gap: 10,
    flexShrink: 0,
  },
}
