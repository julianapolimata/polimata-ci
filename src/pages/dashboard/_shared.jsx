import { useState } from 'react'
import ImportarMRC from '../../components/ImportarMRC'
import { gerarTemplateMRC } from '../../lib/templateMRC'
import { impToIdx as mzImpToIdx, probToIdx as mzProbToIdx, imps as mzImpsFn, probs as mzProbsFn, coresMatriz as mzCoresFn } from '../../lib/matrizCalor'

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES COMPARTILHADAS — Dashboard, HomeDash, HomeDashDiagnostico, PorArea
// ══════════════════════════════════════════════════════════════════════════════

// Cores VIVAS da régua de maturidade
export const NIVEL_CORES = { N1: '#DC2626', N2: '#EA580C', N3: '#EAB308', N4: '#16A34A', N5: '#15803D' }
// Cores semânticas (resultado)
export const COR_EFETIVO = '#22C55E'
export const COR_INEFETIVO = '#FACC15'
export const COR_GAP = '#EF4444'
// Cores criticidade
export const CRIT_CORES = ['#EF4444', '#F97316', '#EAB308', '#22C55E'] // 4=Crítico, 3=Significativo, 2=Moderado, 1=Baixo
export const CRIT_LABELS = ['Crítico', 'Significativo', 'Moderado', 'Baixo']
// Impacto / Probabilidade labels
export const IMP_LABELS = ['Crítico', 'Alto', 'Moderado', 'Baixo']
export const PROB_LABELS = ['Extrema', 'Alta', 'Média', 'Baixa']
// Heatmap cell colors: criticidade resultante [impacto][probabilidade]
export const HEAT_CORES = [
  ['#EF4444', '#EF4444', '#F97316', '#EAB308'],
  ['#EF4444', '#F97316', '#EAB308', '#EAB308'],
  ['#F97316', '#EAB308', '#EAB308', '#22C55E'],
  ['#EAB308', '#22C55E', '#22C55E', '#22C55E'],
]

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS DE COR / GRADIENTE
// ══════════════════════════════════════════════════════════════════════════════

export function getCorNivel(pct) {
  if (pct >= 0.81) return NIVEL_CORES.N5
  if (pct >= 0.51) return NIVEL_CORES.N4
  if (pct >= 0.26) return NIVEL_CORES.N3
  if (pct >= 0.11) return NIVEL_CORES.N2
  return NIVEL_CORES.N1
}

