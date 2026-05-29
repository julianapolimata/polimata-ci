// Helpers e constantes compartilhadas do gerador de relatório Excel.
// Extraído de src/lib/gerarRelatorio.js em 22/mai/2026 (fatiamento Etapa 4).
import { getFaseLabel, getStatusComputado, normalizeFaseValue } from '../fases'
import { getStatusConfig } from '../statusWorkflow'

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

export async function fetchIconBase64() {
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


export {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL, COL_HEADER_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  HM_IMP_LABELS, HM_PROB_LABELS, HM_COLORS, CRIT_LABEL_MAP,
  impToIdx, probToIdx, isYellowish, fmtHist,
  infoLine, fillCreme, buildHeader, buildFooter,
  FASE_CHAIN, vitrineFase, vitrineResultado, vitrineIncons, vitrineRec,
  getResultadoColor, getCritColor,
}
