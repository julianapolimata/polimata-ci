import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ExcelJS from 'exceljs'
import HistoricoTab from './HistoricoTab'
import { logAtualizarControle, logBaixarFicha } from '../lib/auditLog'
import { formatNomeEmpresa } from '../lib/formatNome'

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
  const [showHistorico, setShowHistorico] = useState(false)

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
      logAtualizarControle(row, row.projeto_id)
      logBaixarFicha(row, row.projeto_id)
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
      // Label
      const lc = ws.getCell(r, 2)
      lc.value = labelText
      lc.font = fontBase({ bold: true, color: { argb: NAVY } })
      lc.fill = fillSolid(opts.labelFill || WHITE)
      lc.alignment = alignVC
      lc.border = allHair
      // Value
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
    applyRow(ws, 5,  'CLIENTE',             formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || '—', false)
    applyRow(ws, 6,  'NATUREZA DO PROJETO', projeto?.nome || '—',           false)
    applyRow(ws, 7,  'FASE EM CURSO',       'F2-E1 — Teste de Desenho',   false, { valueBold: true, valueColor: COPPER })
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
    applyRow(ws, 17, 'REF. RISCO',           row.rr   || '—',                          false, { valueBold: true, valueColor: COPPER })
    applyRow(ws, 18, 'REF. CONTROLE',        row.rc   || '—',                          false, { valueBold: true, valueColor: COPPER })
    applyRow(ws, 19, 'GERÊNCIA',             row.ger  || '—',                          false)
    applyRow(ws, 20, 'RESP. PROCESSO',    row.resp_sub || '—',                      false)
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
    leg.font = fontBase({ color: { argb: GRAY99 } })
    leg.fill = fillSolid(WHITE)
    leg.alignment = { horizontal: 'left', vertical: 'middle' }
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
    ws.dataValidations.add('H43:H52', {
      type: 'list',
      allowBlank: true,
      formulae: ['"✓,✗"'],
      showDropDown: false,
    })

    ws.getRow(53).height = 5
    ws.getRow(54).height = 5

    // ── Bloco 6: RESULTADO (55-60) ──
    applySection(ws, 55, '6. RESULTADO')
    applyRow(ws, 56, 'RESULTADO',                  '', true, { labelFill: CREAM })
    applyRow(ws, 57, 'INCONSISTÊNCIA IDENTIFICADA','', true, { labelFill: CREAM })
    applyRow(ws, 58, 'MELHORIA IDENTIFICADA?',     '', true, { labelFill: CREAM })
    applyRow(ws, 59, 'DESCRIÇÃO DA MELHORIA',      '', true, { labelFill: CREAM })

    // Validação Resultado C56:I56
    ws.dataValidations.add('C56:I56', {
      type: 'list',
      allowBlank: true,
      formulae: ['"Efetivo,Inefetivo,GAP"'],
      showDropDown: false,
    })

    // Validação Melhoria C58:I58
    ws.dataValidations.add('C58:I58', {
      type: 'list',
      allowBlank: true,
      formulae: ['"Sim,Não"'],
      showDropDown: false,
    })

    // Nota linha 60
    ws.mergeCells(60, 2, 60, 9)
    const nota = ws.getCell(60, 2)
    nota.value = '↑ Preencher apenas quando "Melhoria Identificada?" = Sim'
    nota.font = fontBase({ color: { argb: GRAY99 } })
    nota.fill = fillSolid(WHITE)
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
      logAtualizarControle(row, row.projeto_id)
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
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Risco</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rr}</div>
          </div>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Fase Atual</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>F1 · Diagnóstico</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Resultado</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>Efetivo</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Risco</div>
          <div style={{ fontSize: 12, color: '#00203E', marginTop: 6, lineHeight: 1.6 }}>{row.dr}</div>
        </div>
      </div>

      {/* Q1: Situação do Risco */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 2 }}>Houve alteração na situação do risco?</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>A situação pode ser: existente, evitado ou transferido.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button
            style={{
              padding: 12,
              border: statusChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: statusChoice === 'nao' ? '#00203E' : '#fafbfc',
              color: statusChoice === 'nao' ? 'white' : '#00203E',
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
              color: statusChoice === 'sim' ? 'white' : '#00203E',
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Qual a nova situação do risco?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  padding: 12,
                  border: newStatus === 'evitado' ? '2px solid #EF4444' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: newStatus === 'evitado' ? '#EF4444' : '#fafbfc',
                  color: newStatus === 'evitado' ? 'white' : '#00203E',
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
                  color: newStatus === 'transferido' ? 'white' : '#00203E',
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
                  color: descChoice === 'nao' ? 'white' : '#00203E',
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
                  color: descChoice === 'sim' ? 'white' : '#00203E',
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
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Área</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.area}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Controle</div>
          <div style={{ fontSize: 12, color: '#00203E', marginTop: 6, lineHeight: 1.6 }}>{row.dc}</div>
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
              color: ctrlDescChoice === 'nao' ? 'white' : '#00203E',
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
              color: ctrlDescChoice === 'sim' ? 'white' : '#00203E',
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
          <div style={{ color: '#7A8B9C' }}>{novaDescRisco || row.dr}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Descrição do Controle</div>
          <div style={{ color: '#7A8B9C' }}>{novaDescControle || row.dc}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Categoria</div>
          <div style={{ color: '#7A8B9C' }}>{editCat || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Frequência</div>
          <div style={{ color: '#7A8B9C' }}>{editFreq || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Natureza</div>
          <div style={{ color: '#7A8B9C' }}>{editNat || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Característica</div>
          <div style={{ color: '#7A8B9C' }}>{editCar || '—'}</div>
        </div>
      </div>

      <div
        onClick={!saving ? handleSaveFicha : undefined}
        style={{ background: '#00203E', color: 'white', padding: 16, borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, cursor: saving ? 'wait' : 'pointer', transition: 'opacity .15s', opacity: saving ? 0.6 : 1 }}
      >
        <div style={{ background: '#CC915E', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>.XLSX</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Salvar e Baixar Ficha de Risco</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Ficha_de_Risco_{row.rc}.xlsx — pré-preenchida com os dados acima. Salva as alterações e baixa a ficha automaticamente.</div>
        </div>
      </div>

      <div
        onClick={!saving ? handleSaveSemFicha : undefined}
        style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: saving ? 'wait' : 'pointer', transition: 'opacity .15s', opacity: saving ? 0.6 : 1 }}
      >
        <div style={{ background: '#6b7280', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>💾</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 2 }}>Salvar sem gerar ficha</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Salva as alterações, mas o teste ficará marcado como pendente.</div>
        </div>
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
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#00203E', color: 'white' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper-soft)', marginBottom: 4 }}>Matriz de Riscos · Controle</div>
            <div style={{ fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3, lineHeight: 1.2 }}>Atualizar Controle</div>
            <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.72, marginTop: 4 }}>{row.rc} · {row.area}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowHistorico(h => !h)}
              style={{
                background: showHistorico ? 'rgba(255,255,255,0.2)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
                padding: '5px 12px', fontSize: 11, fontWeight: 600, color: 'white',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              {showHistorico ? '← Voltar' : '📋 Histórico'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 28, color: 'white', cursor: 'pointer' }}>×</button>
          </div>
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
          {showHistorico ? (
            <HistoricoTab registroId={row.id} />
          ) : (
            <>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </>
          )}
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
              {step < 3 && (
                <button
                  onClick={nextStep}
                  disabled={step === 1 ? !canAdvanceStep1 : step === 2 ? !canAdvanceStep2 : false}
                  style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: (step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) ? 0.5 : 1 }}
                >
                  Próximo →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModalAtualizar
