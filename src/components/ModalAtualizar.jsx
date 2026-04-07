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
    const ws = workbook.addWorksheet('Ficha de Risco', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      views: [{ showGridLines: false }],
    })

    // Cores
    const NAVY = '00203E'
    const GOLD = 'CC915E'
    const CREAM = 'F8F6F2'
    const GRAY_BORDER = 'D1D5DB'
    const WHITE = 'FFFFFF'

    // Larguras das colunas
    ws.columns = [
      { width: 3 },   // A - margem
      { width: 22 },  // B - label
      { width: 30 },  // C - valor 1
      { width: 3 },   // D - separador
      { width: 22 },  // E - label
      { width: 30 },  // F - valor 2
      { width: 3 },   // G - margem
    ]

    let row_num = 1

    // ── Helpers ──
    function cell(r, c) { return ws.getCell(r, c) }
    function merge(r1, c1, r2, c2) { ws.mergeCells(r1, c1, r2, c2) }
    function setH(r, h) { ws.getRow(r).height = h }
    function label(r, c, text) {
      const cel = cell(r, c)
      cel.value = text
      cel.font = { name: 'Calibri', bold: true, color: { argb: 'FF' + NAVY }, size: 9 }
      cel.alignment = { vertical: 'middle', horizontal: 'left' }
    }
    function valor(r, c, text, editable = false) {
      const cel = cell(r, c)
      cel.value = text || ''
      cel.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } }
      cel.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (editable ? WHITE : CREAM) } }
      if (!editable) {
        cel.border = { left: { style: 'medium', color: { argb: 'FF' + GOLD } } }
      } else {
        cel.border = {
          top: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } },
          bottom: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } },
          left: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } },
          right: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } },
        }
      }
    }
    function secTitle(r, text) {
      merge(r, 1, r, 7)
      const cel = cell(r, 1)
      cel.value = text
      cel.font = { name: 'Calibri', bold: true, color: { argb: 'FF' + WHITE }, size: 10 }
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
      cel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      setH(r, 22)
    }
    function blankRow(r, h = 6) { merge(r, 1, r, 7); setH(r, h) }

    // ── HEADER ──
    // Tentar carregar logo
    try {
      const resp = await fetch('/logotipo-2cores.png')
      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        const imgId = workbook.addImage({ buffer: buf, extension: 'png' })
        merge(1, 1, 3, 2)
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 3 }, editAs: 'oneCell' })
      }
    } catch (_) {}

    merge(1, 3, 1, 7)
    const hdr1 = cell(1, 3)
    hdr1.value = 'Polímata · Consultoria em GRC'
    hdr1.font = { name: 'Calibri', bold: true, color: { argb: 'FF' + NAVY }, size: 11 }
    hdr1.alignment = { vertical: 'bottom', horizontal: 'left' }

    merge(2, 3, 2, 7)
    const hdr2 = cell(2, 3)
    hdr2.value = 'FICHA DE RISCO — EXECUÇÃO DO TESTE'
    hdr2.font = { name: 'Calibri', bold: true, color: { argb: 'FF' + GOLD }, size: 14 }
    hdr2.alignment = { vertical: 'middle', horizontal: 'left' }

    merge(3, 3, 3, 7)
    const hdr3 = cell(3, 3)
    hdr3.value = `Referência: ${row.rr || '—'}  ·  Controle: ${row.rc || '—'}`
    hdr3.font = { name: 'Calibri', color: { argb: 'FF666666' }, size: 9 }
    hdr3.alignment = { vertical: 'top', horizontal: 'left' }

    setH(1, 24); setH(2, 28); setH(3, 18)
    row_num = 4

    blankRow(row_num); row_num++

    // ── BLOCO 1: PROJETO ──
    secTitle(row_num, '1. PROJETO'); row_num++
    const now = new Date()
    const dtStr = now.toLocaleDateString('pt-BR') + ' · ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const projetoData = [
      ['CLIENTE', projeto?.clientes?.nome || '—', 'EXECUTOR', perfil?.nome || '—'],
      ['NATUREZA DO PROJETO', projeto?.nome || '—', 'DATA E HORÁRIO', dtStr],
      ['FASE EM CURSO', 'F2-E1 — Plano de Ação e Aderência', 'DOWNLOAD POR', perfil?.email || '—'],
      ['REVISOR', '', 'DATA DA REVISÃO', ''],
    ]

    for (const [l1, v1, l2, v2] of projetoData) {
      label(row_num, 2, l1)
      merge(row_num, 3, row_num, 3); valor(row_num, 3, v1)
      label(row_num, 5, l2)
      merge(row_num, 6, row_num, 6); valor(row_num, 6, v2, l1 === 'REVISOR')
      setH(row_num, 18)
      row_num++
    }
    blankRow(row_num); row_num++

    // ── BLOCO 2: IDENTIFICAÇÃO ──
    secTitle(row_num, '2. IDENTIFICAÇÃO DO RISCO E CONTROLE'); row_num++

    const idData = [
      ['ÁREA', row.area || '—', 'SUBPROCESSO', row.sub || '—'],
      ['REF. RISCO', row.rr || '—', 'REF. CONTROLE', row.rc || '—'],
      ['GERÊNCIA', row.ger || '—', 'RESP. SUBPROCESSO', row.resp_sub || '—'],
    ]
    for (const [l1, v1, l2, v2] of idData) {
      label(row_num, 2, l1); valor(row_num, 3, v1)
      label(row_num, 5, l2); valor(row_num, 6, v2)
      setH(row_num, 18); row_num++
    }

    // Desc. Risco (full width)
    label(row_num, 2, 'DESCRIÇÃO DO RISCO')
    merge(row_num, 3, row_num, 6); valor(row_num, 3, novaDescRisco || row.dr)
    setH(row_num, 40); row_num++

    label(row_num, 2, 'DESCRIÇÃO DO CONTROLE')
    merge(row_num, 3, row_num, 6); valor(row_num, 3, novaDescControle || row.dc)
    setH(row_num, 40); row_num++
    blankRow(row_num); row_num++

    // ── BLOCO 3: ATRIBUTOS ──
    secTitle(row_num, '3. ATRIBUTOS DO CONTROLE'); row_num++
    const atribData = [
      ['CATEGORIA', editCat || row.cat || '—', 'FREQUÊNCIA', editFreq || row.freq || '—'],
      ['NATUREZA', editNat || row.nat || '—', 'CARACTERÍSTICA', editCar || row.car || '—'],
      ['SISTEMA / FERRAMENTA', editSis || row.sis || '—', 'CONTROLE CHAVE?', editChave || row.chave || '—'],
    ]
    for (const [l1, v1, l2, v2] of atribData) {
      label(row_num, 2, l1); valor(row_num, 3, v1)
      label(row_num, 5, l2); valor(row_num, 6, v2)
      setH(row_num, 18); row_num++
    }
    blankRow(row_num); row_num++

    // ── BLOCO 4: PREMISSAS ──
    secTitle(row_num, '4. PREMISSAS DO CONTROLE'); row_num++
    const premissas = [
      ['1. QUEM FAZ?', isAutomatic ? 'N/A (Controle Automatizado)' : (quem || row.premissa_quem || '')],
      ['2. QUANDO FAZ?', quando || row.premissa_quando || ''],
      ['3. POR QUÊ FAZ?', pq || row.premissa_porque || ''],
      ['4. COMO FAZ?', como || row.premissa_como || ''],
      ['5. ONDE FAZ?', onde || row.premissa_onde || ''],
      ['6. QUAL O RESULTADO?', resultado || row.premissa_resultado || ''],
    ]
    for (const [lbl, val] of premissas) {
      label(row_num, 2, lbl)
      merge(row_num, 3, row_num, 6); valor(row_num, 3, val, true)
      setH(row_num, 42); row_num++
    }
    blankRow(row_num); row_num++

    // ── BLOCO 5: PASSOS DE TESTE ──
    secTitle(row_num, '5. PASSOS DE TESTE'); row_num++

    // Header passos
    const passoHdrCells = [[2, 'ATIVIDADE / PASSO'], [5, 'RESULTADO'], [6, 'OBSERVAÇÃO']]
    for (const [col, txt] of passoHdrCells) {
      const c = cell(row_num, col)
      c.value = txt
      c.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3B5C' } }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
    }
    merge(row_num, 2, row_num, 4)
    setH(row_num, 18); row_num++

    for (let i = 1; i <= 10; i++) {
      merge(row_num, 2, row_num, 4)
      const pCell = cell(row_num, 2)
      pCell.value = `${i}.`
      pCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } }
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + WHITE } }
      pCell.border = { top: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, bottom: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, left: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, right: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } } }
      pCell.alignment = { vertical: 'top', wrapText: true }

      const rCell = cell(row_num, 5)
      rCell.value = ''
      rCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
      rCell.border = { top: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, bottom: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, left: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, right: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } } }
      rCell.alignment = { vertical: 'middle', horizontal: 'center' }

      const oCell = cell(row_num, 6)
      oCell.value = ''
      oCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
      oCell.border = { top: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, bottom: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, left: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, right: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } } }
      oCell.alignment = { vertical: 'top', wrapText: true }

      setH(row_num, 36); row_num++
    }
    blankRow(row_num); row_num++

    // ── BLOCO 6: RESULTADO ──
    secTitle(row_num, '6. RESULTADO DO TESTE'); row_num++
    const resultFields = [
      ['RESULTADO GERAL', '', true],
      ['INCONSISTÊNCIA IDENTIFICADA', '', true],
      ['MELHORIA IDENTIFICADA?', '', true],
      ['DESCRIÇÃO DA MELHORIA', '', true],
    ]
    for (const [lbl, val, ed] of resultFields) {
      label(row_num, 2, lbl)
      merge(row_num, 3, row_num, 6); valor(row_num, 3, val, ed)
      setH(row_num, 36); row_num++
    }
    blankRow(row_num); row_num++

    // ── BLOCO 7: EVIDÊNCIAS ──
    secTitle(row_num, '7. EVIDÊNCIAS'); row_num++
    merge(row_num, 2, row_num + 3, 6)
    const evCell = cell(row_num, 2)
    evCell.value = 'Descreva ou liste as evidências coletadas durante o teste...'
    evCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFAAAAAA' } }
    evCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    evCell.border = { top: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, bottom: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, left: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } }, right: { style: 'thin', color: { argb: 'FF' + GRAY_BORDER } } }
    evCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 }
    setH(row_num, 36); setH(row_num + 1, 36); setH(row_num + 2, 36); setH(row_num + 3, 36)
    row_num += 4
    blankRow(row_num); row_num++

    // ── FOOTER ──
    merge(row_num, 1, row_num, 7)
    const ftr = cell(row_num, 1)
    ftr.value = `Polímata Consultoria em GRC  ·  Gerado em ${dtStr}  ·  ${perfil?.email || ''}`
    ftr.font = { name: 'Calibri', size: 8, color: { argb: 'FF999999' } }
    ftr.alignment = { vertical: 'middle', horizontal: 'center' }
    ftr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEE4' } }
    setH(row_num, 16)

    // ── DOWNLOAD ──
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = \`Ficha_de_Risco_\${row.rc || 'controle'}_\${new Date().toISOString().slice(0, 10)}.xlsx\`
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
