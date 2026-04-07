import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ExcelJS from 'exceljs'

const ModalAtualizar = ({ row, onClose, onSaved, areas, projeto }) => {
  // ═══ STATE ═══
  const [step, setStep] = useState(1)
  const [statusChoice, setStatusChoice] = useState(null)
  const [newStatus, setNewStatus] = useState(null)
  const [descChoice, setDescChoice] = useState(null)
  const [ctrlDescChoice, setCtrlDescChoice] = useState(null)
  const [motivoInativacao, setMotivoInativacao] = useState('')
  const [novaDescRisco, setNovaDescRisco] = useState('')
  const [novaDescControle, setNovaDescControle] = useState('')
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState(null)

  // Control fields (Step 2)
  const [editCat, setEditCat] = useState(row.cat || '')
  const [editFreq, setEditFreq] = useState(row.freq || '')
  const [editNat, setEditNat] = useState(row.nat || '')
  const [editCar, setEditCar] = useState(row.car || '')
  const [editSis, setEditSis] = useState(row.sis || '')
  const [editChave, setEditChave] = useState(row.chave || '')

  // Premissas (Step 2)
  const [pq, setPq] = useState(row.premissa_porque || '')
  const [quando, setQuando] = useState(row.premissa_quando || '')
  const [onde, setOnde] = useState(row.premissa_onde || '')
  const [quem, setQuem] = useState(row.premissa_quem || '')
  const [como, setComo] = useState(row.premissa_como || '')
  const [resultado, setResultado] = useState(row.premissa_resultado || '')

  // Auxiliary data
  const [areaDestino, setAreaDestino] = useState('')
  const [subDestino, setSubDestino] = useState('')
  const [subprocessosDestino, setSubprocessosDestino] = useState([])

  useEffect(() => {
    loadPerfil()
  }, [])

  async function loadPerfil() {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      setPerfil(profile)
    }
  }

  async function loadSubprocessosDestino(areaId) {
    if (!areaId) {
      setSubprocessosDestino([])
      return
    }
    const { data } = await supabase
      .from('mrc')
      .select('sub')
      .eq('area_id', areaId)
      .eq('projeto_id', row.projeto_id)
      .eq('ativo', true)
    if (data) {
      const unique = [...new Set(data.map(d => d.sub).filter(Boolean))].sort()
      setSubprocessosDestino(unique)
    }
  }

  // ═══ LOGIC ═══
  const isAutomatic = editCar === 'Automatizado'
  const isEndFlow = statusChoice === 'sim' && (newStatus === 'evitado' || newStatus === 'transferido')

  // Validação Step 1
  const canAdvanceStep1 = (() => {
    if (statusChoice === null) return false
    if (statusChoice === 'sim') {
      if (!newStatus) return false
      if (newStatus === 'evitado' && !motivoInativacao.trim()) return false
      if (newStatus === 'transferido' && (!areaDestino || !subDestino)) return false
    }
    if (statusChoice === 'nao') {
      if (descChoice === null) return false
      if (descChoice === 'sim' && !novaDescRisco.trim()) return false
    }
    return true
  })()

  // Validação Step 2
  const canAdvanceStep2 = (() => {
    if (ctrlDescChoice === null) return false
    if (ctrlDescChoice === 'sim') {
      if (!novaDescControle.trim()) return false
      if (!editCat || !editFreq || !editNat || !editCar || !editSis || !editChave) return false
      if (!isAutomatic && !quem.trim()) return false
      if (!quando.trim() || !pq.trim() || !como.trim() || !onde.trim() || !resultado.trim()) return false
    }
    return true
  })()

  function nextStep() {
    if (step < 3) setStep(step + 1)
  }

  function prevStep() {
    if (step > 1) setStep(step - 1)
  }

  // ═══ SAVE FUNCTIONS ═══
  async function handleEvitar() {
    if (!motivoInativacao.trim()) return alert('Preencha a justificativa.')
    setSaving(true)
    try {
      await supabase.from('mrc').update({
        status_risco: 'evitado',
        motivo_inativacao: motivoInativacao,
        ativo: false,
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }).eq('id', row.id)
      onSaved && onSaved()
      onClose && onClose()
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTransferido() {
    if (!areaDestino || !subDestino) return alert('Preencha área e subprocesso de destino.')
    setSaving(true)
    try {
      // Criar novo risco/controle na área destino
      const novaRef = `${row.rr.split('.')[0]}.${areaDestino.substring(0, 3).toUpperCase()}.${Date.now().toString().slice(-3)}`
      await supabase.from('mrc').insert({
        projeto_id: row.projeto_id,
        area_id: areaDestino,
        rr: novaRef,
        rc: novaRef.replace('R.', 'C.'),
        sub: subDestino,
        ger: row.ger,
        resp_sub: row.resp_sub,
        dr: row.dr,
        dc: row.dc,
        imp: row.imp,
        prob: row.prob,
        crit: row.crit,
        status_risco: 'existente',
        ativo: true,
        transferido_de: row.id,
      })
      // Inativar original
      await supabase.from('mrc').update({
        status_risco: 'transferido',
        ativo: false,
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }).eq('id', row.id)
      onSaved && onSaved()
      onClose && onClose()
    } catch (err) {
      alert('Erro ao transferir: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFicha() {
    setSaving(true)
    try {
      const updates = {
        dr: novaDescRisco || row.dr,
        dc: novaDescControle || row.dc,
        cat: editCat,
        freq: editFreq,
        nat: editNat,
        car: editCar,
        sis: editSis,
        chave: editChave,
        premissa_porque: pq,
        premissa_quando: quando,
        premissa_onde: onde,
        premissa_quem: isAutomatic ? 'N/A' : quem,
        premissa_como: como,
        premissa_resultado: resultado,
        status_workflow: 'em_analise',
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      await supabase.from('mrc').update(updates).eq('id', row.id)
      await gerarFichaExcel()
      onSaved && onSaved()
      onClose && onClose()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function gerarFichaExcel() {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Polímata GRC'
    workbook.created = new Date()

    const NAVY   = 'FF00203E'
    const GOLD   = 'FFCC915E'
    const CREAM  = 'FFF3EEE4'
    const F8     = 'FFF8F6F2'
    const WHITE  = 'FFFFFFFF'
    const GRAY33 = 'FF333333'
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

    function applyRow(ws, r, labelText, valueText, editable = false) {
      // Label
      const lc = ws.getCell(r, 2)
      lc.value = labelText
      lc.font = fontBase({ bold: true, color: { argb: NAVY } })
      lc.fill = fillSolid(WHITE)
      lc.alignment = alignVC
      lc.border = allHair
      // Value
      ws.mergeCells(r, 3, r, 9)
      const vc = ws.getCell(r, 3)
      vc.value = valueText || ''
      vc.font = fontBase({ color: { argb: GRAY33 } })
      vc.fill = fillSolid(editable ? WHITE : F8)
      vc.alignment = alignVCWrap
      vc.border = {
        ...allHair,
        left: { style: editable ? 'thin' : 'medium', color: { argb: editable ? BGRAY : GOLD } }
      }
      ws.getRow(r).height = 15
    }

    // ── ABA PRINCIPAL ──
    const ws = workbook.addWorksheet('📋 Ficha de Risco', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ showGridLines: false }],
    })

    // Larguras — col A = 2.36 (medida Excel), B-I conforme modelo
    ws.columns = [
      { width: 2.36 }, { width: 34 }, { width: 20 }, { width: 22 },
      { width: 20 }, { width: 22 }, { width: 20 }, { width: 10 }, { width: 28 },
    ]

    const now = new Date()
    const dtStr = now.toLocaleDateString('pt-BR') + ' · ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    // ── Linhas 1-2: Header ──
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

    // ── Bloco 1: DADOS DO PROJETO (4-12) ──
    applySection(ws, 4, '1. DADOS DO PROJETO')
    applyRow(ws, 5,  'CLIENTE',             projeto?.clientes?.nome || '—', false)
    applyRow(ws, 6,  'NATUREZA DO PROJETO', projeto?.nome || '—',           false)
    applyRow(ws, 7,  'FASE EM CURSO',       'F2-E1 — Plano de Ação',        false)
    applyRow(ws, 8,  'EXECUTOR',            perfil?.nome || '—',            false)
    applyRow(ws, 9,  'DATA E HORÁRIO',      dtStr,                          false)
    applyRow(ws, 10, 'DOWNLOAD POR',        perfil?.email || '—',           false)
    applyRow(ws, 11, 'REVISOR',             '',                             true)
    applyRow(ws, 12, 'DATA DA REVISÃO',     '',                             true)
    ws.getRow(13).height = 5

    // ── Bloco 2: IDENTIFICAÇÃO (14-22) ──
    applySection(ws, 14, '2. IDENTIFICAÇÃO DO RISCO E CONTROLE')
    applyRow(ws, 15, 'ÁREA / PROCESSO',      row.area || '—',                          false)
    applyRow(ws, 16, 'SUBPROCESSO',          row.sub  || '—',                          false)
    applyRow(ws, 17, 'REF. RISCO',           row.rr   || '—',                          false)
    applyRow(ws, 18, 'REF. CONTROLE',        row.rc   || '—',                          false)
    applyRow(ws, 19, 'GERÊNCIA',             row.ger  || '—',                          false)
    applyRow(ws, 20, 'RESP. SUBPROCESSO',    row.resp_sub || '—',                      false)
    applyRow(ws, 21, 'DESCRIÇÃO DO RISCO',   novaDescRisco || row.dr || '—',           false)
    applyRow(ws, 22, 'DESCRIÇÃO DO CONTROLE',novaDescControle || row.dc || '—',        false)
    ws.getRow(23).height = 5

    // ── Bloco 3: ATRIBUTOS (24-30) ──
    applySection(ws, 24, '3. ATRIBUTOS DO CONTROLE')
    applyRow(ws, 25, 'CATEGORIA',       editCat   || row.cat   || '—', false)
    applyRow(ws, 26, 'FREQUÊNCIA',      editFreq  || row.freq  || '—', false)
    applyRow(ws, 27, 'NATUREZA',        editNat   || row.nat   || '—', false)
    applyRow(ws, 28, 'CARACTERÍSTICA',  editCar   || row.car   || '—', false)
    applyRow(ws, 29, 'SISTEMA',         editSis   || row.sis   || '—', false)
    applyRow(ws, 30, 'CONTROLE CHAVE?', editChave || row.chave || '—', false)
    ws.getRow(31).height = 5

    // ── Bloco 4: PREMISSAS (32-38) ──
    applySection(ws, 32, '4. AS 6 PREMISSAS DO CONTROLE — VALIDAÇÃO METODOLÓGICA')
    applyRow(ws, 33, '1. QUEM FAZ',         isAutomatic ? 'N/A (Controle Automatizado)' : (quem || row.premissa_quem || ''),  true)
    applyRow(ws, 34, '2. QUANDO FAZ',       quando    || row.premissa_quando    || '', true)
    applyRow(ws, 35, '3. POR QUÊ FAZ',      pq        || row.premissa_porque    || '', true)
    applyRow(ws, 36, '4. COMO FAZ',         como      || row.premissa_como      || '', true)
    applyRow(ws, 37, '5. ONDE FAZ',         onde      || row.premissa_onde      || '', true)
    applyRow(ws, 38, '6. QUAL O RESULTADO', resultado || row.premissa_resultado || '', true)
    ws.getRow(39).height = 5

    // ── Bloco 5: PASSOS DE TESTE (40-52) ──
    applySection(ws, 40, '5. PASSOS DE TESTE')

    // Header linha 41
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

    // Legenda linha 42
    ws.mergeCells(42, 2, 42, 9)
    const leg = ws.getCell(42, 2)
    leg.value = '✓ = Teste realizado com sucesso · ✗ = Não foi possível realizar o teste'
    leg.font = fontBase({ size: 8, color: { argb: GOLD } })
    leg.fill = fillSolid(F8)
    leg.alignment = { horizontal: 'center', vertical: 'middle' }
    leg.border = allHair
    ws.getRow(42).height = 15

    // 10 passos (43-52)
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

    // Validação lista ✓/✗ em H43:H52
    ws.dataValidations.add({
      type: 'list',
      allowBlank: true,
      sqref: 'H43:H52',
      formulae: ['"✓,✗"'],
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Selecione ✓ ou ✗',
    })

    ws.getRow(53).height = 5
    ws.getRow(54).height = 5

    // ── Bloco 6: RESULTADO (55-60) ──
    applySection(ws, 55, '6. RESULTADO')
    applyRow(ws, 56, 'RESULTADO',                  '', true)
    applyRow(ws, 57, 'INCONSISTÊNCIA IDENTIFICADA','', true)
    applyRow(ws, 58, 'MELHORIA IDENTIFICADA?',     '', true)
    applyRow(ws, 59, 'DESCRIÇÃO DA MELHORIA',      '', true)

    // Validação Resultado C56:I56
    ws.dataValidations.add({
      type: 'list',
      allowBlank: true,
      sqref: 'C56:I56',
      formulae: ['"Efetivo,Inefetivo,GAP"'],
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Selecione Efetivo, Inefetivo ou GAP',
    })

    // Validação Melhoria C58:I58
    ws.dataValidations.add({
      type: 'list',
      allowBlank: true,
      sqref: 'C58:I58',
      formulae: ['"Sim,Não"'],
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Selecione Sim ou Não',
    })

    // Nota linha 60
    ws.mergeCells(60, 2, 60, 9)
    const nota = ws.getCell(60, 2)
    nota.value = '↑ Preencher apenas quando "Melhoria Identificada?" = Sim'
    nota.font = fontBase({ size: 8, color: { argb: GOLD } })
    nota.fill = fillSolid(F8)
    nota.alignment = { horizontal: 'left', vertical: 'middle' }
    nota.border = allHair
    ws.getRow(60).height = 15

    // ── Linha 61: Footer ──
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

    // ── Logo ícone embutido em base64 ──
    try {
      const LOGO_B64 = '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'
      const byteStr = atob(LOGO_B64)
      const bytes = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
      const imgId = workbook.addImage({ buffer: bytes.buffer, extension: 'png' })
      ws.addImage(imgId, {
        tl: { col: 1, row: 0 },
        ext: { width: 30, height: 30 },
        editAs: 'oneCell',
      })
    } catch (_) {}

    // ── Aba Teste ──
    const ws2 = workbook.addWorksheet('Teste', { views: [{ showGridLines: false }] })
    ws2.columns = [{ width: 2.36 }, { width: 13 }]
    ws2.mergeCells(2, 2, 2, 18)
    const t1 = ws2.getCell(2, 2)
    t1.value = '7. EXECUÇÃO DO TESTE E EVIDÊNCIAS'
    t1.font = fontBase({ bold: true, color: { argb: GOLD } })
    t1.fill = fillSolid(NAVY)
    t1.alignment = { horizontal: 'left', vertical: 'middle' }
    ws2.getRow(2).height = 15

    // ── Download ──
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
  }

  async function handleSaveSemFicha() {
    setSaving(true)
    try {
      const updates = {
        dr: novaDescRisco || row.dr,
        dc: novaDescControle || row.dc,
        cat: editCat,
        freq: editFreq,
        nat: editNat,
        car: editCar,
        sis: editSis,
        chave: editChave,
        premissa_porque: pq,
        premissa_quando: quando,
        premissa_onde: onde,
        premissa_quem: isAutomatic ? 'N/A' : quem,
        premissa_como: como,
        premissa_resultado: resultado,
        status_workflow: 'teste_pendente',
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      await supabase.from('mrc').update(updates).eq('id', row.id)
      alert('✅ Salvo com sucesso! Status: TESTE PENDENTE')
      onSaved && onSaved()
      onClose && onClose()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ═══ RENDER STEP 1 ═══
  const renderStep1 = () => (
    <div>
      {/* Context Card */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Risco</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rr}</div>
          </div>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Fase Atual</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>F1 · Diagnóstico</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Resultado</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>Efetivo</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Risco</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 6, lineHeight: 1.6 }}>{row.dr}</div>
        </div>
      </div>

      {/* Q1: Status */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Houve alteração no status do risco?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button
            style={{
              padding: 12,
              border: statusChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: statusChoice === 'nao' ? '#00203E' : '#fafbfc',
              color: statusChoice === 'nao' ? 'white' : '#333',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setStatusChoice('nao')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Não</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: statusChoice === 'nao' ? 0.9 : 0.6, fontWeight: 500 }}>mantém existente</div>
          </button>
          <button
            style={{
              padding: 12,
              border: statusChoice === 'sim' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: statusChoice === 'sim' ? '#00203E' : '#fafbfc',
              color: statusChoice === 'sim' ? 'white' : '#333',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setStatusChoice('sim')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>⚡</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sim</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: statusChoice === 'sim' ? 0.9 : 0.6, fontWeight: 500 }}>alterou status</div>
          </button>
        </div>
      </div>

      {/* Sub: Nova Status */}
      {statusChoice === 'sim' && (
        <div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Qual o novo status do risco?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  padding: 12,
                  border: newStatus === 'evitado' ? '2px solid #EF4444' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: newStatus === 'evitado' ? '#EF4444' : '#fafbfc',
                  color: newStatus === 'evitado' ? 'white' : '#333',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setNewStatus('evitado')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>🚫</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Evitado</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: newStatus === 'evitado' ? 0.9 : 0.6, fontWeight: 500 }}>descontinuar</div>
              </button>
              <button
                style={{
                  padding: 12,
                  border: newStatus === 'transferido' ? '2px solid #F59E0B' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: newStatus === 'transferido' ? '#F59E0B' : '#fafbfc',
                  color: newStatus === 'transferido' ? 'white' : '#333',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setNewStatus('transferido')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>↗</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Transferido</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: newStatus === 'transferido' ? 0.9 : 0.6, fontWeight: 500 }}>mover para outra área</div>
              </button>
            </div>
          </div>

          {/* Evitado */}
          {newStatus === 'evitado' && (
            <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
              <div style={{ background: '#FEE2E2', borderLeft: '3px solid #EF4444', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#991B1B' }}>
                <strong>⚠️ Atenção:</strong> Ao marcar como evitado, a linha será <strong>inativada</strong> e a referência {row.rr} ficará disponível para reutilização. O controle {row.rc} também será inativado.
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Justificativa da descontinuação *</label>
                <textarea
                  value={motivoInativacao}
                  onChange={(e) => setMotivoInativacao(e.target.value)}
                  placeholder="Explique por que o risco foi evitado..."
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: 12,
                    marginBottom: 16,
                  }}
                />
              </div>
            </div>
          )}

          {/* Transferido */}
          {newStatus === 'transferido' && (
            <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
              <div style={{ background: '#DBEAFE', borderLeft: '3px solid #3B82F6', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#1E40AF' }}>
                <strong>ℹ️ Informação:</strong> O risco e seu controle serão copiados para a área de destino com nova referência. A linha original será inativada.
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
                  Destino da transferência
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Área de destino *</label>
                    <select
                      value={areaDestino}
                      onChange={(e) => {
                        setAreaDestino(e.target.value)
                        loadSubprocessosDestino(e.target.value)
                        setSubDestino('')
                      }}
                      style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                    >
                      <option value="">Selecione a área...</option>
                      {areas && areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Subprocesso *</label>
                    <select
                      value={subDestino}
                      onChange={(e) => setSubDestino(e.target.value)}
                      disabled={!areaDestino}
                      style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12, opacity: !areaDestino ? 0.5 : 1 }}
                    >
                      <option value="">Selecione o subprocesso...</option>
                      {subprocessosDestino && subprocessosDestino.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Q2: Descritivo (se status = nao) */}
      {statusChoice === 'nao' && (
        <div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Houve alteração no descritivo do risco?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  padding: 12,
                  border: descChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: descChoice === 'nao' ? '#00203E' : '#fafbfc',
                  color: descChoice === 'nao' ? 'white' : '#333',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setDescChoice('nao')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Não</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: descChoice === 'nao' ? 0.9 : 0.6, fontWeight: 500 }}>manter como está</div>
              </button>
              <button
                style={{
                  padding: 12,
                  border: descChoice === 'sim' ? '2px solid #00203E' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: descChoice === 'sim' ? '#00203E' : '#fafbfc',
                  color: descChoice === 'sim' ? 'white' : '#333',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setDescChoice('sim')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>✎</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Sim</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: descChoice === 'sim' ? 0.9 : 0.6, fontWeight: 500 }}>houve alteração</div>
              </button>
            </div>
          </div>

          {descChoice === 'sim' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
                Editar descritivo do risco
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Nova descrição do risco</label>
              <textarea
                value={novaDescRisco}
                onChange={(e) => setNovaDescRisco(e.target.value)}
                placeholder="Descreva o novo risco..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 10,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 12,
                  marginBottom: 16,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ═══ RENDER STEP 2 ═══
  const renderStep2 = () => (
    <div>
      {/* Context Card */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Área</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.area}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Controle</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 6, lineHeight: 1.6 }}>{row.dc}</div>
        </div>
      </div>

      {/* Q: Descritivo */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Houve alteração no descritivo do controle?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            style={{
              padding: 12,
              border: ctrlDescChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: ctrlDescChoice === 'nao' ? '#00203E' : '#fafbfc',
              color: ctrlDescChoice === 'nao' ? 'white' : '#333',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setCtrlDescChoice('nao')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Não</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: ctrlDescChoice === 'nao' ? 0.9 : 0.6, fontWeight: 500 }}>manter como está</div>
          </button>
          <button
            style={{
              padding: 12,
              border: ctrlDescChoice === 'sim' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: ctrlDescChoice === 'sim' ? '#00203E' : '#fafbfc',
              color: ctrlDescChoice === 'sim' ? 'white' : '#333',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setCtrlDescChoice('sim')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>✎</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sim</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: ctrlDescChoice === 'sim' ? 0.9 : 0.6, fontWeight: 500 }}>houve alteração</div>
          </button>
        </div>
      </div>

      {/* Se sim: Edit e Características e Premissas */}
      {ctrlDescChoice === 'sim' && (
        <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
          <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
            Editar descritivo do controle
          </div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Nova descrição do controle</label>
          <textarea
            value={novaDescControle}
            onChange={(e) => setNovaDescControle(e.target.value)}
            placeholder="Descreva o novo controle..."
            style={{
              width: '100%',
              minHeight: 80,
              padding: 10,
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 12,
              marginBottom: 16,
            }}
          />

          {/* CARACTERÍSTICAS */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
              Características do Controle
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Categoria *</label>
                <select value={editCat} onChange={(e) => setEditCat(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Autorização</option>
                  <option>Relatórios de Exceção</option>
                  <option>Indicadores de Performance</option>
                  <option>Interface/Conversão</option>
                  <option>Revisão Gerencial</option>
                  <option>Reconciliação</option>
                  <option>Acesso</option>
                  <option>Segregação de Funções</option>
                  <option>Configuração</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Frequência *</label>
                <select value={editFreq} onChange={(e) => setEditFreq(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Sob demanda</option>
                  <option>Diário</option>
                  <option>Múltiplas vezes ao dia</option>
                  <option>Semanal</option>
                  <option>Quinzenal</option>
                  <option>Mensal</option>
                  <option>Trimestral</option>
                  <option>Semestral</option>
                  <option>Anual</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Natureza *</label>
                <select value={editNat} onChange={(e) => setEditNat(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Preventivo</option>
                  <option>Detectivo</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Característica *</label>
                <select value={editCar} onChange={(e) => setEditCar(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Manual</option>
                  <option>Semi-Automatizado</option>
                  <option>Automatizado</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Sistema *</label>
                <select value={editSis} onChange={(e) => setEditSis(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>IBID</option>
                  <option>Fluig</option>
                  <option>Totvs Data Sul</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Controle Chave *</label>
                <select value={editChave} onChange={(e) => setEditChave(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Controle Chave</option>
                  <option>Controle Compensatório</option>
                  <option>N/A</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6 PREMISSAS */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
              6 Premissas do Controle
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>1. Quem faz? *</label>
                <textarea
                  value={quem}
                  onChange={(e) => setQuem(e.target.value)}
                  disabled={isAutomatic}
                  placeholder={isAutomatic ? 'N/A (Controle Automatizado)' : 'Responsável...'}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: 12,
                    opacity: isAutomatic ? 0.5 : 1,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>2. Quando faz? *</label>
                <textarea
                  value={quando}
                  onChange={(e) => setQuando(e.target.value)}
                  placeholder="Periodicidade..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>3. Por quê faz? *</label>
                <textarea
                  value={pq}
                  onChange={(e) => setPq(e.target.value)}
                  placeholder="Justificativa..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>4. Como faz? *</label>
                <textarea
                  value={como}
                  onChange={(e) => setComo(e.target.value)}
                  placeholder="Procedimento..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>5. Onde faz? *</label>
                <textarea
                  value={onde}
                  onChange={(e) => setOnde(e.target.value)}
                  placeholder="Local..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>6. Qual o resultado? *</label>
                <textarea
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  placeholder="Resultado esperado..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ═══ RENDER STEP 3 ═══
  const renderStep3 = () => (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#00203E', marginBottom: 16 }}>Dados que serão incluídos na ficha</h3>

      <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Descrição do Risco</div>
          <div style={{ color: '#666' }}>{novaDescRisco || row.dr}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Descrição do Controle</div>
          <div style={{ color: '#666' }}>{novaDescControle || row.dc}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Categoria</div>
          <div style={{ color: '#666' }}>{editCat || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Frequência</div>
          <div style={{ color: '#666' }}>{editFreq || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Natureza</div>
          <div style={{ color: '#666' }}>{editNat || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Característica</div>
          <div style={{ color: '#666' }}>{editCar || '—'}</div>
        </div>
      </div>

      <div style={{ background: '#00203E', color: 'white', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>📊</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Salvar e Baixar Ficha de Risco</h3>
          <p style={{ fontSize: 11, opacity: 0.9 }}>Ficha_de_Risco_{row.rc}.xlsx — pré-preenchida com os dados acima. Salva as alterações e baixa a ficha automaticamente.</p>
        </div>
        <button
          onClick={handleSaveFicha}
          disabled={saving}
          style={{ background: '#CC915E', color: 'white', padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', marginLeft: 'auto' }}
        >
          .XLSX
        </button>
      </div>

      <div style={{ background: '#e5e7eb', border: '2px dashed #9ca3af', padding: 16, borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#1f2937', fontWeight: 600, marginBottom: 8 }}>💾 Salvar sem gerar ficha</p>
        <p style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}>Salva as alterações, mas o teste ficará marcado como pendente.</p>
        <button
          onClick={handleSaveSemFicha}
          disabled={saving}
          style={{ marginTop: 8, background: '#6b7280', color: 'white', border: '1px solid #4b5563', padding: '8px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Salvar sem Ficha
        </button>
      </div>

      <div style={{ background: '#FEF3C7', borderLeft: '3px solid #F59E0B', padding: 12, borderRadius: 6, fontSize: 12, color: '#92400E' }}>
        <strong>📌 Importante:</strong> Ao salvar com ficha, o controle receberá o status <strong>EM ANÁLISE</strong> até que o resultado do teste seja registrado. Ao salvar sem ficha, o controle será marcado como <strong>TESTE PENDENTE</strong>.
      </div>
    </div>
  )

  // ═══ MAIN RENDER ═══
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)', maxWidth: 700, width: '90vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#00203E', color: 'white' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Atualizar Controle</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{row.rc} · {row.area}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 28, color: 'white', cursor: 'pointer' }}>×</button>
        </div>

        {/* STEPPER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', gap: 0 }}>
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: s < step ? '#1B5E20' : s === step ? '#00203E' : '#e5e7eb',
                    color: s < step || s === step ? 'white' : '#999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {s < step ? '✓' : s}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s < step || s === step ? '#00203E' : '#999', textAlign: 'center' }}>
                  {s === 1 ? 'Risco' : s === 2 ? 'Controle' : 'Executar Teste'}
                </div>
              </div>
              {s < 3 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', marginTop: -20 }}></div>}
            </React.Fragment>
          ))}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: 24, overflow: 'y', overflowY: 'auto' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', gap: 8, padding: 24, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E' }}
          >
            Cancelar
          </button>

          {isEndFlow ? (
            <button
              onClick={() => {
                if (newStatus === 'evitado') handleEvitar()
                else if (newStatus === 'transferido') handleTransferido()
              }}
              disabled={saving}
              style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white' }}
            >
              {saving ? 'Salvando...' : newStatus === 'evitado' ? 'Inativar' : 'Transferir'}
            </button>
          ) : (
            <>
              <button
                onClick={prevStep}
                disabled={step === 1}
                style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E', opacity: step === 1 ? 0.5 : 1 }}
              >
                ← Voltar
              </button>
              <button
                onClick={nextStep}
                disabled={step === 1 ? !canAdvanceStep1 : step === 2 ? !canAdvanceStep2 : false}
                style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: (step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) ? 0.5 : 1 }}
              >
                {step === 3 ? 'Finalizar' : 'Próximo →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModalAtualizar
