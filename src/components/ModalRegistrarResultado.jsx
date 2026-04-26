import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getFaseAtual } from '../lib/fases'

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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--navy)', color: 'white' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Registrar Resultado do Teste</div>
            <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{row?.area} — {row?.sub} — {row?.rr}</div>
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
              <div style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{notaReprovacao.nota}"
              </div>
              <div style={{ fontSize: 10, color: '#7A8B9C', marginTop: 6 }}>
                Reprovado por <strong style={{ color: '#7A8B9C' }}>{notaReprovacao.autor?.nome || '—'}</strong> em{' '}
                {new Date(notaReprovacao.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}<span style={{ color: 'var(--copper)' }}>{faseAtual}</span>
              </div>
            </div>
          )}

          {/* Seção: Resultado */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--navy)',
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
              color: 'var(--navy)',
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
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--copper)' }}
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
                color: 'var(--navy)',
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
                color: 'var(--navy)',
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
              color: 'var(--navy)',
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
                    style={{ accentColor: 'var(--copper)' }}
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
                color: 'var(--navy)',
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
              color: 'var(--navy)',
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
                  color: 'var(--navy)',
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
                  color: 'var(--navy)',
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
                <span style={{ fontSize: '13px', color: '#7A8B9C', fontWeight: 500 }}>
                  Criticidade: {criticidade} (Impacto {impacto} × Prob {probabilidade}) / {getCriticidadeLabel(criticidade).label}
                </span>
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
                color: 'var(--navy)',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                letterSpacing: '0.5px'
              }}>
                3. Teste de Desenho
              </div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--navy)',
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
                      style={{ accentColor: 'var(--copper)' }}
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
                      color: 'var(--navy)',
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
                        color: 'var(--navy)',
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
                        color: 'var(--navy)',
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
                      color: 'var(--navy)',
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
                    color: 'var(--navy)',
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
          color: 'var(--navy)'
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
          <button onClick={onClose} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: 'var(--navy)' }}>
            Cancelar
          </button>
          <button onClick={saveOnly} disabled={!canSave || saving || submitting} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: 'var(--navy)', opacity: !canSave || saving || submitting ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={saveAndSubmit} disabled={!canSave || saving || submitting} style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--copper)', color: 'white', opacity: !canSave || saving || submitting ? 0.5 : 1 }}>
            {submitting ? 'Submetendo...' : (row?.status_workflow === 'reprovado' ? 'Salvar e reenviar' : 'Salvar e submeter')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalRegistrarResultado
