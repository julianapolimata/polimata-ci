import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getResultadoVitrine } from '../../lib/fases'
import { matrizSize } from '../../lib/matrizCalor'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { calcularIndiceEmpresa, getNivelMaturidade } from '../../lib/calculoMaturidade'
import {
  NIVEL_CORES, COR_EFETIVO, COR_INEFETIVO, COR_GAP,
  CRIT_CORES, CRIT_LABELS,
  getCorNivel, getBarGradient,
  isEfetivo, isInefetivo, isGap, precisaPlanoAcao, planoAcaoConcluido,
  impToIdx, probToIdx, critToIdx, labelsImp, labelsProb, coresMz,
  Spinner, NoProjeto, EmptyProjectState,
  dashStyles,
} from './_shared'

// ══════════════════════════════════════════════════════════════════════════════
// TELA 1 — DASHBOARD (REDESIGN v7)
// ══════════════════════════════════════════════════════════════════════════════

export default function HomeDash({ projeto, areasCalc, todosControles, loading, ultimaAtualizacao, loadDados }) {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [areaFiltro, setAreaFiltro] = useState(null)

  const empresa = useMemo(() => calcularIndiceEmpresa(areasCalc.map(a => ({ nome: a.nome, peso: a.peso || 0, percentual: a.calc?.percentual || 0 }))), [areasCalc])
  const ranking = useMemo(() => [...areasCalc].filter(a => a.controles.length > 0).sort((a, b) => (b.calc?.percentual || 0) - (a.calc?.percentual || 0)), [areasCalc])

  const kpis = useMemo(() => {
    let ef = 0, inf = 0, gap = 0, pa = 0
    todosControles.forEach(c => {
      const rv = getResultadoVitrine(c, projeto)
      if (isEfetivo(rv)) ef++
      else if (isInefetivo(rv)) inf++
      else if (isGap(rv)) gap++
      if (precisaPlanoAcao(c) && !planoAcaoConcluido(c)) pa++
    })
    return { ef, inf, gap, pa }
  }, [todosControles])

  const mzSize = matrizSize(projeto)
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: mzSize }, () => Array(mzSize).fill(0))
    const controles = areaFiltro
      ? todosControles.filter(c => {
          const area = areasCalc.find(a => a.nome === areaFiltro)
          return area && (c.area_id === area.id || c.area === area.nome)
        })
      : todosControles
    controles.forEach(c => {
      const ri = impToIdx(c.imp, mzSize), ci = probToIdx(c.prob, mzSize)
      if (ri >= 0 && ci >= 0) grid[ri][ci]++
    })
    return grid
  }, [todosControles, areasCalc, areaFiltro, mzSize])
  const mzImps = labelsImp(mzSize)
  const mzProbs = labelsProb(mzSize)
  const mzCores = coresMz(mzSize)

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
                {mzImps.map(l => <div key={l} style={D.heatYLabel}>{l}</div>)}
              </div>
              <div style={D.heatBody}>
                {heatmapData.map((row, ri) => (
                  <div key={ri} style={D.heatRow}>
                    {row.map((val, ci) => (
                      <div key={ci} style={{ ...D.heatCell, background: val === 0 ? 'rgba(255,255,255,0.04)' : mzCores[ri][ci] }}>
                        {val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div style={D.heatXLabels}>
              {mzProbs.map(l => <div key={l} style={D.heatXLabel}>{l}</div>)}
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
