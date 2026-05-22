// buildHeatmapSheet — aba Matriz de Calor do MRC Excel.
// Extraído em 22/mai/2026 (fatiamento Etapa 9).
import * as S from './_shared'

const {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  HM_IMP_LABELS, HM_PROB_LABELS, HM_COLORS, CRIT_LABEL_MAP,
  isYellowish, impToIdx, probToIdx,
  infoLine, fillCreme, getCritColor,
} = S

function buildHeatmapSheet(wb, controles, iconId, clienteNome, projetoNome) {
  const ws = wb.addWorksheet('Mapa de Calor', {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  // Colunas: A=4, B=4.09, C-H=18
  ws.getColumn(1).width = 4
  ws.getColumn(2).width = 4.09
  ws.getColumn(3).width = 18
  ws.getColumn(4).width = 18
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 18
  ws.getColumn(7).width = 18
  ws.getColumn(8).width = 18

  const lastCol = 8

  // ── HEADER (linhas 1-3) ──
  ws.getRow(1).height = 15
  ws.mergeCells('B1:G1')
  const r1 = ws.getCell('B1')
  r1.value = '    Polímata · Consultoria em GRC'
  r1.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: CREME } }
  r1.fill = NAVY_FILL
  r1.alignment = { vertical: 'middle' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(1, c).fill = NAVY_FILL

  if (iconId !== null) {
    ws.addImage(iconId, { tl: { col: 0.6, row: 0 }, ext: { width: 36, height: 36 }, editAs: 'oneCell' })
  }

  ws.mergeCells('B2:G2')
  const r2 = ws.getCell('B2')
  r2.value = 'MAPA DE CALOR — IMPACTO × PROBABILIDADE'
  r2.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: GOLD } }
  r2.fill = NAVY_FILL
  r2.alignment = { vertical: 'middle' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(2, c).fill = NAVY_FILL

  ws.mergeCells('B3:G3')
  const r3 = ws.getCell('B3')
  r3.value = infoLine(clienteNome, projetoNome, controles.length)
  r3.font = { name: 'Montserrat', size: 8, color: { argb: 'FF999999' } }
  r3.fill = NAVY_FILL
  r3.alignment = { vertical: 'middle' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(3, c).fill = NAVY_FILL

  // ── CALCULAR DADOS ──
  const grid = Array.from({ length: 4 }, () => Array(4).fill(0))
  const gridE = Array.from({ length: 4 }, () => Array(4).fill(0))
  const gridI = Array.from({ length: 4 }, () => Array(4).fill(0))
  const gridG = Array.from({ length: 4 }, () => Array(4).fill(0))
  controles.forEach(c => {
    const ri = impToIdx(c.imp), ci = probToIdx(c.prob)
    if (ri >= 0 && ci >= 0) {
      grid[ri][ci]++
      const r = (c.r1 || '').toLowerCase()
      if (r === 'efetivo') gridE[ri][ci]++
      else if (r === 'inefetivo') gridI[ri][ci]++
      else if (r === 'gap' || r === 'gap de processo') gridG[ri][ci]++
    }
  })

  // ── GRID (rows 5-8, height=49.5) ──
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

      // Sempre colorido — com ou sem valor
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

  // Labels X (row 9)
  ws.getRow(9).height = 15
  HM_PROB_LABELS.forEach((label, ci) => {
    const cell = ws.getCell(9, 4 + ci)
    cell.value = label
    cell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF555555' } }
    cell.alignment = { vertical: 'top', horizontal: 'center' }
    cell.fill = CREME_FILL
  })

  // "PROBABILIDADE →" (row 10)
  ws.mergeCells('D10:G10')
  const xAxis = ws.getCell('D10')
  xAxis.value = 'PROBABILIDADE →'
  xAxis.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FFAAAAAA' } }
  xAxis.alignment = { horizontal: 'center' }
  xAxis.fill = CREME_FILL

  // ── LEGENDA (row 12) ──
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

  // ── RESUMO (row 15: title, rows 16-18: cards centralizados) ──
  const resumoTitle = ws.getCell('C15')
  resumoTitle.value = 'RESUMO'
  resumoTitle.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  resumoTitle.fill = CREME_FILL

  const totalEf = controles.filter(c => (c.r1 || '').toLowerCase() === 'efetivo').length
  const totalIn = controles.filter(c => (c.r1 || '').toLowerCase() === 'inefetivo').length
  const totalGp = controles.filter(c => { const v = (c.r1 || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }).length
  const tot = controles.length

  const cards = [
    { label: 'TOTAL DE CONTROLES', value: tot, sub: 'controles', color: NAVY, border: NAVY },
    { label: 'EFETIVOS', value: totalEf, sub: tot > 0 ? `${Math.round(totalEf/tot*100)}% do total` : '—', color: '22C55E', border: '22C55E' },
    { label: 'INEFETIVOS', value: totalIn, sub: tot > 0 ? `${Math.round(totalIn/tot*100)}% do total` : '—', color: 'FACC15', border: 'FACC15' },
    { label: 'GAP', value: totalGp, sub: tot > 0 ? `${Math.round(totalGp/tot*100)}% do total` : '—', color: 'EF4444', border: 'EF4444' },
  ]

  ws.getRow(17).height = 39.5

  cards.forEach((card, i) => {
    const col = 4 + i

    const labelCell = ws.getCell(16, col)
    labelCell.value = card.label
    labelCell.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FF999999' } }
    labelCell.alignment = { vertical: 'bottom', horizontal: 'center' }
    labelCell.fill = WHITE_FILL
    labelCell.border = {
      top: { style: 'medium', color: { argb: card.border } },
      left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
    }

    const valCell = ws.getCell(17, col)
    valCell.value = card.value
    valCell.font = { name: 'Montserrat', size: 26, color: { argb: card.color } }
    valCell.alignment = { vertical: 'middle', horizontal: 'center' }
    valCell.fill = WHITE_FILL
    valCell.border = {
      left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
    }

    const subCell = ws.getCell(18, col)
    subCell.value = card.sub
    subCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FFBBBBBB' } }
    subCell.alignment = { vertical: 'top', horizontal: 'center' }
    subCell.fill = WHITE_FILL
    subCell.border = {
      bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
    }
  })

  // ── FOOTER (rows 19-20) ──
  ws.getRow(19).height = 15
  ws.getRow(20).height = 15
  ws.mergeCells('B20:E20')
  const footL = ws.getCell('B20')
  footL.value = 'Polímata · Consultoria em GRC'
  footL.font = { name: 'Montserrat', size: 10, color: { argb: NAVY } }
  footL.fill = CREME_FILL
  footL.border = { top: { style: 'medium', color: { argb: GOLD } } }

  ws.getCell('F20').border = { top: { style: 'medium', color: { argb: GOLD } } }
  ws.getCell('F20').fill = CREME_FILL
  ws.getCell('G20').border = { top: { style: 'medium', color: { argb: GOLD } } }
  ws.getCell('G20').fill = CREME_FILL

  const footR = ws.getCell('H20')
  const now = new Date()
  footR.value = `${now.toLocaleDateString('pt-BR')} · ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  footR.font = { name: 'Montserrat', size: 10, color: { argb: NAVY } }
  footR.alignment = { horizontal: 'right' }
  footR.fill = CREME_FILL
  footR.border = { top: { style: 'medium', color: { argb: GOLD } } }

  // ── FUNDO CREME ──
  fillCreme(ws, 4, 20, 1, lastCol)

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 2: DADOS DA MRC
// ══════════════════════════════════════════════════════════════════════════════


export { buildHeatmapSheet }