export function getBarGradient(pct100) {
  const stops = [
    [0, '#DC2626'], [10, '#EF4444'], [25, '#EA580C'], [40, '#F97316'],
    [50, '#EAB308'], [65, '#84CC16'], [80, '#22C55E'], [100, '#15803D'],
  ]
  const relevant = stops.filter(([p]) => p <= pct100)
  if (relevant.length === 0) return '#DC2626'
  const gradStops = relevant.map(([p, c]) => {
    const norm = pct100 > 0 ? (p / pct100) * 100 : 0
    return `${c} ${norm.toFixed(0)}%`
  })
  return `linear-gradient(90deg, ${gradStops.join(', ')})`
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS DE RESULTADO / PLANO DE AÇÃO
// ══════════════════════════════════════════════════════════════════════════════

export function isEfetivo(r) { return (r || '').toLowerCase() === 'efetivo' }
export function isInefetivo(r) { return (r || '').toLowerCase() === 'inefetivo' }
export function isGap(r) { const v = (r || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }
export function precisaPlanoAcao(c) { return isInefetivo(c.r1) || isGap(c.r1) || isInefetivo(c.r_ader) || isGap(c.r_ader) || isInefetivo(c.r3) || isGap(c.r3) }
export function planoAcaoConcluido(c) { const st = (c.st_pa || '').toLowerCase(); return st === 'efetivo' || st === 'concluído' || st === 'concluido' || st === 'ok' }

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS DE DATA
// ══════════════════════════════════════════════════════════════════════════════

export function getUltimaAtualizacao(controles) {
  let max = null
  controles.forEach(c => {
    const d = c.dt_ult || c.atualizado_em || c.criado_em
    if (d) { const dt = new Date(d); if (!isNaN(dt) && (!max || dt > max)) max = dt }
  })
  return max ? max.toLocaleDateString('pt-BR') : '—'
}

export function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  // Rejeita datas claramente inválidas (Excel epoch 1899/1900, Unix epoch 1970)
  if (d.getFullYear() < 2000) return '—'
  return d.toLocaleDateString('pt-BR')
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS IMP/PROB/CRIT → INDEX
// ══════════════════════════════════════════════════════════════════════════════

// Mapeia imp/prob string para index (0=mais grave)
export function impToIdx(v, size = 4) { return mzImpToIdx(v, size) }
export function probToIdx(v, size = 4) { return mzProbToIdx(v, size) }
export function labelsImp(size) { return mzImpsFn(size) }
export function labelsProb(size) { return mzProbsFn(size) }
export function coresMz(size) { return mzCoresFn(size) }
// crit integer to idx: 4→0 (Crítico), 3→1, 2→2, 1→3 (Baixo)
export function critToIdx(c) { return Math.max(0, Math.min(3, 4 - (c || 1))) }

// ══════════════════════════════════════════════════════════════════════════════
// LABELS DE PAPEL
// ══════════════════════════════════════════════════════════════════════════════

export function papelLabel(p) { return { admin_polimata: 'Admin Polímata', consultor_polimata: 'Consultor', gestor_cliente: 'Gestor', usuario_cliente: 'Usuário' }[p] || p || '—' }

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTILHADOS
// ══════════════════════════════════════════════════════════════════════════════

export function NivelBadge({ pct, nivel }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: getCorNivel(pct), padding: '3px 10px', borderRadius: 999, marginTop: 3, textTransform: 'uppercase', display: 'inline-block' }}>{nivel.nivel} — {nivel.nome}</div>
}

export function Spinner({ light }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: light ? 'var(--lt-bg)' : 'var(--bg0)' }}><div className="spinner" /></div>
}

