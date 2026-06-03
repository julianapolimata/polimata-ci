// Geração da Ficha de Risco em Excel.
// Extraído do ModalAtualizar.jsx em 22/mai/2026 (fatiamento Etapa 3).
// Função pura — recebe os dados do controle e dispara o download do .xlsx.
// Sem React, sem hooks, sem efeitos colaterais além do download do arquivo.

import ExcelJS from 'exceljs'
import { formatNomeEmpresa } from './formatNome'

export async function gerarFichaRiscoExcel({
  row,
  projeto,
  perfil,
  novaDescRisco,
  novaDescControle,
  editCat,
  editFreq,
  editNat,
  editCar,
  editSis,
  editChave,
  premissas,
  passos,
  isAutomatic,
}) {
  const { pq, quando, onde, quem, como, resultado } = premissas || {}

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Polímata GRC'
  workbook.created = new Date()

  const NAVY   = 'FF00203E'
  const GOLD   = 'FFCC915E'
  const COPPER = 'FFA6512F'
  const CREAM  = 'FFF3EEE4'
  const F8     = 'FFF8F6F2'
  const WHITE  = 'FFFFFFFF'
  const GRAY33 = 'FF333333'
  const GRAY99 = 'FF999999'
  const GRAYBB = 'FFBBBBBB'
  const HAIR   = 'FFF0EDE8'
  const BGRAY  = 'FFD5CFC6'

  const fontBase = (opts = {}) => ({ name: 'Montserrat', size: 10, ...opts })
  const hairBorder = { style: 'hair', color: { argb: HAIR } }
  const allHair = { top: hairBorder, bottom: hairBorder, left: hairBorder, right: hairBorder }
  const fillSolid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
  const alignVC = { vertical: 'middle' }
  const alignVCWrap = { vertical: 'middle', wrapText: true }

  function applySection(ws, r, text) {
    ws.mergeCells(r, 2, r, 9)
    const c = ws.getCell(r, 2)
    c.value = text
    c.font = fontBase({ bold: true, color: { argb: GOLD } })
    c.fill = fillSolid(NAVY)
    c.alignment = { horizontal: 'left', vertical: 'middle' }
    c.border = allHair
    ws.getRow(r).height = 15
  }

  function applyRow(ws, r, labelText, valueText, editable = false, opts = {}) {
    const lc = ws.getCell(r, 2)
    lc.value = labelText
    lc.font = fontBase({ bold: true, color: { argb: NAVY } })
    lc.fill = fillSolid(opts.labelFill || WHITE)
    lc.alignment = alignVC
    lc.border = allHair
    ws.mergeCells(r, 3, r, 9)
    const vc = ws.getCell(r, 3)
    vc.value = valueText || ''
    vc.font = fontBase({ bold: !!opts.valueBold, color: { argb: opts.valueColor || GRAY33 } })
    vc.fill = fillSolid(editable ? WHITE : F8)
    vc.alignment = alignVCWrap
    vc.border = {
      ...allHair,
      left: { style: editable ? 'thin' : 'medium', color: { argb: editable ? BGRAY : GOLD } }
    }
    ws.getRow(r).height = 15
  }

  const ws = workbook.addWorksheet('📋 Ficha de Risco', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  })

  ws.columns = [
    { width: 2.36 }, { width: 34 }, { width: 20 }, { width: 22 },
    { width: 20 }, { width: 22 }, { width: 20 }, { width: 10 }, { width: 28 },
  ]

  const now = new Date()
  const dtStr = now.toLocaleDateString('pt-BR') + ' · ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  ws.mergeCells(1, 2, 1, 9)
  const h1 = ws.getCell(1, 2)
  h1.value = '          Polímata · Consultoria em GRC'
  h1.font = fontBase({ bold: true, color: { argb: CREAM } })
  h1.fill = fillSolid(NAVY)
  h1.alignment = { horizontal: 'left', vertical: 'middle' }
  h1.border = allHair
  ws.getRow(1).height = 15

  ws.mergeCells(2, 2, 2, 9)
  const h2 = ws.getCell(2, 2)
  h2.value = '          FICHA DE RISCO — EXECUÇÃO DO TESTE'
  h2.font = fontBase({ bold: true, color: { argb: GOLD } })
  h2.fill = fillSolid(NAVY)
  h2.alignment = { horizontal: 'left', vertical: 'middle' }
  h2.border = allHair
  ws.getRow(2).height = 15

  ws.getRow(3).height = 5

  applySection(ws, 4, '1. DADOS DO PROJETO')
  applyRow(ws, 5,  'CLIENTE',             formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || '—', false)
  applyRow(ws, 6,  'NATUREZA DO PROJETO', projeto?.nome || '—',           false)
  applyRow(ws, 7,  'FASE EM CURSO',       'F2-E1 — Teste de Desenho',   false, { valueBold: true, valueColor: COPPER })
  applyRow(ws, 8,  'EXECUTOR',            perfil?.nome || '—',            false)
  applyRow(ws, 9,  'DATA E HORÁRIO',      dtStr,                          false)
  applyRow(ws, 10, 'DOWNLOAD POR',        perfil?.email || '—',           false)
  applyRow(ws, 11, 'REVISOR',             '',                             true)
  applyRow(ws, 12, 'DATA DA REVISÃO',     '',                             true)
  ws.getRow(13).height = 5

  applySection(ws, 14, '2. IDENTIFICAÇÃO DO RISCO E CONTROLE')
  applyRow(ws, 15, 'ÁREA / PROCESSO',      row.area || '—',                          false)
  applyRow(ws, 16, 'SUBPROCESSO',          row.sub  || '—',                          false)
  applyRow(ws, 17, 'REF. RISCO',           row.rr   || '—',                          false, { valueBold: true, valueColor: COPPER })
  applyRow(ws, 18, 'REF. CONTROLE',        row.rc   || '—',                          false, { valueBold: true, valueColor: COPPER })
  applyRow(ws, 19, 'GERÊNCIA',             row.ger  || '—',                          false)
  applyRow(ws, 20, 'RESP. PROCESSO',    row.resp_sub || '—',                      false)
  applyRow(ws, 21, 'DESCRIÇÃO DO RISCO',   novaDescRisco || row.dr || '—',           false)
  applyRow(ws, 22, 'DESCRIÇÃO DO CONTROLE',novaDescControle || row.dc || '—',        false)
  ws.getRow(23).height = 5

  applySection(ws, 24, '3. ATRIBUTOS DO CONTROLE')
  applyRow(ws, 25, 'CATEGORIA',       editCat   || row.cat   || '—', false)
  applyRow(ws, 26, 'FREQUÊNCIA',      editFreq  || row.freq  || '—', false)
  applyRow(ws, 27, 'NATUREZA',        editNat   || row.nat   || '—', false)
  applyRow(ws, 28, 'CARACTERÍSTICA',  editCar   || row.car   || '—', false)
  applyRow(ws, 29, 'SISTEMA',         editSis   || row.sis   || '—', false)
  applyRow(ws, 30, 'CONTROLE CHAVE?', editChave || row.chave || '—', false)
  ws.getRow(31).height = 5

  applySection(ws, 32, '4. AS 6 PREMISSAS DO CONTROLE — VALIDAÇÃO METODOLÓGICA')
  applyRow(ws, 33, '1. QUEM FAZ',         isAutomatic ? 'N/A (Controle Automatizado)' : (quem || row.premissa_quem || ''),  true)
  applyRow(ws, 34, '2. QUANDO FAZ',       quando    || row.premissa_quando    || '', true)
  applyRow(ws, 35, '3. POR QUÊ FAZ',      pq        || row.premissa_porque    || '', true)
  applyRow(ws, 36, '4. COMO FAZ',         como      || row.premissa_como      || '', true)
  applyRow(ws, 37, '5. ONDE FAZ',         onde      || row.premissa_onde      || '', true)
  applyRow(ws, 38, '6. QUAL O RESULTADO', resultado || row.premissa_resultado || '', true)
  ws.getRow(39).height = 5

  applySection(ws, 40, '5. PASSOS DE TESTE')

  ws.mergeCells(41, 2, 41, 7)
  const ph1 = ws.getCell(41, 2)
  ph1.value = 'Atividade / Passo'
  ph1.font = fontBase({ bold: true, color: { argb: CREAM } })
  ph1.fill = fillSolid(NAVY)
  ph1.alignment = { horizontal: 'left', vertical: 'middle' }
  ph1.border = allHair

  const ph2 = ws.getCell(41, 8)
  ph2.value = '✓ / ✗'
  ph2.font = fontBase({ bold: true, color: { argb: CREAM } })
  ph2.fill = fillSolid(NAVY)
  ph2.alignment = { horizontal: 'center', vertical: 'middle' }
  ph2.border = allHair

  const ph3 = ws.getCell(41, 9)
  ph3.value = 'Observação'
  ph3.font = fontBase({ bold: true, color: { argb: CREAM } })
  ph3.fill = fillSolid(NAVY)
  ph3.alignment = { horizontal: 'left', vertical: 'middle' }
  ph3.border = allHair
  ws.getRow(41).height = 15

  ws.mergeCells(42, 2, 42, 9)
  const leg = ws.getCell(42, 2)
  leg.value = '✓ = Teste realizado com sucesso · ✗ = Não foi possível realizar o teste'
  leg.font = fontBase({ color: { argb: GRAY99 } })
  leg.fill = fillSolid(WHITE)
  leg.alignment = { horizontal: 'left', vertical: 'middle' }
  leg.border = allHair
  ws.getRow(42).height = 15

  for (let i = 0; i < 10; i++) {
    const r = 43 + i
    ws.mergeCells(r, 2, r, 7)
    const pc = ws.getCell(r, 2)
    pc.value = `Passo ${i + 1}`
    pc.font = fontBase({ color: { argb: GRAYBB } })
    pc.fill = fillSolid(WHITE)
    pc.alignment = alignVCWrap
    pc.border = allHair

    const hc = ws.getCell(r, 8)
    hc.value = ''
    hc.fill = fillSolid(WHITE)
    hc.alignment = { horizontal: 'center', vertical: 'middle' }
    hc.border = allHair

    const oc = ws.getCell(r, 9)
    oc.value = ''
    oc.fill = fillSolid(WHITE)
    oc.alignment = alignVCWrap
    oc.border = allHair
    ws.getRow(r).height = 15
  }

  ws.dataValidations.add('H43:H52', {
    type: 'list',
    allowBlank: true,
    formulae: ['"✓,✗"'],
    showDropDown: false,
  })

  ws.getRow(53).height = 5
  ws.getRow(54).height = 5

  applySection(ws, 55, '6. RESULTADO')
  applyRow(ws, 56, 'RESULTADO',                  '', true, { labelFill: CREAM })
  applyRow(ws, 57, 'INCONSISTÊNCIA IDENTIFICADA','', true, { labelFill: CREAM })
  applyRow(ws, 58, 'MELHORIA IDENTIFICADA?',     '', true, { labelFill: CREAM })
  applyRow(ws, 59, 'DESCRIÇÃO DA MELHORIA',      '', true, { labelFill: CREAM })

  ws.dataValidations.add('C56:I56', {
    type: 'list',
    allowBlank: true,
    formulae: ['"Efetivo,Inefetivo,GAP"'],
    showDropDown: false,
  })

  ws.dataValidations.add('C58:I58', {
    type: 'list',
    allowBlank: true,
    formulae: ['"Sim,Não"'],
    showDropDown: false,
  })

  ws.mergeCells(60, 2, 60, 9)
  const nota = ws.getCell(60, 2)
  nota.value = '↑ Preencher apenas quando "Melhoria Identificada?" = Sim'
  nota.font = fontBase({ color: { argb: GRAY99 } })
  nota.fill = fillSolid(WHITE)
  nota.alignment = { horizontal: 'left', vertical: 'middle' }
  nota.border = allHair
  ws.getRow(60).height = 15

  ws.mergeCells(61, 2, 61, 5)
  const ft1 = ws.getCell(61, 2)
  ft1.value = 'Polímata Consultoria em GRC · Ficha de Risco'
  ft1.font = fontBase({ size: 7, color: { argb: NAVY } })
  ft1.fill = fillSolid(CREAM)
  ft1.alignment = alignVC
  ft1.border = allHair

  ws.mergeCells(61, 6, 61, 9)
  const ft2 = ws.getCell(61, 6)
  ft2.value = `Gerado em: ${dtStr} · Por: ${perfil?.email || ''}`
  ft2.font = fontBase({ size: 7, color: { argb: NAVY } })
  ft2.fill = fillSolid(CREAM)
  ft2.alignment = { horizontal: 'right', vertical: 'middle' }
  ft2.border = allHair
  ws.getRow(61).height = 15

  const passosFicha = (passos || []).filter(pp => (pp.descricao || '').trim() !== '')
  const ws2 = workbook.addWorksheet('Teste', { views: [{ showGridLines: false }] })
  ws2.columns = [
    { width: 2.36 }, { width: 5 }, { width: 50 }, { width: 50 }, { width: 50 }, { width: 16 },
  ]
  ws2.mergeCells(2, 2, 2, 6)
  const t1 = ws2.getCell(2, 2)
  t1.value = '7. EXECUÇÃO DO TESTE E EVIDÊNCIAS'
  t1.font = fontBase({ bold: true, color: { argb: GOLD } })
  t1.fill = fillSolid(NAVY)
  t1.alignment = { horizontal: 'left', vertical: 'middle' }
  ws2.getRow(2).height = 15

  const hdr = ['#', 'Passo do Teste', 'Documentação Solicitada', 'Evidência / Observação', 'Solicitação?']
  hdr.forEach((h, idx) => {
    const cell = ws2.getCell(4, 2 + idx)
    cell.value = h
    cell.font = fontBase({ bold: true, color: { argb: CREAM } })
    cell.fill = fillSolid(NAVY)
    cell.alignment = { horizontal: idx === 0 ? 'center' : 'left', vertical: 'middle', wrapText: true }
    cell.border = allHair
  })
  ws2.getRow(4).height = 18

  if (passosFicha.length === 0) {
    ws2.mergeCells(5, 2, 5, 6)
    const v = ws2.getCell(5, 2)
    v.value = 'Nenhum passo de teste cadastrado para este controle.'
    v.font = fontBase({ color: { argb: GRAY99 }, italic: true })
    v.alignment = { vertical: 'middle' }
    v.border = allHair
    ws2.getRow(5).height = 22
  } else {
    passosFicha.forEach((pp, idx) => {
      const r = 5 + idx
      const cellNum = ws2.getCell(r, 2)
      cellNum.value = idx + 1
      cellNum.font = fontBase({ bold: true, color: { argb: NAVY } })
      cellNum.alignment = { horizontal: 'center', vertical: 'middle' }
      cellNum.border = allHair
      cellNum.fill = fillSolid(F8)

      const cellDesc = ws2.getCell(r, 3)
      cellDesc.value = pp.descricao || ''
      cellDesc.font = fontBase({ color: { argb: GRAY33 } })
      cellDesc.alignment = alignVCWrap
      cellDesc.border = allHair
      cellDesc.fill = fillSolid(F8)

      const cellDoc = ws2.getCell(r, 4)
      cellDoc.value = pp.documentacao_solicitada || ''
      cellDoc.font = fontBase({ color: { argb: GRAY33 } })
      cellDoc.alignment = alignVCWrap
      cellDoc.border = allHair
      cellDoc.fill = fillSolid(F8)

      const cellEv = ws2.getCell(r, 5)
      cellEv.value = ''
      cellEv.font = fontBase({ color: { argb: GRAY33 } })
      cellEv.alignment = alignVCWrap
      cellEv.border = { ...allHair, left: { style: 'thin', color: { argb: BGRAY } } }
      cellEv.fill = fillSolid(WHITE)

      const cellSol = ws2.getCell(r, 6)
      cellSol.value = pp.gerar_solicitacao ? 'Sim' : 'Não'
      cellSol.font = fontBase({ bold: !!pp.gerar_solicitacao, color: { argb: pp.gerar_solicitacao ? COPPER : GRAY99 } })
      cellSol.alignment = { horizontal: 'center', vertical: 'middle' }
      cellSol.border = allHair
      cellSol.fill = fillSolid(F8)

      const maiorTexto = Math.max((pp.descricao || '').length, (pp.documentacao_solicitada || '').length)
      const linhas = Math.max(2, Math.ceil(maiorTexto / 60))
      ws2.getRow(r).height = Math.max(38, linhas * 16)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Ficha_de_Risco_${row.rc || 'controle'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { blob, filename: a.download }
}
