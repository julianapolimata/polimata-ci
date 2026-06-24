// buildResumoSheet — aba Resumo Executivo do relatório.
// Extraído em 22/mai/2026 (fatiamento Etapa 4).
import { getFaseLabel } from '../fases'
import * as S from './_shared'

const {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL, COL_HEADER_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  HM_IMP_LABELS, HM_PROB_LABELS, HM_COLORS, CRIT_LABEL_MAP,
  impToIdx, probToIdx, isYellowish, fmtHist,
  infoLine, fillCreme, buildHeader, buildFooter,
  FASE_CHAIN, vitrineFase, vitrineResultado, vitrineIncons, vitrineRec,
  getResultadoColor, getCritColor,
} = S

function buildResumoSheet(wb, controles, areas, iconId, clienteNome, projetoNome, isDiag = false, numFases, comTeste) {
  const lastCol = 8
  const ws = wb.addWorksheet('Resumo Executivo', {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.getColumn(1).width = 4
  for (let c = 2; c <= lastCol; c++) ws.getColumn(c).width = 18

  buildHeader(ws, iconId, 'RESUMO EXECUTIVO', '', infoLine(clienteNome, projetoNome, controles.length), lastCol)

  // ── KPIs PRINCIPAIS (row 5) ──
  const totalEf = controles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'efetivo').length
  const totalIn = controles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'inefetivo').length
  const totalGp = controles.filter(c => { const v = (vitrineResultado(c) || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }).length
  const totalNi = controles.length - totalEf - totalIn - totalGp
  const totalEx = controles.filter(c => c.existencia === 'Existente').length
  const totalPc = controles.filter(c => c.existencia === 'Parcial').length
  const totalIx = controles.filter(c => c.existencia === 'Inexistente').length
  const tot = controles.length

  const secTitle = ws.getCell('B5')
  secTitle.value = isDiag ? 'DIAGNÓSTICO — EXISTÊNCIA' : 'INDICADORES GERAIS'
  secTitle.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  secTitle.fill = CREME_FILL

  const cards = isDiag ? [
    { label: 'TOTAL', value: tot, sub: 'controles', color: NAVY, border: NAVY },
    { label: 'EXISTENTES', value: totalEx, sub: tot > 0 ? `${Math.round(totalEx / tot * 100)}%` : '—', color: '22C55E', border: '22C55E' },
    { label: 'PARCIAIS', value: totalPc, sub: tot > 0 ? `${Math.round(totalPc / tot * 100)}%` : '—', color: 'FACC15', border: 'FACC15' },
    { label: 'INEXISTENTES', value: totalIx, sub: tot > 0 ? `${Math.round(totalIx / tot * 100)}%` : '—', color: 'EF4444', border: 'EF4444' },
  ] : [
    { label: 'TOTAL', value: tot, sub: 'controles', color: NAVY, border: NAVY },
    { label: 'EFETIVOS', value: totalEf, sub: tot > 0 ? `${Math.round(totalEf / tot * 100)}%` : '—', color: '22C55E', border: '22C55E' },
    { label: 'INEFETIVOS', value: totalIn, sub: tot > 0 ? `${Math.round(totalIn / tot * 100)}%` : '—', color: 'FACC15', border: 'FACC15' },
    { label: 'GAP', value: totalGp, sub: tot > 0 ? `${Math.round(totalGp / tot * 100)}%` : '—', color: 'EF4444', border: 'EF4444' },
  ]

  ws.getRow(7).height = 39.5
  cards.forEach((card, i) => {
    const col = 3 + i
    const labelCell = ws.getCell(6, col)
    labelCell.value = card.label
    labelCell.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FF999999' } }
    labelCell.alignment = { vertical: 'bottom', horizontal: 'center' }
    labelCell.fill = WHITE_FILL
    labelCell.border = { top: { style: 'medium', color: { argb: card.border } }, left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } }

    const valCell = ws.getCell(7, col)
    valCell.value = card.value
    valCell.font = { name: 'Montserrat', size: 26, color: { argb: card.color } }
    valCell.alignment = { vertical: 'middle', horizontal: 'center' }
    valCell.fill = WHITE_FILL
    valCell.border = { left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } }

    const subCell = ws.getCell(8, col)
    subCell.value = card.sub
    subCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FFBBBBBB' } }
    subCell.alignment = { vertical: 'top', horizontal: 'center' }
    subCell.fill = WHITE_FILL
    subCell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } }, left: { style: 'thin', color: { argb: 'FFEEEEEE' } }, right: { style: 'thin', color: { argb: 'FFEEEEEE' } } }
  })

  // ── DISTRIBUIÇÃO POR FASE (row 10) ──
  const secFase = ws.getCell('B10')
  secFase.value = 'DISTRIBUIÇÃO POR FASE ATUAL'
  secFase.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  secFase.fill = CREME_FILL

  const faseCount = {}
  controles.forEach(c => {
    const label = getFaseLabel(c, numFases, comTeste) || 'Não Iniciado'
    faseCount[label] = (faseCount[label] || 0) + 1
  })

  const faseHeaders = ['Fase', 'Qtde', '% do Total']
  faseHeaders.forEach((h, i) => {
    const cell = ws.getCell(11, 3 + i)
    cell.value = h
    cell.fill = COL_HEADER_FILL
    cell.font = COL_HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' }
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  })

  const faseEntries = Object.entries(faseCount).sort((a, b) => b[1] - a[1])
  faseEntries.forEach(([label, count], idx) => {
    const row = 12 + idx
    const cellLabel = ws.getCell(row, 3)
    cellLabel.value = label
    cellLabel.font = BODY_FONT
    cellLabel.border = THIN_BORDER
    if (idx % 2 === 1) cellLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }

    const cellCount = ws.getCell(row, 4)
    cellCount.value = count
    cellCount.font = { ...BODY_FONT, bold: true }
    cellCount.alignment = { horizontal: 'center' }
    cellCount.border = THIN_BORDER
    if (idx % 2 === 1) cellCount.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }

    const cellPct = ws.getCell(row, 5)
    cellPct.value = tot > 0 ? `${Math.round(count / tot * 100)}%` : '—'
    cellPct.font = BODY_FONT
    cellPct.alignment = { horizontal: 'center' }
    cellPct.border = THIN_BORDER
    if (idx % 2 === 1) cellPct.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }
  })

  // ── RESUMO POR ÁREA (abaixo das fases) ──
  const areaStartRow = 12 + faseEntries.length + 2
  const secArea = ws.getCell(areaStartRow, 2)
  secArea.value = 'RESUMO POR ÁREA'
  secArea.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  secArea.fill = CREME_FILL

  const areaHeaders = isDiag
    ? ['Área', 'Total', 'Existente', 'Parcial', 'Inexistente']
    : ['Área', 'Total', 'Efetivo', 'Inefetivo', 'GAP']
  areaHeaders.forEach((h, i) => {
    const cell = ws.getCell(areaStartRow + 1, 3 + i)
    cell.value = h
    cell.fill = COL_HEADER_FILL
    cell.font = COL_HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' }
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  })

  const areasSorted = [...(areas || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  areasSorted.forEach((area, idx) => {
    const areaControles = controles.filter(c => c.area_id === area.id)
    const row = areaStartRow + 2 + idx
    const ef = isDiag
      ? areaControles.filter(c => c.existencia === 'Existente').length
      : areaControles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'efetivo').length
    const inf = isDiag
      ? areaControles.filter(c => c.existencia === 'Parcial').length
      : areaControles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'inefetivo').length
    const gp = isDiag
      ? areaControles.filter(c => c.existencia === 'Inexistente').length
      : areaControles.filter(c => { const v = (vitrineResultado(c) || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }).length

    const zebra = idx % 2 === 1 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } } : undefined
    const vals = [area.nome || '—', areaControles.length, ef, inf, gp]
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, 3 + i)
      cell.value = v
      cell.font = i === 0 ? BODY_FONT : { ...BODY_FONT, bold: true }
      cell.alignment = { horizontal: i === 0 ? 'left' : 'center' }
      cell.border = THIN_BORDER
      if (zebra) cell.fill = zebra
      // Colors for result columns
      if (i === 2 && v > 0) cell.font = { ...BODY_FONT, bold: true, color: { argb: '1B5E20' } }
      if (i === 3 && v > 0) cell.font = { ...BODY_FONT, bold: true, color: { argb: 'B71C1C' } }
      if (i === 4 && v > 0) cell.font = { ...BODY_FONT, bold: true, color: { argb: 'E65100' } }
    })
  })

  const footerRow = areaStartRow + 2 + areasSorted.length + 2
  buildFooter(ws, footerRow, 2, lastCol)
  fillCreme(ws, 4, footerRow, 1, lastCol)

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 2+: DETALHAMENTO POR ÁREA
// ══════════════════════════════════════════════════════════════════════════════


export { buildResumoSheet }
