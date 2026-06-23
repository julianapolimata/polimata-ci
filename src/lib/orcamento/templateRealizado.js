import ExcelJS from 'exceljs'

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE REALIZADO — modelo fixo do Sistema Polímata (Gestão Orçamentária)
// O consultor adapta o relatório de realizado do cliente a este layout.
// Natureza (receita/despesa) NÃO vem aqui — é inferida da conta (plano de contas).
// ══════════════════════════════════════════════════════════════════════════════

const NAVY = '00203E'
const CREME = 'F3EEE4'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
const HEADER_FONT = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 10, color: { argb: 'FF333333' } }
const THIN = { style: 'thin', color: { argb: 'FFDDDDDD' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

// ÚNICA FONTE DE VERDADE das colunas — usada para gerar e importar.
export const COLS_REALIZADO = [
  { header: 'Plano de Contas', key: 'codigo', width: 24, obrig: true,
    hint: 'OBRIGATÓRIO. Código da conta — IGUAL ao "Código da Conta" do plano de contas (ex.: 11.01.003.001.008). É a chave que liga o lançamento à conta/categoria.' },
  { header: 'Data', key: 'data', width: 14, obrig: true,
    hint: 'OBRIGATÓRIO. Data de competência do lançamento (DD/MM/AAAA). Define o mês do realizado. Cada linha pode ser de um mês diferente.' },
  { header: 'Valor', key: 'valor', width: 16, obrig: true,
    hint: 'OBRIGATÓRIO. Valor JÁ RATEADO na conta (não o valor cheio do título quando ele é dividido entre contas). Use ponto/vírgula conforme o Excel.' },
  { header: 'Descrição', key: 'descricao', width: 50, obrig: false,
    hint: 'Opcional. Histórico/descrição do lançamento — ajuda a rastrear.' },
]

const EXEMPLOS = [
  ['11.01.003.001.008', '12/02/2026', 888.67, 'NFE 33130 - Vidros e espelhos (parc. 1/3)'],
  ['44.01.001.001.003', '03/02/2026', 2619.44, 'NF 17531 - Materiais para lustração'],
  ['51.01.002', '05/02/2026', 12500.00, 'Folha de salários - Fevereiro'],
]

const canon = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function montarWorkbookRealizado({ linhas = null } = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sistema Polímata'

  const ws = wb.addWorksheet('Realizado', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLS_REALIZADO.map(c => ({ header: c.header, key: c.key, width: c.width }))
  const head = ws.getRow(1); head.height = 26
  head.eachCell(cell => { cell.font = HEADER_FONT; cell.fill = HEADER_FILL; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = BORDER })

  const dados = linhas && linhas.length ? linhas : EXEMPLOS
  dados.forEach(arr => {
    const r = ws.addRow(arr)
    r.eachCell(cell => { cell.font = BODY_FONT; cell.border = BORDER; cell.alignment = { vertical: 'middle' } })
    r.getCell(3).numFmt = '#,##0.00'
  })

  // aba instruções (identidade Polímata: Montserrat)
  const wi = wb.addWorksheet('Instruções')
  wi.getColumn(1).width = 22; wi.getColumn(2).width = 95
  const t = wi.getCell('A1'); t.value = 'Template — Realizado (Gestão Orçamentária · Sistema Polímata)'
  t.font = { name: 'Montserrat', bold: true, size: 13, color: { argb: 'FF' + NAVY } }
  wi.addRow([])
  const cu = wi.addRow(['Como usar', 'Adapte o relatório de realizado do cliente a estas colunas fixas e importe em Gestão Orçamentária → Importar Realizado. Importe quantos meses quiser de uma vez — o mês vem da coluna Data de cada linha. A natureza (receita/despesa) é definida pela conta no plano de contas, por isso não há coluna de tipo aqui. Importe o plano de contas ANTES do realizado.'])
  cu.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + NAVY } }
  cu.getCell(2).font = BODY_FONT; cu.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  wi.addRow([])
  const hc = wi.addRow(['Coluna', 'Regra'])
  hc.eachCell(cell => { cell.font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + NAVY } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CREME } } })
  COLS_REALIZADO.forEach(c => {
    const r = wi.addRow([c.header, c.hint])
    r.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF333333' } }
    r.getCell(2).font = BODY_FONT; r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  })
  return wb
}

