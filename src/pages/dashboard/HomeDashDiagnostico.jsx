import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { calcularDiagnosticoProjeto } from '../../lib/calculoMaturidade'
import ModalPromoverTeste from '../../components/ModalPromoverTeste'
import {
  COR_EFETIVO, COR_INEFETIVO, COR_GAP,
  CRIT_CORES, CRIT_LABELS, IMP_LABELS, PROB_LABELS, HEAT_CORES,
  impToIdx, probToIdx, critToIdx,
  Spinner, NoProjeto, EmptyProjectState,
  dashStyles,
} from './_shared'

// ══════════════════════════════════════════════════════════════════════════════
// TELA HOME — DIAGNÓSTICO (projetos com f1_tem_teste=false)
// Para projetos sem teste de efetividade. Mostra Existência × Criticidade
// em vez de Maturidade N1-N5.
// ══════════════════════════════════════════════════════════════════════════════

export default function HomeDashDiagnostico({ projeto, areasCalc, todosControles, loading, ultimaAtualizacao, loadDados }) {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [areaFiltro, setAreaFiltro] = useState(null)
  const [showPromover, setShowPromover] = useState(false)

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

  const ativosDiag = todosControles.filter(c => c.ativo !== false)
  const diagConcluido = ativosDiag.length > 0 && ativosDiag.every(c => c.status_workflow === 'aprovado' && c.crit != null && !c.crit_revalidar)
  const isAdmin = perfil?.papel === 'admin_polimata'
  const mostrarPromover = projeto?.f1_tem_teste === false && diagConcluido && isAdmin

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

      {mostrarPromover && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: '#22C55E' }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)' }}>Diagnóstico concluído — pronto para promover para teste</div>
              <div style={{ fontSize: 11, color: 'rgba(247,243,238,0.7)', marginTop: 2 }}>Todos os controles estão concluídos. Avance para o fluxo de teste (régua N1–N5). O diagnóstico é preservado.</div>
            </div>
          </div>
          <button onClick={() => setShowPromover(true)} style={{ background: '#CC915E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>↥ Promover para teste</button>
        </div>
      )}
      {showPromover && <ModalPromoverTeste projeto={projeto} onClose={() => setShowPromover(false)} onPromoted={() => { setShowPromover(false); if (projeto?.id) loadDados(projeto.id) }} />}

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
