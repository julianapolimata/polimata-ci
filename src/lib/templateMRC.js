import ExcelJS from 'exceljs'

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE MRC — Planilha vazia para mapeamento de processos
// ══════════════════════════════════════════════════════════════════════════════

const NAVY = '00203E'
const GOLD = 'CC915E'
const CREME = 'F3EEE4'

const HEADER_FONT = { name: 'Montserrat', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 9, color: { argb: 'FF333333' } }
const TITLE_FONT = { name: 'Montserrat', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
const SUB_FONT = { name: 'Montserrat', size: 10, color: { argb: CREME } }
const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: '001A3A' } }
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9F7F4' } }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
}

const TEMPLATE_COLS = [
  { header: 'Data Última Atualização', width: 20, key: 'dt_ult', hint: 'DD/MM/AAAA' },
  { header: 'Gerência', width: 20, key: 'ger', hint: 'Nome do gerente responsável' },
  { header: 'Responsável Processo', width: 22, key: 'resp_sub', hint: 'Nome do responsável pelo processo' },
  { header: 'Processo', width: 22, key: 'area', hint: 'Ex: Compras, Financeiro, RH' },
  { header: 'Subprocesso', width: 22, key: 'sub', hint: 'Ex: Contas a Pagar' },
  { header: 'Ref. Risco', width: 14, key: 'rr', hint: 'Ex: COM-R01' },
  { header: 'Descrição do Risco', width: 42, key: 'dr', hint: 'Descrição detalhada do risco identificado' },
  { header: 'Ref. Controle', width: 14, key: 'rc', hint: 'Ex: COM-C01' },
  { header: 'Descrição do Controle', width: 42, key: 'dc', hint: 'Descrição detalhada do controle interno' },
  { header: 'Categoria de Controle', width: 22, key: 'cat', hint: 'Mecanismo de controle (lista suspensa)' },
  { header: 'Frequência', width: 18, key: 'freq', hint: 'Frequência de execução (lista suspensa)' },
  { header: 'Natureza', width: 16, key: 'nat', hint: 'Preventivo / Detectivo / Corretivo' },
  { header: 'Característica', width: 20, key: 'car', hint: 'Manual / Automatizado / Dependente de TI' },
  { header: 'Sistema', width: 16, key: 'sis', hint: 'Ex: SAP, TOTVS, Excel' },
  { header: 'Tipo de Controle', width: 22, key: 'chave', hint: 'Controle Chave / Controle Compensatório' },
  { header: 'Passos de Teste', width: 42, key: 'passos_f1', hint: 'Procedimentos para testar o controle' },
  { header: 'Resultado', width: 16, key: 'r1', hint: 'Efetivo / Inefetivo / GAP' },
  { header: 'Descrição da Inconsistência', width: 42, key: 'incons', hint: 'Descrever se houver inconsistência' },
  { header: 'Recomendação / Melhoria', width: 42, key: 'rec', hint: 'Sugestões de melhoria' },
  { header: 'Impacto', width: 14, key: 'imp', hint: 'Crítico / Alto / Moderado / Baixo' },
  { header: 'Probabilidade', width: 16, key: 'prob', hint: 'Extrema / Alta / Média / Baixa' },
  { header: 'Criticidade', width: 18, key: 'crit', hint: '1. Baixo / 2. Moderado / 3. Significativo / 4. Crítico' },
]

