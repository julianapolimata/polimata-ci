// PorAreaTopo — bloco JSX extraído de PorArea.jsx em 22/mai/2026 (fatiamento Etapa 6).
// Diff-zero: cópia direta do parent. Recebe state e helpers via prop `ctx`.
import React from 'react'
import { CRIT_CORES, CRIT_LABELS, HEAT_CORES, IMP_LABELS, PROB_LABELS, NivelBadge } from '../_shared'
import NotificacoesPanel from '../../../components/NotificacoesPanel'

export default function PorAreaTopo({ ctx }) {
  const { PA, area, areaHeatmap, controles, dashCollapsed, efetivos, gaps, inefetivos, isDiagnostico, navigate, nome, nv, p, pa_crit, pa_ex, pa_ix, pa_pc, pa_pct, pa_total, pesoEmpresa, planosAcao, setDashCollapsed } = ctx
  return (
    <>
      {/* HEADER — padrão MRC Completa */}
      <div className="mrc-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/ci')} style={PA.btnVoltar}>← VOLTAR</button>
          <div>
            <div className="dash-eye">Matriz de Riscos e Controles</div>
            <div className="dash-ttl" style={{ marginBottom: 0, fontSize: 18 }}>{nome}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="mrc-header-stats">
            <div className="mrc-stat"><span className="mrc-stat-n">{area.controles.length}</span><span className="mrc-stat-l">controles</span></div>
            <div className="mrc-stat"><span className="mrc-stat-n">{pesoEmpresa}%</span><span className="mrc-stat-l">peso empresa</span></div>
          </div>
          <NotificacoesPanel />
        </div>
      </div>

      {/* TOGGLE COLAPSAR DASH */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }}>
        <button onClick={() => setDashCollapsed(c => !c)} style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 999, padding: '2px 18px', cursor: 'pointer', fontSize: 10, color: 'var(--lt-text3)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
          {dashCollapsed ? '▼ Expandir painel' : '▲ Recolher painel'}
        </button>
      </div>

      {/* ZONA SUPERIOR — HEATMAP + KPI GRID */}
      {!dashCollapsed && <div style={PA.zonaSuperior}>
        {/* HEATMAP */}
        <div style={PA.heatCard}>
          <div style={PA.cardTitle}>Mapa de Calor — Impacto × Probabilidade</div>
          <div style={{ display: 'flex', flex: 1 }}>
            <div style={PA.heatYLabels}>
              {IMP_LABELS.map(l => <div key={l} style={PA.heatYLabel}>{l}</div>)}
            </div>
            <div style={PA.heatGrid}>
              {areaHeatmap.map((row, ri) => (
                <div key={ri} style={PA.heatRow}>
                  {row.map((val, ci) => (
                    <div key={ci} style={{ ...PA.heatCell, background: val === 0 ? 'rgba(10,37,64,0.04)' : HEAT_CORES[ri][ci] }}>
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={PA.heatXLabels}>
            {PROB_LABELS.map(l => <div key={l} style={PA.heatXLabel}>{l}</div>)}
          </div>
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--lt-text3)' }}>Probabilidade →</div>
          <div style={PA.heatLegend}>
            {CRIT_LABELS.map((l, i) => (
              <div key={l} style={PA.legendItem}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CRIT_CORES[i] }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* KPI GRID — versão diagnóstico ou maturidade */}
        {isDiagnostico ? (
          <div style={PA.kpiGrid}>
            <div style={{ ...PA.kpiCard, borderTopColor: 'var(--navy)' }}>
              <div style={PA.kpiLabel}>Total de Controles</div>
              <div style={{ ...PA.kpiValor, color: 'var(--navy)' }}>{pa_total}</div>
              <div style={PA.kpiSub}>Peso empresa: {pesoEmpresa}%</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: '#22C55E' }}>
              <div style={PA.kpiLabel}>Existentes</div>
              <div style={{ ...PA.kpiValor, color: '#22C55E' }}>{pa_ex}</div>
              <div style={PA.kpiSub}>{pa_pct(pa_ex)}% do total</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: '#FACC15' }}>
              <div style={PA.kpiLabel}>Parciais</div>
              <div style={{ ...PA.kpiValor, color: '#FACC15' }}>{pa_pc}</div>
              <div style={PA.kpiSub}>{pa_pct(pa_pc)}% do total</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: '#EF4444' }}>
              <div style={PA.kpiLabel}>Inexistentes</div>
              <div style={{ ...PA.kpiValor, color: '#EF4444' }}>{pa_ix}</div>
              <div style={PA.kpiSub}>{pa_pct(pa_ix)}% do total</div>
            </div>
            <div style={{ ...PA.kpiCard, borderTopColor: 'var(--copper)' }}>
              <div style={PA.kpiLabel}>Riscos Críticos</div>
              <div style={{ ...PA.kpiValor, color: 'var(--copper)' }}>{pa_crit}</div>
              <div style={PA.kpiSub}>atenção prioritária</div>
            </div>
          </div>
        ) : (
        <div style={PA.kpiGrid}>
          <div style={{ ...PA.kpiCard, borderTopColor: 'var(--copper)' }}>
            <div style={PA.kpiLabel}>Maturidade</div>
            <div style={{ ...PA.kpiValor, color: 'var(--copper)' }}>{(p*100).toFixed(1)}%</div>
            <NivelBadge pct={p} nivel={nv} />
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: 'var(--navy)' }}>
            <div style={PA.kpiLabel}>Total de Controles</div>
            <div style={{ ...PA.kpiValor, color: 'var(--navy)' }}>{area.controles.length}</div>
            <div style={PA.kpiSub}>Peso empresa: {pesoEmpresa}%</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#22C55E' }}>
            <div style={PA.kpiLabel}>Efetivos</div>
            <div style={{ ...PA.kpiValor, color: '#22C55E' }}>{efetivos}</div>
            <div style={PA.kpiSub}>{area.controles.length > 0 ? Math.round(efetivos / area.controles.length * 100) : 0}% do total</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#FACC15' }}>
            <div style={PA.kpiLabel}>Inefetivos</div>
            <div style={{ ...PA.kpiValor, color: '#FACC15' }}>{inefetivos}</div>
            <div style={PA.kpiSub}>Aguardam ação corretiva</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTopColor: '#EF4444' }}>
            <div style={PA.kpiLabel}>GAP</div>
            <div style={{ ...PA.kpiValor, color: '#EF4444' }}>{gaps}</div>
            <div style={PA.kpiSub}>Riscos sem controle</div>
          </div>
          <div style={{ ...PA.kpiCard, borderTop: 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #CC915E, #A6512F)' }} />
            <div style={PA.kpiLabel}>Planos de Ação</div>
            <div style={{ ...PA.kpiValor, color: 'var(--copper)' }}>{planosAcao}</div>
            <div style={PA.kpiSub}>Em desenvolvimento</div>
          </div>
        </div>)}
      </div>}
    </>
  )
}
