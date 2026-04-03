import ExcelJS from 'exceljs'

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT MRC PARA EXCEL (.xlsx) — Polímata brand
// ══════════════════════════════════════════════════════════════════════════════

const NAVY = '00203E'
const GOLD = 'CC915E'
const CREME = 'F3EEE4'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
const HEADER_FONT = { name: 'Montserrat', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
const BODY_FONT = { name: 'Montserrat', size: 9, color: { argb: 'FF333333' } }
const GOLD_FONT = { name: 'Montserrat', size: 9, bold: true, color: { argb: GOLD } }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
}

// Definição das 23 colunas da MRC
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

// Mapeamento criticidade integer → label
const CRIT_LABEL_MAP = {
  4: '4. Crítico',
  3: '3. Significativo',
  2: '2. Moderado',
  1: '1. Baixo',
}

// Determinar fase atual do controle
function getFaseLabel(row) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado') return 'F3 — Revisão'
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado') return 'F2-E2 — Teste de Aderência'
  if (row.st_pa && row.st_pa !== '') return 'F2-E1 — Plano de Ação'
  if (row.r1 && row.r1 !== 'Teste Não Realizado') return 'F2-E2 — Teste de Aderência'
  return 'F1 — Diagnóstico'
}

// Cores por resultado
function getResultadoColor(valor) {
  const v = (valor || '').toLowerCase()
  if (v === 'efetivo') return { argb: '1B5E20' }
  if (v === 'inefetivo') return { argb: 'B71C1C' }
  if (v === 'gap' || v === 'gap de processo') return { argb: 'E65100' }
  return null
}

// Cores por criticidade
function getCritColor(crit) {
  const map = { 4: 'EF4444', 3: 'F97316', 2: 'EAB308', 1: '22C55E' }
  return map[crit] ? { argb: map[crit] } : null
}

/**
 * Exporta controles para Excel (.xlsx) com estilo Polímata
 * @param {Array} controles - array de objetos MRC
 * @param {string} nomeArquivo - nome do arquivo sem extensão
 * @param {string} tituloAba - nome da aba
 */
export async function exportarMRCExcel(controles, nomeArquivo, tituloAba = 'MRC') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CI Polímata'
  wb.created = new Date()

  const ws = wb.addWorksheet(tituloAba, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Definir colunas
  ws.columns = MRC_COLUMNS.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }))

  // Estilizar header (linha 1)
  const headerRow = ws.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: GOLD } },
    }
  })

  // Adicionar dados
  controles.forEach(row => {
    const rowData = {}
    MRC_COLUMNS.forEach(col => {
      if (col.key === 'fase') {
        rowData[col.key] = getFaseLabel(row)
      } else if (col.key === 'crit_label') {
        rowData[col.key] = row.crit_label || CRIT_LABEL_MAP[row.crit] || '—'
      } else if (col.key === 'dt_ult') {
        const d = row.dt_ult
        if (d) {
          try {
            rowData[col.key] = new Date(d).toLocaleDateString('pt-BR')
          } catch { rowData[col.key] = d }
        } else {
          rowData[col.key] = '—'
        }
      } else {
        rowData[col.key] = row[col.key] || '—'
      }
    })
    ws.addRow(rowData)
  })

  // Estilizar linhas de dados
  for (let i = 2; i <= controles.length + 1; i++) {
    const dataRow = ws.getRow(i)
    const isEven = i % 2 === 0
    dataRow.eachCell((cell, colNumber) => {
      cell.font = { ...BODY_FONT }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = THIN_BORDER

      // Fundo alternado
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F6F2' } }
      }

      // Ref. Risco e Ref. Controle em dourado
      const colDef = MRC_COLUMNS[colNumber - 1]
      if (colDef && (colDef.key === 'rr' || colDef.key === 'rc')) {
        cell.font = { ...GOLD_FONT }
      }

      // Resultado colorido
      if (colDef && colDef.key === 'r1') {
        const cor = getResultadoColor(cell.value)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }

      // Criticidade colorida
      if (colDef && colDef.key === 'crit_label') {
        const rawCrit = controles[i - 2]?.crit
        const cor = getCritColor(rawCrit)
        if (cor) cell.font = { ...BODY_FONT, bold: true, color: cor }
      }
    })
  }

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: controles.length + 1, column: MRC_COLUMNS.length },
  }

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
