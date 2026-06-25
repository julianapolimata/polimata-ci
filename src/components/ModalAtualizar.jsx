// ModalAtualizar — shell de coordenação.
// Fatiamento Etapa 3 (22/mai/2026): geração Excel virou lib, cada step virou componente próprio.
// Comportamento idêntico ao anterior. Para os blocos extraídos, ver:
//   - src/lib/gerarFichaRiscoExcel.js
//   - src/components/modalAtualizar/Step{Risco,Controle,Passos,Ficha}.jsx

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirm } from './ConfirmDialog'
import HistoricoTab from './HistoricoTab'
import { logAtualizarControle, logBaixarFicha } from '../lib/auditLog'
import SecaoCenarioAtual from './modalRegistrarResultado/SecaoCenarioAtual'

import ModalComentario from './ModalComentario'
import { syncPassosESolicitacoes, loadPassosTeste, criarPassoVazio } from '../lib/passosTeste'
import { useAuth } from '../contexts/AuthContext'
import { gerarFichaRiscoExcel } from '../lib/gerarFichaRiscoExcel'
import { uploadDocumento } from '../lib/documentos'
import { getFaseInfo } from '../lib/fases'
import { reabrirBloco, blocosAplicaveis, faseDoBloco, setBlocoStatus } from '../lib/aprovacoesBloco'

import StepRisco from './modalAtualizar/StepRisco'
import StepControle from './modalAtualizar/StepControle'
import StepPassos from './modalAtualizar/StepPassos'
import StepFicha from './modalAtualizar/StepFicha'

const SECAO_STEP = { cenario: 2, risco: 1, controle: 2, teste: 3 }
const SECAO_LABEL = { cenario: 'Cenário Atual', risco: 'Descrição do Risco', controle: 'Descrição e Características do Controle', teste: 'Passos de Teste' }

