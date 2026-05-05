import ExcelJS from 'exceljs'
import { getFaseLabel, getStatusComputado, normalizeFaseValue } from './fases'
import { getStatusConfig } from './statusWorkflow'

// ══════════════════════════════════════════════════════════════════════════════
// GERADOR DE RELATÓRIO EXCEL — Polímata CI
// Abas: Resumo Executivo · Detalhamento por Área · Matriz de Calor · Planos de Ação
// ══════════════════════════════════════════════════════════════════════════════

const NAVY = '00203E'
const GOLD = 'CC915E'
const CREME = 'F3EEE4'
const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
const CREME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREME } }
const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } }
const COL_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: '001A3A' } }
const COL_HEADER_FONT = { name: 'Montserrat', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 9, color: { argb: 'FF333333' } }
const GOLD_FONT = { name: 'Montserrat', size: 9, bold: true, color: { argb: GOLD } }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
}
const CREME_BORDER = {
  top: { style: 'thin', color: { argb: CREME } },
  bottom: { style: 'thin', color: { argb: CREME } },
  left: { style: 'thin', color: { argb: CREME } },
  right: { style: 'thin', color: { argb: CREME } },
}

const HM_IMP_LABELS = ['Crítico', 'Alto', 'Moderado', 'Baixo']
const HM_PROB_LABELS = ['Extrema', 'Alta', 'Média', 'Baixa']
const HM_COLORS = [
  ['EF4444', 'EF4444', 'F97316', 'EAB308'],
  ['EF4444', 'F97316', 'EAB308', 'EAB308'],
  ['F97316', 'EAB308', 'EAB308', '22C55E'],
  ['EAB308', '22C55E', '22C55E', '22C55E'],
]
const CRIT_LABEL_MAP = { 4: 'Crítico', 3: 'Significativo', 2: 'Moderado', 1: 'Baixo' }

function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[v] ?? -1 }
function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[v] ?? -1 }
function isYellowish(c) { return c === 'EAB308' || c === 'FACC15' }
function fmtHist(v) { return normalizeFaseValue(v) || 'Não Iniciado' }