export function NoProjeto() {
  return (
    <div style={{ background: 'var(--bg0)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(204,145,94,0.15), rgba(204,145,94,0.05))', border: '1px solid rgba(204,145,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📊</div>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: 'var(--cream)', marginBottom: 8, fontFamily: "'Raleway', sans-serif", letterSpacing: '.3px' }}>Bem-vindo ao Polímata GRC</h2>
        <p style={{ fontSize: 13, color: 'rgba(247,243,238,0.5)', lineHeight: 1.7, marginBottom: 24 }}>
          Nenhum projeto ativo foi encontrado para o seu perfil. Para começar, peça ao administrador que vincule você a um projeto.
        </p>
      </div>
    </div>
  )
}

export function EmptyProjectState({ navigate, isAdmin, projetoId, projeto, areasCalc, onImported }) {
  const [showImportModal, setShowImportModal] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 400 }}>
      <div style={{ textAlign: 'center', maxWidth: 520, padding: 40, background: 'var(--lt-bg)', borderRadius: 16, border: '1px dashed rgba(204,145,94,0.3)' }}>
        <div style={{ width: 72, height: 72, margin: '0 auto 20px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(204,145,94,0.12), rgba(204,145,94,0.04))', border: '1px solid rgba(204,145,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🚀</div>
        <h3 style={{ fontSize: 17, fontWeight: 300, color: 'var(--lt-text1)', marginBottom: 8, fontFamily: "'Raleway', sans-serif" }}>Vamos começar?</h3>
        <p style={{ fontSize: 12, color: 'var(--lt-text2)', lineHeight: 1.8, marginBottom: 20 }}>
          Este projeto ainda não possui riscos e controles cadastrados. Você pode importar em massa usando o template da MRC ou cadastrar um a um na visão por área.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => gerarTemplateMRC(undefined, projeto)}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', color: 'var(--copper)', border: '1px solid var(--copper)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            📄 Baixar Template MRC
          </button>
          <button onClick={() => setShowImportModal(true)}
            style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, var(--gold-md), var(--gold))', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 Importar Template MRC
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--lt-text3)', marginTop: 16 }}>
          Baixe o template para preencher offline e depois solicite a importação ao administrador. Na visão por área (sidebar), use o botão "Novo Risco" para cadastrar controles individualmente.
        </p>
      </div>

      {/* Modal de Importação */}
      {showImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowImportModal(false)}>
          <div style={{ background: 'var(--lt-card)', borderRadius: 16, maxWidth: 920, width: '95%', maxHeight: '90vh', overflow: 'auto', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImportModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 18, color: 'var(--lt-text3)', cursor: 'pointer', zIndex: 1 }} title="Fechar">✕</button>
            <ImportarMRC projetoId={projetoId} projeto={projeto} areas={areasCalc} allowNonAdmin={true} onImported={() => { setShowImportModal(false); if (onImported) onImported() }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS DASHBOARD (tema escuro) — compartilhado entre HomeDash e HomeDashDiagnostico
// ══════════════════════════════════════════════════════════════════════════════

export const dashStyles = {
  page: { background: 'var(--bg0)', minHeight: '100vh', padding: '0 20px 12px', fontFamily: "'Montserrat', sans-serif", color: 'var(--cream)', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  /* header agora é inline, estilos diretos no JSX */
  kpiRow: { display: 'flex', gap: 8, flexShrink: 0, margin: '8px 0' },
  kpiCard: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid' },
  kpiLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(247,243,238,0.45)', marginBottom: 5 },
  kpiValor: { fontSize: 26, fontWeight: 300, lineHeight: 1 },
  kpiSub: { fontSize: 10, color: 'rgba(247,243,238,0.3)', marginTop: 4 },
  kpiBadge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, color: '#fff' },
  cardDark: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, flexShrink: 0 },
  cardTitle: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(247,243,238,0.4)', marginBottom: 10 },
  limparFiltro: { background: 'rgba(204,145,94,0.15)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 600, color: 'var(--copper)', cursor: 'pointer', fontFamily: 'inherit' },
  areaList: { maxHeight: 340, overflowY: 'auto', paddingRight: 4 },
  areaRow: { display: 'flex', alignItems: 'center', padding: '6px 4px', gap: 10, borderRadius: 4, transition: 'background .15s' },
  areaRank: { fontSize: 10, fontWeight: 500, color: 'rgba(247,243,238,0.25)', width: 18, textAlign: 'right', flexShrink: 0 },
  areaNome: { fontSize: 12, fontWeight: 500, color: 'var(--cream)', width: 180, flexShrink: 0 },
  areaBarWrap: { flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  areaBar: { height: '100%', borderRadius: 4, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' },
  areaPct: { fontSize: 12, fontWeight: 600, color: 'var(--cream)', width: 50, textAlign: 'right', flexShrink: 0 },
  nivelBadge: { fontSize: 10, fontWeight: 700, color: '#fff', padding: '2px 7px', borderRadius: 999, flexShrink: 0, minWidth: 28, textAlign: 'center' },
  zonaInferior: { display: 'flex', gap: 8, flex: 1, minHeight: 0, overflow: 'hidden' },
  heatYLabels: { display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingRight: 8, width: 70, flexShrink: 0 },
  heatYLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(247,243,238,0.5)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  heatBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  heatRow: { display: 'flex', gap: 3, flex: 1 },
  heatCell: { flex: 1, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', minHeight: 50, transition: 'transform .15s', cursor: 'default' },
  heatXLabels: { display: 'flex', paddingLeft: 78, paddingTop: 6, gap: 3 },
  heatXLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'rgba(247,243,238,0.5)' },
  heatLegend: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(247,243,238,0.45)' },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  critTh: { padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', position: 'sticky', top: 0, zIndex: 2, background: 'rgba(7,26,46,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  critTdArea: { padding: '5px 8px', fontSize: 10, fontWeight: 500, color: 'var(--cream)', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' },
  critTdNum: { padding: '5px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  critTdTotal: { padding: '5px 8px', fontSize: 11, fontWeight: 600, color: 'rgba(247,243,238,0.5)', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  critTfoot: { padding: '8px', fontSize: 10, fontWeight: 700, textAlign: 'center', color: 'rgba(247,243,238,0.6)', borderTop: '1px solid rgba(255,255,255,0.1)' },
}
