import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getFaseAtual } from '../lib/fases'
import { logRegistrarResultado, logRegressao } from '../lib/auditLog'
import { getFaseInfo } from '../lib/fases'

import BannerReprovacao from './modalRegistrarResultado/BannerReprovacao'
import BannerRegressao from './modalRegistrarResultado/BannerRegressao'
import SecaoResultado from './modalRegistrarResultado/SecaoResultado'
import SecaoInconsistencia from './modalRegistrarResultado/SecaoInconsistencia'
import SecaoMelhoria from './modalRegistrarResultado/SecaoMelhoria'
import SecaoPA from './modalRegistrarResultado/SecaoPA'
const ModalRegistrarResultado = ({ row, onClose, onSaved, responsaveis }) => {
  // ═══ STATE ═══
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notaReprovacao, setNotaReprovacao] = useState(null)
  const faseAtual = getFaseAtual(row || {})
  const faseInfo = getFaseInfo(row || {})
  const isReprovado = row?.status_workflow === 'reprovado'
  // Fases que causam regressão ao marcar Inefetivo/GAP
  const FASES_REGRESSAO = ['F2E2', 'F3', 'F4C1', 'F4C2', 'F5']
  const fasePermiteRegressao = FASES_REGRESSAO.includes(faseInfo.codigo)

  // Se controle foi reprovado, buscar a última nota de reprovação
  useEffect(() => {
    if (isReprovado && row?.id) {
      supabase
        .from('revisoes')
        .select('nota, criado_em, autor:perfis!autor_id(nome)')
        .eq('mrc_id', row.id)
        .eq('tipo', 'reprovacao')
        .order('criado_em', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) setNotaReprovacao(data[0])
        })
    }
  }, [row?.id, isReprovado])

  const [resultado, setResultado] = useState(row?.r1 || 'inefetivo')
  const [inconsistencia, setInconsistencia] = useState(row?.incons || '')
  const [showInconsistenciaAlert, setShowInconsistenciaAlert] = useState(false)
  const [melhoria, setMelhoria] = useState(row?.melhoria ? 'sim' : 'nao')
  const [descMelhoria, setDescMelhoria] = useState(row?.incons_ader || '')
  const [temPA, setTemPA] = useState(row?.dem_pa ? 'sim' : 'nao')
  const [paDesc, setPaDesc] = useState(row?.dem_pa || '')
  const [paResp, setPaResp] = useState(row?.resp_pa || '')
  const [paPrazo, setPaPrazo] = useState(row?.dt_pa || '')
  const [paStatus, setPaStatus] = useState(row?.st_pa || 'pendente')
  const [justificativaPA, setJustificativaPA] = useState('')

  // ═══ LÓGICA ═══
  const showInconsistencia = resultado === 'inefetivo' || resultado === 'gap'
  const showPA = resultado === 'inefetivo' || resultado === 'gap'
  const showDescMelhoria = melhoria === 'sim'


  // ═══ VALIDAÇÃO ═══
  const canSave = resultado &&
    (resultado === 'efetivo' || inconsistencia.trim()) &&
    (melhoria === 'nao' || descMelhoria.trim())

  // ═══ MUDAR RESULTADO ═══
  const handleResultadoChange = (novoResultado) => {
    if (resultado !== 'efetivo' && novoResultado === 'efetivo' && inconsistencia.trim()) {
      setShowInconsistenciaAlert(true)
      setTimeout(() => setShowInconsistenciaAlert(false), 4000)
    }
    if ((resultado === 'efetivo') && (novoResultado === 'inefetivo' || novoResultado === 'gap')) {
      setInconsistencia('')
    }
    setResultado(novoResultado)
  }

  // ═══ DETECTAR REGRESSÃO ═══
  const isRegressao = (resultado === 'inefetivo' || resultado === 'gap') && fasePermiteRegressao

  // ═══ DADOS COMUNS PARA SALVAR ═══
  function buildUpdatePayload() {
    const payload = {
      r1: resultado,
      incons: resultado !== 'efetivo' ? inconsistencia : null,
      melhoria: melhoria === 'sim' ? true : false,
      incons_ader: melhoria === 'sim' ? descMelhoria : null,
      dem_pa: resultado !== 'efetivo' && temPA === 'sim' ? paDesc : null,
      resp_pa: resultado !== 'efetivo' && temPA === 'sim' ? paResp : null,
      dt_pa: resultado !== 'efetivo' && temPA === 'sim' ? paPrazo : null,
      st_pa: resultado !== 'efetivo' && temPA === 'sim' ? paStatus : null,
    }
    // Se é regressão, incrementar contador
    if (isRegressao) {
      payload.num_regressoes = (row?.num_regressoes || 0) + 1
    }
    return payload
  }

  // ═══ SALVAR APENAS (mantém status atual, não submete) ═══
  async function saveOnly() {
    setSaving(true)
    try {
      const payload = buildUpdatePayload()
      // Se não tinha status ou era nao_iniciado, mover para em_analise
      if (!row.status_workflow || row.status_workflow === 'nao_iniciado') {
        payload.status_workflow = 'em_analise'
      }
      // Se reprovado, manter reprovado (consultor só salva, não resubmete ainda)

      const { error } = await supabase
        .from('mrc')
        .update(payload)
        .eq('id', row.id)

      if (error) throw error
      // Log de regressão se aplicável
      if (isRegressao) {
        logRegressao(row, faseInfo.label, (row?.num_regressoes || 0) + 1, row.projeto_id)
      }
      onSaved?.(row)
      onClose?.()
    } catch (err) {
      console.error('Erro ao salvar resultado:', err)
      alert('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ═══ SALVAR E SUBMETER PARA REVISÃO ═══
  async function saveAndSubmit() {
    setSubmitting(true)
    try {
      const payload = buildUpdatePayload()
      payload.status_workflow = 'em_revisao'
      payload.submetido_por = user?.id || null
      payload.submetido_em = new Date().toISOString()

      const { error } = await supabase
        .from('mrc')
        .update(payload)
        .eq('id', row.id)

      if (error) throw error

      // Registrar na tabela de revisões
      const { error: revErr } = await supabase
        .from('revisoes')
        .insert({
          mrc_id: row.id,
          autor_id: user?.id,
          tipo: 'submissao',
          nota: null,
          status_antes: row.status_workflow || 'em_analise',
          status_depois: 'em_revisao',
          fase: faseAtual,
        })
      if (revErr) console.error('Erro ao registrar revisão:', revErr)

      // Criar notificação para todos os admins
      const { data: admins } = await supabase
        .from('perfis')
        .select('id')
        .eq('papel', 'admin_polimata')

      if (admins && admins.length > 0) {
        const notifs = admins.map(a => ({
          para_id: a.id,
          de_id: user?.id,
          tipo: 'submissao',
          titulo: `Análise submetida — ${row.rc || row.rr}`,
          mensagem: `${row.rc} (${row.area}) foi submetido para revisão na fase ${faseAtual}.`,
          lida: false,
          mrc_id: row.id,
        }))
        const { error: notErr } = await supabase
          .from('notificacoes')
          .insert(notifs)
        if (notErr) console.error('Erro ao criar notificação:', notErr)
        // Enviar email para cada revisor (admin)
        admins.forEach(a => {
          supabase.functions.invoke('send-email', {
            body: { type: 'review_submitted', data: { revisor_id: a.id, autor_id: user?.id, ref: row.rc || row.rr, descricao: row.dc || '', area_id: row.area_id } }
          }).catch(err => console.error('Erro ao enviar email de revisão:', err))
        })
      }

      // Audit log
      logRegistrarResultado(row, faseAtual, 'Submetido para revisão', row.projeto_id)
      // Log de regressão se aplicável
      if (isRegressao) {
        logRegressao(row, faseInfo.label, (row?.num_regressoes || 0) + 1, row.projeto_id)
      }

      onSaved?.(row)
      onClose?.()
    } catch (err) {
      console.error('Erro ao submeter:', err)
      alert('Erro ao submeter para revisão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ═══ RENDER ═══
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        width: '90vw',
        maxWidth: 700,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* HEADER */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#00203E', color: 'white' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper-soft)', marginBottom: 4 }}>Matriz de Riscos · Resultado</div>
            <div style={{ fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3, lineHeight: 1.2 }}>Registrar Resultado do Teste</div>
            <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.72, marginTop: 4 }}>{row?.area} — {row?.sub} — {row?.rr}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 28, color: 'white', cursor: 'pointer' }}>×</button>
        </div>

        {/* BODY */}
        <div style={{
          flex: 1,
          padding: 24,
          overflowY: 'auto',
          fontFamily: 'Montserrat, sans-serif'
        }}>
          <BannerReprovacao isReprovado={isReprovado} notaReprovacao={notaReprovacao} faseAtual={faseAtual} />
          <BannerRegressao isRegressao={isRegressao} resultado={resultado} faseAtual={faseAtual} row={row} />
          <SecaoResultado resultado={resultado} handleResultadoChange={handleResultadoChange} />
          <SecaoInconsistencia showInconsistencia={showInconsistencia} showInconsistenciaAlert={showInconsistenciaAlert} inconsistencia={inconsistencia} setInconsistencia={setInconsistencia} resultado={resultado} />
          <SecaoMelhoria showDescMelhoria={showDescMelhoria} melhoria={melhoria} setMelhoria={setMelhoria} descMelhoria={descMelhoria} setDescMelhoria={setDescMelhoria} />
          <SecaoPA showPA={showPA} temPA={temPA} setTemPA={setTemPA} paDesc={paDesc} setPaDesc={setPaDesc} paResp={paResp} setPaResp={setPaResp} paPrazo={paPrazo} setPaPrazo={setPaPrazo} paStatus={paStatus} setPaStatus={setPaStatus} justificativaPA={justificativaPA} setJustificativaPA={setJustificativaPA} responsaveis={responsaveis} resultado={resultado} />
        </div>

        {/* FASE ATUAL */}
        <div style={{
          background: '#F3EEE4',
          borderTop: '1px solid #E0D5C7',
          padding: '0.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#00203E'
        }}>
          <span>Fase em curso: <strong>{faseAtual}</strong></span>
          {row?.status_workflow === 'reprovado' && (
            <span style={{ color: '#C62828', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>
              ↩ Análise reprovada — edite e reenvie
            </span>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', gap: 8, padding: 24, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E' }}>
            Cancelar
          </button>
          <button onClick={saveOnly} disabled={!canSave || saving || submitting} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E', opacity: !canSave || saving || submitting ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={saveAndSubmit} disabled={!canSave || saving || submitting} style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: !canSave || saving || submitting ? 0.5 : 1 }}>
            {submitting ? 'Submetendo...' : (row?.status_workflow === 'reprovado' ? 'Salvar e reenviar' : 'Salvar e submeter')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalRegistrarResultado
