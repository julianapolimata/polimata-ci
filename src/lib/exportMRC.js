import ExcelJS from 'exceljs'
import { getFaseLabel as getFaseLabelUtil, getFaseInfo, getStatusComputado, normalizeFaseValue } from './fases'
import { getStatusConfig } from './statusWorkflow'
import { supabase } from './supabase'

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT MRC PARA EXCEL (.xlsx) — Polímata brand
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

// ── COLUNAS DO EXCEL ──
// B-W: Vitrine (última atualização)
// X-AD: Histórico de resultado por fase
// AE-AF: Campos computados
const MRC_COLUMNS = [
  // ── VITRINE (B-W) — sempre a última atualização ──
  { key: 'dt_ult', header: 'Data Última Atualização', width: 18, fmt: 'date' },
  { key: 'ger', header: 'Gerência', width: 18 },
  { key: 'resp_sub', header: 'Responsável Área', width: 20 },
  { key: 'area', header: 'Área', width: 22 },
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
  { key: '_vitrine_resultado', header: 'Resultado', width: 14, computed: true },
  { key: '_vitrine_incons', header: 'Descrição da Inconsistência', width: 40, computed: true },
  { key: '_vitrine_rec', header: 'Recomendação / Melhoria', width: 40, computed: true },
  { key: 'imp', header: 'Impacto', width: 12 },
  { key: 'prob', header: 'Probabilidade', width: 14 },
  { key: 'crit_label', header: 'Criticidade', width: 16 },
  // ── HISTÓRICO POR FASE (X-AD) ──
  { key: '_hist_f1', header: 'F1 Diagnóstico', width: 14, computed: true },
  { key: '_hist_f2d', header: 'F2 Desenho', width: 14, computed: true },
  { key: '_hist_f2e', header: 'F2 Efetividade', width: 14, computed: true },
  { key: '_hist_f3', header: 'F3 Revisão Integral', width: 14, computed: true },
  { key: '_hist_f4c1', header: 'F4 AI - Ciclo 1', width: 14, computed: true },
  { key: '_hist_f4c2', header: 'F4 AI - Ciclo 2', width: 14, computed: true },
  { key: '_hist_f5', header: 'F5 Auditoria Externa', width: 14, computed: true },
  // ── COMPUTADOS (AE-AF) ──
  { key: 'fase', header: 'Fase Atual', width: 24, computed: true },
  { key: 'status_atual', header: 'Status Atual', width: 18, computed: true },
  // Colunas de regressão são adicionadas dinamicamente em buildMRCSheet
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

function isYellowish(c) { return c === 'EAB308' || c === 'FACC15' }
function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[v] ?? -1 }
function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[v] ?? -1 }

