import { useState, useRef, useMemo } from 'react'
import { getResultadoVitrine, getFaseLabel, getStatusComputado } from '../../lib/fases'
import { getStatusConfig } from '../../lib/statusWorkflow'
import {
  fmtDate, critBadge, badgeResultado, badgeFaseMRC, faseValMRC, RegressaoBadgeMRC,
  badgeExistencia, TdMRC, sortVal,
  MRC_DATA_COLS, MRC_FASE_HDR, MRC_FASE_KEYS, FASE_W, mrcFaseThS, mrcThS, mrcTdS,
} from './badges'

// ─── TABELA MRC ──────────────────────────────────────────────────────────────

// Headers de fase coloridos (padrão PorArea)
function TabelaMRC({ rows, onOpenModal, isDiagnostico = false, projeto }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const toggle = (k) => { if (sortCol === k) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setSortCol(k); setSortDir('asc') } }
  const arrow = (k) => sortCol === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
  const tableRef = useRef(null)

  // Em diagnóstico: esconde "Resultado" (não há teste) e "Fase Atual" (sempre F1)
  const dataCols = isDiagnostico
    ? MRC_DATA_COLS.filter(c => c.k !== '_resultado' && c.k !== '_fase_atual')
    : MRC_DATA_COLS

  // Em diagnóstico: só F1, renomeada "Existência"
  const faseHdr = isDiagnostico
    ? [{ h: 'Fase 1\nDiagnóstico', bg: '#00203E' }]
    : MRC_FASE_HDR
  const faseKeys = isDiagnostico ? ['existencia'] : MRC_FASE_KEYS

  const sorted = useMemo(() => {
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      let va = sortVal(a, sortCol, projeto), vb = sortVal(b, sortCol, projeto)
      if (sortCol === '_dt') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0; return sortDir === 'asc' ? va - vb : vb - va }
      va = String(va).toLowerCase(); vb = String(vb).toLowerCase()
      const cmp = va.localeCompare(vb, 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  const thClick = { cursor: 'pointer', userSelect: 'none' }
  return (<>
    <div ref={tableRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {dataCols.map((col, i) => <th key={i} style={{ ...mrcThS, width: col.w, minWidth: col.w, textAlign: 'center', ...thClick }} onClick={() => toggle(col.k)}>{col.h}{arrow(col.k)}</th>)}
          {faseHdr.map((f, i) => <th key={`f${i}`} style={{ ...mrcFaseThS, background: f.bg, ...(isDiagnostico ? { width: 130, minWidth: 130, maxWidth: 130 } : {}), ...thClick }} onClick={() => toggle(faseKeys[i])}>{f.h}{arrow(faseKeys[i])}</th>)}
        </tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={dataCols.length + faseHdr.length} style={{ textAlign: 'center', padding: 24, color: 'var(--lt-text3)', fontSize: 12 }}>Nenhum controle encontrado com os filtros aplicados.</td></tr>}
          {sorted.map(row => (
            <tr key={row.id} style={{ cursor: 'pointer', ...((row.status_risco === 'evitado' || row.status_risco === 'transferido') ? { opacity: 0.55, fontStyle: 'italic' } : {}) }} onClick={() => onOpenModal(row)} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
              <td style={{ ...mrcTdS, width: 95, minWidth: 95, fontSize: 11, color: 'var(--lt-text3)', textAlign: 'center' }}>{fmtDate(row.dt_ult || row.atualizado_em || row.criado_em)}</td>
              <TdMRC w={120}>{row.area}</TdMRC>
              <TdMRC w={120}>{row.sub}</TdMRC>
              <td style={{ ...mrcTdS, color: 'var(--copper-text)', fontWeight: 700, width: 80, minWidth: 80, textAlign: 'center' }}>{row.rr}</td>
              <TdMRC w={200}>{row.dr}</TdMRC>
              <td style={{ ...mrcTdS, color: 'var(--copper-text)', fontWeight: 700, width: 90, minWidth: 90, textAlign: 'center' }}>{row.rc}</td>
              <TdMRC w={200}>{row.dc}</TdMRC>
              {!isDiagnostico && <td style={{ ...mrcTdS, width: 90, minWidth: 90, textAlign: 'center' }}>{badgeResultado(getResultadoVitrine(row, projeto))}</td>}
              <td style={{ ...mrcTdS, width: 110, minWidth: 110, textAlign: 'center' }}>{critBadge(row.crit)}</td>
              {!isDiagnostico && <td style={{ ...mrcTdS, width: 130, minWidth: 130, fontSize: 11, fontWeight: 500, textAlign: 'center' }}>{getFaseLabel(row)}{row.num_regressoes > 0 && <RegressaoBadgeMRC n={row.num_regressoes} />}</td>}
              <td style={{ ...mrcTdS, width: 110, minWidth: 110, textAlign: 'center' }}>{(() => { const st = getStatusComputado(row); const cfg = getStatusConfig(st); return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{cfg.label}</span> })()}</td>
              {isDiagnostico ? (
                <td style={{ ...mrcTdS, width: 130, minWidth: 130, maxWidth: 130, textAlign: 'center' }}>{badgeExistencia(row.existencia)}</td>
              ) : (
                <>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'r1', row.r1))}</td>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'st_pa', row.st_pa))}</td>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'r_ader', row.r_ader))}</td>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'r3', row.r3))}</td>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'r_f4c1', row.r_f4c1))}</td>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'r_f4c2', row.r_f4c2))}</td>
                  <td style={{ ...mrcTdS, width: FASE_W, minWidth: FASE_W, maxWidth: FASE_W, textAlign: 'center' }}>{badgeFaseMRC(faseValMRC(row, 'r_f5', row.r_f5))}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>)
}


export default TabelaMRC
