import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Helper: determina nome completo da fase atual do controle
function getFaseAtual(c) {
  if (c.r_f5 && c.r_f5 !== 'Teste Não Realizado') return 'Auditoria Independente'
  if (c.r_f4c2 && c.r_f4c2 !== 'Teste Não Realizado') return 'Auditoria Contínua'
  if (c.r_f4c1 && c.r_f4c1 !== 'Teste Não Realizado') return 'Auditoria Contínua'
  if (c.r3 && c.r3 !== 'Teste Não Realizado') return 'Controles Internos'
  if (c.r_ader && c.r_ader !== 'Teste Não Realizado') return 'Teste de Aderência'
  if (c.st_pa && c.st_pa !== '') return 'Plano de Ação e Teste de Desenho'
  if (c.r1 && c.r1 !== 'Teste Não Realizado') {
    // Se F1 efetivo, pula pra Controles Internos (atalho)
    if (c.r1.toLowerCase() === 'efetivo') return 'Controles Internos'
    return 'Plano de Ação e Teste de Desenho'
  }
  return 'Diagnóstico Inicial'
}

const ModalRegistrarResultado = ({ row, onClose, onSaved, responsaveis }) => {
  // ═══ STATE ═══
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notaReprovacao, setNotaReprovacao] = useState(null)
  const faseAtual = getFaseAtual(row || {})
  const isReprovado = row?.status_workflow === 'reprovado'

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
  const [impacto, setImpacto] = useState(row?.imp?.toString() || '')
  const [probabilidade, setProbabilidade] = useState(row?.prob?.toString() || '')
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

  // ═══ VALIDAÇÃO ═══
  const canSave = resultado &&
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

  // ═══ DADOS COMUNS PARA SALVAR ═══
  function buildUpdatePayload() {
    return {
      r1: resultado,
      incons: resultado !== 'efetivo' ? inconsistencia : null,
      melhoria: melhoria === 'sim' ? true : false,
      incons_ader: melhoria === 'sim' ? descMelhoria : null,
      imp: parseInt(impacto),
      prob: parseInt(probabilidade),
      crit: criticidade,
      crit_label: getCriticidadeLabel(criticidade).label,
      dem_pa: resultado !== 'efetivo' && temPA === 'sim' ? paDesc : null,
      resp_pa: resultado !== 'efetivo' && temPA === 'sim' ? paResp : null,
      dt_pa: resultado !== 'efetivo' && temPA === 'sim' ? paPrazo : null,
      st_pa: resultado !== 'efetivo' && temPA === 'sim' ? paStatus : null,
    }
  }

  // ═══ SALVAR APENAS (mantém status atual, não submete) ═══
  async function saveOnly() {
    setSaving(true)
    try {
      const payload = buildUpdatePayload()
      // Se estava reprovado, manter reprovado; senão manter status atual ou em_analise
      if (!row.status_workflow || row.status_workflow === 'ficha_gerada') {
        payload.status_workflow = 'em_analise'
      }
      // Se reprovado, manter reprovado (consultor só salva, não resubmete ainda)

      const { error } = await supabase
        .from('mrc')
        .update(payload)
        .eq('id', row.id)

      if (error) throw error
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
          status_antes: row.status_workflow || 'ficha_gerada',
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
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '800px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, #00203E 0%, #1D3B5C 100%)',
          color: '#F3EEE4',
          padding: '1.5rem 2rem',
          borderBottom: '3px solid #CC915E'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>Registrar Resultado do Teste</h2>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', opacity: 0.85 }}>
            {row?.area} — {row?.sub} — {row?.rr}
          </p>
        </div>

        {/* BODY */}
        <div style={{
          padding: '2rem',
          overflowY: 'auto',
          flex: 1,
          fontFamily: 'Montserrat, sans-serif'
        }}>
          {/* Banner de reprovação (se aplicável) */}
          {isReprovado && notaReprovacao && (
            <div style={{
              background: '#FFF5F5',
              borderLeft: '4px solid #E24B4A',
              padding: '1rem 1.25rem',
              borderRadius: '4px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#C62828', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                ↩ Análise Reprovada — Ação Necessária
              </div>
              <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{notaReprovacao.nota}"
              </div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
                Reprovado por <strong style={{ color: '#666' }}>{notaReprovacao.autor?.nome || '—'}</strong> em{' '}
                {new Date(notaReprovacao.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}<span style={{ color: '#CC915E' }}>{faseAtual}</span>
              </div>
            </div>
          )}

          {/* Seção: Resultado */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#1D3B5C',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '2px solid #CC915E'
            }}>
              1. Resultado da Execução do Teste
            </div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1D3B5C',
              marginBottom: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Qual foi o resultado? <span style={{ color: '#E24B4A' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {[
                { value: 'efetivo', label: 'Efetivo', badge: '#E8F5E9', badgeText: '#1B5E20', badgeLabel: 'Testado' },
                { value: 'inefetivo', label: 'Inefetivo', badge: '#FFF3E0', badgeText: '#E65100', badgeLabel: 'Falhou' },
                { value: 'gap', label: 'GAP', badge: '#FFEBEE', badgeText: '#C62828', badgeLabel: 'Sem Controle' }
              ].map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleResultadoChange(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.8rem',
                    border: resultado === opt.value ? '2px solid #CC915E' : '1px solid #E0E0E0',
                    borderRadius: '4px',
                    background: resultado === opt.value ? '#F9F7F3' : 'white',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value={opt.value}
                    checked={resultado === opt.value}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#CC915E' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{opt.label}</span>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: opt.badge,
                    color: opt.badgeText
                  }}>
                    {opt.badgeLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerta Inconsistência */}
          {showInconsistenciaAlert && (
            <div style={{
              background: '#FFF3E0',
              borderLeft: '3px solid #F57C00',
              padding: '0.8rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '12px',
              color: '#E65100'
            }}>
              ⚠️ Ao mudar o resultado do teste, as informações do campo "Inconsistências" serão perdidas
            </div>
          )}

          {/* Inconsistência (se Inefetivo/GAP) */}
          {showInconsistencia && (
            <div style={{
              background: '#F9F7F3',
              borderLeft: '3px solid #CC915E',
              padding: '1.5rem',
              borderRadius: '4px',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#1D3B5C',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                letterSpacing: '0.5px'
              }}>
                Inconsistência Identificada
              </div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1D3B5C',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}>
                Qual inconsistência foi encontrada? <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <textarea
                value={inconsistencia}
                onChange={e => setInconsistencia(e.target.value)}
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
                placeholder="Descrever falha..."
              />
            </div>
          )}

          {/* Melhoria (sempre) */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1D3B5C',
              marginBottom: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Melhoria identificada?
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' }
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="melhoria"
                    value={opt.value}
                    checked={melhoria === opt.value}
                    onChange={e => setMelhoria(e.target.value)}
                    style={{ accentColor: '#CC915E' }}
                  />
                  <span style={{ fontSize: '14px' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {showDescMelhoria && (
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1D3B5C',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}>
                Descrição da melhoria <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <textarea
                value={descMelhoria}
                onChange={e => setDescMelhoria(e.target.value)}
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
                placeholder="Melhorias identificadas..."
              />
            </div>
          )}

          {/* Criticidade */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#1D3B5C',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '2px solid #CC915E'
            }}>
              2. Avaliação da Criticidade
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1D3B5C',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Impacto <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <select
                  value={impacto}
                  onChange={e => setImpacto(e.target.value)}
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
                  <option value="1">Baixo</option>
                  <option value="2">Moderado</option>
                  <option value="3">Alto</option>
                  <option value="4">Crítico</option>
                  <option value="0">N/A</option>
                </select>
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1D3B5C',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Probabilidade <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <select
                  value={probabilidade}
                  onChange={e => setProbabilidade(e.target.value)}
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
                  <option value="1">Baixa</option>
                  <option value="2">Média</option>
                  <option value="3">Alta</option>
                  <option value="4">Extrema</option>
                  <option value="0">N/A</option>
                </select>
              </div>
            </div>
            {criticidade && (
              <div style={{
                background: '#F3EEE4',
                border: '1px solid #E0D5C7',
                padding: '1rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  background: getCriticidadeLabel(criticidade).color,
                  color: getCriticidadeLabel(criticidade).colorText
                }}>
                  {getCriticidadeLabel(criticidade).label}
                </span>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 500 }}>
                  Criticidade: {criticidade} (Impacto {impacto} × Prob {probabilidade}) / {getCriticidadeLabel(criticidade).label}
                </span>
              </div>
            )}
          </div>

          {/* Plano de Ação (se Inefetivo/GAP) */}
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
                color: '#1D3B5C',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                letterSpacing: '0.5px'
              }}>
                3. Plano de Ação
              </div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#1D3B5C',
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
                      color: '#1D3B5C',
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
                        color: '#1D3B5C',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        Responsável <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      <select
                        value={paResp}
                        onChange={e => setPaResp(e.target.value)}
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
                        {responsaveis.map(r => (
                          <option key={r.id} value={r.id}>{r.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1D3B5C',
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
                      color: '#1D3B5C',
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
                      <option value="concluido">Concluído</option>
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
                    color: '#1D3B5C',
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

        {/* FASE ATUAL */}
        <div style={{
          background: '#F3EEE4',
          borderTop: '1px solid #E0D5C7',
          padding: '0.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#1D3B5C'
        }}>
          <span>Fase em curso: <strong>{faseAtual}</strong></span>
          {row?.status_workflow === 'reprovado' && (
            <span style={{ color: '#C62828', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>
              ↩ Análise reprovada — edite e reenvie
            </span>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          background: '#FAFAFA',
          borderTop: '1px solid #E0E0E0',
          padding: '1.5rem 2rem',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={saving || submitting}
            style={{
              padding: '0.8rem 1.5rem',
              fontSize: '13px',
              fontWeight: 500,
              border: '1px solid #D0D0D0',
              borderRadius: '4px',
              background: 'white',
              cursor: saving || submitting ? 'not-allowed' : 'pointer',
              opacity: saving || submitting ? 0.5 : 1,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              fontFamily: 'Montserrat, sans-serif'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={saveOnly}
            disabled={!canSave || saving || submitting}
            style={{
              padding: '0.8rem 1.5rem',
              fontSize: '13px',
              fontWeight: 500,
              border: '1px solid #D0D0D0',
              borderRadius: '4px',
              background: 'white',
              color: '#1D3B5C',
              cursor: !canSave || saving || submitting ? 'not-allowed' : 'pointer',
              opacity: !canSave || saving || submitting ? 0.5 : 1,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              fontFamily: 'Montserrat, sans-serif'
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={saveAndSubmit}
            disabled={!canSave || saving || submitting}
            style={{
              padding: '0.8rem 1.5rem',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid #CC915E',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #CC915E 0%, #A6512F 100%)',
              color: 'white',
              cursor: !canSave || saving || submitting ? 'not-allowed' : 'pointer',
              opacity: !canSave || saving || submitting ? 0.5 : 1,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              fontFamily: 'Montserrat, sans-serif'
            }}
          >
            {submitting ? 'Submetendo...' : (row?.status_workflow === 'reprovado' ? '📤 Salvar e Reenviar para Revisão' : '📤 Salvar e Submeter para Revisão')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalRegistrarResultado
