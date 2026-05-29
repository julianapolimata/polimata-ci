// buildMatrizSheet — aba Matriz de Calor.
// Extraído em 22/mai/2026 (fatiamento Etapa 4).
import * as S from './_shared'
import { vitrineResultado, vitrineIncons } from './_shared'

const {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  HM_IMP_LABELS, HM_PROB_LABELS, HM_COLORS, CRIT_LABEL_MAP,
  impToIdx, probToIdx, isYellowish,
  infoLine, fillCreme, buildHeader, buildFooter,
  getCritColor,
} = S

function buildMatrizSheet(wb, controles, iconId, clienteNome, projetoNome, isDiag = false) {
  const lastCol = 8
  const ws = wb.addWorksheet('Matriz de Calor', {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.getColumn(1).width = 4
  ws.getColumn(2).width = 4.09
  for (let c = 3; c <= lastCol; c++) ws.getColumn(c).width = 18

  buildHeader(ws, iconId, 'MAPA DE CALOR — IMPACTO × PROBABILIDADE', '', infoLine(clienteNome, projetoNome, controles.length), lastCol)

  // Grid data
  const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
  const gridE = Array.from({ length: 4 }, () => Array(4).fill(0))
  const gridI = Array.from({ length: 4 }, () => Array(4).fill(0))
  const gridG = Array.from({ length: 4 }, () => Array(4).fill(0))
  controles.forEach(c => {
    const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
    if (ri >= 0 && ci >= 0) {
      grid[ri][ci]++
      const r = (vitrineResultado(c) || '').toLowerCase()
      if (r === 'efetivo') gridE[ri][ci]++
      else if (r === 'inefetivo') gridI[ri][ci]++
      else if (r === 'gap' || r === 'gap de processo') gridG[ri][ci]++
    }
  })

  // Y axis
  ws.mergeCells('B5:B8')
  const yAxis = ws.getCell('B5')
  yAxis.value = 'IMPACTO ↑'
  yAxis.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FFAAAAAA' } }
  yAxis.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 }
  yAxis.fill = CREME_FILL

  for (let ri = 0; ri < 4; ri++) {
    const rowNum = 5 + ri
    ws.getRow(rowNum).height = 49.5

    const yLabel = ws.getCell(rowNum, 3)
    yLabel.value = HM_IMP_LABELS[ri]
    yLabel.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF555555' } }
    yLabel.alignment = { vertical: 'middle', horizontal: 'right' }
    yLabel.fill = CREME_FILL

    for (let ci = 0; ci < 4; ci++) {
      const cell = ws.getCell(rowNum, 4 + ci)
      const n = grid[ri][ci]
      const e = gridE[ri][ci], inf = gridI[ri][ci], g = gridG[ri][ci]
      const color = HM_COLORS[ri][ci]
      const yellow = isYellowish(color)

      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
      cell.border = CREME_BORDER
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

      if (n === 0) {
        cell.value = '0'
        cell.font = { name: 'Montserrat', bold: true, size: 14, color: { argb: yellow ? 'FF333333' : 'FFFFFFFF' } }
      } else {
        cell.value = `${n}\nE:${e}  I:${inf}  G:${g}`
        cell.font = { name: 'Montserrat', bold: false, size: 11, color: { argb: yellow ? 'FF333333' : 'FFFFFFFF' } }
      }
    }
  }

  // X labels
  ws.getRow(9).height = 15
  HM_PROB_LABELS.forEach((label, ci) => {
    const cell = ws.getCell(9, 4 + ci)
    cell.value = label
    cell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF555555' } }
    cell.alignment = { vertical: 'top', horizontal: 'center' }
    cell.fill = CREME_FILL
  })

  ws.mergeCells('D10:G10')
  const xAxis = ws.getCell('D10')
  xAxis.value = 'PROBABILIDADE →'
  xAxis.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FFAAAAAA' } }
  xAxis.alignment = { horizontal: 'center' }
  xAxis.fill = CREME_FILL

  // Legend
  const legData = [
    { label: '■ Crítico', color: 'EF4444' },
    { label: '■ Significativo', color: 'F97316' },
    { label: '■ Moderado', color: 'EAB308' },
    { label: '■ Baixo', color: '22C55E' },
  ]
  legData.forEach((item, i) => {
    const cell = ws.getCell(12, 4 + i)
    cell.value = item.label
    cell.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: item.color } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = CREME_FILL
  })

  // Summary cards
  const totalEf = controles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'efetivo').length
  const totalIn = controles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'inefetivo').length
  const totalGp = controles.filter(c => { const v = (vitrineResultado(c) || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }).length
  const totalEx = controles.filter(c => c.existencia === 'Existente').length
  const totalPc = controles.filter(c => c.existencia === 'Parcial').length
  const totalIx = controles.filter(c => c.existencia === 'Inexistente').length
  const tot = controles.length

  const resumoTitle = ws.getCell('C15')
  resumoTitle.value = isDiag ? 'RESUMO — EXISTÊNCIA' : 'RESUMO'
  resumoTitle.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  resumoTitle.fill = CREME_FILL

  const summaryCards = isDiag ? [
    { label: 'TOTAL DE CONTROLES', value: tot, sub: 'controles', color: NAVY, border: NAVY },
    { label: 'EXISTENTES', value: totalEx, sub: tot > 0 ? `${Math.round(totalEx / tot * 100)}% do total` : '—', color: '22C55E', border: '22C55E' },
    { label: 'PARCIAIS', value: totalPc, sub: tot > 0 ? `${Math.round(totalPc / tot * 100)}% do total` : '—', color: 'FACC15', border: 'FACC15' },
    { label: 'INEXISTENTES', value: totalIx, sub: tot > 0 ? `${Math.round(totalIx / tot * 100)}% do total` : '—', color: 'EF4444', border: 'EF4444' },
  ] : [
    { label: 'TOTAL DE CONTROLES', value: tot, sub: 'controles', color: NAVY, border: NAVY },
    { label: 'EFETIVOS', value: totalEf, sub: tot > 0 ? `${Math.round(totalEf / tot * 100)}% do total` : '—', color: '22C55E', border: '22C55E' },
    { label: 'INEFETIVOS', value: totalIn, sub: tot > 0 ? `${Math.round(totalIn / tot * 100)}% do total` : '—', color: 'FACC15', border: 'FACC15' },
    { label: 'GAP', value: totalGp, sub: tot > 0 ? `${Math.round(totalGp / tot * 100)}% do total` : '—', color: 'EF4444', border: 'EF4444' },
  ]

  ws.getRow(17).height = 39.5
  summaryCards.forEach((card, i) => {
    const col = 4 + i
    const labelCell = ws.getCell(16, col)
    labelCell.value = card.label
    labelCell.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FF999999' } }
    labelCell.alignment = { vertical: 'bottom', horizontal: 'center' }
    labelCell.fill = WHITE_FILL
    labelCell.border = { top: { style: 'medium', color: { argb: card.border } }, left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } }

    const valCell = ws.getCell(17, col)
    valCell.value = card.value
    valCell.font = { name: 'Montserrat', size: 26, color: { argb: card.color } }
    valCell.alignment = { vertical: 'middle', horizontal: 'center' }
    valCell.fill = WHITE_FILL
    valCell.border = { left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } }

    const subCell = ws.getCell(18, col)
    subCell.value = card.sub
    subCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FFBBBBBB' } }
    subCell.alignment = { vertical: 'top', horizontal: 'center' }
    subCell.fill = WHITE_FILL
    subCell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } }, left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } }
  })

  buildFooter(ws, 20, 2, lastCol)
  fillCreme(ws, 4, 20, 1, lastCol)

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: PLANOS DE AÇÃO
// ══════════════════════════════════════════════════════════════════════════════


export { buildMatrizSheet }