export async function baixarTemplateRealizado() {
  const wb = montarWorkbookRealizado()
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'Template_Realizado.xlsx'
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

// ── parsing/validação ───────────────────────────────────────────────────────
function parseData(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return v
  if (typeof v === 'object' && v.result instanceof Date) return v.result
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/) // DD/MM/AAAA
  if (m) { const [_, d, mo, y] = m; const yy = y.length === 2 ? '20' + y : y; const dt = new Date(+yy, +mo - 1, +d); return isNaN(dt) ? null : dt }
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/) // AAAA-MM-DD
  if (m) { const [_, y, mo, d] = m; const dt = new Date(+y, +mo - 1, +d); return isNaN(dt) ? null : dt }
  const dt = new Date(s); return isNaN(dt) ? null : dt
}
function parseValor(v) {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'result' in v) v = v.result
  let s = String(v ?? '').trim().replace(/[\u0300-\u036f]/g, '')
  if (s === '') return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 -> 1234.56
  return parseFloat(s)
}
const competenciaDe = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`

export async function parseRealizado(file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet('Realizado') || wb.worksheets[0]
  if (!ws) throw new Error('Planilha vazia ou ilegível.')

  const headerByKey = {}
  COLS_REALIZADO.forEach(c => { headerByKey[canon(c.header)] = c.key })
  const colKey = {}
  ws.getRow(1).eachCell((cell, col) => { const k = headerByKey[canon(cell.value)]; if (k) colKey[k] = col })
  for (const need of ['codigo', 'data', 'valor']) {
    if (!colKey[need]) throw new Error('Não encontrei a coluna obrigatória "' + COLS_REALIZADO.find(c => c.key === need).header + '". Use o template padrão sem renomear colunas.')
  }
  const cellVal = (row, key) => { if (!colKey[key]) return null; return row.getCell(colKey[key]).value }
  const txt = (v) => { if (v && typeof v === 'object') v = v.result ?? v.text ?? (v.richText ? v.richText.map(r => r.text).join('') : '') ; return String(v ?? '').trim() }

  const linhas = [], erros = []
  const meses = {} // comp -> {qtd, soma}
  const contas = new Set()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const codigo = txt(cellVal(row, 'codigo'))
    const dataRaw = cellVal(row, 'data')
    const valorRaw = cellVal(row, 'valor')
    if (!codigo && dataRaw == null && (valorRaw == null || valorRaw === '')) return // linha vazia
    const dt = parseData(dataRaw)
    const valor = parseValor(valorRaw)
    const probs = []
    if (!codigo) probs.push('Plano de Contas')
    if (!dt) probs.push('Data')
    if (!isFinite(valor)) probs.push('Valor')
    if (probs.length) { erros.push({ linha: n, msg: 'inválido/ausente: ' + probs.join(', ') }); return }
    const comp = competenciaDe(dt)
    const abs = Math.round(Math.abs(valor) * 100) / 100
    linhas.push({ linha: n, codigo, competencia: comp, valor: abs, descricao: txt(cellVal(row, 'descricao')) || null })
    contas.add(codigo)
    meses[comp] = meses[comp] || { qtd: 0, soma: 0 }
    meses[comp].qtd++; meses[comp].soma += abs
  })

  return {
    linhas, erros,
    resumo: {
      total: linhas.length,
      soma: linhas.reduce((a, l) => a + l.valor, 0),
      contas: contas.size,
      meses: Object.fromEntries(Object.entries(meses).sort()),
    },
  }
}
