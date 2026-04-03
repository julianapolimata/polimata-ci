import ExcelJS from 'exceljs'

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT MRC PARA EXCEL (.xlsx) — Polímata brand v4
// ══════════════════════════════════════════════════════════════════════════════

const NAVY = '00203E'
const GOLD = 'CC915E'
const CREME = 'F3EEE4'
const CREME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREME } }
const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
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
const WHITE_BORDER = {
  top: { style: 'thin', color: { argb: CREME } },
  bottom: { style: 'thin', color: { argb: CREME } },
  left: { style: 'thin', color: { argb: CREME } },
  right: { style: 'thin', color: { argb: CREME } },
}
const NO_BORDER = {}

const MRC_COLUMNS = [
  { key: 'dt_ult', header: 'Data Última Atualização', width: 18 },
  { key: 'ger', header: 'Gerência', width: 18 },
  { key: 'resp_sub', header: 'Responsável Subprocesso', width: 20 },
  { key: 'area', header: 'Processo', width: 22 },
  { key: 'sub', header: 'Subprocesso', width: 20 },
  { key: 'rr', header: 'Ref. Risco', width: 12 },
  { key: 'dr', header: 'Descrição do Risco', width: 40 },
  { key: 'rc', header: 'Ref. Controle', width: 14 },
  { key: 'dc', header: 'Descrição do Controle', width: 40 },
  { key: 'cat', header: 'Categoria de Controle', width: 18 },
  { key: 'freq', header: 'Frequência', width: 14 },
  { key: 'nat', header: 'Natureza', width: 12 },
  { key: 'car', header: 'Característica', width: 14 },
  { key: 'sis', header: 'Sistema', width: 14 },
  { key: 'chave', header: 'Controle Chave?', width: 14 },
  { key: 'passos_f1', header: 'Passos de Teste', width: 40 },
  { key: 'r1', header: 'Resultado', width: 14 },
  { key: 'incons', header: 'Descrição da Inconsistência', width: 40 },
  { key: 'rec', header: 'Recomendação / Melhoria', width: 40 },
  { key: 'imp', header: 'Impacto', width: 12 },
  { key: 'prob', header: 'Probabilidade', width: 14 },
  { key: 'crit_label', header: 'Criticidade', width: 16 },
  { key: 'fase', header: 'Fase Atual', width: 24 },
]

const CRIT_LABEL_MAP = { 4: '4. Crítico', 3: '3. Significativo', 2: '2. Moderado', 1: '1. Baixo' }

const HM_IMP_LABELS = ['Crítico', 'Alto', 'Moderado', 'Baixo']
const HM_PROB_LABELS = ['Extrema', 'Alta', 'Média', 'Baixa']
const HM_COLORS = [
  ['EF4444', 'EF4444', 'F97316', 'EAB308'],
  ['EF4444', 'F97316', 'EAB308', 'EAB308'],
  ['F97316', 'EAB308', 'EAB308', '22C55E'],
  ['EAB308', '22C55E', '22C55E', '22C55E'],
]
const EMPTY_CELL_COLOR = 'E8E4DC'

function isYellowish(c) { return c === 'EAB308' || c === 'FACC15' }
function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[v] ?? -1 }
function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[v] ?? -1 }

function getFaseLabel(row) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado') return 'F3 — Revisão'
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado') return 'F2-E2 — Teste de Aderência'
  if (row.st_pa && row.st_pa !== '') return 'F2-E1 — Plano de Ação'
  if (row.r1 && row.r1 !== 'Teste Não Realizado') return 'F2-E2 — Teste de Aderência'
  return 'F1 — Diagnóstico'
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

// Preenche uma range inteira com fundo creme
function fillCreme(ws, fromRow, toRow, fromCol, toCol) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c)
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill = CREME_FILL
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 1: MAPA DE CALOR
// ══════════════════════════════════════════════════════════════════════════════