export async function gerarTemplateMRC(clienteNome) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Polímata GRC'
  wb.created = new Date()

  const ws = wb.addWorksheet('MRC Template', {
    views: [{ state: 'frozen', ySplit: 12 }],
  })

  // ── Banner Polímata (linhas 1-10) ──
  const totalCols = TEMPLATE_COLS.length
  ws.mergeCells(1, 1, 2, totalCols)
  const titleCell = ws.getCell('A1')
  titleCell.value = 'POLÍMATA GRC'
  titleCell.font = TITLE_FONT
  titleCell.fill = NAVY_FILL
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }

  ws.mergeCells(3, 1, 3, totalCols)
  const subCell = ws.getCell('A3')
  subCell.value = 'Matriz de Riscos e Controles — Template para Mapeamento de Processos'
  subCell.font = SUB_FONT
  subCell.fill = NAVY_FILL
  subCell.alignment = { horizontal: 'left', vertical: 'middle' }

  if (clienteNome) {
    ws.mergeCells(4, 1, 4, totalCols)
    const cliCell = ws.getCell('A4')
    cliCell.value = `Cliente: ${clienteNome}`
    cliCell.font = { name: 'Montserrat', size: 10, bold: true, color: { argb: GOLD } }
    cliCell.fill = NAVY_FILL
  }

  // Linhas 5-9: fundo navy vazio
  for (let r = 5; r <= 9; r++) {
    ws.mergeCells(r, 1, r, totalCols)
    ws.getCell(`A${r}`).fill = NAVY_FILL
  }

  // Linha 7: instruções
  const instrCell = ws.getCell('A7')
  instrCell.value = 'Preencha os dados a partir da linha 12. As colunas com ⬇ indicam validação de dados. Não altere a linha de cabeçalho (linha 11).'
  instrCell.font = { name: 'Montserrat', size: 9, italic: true, color: { argb: CREME } }
  instrCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

  // Linha 10: separador
  ws.mergeCells(10, 1, 10, totalCols)
  ws.getCell('A10').fill = NAVY_FILL

  // Alturas
  ws.getRow(1).height = 28
  ws.getRow(3).height = 20
  ws.getRow(7).height = 20
  ws.getRow(11).height = 40

  // ── Headers (linha 11) ──
  const headerRow = ws.getRow(11)
  TEMPLATE_COLS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.border = THIN_BORDER
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    ws.getColumn(i + 1).width = col.width
  })

  // ── Hints (linha 12 — cinza claro com dicas) ──
  const hintRow = ws.getRow(12)
  TEMPLATE_COLS.forEach((col, i) => {
    const cell = hintRow.getCell(i + 1)
    cell.value = col.hint
    cell.font = { name: 'Montserrat', size: 8, italic: true, color: { argb: 'FF999999' } }
    cell.fill = ALT_FILL
    cell.border = THIN_BORDER
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })

  // ── Linhas vazias de dados (13-62, 50 linhas) com bordas e alternância ──
  for (let r = 13; r <= 62; r++) {
    const row = ws.getRow(r)
    const isAlt = (r - 13) % 2 === 1
    TEMPLATE_COLS.forEach((_, i) => {
      const cell = row.getCell(i + 1)
      cell.border = THIN_BORDER
      cell.font = BODY_FONT
      cell.alignment = { vertical: 'top', wrapText: true }
      if (isAlt) cell.fill = ALT_FILL
    })
  }

  // ── Data Validation (dropdowns) ──
  // Resultado
  const resCol = TEMPLATE_COLS.findIndex(c => c.key === 'r1') + 1
  if (resCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, resCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Efetivo,Inefetivo,GAP,Teste Não Realizado"'],
      }
    }
  }

  // Impacto
  const impCol = TEMPLATE_COLS.findIndex(c => c.key === 'imp') + 1
  if (impCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, impCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Crítico,Alto,Moderado,Baixo"'],
      }
    }
  }

  // Probabilidade
  const probCol = TEMPLATE_COLS.findIndex(c => c.key === 'prob') + 1
  if (probCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, probCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Extrema,Alta,Média,Baixa"'],
      }
    }
  }

  // Criticidade
  const critCol = TEMPLATE_COLS.findIndex(c => c.key === 'crit') + 1
  if (critCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, critCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"1. Baixo,2. Moderado,3. Significativo,4. Crítico"'],
      }
    }
  }

  // Tipo de Controle (Chave vs Compensatório)
  const chaveCol = TEMPLATE_COLS.findIndex(c => c.key === 'chave') + 1
  if (chaveCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, chaveCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Controle Chave,Controle Compensatório"'],
      }
    }
  }

  // Característica (Manual / Automatizado / Dependente de TI)
  const carCol = TEMPLATE_COLS.findIndex(c => c.key === 'car') + 1
  if (carCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, carCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Manual,Automatizado,Dependente de TI"'],
      }
    }
  }

  // Frequência
  const freqCol = TEMPLATE_COLS.findIndex(c => c.key === 'freq') + 1
  if (freqCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, freqCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Sob demanda,Múltiplas vezes ao dia,Diária,Semanal,Quinzenal,Mensal,Trimestral,Semestral,Anual,Bienal"'],
      }
    }
  }

  // Natureza
  const natCol = TEMPLATE_COLS.findIndex(c => c.key === 'nat') + 1
  if (natCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, natCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Preventivo,Detectivo,Corretivo"'],
      }
    }
  }

  // Categoria de Controle (mecanismos)
  const catCol = TEMPLATE_COLS.findIndex(c => c.key === 'cat') + 1
  if (catCol) {
    for (let r = 13; r <= 62; r++) {
      ws.getCell(r, catCol).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"Revisão gerencial,Reconciliação,Autorização,Formalização,Configuração,Segregação de função,Relatório de exceção,Acesso ao sistema,Interface/conversão,Políticas/Procedimentos,Indicadores de Performance"'],
      }
    }
  }

  // ── Gerar e baixar ──
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `MRC_Template${clienteNome ? '_' + clienteNome.replace(/[^a-zA-Z0-9]/g, '_') : ''}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
