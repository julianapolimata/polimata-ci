// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE TÍTULOS (unificado) — um arquivo com as DUAS datas:
//   Competência (abertura) → alimenta o RESULTADO (realizado/orçado, por competência)
//   Vencimento (+ Pago)     → alimenta o FLUXO DE CAIXA (por vencimento/pagamento)
// ══════════════════════════════════════════════════════════════════════════════
import ExcelJS from 'exceljs'

const NAVY = '00203E'; const CREME = 'F3EEE4'; const GOLD = 'CC915E'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
const HEADER_FONT = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 10, color: { argb: 'FF333333' } }
const THIN = { style: 'thin', color: { argb: 'FFDDDDDD' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

export const COLS_TITULOS = [
  { header: 'Plano de Contas', key: 'codigo', width: 22, obrig: true, hint: 'OBRIGATÓRIO. Código da conta — igual ao plano de contas. Liga o título à categoria (resultado).' },
  { header: 'Competência', key: 'competencia', width: 14, obrig: true, hint: 'OBRIGATÓRIO. Data em que o fato ocorre (abertura). Define o mês no RESULTADO/DRE.' },
  { header: 'Vencimento', key: 'vencimento', width: 14, obrig: true, hint: 'OBRIGATÓRIO. Data prevista de pagamento/recebimento. Define o mês no FLUXO DE CAIXA.' },
  { header: 'Valor', key: 'valor', width: 14, obrig: true, hint: 'OBRIGATÓRIO. Valor do título (positivo).' },
  { header: 'Tipo', key: 'tipo', width: 12, obrig: false, hint: 'Pagar (saída) ou Receber (entrada).' },
  { header: 'Pago', key: 'pago', width: 9, obrig: false, hint: 'Sim = já pago/recebido (caixa realizado); vazio = a vencer.' },
  { header: 'Data Pagamento', key: 'data_pagamento', width: 16, obrig: false, hint: 'Opcional. Data efetiva do pagamento/recebimento.' },
  { header: 'Nome', key: 'parceiro', width: 28, obrig: false, hint: 'Opcional. Cliente ou fornecedor.' },
  { header: 'Documento', key: 'documento', width: 20, obrig: false, hint: 'Opcional. NF, boleto, título.' },
]
const canon = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v.result !== undefined) return Number(v.result)
  const s = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = parseFloat(s); return isNaN(n) ? null : n
}
const toISO = (v) => {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && v.text) v = v.text
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

const EXEMPLOS = [
  ['33.01.001.001.002', '05/01/2026', '15/02/2026', 38000, 'Receber', 'Não', '', 'Cliente Exemplo', 'NF 1234'],
  ['44.01.001.001.003', '01/01/2026', '20/01/2026', 18000, 'Pagar', 'Sim', '20/01/2026', 'MILESI', 'Boleto 1/12'],
]

export function montarWorkbookTitulos({ linhas = null } = {}) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Sistema Polímata'
  const ws = wb.addWorksheet('Títulos', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLS_TITULOS.map(c => ({ header: c.header, key: c.key, width: c.width }))
  const head = ws.getRow(1); head.height = 24
  head.eachCell(cell => { cell.font = HEADER_FONT; cell.fill = HEADER_FILL; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { ...BORDER, bottom: { style: 'medium', color: { argb: 'FF' + GOLD } } } })
  const dados = linhas && linhas.length ? linhas : EXEMPLOS
  dados.forEach((arr, di) => {
    const r = ws.addRow(arr); const zebra = di % 2 === 1
    r.eachCell(cell => { cell.font = BODY_FONT; cell.border = BORDER; cell.alignment = { vertical: 'middle' }; if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CREME } } })
    r.getCell(4).numFmt = '#,##0.00'
  })
  for (let i = 2; i <= 5000; i++) {
    ws.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Pagar,Receber"'] }
    ws.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Sim,Não"'] }
  }
  const wi = wb.addWorksheet('Instruções')
  wi.getColumn(1).width = 22; wi.getColumn(2).width = 95
  const t = wi.getCell('A1'); t.value = 'Template — Títulos (Resultado + Fluxo de Caixa · Sistema Polímata)'
  t.font = { name: 'Raleway', bold: true, size: 15, color: { argb: 'FF' + NAVY } }
  wi.addRow([])
  const cu = wi.addRow(['Como usar', 'Um título por linha, com as DUAS datas. Competência (abertura) é usada no RESULTADO/DRE (regime de competência). Vencimento (+ Pago/Data Pagamento) é usado no FLUXO DE CAIXA (regime de caixa). Assim um único arquivo alimenta as duas visões. Importe o plano de contas antes.'])
  cu.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + NAVY } }
  cu.getCell(2).font = BODY_FONT; cu.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  COLS_TITULOS.forEach(c => {
    const r = wi.addRow([c.header + (c.obrig ? ' *' : ''), c.hint])
    r.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + (c.obrig ? GOLD : NAVY) } }
    r.getCell(2).font = BODY_FONT; r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  })
  return wb
}

export async function baixarTemplateTitulos() {
  const wb = montarWorkbookTitulos({})
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = 'Template_Titulos.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export async function parseTitulos(file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet('Títulos') || wb.worksheets[0]
  if (!ws) throw new Error('Planilha não encontrada. Use o template padrão.')
  const headerByKey = {}; COLS_TITULOS.forEach(c => { headerByKey[canon(c.header)] = c.key })
  const colKey = {}
  ws.getRow(1).eachCell((cell, col) => { const k = headerByKey[canon(cell.value)]; if (k) colKey[k] = col })
  for (const need of ['codigo', 'competencia', 'vencimento', 'valor']) if (!colKey[need]) throw new Error('Falta a coluna obrigatória "' + COLS_TITULOS.find(c => c.key === need).header + '". Use o template padrão.')
  const cell = (row, key) => colKey[key] ? row.getCell(colKey[key]).value : null
  const txt = (v) => (v && typeof v === 'object' && v.text) ? v.text : v
  const linhas = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const codigo = String(txt(cell(row, 'codigo')) ?? '').trim()
    const valor = num(cell(row, 'valor'))
    const venc = toISO(cell(row, 'vencimento'))
    const comp = toISO(cell(row, 'competencia'))
    if (!codigo || valor === null) return
    const tipoRaw = canon(txt(cell(row, 'tipo')))
    const tipo = tipoRaw.startsWith('receb') ? 'entrada' : 'saida'
    const pagoRaw = canon(txt(cell(row, 'pago')))
    const pago = pagoRaw.startsWith('s') || pagoRaw === 'pago' || pagoRaw === 'true'
    linhas.push({ codigo, competencia: comp, vencimento: venc, valor: Math.round(Math.abs(valor) * 100) / 100, tipo, pago,
      data_pagamento: toISO(cell(row, 'data_pagamento')),
      parceiro: (txt(cell(row, 'parceiro')) ? String(txt(cell(row, 'parceiro'))).trim() : null),
      documento: (txt(cell(row, 'documento')) ? String(txt(cell(row, 'documento'))).trim() : null) })
  })
  return { linhas }
}
