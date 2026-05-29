// Entrypoint do gerador de relatório Excel.
// Extraído em 22/mai/2026 (fatiamento Etapa 4).
import ExcelJS from 'exceljs'
import { buildResumoSheet } from './resumo'
import { buildAreaSheet } from './areaSheet'
import { buildMatrizSheet } from './matrizSheet'
import { buildPlanosSheet } from './planosSheet'
import { fetchIconBase64 } from './_shared'

export async function gerarRelatorioExcel({ controles, areas, secoes, clienteNome, projetoNome, projeto }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CI Polímata'
  wb.created = new Date()

  const iconBase64 = await fetchIconBase64()
  const iconId = iconBase64 ? wb.addImage({ base64: iconBase64, extension: 'png' }) : null

  const isDiag = projeto?.f1_tem_teste === false

  if (secoes.resumo) {
    buildResumoSheet(wb, controles, areas, iconId, clienteNome, projetoNome, isDiag)
  }

  if (secoes.detalhamento) {
    const areaMap = {}
    controles.forEach(c => {
      const areaId = c.area_id || '__sem_area'
      if (!areaMap[areaId]) areaMap[areaId] = { nome: c.area || 'Sem Área', controles: [] }
      areaMap[areaId].controles.push(c)
    })
    const sortedAreas = Object.values(areaMap).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    sortedAreas.forEach(a => {
      buildAreaSheet(wb, a.nome, a.controles, iconId, clienteNome, projetoNome, isDiag)
    })
  }

  if (secoes.matriz) {
    buildMatrizSheet(wb, controles, iconId, clienteNome, projetoNome, isDiag)
  }

  if (secoes.planos) {
    buildPlanosSheet(wb, controles, iconId, clienteNome, projetoNome, isDiag)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  a.download = `Relatorio_${projetoNome || 'CI'}_${dataStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
