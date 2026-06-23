import ExcelJS from 'exceljs'

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE PLANO DE CONTAS — modelo fixo do Sistema Polímata (Gestão Orçamentária)
// Colunas padronizadas; o consultor adapta o plano de cada cliente neste layout.
// ══════════════════════════════════════════════════════════════════════════════

const NAVY = '00203E'
const CREME = 'F3EEE4'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
const HEADER_FONT = { name: 'Montserrat', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 10, color: { argb: 'FF333333' } }
const THIN = { style: 'thin', color: { argb: 'FFDDDDDD' } }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

// ÚNICA FONTE DE VERDADE das colunas — usada para gerar e para importar.
export const COLS_PLANO = [
  { header: 'Código da Conta', key: 'codigo', width: 22, obrig: true,
    hint: 'OBRIGATÓRIO. Código único da conta. Deve ser IGUAL ao código que aparece no realizado do ERP (é a chave que liga plano ↔ lançamentos).' },
  { header: 'Descrição da Conta', key: 'descricao', width: 46, obrig: true,
    hint: 'OBRIGATÓRIO. Nome da conta.' },
  { header: 'Grupo', key: 'grupo', width: 16, obrig: false,
    hint: 'Opcional. Receita, Custo, Despesa, Ativo, Passivo ou Resultado.' },
  { header: 'Em Escopo', key: 'em_escopo', width: 12, obrig: false,
    hint: 'Sim para contas que entram na gestão orçamentária; Não para as demais. Em branco = Não.' },
  { header: 'Categoria Gerencial', key: 'categoria', width: 26, obrig: false,
    hint: 'Recomendado para contas em escopo. Nome da categoria Polímata (ex.: Pessoal, Matéria Prima). Categorias novas são criadas na importação.' },
  { header: 'Tipo da Categoria', key: 'tipo', width: 18, obrig: false,
    hint: 'Obrigatório quando há Categoria Gerencial. Receita, Dedução, Custo, Despesa ou Outros.' },
]

export const EM_ESCOPO_OPCOES = ['Sim', 'Não']
export const TIPO_OPCOES = ['Receita', 'Dedução', 'Custo', 'Despesa', 'Outros']
// rótulo da planilha → id no banco (orc_categorias.tipo)
export const TIPO_LABEL_TO_ID = { 'receita': 'receita', 'dedução': 'deducao', 'deducao': 'deducao', 'custo': 'custo', 'despesa': 'despesa', 'outros': 'outros' }

const EXEMPLOS = [
  ['11.01.001.002.001', 'BANCO ITAÚ SA', 'Ativo', 'Não', '', ''],
  ['41.01.001', 'RECEITA DE VENDAS', 'Receita', 'Sim', 'Receita de Vendas', 'Receita'],
  ['51.01.002', 'SALÁRIOS', 'Resultado', 'Sim', 'Pessoal', 'Despesa'],
]

export function montarWorkbookPlanoContas({ linhas = null } = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sistema Polímata'

  // ---- aba principal ----
  const ws = wb.addWorksheet('Plano de Contas', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLS_PLANO.map(c => ({ header: c.header, key: c.key, width: c.width }))
  const head = ws.getRow(1)
  head.height = 26
  head.eachCell(cell => { cell.font = HEADER_FONT; cell.fill = HEADER_FILL; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = BORDER })

  const dados = linhas && linhas.length ? linhas : EXEMPLOS
  dados.forEach(arr => {
    const r = ws.addRow(arr)
    r.eachCell(cell => { cell.font = BODY_FONT; cell.border = BORDER; cell.alignment = { vertical: 'middle' } })
  })

  // validações (Em Escopo col D, Tipo col F) até 1000 linhas
  for (let i = 2; i <= 1000; i++) {
    ws.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Sim,Não"'] }
    ws.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${TIPO_OPCOES.join(',')}"`] }
  }

  // ---- aba instruções ----
  const wi = wb.addWorksheet('Instruções')
  wi.getColumn(1).width = 26; wi.getColumn(2).width = 95
  const t = wi.getCell('A1'); t.value = 'Template — Plano de Contas (Gestão Orçamentária · Sistema Polímata)'
  t.font = { name: 'Montserrat', bold: true, size: 13, color: { argb: 'FF' + NAVY } }
  wi.addRow([])
  wi.addRow(['Como usar', 'Preencha a aba "Plano de Contas" adaptando o plano do seu cliente a estas colunas fixas. Não altere os nomes das colunas. Depois importe este arquivo no sistema: Gestão Orçamentária → Plano de Contas → Importar Plano de Contas.'])
  wi.addRow([])
  const hc = wi.addRow(['Coluna', 'Regra'])
  hc.eachCell(cell => { cell.font = { bold: true, color: { argb: 'FF' + NAVY } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + CREME } } })
  COLS_PLANO.forEach(c => {
    const r = wi.addRow([c.header, c.hint])
    r.getCell(1).font = { bold: true }
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  })
  return wb
}

export async function baixarTemplatePlanoContas() {
  const wb = montarWorkbookPlanoContas()
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'Template_Plano_de_Contas.xlsx'
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// ── leitura/validação de um arquivo preenchido no template ──────────────────
function norm(s) { return String(s ?? '').trim() }

export async function parsePlanoContas(file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.getWorksheet('Plano de Contas') || wb.worksheets[0]
  if (!ws) throw new Error('Planilha vazia ou ilegível.')

  // mapeia coluna→key pelo cabeçalho (linha 1), tolerante a acento/caixa
  const canon = (s) => norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const headerByKey = {}
  COLS_PLANO.forEach(c => { headerByKey[canon(c.header)] = c.key })
  const colKey = {}
  ws.getRow(1).eachCell((cell, col) => { const k = headerByKey[canon(cell.value)]; if (k) colKey[k] = col })
  for (const need of ['codigo', 'descricao']) {
    if (!colKey[need]) throw new Error('Não encontrei a coluna obrigatória "' + COLS_PLANO.find(c => c.key === need).header + '". Use o template padrão sem renomear colunas.')
  }
  const getVal = (row, key) => {
    if (!colKey[key]) return ''
    let v = row.getCell(colKey[key]).value
    if (v && typeof v === 'object') v = v.result ?? v.text ?? v.richText?.map(r => r.text).join('') ?? ''
    return norm(v)
  }

  const linhas = [], erros = []
  const catSet = new Map() // nome(lower) → {nome, tipo_id}
  ws.eachRow((row, n) => {
    if (n === 1) return
    const codigo = getVal(row, 'codigo'), descricao = getVal(row, 'descricao')
    if (!codigo && !descricao) return // linha vazia
    if (!codigo || !descricao) { erros.push({ linha: n, msg: 'Falta ' + (!codigo ? 'Código' : 'Descrição') + ' da Conta' }); return }
    const grupo = getVal(row, 'grupo') || null
    const em_escopo = canon(getVal(row, 'em_escopo')) === 'sim'
    const categoria = getVal(row, 'categoria')
    let tipo_id = TIPO_LABEL_TO_ID[canon(getVal(row, 'tipo'))] || null
    if (categoria && !tipo_id) tipo_id = 'despesa' // default quando categoria preenchida sem tipo
    if (categoria) catSet.set(categoria.toLowerCase(), { nome: categoria, tipo_id })
    linhas.push({ linha: n, codigo, descricao, grupo, em_escopo, categoria: categoria || null, tipo_id })
  })

  // duplicatas de código no próprio arquivo
  const vistos = new Map()
  linhas.forEach(l => { vistos.set(l.codigo, (vistos.get(l.codigo) || 0) + 1) })
  const dups = [...vistos.entries()].filter(([, q]) => q > 1).map(([c]) => c)

  return {
    linhas, erros,
    categorias: [...catSet.values()],
    resumo: {
      total: linhas.length,
      emEscopo: linhas.filter(l => l.em_escopo).length,
      foraEscopo: linhas.filter(l => !l.em_escopo).length,
      comCategoria: linhas.filter(l => l.categoria).length,
      duplicados: dups,
    },
  }
}
