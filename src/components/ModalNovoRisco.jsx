import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ExcelJS from 'exceljs'

const ModalNovoRisco = ({ onClose, onSaved, areas, projeto, areaFixa }) => {
  // ═══ STATE ═══
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [perfil, setPerfil] = useState(null)
  const [novoRiscoData, setNovoRiscoData] = useState(null)
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
  
  // Resultado do Teste & Criticidade
  const [resultado, setResultado] = useState('inefetivo')
  const [inconsistencia, setInconsistencia] = useState('')
  const [showInconsistenciaAlert, setShowInconsistenciaAlert] = useState(false)
  const [melhoria, setMelhoria] = useState('sim')
  const [descMelhoria, setDescMelhoria] = useState('')
  const [impacto, setImpacto] = useState('')
  const [probabilidade, setProbabilidade] = useState('')
  const [temPA, setTemPA] = useState('sim')
  const [paDesc, setPaDesc] = useState('')
  const [paResp, setPaResp] = useState('')
  const [paPrazo, setPaPrazo] = useState('')
  const [paStatus, setPaStatus] = useState('pendente')
  const [justificativaPA, setJustificativaPA] = useState('')

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
  const showInconsistencia = resultado === 'inefetivo' || resultado === 'gap'
  const showPA = resultado === 'inefetivo' || resultado === 'gap'
  const showDescMelhoria = melhoria === 'sim'

  // Cálculo de criticidade
  const criticidade = impacto && probabilidade 
    ? parseInt(impacto) * parseInt(probabilidade) 
    : null

  const getCriticidadeLabel = (crit) => {
    if (!crit) return { label: '', color: '' }
    const map = {
      1: { label: 'Baixo', color: '#E8F5E9', colorText: '#1B5E20' },
      2: { label: 'Moderado', color: '#FFCC80', colorText: '#E65100' },
      3: { label: 'Significativo', color: '#FFCC80', colorText: '#E65100' },
      4: { label: 'Crítico', color: '#FFEBEE', colorText: '#C62828' },
      6: { label: 'Significativo', color: '#FFCC80', colorText: '#E65100' },
      8: { label: 'Crítico', color: '#FFEBEE', colorText: '#C62828' },
      9: { label: 'Crítico', color: '#FFEBEE', colorText: '#C62828' },
      12: { label: 'Crítico', color: '#FFEBEE', colorText: '#C62828' },
      16: { label: 'Crítico', color: '#FFEBEE', colorText: '#C62828' }
    }
    return map[crit] || { label: 'Moderado', color: '#FFCC80', colorText: '#E65100' }
  }

  // ═══ VALIDAÇÕES ═══
  const canAdvanceStep1 = area && subprocesso && descRisco.trim()
  
  const canAdvanceStep2 = descControle.trim() && cat && freq && nat && car && sis && chave &&
    (isAutomatic || quem.trim()) && quando.trim() && porque.trim() && como.trim() &&
    onde.trim() && resultadoPremissa.trim()

  const canSaveStep3 = resultado &&
    (resultado === 'efetivo' || inconsistencia.trim()) &&
    (melhoria === 'nao' || descMelhoria.trim()) &&
    impacto && probabilidade &&
    (resultado === 'efetivo' || (temPA === 'sim' ? (paDesc.trim() && paResp && paPrazo && paStatus) : justificativaPA.trim()))

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
        .like('rr', `${prefixo}.%`)

      const numeros = existentes
        ?.map(e => {
          const match = e.rr?.match(/\.(\d+)$/)
          return match ? parseInt(match[1]) : 0
        })
        .filter(n => n > 0) || []

      const nextNum = Math.max(...numeros, 0) + 1
      const refRisco = `${prefixo}.${String(nextNum).padStart(2, '0')}`
      const refControle = `C.${refRisco}`

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
      r1: resultado,
      incons: resultado !== 'efetivo' ? inconsistencia : null,
      melhoria: melhoria === 'sim' ? true : false,
      incons_ader: melhoria === 'sim' ? descMelhoria : null,
      imp: parseInt(impacto),
      prob: parseInt(probabilidade),
      crit: criticidade,
      crit_label: getCriticidadeLabel(criticidade).label,
      dem_pa: temPA === 'sim' ? paDesc : null,
      resp_pa: temPA === 'sim' ? paResp : null,
      dt_pa: temPA === 'sim' ? paPrazo : null,
      st_pa: temPA === 'sim' ? paStatus : null,
      status_workflow: 'nao_iniciado',
      ativo: true
    }

    if (novoRiscoData?.id) {
      const { id, ...updatePayload } = payload
      const { data: updated, error } = await supabase.from('mrc').update(updatePayload).eq('id', novoRiscoData.id).select()
      if (error) throw error
      return updated?.[0] || novoRiscoData
    } else {
      const { data: inserted, error } = await supabase.from('mrc').insert([payload]).select()
      if (error) throw error
      return inserted?.[0] || null
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

      onSaved?.(saved)
      onClose?.()
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
                  {s === 1 ? 'Identificação' : s === 2 ? 'Detalhamento' : 'Avaliação'}
                </div>
              </div>
              {s < 3 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', marginTop: -20 }}></div>}
            </React.Fragment>
          ))}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {/* ─────────── PASSO 1 ─────────── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#00203E',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Área <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                {areaFixa ? (
                  <div style={{
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    background: '#F5F5F5',
                    color: '#00203E',
                    fontWeight: 600
                  }}>
                    {areaFixa.nome}
                  </div>
                ) : (
                <select
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="">Selecionar...</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
                )}
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#00203E',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Subprocesso <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <select
                  value={subprocesso}
                  onChange={e => setSubprocesso(e.target.value)}
                  disabled={!area}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    background: !area ? '#F5F5F5' : 'white',
                    opacity: !area ? 0.6 : 1
                  }}
                >
                  <option value="">Selecionar...</option>
                  {subprocessos.map(s => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#00203E',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Descrição do Risco <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <textarea
                  value={descRisco}
                  onChange={e => setDescRisco(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Descrever o risco..."
                />
              </div>

            </div>
          )}

          {/* ─────────── PASSO 2 ─────────── */}
          {step === 2 && (
            <div>
              {/* Seção: Descrição do Controle */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#00203E',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #CC915E'
                }}>
                  1. Descrição do Controle
                </div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#00203E',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Descrição do Controle <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <textarea
                  value={descControle}
                  onChange={e => setDescControle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Como o risco é mitigado?"
                />
              </div>

              {/* Seção: 6 Características (grid 2×3) */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#00203E',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #CC915E'
                }}>
                  2. Características do Controle
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  {[
                    { label: 'Categoria', state: [cat, setCat], options: ['Revisão gerencial', 'Reconciliação', 'Autorização', 'Formalização', 'Configuração', 'Segregação de função', 'Relatório de exceção', 'Acesso Sistêmico', 'Interface/conversão', 'Políticas/Procedimentos', 'Indicadores de Performance'] },
                    { label: 'Frequência', state: [freq, setFreq], options: ['Sob demanda', 'Múltiplas vezes ao dia', 'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'] },
                    { label: 'Natureza', state: [nat, setNat], options: ['Preventivo', 'Detectivo', 'Corretivo'] },
                    { label: 'Característica', state: [car, setCar], options: ['Manual', 'Automático', 'Semi-automatizado'] },
                    { label: 'Sistema', state: [sis, setSis], options: sistemas.map(s => s.nome) },
                    { label: 'Controle Chave', state: [chave, setChave], options: ['Controle Chave', 'Controle Compensatório'] }
                  ].map((field, idx) => (
                    <div key={idx}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        {field.label} <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      <select
                        value={field.state[0]}
                        onChange={e => field.state[1](e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          border: '1px solid #D0D0D0',
                          borderRadius: '4px',
                          fontFamily: 'Montserrat, sans-serif',
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Selecionar...</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção: 6 Premissas (grid 2×3) */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#00203E',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #CC915E'
                }}>
                  3. Premissas do Controle
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  {[
                    { label: '1. Quem faz?', state: [quem, setQuem], type: 'text', disabled: isAutomatic },
                    { label: '2. Quando faz?', state: [quando, setQuando], type: 'text' },
                    { label: '3. Por quê faz?', state: [porque, setPorque], type: 'textarea' },
                    { label: '4. Como faz?', state: [como, setComo], type: 'textarea' },
                    { label: '5. Onde faz?', state: [onde, setOnde], type: 'text' },
                    { label: '6. Qual o resultado?', state: [resultadoPremissa, setResultadoPremissa], type: 'textarea' }
                  ].map((field, idx) => (
                    <div key={idx}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        {field.label} <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      {field.type === 'text' ? (
                        <input
                          type="text"
                          value={field.state[0]}
                          onChange={e => field.state[1](e.target.value)}
                          disabled={field.disabled}
                          style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #D0D0D0',
                            borderRadius: '4px',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '14px',
                            background: field.disabled ? '#F5F5F5' : 'white',
                            opacity: field.disabled ? 0.6 : 1
                          }}
                          placeholder={field.disabled ? 'N/A (Automatizado)' : ''}
                        />
                      ) : (
                        <textarea
                          value={field.state[0]}
                          onChange={e => field.state[1](e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #D0D0D0',
                            borderRadius: '4px',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '14px',
                            minHeight: '60px',
                            resize: 'vertical'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ─────────── PASSO 3: Avaliação ─────────── */}
          {step === 3 && (
            <div>
              {/* Context Card */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Ref. Risco</div>
                    <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{novoRiscoData?.rr}</div>
                  </div>
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Ref. Controle</div>
                    <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{novoRiscoData?.rc}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Subprocesso</div>
                    <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{subprocesso}</div>
                  </div>
                </div>
              </div>

              {/* Resultado do Teste */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#00203E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #CC915E' }}>
                  1. Resultado da Análise
                </div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#00203E', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Qual foi o resultado? <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {[
                    { value: 'efetivo', label: 'Efetivo', badge: '#E8F5E9', badgeText: '#1B5E20', badgeLabel: 'Testado' },
                    { value: 'inefetivo', label: 'Inefetivo', badge: '#FFF3E0', badgeText: '#E65100', badgeLabel: 'Falhou' },
                    { value: 'gap', label: 'GAP', badge: '#FFEBEE', badgeText: '#C62828', badgeLabel: 'Sem Controle' }
                  ].map(opt => (
                    <div key={opt.value} onClick={() => handleResultadoChange(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', border: resultado === opt.value ? '2px solid #CC915E' : '1px solid #E0E0E0', borderRadius: '4px', background: resultado === opt.value ? '#F9F7F3' : 'white', cursor: 'pointer' }}>
                      <input type="radio" name="resultado" value={opt.value} checked={resultado === opt.value} onChange={() => {}} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#CC915E' }} />
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{opt.label}</span>
                      <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '3px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', background: opt.badge, color: opt.badgeText }}>{opt.badgeLabel}</span>
                    </div>
                  ))}
                </div>
              </div>

              {showInconsistenciaAlert && (
                <div style={{ background: '#FFF3E0', borderLeft: '3px solid #F57C00', padding: '0.8rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '12px', color: '#E65100' }}>
                  ⚠️ Ao mudar o resultado do teste, as informações do campo "Inconsistências" serão perdidas
                </div>
              )}

              {showInconsistencia && (
                <div style={{ background: '#F9F7F3', borderLeft: '3px solid #CC915E', padding: '1.5rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#00203E', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.5px' }}>Inconsistência Identificada</div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#00203E', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Qual inconsistência foi encontrada? <span style={{ color: '#E24B4A' }}>*</span>
                  </label>
                  <textarea value={inconsistencia} onChange={e => setInconsistencia(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #D0D0D0', borderRadius: '4px', fontFamily: 'Montserrat, sans-serif', fontSize: '14px', minHeight: '80px', resize: 'vertical' }} placeholder="Descrever falha..." />
                </div>
              )}

              {/* Melhoria */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#00203E', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Melhoria identificada?</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }].map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="melhoria" value={opt.value} checked={melhoria === opt.value} onChange={e => setMelhoria(e.target.value)} style={{ accentColor: '#CC915E' }} />
                      <span style={{ fontSize: '14px' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {showDescMelhoria && (
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#00203E', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Descrição da melhoria <span style={{ color: '#E24B4A' }}>*</span>
                  </label>
                  <textarea value={descMelhoria} onChange={e => setDescMelhoria(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #D0D0D0', borderRadius: '4px', fontFamily: 'Montserrat, sans-serif', fontSize: '14px', minHeight: '80px', resize: 'vertical' }} placeholder="Melhorias identificadas..." />
                </div>
              )}

              {/* Criticidade */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#00203E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #CC915E' }}>
                  2. Avaliação da Criticidade
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#00203E', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Impacto <span style={{ color: '#E24B4A' }}>*</span>
                    </label>
                    <select value={impacto} onChange={e => setImpacto(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #D0D0D0', borderRadius: '4px', fontFamily: 'Montserrat, sans-serif', fontSize: '14px' }}>
                      <option value="">Selecionar...</option>
                      <option value="1">Baixo</option><option value="2">Moderado</option><option value="3">Alto</option><option value="4">Crítico</option><option value="0">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#00203E', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Probabilidade <span style={{ color: '#E24B4A' }}>*</span>
                    </label>
                    <select value={probabilidade} onChange={e => setProbabilidade(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #D0D0D0', borderRadius: '4px', fontFamily: 'Montserrat, sans-serif', fontSize: '14px' }}>
                      <option value="">Selecionar...</option>
                      <option value="1">Baixa</option><option value="2">Média</option><option value="3">Alta</option><option value="4">Extrema</option><option value="0">N/A</option>
                    </select>
                  </div>
                </div>
                {criticidade && (
                  <div style={{ background: '#F3EEE4', border: '1px solid #E0D5C7', padding: '1rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', background: getCriticidadeLabel(criticidade).color, color: getCriticidadeLabel(criticidade).colorText }}>{getCriticidadeLabel(criticidade).label}</span>
                    <span style={{ fontSize: '13px', color: '#7A8B9C', fontWeight: 500 }}>Criticidade: {criticidade} (Impacto {impacto} × Prob {probabilidade})</span>
                  </div>
                )}
              </div>

              {/* Teste de Desenho (se Inefetivo/GAP) */}
              {showPA && (
                <div style={{
                  background: '#F9F7F3',
                  borderLeft: '3px solid #CC915E',
                  padding: '1.5rem',
                  borderRadius: '4px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#00203E',
                    textTransform: 'uppercase',
                    marginBottom: '1rem',
                    letterSpacing: '0.5px'
                  }}>
                    6. Teste de Desenho
                  </div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#00203E',
                    marginBottom: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    Haverá plano de ação? <span style={{ color: '#E24B4A' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    {[
                      { value: 'sim', label: 'Sim' },
                      { value: 'nao', label: 'Não' }
                    ].map(opt => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="temPA"
                          value={opt.value}
                          checked={temPA === opt.value}
                          onChange={e => setTemPA(e.target.value)}
                          style={{ accentColor: '#CC915E' }}
                        />
                        <span style={{ fontSize: '14px' }}>{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {temPA === 'sim' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#00203E',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          Descrição da ação <span style={{ color: '#E24B4A' }}>*</span>
                        </label>
                        <textarea
                          value={paDesc}
                          onChange={e => setPaDesc(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #D0D0D0',
                            borderRadius: '4px',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '14px',
                            minHeight: '60px',
                            resize: 'vertical'
                          }}
                          placeholder="O que será feito?"
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#00203E',
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px'
                          }}>
                            Responsável <span style={{ color: '#E24B4A' }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={paResp}
                            onChange={e => setPaResp(e.target.value)}
                            placeholder="Nome do responsável..."
                            style={{
                              width: '100%',
                              padding: '0.8rem',
                              border: '1px solid #D0D0D0',
                              borderRadius: '4px',
                              fontFamily: 'Montserrat, sans-serif',
                              fontSize: '14px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#00203E',
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px'
                          }}>
                            Prazo <span style={{ color: '#E24B4A' }}>*</span>
                          </label>
                          <input
                            type="date"
                            value={paPrazo}
                            onChange={e => setPaPrazo(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.8rem',
                              border: '1px solid #D0D0D0',
                              borderRadius: '4px',
                              fontFamily: 'Montserrat, sans-serif',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#00203E',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          Status <span style={{ color: '#E24B4A' }}>*</span>
                        </label>
                        <select
                          value={paStatus}
                          onChange={e => setPaStatus(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #D0D0D0',
                            borderRadius: '4px',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '14px'
                          }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="desenvolvimento">Em Desenvolvimento</option>
                          <option value="efetivo">Efetivo</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {temPA === 'nao' && (
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        Por que não haverá plano de ação? <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      <textarea
                        value={justificativaPA}
                        onChange={e => setJustificativaPA(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          border: '1px solid #D0D0D0',
                          borderRadius: '4px',
                          fontFamily: 'Montserrat, sans-serif',
                          fontSize: '14px',
                          minHeight: '60px',
                          resize: 'vertical'
                        }}
                        placeholder="Justificar ausência de PA..."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* old step 3 removed — avaliação agora está no novo passo 3 acima */}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', gap: 8, padding: 24, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E' }}>
            Cancelar
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
    </div>
  )
}

export default ModalNovoRisco
