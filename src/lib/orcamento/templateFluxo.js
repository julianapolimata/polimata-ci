// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE FLUXO DE CAIXA — modelo fixo do Polímata App.
// Títulos a pagar/receber por VENCIMENTO (regime de caixa). Um título por linha.
// ══════════════════════════════════════════════════════════════════════════════
import ExcelJS from 'exceljs'

const NAVY = '00203E'; const CREME = 'F3EEE4'; const GOLD = 'CC915E'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
const HEADER_FONT = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 10, color: { argb: 'FF333333' } }
const THIN = { style: 'thin', color: { argb: 'FFDDDDDD' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

export const COLS_FLUXO = [
  { header: 'Tipo', key: 'tipo', width: 12, obrig: true, hint: 'OBRIGATÓRIO. Pagar (saída de caixa) ou Receber (entrada de caixa).' },
  { header: 'Vencimento', key: 'vencimento', width: 14, obrig: true, hint: 'OBRIGATÓRIO. Data prevista de pagamento/recebimento (DD/MM/AAAA). Define o mês no fluxo de caixa.' },
  { header: 'Valor', key: 'valor', width: 14, obrig: true, hint: 'OBRIGATÓRIO. Valor do título (positivo).' },
  { header: 'Nome', key: 'parceiro', width: 30, obrig: false, hint: 'Opcional. Cliente (entrada) ou fornecedor (saída).' },
  { header: 'Documento', key: 'documento', width: 20, obrig: false, hint: 'Opcional. NF, boleto, título.' },
  { header: 'Pago', key: 'pago', width: 10, obrig: false, hint: 'Opcional. Sim = já pago/recebido (caixa realizado); Não/vazio = ainda a vencer (previsto).' },
  { header: 'Data Pagamento', key: 'data_pagamento', width: 16, obrig: false, hint: 'Opcional. Data efetiva do pagamento/recebimento, quando já ocorreu.' },
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
  ['Receber', '15/01/2026', 25000, 'Cliente Exemplo Ltda', 'NF 1234', 'Sim', '15/01/2026'],
  ['Receber', '20/02/2026', 18000, 'Outro Cliente', 'NF 1240', 'Não', ''],
  ['Pagar', '20/01/2026', 18000, 'MILESI', 'Boleto 1/12', 'Sim', '20/01/2026'],
  ['Pagar', '20/02/2026', 18000, 'MILESI', 'Boleto 2/12', 'Não', ''],
]

export function montarWorkbookFluxo({ linhas = null } = {}) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Sistema Polímata'
  const ws = wb.addWorksheet('Fluxo de Caixa', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLS_FLUXO.map(c => ({ header: c.header, key: c.key, width: c.width }))
  const head = ws.getRow(1); head.height = 24
  head.eachCell(cell => { cell.font = HEADER_FONT; cell.fill = HEADER_FILL; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { ...BORDER, bottom: { style: 'medium', color: { argb: 'FF' + GOLD } } } })
  const dados = linhas && linhas.length ? linhas : EXEMPLOS
  dados.forEach((arr, di) => {
    const r = ws.addRow(arr); const zebra = di % 2 === 1
    r.eachCell(cell => { cell.font = BODY_FONT; cell.border = BORDER; cell.alignment = { vertical: 'middle' }; if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CREME } } })
    r.getCell(3).numFmt = '#,##0.00'
  })
  for (let i = 2; i <= 5000; i++) {
    ws.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Pagar,Receber"'] }
    ws.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Sim,Não"'] }
  }
  const wi = wb.addWorksheet('Instruções')
  wi.getColumn(1).width = 22; wi.getColumn(2).width = 95
  const t = wi.getCell('A1'); t.value = 'Template — Fluxo de Caixa (Gestão Orçamentária · Sistema Polímata)'
  t.font = { name: 'Raleway', bold: true, size: 15, color: { argb: 'FF' + NAVY } }
  wi.addRow([])
  const cu = wi.addRow(['Como usar', 'Liste os títulos a pagar e a receber por DATA DE VENCIMENTO. Marque "Pago = Sim" no que já saiu/entrou (caixa realizado) e deixe em branco no que ainda vai vencer (previsto). É a base de CAIXA — diferente do realizado por competência, que mede resultado.'])
  cu.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + NAVY } }
  cu.getCell(2).font = BODY_FONT; cu.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  COLS_FLUXO.forEach(c => {
    const r = wi.addRow([c.header + (c.obrig ? ' *' : ''), c.hint])
    r.getCell(1).font = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FF' + (c.obrig ? GOLD : NAVY) } }
    r.getCell(2).font = BODY_FONT; r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  })
  return wb
}

export async function baixarTemplateFluxo() {
  const wb = montarWorkbookFluxo({})
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = 'Template_Fluxo_Caixa.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export async function parseFluxo(file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet('Fluxo de Caixa') || wb.worksheets[0]
  if (!ws) throw new Error('Planilha não encontrada. Use o template padrão.')
  const headerByKey = {}; COLS_FLUXO.forEach(c => { headerByKey[canon(c.header)] = c.key })
  const colKey = {}
  ws.getRow(1).eachCell((cell, col) => { const k = headerByKey[canon(cell.value)]; if (k) colKey[k] = col })
  for (const need of ['tipo', 'vencimento', 'valor']) if (!colKey[need]) throw new Error('Falta a coluna obrigatória "' + COLS_FLUXO.find(c => c.key === need).header + '". Use o template padrão.')
  const cell = (row, key) => colKey[key] ? row.getCell(colKey[key]).value : null
  const txt = (v) => (v && typeof v === 'object' && v.text) ? v.text : v
  const linhas = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const tipoRaw = canon(txt(cell(row, 'tipo')))
    const venc = toISO(cell(row, 'vencimento'))
    const valor = num(cell(row, 'valor'))
    if ((!tipoRaw && !venc) || valor === null) return
    const tipo = tipoRaw.startsWith('receb') ? 'entrada' : 'saida'
    const pagoRaw = canon(txt(cell(row, 'pago')))
    const pago = pagoRaw.startsWith('s') || pagoRaw === 'pago' || pagoRaw === 'true'
    if (!venc) return
    linhas.push({ tipo, vencimento: venc, valor: Math.round(Math.abs(valor) * 100) / 100, pago,
      data_pagamento: toISO(cell(row, 'data_pagamento')),
      parceiro: (txt(cell(row, 'parceiro')) || null) && String(txt(cell(row, 'parceiro'))).trim() || null,
      documento: (txt(cell(row, 'documento')) || null) && String(txt(cell(row, 'documento'))).trim() || null })
  })
  return { linhas }
}