function buildHeatmapSheet(wb, controles, iconId, clienteNome, projetoNome) {
  const ws = wb.addWorksheet('Mapa de Calor', {
    properties: { defaultRowHeight: 15, showGridLines: false },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  // Colunas: A=3(margem), B=3(eixoY), C=12(labels), D-G=16(grid), H=4(espaço)
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 3
  ws.getColumn(3).width = 12
  ws.getColumn(4).width = 16
  ws.getColumn(5).width = 16
  ws.getColumn(6).width = 16
  ws.getColumn(7).width = 16
  ws.getColumn(8).width = 4

  const lastCol = 8

  // ── HEADER (linhas 1-3, merge B até G) ──
  // Linha 1: marca
  ws.mergeCells('B1:G1')
  const r1 = ws.getCell('B1')
  r1.value = '  Polímata · Consultoria em GRC'
  r1.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: CREME } }
  r1.fill = NAVY_FILL
  r1.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 30
  for (let c = 1; c <= lastCol; c++) ws.getCell(1, c).fill = NAVY_FILL

  if (iconId !== null) {
    ws.addImage(iconId, { tl: { col: 0.8, row: 0.15 }, ext: { width: 22, height: 22 }, editAs: 'oneCell' })
  }

  // Linha 2: título
  ws.mergeCells('B2:G2')
  const r2 = ws.getCell('B2')
  r2.value = 'MAPA DE CALOR — IMPACTO × PROBABILIDADE'
  r2.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: GOLD } }
  r2.fill = NAVY_FILL
  r2.alignment = { vertical: 'middle' }
  ws.getRow(2).height = 20
  for (let c = 1; c <= lastCol; c++) ws.getCell(2, c).fill = NAVY_FILL

  // Linha 3: info
  ws.mergeCells('B3:G3')
  const r3 = ws.getCell('B3')
  r3.value = infoLine(clienteNome, projetoNome, controles.length)
  r3.font = { name: 'Montserrat', size: 8, color: { argb: 'FF999999' } }
  r3.fill = NAVY_FILL
  r3.alignment = { vertical: 'middle' }
  ws.getRow(3).height = 16
  for (let c = 1; c <= lastCol; c++) ws.getCell(3, c).fill = NAVY_FILL

  // Linha 4: espaço
  ws.getRow(4).height = 14

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

  // ── GRID (linhas 5-8) ──
  // Eixo Y: merge B5:B8
  ws.mergeCells('B5:B8')
  const yAxis = ws.getCell('B5')
  yAxis.value = 'IMPACTO ↑'
  yAxis.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FFAAAAAA' } }
  yAxis.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 }
  yAxis.fill = CREME_FILL

  for (let ri = 0; ri < 4; ri++) {
    const rowNum = 5 + ri
    ws.getRow(rowNum).height = 52

    // Label Y
    const yLabel = ws.getCell(rowNum, 3)
    yLabel.value = HM_IMP_LABELS[ri]
    yLabel.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF555555' } }
    yLabel.alignment = { vertical: 'middle', horizontal: 'right' }
    yLabel.fill = CREME_FILL

    // Grid cells (D-G)
    for (let ci = 0; ci < 4; ci++) {
      const cell = ws.getCell(rowNum, 4 + ci)
      const n = grid[ri][ci]
      const e = gridE[ri][ci], inf = gridI[ri][ci], g = gridG[ri][ci]
      const color = HM_COLORS[ri][ci]
      const yellow = isYellowish(color)

      if (n === 0) {
        cell.value = '0'
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMPTY_CELL_COLOR } }
        cell.font = { name: 'Montserrat', bold: true, size: 14, color: { argb: 'FFBBBBBB' } }
      } else {
        cell.value = { richText: [
          { text: `${n}\n`, font: { name: 'Montserrat', bold: true, size: 18, color: { argb: yellow ? 'FF333333' : 'FFFFFFFF' } } },
          { text: `E:${e}  I:${inf}  G:${g}`, font: { name: 'Montserrat', size: 8, color: { argb: yellow ? 'FF666666' : 'BBFFFFFF' } } },
        ]}
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = WHITE_BORDER
    }
  }

  // Labels X (linha 9)
  ws.getRow(9).height = 20
  HM_PROB_LABELS.forEach((label, ci) => {
    const cell = ws.getCell(9, 4 + ci)
    cell.value = label
    cell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF555555' } }
    cell.alignment = { vertical: 'top', horizontal: 'center' }
    cell.fill = CREME_FILL
  })

  // "PROBABILIDADE →"
  ws.mergeCells('D10:G10')
  const xAxis = ws.getCell('D10')
  xAxis.value = 'PROBABILIDADE →'
  xAxis.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FFAAAAAA' } }
  xAxis.alignment = { horizontal: 'center' }
  xAxis.fill = CREME_FILL
  ws.getRow(10).height = 14

  // Linha 11: espaço
  ws.getRow(11).height = 10

  // ── LEGENDA (linha 12) ──
  ws.getRow(12).height = 20
  // Separador visual
  for (let c = 3; c <= 7; c++) {
    ws.getCell(12, c).border = { top: { style: 'thin', color: { argb: 'FFD8D4CC' } } }
    ws.getCell(12, c).fill = CREME_FILL
  }
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

  // Linhas 13-14: separador
  ws.getRow(13).height = 10
  ws.getRow(14).height = 6
  for (let c = 3; c <= 7; c++) {
    ws.getCell(14, c).border = { bottom: { style: 'thin', color: { argb: 'FFD8D4CC' } } }
    ws.getCell(14, c).fill = CREME_FILL
  }

  // ── RESUMO (linhas 15-18) ──
  ws.getRow(15).height = 18
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

  ws.getRow(16).height = 16
  ws.getRow(17).height = 36
  ws.getRow(18).height = 16

  cards.forEach((card, i) => {
    const col = 4 + i

    // Label (linha 16)
    const labelCell = ws.getCell(16, col)
    labelCell.value = card.label
    labelCell.font = { name: 'Montserrat', bold: true, size: 7, color: { argb: 'FF999999' } }
    labelCell.alignment = { vertical: 'bottom', horizontal: 'left' }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    labelCell.border = {
      top: { style: 'medium', color: { argb: card.border } },
      left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
    }

    // Valor (linha 17)
    const valCell = ws.getCell(17, col)
    valCell.value = card.value
    valCell.font = { name: 'Montserrat', size: 26, color: { argb: card.color } }
    valCell.alignment = { vertical: 'middle', horizontal: 'left' }
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    valCell.border = {
      left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
    }

    // Sub (linha 18)
    const subCell = ws.getCell(18, col)
    subCell.value = card.sub
    subCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FFBBBBBB' } }
    subCell.alignment = { vertical: 'top', horizontal: 'left' }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    subCell.border = {
      bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      left: { style: 'thin', color: { argb: 'FFEEEEEE' } },
      right: { style: 'thin', color: { argb: 'FFEEEEEE' } },
    }
  })

  // ── FOOTER (linha 20) ──
  ws.getRow(19).height = 12
  ws.getRow(20).height = 14
  ws.mergeCells('B20:D20')
  const footL = ws.getCell('B20')
  footL.value = 'Polímata · Consultoria em GRC'
  footL.font = { name: 'Montserrat', size: 7, color: { argb: 'FFBBBBBB' } }
  footL.fill = CREME_FILL
  footL.border = { top: { style: 'thin', color: { argb: 'FFD8D4CC' } } }

  ws.mergeCells('F20:G20')
  const footR = ws.getCell('F20')
  const now = new Date()
  footR.value = `${now.toLocaleDateString('pt-BR')} · ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  footR.font = { name: 'Montserrat', size: 7, color: { argb: 'FFBBBBBB' } }
  footR.alignment = { horizontal: 'right' }
  footR.fill = CREME_FILL
  footR.border = { top: { style: 'thin', color: { argb: 'FFD8D4CC' } } }

  for (let c = 4; c <= 5; c++) {
    ws.getCell(20, c).border = { top: { style: 'thin', color: { argb: 'FFD8D4CC' } } }
    ws.getCell(20, c).fill = CREME_FILL
  }

  // ── PREENCHER FUNDO CREME ──
  fillCreme(ws, 4, 20, 1, lastCol)

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA 2: DADOS DA MRC
// ══════════════════════════════════════════════════════════════════════════════

function buildMRCSheet(wb, controles, tituloAba, iconId, clienteNome, projetoNome) {
  const lastCol = MRC_COLUMNS.length + 1 // +1 para coluna A margem
  const ws = wb.addWorksheet(tituloAba, {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }],
    properties: { defaultRowHeight: 15, showGridLines: false },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  // Coluna A = margem
  ws.getColumn(1).width = 3
  MRC_COLUMNS.forEach((col, idx) => { ws.getColumn(idx + 2).width = col.width })

  // ── HEADER (linhas 1-3, merge B até lastCol) ──
  ws.mergeCells(1, 2, 1, lastCol)
  const brandCell = ws.getCell('B1')
  brandCell.value = '  Polímata · Consultoria em GRC'
  brandCell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: CREME } }
  brandCell.fill = NAVY_FILL
  brandCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 30
  for (let c = 1; c <= lastCol; c++) ws.getCell(1, c).fill = NAVY_FILL

  if (iconId !== null) {
    ws.addImage(iconId, { tl: { col: 0.8, row: 0.15 }, ext: { width: 22, height: 22 }, editAs: 'oneCell' })
  }

  ws.mergeCells(2, 2, 2, lastCol)
  const titleCell = ws.getCell('B2')
  titleCell.value = `MATRIZ DE RISCOS E CONTROLES — ${tituloAba.toUpperCase()}`
  titleCell.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: GOLD } }
  titleCell.fill = NAVY_FILL
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(2).height = 20
  for (let c = 1; c <= lastCol; c++) ws.getCell(2, c).fill = NAVY_FILL

  ws.mergeCells(3, 2, 3, lastCol)
  const infoCell = ws.getCell('B3')
  infoCell.value = infoLine(clienteNome, projetoNome, controles.length)
  infoCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FF999999' } }
  infoCell.fill = NAVY_FILL
  infoCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(3).height = 16
  for (let c = 1; c <= lastCol; c++) ws.getCell(3, c).fill = NAVY_FILL

  // ── LINHA 4: CABEÇALHOS (B em diante) ──
  const colHeaderRow = ws.getRow(4)
  ws.getCell(4, 1).fill = COL_HEADER_FILL
  ws.getCell(4, 1).border = { bottom: { style: 'medium', color: { argb: GOLD } } }

  MRC_COLUMNS.forEach((col, idx) => {
    const cell = colHeaderRow.getCell(idx + 2)
    cell.value = col.header
    cell.fill = COL_HEADER_FILL
    cell.font = COL_HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  })
  colHeaderRow.height = 28

  // ── DADOS (linha 5+) ──
  controles.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 5)

    // Coluna A: margem com fundo creme
    ws.getCell(rowIdx + 5, 1).fill = CREME_FILL

    MRC_COLUMNS.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 2)
      let value

      if (col.key === 'fase') {
        value = getFaseLabel(row)
      } else if (col.key === 'crit_label') {
        value = row.crit_label || CRIT_LABEL_MAP[row.crit] || '—'
      } else if (col.key === 'dt_ult') {
        const d = row.dt_ult
        if (d) { try { value = new Date(d).toLocaleDateString('pt-BR') } catch { value = d } }
        else { value = '—' }
      } else {
        value = row[col.key] || '—'
      }

      cell.value = value
      cell.font = { ...BODY_FONT }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = THIN_BORDER

      // Fundo alternado
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }
      }
      // Refs douradas
      if (col.key === 'rr' || col.key === 'rc') {
        cell.font = { ...GOLD_FONT }
      }
      // Resultado colorido
      if (col.key === 'r1') {
        const cor = getResultadoColor(value)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
      // Criticidade colorida
      if (col.key === 'crit_label') {
        const cor = getCritColor(row.crit)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
    })
  })

  // Auto-filter
  ws.autoFilter = {
    from: { row: 4, column: 2 },
    to: { row: controles.length + 4, column: lastCol },
  }

  return ws
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export async function exportarMRCExcel(controles, nomeArquivo, tituloAba = 'MRC', clienteNome = '', projetoNome = '') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CI Polímata'
  wb.created = new Date()

  const iconBase64 = await fetchIconBase64()
  const iconId = iconBase64 ? wb.addImage({ base64: iconBase64, extension: 'png' }) : null

  // Aba 1: Mapa de Calor
  buildHeatmapSheet(wb, controles, iconId, clienteNome, projetoNome)

  // Aba 2: Dados da MRC
  buildMRCSheet(wb, controles, tituloAba, iconId, clienteNome, projetoNome)

  // Gerar e baixar
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeArquivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
