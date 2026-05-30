// ModalAtualizar — shell de coordenação.
// Fatiamento Etapa 3 (22/mai/2026): geração Excel virou lib, cada step virou componente próprio.
// Comportamento idêntico ao anterior. Para os blocos extraídos, ver:
//   - src/lib/gerarFichaRiscoExcel.js
//   - src/components/modalAtualizar/Step{Risco,Controle,Passos,Ficha}.jsx

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import HistoricoTab from './HistoricoTab'
import { logAtualizarControle, logBaixarFicha } from '../lib/auditLog'
import SecaoCenarioAtual from './modalRegistrarResultado/SecaoCenarioAtual'

import ModalComentario from './ModalComentario'
import { syncPassosESolicitacoes, loadPassosTeste, criarPassoVazio } from '../lib/passosTeste'
import { useAuth } from '../contexts/AuthContext'
import { gerarFichaRiscoExcel } from '../lib/gerarFichaRiscoExcel'

import StepRisco from './modalAtualizar/StepRisco'
import StepControle from './modalAtualizar/StepControle'
import StepPassos from './modalAtualizar/StepPassos'
import StepFicha from './modalAtualizar/StepFicha'

const ModalAtualizar = ({ row, onClose, onSaved, areas, projeto }) => {
  const { perfil: perfilAuth } = useAuth()
  const [comentarioFor, setComentarioFor] = useState(null)
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
  // Solicitações v2: passos de teste com checkbox para gerar solicitação
  const [passos, setPassos] = useState([])

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
  const [cenarioAtual, setCenarioAtual] = useState(row.cenario_atual || '')

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

  // Validação Step 3 (Passos de Teste — Solicitações v2)
  // Não trava — passos são opcionais; usuário pode avançar sem nenhum.
  const canAdvanceStep3 = true

  function nextStep() {
    if (step < 4) setStep(step + 1)
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
        status_workflow: 'em_analise',
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      await supabase.from('mrc').update(updates).eq('id', row.id)
      // Solicitações v2: persiste passos editados e sincroniza solicitações
      try {
        await syncPassosESolicitacoes({ controle: row, passos, projetoId: row.projeto_id })
      } catch (e) {
        console.error('syncPassosESolicitacoes (ficha):', e)
      }
      await gerarFichaRiscoExcel({
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
        status_workflow: 'teste_pendente',
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id,
      }
      await supabase.from('mrc').update(updates).eq('id', row.id)
      try {
        await syncPassosESolicitacoes({ controle: row, passos, projetoId: row.projeto_id })
      } catch (e) {
        console.error('syncPassosESolicitacoes (semFicha):', e)
      }
      logAtualizarControle(row, row.projeto_id)
      alert('✅ Salvo com sucesso! Status: TESTE PENDENTE')
      setComentarioFor({ controleId: row?.id, acao: 'Controle atualizado' })
      // onClose/onSaved será chamado quando o pop-up de comentário fechar
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ═══ MAIN RENDER ═══
  return (
    <>
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
          {[1, 2, 3, 4].map((s) => (
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

        {/* BODY */}
        <div style={{ flex: 1, padding: 24, overflow: 'y', overflowY: 'auto' }}>
          {showHistorico ? (
            <HistoricoTab registroId={row.id} />
          ) : (
            <>
              {step === 1 && (
                <StepRisco
                  row={row}
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
                  <SecaoCenarioAtual cenarioAtual={cenarioAtual} setCenarioAtual={setCenarioAtual} />
                  <StepControle
                  row={row}
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
                  isAutomatic={isAutomatic}
                  />
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
              {step < 4 && (
                <button
                  onClick={nextStep}
                  disabled={step === 1 ? !canAdvanceStep1 : step === 2 ? !canAdvanceStep2 : step === 3 ? !canAdvanceStep3 : false}
                  style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: (step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) || (step === 3 && !canAdvanceStep3) ? 0.5 : 1 }}
                >
                  Próximo →
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
