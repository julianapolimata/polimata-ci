import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useEffect, useState, useMemo } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import Configuracoes from './Configuracoes'
import Perfil from './Perfil'
import MRCCompleta, { ModalDetalhe } from '../components/MRCCompleta'
import ModalAtualizar from '../components/ModalAtualizar'
import {
  calcularPercentualArea,
  calcularIndiceEmpresa,
  getNivelMaturidade,
  PESO_FASE,
} from '../lib/calculoMaturidade'

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════════════════════

const FASES_CORES = ['#00203E', '#1D3B5C', '#660033', '#660066', '#A6512F']
const FASES_PESOS = [10, 25, 25, 30, 10]
const FASES_NOMES = ['Diagnóstico Inicial', 'Planos de Ação e Aderência', 'Controles Internos', 'Auditoria Contínua', 'Auditoria Independente']

function getCorNivel(pct) {
  if (pct >= 0.81) return '#1B5E20'
  if (pct >= 0.51) return '#558B2F'
  if (pct >= 0.26) return '#F9A825'
  if (pct >= 0.11) return '#E65100'
  return '#B71C1C'
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
          <SideNavItem icon="📊" label="Dashboard Maturidade" active={location.pathname === '/'} onClick={() => navigate('/')} open={sidebarOpen} />
          <SideNavItem icon="📋" label="Visão Geral" active={location.pathname === '/visao-geral'} onClick={() => navigate('/visao-geral')} open={sidebarOpen} />
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
            <SideNavItem icon="⚙️" label="Configurações" active={location.pathname.startsWith('/configuracoes')} onClick={() => navigate('/configuracoes')} open={sidebarOpen} /></>)}
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
          <Route path="/visao-geral" element={<VisaoGeral projeto={projetoAtivo} areasCalc={areasCalc} loading={loading} ultimaAtualizacao={ultimaAtualizacao} navigate={navigate} />} />
          <Route path="/area/:areaId" element={<PorArea projeto={projetoAtivo} areasCalc={areasCalc} loading={loading} navigate={navigate} loadDados={loadDados} />} />
          <Route path="/mrc" element={<MRCCompleta projetoId={projetoAtivo?.id} />} />
          <Route path="/configuracoes/*" element={<Configuracoes />} />
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

function FasesBoxes({ fases }) {
  return (
    <div style={{ display: 'flex', gap: 3, flex: 1 }}>
      {fases.map((v, i) => (
        <div key={i} style={{ flex: 1, background: FASES_CORES[i], borderRadius: 4, padding: '5px 2px', textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 7, fontWeight: 700, opacity: .85 }}>FASE {i + 1}</div>
          <div style={{ fontSize: 10, fontWeight: 500, marginTop: 1 }}>{(v * 100).toFixed(2)}%</div>
        </div>
      ))}
    </div>
  )
}