function infoLine(clienteNome, projetoNome, count) {
  const parts = []
  if (clienteNome) parts.push(`Cliente: ${clienteNome}`)
  if (projetoNome) parts.push(`Projeto: ${projetoNome}`)
  parts.push(`${count} controles`)
  parts.push(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`)
  return parts.join('  ·  ')
}

async function fetchIconBase64() {
  try {
    const resp = await fetch('/icon.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

function fillCreme(ws, fromRow, toRow, fromCol, toCol) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c)
      if (!cell.fill || !cell.fill.fgColor || cell.fill.fgColor.argb === '00000000') {
        cell.fill = CREME_FILL
      }
    }
  }
}

function buildHeader(ws, iconId, titulo, subtitulo, info, lastCol) {
  ws.getRow(1).height = 15
  ws.mergeCells(1, 2, 1, lastCol)
  const brandCell = ws.getCell('B1')
  brandCell.value = '    Polímata · Consultoria em GRC'
  brandCell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: CREME } }
  brandCell.fill = NAVY_FILL
  brandCell.alignment = { vertical: 'middle' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(1, c).fill = NAVY_FILL

  if (iconId !== null) {
    ws.addImage(iconId, { tl: { col: 0.6, row: 0 }, ext: { width: 36, height: 36 }, editAs: 'oneCell' })
  }

  ws.mergeCells(2, 2, 2, lastCol)
  const titleCell = ws.getCell('B2')
  titleCell.value = titulo
  titleCell.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: GOLD } }
  titleCell.fill = NAVY_FILL
  titleCell.alignment = { vertical: 'middle' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(2, c).fill = NAVY_FILL

  ws.mergeCells(3, 2, 3, lastCol)
  const infoCell = ws.getCell('B3')
  infoCell.value = info
  infoCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FF999999' } }
  infoCell.fill = NAVY_FILL
  infoCell.alignment = { vertical: 'middle' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(3, c).fill = NAVY_FILL
}

function buildFooter(ws, row, fromCol, toCol) {
  ws.mergeCells(row, fromCol, row, Math.max(fromCol, toCol - 1))
  const footL = ws.getCell(row, fromCol)
  footL.value = 'Polímata · Consultoria em GRC'
  footL.font = { name: 'Montserrat', size: 10, color: { argb: NAVY } }
  footL.fill = CREME_FILL
  footL.border = { top: { style: 'medium', color: { argb: GOLD } } }

  for (let c = fromCol; c <= toCol; c++) {
    ws.getCell(row, c).border = { top: { style: 'medium', color: { argb: GOLD } } }
    ws.getCell(row, c).fill = CREME_FILL
  }

  const footR = ws.getCell(row, toCol)
  const now = new Date()
  footR.value = `${now.toLocaleDateString('pt-BR')} · ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  footR.font = { name: 'Montserrat', size: 10, color: { argb: NAVY } }
  footR.alignment = { horizontal: 'right' }
}

// Vitrine: resultado mais recente (F5 → F1)
const FASE_CHAIN = [
  { r: 'r_f5',   i: 'incons_f5',   rec: 'rec_f5' },
  { r: 'r_f4c2', i: 'incons_f4c2', rec: 'rec_f4c2' },
  { r: 'r_f4c1', i: 'incons_f4c1', rec: 'rec_f4c1' },
  { r: 'r3',     i: 'incons_f3',   rec: 'rec_f3' },
  { r: 'r_ader', i: 'incons_ader', rec: 'melhoria' },
  { r: 'st_pa',  i: null,          rec: null },
  { r: 'r1',     i: 'incons',      rec: 'rec' },
]

function vitrineFase(row) {
  for (const f of FASE_CHAIN) {
    const v = row[f.r]
    if (v && v !== 'Teste Não Realizado' && v !== 'N/A') return f
  }
  return FASE_CHAIN[FASE_CHAIN.length - 1]
}
function vitrineResultado(row) {
  const f = vitrineFase(row)
  const v = row[f.r]
  return (v && v !== 'Teste Não Realizado' && v !== 'N/A') ? v : (row.r1 || '—')
}
function vitrineIncons(row) {
  const f = vitrineFase(row)
  if (!f.i) return '—'
  const v = row[f.i]
  return (v && v.trim()) ? v : '—'
}
function vitrineRec(row) {
  const f = vitrineFase(row)
  if (!f.rec) return '—'
  const v = row[f.rec]
  return (v && v.trim()) ? v : '—'
}

function getResultadoColor(valor) {
  const v = (valor || '').toLowerCase()
  if (v === 'efetivo') return { argb: '1B5E20' }
  if (v === 'inefetivo') return { argb: 'B71C1C' }
  if (v === 'gap' || v === 'gap de processo') return { argb: 'E65100' }
  return null
}

function getCritColor(crit) {
  const map = { 4: 'EF4444', 3: 'F97316', 2: 'EAB308', 1: '22C55E' }
  return map[crit] ? { argb: map[crit] } : null
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 1: RESUMO EXECUTIVO
// ══════════════════════════════════════════════════════════════════════════════

function buildResumoSheet(wb, controles, areas, iconId, clienteNome, projetoNome) {
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
  const tot = controles.length

  const secTitle = ws.getCell('B5')
  secTitle.value = 'INDICADORES GERAIS'
  secTitle.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  secTitle.fill = CREME_FILL

  const cards = [
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
    const label = getFaseLabel(c) || 'Não Iniciado'
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

  const areaHeaders = ['Área', 'Total', 'Efetivo', 'Inefetivo', 'GAP']
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
    const ef = areaControles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'efetivo').length
    const inf = areaControles.filter(c => (vitrineResultado(c) || '').toLowerCase() === 'inefetivo').length
    const gp = areaControles.filter(c => { const v = (vitrineResultado(c) || '').toLowerCase(); return v === 'gap' || v === 'gap de processo' }).length

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

function getCellValue(row, col) {
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

function buildAreaSheet(wb, areaNome, controles, iconId, clienteNome, projetoNome) {
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

function buildMatrizSheet(wb, controles, iconId, clienteNome, projetoNome) {
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
  const tot = controles.length

  const resumoTitle = ws.getCell('C15')
  resumoTitle.value = 'RESUMO'
  resumoTitle.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FFAAAAAA' } }
  resumoTitle.fill = CREME_FILL

  const summaryCards = [
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

function buildPlanosSheet(wb, controles, iconId, clienteNome, projetoNome) {
  // Only controls that have inconsistencies or non-effective results
  const planosControles = controles.filter(c => {
    const resultado = (vitrineResultado(c) || '').toLowerCase()
    const incons = vitrineIncons(c)
    return (resultado === 'inefetivo' || resultado === 'gap' || resultado === 'gap de processo') ||
           (incons && incons !== '—' && incons.trim())
  })

  const lastCol = PLANO_COLUMNS.length + 1
  const ws = wb.addWorksheet('Planos de Ação', {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.getColumn(1).width = 4
  PLANO_COLUMNS.forEach((col, idx) => { ws.getColumn(idx + 2).width = col.width })

  buildHeader(ws, iconId, 'PLANOS DE AÇÃO — CONTROLES COM PENDÊNCIAS', '', infoLine(clienteNome, projetoNome, planosControles.length), lastCol)

  // Column headers
  const colHeaderRow = ws.getRow(4)
  ws.getCell(4, 1).fill = COL_HEADER_FILL
  ws.getCell(4, 1).border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  PLANO_COLUMNS.forEach((col, idx) => {
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

    PLANO_COLUMNS.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 2)
      const value = getCellValue(row, col)
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

export async function gerarRelatorioExcel({ controles, areas, secoes, clienteNome, projetoNome, projeto }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CI Polímata'
  wb.created = new Date()

  const iconBase64 = await fetchIconBase64()
  const iconId = iconBase64 ? wb.addImage({ base64: iconBase64, extension: 'png' }) : null

  if (secoes.resumo) {
    buildResumoSheet(wb, controles, areas, iconId, clienteNome, projetoNome)
  }

  if (secoes.detalhamento) {
    // Group by area
    const areaMap = {}
    controles.forEach(c => {
      const areaId = c.area_id || '__sem_area'
      if (!areaMap[areaId]) areaMap[areaId] = { nome: c.area || 'Sem Área', controles: [] }
      areaMap[areaId].controles.push(c)
    })
    // Sort areas alphabetically
    const sortedAreas = Object.values(areaMap).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    sortedAreas.forEach(a => {
      buildAreaSheet(wb, a.nome, a.controles, iconId, clienteNome, projetoNome)
    })
  }

  if (secoes.matriz) {
    buildMatrizSheet(wb, controles, iconId, clienteNome, projetoNome)
  }

  if (secoes.planos) {
    buildPlanosSheet(wb, controles, iconId, clienteNome, projetoNome)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  a.download = `Relatorio_${projetoNome || 'CI'}_${dataStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
