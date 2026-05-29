// Entrypoint do gerador de Excel MRC.
// Extraído em 22/mai/2026 (fatiamento Etapa 9).
import ExcelJS from 'exceljs'
import { supabase } from '../supabase'
import { buildHeatmapSheet } from './heatmapSheet'
import { buildMRCSheet } from './mrcSheet'
import { fetchIconBase64 } from './_shared'

export async function exportarMRCExcel(controles, nomeArquivo, tituloAba = 'MRC', clienteNome = '', projetoNome = '') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CI Polímata'
  wb.created = new Date()

  const iconBase64 = await fetchIconBase64()
  const iconId = iconBase64 ? wb.addImage({ base64: iconBase64, extension: 'png' }) : null

  // Buscar eventos de regressão do audit_log
  let regressoesMap = {}
  const controlIds = controles.filter(c => (c.num_regressoes || 0) > 0).map(c => c.id)
  if (controlIds.length > 0) {
    try {
      const { data: logs } = await supabase
        .from('audit_log')
        .select('registro_id, detalhes, criado_em')
        .eq('acao', 'REGRESSAO')
        .in('registro_id', controlIds)
        .order('criado_em', { ascending: true })
      if (logs) {
        logs.forEach(log => {
          if (!regressoesMap[log.registro_id]) regressoesMap[log.registro_id] = []
          regressoesMap[log.registro_id].push({
            fase_origem: log.detalhes?.fase_origem || '—',
            criado_em: log.criado_em,
          })
        })
      }
    } catch (err) {
      console.warn('Não foi possível buscar regressões do audit_log:', err)
    }
  }

  buildHeatmapSheet(wb, controles, iconId, clienteNome, projetoNome)
  buildMRCSheet(wb, controles, tituloAba, iconId, clienteNome, projetoNome, regressoesMap)

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