const ModalAtualizar = ({ row, onClose, onSaved, areas, projeto, irParaFicha }) => {
  const { perfil: perfilAuth } = useAuth()
  const [comentarioFor, setComentarioFor] = useState(null)
  const [blocosReabrir, setBlocosReabrir] = useState([])
  const [mostrarLista, setMostrarLista] = useState(true)
  const isDiag = projeto?.f1_tem_teste === false
  // Rascunho/não iniciado = primeira revisão: exige conjunto completo (não vale envio por bloco)
  const { confirm } = useConfirm()
  const [dirty, setDirty] = useState(false)
  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({ title: 'Descartar alterações?', message: 'Há alterações não salvas neste formulário. Deseja fechar mesmo assim? As alterações serão perdidas.', confirmText: 'Descartar', cancelText: 'Continuar editando', variant: 'danger' })
      if (!ok) return
    }
    onClose?.()
  }
  // ═══ STATE ═══
  const [step, setStep] = useState(irParaFicha ? 4 : 1)
  const [statusChoice, setStatusChoice] = useState(null)
  const [newStatus, setNewStatus] = useState(null)
  const [descChoice, setDescChoice] = useState(null)
  const [ctrlDescChoice, setCtrlDescChoice] = useState(null)
  const [motivoInativacao, setMotivoInativacao] = useState('')
  const [novaDescRisco, setNovaDescRisco] = useState('')
  const [novaDescControle, setNovaDescControle] = useState('')
  const [recomendacao, setRecomendacao] = useState(row?.rec || '')
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState(null)
  const donoControle = row?.consultor_id || row?.submetido_por || row?.criado_por
  const podeAprovarDiag = isDiag && ['admin_polimata', 'gerente_polimata'].includes(perfil?.papel) && (!donoControle || donoControle === perfil?.id)
  const [showHistorico, setShowHistorico] = useState(false)
  // Solicitações v2: passos de teste com checkbox para gerar solicitação
  const [passos, setPassos] = useState([])

  // Control fields (Step 2)
  const [editCat, setEditCat] = useState(row.cat || '')
  const [editFreq, setEditFreq] = useState(row.freq || '')
  const [editNat, setEditNat] = useState(row.nat || '')
  const [editCar, setEditCar] = useState(row.car || '')
  const [editSis, setEditSis] = useState(row.sis || '')
  const [editChave, setEditChave] = useState(row.chave || '')
  const [existencia, setExistencia] = useState(row.existencia || '')
  const [sistemas, setSistemas] = useState([])
  const FRASE_SEM_CONTROLE = 'Não identificamos controle para mitigação deste risco.'

  // Premissas (Step 2)
  const [pq, setPq] = useState(row.premissa_porque || '')
  const [quando, setQuando] = useState(row.premissa_quando || '')
  const [onde, setOnde] = useState(row.premissa_onde || '')
  const [quem, setQuem] = useState(row.premissa_quem || '')
  const [como, setComo] = useState(row.premissa_como || '')
  const [resultado, setResultado] = useState(row.premissa_resultado || '')
  const [cenarioAtual, setCenarioAtual] = useState(row.cenario_atual || '')
  const [dtImplementacao, setDtImplementacao] = useState(() => {
    const v = row.dt_implementacao || ''
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : v
  })

  // Auxiliary data
  const [areaDestino, setAreaDestino] = useState('')
  const [subDestino, setSubDestino] = useState('')
  const [subprocessosDestino, setSubprocessosDestino] = useState([])

  useEffect(() => {
    loadPerfil()
  }, [])

  // Carrega passos do controle (Solicitações v2)
  useEffect(() => {
    let cancelado = false
    async function go() {
      if (!row?.id) return
      const lista = await loadPassosTeste(row.id)
      if (cancelado) return
      // Se controle não tinha nenhum passo cadastrado, seedar uma linha em branco
      // (mas mantém os antigos com gerar_solicitacao desligado)
      setPassos(lista.length ? lista : [criarPassoVazio()])
    }
    go()
    return () => { cancelado = true }
  }, [row?.id])

  async function loadPerfil() {
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      const { data: profile } = await supabase
        .from('perfis')
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

  // Sistemas cadastrados do cliente (corrige lista fixa que misturava clientes)
  useEffect(() => {
    if (!projeto?.cliente_id) return
    supabase.from('sistemas').select('id, nome').eq('cliente_id', projeto.cliente_id).order('nome')
      .then(({ data }) => { if (data) setSistemas(data) })
  }, [projeto?.cliente_id])

  // Existência (diagnóstico): Inexistente preenche a descrição com a frase padrão
  function handleExistencia(v) {
    setExistencia(v)
    if (v === 'Inexistente') {
      setCtrlDescChoice('sim')
      setNovaDescControle(FRASE_SEM_CONTROLE)
    } else if (novaDescControle === FRASE_SEM_CONTROLE) {
      setNovaDescControle('')
    }
  }

  // Validação Step 2
  const canAdvanceStep2 = (() => {
    if (isDiag && !existencia) return false
    if (isDiag && existencia === 'Inexistente') return true
    if (ctrlDescChoice === null) return false
    if (ctrlDescChoice === 'sim') {
      if (!novaDescControle.trim()) return false
      if (!editCat || !editFreq || !editNat || !editCar || !editSis || !editChave) return false
      if (!isAutomatic && !quem.trim()) return false
      if (!quando.trim() || !pq.trim() || !como.trim() || !onde.trim() || !resultado.trim()) return false
      if (isDiag && existencia === 'Parcial' && ![editCat, editFreq, editNat, editCar, editSis].includes('Requisito Não Atendido')) return false
      if (!dtImplementacao || dtImplementacao > new Date().toISOString().slice(0, 10)) return false
    }
    return true
  })()

  // Criticidade caduca: se qualquer campo do risco/controle mudar, a avaliação deve ser refeita
  function mudouRiscoControle() {
    const dtRow = row.dt_implementacao ? String(row.dt_implementacao).slice(0, 10) : ''
    return (!!novaDescRisco.trim() && novaDescRisco !== row.dr) ||
      (!!novaDescControle.trim() && novaDescControle !== row.dc) ||
      editCat !== (row.cat || '') || editFreq !== (row.freq || '') || editNat !== (row.nat || '') ||
      editCar !== (row.car || '') || editSis !== (row.sis || '') || editChave !== (row.chave || '') ||
      (cenarioAtual.trim() || '') !== (row.cenario_atual || '') ||
      pq !== (row.premissa_porque || '') || quando !== (row.premissa_quando || '') ||
      onde !== (row.premissa_onde || '') || como !== (row.premissa_como || '') ||
      (isAutomatic ? 'N/A' : quem) !== (row.premissa_quem || '') ||
      resultado !== (row.premissa_resultado || '') ||
      (isDiag && existencia !== (row.existencia || '')) ||
      (dtImplementacao || '') !== dtRow
  }

  // Validação por bloco (item 11): só valida os blocos efetivamente reabertos
  const canEnviarRevisao = (blocosReabrir.length > 0)
    ? blocosReabrir.every(b =>
        b === 'risco' ? canAdvanceStep1 :
        b === 'controle' ? canAdvanceStep2 :
        b === 'cenario' ? cenarioAtual.trim().length > 0 :
        true)
    : (canAdvanceStep1 && canAdvanceStep2)

  // Validação Step 3 (Passos de Teste — Solicitações v2)
  // Não trava — passos são opcionais; usuário pode avançar sem nenhum.
  const canAdvanceStep3 = true

  function nextStep() {
    if (step < (isDiag ? 2 : 4)) setStep(step + 1)
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
      setComentarioFor({ controleId: row?.id, acao: 'Controle atualizado' })
      // onClose/onSaved será chamado quando o pop-up de comentário fechar
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
      setComentarioFor({ controleId: row?.id, acao: 'Controle atualizado' })
      // onClose/onSaved será chamado quando o pop-up de comentário fechar
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
        cenario_atual: cenarioAtual.trim() || null,
        dt_implementacao: dtImplementacao || null,
        status_workflow: 'em_analise',
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      {
        const { data: _upd, error: _updErr } = await supabase.from('mrc').update(updates).eq('id', row.id).select('id')
        if (_updErr) throw _updErr
        if (!_upd || _upd.length === 0) throw new Error('Não foi possível gravar as alterações (0 registros atualizados — verifique permissões/conexão e tente de novo).')
      }
      // Solicitações v2: persiste passos editados e sincroniza solicitações
      try {
        if (!isDiag) await syncPassosESolicitacoes({ controle: row, passos, projetoId: row.projeto_id })
      } catch (e) {
        console.error('syncPassosESolicitacoes (ficha):', e)
        throw new Error('O controle foi salvo, mas houve erro ao gravar os passos de teste: ' + (e.message || e))
      }
      // item 11: reabrir blocos selecionados para nova aprovação
      if (blocosReabrir.length) {
        for (const b of blocosReabrir) {
          try { await reabrirBloco({ mrcId: row.id, bloco: b, fase: faseDoBloco(b, row, projeto) }) } catch (e) { console.error('reabrirBloco:', e) }
        }
        await supabase.from('mrc').update({ status_workflow: 'em_revisao' }).eq('id', row.id)
      }
      const ficha = await gerarFichaRiscoExcel({
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
        premissas: { pq, quando, onde, quem, como, resultado },
        passos,
        isAutomatic,
      })
      try {
        if (ficha?.blob) await uploadDocumento({
          arquivo: ficha.blob, nomeArquivo: ficha.filename,
          meta: { projetoId: row.projeto_id, areaId: row.area_id, subprocessoId: row.subprocesso_id,
            controleId: row.id, fase: getFaseInfo(row).codigo, categoria: 'ficha', enviadoPor: perfil?.id },
        })
      } catch (e) { console.error('ficha->storage:', e); alert('A ficha foi baixada, mas não foi salva em Documentos: ' + e.message) }
      logAtualizarControle(row, row.projeto_id)
      logBaixarFicha(row, row.projeto_id)
      setComentarioFor({ controleId: row?.id, acao: 'Controle atualizado' })
      // onClose/onSaved será chamado quando o pop-up de comentário fechar
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
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
        cenario_atual: cenarioAtual.trim() || null,
        ...(isDiag ? { existencia: existencia || null } : {}),
        dt_implementacao: dtImplementacao || null,
        status_workflow: 'teste_pendente',
        ...((row.crit != null && mudouRiscoControle()) ? { imp: null, prob: null, crit: null } : {}),
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      {
        const { data: _upd, error: _updErr } = await supabase.from('mrc').update(updates).eq('id', row.id).select('id')
        if (_updErr) throw _updErr
        if (!_upd || _upd.length === 0) throw new Error('Não foi possível gravar as alterações (0 registros atualizados — verifique permissões/conexão e tente de novo).')
      }
      try {
        if (!isDiag) await syncPassosESolicitacoes({ controle: row, passos, projetoId: row.projeto_id })
      } catch (e) {
        console.error('syncPassosESolicitacoes (semFicha):', e)
        throw new Error('O controle foi salvo, mas houve erro ao gravar os passos de teste: ' + (e.message || e))
      }
      logAtualizarControle(row, row.projeto_id)
      // item 11: reabrir blocos selecionados para nova aprovação
      if (blocosReabrir.length) {
        for (const b of blocosReabrir) {
          try { await reabrirBloco({ mrcId: row.id, bloco: b, fase: faseDoBloco(b, row, projeto) }) } catch (e) { console.error('reabrirBloco:', e) }
        }
        await supabase.from('mrc').update({ status_workflow: 'em_revisao' }).eq('id', row.id)
      }
      alert('✅ Salvo com sucesso! Status: TESTE PENDENTE')
      setComentarioFor({ controleId: row?.id, acao: 'Controle atualizado' })
      // onClose/onSaved será chamado quando o pop-up de comentário fechar
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ═══ SALVAR E ENVIAR PARA REVISÃO (edição de seção; sem ficha; exige nova ficha após aprovação) ═══
  async function handleSalvarEnviarRevisao() {
    if (!canEnviarRevisao) { alert('Preencha os campos obrigatórios da(s) seção(ões) em edição antes de enviar para revisão.'); return }
    setSaving(true)
    try {
      const updates = {
        dr: novaDescRisco || row.dr,
        dc: novaDescControle || row.dc,
        cat: editCat, freq: editFreq, nat: editNat, car: editCar, sis: editSis, chave: editChave,
        premissa_porque: pq, premissa_quando: quando, premissa_onde: onde,
        premissa_quem: isAutomatic ? 'N/A' : quem, premissa_como: como, premissa_resultado: resultado,
        cenario_atual: cenarioAtual.trim() || null,
        ...(isDiag ? { existencia: existencia || null, rec: recomendacao || null } : {}),
        dt_implementacao: dtImplementacao || null,
        status_workflow: podeAprovarDiag ? 'aprovado' : 'em_revisao',
        edicao_pendente: !isDiag,
        ...((row.crit != null && mudouRiscoControle()) ? { imp: null, prob: null, crit: null } : {}),
        submetido_por: perfil?.id,
        submetido_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      const { data: _u, error } = await supabase.from('mrc').update(updates).eq('id', row.id).select('id')
      if (error) throw error
      if (!_u || _u.length === 0) throw new Error('Não foi possível gravar (0 registros — verifique permissões/conexão).')
      if (!isDiag) { try { await syncPassosESolicitacoes({ controle: row, passos, projetoId: row.projeto_id }) } catch (e) { console.error('syncPassos:', e) } }
      if (podeAprovarDiag) {
        for (const b of blocosAplicaveis(projeto)) {
          try { await setBlocoStatus({ mrcId: row.id, bloco: b, fase: faseDoBloco(b, row, projeto), status: 'aprovado', revisorId: perfil?.id }) } catch (e) { console.error('aprovar bloco:', e) }
        }
      } else {
        for (const b of blocosReabrir) {
          try { await reabrirBloco({ mrcId: row.id, bloco: b, fase: faseDoBloco(b, row, projeto) }) } catch (e) { console.error('reabrirBloco:', e) }
        }
      }
      // Notificar revisores (admins) via edge function — consultor não enxerga
      // a lista de admins pela RLS, então a resolução é feita no servidor.
      if (!podeAprovarDiag) supabase.functions.invoke('send-email', {
        body: { type: 'review_submitted_admins', data: {
          autor_id: perfil?.id, ref: row.rc || row.rr, descricao: row.dc || '',
          area_id: row.area_id, mrc_id: row.id,
          titulo: `Edição submetida — ${row.rc || row.rr}`,
          mensagem: `${row.rc} (${row.area}) foi enviado para revisão após edição${blocosReabrir.length ? ` (${blocosReabrir.map(b => SECAO_LABEL[b] || b).join(', ')})` : ''}.`,
        } }
      }).catch(err => console.error('Erro ao notificar revisão:', err))
      logAtualizarControle(row, row.projeto_id)
      alert(podeAprovarDiag ? '✅ Alterações salvas e aprovadas.' : '✅ Alterações salvas e enviadas para revisão. Após a aprovação, será necessário baixar uma nova ficha (Ficha Pendente).')
      onSaved?.()
      onClose?.()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ═══ MAIN RENDER ═══
  return (
    <>
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onChangeCapture={() => setDirty(true)}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)', maxWidth: 700, width: '90vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#00203E', color: 'white' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper-soft)', marginBottom: 4 }}>Matriz de Riscos · Controle</div>
            <div style={{ fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3, lineHeight: 1.2 }}>Atualizar Controle</div>
            <div style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.72, marginTop: 4, maxWidth: 560, whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.35 }}>{row.rc}{row.dr ? ` · ${row.dr}` : (row.area ? ` · ${row.area}` : '')}</div>
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
            <button onClick={requestClose} style={{ background: 'none', border: 'none', fontSize: 28, color: 'white', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Editar seção — navega direto e reabre para aprovação (item 11). Oculto só em rascunho */}
        {row?.status_workflow !== 'rascunho' && (
        <div style={{ padding: '8px 24px', background: '#FFF8E1', borderBottom: '1px solid #F0E0A8', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {(blocosReabrir.length === 0 || mostrarLista) ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7A5C00', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>Editar seção:</span>
              <select value="" onChange={e => { const b = e.target.value; if (!b) return; setStep(SECAO_STEP[b] || 1); setBlocosReabrir(prev => prev.includes(b) ? prev : [...prev, b]); setMostrarLista(false) }} style={{ flex: 1, minWidth: 220, maxWidth: 320, padding: '6px 8px', border: '1px solid #E0C98A', borderRadius: 6, fontFamily: 'inherit', fontSize: 13, background: '#fff', color: '#00203E', cursor: 'pointer' }}>
                <option value="">— pular direto para a seção —</option>
                {blocosAplicaveis(projeto).map(b => <option key={b} value={b}>{SECAO_LABEL[b] || b}</option>)}
              </select>
            </>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#7A5C00', flex: 1 }}>✓ Ao salvar, {blocosReabrir.map(b => SECAO_LABEL[b] || b).join(', ')} volta{blocosReabrir.length > 1 ? 'm' : ''} para "A aprovar". Os demais mantêm a aprovação.<button type="button" onClick={() => setMostrarLista(true)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--copper-text, #A6512F)', fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>editar outra seção</button></span>
          )}
        </div>
        )}

        {/* STEPPER (oculto ao editar uma seção direto) */}
        {blocosReabrir.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', gap: 0 }}>
          {(isDiag ? [1, 2] : [1, 2, 3, 4]).map((s) => (
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
                  {s === 1 ? 'Risco' : s === 2 ? 'Controle' : s === 3 ? 'Passos de Teste' : 'Executar Teste'}
                </div>
              </div>
              {s < 4 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', marginTop: -20 }}></div>}
            </React.Fragment>
          ))}
        </div>
        )}

        {/* BODY */}
        <div style={{ flex: 1, padding: 24, overflow: 'y', overflowY: 'auto' }}>
          {showHistorico ? (
            <HistoricoTab registroId={row.id} />
          ) : (
            <>
              {step === 1 && (
                <StepRisco
                  row={row}
                  projeto={projeto}
                  areas={areas}
                  statusChoice={statusChoice} setStatusChoice={setStatusChoice}
                  newStatus={newStatus} setNewStatus={setNewStatus}
                  descChoice={descChoice} setDescChoice={setDescChoice}
                  motivoInativacao={motivoInativacao} setMotivoInativacao={setMotivoInativacao}
                  novaDescRisco={novaDescRisco} setNovaDescRisco={setNovaDescRisco}
                  areaDestino={areaDestino} setAreaDestino={setAreaDestino}
                  subDestino={subDestino} setSubDestino={setSubDestino}
                  subprocessosDestino={subprocessosDestino}
                  loadSubprocessosDestino={loadSubprocessosDestino}
                />
              )}
              {step === 2 && (
                <>
                  <SecaoCenarioAtual cenarioAtual={cenarioAtual} setCenarioAtual={setCenarioAtual}
                    readOnly={blocosReabrir.length > 0 && !blocosReabrir.includes('cenario')} />
                  {(blocosReabrir.length === 0 || blocosReabrir.includes('controle')) && (
                  <StepControle
                  row={row}
                  isDiag={isDiag} existencia={existencia} setExistencia={handleExistencia} sistemas={sistemas}
                  ctrlDescChoice={ctrlDescChoice} setCtrlDescChoice={setCtrlDescChoice}
                  novaDescControle={novaDescControle} setNovaDescControle={setNovaDescControle}
                  editCat={editCat} setEditCat={setEditCat}
                  editFreq={editFreq} setEditFreq={setEditFreq}
                  editNat={editNat} setEditNat={setEditNat}
                  editCar={editCar} setEditCar={setEditCar}
                  editSis={editSis} setEditSis={setEditSis}
                  editChave={editChave} setEditChave={setEditChave}
                  pq={pq} setPq={setPq}
                  quando={quando} setQuando={setQuando}
                  onde={onde} setOnde={setOnde}
                  quem={quem} setQuem={setQuem}
                  como={como} setComo={setComo}
                  resultado={resultado} setResultado={setResultado}
                  dtImplementacao={dtImplementacao} setDtImplementacao={setDtImplementacao}
                  recomendacao={recomendacao} setRecomendacao={setRecomendacao}
                  isAutomatic={isAutomatic}
                  />
                  )}
                </>
              )}
              {step === 3 && (
                <StepPassos row={row} passos={passos} setPassos={setPassos} saving={saving} />
              )}
              {step === 4 && (
                <StepFicha
                  row={row}
                  novaDescRisco={novaDescRisco}
                  novaDescControle={novaDescControle}
                  editCat={editCat}
                  editFreq={editFreq}
                  editNat={editNat}
                  editCar={editCar}
                  saving={saving}
                  handleSaveFicha={handleSaveFicha}
                  handleSaveSemFicha={handleSaveSemFicha}
                />
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button
            onClick={requestClose}
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E' }}
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
              {blocosReabrir.length === 0 && (
                <>
                  <button onClick={prevStep} disabled={step === 1} style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E', opacity: step === 1 ? 0.5 : 1 }}>← Voltar</button>
                  {step < (isDiag ? 2 : 4) && (
                    <button onClick={nextStep} disabled={step === 1 ? !canAdvanceStep1 : step === 2 ? !canAdvanceStep2 : step === 3 ? !canAdvanceStep3 : false} style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: (step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) || (step === 3 && !canAdvanceStep3) ? 0.5 : 1 }}>Próximo →</button>
                  )}
                </>
              )}
              {(blocosReabrir.length > 0 || (isDiag && step === 2)) && (
                <button onClick={handleSalvarEnviarRevisao} disabled={saving || !canEnviarRevisao} title={!canEnviarRevisao ? 'Preencha os campos obrigatórios da(s) seção(ões) em edição antes de enviar.' : ''} style={{ flex: 2, padding: '10px 14px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: (saving || !canEnviarRevisao) ? 'not-allowed' : 'pointer', background: '#15803D', color: 'white', opacity: (saving || !canEnviarRevisao) ? 0.5 : 1 }}>
                  {saving ? 'Salvando...' : (podeAprovarDiag ? '✓ Salvar e aprovar' : '✓ Salvar e enviar para revisão')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    {comentarioFor && (
      <ModalComentario
        controleId={comentarioFor.controleId}
        projetoId={projeto?.id}
        perfil={perfilAuth}
        acao={comentarioFor.acao}
        onClose={() => { setComentarioFor(null); onSaved && onSaved(); onClose && onClose() }}
        onSaved={() => { setComentarioFor(null); onSaved && onSaved(); onClose && onClose() }}
      />
    )}
    </>
  )
}

export default ModalAtualizar
