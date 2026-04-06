import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ExcelJS from 'exceljs'
import ModalRegressaoControle from './ModalRegressaoControle'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIAS = ['Autorização','Relatórios de Exceção','Indicadores de Performance','Interface/Conversão','Revisão Gerencial','Reconciliação','Acesso','Segregação de Funções','Configuração','N/A']
const FREQUENCIAS = ['Sob demanda','Diário','Múltiplas vezes ao dia','Semanal','Quinzenal','Mensal','Trimestral','Semestral','Anual','N/A']
const NATUREZAS = ['Preventivo','Detectivo','N/A']
const CARACTERISTICAS = ['Manual','Semi-Automatizado','Automatizado','N/A']
const SISTEMAS = ['IBID','Fluig','Totvs Data Sul','N/A']
const CTRL_CHAVE = ['Sim','Não','N/A']

const PREMISSAS = [
  { key: 'premissa_porque', title: 'Por quê?', placeholder: 'Propósito do controle...', tooltip: 'Qual o propósito desta atividade? O que ela agrega ao processo? Descreva a razão de existir deste controle.' },
  { key: 'premissa_quando', title: 'Quando?', placeholder: 'Frequência de execução...', tooltip: 'Com qual frequência esta atividade deve ser realizada? Diariamente, semanalmente, sob demanda, etc.' },
  { key: 'premissa_onde', title: 'Onde?', placeholder: 'Local de registro...', tooltip: 'Em qual local essa atividade fica registrada? Sistema, planilha, documento físico, plataforma, etc.' },
  { key: 'premissa_quem', title: 'Quem?', placeholder: 'Responsável pela execução...', tooltip: 'No processo, quem é o responsável por executar esta atividade? Cargo ou nome do responsável. Desabilitado para controles automatizados.', disableOnAuto: true },
  { key: 'premissa_como', title: 'Como?', placeholder: 'Passo a passo...', tooltip: 'Qual o passo a passo para realizar esta atividade? Descreva o procedimento de execução do controle.' },
  { key: 'premissa_resultado', title: 'Qual o resultado?', placeholder: 'Produto final esperado...', tooltip: 'Qual o "produto final" gerado por esta atividade? Relatório, aprovação, registro, evidência, etc.' },
]

function isEfetivo(r) { return (r || '').toLowerCase() === 'efetivo' }

function getProximaFase(row) {
  // F1 Efetivo → atalho F3
  if (!row.r3 && !row.r_ader && !row.st_pa) {
    if (isEfetivo(row.r1)) return { label: 'F3 — Controles Internos', cls: 'f3' }
    return { label: 'F2-E1 — Plano de Ação', cls: 'f2' }
  }
  if (row.st_pa && !row.r_ader) {
    return { label: 'F2-E2 — Teste de Aderência', cls: 'f2' }
  }
  if (row.r_ader && !row.r3) {
    if (isEfetivo(row.r_ader)) return { label: 'F3 — Controles Internos', cls: 'f3' }
    return { label: 'F2-E1 — Plano de Ação', cls: 'f2' }
  }
  if (row.r3) {
    if (isEfetivo(row.r3)) return { label: 'F4 — Auditoria Contínua', cls: 'f4' }
    return { label: 'F2-E1 — Plano de Ação', cls: 'f2' }
  }
  return { label: 'F1 — Diagnóstico', cls: 'f1' }
}

function getFaseAtualLabel(row) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado') return 'F3 — Controles Internos'
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado') return 'F2-E2 — Teste de Aderência'
  if (row.st_pa && row.st_pa !== '') return 'F2-E1 — Plano de Ação'
  return 'F1 — Diagnóstico'
}

