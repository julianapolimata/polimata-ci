import ExcelJS from 'exceljs'

const STATUS_LABEL = {
  aguardando: 'Aguardando',
  em_andamento: 'Em Andamento',
  recebida: 'Recebida',
  validada: 'Validada',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

const NAVY = 'FF00203E'
const COPPER = 'FFCC915E'
const CREME = 'FFF7F3EE'

function fmtDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}
function fmtDateTime(v) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR')
}

export async function exportarSolicitacoesExcel({ solicitacoes, controles, areas, clienteNome, projetoNome }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Polímata GRC'
  wb.created = new Date()

  const ctrlMap = {}; controles.forEach(c => { ctrlMap[c.id] = c })
  const areaMap = {}; areas.forEach(a => { areaMap[a.id] = a })

  // Agrupar por área
  const grupos = {}
  solicitacoes.forEach(s => {
    const areaId = s.area_id || '__sem_area'
    if (!grupos[areaId]) grupos[areaId] = []
    grupos[areaId].push(s)
  })

  // Aba Resumo (todas as solicitações + KPIs)
  const wsResumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  wsResumo.getColumn(1).width = 4
  wsResumo.mergeCells('B2:I2')
  const titR = wsResumo.getCell('B2')
  titR.value = 'LISTA DE SOLICITAÇÕES — TODAS AS ÁREAS'
  titR.font = { name: 'Montserrat', size: 14, bold: true, color: { argb: NAVY } }
  titR.alignment = { vertical: 'middle' }
  wsResumo.getRow(2).height = 24

  const subR = wsResumo.getCell('B3')
  subR.value = `${clienteNome || ''} · ${projetoNome || ''} · ${solicitacoes.length} solicitações`
  subR.font = { name: 'Montserrat', size: 10, color: { argb: 'FF888888' } }

  // KPIs
  const total = solicitacoes.length
  const aguardando = solicitacoes.filter(s => ['aguardando','em_andamento'].includes(s.status)).length
  const recebidas = solicitacoes.filter(s => s.status === 'recebida').length
  const validadas = solicitacoes.filter(s => s.status === 'validada').length
  const hoje = new Date()
  const atrasadas = solicitacoes.filter(s => s.prazo && new Date(s.prazo) < hoje && !['validada','cancelada','recebida'].includes(s.status)).length

  const cards = [
    { l: 'TOTAL', v: total, c: NAVY },
    { l: 'AGUARDANDO', v: aguardando, c: 'FF1D4ED8' },
    { l: 'ATRASADAS', v: atrasadas, c: 'FFDC2626' },
    { l: 'A VALIDAR', v: recebidas, c: 'FFEA580C' },
    { l: 'VALIDADAS', v: validadas, c: 'FF22C55E' },
  ]
  cards.forEach((card, i) => {
    const col = 2 + i
    const lbl = wsResumo.getCell(5, col)
    lbl.value = card.l
    lbl.font = { name: 'Montserrat', bold: true, size: 8, color: { argb: 'FF999999' } }
    lbl.alignment = { horizontal: 'center' }
    const val = wsResumo.getCell(6, col)
    val.value = card.v
    val.font = { name: 'Montserrat', size: 22, color: { argb: card.c } }
    val.alignment = { horizontal: 'center', vertical: 'middle' }
    wsResumo.getRow(6).height = 32
  })

  // Tabela resumo
  const headers = ['Nº', 'Área', 'Fase', 'Controle', 'Título', 'Descrição', 'Resp. Cliente', 'Email Resp.', 'Solicitado em', 'Prazo', 'Status', 'Link Evidência', 'Comentários']
  const headerRow = 9
  headers.forEach((h, i) => {
    const cell = wsResumo.getCell(headerRow, 2 + i)
    cell.value = h
    cell.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  const widths = [12, 18, 8, 14, 36, 42, 22, 28, 14, 12, 14, 30, 30]
  widths.forEach((w, i) => { wsResumo.getColumn(2 + i).width = w })

  solicitacoes.forEach((s, idx) => {
    const row = headerRow + 1 + idx
    const ctrl = ctrlMap[s.controle_id]
    const area = areaMap[s.area_id]
    const vals = [
      s.numero, area?.nome || '—', s.fase || '—', ctrl?.rc || '—', s.titulo || '',
      s.descricao || '', s.responsavel_cliente_nome || '', s.responsavel_cliente_email || '',
      fmtDateTime(s.data_solicitacao), fmtDate(s.prazo),
      STATUS_LABEL[s.status] || s.status, s.evidencia_link || '', s.comentarios || '',
    ]
    vals.forEach((v, i) => {
      const cell = wsResumo.getCell(row, 2 + i)
      cell.value = v
      cell.font = { name: 'Montserrat', size: 9 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } }
    })
  })

  // Abas por área (espelha o modelo atual da Polímata)
  const areasOrdenadas = Object.entries(grupos).sort((a, b) => {
    const na = areaMap[a[0]]?.nome || 'Sem área'
    const nb = areaMap[b[0]]?.nome || 'Sem área'
    return na.localeCompare(nb)
  })

  areasOrdenadas.forEach(([areaId, sols]) => {
    const areaNome = areaMap[areaId]?.nome || 'Sem área'
    const sheetName = areaNome.slice(0, 28).replace(/[\\/?*\[\]:]/g, '_')
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })
    ws.getColumn(1).width = 4

    ws.mergeCells('B2:I2')
    const tit = ws.getCell('B2')
    tit.value = `LISTA DE SOLICITAÇÕES — ${areaNome.toUpperCase()}`
    tit.font = { name: 'Montserrat', size: 14, bold: true, color: { argb: NAVY } }
    ws.getRow(2).height = 24

    const sub = ws.getCell('B3')
    sub.value = `${clienteNome || ''} · ${projetoNome || ''} · ${sols.length} solicitações`
    sub.font = { name: 'Montserrat', size: 10, color: { argb: 'FF888888' } }

    // Agrupar por fase
    const porFase = {}
    sols.forEach(s => { const f = s.fase || 'Sem fase'; if (!porFase[f]) porFase[f] = []; porFase[f].push(s) })
    const fases = Object.keys(porFase).sort()

    const headers2 = ['Nº', 'Fase', 'Controle', 'Título', 'Descrição', 'Resp. Cliente', 'Solicitado em', 'Prazo', 'Status', 'Link Evidência', 'Comentários']
    const widths2 = [12, 8, 14, 36, 42, 22, 14, 12, 14, 30, 30]
    widths2.forEach((w, i) => { ws.getColumn(2 + i).width = w })

    let r = 5
    fases.forEach(fase => {
      // Cabeçalho da fase
      ws.mergeCells(r, 2, r, 12)
      const faseCell = ws.getCell(r, 2)
      faseCell.value = `Fase: ${fase}`
      faseCell.font = { name: 'Montserrat', bold: true, size: 11, color: { argb: COPPER } }
      faseCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREME } }
      faseCell.alignment = { vertical: 'middle' }
      ws.getRow(r).height = 20
      r++

      // Cabeçalho colunas
      headers2.forEach((h, i) => {
        const cell = ws.getCell(r, 2 + i)
        cell.value = h
        cell.font = { name: 'Montserrat', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      r++

      // Linhas
      porFase[fase].forEach(s => {
        const ctrl = ctrlMap[s.controle_id]
        const vals = [
          s.numero, s.fase || '—', ctrl?.rc || '—', s.titulo || '',
          s.descricao || '', s.responsavel_cliente_nome || '',
          fmtDateTime(s.data_solicitacao), fmtDate(s.prazo),
          STATUS_LABEL[s.status] || s.status, s.evidencia_link || '', s.comentarios || '',
        ]
        vals.forEach((v, i) => {
          const cell = ws.getCell(r, 2 + i)
          cell.value = v
          cell.font = { name: 'Montserrat', size: 9 }
          cell.alignment = { vertical: 'top', wrapText: true }
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } }
        })
        r++
      })
      r++ // espaço entre fases
    })
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const dt = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  a.download = `Solicitacoes_${projetoNome || 'Projeto'}_${dt}.xlsx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
