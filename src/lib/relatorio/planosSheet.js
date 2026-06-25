// buildPlanosSheet — aba Planos de Ação.
// Extraído em 22/mai/2026 (fatiamento Etapa 4).
import * as S from './_shared'
import { vitrineResultado, vitrineIncons, getResultadoColor, getCritColor } from './_shared'
import { getCellValue } from './areaSheet'

const {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL, COL_HEADER_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  CRIT_LABEL_MAP,
  infoLine, fillCreme, buildHeader, buildFooter,
} = S

const PLANO_COLUMNS = [
  { key: 'area', header: 'Área', width: 22 },
  { key: 'rr', header: 'Ref. Risco', width: 12 },
  { key: 'rc', header: 'Ref. Controle', width: 14 },
  { key: 'dc', header: 'Descrição do Controle', width: 40 },
  { key: '_vitrine_resultado', header: 'Resultado', width: 14 },
  { key: '_vitrine_incons', header: 'Inconsistência', width: 45 },
  { key: '_vitrine_rec', header: 'Recomendação', width: 45 },
  { key: 'imp', header: 'Impacto', width: 12 },
  { key: 'prob', header: 'Probabilidade', width: 14 },
  { key: 'crit_label', header: 'Criticidade', width: 14 },
  { key: 'resp_sub', header: 'Responsável', width: 20 },
  { key: 'fase', header: 'Fase Atual', width: 22 },
]

// Planos de Ação para projeto SÓ DIAGNÓSTICO: troca Resultado/Fase por
// Cenário Atual + Existência (mesma lógica do MRC/Detalhamento diag).
const PLANO_COLUMNS_DIAG = [
  { key: 'area', header: 'Área', width: 22 },
  { key: 'rr', header: 'Ref. Risco', width: 12 },
  { key: 'rc', header: 'Ref. Controle', width: 14 },
  { key: 'dc', header: 'Descrição do Controle', width: 40 },
  { key: 'cenario_atual', header: 'Cenário Atual', width: 40 },
  { key: 'existencia', header: 'Existência', width: 14 },
  { key: '_vitrine_rec', header: 'Recomendação', width: 45 },
  { key: 'imp', header: 'Impacto', width: 12 },
  { key: 'prob', header: 'Probabilidade', width: 14 },
  { key: 'crit_label', header: 'Criticidade', width: 14 },
  { key: 'resp_sub', header: 'Responsável', width: 20 },
]

function buildPlanosSheet(wb, controles, iconId, clienteNome, projetoNome, isDiag = false, numFases, comTeste) {
  const COLS = isDiag ? PLANO_COLUMNS_DIAG : PLANO_COLUMNS
  // Controles com pendência. Diagnóstico: Parcial/Inexistente (ou com inconsistência).
  // Com teste: resultado inefetivo/GAP (ou com inconsistência).
  const planosControles = controles.filter(c => {
    const incons = vitrineIncons(c)
    const temIncons = incons && incons !== '—' && incons.trim()
    if (isDiag) {
      const ex = (c.existencia || '').toLowerCase()
      return ex === 'parcial' || ex === 'inexistente' || temIncons
    }
    const resultado = (vitrineResultado(c) || '').toLowerCase()
    return (resultado === 'inefetivo' || resultado === 'gap' || resultado === 'gap de processo') || temIncons
  })

  const lastCol = COLS.length + 1
  const ws = wb.addWorksheet('Planos de Ação', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.getColumn(1).width = 4
  COLS.forEach((col, idx) => { ws.getColumn(idx + 2).width = col.width })

  buildHeader(ws, iconId, 'PLANOS DE AÇÃO — CONTROLES COM PENDÊNCIAS', '', infoLine(clienteNome, projetoNome, planosControles.length), lastCol)

  // Column headers
  const colHeaderRow = ws.getRow(4)
  ws.getCell(4, 1).fill = COL_HEADER_FILL
  ws.getCell(4, 1).border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  COLS.forEach((col, idx) => {
    const cell = colHeaderRow.getCell(idx + 2)
    cell.value = col.header
    cell.fill = COL_HEADER_FILL
    cell.font = COL_HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  })
  colHeaderRow.height = 28

  // Data
  planosControles.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 5)
    ws.getCell(rowIdx + 5, 1).fill = CREME_FILL

    COLS.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 2)
      const value = getCellValue(row, col, numFases, comTeste)
      cell.value = value
      cell.font = { ...BODY_FONT }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = THIN_BORDER

      if (rowIdx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }
      if (col.key === 'rr' || col.key === 'rc') cell.font = { ...GOLD_FONT }
      if (col.key === '_vitrine_resultado') {
        const cor = getResultadoColor(value)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
      if (col.key === 'crit_label') {
        const cor = getCritColor(row.crit)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
      if (col.key === 'existencia') {
        const ev = (value || '').toLowerCase()
        const cor = ev === 'existente' ? { argb: 'FF1B5E20' } : ev === 'parcial' ? { argb: 'FFE65100' } : ev === 'inexistente' ? { argb: 'FFB71C1C' } : null
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
    })
  })

  if (planosControles.length === 0) {
    ws.mergeCells(5, 2, 5, lastCol)
    const emptyCell = ws.getCell(5, 2)
    emptyCell.value = 'Nenhum controle com pendência identificado nos filtros selecionados.'
    emptyCell.font = { ...BODY_FONT, italic: true, color: { argb: 'FF999999' } }
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  ws.autoFilter = {
    from: { row: 4, column: 2 },
    to: { row: Math.max(planosControles.length, 1) + 4, column: lastCol },
  }

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════


export { buildPlanosSheet }