function getResultadoAtual(row) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado') return row.r3
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado') return row.r_ader
  if (row.r1 && row.r1 !== 'Teste Não Realizado') return row.r1
  return 'Teste Não Realizado'
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ModalAtualizar({ row, onClose, onSaved, areas, projeto }) {
  const { perfil } = useAuth()
  const projetoId = projeto?.id

  // Steps
  const [step, setStep] = useState(1)

  // Step 1
  const [riscoChoice, setRiscoChoice] = useState(null) // 'nao' | 'sim'
  const [statusChoice, setStatusChoice] = useState(null) // 'existente' | 'evitado' | 'transferido'
  const [showRegressao, setShowRegressao] = useState(false)
  const [novaDescRisco, setNovaDescRisco] = useState(row.dr || '')
  const [motivoInativacao, setMotivoInativacao] = useState('')
  const [areaDestino, setAreaDestino] = useState('')
  const [subDestino, setSubDestino] = useState('')
  const [gerDestino, setGerDestino] = useState('')
  const [respDestino, setRespDestino] = useState('')

  // Step 2
  const [controleChoice, setControleChoice] = useState(null) // 'nao' | 'sim'
  const [editDc, setEditDc] = useState(row.dc || '')
  const [editCat, setEditCat] = useState(row.cat || 'N/A')
  const [editFreq, setEditFreq] = useState(row.freq || 'N/A')
  const [editNat, setEditNat] = useState(row.nat || 'N/A')
  const [editCar, setEditCar] = useState(row.car || 'N/A')
  const [editSis, setEditSis] = useState(row.sis || 'N/A')
  const [editChave, setEditChave] = useState(row.chave || 'N/A')
  const [premissas, setPremissas] = useState({
    premissa_porque: row.premissa_porque || '',
    premissa_quando: row.premissa_quando || '',
    premissa_onde: row.premissa_onde || '',
    premissa_quem: row.premissa_quem || '',
    premissa_como: row.premissa_como || '',
    premissa_resultado: row.premissa_resultado || '',
  })

  // Step 3
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // ────────────────────────────────────────────────────────────────────────────
  // HELPERS & LÓGICA
  // ────────────────────────────────────────────────────────────────────────────

  function logAudit(mrcId, campo, valAnterior, valNovo) {
    return supabase.from('mrc_audit_log').insert({
      mrc_id: mrcId,
      campo,
      valor_anterior: String(valAnterior || ''),
      valor_novo: String(valNovo || ''),
      usuario_id: perfil?.id,
      criado_em: new Date().toISOString(),
    })
  }

  // Detectar regressão: se controle estava aprovado/em_analise e agora será marcado como inefetivo
  function detectarRegressao() {
    const statusAnterior = row.status_workflow
    const eraEfetivo = statusAnterior === 'aprovado' || statusAnterior === 'em_analise'
    return eraEfetivo
  }

  // ────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ────────────────────────────────────────────────────────────────────────────

  async function handleEvitado() {
    setSalvando(true)
    await supabase.from('mrc').update({
      status_risco: 'evitado',
      ativo: false,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id,
    }).eq('id', row.id)
    await logAudit(row.id, 'status_risco', 'existente', 'evitado')
    await logAudit(row.id, 'ativo', 'true', 'false')
    setSalvando(false)
    onSaved?.()
    onClose()
  }

  async function handleTransferido() {
    setSalvando(true)
    await supabase.from('mrc').update({
      status_risco: 'transferido',
      ativo: false,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id,
    }).eq('id', row.id)
    await logAudit(row.id, 'status_risco', 'existente', 'transferido')
    await logAudit(row.id, 'ativo', 'true', 'false')
    setSalvando(false)
    onSaved?.()
    onClose()
  }

  async function handleSalvarComFicha() {
    const ok = await salvarAlteracoes('em_analise')
    if (ok) gerarFichaExcel()
  }

  async function handleSalvarSemFicha() {
    await salvarAlteracoes('teste_pendente')
  }

  async function salvarAlteracoes(statusWorkflow) {
    setSalvando(true)
    const updates = {
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id,
      status_workflow: statusWorkflow,
    }

    // Step 1: risco editado
    if (riscoChoice === 'sim' && statusChoice === 'existente') {
      if (novaDescRisco !== row.dr) {
        updates.dr = novaDescRisco
        await logAudit(row.id, 'dr', row.dr, novaDescRisco)
      }
    }

    // Step 2: controle editado
    if (controleChoice === 'sim') {
      const campos = { dc: editDc, cat: editCat, freq: editFreq, nat: editNat, car: editCar, sis: editSis, chave: editChave }
      for (const [campo, valor] of Object.entries(campos)) {
        if (valor !== row[campo]) {
          updates[campo] = valor
          await logAudit(row.id, campo, row[campo], valor)
        }
      }
      // Premissas
      for (const p of PREMISSAS) {
        const val = premissas[p.key]
        if (val !== (row[p.key] || '')) {
          updates[p.key] = val
          await logAudit(row.id, p.key, row[p.key] || '', val)
        }
      }
    }

    const { error } = await supabase.from('mrc').update(updates).eq('id', row.id)
    if (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar: ' + error.message)
      setSalvando(false)
      return false
    }
    setSalvando(false)
    onSaved?.()
    onClose()
    return true
  }

  async function gerarFichaExcel() {
    const dc = controleChoice === 'sim' ? editDc : row.dc
    const dr = (riscoChoice === 'sim' && statusChoice === 'existente') ? novaDescRisco : row.dr
    const cat = controleChoice === 'sim' ? editCat : row.cat
    const freq = controleChoice === 'sim' ? editFreq : row.freq
    const nat = controleChoice === 'sim' ? editNat : row.nat
    const car = controleChoice === 'sim' ? editCar : row.car
    const sis = controleChoice === 'sim' ? editSis : row.sis
    const chave = controleChoice === 'sim' ? editChave : row.chave
    const agora = new Date()
    const dataHora = agora.toLocaleDateString('pt-BR') + ' · ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'CI Polímata'
    wb.created = agora

    const NAVY = '00203E', GOLD = 'CC915E', GOLD_DARK = 'A6512F', CREAM = 'F3EEE4'
    const PRE_BG = 'F8F6F2', BORDER_GRAY = 'D5CFC6', BORDER_LIGHT = 'F0EDE8', WHITE = 'FFFFFF'

    // ═══ ABA 1: FICHA DE RISCO ═══
    const ws = wb.addWorksheet('📋 Ficha de Risco', {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
    })

    ws.getColumn('A').width = 3
    ws.getColumn('B').width = 34
    ws.getColumn('C').width = 20
    ws.getColumn('D').width = 22
    ws.getColumn('E').width = 20
    ws.getColumn('F').width = 22
    ws.getColumn('G').width = 20
    ws.getColumn('H').width = 10
    ws.getColumn('I').width = 28

    const bH = { top: { style: 'hair', color: { argb: BORDER_LIGHT } }, bottom: { style: 'hair', color: { argb: BORDER_LIGHT } }, left: { style: 'hair', color: { argb: BORDER_LIGHT } }, right: { style: 'hair', color: { argb: BORDER_LIGHT } } }
    const fN = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    const fP = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRE_BG } }
    const fC = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }
    const fW = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } }

    // Fonts — tudo size 10, Montserrat, SEM itálico
    const flLabel = { name: 'Montserrat', size: 10, bold: true, color: { argb: NAVY } }
    const fvValue = { name: 'Montserrat', size: 10, color: { argb: '333333' } }
    const fgGold = { name: 'Montserrat', size: 10, bold: true, color: { argb: GOLD_DARK } }
    const fhHint = { name: 'Montserrat', size: 10, color: { argb: '999999' } }
    const fsSection = { name: 'Montserrat', size: 10, bold: true, color: { argb: GOLD } }
    const fdDim = { name: 'Montserrat', size: 10, color: { argb: 'BBBBBB' } }

    // Helper: section header (navy bar with gold text)
    function sec(r, t) {
      ws.mergeCells(`B${r}:I${r}`)
      const c = ws.getCell(`B${r}`); c.value = t; c.font = fsSection; c.fill = fN
      c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      c.border = { bottom: { style: 'thin', color: { argb: GOLD } } }
    }
    // Helper: pre-filled row (label white + value #F8F6F2 with gold left border)
    function pre(r, l, v) {
      ws.getCell(`B${r}`).value = l; ws.getCell(`B${r}`).font = flLabel; ws.getCell(`B${r}`).fill = fW
      ws.getCell(`B${r}`).alignment = { vertical: 'middle', indent: 1 }; ws.getCell(`B${r}`).border = bH
      ws.mergeCells(`C${r}:I${r}`)
      const c = ws.getCell(`C${r}`); c.value = v || ''; c.font = fvValue; c.fill = fP
      c.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
      c.border = { ...bH, left: { style: 'medium', color: { argb: GOLD } } }
    }
    // Helper: reference row (gold bold text)
    function refR(r, l, v) {
      ws.getCell(`B${r}`).value = l; ws.getCell(`B${r}`).font = flLabel; ws.getCell(`B${r}`).fill = fW
      ws.getCell(`B${r}`).alignment = { vertical: 'middle', indent: 1 }; ws.getCell(`B${r}`).border = bH
      ws.mergeCells(`C${r}:I${r}`)
      const c = ws.getCell(`C${r}`); c.value = v || ''; c.font = fgGold; c.fill = fP
      c.alignment = { vertical: 'middle', indent: 1 }
      c.border = { ...bH, left: { style: 'medium', color: { argb: GOLD } } }
    }
    // Helper: editable row (label white + value white with gray left border)
    function edit(r, l, p) {
      ws.getCell(`B${r}`).value = l; ws.getCell(`B${r}`).font = flLabel; ws.getCell(`B${r}`).fill = fW
      ws.getCell(`B${r}`).alignment = { vertical: 'middle', indent: 1 }; ws.getCell(`B${r}`).border = bH
      ws.mergeCells(`C${r}:I${r}`)
      const c = ws.getCell(`C${r}`); c.value = p || ''; c.font = fdDim; c.fill = fW
      c.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
      c.border = { ...bH, left: { style: 'thin', color: { argb: BORDER_GRAY } } }
    }
    // Helper: resultado row (label creme + value white with gold left border)
    function resRow(r, l) {
      ws.getCell(`B${r}`).value = l; ws.getCell(`B${r}`).font = flLabel; ws.getCell(`B${r}`).fill = fC
      ws.getCell(`B${r}`).alignment = { vertical: 'middle', indent: 1 }; ws.getCell(`B${r}`).border = bH
      ws.mergeCells(`C${r}:I${r}`)
      const c = ws.getCell(`C${r}`); c.value = ''; c.font = fvValue; c.fill = fW
      c.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
      c.border = { ...bH, left: { style: 'medium', color: { argb: GOLD } } }
    }

    // ═══ HEADER (rows 1-2) ═══
    let r = 1

    // Logo (ícone dourado)
    try {
      const logoResp = await fetch('/icon.png')
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob()
        const logoBuffer = await logoBlob.arrayBuffer()
        const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
        ws.addImage(logoId, { tl: { col: 1, row: 0 }, ext: { width: 42, height: 42 } })
      }
    } catch (e) { /* logo não disponível */ }

    ws.mergeCells(`B${r}:I${r}`)
    ws.getCell(`B${r}`).value = '          Polímata · Consultoria em GRC'
    ws.getCell(`B${r}`).font = { name: 'Montserrat', size: 10, bold: true, color: { argb: CREAM } }
    ws.getCell(`B${r}`).fill = fN; ws.getCell(`B${r}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    r++

    ws.mergeCells(`B${r}:I${r}`)
    ws.getCell(`B${r}`).value = '          FICHA DE RISCO — EXECUÇÃO DO TESTE'
    ws.getCell(`B${r}`).font = { name: 'Montserrat', size: 10, bold: true, color: { argb: GOLD } }
    ws.getCell(`B${r}`).fill = fN; ws.getCell(`B${r}`).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getCell(`B${r}`).border = { bottom: { style: 'medium', color: { argb: GOLD } } }
    r++

    // Row 3: blank spacer
    r++

    // ═══ 1. DADOS DO PROJETO ═══
    sec(r, '1. DADOS DO PROJETO'); r++
    pre(r, 'CLIENTE', projeto?.clientes?.nome || 'Cliente'); r++
    pre(r, 'NATUREZA DO PROJETO', projeto?.nome || 'Projeto'); r++
    pre(r, 'FASE EM CURSO', getProximaFase(row).label); r++
    pre(r, 'EXECUTOR', perfil?.nome || 'Executor'); r++
    pre(r, 'DATA E HORÁRIO', dataHora); r++
    pre(r, 'DOWNLOAD POR', perfil?.email || 'Email'); r++
    edit(r, 'REVISOR', ''); r++
    edit(r, 'DATA DA REVISÃO', ''); r++

    r++

    // ═══ 2. IDENTIFICAÇÃO ═══
    sec(r, '2. IDENTIFICAÇÃO DO RISCO E CONTROLE'); r++
    pre(r, 'ÁREA', row.area || ''); r++
    pre(r, 'SUBPROCESSO', row.sub || ''); r++
    refR(r, 'REF. RISCO', row.rr); r++
    refR(r, 'REF. CONTROLE', row.rc); r++
    pre(r, 'GERÊNCIA', row.ger || ''); r++
    pre(r, 'RESP. SUBPROCESSO', row.resp_sub || ''); r++
    pre(r, 'DESC. RISCO', row.dr || ''); r++
    pre(r, 'DESC. CONTROLE', dc); r++

    r++

    // ═══ 3. ATRIBUTOS ═══
    sec(r, '3. ATRIBUTOS'); r++
    pre(r, 'CATEGORIA', cat); r++
    pre(r, 'FREQUÊNCIA', freq); r++
    pre(r, 'NATUREZA', nat); r++
    pre(r, 'CARACTERÍSTICA', car); r++
    pre(r, 'SISTEMA/FERRAMENTA', sis); r++
    pre(r, 'CONTROLE CHAVE?', chave); r++

    r++

    // ═══ 4. PREMISSAS ═══
    sec(r, '4. PREMISSAS DO CONTROLE'); r++
    const premissasTitles = [
      { k: 'premissa_porque', t: 'POR QUÊ?' },
      { k: 'premissa_quando', t: 'QUANDO?' },
      { k: 'premissa_onde', t: 'ONDE?' },
      { k: 'premissa_quem', t: 'QUEM?' },
      { k: 'premissa_como', t: 'COMO?' },
      { k: 'premissa_resultado', t: 'QUAL O RESULTADO?' },
    ]
    for (const p of premissasTitles) {
      edit(r, p.t, premissas[p.k] || row[p.k] || ''); r++
    }

    r++

    // ═══ 5. PASSOS DE TESTE ═══
    sec(r, '5. PASSOS DE TESTE (10 ATIVIDADES)'); r++
    ws.getCell(`B${r}`).value = 'ATIVIDADE/PASSO'
    ws.getCell(`B${r}`).font = flLabel
    ws.getCell(`B${r}`).fill = fP
    ws.getCell(`B${r}`).border = bH
    ws.getCell(`B${r}`).alignment = { vertical: 'middle', indent: 1 }
    ws.mergeCells(`C${r}:D${r}`)
    ws.getCell(`C${r}`).value = 'RESULTADO'
    ws.getCell(`C${r}`).font = flLabel
    ws.getCell(`C${r}`).fill = fP
    ws.getCell(`C${r}`).border = bH
    ws.getCell(`C${r}`).alignment = { vertical: 'middle', indent: 1 }
    ws.mergeCells(`E${r}:I${r}`)
    ws.getCell(`E${r}`).value = 'OBSERVAÇÃO'
    ws.getCell(`E${r}`).font = flLabel
    ws.getCell(`E${r}`).fill = fP
    ws.getCell(`E${r}`).border = bH
    ws.getCell(`E${r}`).alignment = { vertical: 'middle', indent: 1 }
    r++

    for (let i = 1; i <= 10; i++) {
      edit(r, `Passo ${i}`, ''); r++
      edit(r, '', ''); r++
    }

    r++

    // ═══ 6. RESULTADO ═══
    sec(r, '6. RESULTADO DA AUDITORIA'); r++
    resRow(r, 'RESULTADO'); r++
    edit(r, 'INCONSISTÊNCIA DETECTADA', ''); r++
    edit(r, 'MELHORIA SUGERIDA?', ''); r++
    edit(r, 'DESCRIÇÃO DA MELHORIA', ''); r++

    r++

    // ═══ 7. EVIDÊNCIAS ═══
    sec(r, '7. EVIDÊNCIAS (Espaço Livre)'); r++
    ws.mergeCells(`B${r}:I${r + 3}`)
    const eCell = ws.getCell(`B${r}`)
    eCell.value = ''
    eCell.fill = fW
    eCell.border = bH
    eCell.alignment = { vertical: 'top', wrapText: true, indent: 1 }

    wb.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ficha_${row.rc}_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    }).catch(e => console.error('Erro ao gerar Excel:', e))
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  const fundo = '#FFFFFF'
  const navyBold = '#00112C'
  const corBotaoPrimario = '#CC915E'
  const corBotaoSecundario = '#1D3B5C'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'Montserrat, sans-serif'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: fundo,
          borderRadius: 8,
          padding: 32,
          maxWidth: 600,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* STEP 1: RISCO */}
        {step === 1 && (
          <>
            <h2 style={{ color: navyBold, marginTop: 0, fontSize: 20, fontWeight: 600 }}>
              Step 1: Status do Risco
            </h2>

            <div style={{ marginBottom: 20, fontSize: 13, color: '#666' }}>
              <p><strong>Controle:</strong> {row.rc} — {row.dc}</p>
              <p><strong>Risco:</strong> {row.rr} — {row.dr}</p>
            </div>

            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              O risco continua existente?
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              <button
                onClick={() => {
                  if (detectarRegressao()) {
                    setShowRegressao(true)
                    return
                  }
                  setRiscoChoice('nao')
                }}
                style={{
                  padding: '12px',
                  backgroundColor: '#E5E7EB',
                  color: navyBold,
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                ✗ Não
              </button>
              <button
                onClick={() => setRiscoChoice('sim')}
                style={{
                  padding: '12px',
                  backgroundColor: corBotaoPrimario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                ✓ Sim (Existente)
              </button>
              <button
                onClick={() => setRiscoChoice('outro')}
                style={{
                  padding: '12px',
                  backgroundColor: corBotaoSecundario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                ⊘ Outro
              </button>
            </div>

            {riscoChoice === 'sim' && (
              <>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 12, fontWeight: 600 }}>
                  Qual status?
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                  <button
                    onClick={() => setStatusChoice('existente')}
                    style={{
                      padding: '10px',
                      backgroundColor: statusChoice === 'existente' ? corBotaoPrimario : '#E5E7EB',
                      color: statusChoice === 'existente' ? '#fff' : navyBold,
                      border: 'none',
                      borderRadius: 4,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Existente (editar)
                  </button>
                  <button
                    onClick={() => setStatusChoice('evitado')}
                    style={{
                      padding: '10px',
                      backgroundColor: statusChoice === 'evitado' ? '#22C55E' : '#E5E7EB',
                      color: statusChoice === 'evitado' ? '#fff' : navyBold,
                      border: 'none',
                      borderRadius: 4,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Evitado
                  </button>
                </div>

                {statusChoice === 'existente' && (
                  <>
                    <label style={{ display: 'block', color: navyBold, fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                      Descrição do Risco (se houver alteração)
                    </label>
                    <textarea
                      value={novaDescRisco}
                      onChange={(e) => setNovaDescRisco(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: 80,
                        padding: '10px 12px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: 12,
                        marginBottom: 20,
                        boxSizing: 'border-box'
                      }}
                    />

                    <button
                      onClick={() => setStep(2)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: corBotaoPrimario,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Próximo
                    </button>
                  </>
                )}

                {statusChoice === 'evitado' && (
                  <button
                    onClick={handleEvitado}
                    disabled={salvando}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#22C55E',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: salvando ? 'not-allowed' : 'pointer',
                      opacity: salvando ? 0.6 : 1
                    }}
                  >
                    {salvando ? 'Salvando...' : 'Salvar como Evitado'}
                  </button>
                )}
              </>
            )}

            {riscoChoice === 'nao' && (
              <button
                onClick={() => setStep(2)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: corBotaoPrimario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Próximo
              </button>
            )}

            {/* Modal de Regressão */}
            {showRegressao && (
              <ModalRegressaoControle
                row={row}
                onClose={() => setShowRegressao(false)}
                onSaved={() => {
                  onSaved && onSaved()
                  onClose()
                }}
              />
            )}
          </>
        )}

        {/* STEP 2: CONTROLE */}
        {step === 2 && (
          <>
            <h2 style={{ color: navyBold, marginTop: 0, fontSize: 20, fontWeight: 600 }}>
              Step 2: Detalhes do Controle
            </h2>

            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Deseja editar detalhes do controle?
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setControleChoice('nao')}
                style={{
                  padding: '12px',
                  backgroundColor: controleChoice === 'nao' ? '#E5E7EB' : '#E5E7EB',
                  color: navyBold,
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Não
              </button>
              <button
                onClick={() => setControleChoice('sim')}
                style={{
                  padding: '12px',
                  backgroundColor: controleChoice === 'sim' ? corBotaoPrimario : '#E5E7EB',
                  color: controleChoice === 'sim' ? '#fff' : navyBold,
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Sim
              </button>
            </div>

            {controleChoice === 'sim' && (
              <>
                <label style={{ display: 'block', color: navyBold, fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  Descrição do Controle
                </label>
                <textarea
                  value={editDc}
                  onChange={(e) => setEditDc(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: '10px 12px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: 12,
                    marginBottom: 12,
                    boxSizing: 'border-box'
                  }}
                />

                {PREMISSAS.map(p => (
                  <div key={p.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', color: navyBold, fontWeight: 600, fontSize: 11, marginBottom: 4 }}>
                      {p.title}
                    </label>
                    <textarea
                      value={premissas[p.key]}
                      onChange={(e) => setPremissas({ ...premissas, [p.key]: e.target.value })}
                      placeholder={p.placeholder}
                      style={{
                        width: '100%',
                        minHeight: 60,
                        padding: '8px 10px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: 11,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
              </>
            )}

            {controleChoice === 'nao' && (
              <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>
                OK, vamos para o próximo passo.
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#E5E7EB',
                  color: navyBold,
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: corBotaoPrimario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Próximo
              </button>
            </div>
          </>
        )}

        {/* STEP 3: FICHA */}
        {step === 3 && (
          <>
            <h2 style={{ color: navyBold, marginTop: 0, fontSize: 20, fontWeight: 600 }}>
              Step 3: Gerar Ficha de Risco
            </h2>

            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              Você quer gerar a Ficha de Risco em Excel para preencher manualmente?
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#E5E7EB',
                  color: navyBold,
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleSalvarSemFicha}
                disabled={salvando}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: corBotaoSecundario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  opacity: salvando ? 0.6 : 1
                }}
              >
                {salvando ? 'Salvando...' : 'Salvar sem Ficha'}
              </button>
              <button
                onClick={handleSalvarComFicha}
                disabled={salvando}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: corBotaoPrimario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  opacity: salvando ? 0.6 : 1
                }}
              >
                {salvando ? 'Gerando...' : 'Gerar Ficha + Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
