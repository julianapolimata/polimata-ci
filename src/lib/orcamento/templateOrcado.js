// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE ORÇADO — modelo fixo do Polímata App (Gestão Orçamentária)
// Formato largo: uma linha por conta do plano, um valor por mês (Jan…Dez).
// O consultor adapta o orçamento do cliente a este layout. A natureza
// (receita/despesa) vem da conta no plano de contas — não há coluna de tipo.
// ══════════════════════════════════════════════════════════════════════════════
import ExcelJS from 'exceljs'

const NAVY = '00203E'
const CREME = 'F3EEE4'
const GOLD = 'CC915E'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
const HEADER_FONT = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 10, color: { argb: 'FF333333' } }
const THIN = { style: 'thin', color: { argb: 'FFDDDDDD' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

export const MESES_COL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const COLS_ORCADO = [
  { header: 'Plano de Contas', key: 'codigo', width: 24, obrig: true,
    hint: 'OBRIGATÓRIO. Código da conta — IGUAL ao do plano de contas (ex.: 33.01.001.001.002). É a chave que liga o valor à conta/categoria.' },
  { header: 'Descrição', key: 'descricao', width: 40, obrig: false,
    hint: 'Opcional. Nome/descrição da conta — só para leitura, não é importado.' },
]
const canon = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v.result !== undefined) return Number(v.result)
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = parseFloat(s); return isNaN(n) ? null : n
}

const EXEMPLOS = [
  ['33.01.001.001.002', 'Venda de Produtos - Mobília Fixa', 500000, 500000, 500000, 500000, 500000, 500000, 520000, 520000, 520000, 520000, 520000, 560000],
  ['44.01.001.001.003', 'Materiais para Lustração', 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000],
  ['55.01.001.001.029', 'Salários', 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000],
]

export function montarWorkbookOrcado({ linhas = null } = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sistema Polímata'
  const ws = wb.addWorksheet('Orçado', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })
  const cols = [...COLS_ORCADO.map(c => ({ header: c.header, key: c.key, width: c.width })), ...MESES_COL.map(m => ({ header: m, key: m, width: 12 }))]
  ws.columns = cols
  const head = ws.getRow(1); head.height = 24
  head.eachCell(cell => { cell.font = HEADER_FONT; cell.fill = HEADER_FILL; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { ...BORDER, bottom: { style: 'medium', color: { argb: 'FF' + GOLD } } } })

  const dados = linhas && linhas.length ? linhas : EXEMPLOS
  dados.forEach((arr, di) => {
    const r = ws.addRow(arr)
    const zebra = di % 2 === 1
    r.eachCell((cell, col) => { cell.font = BODY_FONT; cell.border = BORDER; cell.alignment = { vertical: 'middle' }; if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CREME } }; if (col > 2) cell.numFmt = '#,##0.00' })
  })

  const wi = wb.addWorksheet('Instruções')
  wi.getColumn(1).width = 22; wi.getColumn(2).width = 95
  const t = wi.getCell('A1'); t.value = 'Template — Orçado (Gestão Orçamentária · Sistema Polímata)'
  t.font = { name: 'Raleway', bold: true, size: 15, color: { argb: 'FF' + NAVY } }
  wi.addRow([])
  const cu = wi.addRow(['Como usar', 'Adapte o orçamento do cliente a estas colunas fixas e importe em Gestão Orçamentária → Importar Orçado. Uma linha por conta do plano de contas; preencha o valor de cada mês (Jan a Dez). A natureza (receita/despesa) é definida pela conta no plano de contas, por isso não há coluna de tipo. Importe o plano de contas ANTES do orçado. Valores em branco ou zero são ignorados.'])
  cu.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + NAVY } }
  cu.getCell(2).font = BODY_FONT; cu.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  COLS_ORCADO.forEach(c => {
    const r = wi.addRow([c.header + (c.obrig ? ' *' : ''), c.hint])
    r.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + (c.obrig ? GOLD : NAVY) } }
    r.getCell(2).font = BODY_FONT; r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  })
  const rm = wi.addRow(['Jan … Dez', 'Doze colunas de valor mensal orçado para a conta. Use ponto/vírgula conforme o Excel.'])
  rm.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + NAVY } }
  rm.getCell(2).font = BODY_FONT; rm.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  return wb
}

export async function baixarTemplateOrcado(linhas = null) {
  const wb = montarWorkbookOrcado({ linhas })
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = 'Template_Orcado.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

/** Lê o template e retorna { linhas: [{codigo, mes(0-11), valor}], contas } */
export async function parseOrcado(file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet('Orçado') || wb.worksheets[0]
  if (!ws) throw new Error('Planilha não encontrada. Use o template padrão.')
  const colCodigo = { c: null }, colMes = {}
  ws.getRow(1).eachCell((cell, col) => {
    const k = canon(cell.value)
    if (k === 'plano de contas') colCodigo.c = col
    const mi = MESES_COL.findIndex(m => canon(m) === k)
    if (mi >= 0) colMes[mi] = col
  })
  if (!colCodigo.c) throw new Error('Não encontrei a coluna obrigatória "Plano de Contas". Use o template padrão sem renomear colunas.')
  if (!Object.keys(colMes).length) throw new Error('Não encontrei as colunas de mês (Jan…Dez). Use o template padrão.')
  const txt = (v) => (v && typeof v === 'object' && v.text) ? v.text : v
  const linhas = []; const contas = new Set()
  ws.eachRow((row, n) => {
    if (n === 1) return
    const codigo = String(txt(row.getCell(colCodigo.c).value) ?? '').trim()
    if (!codigo) return
    contas.add(codigo)
    for (let m = 0; m < 12; m++) {
      if (!colMes[m]) continue
      const v = num(row.getCell(colMes[m]).value)
      if (v && v !== 0) linhas.push({ codigo, mes: m, valor: Math.round(v * 100) / 100 })
    }
  })
  return { linhas, contas: [...contas] }
}
