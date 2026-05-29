// buildAreaSheet — uma aba por área no relatório (detalhamento).
// Extraído em 22/mai/2026 (fatiamento Etapa 4).
import { getFaseLabel, getStatusComputado, normalizeFaseValue } from '../fases'
import { getStatusConfig } from '../statusWorkflow'
import * as S from './_shared'

const {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL, COL_HEADER_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  CRIT_LABEL_MAP, fmtHist,
  infoLine, fillCreme, buildHeader, buildFooter,
  FASE_CHAIN, vitrineFase, vitrineResultado, vitrineIncons, vitrineRec,
  getResultadoColor, getCritColor,
} = S

const DETAIL_COLUMNS = [
  { key: 'rr', header: 'Ref. Risco', width: 12 },
  { key: 'dr', header: 'Descrição do Risco', width: 40 },
  { key: 'rc', header: 'Ref. Controle', width: 14 },
  { key: 'dc', header: 'Descrição do Controle', width: 40 },
  { key: 'sub', header: 'Subprocesso', width: 20 },
  { key: 'cat', header: 'Categoria', width: 16 },
  { key: 'freq', header: 'Frequência', width: 14 },
  { key: 'nat', header: 'Natureza', width: 12 },
  { key: 'car', header: 'Característica', width: 14 },
  { key: 'chave', header: 'Controle Chave?', width: 13 },
  { key: '_hist_f1', header: 'F1 Diagnóstico', width: 14 },
  { key: '_hist_f2d', header: 'F2 Desenho', width: 14 },
  { key: '_hist_f2e', header: 'F2 Efetividade', width: 14 },
  { key: '_hist_f3', header: 'F3 Revisão', width: 14 },
  { key: '_hist_f4c1', header: 'F4 Ciclo 1', width: 14 },
  { key: '_hist_f4c2', header: 'F4 Ciclo 2', width: 14 },
  { key: '_hist_f5', header: 'F5 Auditoria', width: 14 },
  { key: '_vitrine_resultado', header: 'Resultado', width: 14 },
  { key: '_vitrine_incons', header: 'Inconsistência', width: 40 },
  { key: '_vitrine_rec', header: 'Recomendação', width: 40 },
  { key: 'imp', header: 'Impacto', width: 12 },
  { key: 'prob', header: 'Probabilidade', width: 14 },
  { key: 'crit_label', header: 'Criticidade', width: 14 },
  { key: 'fase', header: 'Fase Atual', width: 22 },
  { key: 'status_atual', header: 'Status', width: 16 },
]

const RESULTADO_KEYS = new Set(['_vitrine_resultado', '_hist_f1', '_hist_f2d', '_hist_f2e', '_hist_f3', '_hist_f4c1', '_hist_f4c2', '_hist_f5'])

export function getCellValue(row, col) {
  if (col.key === '_vitrine_resultado') return vitrineResultado(row)
  if (col.key === '_vitrine_incons') return vitrineIncons(row)
  if (col.key === '_vitrine_rec') return vitrineRec(row)
  if (col.key === '_hist_f1') return fmtHist(row.r1)
  if (col.key === '_hist_f2d') return (row.r1 || '').toLowerCase() === 'efetivo' ? 'N/A' : fmtHist(row.st_pa)
  if (col.key === '_hist_f2e') return (row.r1 || '').toLowerCase() === 'efetivo' ? 'N/A' : fmtHist(row.r_ader)
  if (col.key === '_hist_f3') return fmtHist(row.r3)
  if (col.key === '_hist_f4c1') return fmtHist(row.r_f4c1)
  if (col.key === '_hist_f4c2') return fmtHist(row.r_f4c2)
  if (col.key === '_hist_f5') return fmtHist(row.r_f5)
  if (col.key === 'fase') return getFaseLabel(row) || '—'
  if (col.key === 'status_atual') {
    const cfg = getStatusConfig(getStatusComputado(row), 'admin_polimata')
    return cfg.label || '—'
  }
  if (col.key === 'crit_label') return row.crit_label || CRIT_LABEL_MAP[row.crit] || '—'
  if (col.key === 'dt_ult') {
    const d = row[col.key]
    if (d) { try { const dd = new Date(d); return (isNaN(dd.getTime()) || dd.getFullYear() < 2000) ? '—' : dd.toLocaleDateString('pt-BR') } catch { return '—' } }
    return '—'
  }
  const raw = row[col.key]
  return raw != null && raw !== '' ? raw : '—'
}

function buildAreaSheet(wb, areaNome, controles, iconId, clienteNome, projetoNome, isDiag = false) {
  const lastCol = DETAIL_COLUMNS.length + 1
  const sheetName = (areaNome || 'Sem Área').substring(0, 31)
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.getColumn(1).width = 4
  DETAIL_COLUMNS.forEach((col, idx) => { ws.getColumn(idx + 2).width = col.width })

  buildHeader(ws, iconId, `DETALHAMENTO — ${(areaNome || '').toUpperCase()}`, '', infoLine(clienteNome, projetoNome, controles.length), lastCol)

  // Column headers (row 4)
  const colHeaderRow = ws.getRow(4)
  ws.getCell(4, 1).fill = COL_HEADER_FILL
  ws.getCell(4, 1).border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  DETAIL_COLUMNS.forEach((col, idx) => {
    const cell = colHeaderRow.getCell(idx + 2)
    cell.value = col.header
    cell.fill = COL_HEADER_FILL
    cell.font = COL_HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  })
  colHeaderRow.height = 28

  // Data rows
  controles.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 5)
    ws.getCell(rowIdx + 5, 1).fill = CREME_FILL

    DETAIL_COLUMNS.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 2)
      const value = getCellValue(row, col)
      cell.value = value
      cell.font = { ...BODY_FONT }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = THIN_BORDER

      if (rowIdx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }
      if (col.key === 'rr' || col.key === 'rc') cell.font = { ...GOLD_FONT }
      if (RESULTADO_KEYS.has(col.key)) {
        const cor = getResultadoColor(value)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
      if (col.key === 'crit_label') {
        const cor = getCritColor(row.crit)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
    })
  })

  ws.autoFilter = {
    from: { row: 4, column: 2 },
    to: { row: controles.length + 4, column: lastCol },
  }

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: MATRIZ DE CALOR
// ══════════════════════════════════════════════════════════════════════════════


export { buildAreaSheet }