function getFaseLabel(row) {
  return getFaseLabelUtil(row)
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

// ══════════════════════════════════════════════════════════════════════════════
// ABA 1: MAPA DE CALOR
// ══════════════════════════════════════════════════════════════════════════════

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

function buildMRCSheet(wb, controles, tituloAba, iconId, clienteNome, projetoNome, regressoesMap = {}) {
  // Determinar quantas colunas de regressão são necessárias
  const maxRegressoes = Math.max(0, ...controles.map(c => c.num_regressoes || 0))
  const regCols = []
  for (let i = 1; i <= maxRegressoes; i++) {
    regCols.push({ key: `_reg_${i}`, header: `Regressão ${i}`, width: 24, computed: true })
  }
  const ALL_COLUMNS = [...MRC_COLUMNS, ...regCols]
  const lastCol = ALL_COLUMNS.length + 1
  const ws = wb.addWorksheet(tituloAba, {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }],
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: 'landscape', fitToPage: true },
  })

  ws.getColumn(1).width = 4
  ALL_COLUMNS.forEach((col, idx) => { ws.getColumn(idx + 2).width = col.width })

  // ── HEADER (merge B) ──
  ws.getRow(1).height = 15
  ws.mergeCells(1, 2, 1, lastCol)
  const brandCell = ws.getCell('B1')
  brandCell.value = '    Polímata · Consultoria em GRC'
  brandCell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: CREME } }
  brandCell.fill = NAVY_FILL
  brandCell.alignment = { vertical: 'middle', horizontal: 'left' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(1, c).fill = NAVY_FILL

  if (iconId !== null) {
    ws.addImage(iconId, { tl: { col: 0.6, row: 0 }, ext: { width: 36, height: 36 }, editAs: 'oneCell' })
  }

  ws.mergeCells(2, 2, 2, lastCol)
  const titleCell = ws.getCell('B2')
  titleCell.value = `MATRIZ DE RISCOS E CONTROLES — ${tituloAba.toUpperCase()}`
  titleCell.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: GOLD } }
  titleCell.fill = NAVY_FILL
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(2, c).fill = NAVY_FILL

  ws.mergeCells(3, 2, 3, lastCol)
  const infoCell = ws.getCell('B3')
  infoCell.value = infoLine(clienteNome, projetoNome, controles.length)
  infoCell.font = { name: 'Montserrat', size: 8, color: { argb: 'FF999999' } }
  infoCell.fill = NAVY_FILL
  infoCell.alignment = { vertical: 'middle', horizontal: 'left' }
  for (let c = 1; c <= lastCol; c++) ws.getCell(3, c).fill = NAVY_FILL

  // ── LINHA 4: CABEÇALHOS ──
  const colHeaderRow = ws.getRow(4)
  ws.getCell(4, 1).fill = COL_HEADER_FILL
  ws.getCell(4, 1).border = { bottom: { style: 'medium', color: { argb: GOLD } } }

  ALL_COLUMNS.forEach((col, idx) => {
    const cell = colHeaderRow.getCell(idx + 2)
    cell.value = col.header
    cell.fill = col.key.startsWith('_reg_') ? { type: 'pattern', pattern: 'solid', fgColor: { argb: '4A3000' } } : COL_HEADER_FILL
    cell.font = col.key.startsWith('_reg_') ? { ...COL_HEADER_FONT, color: { argb: 'FFFFC107' } } : COL_HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
  })
  colHeaderRow.height = 28

  // ── FUNÇÕES VITRINE ──
  // Mapeamento: cada fase tem { resultado, incons, rec }
  const FASE_CHAIN = [
    { r: 'r_f5',   i: 'incons_f5',   rec: 'rec_f5' },
    { r: 'r_f4c2', i: 'incons_f4c2', rec: 'rec_f4c2' },
    { r: 'r_f4c1', i: 'incons_f4c1', rec: 'rec_f4c1' },
    { r: 'r3',     i: 'incons_f3',   rec: 'rec_f3' },
    { r: 'r_ader', i: 'incons_ader', rec: 'melhoria' },
    { r: 'st_pa',  i: null,          rec: null },
    { r: 'r1',     i: 'incons',      rec: 'rec' },
  ]
  // Encontra a fase mais recente com resultado válido
  function vitrineFase(row) {
    for (const f of FASE_CHAIN) {
      const v = row[f.r]
      if (v && v !== 'Teste Não Realizado' && v !== 'N/A') return f
    }
    return FASE_CHAIN[FASE_CHAIN.length - 1]
  }
  // Resultado: último resultado válido (F5 → F1)
  function vitrineResultado(row) {
    const f = vitrineFase(row)
    const v = row[f.r]
    return (v && v !== 'Teste Não Realizado' && v !== 'N/A') ? v : (row.r1 || '—')
  }
  // Inconsistência: da MESMA fase que forneceu o resultado. Se vazio → "—"
  function vitrineIncons(row) {
    const f = vitrineFase(row)
    if (!f.i) return '—'
    const v = row[f.i]
    return (v && v.trim()) ? v : '—'
  }
  // Recomendação: da MESMA fase que forneceu o resultado. Se vazio → "—"
  function vitrineRec(row) {
    const f = vitrineFase(row)
    if (!f.rec) return '—'
    const v = row[f.rec]
    return (v && v.trim()) ? v : '—'
  }
  // Histórico por fase: normaliza o resultado para exibição
  function fmtHist(v) {
    return normalizeFaseValue(v) || 'Não Iniciado'
  }

  // Conjunto de keys que recebem cor de resultado
  const RESULTADO_KEYS = new Set(['_vitrine_resultado', '_hist_f1', '_hist_f2d', '_hist_f2e', '_hist_f3', '_hist_f4c1', '_hist_f4c2', '_hist_f5'])

  // ── DADOS ──
  controles.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 5)
    ws.getCell(rowIdx + 5, 1).fill = CREME_FILL

    ALL_COLUMNS.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 2)
      let value

      // Campos computados — regressão dinâmica
      if (col.key.startsWith('_reg_')) {
        const regIdx = parseInt(col.key.replace('_reg_', ''), 10) - 1
        const regs = regressoesMap[row.id] || []
        const ev = regs[regIdx]
        if (ev) {
          const fase = ev.fase_origem || '—'
          const dt = (() => { if (!ev.criado_em) return '—'; const dd = new Date(ev.criado_em); return (isNaN(dd.getTime()) || dd.getFullYear() < 2000) ? '—' : dd.toLocaleDateString('pt-BR') })()
          value = `${fase} — ${dt}`
        } else {
          value = '—'
        }
      // Campos computados — vitrine
      } else if (col.key === '_vitrine_resultado') {
        value = vitrineResultado(row)
      } else if (col.key === '_vitrine_incons') {
        value = vitrineIncons(row)
      } else if (col.key === '_vitrine_rec') {
        value = vitrineRec(row)
      // Campos computados — histórico por fase
      } else if (col.key === '_hist_f1') {
        value = fmtHist(row.r1)
      } else if (col.key === '_hist_f2d') {
        value = (row.r1||'').toLowerCase() === 'efetivo' ? 'N/A' : fmtHist(row.st_pa)
      } else if (col.key === '_hist_f2e') {
        value = (row.r1||'').toLowerCase() === 'efetivo' ? 'N/A' : fmtHist(row.r_ader)
      } else if (col.key === '_hist_f3') {
        value = fmtHist(row.r3)
      } else if (col.key === '_hist_f4c1') {
        value = fmtHist(row.r_f4c1)
      } else if (col.key === '_hist_f4c2') {
        value = fmtHist(row.r_f4c2)
      } else if (col.key === '_hist_f5') {
        value = fmtHist(row.r_f5)
      // Campos computados — fase e status
      } else if (col.key === 'fase') {
        value = getFaseLabel(row)
      } else if (col.key === 'status_atual') {
        const cfg = getStatusConfig(getStatusComputado(row), 'admin_polimata')
        value = cfg.label || '—'
      } else if (col.key === 'crit_label') {
        value = row.crit_label || CRIT_LABEL_MAP[row.crit] || '—'
      } else if (col.fmt === 'date') {
        const d = row[col.key]
        if (d) { try { const dd = new Date(d); value = (isNaN(dd.getTime()) || dd.getFullYear() < 2000) ? '—' : dd.toLocaleDateString('pt-BR') } catch { value = '—' } }
        else { value = '—' }
      } else {
        const raw = row[col.key]
        value = raw != null && raw !== '' ? raw : '—'
      }

      cell.value = value
      cell.font = { ...BODY_FONT }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = THIN_BORDER

      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }
      }
      if (col.key === 'rr' || col.key === 'rc') {
        cell.font = { ...GOLD_FONT }
      }
      if (RESULTADO_KEYS.has(col.key)) {
        const cor = getResultadoColor(value)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
      if (col.key === 'crit_label') {
        const cor = getCritColor(row.crit)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
      if (col.key.startsWith('_reg_') && value !== '—') {
        cell.font = { ...BODY_FONT, color: { argb: '7A5700' } }
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
// FUNÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export async function exportarMRCExcel(controles, nomeArquivo, tituloAba = 'MRC', clienteNome = '', projetoNome = '') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CI Polímata'
  wb.created = new Date()

  const iconBase64 = await fetchIconBase64()
  const iconId = iconBase64 ? wb.addImage({ base64: iconBase64, extension: 'png' }) : null

  // Buscar eventos de regressão do audit_log
  let regressoesMap = {}
  const controlIds = controles.filter(c => (c.num_regressoes || 0) > 0).map(c => c.id)
  if (controlIds.length > 0) {
    try {
      const { data: logs } = await supabase
        .from('audit_log')
        .select('registro_id, detalhes, criado_em')
        .eq('acao', 'REGRESSAO')
        .in('registro_id', controlIds)
        .order('criado_em', { ascending: true })
      if (logs) {
        logs.forEach(log => {
          if (!regressoesMap[log.registro_id]) regressoesMap[log.registro_id] = []
          regressoesMap[log.registro_id].push({
            fase_origem: log.detalhes?.fase_origem || '—',
            criado_em: log.criado_em,
          })
        })
      }
    } catch (err) {
      console.warn('Não foi possível buscar regressões do audit_log:', err)
    }
  }

  buildHeatmapSheet(wb, controles, iconId, clienteNome, projetoNome)
  buildMRCSheet(wb, controles, tituloAba, iconId, clienteNome, projetoNome, regressoesMap)

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