function GaugeBar({ pct }) {
  const pos = Math.max(0, Math.min(pct * 100, 100))
  return (
    <div style={{ position: 'relative', height: 34, marginTop: 4, flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: `${pos}%`, top: 0, transform: 'translateX(-50%)', zIndex: 2, transition: 'left .6s cubic-bezier(.4,0,.2,1)' }}>
        <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #00203E' }} />
      </div>
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, height: 12, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(90deg, #B71C1C 0%, #E65100 15%, #F9A825 35%, #558B2F 65%, #1B5E20 100%)' }} />
      <div style={{ position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 2%' }}>
        {['N1','N2','N3','N4','N5'].map(n => <span key={n} style={{ fontSize: 8, fontWeight: 600, color: '#999' }}>{n}</span>)}
      </div>
    </div>
  )
}

function KpisTable({ kpis }) {
  const rows = [
    { label: 'Controles', data: kpis.controles, cor: '#00203E' },
    { label: 'Efetivos', data: kpis.efetivos, cor: '#1B5E20' },
    { label: 'Inefetivos', data: kpis.inefetivos, cor: '#B71C1C' },
    { label: 'GAP', data: kpis.gap, cor: '#E65100' },
    { label: 'Planos de Ação', data: kpis.planos, cor: '#1D3B5C' },
  ]
  return (
    <div style={{ marginTop: 'auto', paddingTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, textAlign: 'center' }}>
        <thead><tr>
          <th style={{ textAlign: 'left', padding: '2px 4px', fontSize: 8, color: '#888', fontWeight: 600 }}></th>
          {FASES_CORES.map((c, i) => <th key={i} style={{ padding: '2px 3px', fontSize: 7, fontWeight: 700, color: '#fff', background: c, borderRadius: 2 }}>F{i + 1}</th>)}
          <th style={{ padding: '2px 4px', fontSize: 8, fontWeight: 700, color: '#00203E', borderBottom: '1px solid #eee' }}>Total</th>
        </tr></thead>
        <tbody>{rows.map((row, ri) => (
          <tr key={ri} style={ri % 2 === 1 ? { background: '#f9f9f7' } : {}}>
            <td style={{ textAlign: 'left', padding: '2px 4px', color: row.cor, fontWeight: 600 }}>{row.label}</td>
            {row.data.slice(0, 5).map((v, ci) => <td key={ci} style={{ padding: '2px', fontWeight: v > 0 ? 600 : 400, color: v > 0 ? row.cor : '#ccc' }}>{row.label === 'Planos de Ação' && ci === 0 ? '—' : v}</td>)}
            <td style={{ padding: '2px', fontWeight: 700, color: row.cor }}>{row.data[5]}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function ReguaN1N5({ nivelAtivo }) {
  const segs = [
    { id: 'N1', nome: 'Não Confiável', faixa: '0–10%', cor: '#B71C1C', bg: 'rgba(183,28,28,0.1)' },
    { id: 'N2', nome: 'Informal', faixa: '11–25%', cor: '#E65100', bg: 'rgba(230,81,0,0.1)' },
    { id: 'N3', nome: 'Padronizado', faixa: '26–50%', cor: '#F9A825', bg: 'rgba(249,168,37,0.1)' },
    { id: 'N4', nome: 'Monitorado', faixa: '51–80%', cor: '#558B2F', bg: 'rgba(85,139,47,0.1)' },
    { id: 'N5', nome: 'Otimizado', faixa: '81–100%', cor: '#1B5E20', bg: 'rgba(27,94,32,0.1)' },
  ]
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
      {segs.map(s => (
        <div key={s.id} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', background: s.bg, color: s.cor, opacity: nivelAtivo && nivelAtivo !== s.id ? 0.45 : 1, outline: nivelAtivo === s.id ? `2px solid ${s.cor}` : 'none', outlineOffset: -2, transition: 'all .2s' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{s.id}</div>
          <div style={{ fontSize: 8, marginTop: 2, opacity: .85 }}>{s.nome}</div>
          <div style={{ fontSize: 7, opacity: .6 }}>{s.faixa}</div>
        </div>
      ))}
    </div>
  )
}

function Spinner() { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F3EEE4' }}><div className="spinner" /></div> }
function NoProjeto() { return <div style={{ background: '#F3EEE4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}><div style={{ fontSize: 48, opacity: 0.3 }}>📊</div><div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>Nenhum projeto ativo</div></div> }

// ══════════════════════════════════════════════════════════════════════════════
// TELA 1 — DASHBOARD MATURIDADE
// ══════════════════════════════════════════════════════════════════════════════

function HomeDash({ projeto, areasCalc, todosControles, loading, ultimaAtualizacao }) {
  const [areaSel, setAreaSel] = useState('')
  useEffect(() => { if (areasCalc.length > 0 && !areaSel) setAreaSel(areasCalc[0].nome) }, [areasCalc])

  const empresa = useMemo(() => calcularIndiceEmpresa(areasCalc.map(a => ({ nome: a.nome, peso: a.peso || 0, percentual: a.calc?.percentual || 0 }))), [areasCalc])
  const areaAtiva = areasCalc.find(a => a.nome === areaSel)
  const ranking = useMemo(() => [...areasCalc].filter(a => a.controles.length > 0).sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0)), [areasCalc])
  const kpisArea = useMemo(() => calcKpisPorFase(areaAtiva?.controles || []), [areaAtiva])

  function contribFaseArea(area) {
    if (!area?.calc) return [0,0,0,0,0]
    const f1 = area.calc.percentual > 0 ? 0.10 : 0
    let f2=0,f3=0,f4=0,f5=0
    ;(area.calc.detalhePorControle || []).forEach(d => { const f = d.detalheFases || {}; f2 += (f.F2E1?.contribuicao||0)+(f.F2E2?.contribuicao||0); f3 += f.F3?.contribuicao||0; f4 += (f.F4C1?.contribuicao||0)+(f.F4C2?.contribuicao||0); f5 += f.F5?.contribuicao||0 })
    return [f1,f2,f3,f4,f5]
  }
  function contribFaseEmpresa() {
    const sp = areasCalc.reduce((s, x) => s + (x.peso || 0), 0) || 1
    return areasCalc.reduce((acc, a) => { const pw = (a.peso||0)/sp; const cf = contribFaseArea(a); return acc.map((v,i) => v+cf[i]*pw) }, [0,0,0,0,0])
  }

  const cfe = contribFaseEmpresa(), cfa = contribFaseArea(areaAtiva)
  const nivelEmpresa = getNivelMaturidade(empresa.indice), nivelArea = getNivelMaturidade(areaAtiva?.calc?.percentual || 0)

  if (loading) return <Spinner />
  if (!projeto) return <NoProjeto />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.headerText}>Cliente: <strong>{projeto.clientes?.nome || 'Cliente'}</strong></span>
        <div style={{ textAlign: 'right' }}>
          <span style={S.headerText}>Maturidade do Ambiente de Controles Internos</span>
          <div style={{ fontSize: 10, color: 'rgba(243,238,228,0.55)', fontWeight: 300, marginTop: 2 }}>Última atualização: {ultimaAtualizacao}</div>
        </div>
      </div>
      <div style={S.zonaPrincipal}>
        <div style={S.colVisoes}>
          <div style={{ ...S.card, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={S.blocoLabel}>Visão Consolidada Empresa</div>
            <div style={S.visaoRow}>
              <div style={S.indiceWrap}><div style={{ fontSize: 26, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>{(empresa.indice * 100).toFixed(2)}%</div><NivelBadge pct={empresa.indice} nivel={nivelEmpresa} /></div>
              <FasesBoxes fases={cfe} />
            </div>
            <GaugeBar pct={empresa.indice} />
          </div>
          <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexShrink: 0 }}>
              <div style={S.blocoLabel}>Visão</div>
              <select value={areaSel} onChange={e => setAreaSel(e.target.value)} style={S.areaSelect}>{areasCalc.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}</select>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={S.visaoRow}>
                <div style={S.indiceWrap}><div style={{ fontSize: 24, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>{((areaAtiva?.calc?.percentual||0)*100).toFixed(2)}%</div><NivelBadge pct={areaAtiva?.calc?.percentual||0} nivel={nivelArea} /></div>
                <FasesBoxes fases={cfa} />
              </div>
              <GaugeBar pct={areaAtiva?.calc?.percentual || 0} />
              <KpisTable kpis={kpisArea} />
            </div>
          </div>
        </div>
        <div style={{ ...S.card, flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={S.secTitle}>Ranking por Área</div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr><th style={{ ...S.th, width: 28 }}>#</th><th style={{ ...S.th, textAlign: 'left' }}>Departamento</th><th style={{ ...S.th, width: 62 }}>Índice</th><th style={{ ...S.th, width: 42 }}>Nível</th><th style={{ ...S.th, width: 60 }}></th></tr></thead>
              <tbody>{ranking.map((a, i) => { const p = a.calc?.percentual||0; const nv = getNivelMaturidade(p); return (
                <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={S.tdCenter}>{i+1}</td><td style={{ padding: '4px 8px', fontSize: 11, color: '#333' }}>{a.nome}</td>
                  <td style={{ ...S.tdCenter, fontWeight: 700, color: getCorNivel(p) }}>{(p*100).toFixed(2)}%</td>
                  <td style={S.tdCenter}><span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: getCorNivel(p), padding: '2px 5px', borderRadius: 3 }}>{nv.nivel}</span></td>
                  <td style={{ padding: '4px' }}><div style={{ width: '100%', height: 5, background: '#eee', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(p*100,100)}%`, height: '100%', borderRadius: 3, background: getCorNivel(p), transition: 'width .4s' }} /></div></td>
                </tr>)})}{ranking.length === 0 && <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 11 }}>Sem dados cadastrados.</td></tr>}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.secTitle}>Trilha de Desenvolvimento</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>{FASES_NOMES.map((n, i) => (
          <div key={i} style={{ flex: 1, background: FASES_CORES[i], borderRadius: 4, padding: '6px 4px', textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 8, fontWeight: 700, opacity: .85 }}>FASE {i+1}</div><div style={{ fontSize: 8, margin: '2px 0', lineHeight: 1.2 }}>{n}</div>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', borderRadius: 2, padding: '0 6px', fontSize: 9, fontWeight: 600 }}>{FASES_PESOS[i]}%</div>
          </div>))}</div>
        <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden' }}>
          {[{flex:10,cor:'#B71C1C',l:'N1'},{flex:15,cor:'#E65100',l:'N2'},{flex:25,cor:'#F9A825',l:'N3'},{flex:30,cor:'#558B2F',l:'N4'},{flex:20,cor:'#1B5E20',l:'N5'}].map((n,i) =>
            <div key={i} style={{ flex: n.flex, background: n.cor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 8, color: '#fff', fontWeight: 600 }}>{n.l}</span></div>)}
        </div>
        <div style={{ display: 'flex', marginTop: 2 }}>
          {[{flex:10,cor:'#B71C1C',n:'Não confiável',f:'0–10%'},{flex:15,cor:'#E65100',n:'Informal',f:'11–25%'},{flex:25,cor:'#F9A825',n:'Padronizado',f:'26–50%'},{flex:30,cor:'#558B2F',n:'Monitorado',f:'51–80%'},{flex:20,cor:'#1B5E20',n:'Otimizado',f:'81–100%'}].map((n,i) =>
            <div key={i} style={{ flex: n.flex, textAlign: 'center' }}><div style={{ fontSize: 8, color: n.cor, fontWeight: 600 }}>{n.n}</div><div style={{ fontSize: 7, color: '#999' }}>{n.f}</div></div>)}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TELA 2 — VISÃO GERAL
// ══════════════════════════════════════════════════════════════════════════════

function VisaoGeral({ projeto, areasCalc, loading, ultimaAtualizacao, navigate }) {
  if (loading) return <Spinner />
  if (!projeto) return <NoProjeto />

  // Compute totals per area with criticidade breakdown
  const areaStats = useMemo(() => {
    return areasCalc.filter(a => a.controles.length > 0).map(a => {
      const ef = [0,0,0,0], inf = [0,0,0,0], gap = [0,0,0,0]
      a.controles.forEach(c => {
        const ci = Math.max(0, Math.min(3, 4 - (c.crit || 1))) // crit 4→idx0, 3→1, 2→2, 1→3
        if (isEfetivo(c.r1)) ef[ci]++
        else if (isInefetivo(c.r1)) inf[ci]++
        else if (isGap(c.r1)) gap[ci]++
      })
      return { ...a, ef, inf, gap }
    })
  }, [areasCalc])

  // Grand totals
  const totals = useMemo(() => {
    const t = { total: 0, ef: [0,0,0,0], inf: [0,0,0,0], gap: [0,0,0,0] }
    areaStats.forEach(a => {
      t.total += a.controles.length
      for (let i = 0; i < 4; i++) { t.ef[i] += a.ef[i]; t.inf[i] += a.inf[i]; t.gap[i] += a.gap[i] }
    })
    return t
  }, [areaStats])

  const sumArr = arr => arr.reduce((s, v) => s + v, 0)
  const critColors = ['#B71C1C', '#E65100', '#F9A825', '#1B5E20'] // Crítico, Significativo, Moderado, Baixo

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.headerText}>Cliente: <strong>{projeto.clientes?.nome || 'Cliente'}</strong> · Visão Geral</span>
        <span style={{ fontSize: 10, color: 'rgba(243,238,228,0.55)', fontWeight: 300 }}>Última atualização: {ultimaAtualizacao}</span>
      </div>

      {/* 4 Totals cards */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ ...vgCard, borderTopColor: '#00203E' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: '#00203E' }}>Total</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#00203E', lineHeight: 1, marginTop: 4 }}>{totals.total}</div>
        </div>
        {[
          { label: 'Efetivo', data: totals.ef, sum: sumArr(totals.ef), cor: '#1B5E20' },
          { label: 'Inefetivo', data: totals.inf, sum: sumArr(totals.inf), cor: '#B71C1C' },
          { label: 'GAP', data: totals.gap, sum: sumArr(totals.gap), cor: '#E65100' },
        ].map((g, gi) => (
          <div key={gi} style={{ ...vgCard, borderTopColor: g.cor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, color: g.cor }}>{g.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: g.cor }}>{g.sum}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {g.data.map((v, ci) => (
                <div key={ci} style={{ flex: 1, textAlign: 'center', background: `${critColors[ci]}15`, borderRadius: 3, padding: '3px 2px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: critColors[ci] }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {['Crít', 'Sign', 'Mod', 'Baixo'].map((l, ci) => (
                <div key={ci} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: '#999' }}>{l}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Table by area */}
      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#00203E', letterSpacing: .8, padding: '10px 14px', borderBottom: '1px solid #eee', flexShrink: 0 }}>Resumo por Área</div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: 'left', padding: '6px 10px', width: 180 }} rowSpan={2}>Área</th>
                <th style={{ ...S.th, padding: '6px 6px', width: 70 }} rowSpan={2}>Última Revisão</th>
                <th style={{ ...S.th, padding: '6px 6px', width: 50 }} rowSpan={2}>Total</th>
                <th style={{ ...S.th, padding: '4px 4px', background: '#1B5E20', borderRight: '2px solid #F3EEE4' }} colSpan={4}>Efetivo</th>
                <th style={{ ...S.th, padding: '4px 4px', background: '#B71C1C', borderRight: '2px solid #F3EEE4' }} colSpan={4}>Inefetivo</th>
                <th style={{ ...S.th, padding: '4px 4px', background: '#E65100' }} colSpan={4}>GAP</th>
              </tr>
              <tr>
                {[0,1,2].map(g => (
                  [
                    <th key={`${g}c`} style={{ ...vgSubTh, background: critColors[0]+'20', color: critColors[0] }}>Crít</th>,
                    <th key={`${g}s`} style={{ ...vgSubTh, background: critColors[1]+'20', color: critColors[1] }}>Sign</th>,
                    <th key={`${g}m`} style={{ ...vgSubTh, background: critColors[2]+'20', color: critColors[2] }}>Mod</th>,
                    <th key={`${g}b`} style={{ ...vgSubTh, background: critColors[3]+'20', color: critColors[3], borderRight: g < 2 ? '2px solid #F3EEE4' : 'none' }}>Baixo</th>,
                  ]
                )).flat()}
              </tr>
            </thead>
            <tbody>
              {areaStats.map(a => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/area/' + a.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(204,145,94,0.06)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, color: '#00203E', borderBottom: '1px solid #eee', fontSize: 11 }}>{a.nome}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 10, color: '#999' }}>—</td>
                  <td style={{ padding: '6px 6px', textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#00203E' }}>{a.controles.length}</td>
                  {a.ef.map((v, ci) => <td key={'e' + ci} style={{ ...vgTd, color: v > 0 ? '#1B5E20' : '#ddd' }}>{v}</td>)}
                  {a.inf.map((v, ci) => <td key={'i' + ci} style={{ ...vgTd, color: v > 0 ? '#B71C1C' : '#ddd' }}>{v}</td>)}
                  {a.gap.map((v, ci) => <td key={'g' + ci} style={{ ...vgTd, color: v > 0 ? '#E65100' : '#ddd' }}>{v}</td>)}
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: 'rgba(0,32,62,0.04)' }}>
                <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#00203E', borderTop: '2px solid #00203E', fontSize: 11 }}>TOTAL</td>
                <td style={{ padding: '8px 6px', borderTop: '2px solid #00203E' }}></td>
                <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#00203E', borderTop: '2px solid #00203E', fontSize: 12 }}>{totals.total}</td>
                {totals.ef.map((v, ci) => <td key={'te' + ci} style={{ ...vgTd, fontWeight: 700, color: '#1B5E20', borderTop: '2px solid #00203E' }}>{v}</td>)}
                {totals.inf.map((v, ci) => <td key={'ti' + ci} style={{ ...vgTd, fontWeight: 700, color: '#B71C1C', borderTop: '2px solid #00203E' }}>{v}</td>)}
                {totals.gap.map((v, ci) => <td key={'tg' + ci} style={{ ...vgTd, fontWeight: 700, color: '#E65100', borderTop: '2px solid #00203E' }}>{v}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const vgCard = { flex: 1, background: '#fff', borderRadius: 8, padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '3px solid' }
const vgSubTh = { padding: '3px 4px', fontSize: 8, fontWeight: 700, textAlign: 'center', position: 'sticky', top: 28, zIndex: 2 }
const vgTd = { padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid #eee', fontSize: 11, fontWeight: 600 }

// ══════════════════════════════════════════════════════════════════════════════
// TELA 3 — POR ÁREA
// ══════════════════════════════════════════════════════════════════════════════

function PorArea({ projeto, areasCalc, loading, navigate, loadDados }) {
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
  if (!area) return <div style={{ ...S.page, alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#999' }}>Área não encontrada.</div><button onClick={() => navigate('/visao-geral')} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 4, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>← Voltar</button></div>

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

  function badgeR(r) {
    if (!r || r === 'Teste Não Realizado') return <span style={{ ...bS, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{r||'—'}</span>
    if (isEfetivo(r)) return <span style={{ ...bS, background: 'rgba(27,94,32,0.1)', color: '#1B5E20' }}>Efetivo</span>
    if (isInefetivo(r)) return <span style={{ ...bS, background: 'rgba(183,28,28,0.1)', color: '#B71C1C' }}>Inefetivo</span>
    if (isGap(r)) return <span style={{ ...bS, background: 'rgba(230,81,0,0.1)', color: '#E65100' }}>GAP</span>
    return <span style={{ ...bS, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{r}</span>
  }

  const IMP_COLORS = { Crítico: { bg: 'rgba(240,86,86,0.12)', c: '#F05656' }, Alto: { bg: 'rgba(249,115,22,0.12)', c: '#F97316' }, Moderado: { bg: 'rgba(212,160,48,0.12)', c: '#D4A030' }, Baixo: { bg: 'rgba(34,212,160,0.12)', c: '#22D4A0' } }
  const PROB_COLORS = { Extrema: { bg: 'rgba(240,86,86,0.12)', c: '#F05656' }, Alta: { bg: 'rgba(249,115,22,0.12)', c: '#F97316' }, Média: { bg: 'rgba(212,160,48,0.12)', c: '#D4A030' }, Baixa: { bg: 'rgba(34,212,160,0.12)', c: '#22D4A0' } }
  const CRIT_COLORS = { 4: { bg: 'rgba(240,86,86,0.12)', c: '#EF4444', l: '4. Crítico' }, 3: { bg: 'rgba(249,115,22,0.12)', c: '#F97316', l: '3. Significativo' }, 2: { bg: 'rgba(212,160,48,0.12)', c: '#D4A030', l: '2. Moderado' }, 1: { bg: 'rgba(34,212,160,0.12)', c: '#22D4A0', l: '1. Baixo' } }

  function badgeImp(v) { const m = IMP_COLORS[v]; return m ? <span style={{ ...bS, background: m.bg, color: m.c }}>{v}</span> : <span style={{ ...bS, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{v||'—'}</span> }
  function badgeProb(v) { const m = PROB_COLORS[v]; return m ? <span style={{ ...bS, background: m.bg, color: m.c }}>{v}</span> : <span style={{ ...bS, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{v||'—'}</span> }
  function badgeCrit(v) { const m = CRIT_COLORS[v]; return m ? <span style={{ ...bS, background: m.bg, color: m.c }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />{m.l}</span> : <span style={{ ...bS, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{v||'—'}</span> }

  return (
    <div style={{ ...S.page, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => navigate('/visao-geral')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,32,62,0.08)', border: '1px solid rgba(0,32,62,0.15)', borderRadius: 4, padding: '4px 10px', fontSize: 10, fontWeight: 600, color: '#00203E', cursor: 'pointer', fontFamily: 'inherit' }}>← VOLTAR</button>
        <div><div style={{ fontSize: 18, fontWeight: 600, color: '#00203E' }}>{nome}</div><div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{area.controles.length} controles · Peso empresa: {pesoEmpresa}%</div></div>
      </div>

      {/* 5 KPI cards */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{ ...kpiS, borderTopColor: '#00203E' }}><div style={{ fontSize: 24, fontWeight: 300, color: '#00203E', lineHeight: 1 }}>{(p*100).toFixed(1)}%</div><div style={{ ...kpiLbl, color: '#00203E' }}>Maturidade <NivelBadge pct={p} nivel={nv} /></div></div>
        <div style={{ ...kpiS, borderTopColor: '#1B5E20' }}><div style={{ fontSize: 24, fontWeight: 300, color: '#1B5E20', lineHeight: 1 }}>{efetivos}</div><div style={{ ...kpiLbl, color: '#1B5E20' }}>Efetivos</div></div>
        <div style={{ ...kpiS, borderTopColor: '#B71C1C' }}><div style={{ fontSize: 24, fontWeight: 300, color: '#B71C1C', lineHeight: 1 }}>{inefetivos}</div><div style={{ ...kpiLbl, color: '#B71C1C' }}>Inefetivos</div></div>
        <div style={{ ...kpiS, borderTopColor: '#E65100' }}><div style={{ fontSize: 24, fontWeight: 300, color: '#E65100', lineHeight: 1 }}>{gaps}</div><div style={{ ...kpiLbl, color: '#E65100' }}>GAPs</div></div>
        <div style={{ ...kpiS, borderTopColor: '#CC915E' }}><div style={{ fontSize: 24, fontWeight: 300, color: '#CC915E', lineHeight: 1 }}>{planosAcao}</div><div style={{ ...kpiLbl, color: '#CC915E' }}>Planos de Ação</div></div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar risco, controle, inconsistência..." style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, outline: 'none', color: '#333' }} />
        <select value={filtCrit} onChange={e => setFiltCrit(e.target.value)} style={fS}><option value="">Todas criticidades</option>{crits.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={filtImp} onChange={e => setFiltImp(e.target.value)} style={fS}><option value="">Todos impactos</option>{imps.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={filtRes} onChange={e => setFiltRes(e.target.value)} style={fS}><option value="">Todos resultados F1</option>{ress.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <div style={{ fontSize: 10, color: '#999', background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '5px 10px' }}>{cf.length} controles</div>
      </div>

      {/* MRC Table */}
      <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Data Últ. Atual.','Gerência','Resp. Subproc.','Processo','Subprocesso','Ref. Risco','Desc. Risco','Ref. Controle','Desc. Controle','Categoria','Frequência','Natureza','Caract.','Sistema','Ctrl Chave?','Passos Teste','Resultado','Desc. Inconsist.','Recomendação','Impacto','Probab.','Criticidade','Fase Atual'].map((h,i) =>
                <th key={i} style={{ ...S.th, textAlign: 'left', padding: '7px 8px', fontSize: 8, letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>)}
              <th style={{ ...S.th, width: 40 }}></th>
            </tr></thead>
            <tbody>{cf.map((c, i) => { const fl = faseLabel(c); return (
              <tr key={c.id||i} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <Td>{c.dt_ult || '—'}</Td>
                <Td>{c.ger}</Td><Td>{c.resp_sub}</Td><Td>{c.area}</Td><Td>{c.sub}</Td>
                <td style={{ ...tS, color: '#CC915E', fontWeight: 600 }}>{c.rr}</td><Td w={200}>{c.dr}</Td>
                <td style={{ ...tS, color: '#CC915E', fontWeight: 600 }}>{c.rc}</td><Td w={200}>{c.dc}</Td>
                <Td>{c.cat}</Td><Td>{c.freq}</Td><Td>{c.nat}</Td><Td>{c.car}</Td><Td>{c.sis}</Td><Td>{c.chave}</Td>
                <Td w={180}>{c.passos_f1}</Td><td style={tS}>{badgeR(c.r1)}</td><Td w={180}>{c.incons}</Td><Td w={180}>{c.rec}</Td>
                <td style={tS}>{badgeImp(c.imp)}</td><td style={tS}>{badgeProb(c.prob)}</td><td style={tS}>{badgeCrit(c.crit)}</td>
                <td style={tS}><div style={{ fontSize: 10, fontWeight: 500, color: '#00203E', borderLeft: '3px solid #CC915E', paddingLeft: 6, lineHeight: 1.3 }}>{fl.f}</div><div style={{ fontSize: 9, color: '#999', paddingLeft: 9 }}>{fl.s}</div></td>
                <td style={{ ...tS, textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                    <button onClick={() => setModalRow(c)} style={{ background: 'rgba(0,32,62,0.08)', border: '1px solid rgba(0,32,62,0.15)', borderRadius: 3, padding: '2px 10px', fontSize: 10, fontWeight: 600, color: '#00203E', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Ver</button>
                    {canEdit && <button onClick={() => setAtualizarRow(c)} style={{ background: 'rgba(204,145,94,0.1)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 3, padding: '2px 10px', fontSize: 10, fontWeight: 600, color: '#A6512F', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>Atualizar</button>}
                    {c.status_workflow === 'em_analise' && <span style={{ fontSize: 8, fontWeight: 700, color: '#A6512F', background: 'rgba(204,145,94,0.15)', padding: '1px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Em Análise</span>}
                    {c.status_workflow === 'teste_pendente' && <span style={{ fontSize: 8, fontWeight: 700, color: '#9A7B00', background: 'rgba(249,168,37,0.15)', padding: '1px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Teste Pendente</span>}
                  </div>
                </td>
              </tr>)})}{cf.length === 0 && <tr><td colSpan={24} style={{ padding: 32, textAlign: 'center', color: '#999' }}>Nenhum controle encontrado.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      {modalRow && <ModalDetalhe row={modalRow} onClose={() => setModalRow(null)} />}
      {atualizarRow && <ModalAtualizar row={atualizarRow} onClose={() => setAtualizarRow(null)} onSaved={() => { setAtualizarRow(null); if (projeto?.id) loadDados(projeto.id) }} areas={areasCalc} projetoId={projeto?.id} />}
    </div>
  )
}

const kpiS = { flex: 1, background: '#fff', borderRadius: 8, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '3px solid' }
const kpiLbl = { fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }

function Td({ children, w = 150 }) { return <td style={{ ...tS, maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children || '—'}</td> }

const tS = { padding: '8px', borderBottom: '1px solid #eee', fontSize: 11, color: '#333', whiteSpace: 'nowrap', verticalAlign: 'top' }
const bS = { display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600 }
const fS = { background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '5px 8px', fontFamily: 'inherit', fontSize: 10, color: '#333', cursor: 'pointer', outline: 'none' }

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  page: { background: '#F3EEE4', height: '100vh', padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", color: '#333', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' },
  header: { background: '#00203E', borderRadius: 6, padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerText: { fontSize: 13, fontWeight: 400, color: '#F3EEE4', fontFamily: "'Montserrat', sans-serif" },
  zonaPrincipal: { display: 'flex', gap: 8, flex: 1, minHeight: 0 },
  colVisoes: { display: 'flex', flexDirection: 'column', gap: 6, flex: 3, minHeight: 0, overflow: 'hidden' },
  card: { background: '#fff', borderRadius: 6, padding: '8px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  blocoLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#00203E', letterSpacing: .7, marginBottom: 4 },
  visaoRow: { display: 'flex', alignItems: 'center', gap: 12 },
  indiceWrap: { minWidth: 110, flexShrink: 0 },
  areaSelect: { fontSize: 13, fontWeight: 700, color: '#00203E', background: 'transparent', border: 'none', borderBottom: '2px solid #CC915E', outline: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", padding: '2px 4px' },
  secTitle: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#00203E', letterSpacing: .6, marginBottom: 6, textAlign: 'center' },
  th: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: '#00203E', padding: '5px 4px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 2 },
  tdCenter: { padding: '4px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#00203E' },
}
