// buildMRCSheet — aba Matriz de Riscos e Controles do MRC Excel.
// Extraído em 22/mai/2026 (fatiamento Etapa 9).
import { getStatusComputado, normalizeFaseValue } from '../fases'
import { getStatusConfig } from '../statusWorkflow'
import * as S from './_shared'

const {
  NAVY, GOLD, CREME, NAVY_FILL, CREME_FILL, WHITE_FILL, COL_HEADER_FILL,
  COL_HEADER_FONT, BODY_FONT, GOLD_FONT, THIN_BORDER, CREME_BORDER,
  MRC_COLUMNS, CRIT_LABEL_MAP,
  getFaseLabel, getResultadoColor, getCritColor,
  infoLine, fillCreme,
} = S

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


export { buildMRCSheet }
