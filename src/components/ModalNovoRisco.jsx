import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ExcelJS from 'exceljs'
import ModalComentario from './ModalComentario'
import PassosTesteList from './PassosTesteList'
import { syncPassosESolicitacoes, criarPassoVazio, loadPassosTeste } from '../lib/passosTeste'
import StepIdentificacao from './modalNovoRisco/StepIdentificacao'
import StepCaracteristicas from './modalNovoRisco/StepCaracteristicas'
import StepPassos from './modalNovoRisco/StepPassos'

const ModalNovoRisco = ({ onClose, onSaved, areas, projeto, areaFixa }) => {
  // ═══ STATE ═══
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState(null)
  const [novoRiscoData, setNovoRiscoData] = useState(null)
  const [comentarioFor, setComentarioFor] = useState(null)
  // responsaveis removido — não há resp. por subprocesso na metodologia
  const [sistemas, setSistemas] = useState([])
  const [subprocessos, setSubprocessos] = useState([])

  // PASSO 1: Identificação
  const [area, setArea] = useState(areaFixa?.id || '')
  const [subprocesso, setSubprocesso] = useState('')
  const [descRisco, setDescRisco] = useState('')
  // gerencia e respSub vêm do cadastro da área (não editáveis)

  // PASSO 2: Características & Premissas
  const [descControle, setDescControle] = useState('')
  const [cat, setCat] = useState('')
  const [freq, setFreq] = useState('')
  const [nat, setNat] = useState('')
  const [car, setCar] = useState('')
  const [sis, setSis] = useState('')
  const [chave, setChave] = useState('')
  
  // Premissas
  const [quem, setQuem] = useState('')
  const [quando, setQuando] = useState('')
  const [porque, setPorque] = useState('')
  const [como, setComo] = useState('')
  const [onde, setOnde] = useState('')
  const [resultadoPremissa, setResultadoPremissa] = useState('')
  
  // PASSO 3: Passos de Teste (Solicitações v2)
  const [passos, setPassos] = useState([criarPassoVazio()])

  useEffect(() => {
    loadPerfil()
    loadSistemas()
  }, [])

  useEffect(() => {
    if (area) loadSubprocessos(area)
  }, [area])

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

  // loadResponsaveis removido

  async function loadSistemas() {
    const { data } = await supabase
      .from('sistemas')
      .select('id, nome')
      .eq('cliente_id', projeto.cliente_id)
      .order('nome')
    if (data) setSistemas(data)
  }

  async function loadSubprocessos(areaId) {
    const { data } = await supabase
      .from('subprocessos')
      .select('id, nome')
      .eq('area_id', areaId)
      .eq('ativo', true)
      .order('ordem')
    if (data) {
      setSubprocessos(data)
    }
  }

  // ═══ LÓGICA ═══
  const isAutomatic = car === 'Automatizado'

  // ═══ VALIDAÇÕES ═══
  const canAdvanceStep1 = area && subprocesso && descRisco.trim()

  const canAdvanceStep2 = descControle.trim() && cat && freq && nat && car && sis && chave &&
    (isAutomatic || quem.trim()) && quando.trim() && porque.trim() && como.trim() &&
    onde.trim() && resultadoPremissa.trim()

  // Passo 3: ao menos um passo com descrição preenchida
  const canSaveStep3 = passos.some(p => (p.descricao || '').trim() !== '')

  // ═══ SALVAR NOVO RISCO (Passo 1) ═══
  async function saveStep1() {
    setSaving(true)
    try {
      const areaObj = areas.find(a => a.id === area)
      const prefixo = areaObj?.prefixo || 'UNKN'

      const { data: existentes } = await supabase
        .from('mrc')
        .select('rr')
        .eq('projeto_id', projeto.id)
        .like('rr', `R.${prefixo}.%`)

      const numeros = existentes
        ?.map(e => {
          const match = e.rr?.match(/\.(\d+)$/)
          return match ? parseInt(match[1]) : 0
        })
        .filter(n => n > 0) || []

      const nextNum = Math.max(...numeros, 0) + 1
      const refRisco = `R.${prefixo}.${String(nextNum).padStart(2, '0')}`
      const refControle = `C.${prefixo}.${String(nextNum).padStart(2, '0')}`

      const subObj = subprocessos.find(s => s.nome === subprocesso)
      const tempData = {
        rr: refRisco,
        rc: refControle,
        sub: subprocesso,
        subprocesso_id: subObj?.id || null,
        ger: areaObj?.gerente || '',
        resp_sub: areaObj?.resp_processo || '',
        dr: descRisco,
        area_id: area,
        projeto_id: projeto.id
      }

      setNovoRiscoData(tempData)
      setStep(2)
    } catch (err) {
      console.error('Erro ao salvar Passo 1:', err)
      alert('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ═══ AVANÇAR DO PASSO 2 ═══
  function saveStep2() {
    setStep(3)
  }

  // ═══ SALVAR NO BANCO (chamado no Passo 3) ═══
  // Solicitações v2: avaliação (resultado/imp/prob/PA) saiu deste modal.
  // Resultado vai para ModalRegistrarResultado, criticidade para ModalRegistrarCriticidade.
  async function salvarNoBanco() {
    const payload = {
      ...novoRiscoData,
      dc: descControle,
      cat, freq, nat, car, sis, chave,
      premissa_quem: isAutomatic ? 'N/A' : quem,
      premissa_quando: quando,
      premissa_porque: porque,
      premissa_como: como,
      premissa_onde: onde,
      premissa_resultado: resultadoPremissa,
      status_workflow: 'nao_iniciado',
      ativo: true,
    }

    let saved
    if (novoRiscoData?.id) {
      const { id, ...updatePayload } = payload
      const { data: updated, error } = await supabase.from('mrc').update(updatePayload).eq('id', novoRiscoData.id).select()
      if (error) throw error
      saved = updated?.[0] || novoRiscoData
    } else {
      const { data: inserted, error } = await supabase.from('mrc').insert([payload]).select()
      if (error) throw error
      saved = inserted?.[0] || null
    }

    if (saved?.id) {
      try {
        await syncPassosESolicitacoes({ controle: saved, passos, projetoId: projeto.id })
      } catch (e) {
        console.error('syncPassosESolicitacoes:', e)
      }
    }
    return saved
  }

  // ═══ SALVAR RASCUNHO (em qualquer passo) ═══
  async function salvarRascunho() {
    if (!canAdvanceStep1) {
      alert('Preencha pelo menos Área, Subprocesso e Descrição do Risco antes de salvar como rascunho.')
      return
    }
    setSaving(true)
    try {
      // Se ainda está no passo 1 (não rodou saveStep1), gera rr/rc primeiro
      let baseData = novoRiscoData
      if (!baseData?.rr) {
        const areaObj = areas.find(a => a.id === area)
        const prefixo = areaObj?.prefixo || 'UNKN'
        const { data: existentes } = await supabase.from('mrc').select('rr').eq('projeto_id', projeto.id).like('rr', `R.${prefixo}.%`)
        const numeros = existentes?.map(e => { const m = e.rr?.match(/\.(\d+)$/); return m ? parseInt(m[1]) : 0 }).filter(n => n > 0) || []
        const nextNum = Math.max(...numeros, 0) + 1
        const refRisco = `R.${prefixo}.${String(nextNum).padStart(2, '0')}`
        const refControle = `C.${prefixo}.${String(nextNum).padStart(2, '0')}`
        const subObj = subprocessos.find(s => s.nome === subprocesso)
        baseData = {
          rr: refRisco, rc: refControle, sub: subprocesso, subprocesso_id: subObj?.id || null,
          ger: areaObj?.gerente || '', resp_sub: areaObj?.resp_processo || '',
          dr: descRisco, area_id: area, projeto_id: projeto.id,
        }
      }
      // Payload: salva só os campos dos steps já visitados pelo usuário.
      // Campos têm defaults (ex: resultado='inefetivo') que não devem
      // contaminar um rascunho de passo 1 que nunca viu o passo 3.
      const payload = { ...baseData, status_workflow: 'rascunho', ativo: true }
      if (step >= 2) {
        if (descControle) payload.dc = descControle
        if (cat) payload.cat = cat
        if (freq) payload.freq = freq
        if (nat) payload.nat = nat
        if (car) payload.car = car
        if (sis) payload.sis = sis
        if (chave) payload.chave = chave
        if (quem && !isAutomatic) payload.premissa_quem = quem
        if (quando) payload.premissa_quando = quando
        if (porque) payload.premissa_porque = porque
        if (como) payload.premissa_como = como
        if (onde) payload.premissa_onde = onde
        if (resultadoPremissa) payload.premissa_resultado = resultadoPremissa
      }
      let saved
      if (baseData?.id) {
        const { id, ...up } = payload
        const { data, error } = await supabase.from('mrc').update(up).eq('id', baseData.id).select()
        if (error) throw error
        saved = data?.[0]
      } else {
        const { data, error } = await supabase.from('mrc').insert([payload]).select()
        if (error) throw error
        saved = data?.[0]
      }
      // Persiste passos+sincroniza solicitações se o usuário chegou no passo 3
      if (step >= 3 && saved?.id) {
        try {
          await syncPassosESolicitacoes({ controle: saved, passos, projetoId: projeto.id })
        } catch (e) {
          console.error('syncPassosESolicitacoes (rascunho):', e)
        }
      }
      setSaving(false)
      setComentarioFor({ controle: saved, acao: 'Rascunho salvo' })
      return
    } catch (err) {
      console.error('Erro ao salvar rascunho:', err)
      alert('Erro ao salvar rascunho: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  // ═══ GERAR FICHA / SALVAR (Passo 3) ═══
  async function gerarFicha(comDownload = true) {
    setSaving(true)
    try {
      // 1. Salvar no banco (INSERT ou UPDATE)
      const saved = await salvarNoBanco()
      if (!saved) throw new Error('Falha ao salvar no banco')
      setNovoRiscoData(saved)

      // 2. Se pediu ficha, atualizar status para em_analise
      if (comDownload) {
        await supabase
          .from('mrc')
          .update({ status_workflow: 'em_analise' })
          .eq('id', saved.id)

        // TODO: Implementar geração Excel aqui (reutilizar função do ModalAtualizar)
        alert('Risco salvo com sucesso! Geração de ficha Excel em implementação.')
      }

      setSaving(false)
      setComentarioFor({ controle: saved, acao: comDownload ? 'Controle salvo (com ficha)' : 'Controle salvo' })
      return
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#00203E', color: 'white' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Novo Risco</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>Fase 1: Avaliação Inicial — Passo {step} de 3</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 28, color: 'white', cursor: 'pointer' }}>×</button>
        </div>

        {/* STEPPER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 24px', gap: 0 }}>
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: s < step ? '#1B5E20' : s === step ? '#00203E' : '#e5e7eb', color: s < step || s === step ? 'white' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
                  {s < step ? '✓' : s}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s < step || s === step ? '#00203E' : '#999', textAlign: 'center' }}>
                  {s === 1 ? 'Identificação' : s === 2 ? 'Detalhamento' : 'Passos de Teste'}
                </div>
              </div>
              {s < 3 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', marginTop: -20 }}></div>}
            </React.Fragment>
          ))}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <StepIdentificacao step={step} area={area} setArea={setArea} subprocesso={subprocesso} setSubprocesso={setSubprocesso} descRisco={descRisco} setDescRisco={setDescRisco} areas={areas} areaFixa={areaFixa} subprocessos={subprocessos} />

          <StepCaracteristicas isAutomatic={isAutomatic} step={step} descControle={descControle} setDescControle={setDescControle} cat={cat} setCat={setCat} freq={freq} setFreq={setFreq} nat={nat} setNat={setNat} car={car} setCar={setCar} sis={sis} setSis={setSis} chave={chave} setChave={setChave} quem={quem} setQuem={setQuem} quando={quando} setQuando={setQuando} porque={porque} setPorque={setPorque} como={como} setComo={setComo} onde={onde} setOnde={setOnde} resultadoPremissa={resultadoPremissa} setResultadoPremissa={setResultadoPremissa} sistemas={sistemas} />

          <StepPassos step={step} passos={passos} setPassos={setPassos} saving={saving} novoRiscoData={novoRiscoData} subprocesso={subprocesso} />

        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', gap: 8, padding: 24, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E' }}>
            Cancelar
          </button>
          <button onClick={salvarRascunho} disabled={!canAdvanceStep1 || saving} title="Salva o que estiver preenchido e fecha. Você pode retomar depois pela Matriz." style={{ flex: 1, padding: '12px 16px', border: '1px solid #CC915E', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(204,145,94,0.08)', color: '#CC915E', opacity: !canAdvanceStep1 || saving ? 0.5 : 1 }}>
            💾 Salvar rascunho
          </button>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} disabled={saving} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E', opacity: saving ? 0.5 : 1 }}>
              ← Voltar
            </button>
          )}
          {step < 3 && (
            <button onClick={step === 1 ? saveStep1 : saveStep2} disabled={!canAdvanceStep1 || (step === 2 && !canAdvanceStep2) || saving} style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: saving || (step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2) ? 0.5 : 1 }}>
              {saving ? 'Salvando...' : 'Próximo →'}
            </button>
          )}
          {step === 3 && (
            <>
              <button onClick={() => gerarFicha(false)} disabled={!canSaveStep3 || saving} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E', opacity: !canSaveStep3 || saving ? 0.5 : 1 }}>
                Salvar sem ficha
              </button>
              <button onClick={() => gerarFicha(true)} disabled={!canSaveStep3 || saving} style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#CC915E', color: 'white', opacity: !canSaveStep3 || saving ? 0.5 : 1 }}>
                {saving ? 'Gerando...' : 'Salvar e gerar ficha'}
              </button>
            </>
          )}
        </div>
      </div>
      {comentarioFor && (
        <ModalComentario
          controleId={comentarioFor.controle?.id}
          projetoId={projeto?.id}
          perfil={perfil}
          acao={comentarioFor.acao}
          onClose={() => { const c = comentarioFor.controle; setComentarioFor(null); onSaved?.(c); onClose?.() }}
          onSaved={() => { const c = comentarioFor.controle; setComentarioFor(null); onSaved?.(c); onClose?.() }}
        />
      )}
    </div>
  )
}

export default ModalNovoRisco
