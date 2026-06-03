import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getFaseAtual } from '../lib/fases'
import { logAprovar, logDevolver } from '../lib/auditLog'
import { CRIT_MAP } from './modalRevisar/_consts'
import { S } from './modalRevisar/styles'
import { BLOCO_LABEL, blocosAplicaveis, faseDoBloco, loadAprovacoes, setBlocoStatus, deriveStatusGeral, ensureBlocos } from '../lib/aprovacoesBloco'
import { useConfirm } from './ConfirmDialog'


const ModalRevisar = ({ row, onClose, onAction, projeto }) => {
  const { user, perfil } = useAuth()
  const [view, setView] = useState('review') // review | approve | reject | history
  const [nota, setNota] = useState('')
  const [notaAprovar, setNotaAprovar] = useState('')
  const [processing, setProcessing] = useState(false)
  const [historico, setHistorico] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [submetidoPorNome, setSubmetidoPorNome] = useState(null)
  const [consultorResponsavelNome, setConsultorResponsavelNome] = useState(null)
  const [blocoAlvo, setBlocoAlvo] = useState(null)
  const [aprovacoes, setAprovacoes] = useState([])
  const { confirm } = useConfirm()
  const [dirty, setDirty] = useState(false)
  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({ title: 'Descartar alterações?', message: 'Há alterações não salvas neste formulário. Deseja fechar mesmo assim? As alterações serão perdidas.', confirmText: 'Descartar', cancelText: 'Continuar editando', variant: 'danger' })
      if (!ok) return
    }
    onClose?.()
  }

  // Bloqueio de auto-revisão — consultor não revisa o que ele mesmo importou/submeteu.
  // Admin sempre pode revisar.
  const isAdmin = perfil?.papel === 'admin_polimata'
  const isAutoRevisao = !!(row?.submetido_por && user?.id && row.submetido_por === user.id)
  const bloqueado = isAutoRevisao && !isAdmin

  const faseAtual = getFaseAtual(row || {})
  const isDiag = projeto?.f1_tem_teste === false
  const faseDisplay = isDiag ? `${faseAtual} — Indagação` : faseAtual
  const crit = CRIT_MAP[row?.crit] || { label: '—', bg: '#EEE', color: '#7A8B9C' }

  // Carregar histórico
  useEffect(() => {
    if (row?.id) loadHistorico()
  }, [row?.id])

  useEffect(() => {
    if (row?.id) ensureBlocos(row, projeto).then(setAprovacoes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id])

  useEffect(() => {
    if (!row?.submetido_por) { setSubmetidoPorNome(null); return }
    supabase.from('perfis').select('nome').eq('id', row.submetido_por).maybeSingle()
      .then(({ data }) => setSubmetidoPorNome(data?.nome || null))
  }, [row?.submetido_por])

  useEffect(() => {
    if (!row?.consultor_id) { setConsultorResponsavelNome(null); return }
    supabase.from('perfis').select('nome').eq('id', row.consultor_id).maybeSingle()
      .then(({ data }) => setConsultorResponsavelNome(data?.nome || null))
  }, [row?.consultor_id])

  async function loadHistorico() {
    setLoadingHist(true)
    const { data } = await supabase
      .from('revisoes')
      .select('*, autor:perfis!autor_id(nome)')
      .eq('mrc_id', row.id)
      .order('criado_em', { ascending: false })
    setHistorico(data || [])
    setLoadingHist(false)
  }

  // ═══ APROVAR BLOCO ═══
  async function handleAprovar() {
    if (!blocoAlvo) return
    setProcessing(true)
    try {
      const fase = faseDoBloco(blocoAlvo, row)
      await setBlocoStatus({ mrcId: row.id, bloco: blocoAlvo, fase, status: 'aprovado', revisorId: user?.id, nota: notaAprovar })
      const aps = await loadAprovacoes(row.id)
      setAprovacoes(aps)
      const geral = deriveStatusGeral(aps, row, projeto)

      const updates = { status_workflow: geral }
      if (geral === 'aprovado') { updates.aprovado_por = user?.id; updates.aprovado_em = new Date().toISOString() }
      await supabase.from('mrc').update(updates).eq('id', row.id)

      await supabase.from('revisoes').insert({
        mrc_id: row.id, autor_id: user?.id, tipo: 'aprovacao',
        nota: `[${BLOCO_LABEL[blocoAlvo]}] ${notaAprovar || ''}`.trim(),
        status_antes: 'em_revisao', status_depois: geral, fase: faseAtual,
      })

      if (geral === 'aprovado') {
        const destinatarioId = row.consultor_id || row.submetido_por
        if (destinatarioId) {
          await supabase.from('notificacoes').insert({
            para_id: destinatarioId, de_id: user?.id, tipo: 'aprovacao',
            titulo: `Análise aprovada — ${row.rc || row.rr}`,
            mensagem: `${row.rc} (${row.area}) foi aprovado na fase ${faseAtual}. Todos os blocos foram aprovados.`,
            lida: false, mrc_id: row.id,
          })
          supabase.functions.invoke('send-email', {
            body: { type: 'review_completed', data: { autor_id: destinatarioId, revisor_id: user?.id, ref: row.rc || row.rr, resultado: 'aprovado', nota: notaAprovar || '', area_id: row.area_id } }
          }).catch(err => console.error('Erro ao enviar email:', err))
        }
        logAprovar(row, row.projeto_id)
        onAction?.('aprovado')
        onClose?.()
      } else {
        // ainda há blocos pendentes — volta pra revisão para tratar os demais
        setNotaAprovar(''); setBlocoAlvo(null); setDirty(false); setView('review')
        onAction?.('parcial')
      }
    } catch (err) {
      console.error('Erro ao aprovar bloco:', err)
      alert('Erro ao aprovar. Tente novamente.')
    } finally {
      setProcessing(false)
    }
  }

  // ═══ REPROVAR BLOCO ═══
  async function handleReprovar() {
    if (!blocoAlvo) return
    if (!nota.trim()) return alert('A nota de reprovação é obrigatória.')
    setProcessing(true)
    try {
      const fase = faseDoBloco(blocoAlvo, row)
      await setBlocoStatus({ mrcId: row.id, bloco: blocoAlvo, fase, status: 'reprovado', revisorId: user?.id, nota })
      const aps = await loadAprovacoes(row.id)
      setAprovacoes(aps)
      // Reprovar qualquer bloco devolve o controle para o consultor
      await supabase.from('mrc').update({ status_workflow: 'reprovado' }).eq('id', row.id)

      await supabase.from('revisoes').insert({
        mrc_id: row.id, autor_id: user?.id, tipo: 'reprovacao',
        nota: `[${BLOCO_LABEL[blocoAlvo]}] ${nota}`,
        status_antes: 'em_revisao', status_depois: 'reprovado', fase: faseAtual,
      })

      const destinatarioId = row.consultor_id || row.submetido_por
      if (destinatarioId) {
        await supabase.from('notificacoes').insert({
          para_id: destinatarioId, de_id: user?.id, tipo: 'reprovacao',
          titulo: `Análise reprovada — ${row.rc || row.rr}`,
          mensagem: `Bloco "${BLOCO_LABEL[blocoAlvo]}" de ${row.rc} (${row.area}) foi reprovado na fase ${faseAtual}. Motivo: ${nota.substring(0, 100)}${nota.length > 100 ? '...' : ''}`,
          lida: false, mrc_id: row.id,
        })
        supabase.functions.invoke('send-email', {
          body: { type: 'review_completed', data: { autor_id: destinatarioId, revisor_id: user?.id, ref: row.rc || row.rr, resultado: 'reprovado', nota: `[Bloco: ${BLOCO_LABEL[blocoAlvo]}] ${nota}`, area_id: row.area_id } }
        }).catch(err => console.error('Erro ao enviar email:', err))
      }

      logDevolver(row, nota, row.projeto_id)
      onAction?.('reprovado')
      onClose?.()
    } catch (err) {
      console.error('Erro ao reprovar bloco:', err)
      alert('Erro ao reprovar. Tente novamente.')
    } finally {
      setProcessing(false)
    }
  }

  // ═══ VIEW: CONFIRMAR APROVAÇÃO ═══
  if (view === 'approve') return (
    <div style={S.overlay} onChangeCapture={() => setDirty(true)}>
      <div style={S.modal}>
        <div style={{ ...S.header, borderBottomColor: '#22C55E' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3 }}>✅ Confirmar Aprovação</h2>
          <p style={{ margin: '0.3rem 0 0', fontSize: 11, opacity: 0.8 }}>{row?.rc} — {blocoAlvo ? `Bloco: ${BLOCO_LABEL[blocoAlvo]}` : (row?.dr || row?.area)} — {faseDisplay}</p>
        </div>
        <div style={S.body}>
          <div style={{ background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: 6, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 12, color: '#1B5E20', lineHeight: 1.6 }}>
              Ao aprovar, o resultado será incorporado no cálculo de maturidade e o cliente passará a ver o controle como <strong>Concluído</strong> nesta fase.
            </div>
          </div>
          <div>
            <label style={S.label}>Nota do revisor <span style={{ fontWeight: 400, color: '#BBB' }}>(opcional)</span></label>
            <textarea value={notaAprovar} onChange={e => setNotaAprovar(e.target.value)} placeholder="Observações..." style={{ width: '100%', padding: '0.7rem', border: '1px solid #D0D0D0', borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontSize: 13, minHeight: 60, resize: 'vertical', marginTop: 4 }} />
          </div>
        </div>
        <div style={S.footer}>
          <button onClick={() => setView('review')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#7A8B9C' }}>Voltar</button>
          <button onClick={handleAprovar} disabled={processing} style={{ ...S.btn, border: '1px solid #22C55E', background: '#22C55E', color: 'white', opacity: processing ? 0.5 : 1 }}>
            {processing ? 'Aprovando...' : '✅ Confirmar Aprovação'}
          </button>
        </div>
      </div>
    </div>
  )

  // ═══ VIEW: CONFIRMAR REPROVAÇÃO ═══
  if (view === 'reject') return (
    <div style={S.overlay} onChangeCapture={() => setDirty(true)}>
      <div style={S.modal}>
        <div style={{ ...S.header, borderBottomColor: '#EF4444' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3 }}>↩ Reprovar Análise</h2>
          <p style={{ margin: '0.3rem 0 0', fontSize: 11, opacity: 0.8 }}>{row?.rc} — {blocoAlvo ? `Bloco: ${BLOCO_LABEL[blocoAlvo]}` : (row?.dr || row?.area)} — {faseDisplay}</p>
        </div>
        <div style={S.body}>
          <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 6, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 12, color: '#C62828', lineHeight: 1.6 }}>
              O controle voltará para o consultor, que será notificado no sistema e por email. Ele poderá editar e reenviar para revisão.
            </div>
          </div>
          <div>
            <label style={S.label}>Motivo da reprovação <span style={{ color: '#E24B4A' }}>*</span></label>
            <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Descreva o que precisa ser corrigido..." style={{ width: '100%', padding: '0.7rem', border: `1px solid ${nota.trim() ? '#D0D0D0' : '#E24B4A'}`, borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontSize: 13, minHeight: 80, resize: 'vertical', marginTop: 4 }} />
            <div style={{ fontSize: 10, color: '#7A8B9C', marginTop: 4, textAlign: 'right' }}>{nota.length} caracteres</div>
          </div>
        </div>
        <div style={S.footer}>
          <button onClick={() => setView('review')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#7A8B9C' }}>Voltar</button>
          <button onClick={handleReprovar} disabled={processing || !nota.trim()} style={{ ...S.btn, border: '1px solid #EF4444', background: '#EF4444', color: 'white', opacity: processing || !nota.trim() ? 0.5 : 1 }}>
            {processing ? 'Reprovando...' : '↩ Confirmar Reprovação'}
          </button>
        </div>
      </div>
    </div>
  )

  // ═══ VIEW: HISTÓRICO ═══
  if (view === 'history') return (
    <div style={S.overlay} onChangeCapture={() => setDirty(true)}>
      <div style={S.modal}>
        <div style={S.header}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3 }}>📋 Histórico de Revisões — {row?.rc}</h2>
        </div>
        <div style={S.body}>
          {loadingHist ? <div style={{ textAlign: 'center', padding: 20, color: '#7A8B9C' }}>Carregando...</div> :
            historico.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#7A8B9C' }}>Nenhuma revisão registrada.</div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {historico.map((h, i) => {
                const tipo = h.tipo
                const cor = tipo === 'aprovacao' ? '#22C55E' : tipo === 'reprovacao' ? '#EF4444' : '#3B82F6'
                const icon = tipo === 'aprovacao' ? '✅' : tipo === 'reprovacao' ? '↩' : '📤'
                const label = tipo === 'aprovacao' ? 'Aprovado' : tipo === 'reprovacao' ? 'Reprovado' : 'Submetido'
                return (
                  <div key={h.id || i} style={{ padding: '12px 0', borderBottom: i < historico.length - 1 ? '1px solid #F0EBE4' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>{icon} {label}</span>
                      <span style={{ fontSize: 11, color: '#7A8B9C' }}>por {h.autor?.nome || 'Desconhecido'}</span>
                      {h.fase && <span style={{ fontSize: 10, fontWeight: 400, color: '#CC915E', background: 'rgba(204,145,94,0.1)', padding: '1px 6px', borderRadius: 3 }}>{h.fase}</span>}
                    </div>
                    {h.nota && <div style={{ fontSize: 12, color: '#00203E', lineHeight: 1.5, paddingLeft: 4, fontStyle: 'italic' }}>"{h.nota}"</div>}
                    <div style={{ fontSize: 10, color: '#7A8B9C', marginTop: 4 }}>
                      {new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>}
        </div>
        <div style={S.footer}>
          <button onClick={() => setView('review')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#7A8B9C' }}>Voltar</button>
        </div>
      </div>
    </div>
  )

  // ═══ VIEW: REVISÃO PRINCIPAL ═══
  return (
    <div style={S.overlay} onChangeCapture={() => setDirty(true)}>
      <div style={S.modal}>
        <div style={{ ...S.header, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3 }}>🔍 Revisão de Análise</h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: 11, opacity: 0.8 }}>{row?.rc} · {row?.rr} — {row?.dr || row?.area}</p>
          </div>
          <button onClick={requestClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: 28, cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        <div style={S.body}>
          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: '1rem' }}>
            <div style={S.section}>
              <div style={S.label}>Resultado</div>
              <div style={{ marginTop: 4 }}>
                {(() => {
                  // Suporta projeto com teste (r1: efetivo/inefetivo/gap) e diagnóstico (existencia: Existente/Parcial/Inexistente)
                  const valor = row?.r1 || row?.existencia
                  if (!valor) return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, color: '#7A8B9C' }}>—</span>
                  const v = String(valor).toLowerCase()
                  let bg = '#FFF3E0', color = '#E65100'
                  if (v === 'efetivo' || v === 'existente') { bg = '#E8F5E9'; color = '#1B5E20' }
                  else if (v === 'gap' || v === 'inexistente') { bg = '#FFEBEE'; color = '#C62828' }
                  // 'inefetivo' e 'parcial' caem no laranja (default)
                  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: bg, color }}>{valor}</span>
                })()}
              </div>
            </div>
            <div style={S.section}>
              <div style={S.label}>Criticidade</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 600, background: crit.bg, color: crit.color }}>
                  {row?.crit ? `${row.crit}. ${crit.label}` : '—'}
                </span>
              </div>
            </div>
            <div style={S.section}>
              <div style={S.label}>Fase</div>
              <div style={{ ...S.value, fontSize: 11, color: '#CC915E', fontWeight: 600 }}>{faseDisplay}</div>
            </div>
          </div>

          {/* Aprovação por bloco (itens 10/13) */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Aprovação por bloco</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {blocosAplicaveis(projeto).map(b => {
                const f = faseDoBloco(b, row)
                const ap = aprovacoes.find(e => e.bloco === b && (e.fase || null) === (f || null))
                const st = ap?.status || 'a_aprovar'
                const cfg = st === 'aprovado' ? { t: 'Aprovado', c: '#1B5E20', bg: '#E8F5E9' }
                          : st === 'reprovado' ? { t: 'Reprovado', c: '#C62828', bg: '#FFEBEE' }
                          : { t: 'A aprovar', c: '#92400E', bg: 'rgba(234,179,8,0.18)' }
                return (
                  <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #ECECEC', borderRadius: 6, background: '#FAFAFA' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#00203E', minWidth: 90 }}>{BLOCO_LABEL[b]}{b === 'teste' && f ? ` (${f})` : ''}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.c, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{cfg.t}</span>
                    {ap?.data_acao && <span style={{ fontSize: 10, color: '#7A8B9C' }}>{new Date(ap.data_acao).toLocaleDateString('pt-BR')}</span>}
                    {!bloqueado && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => { setBlocoAlvo(b); setNota(''); setView('reject') }} style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'white', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>↩ Reprovar</button>
                        <button onClick={() => { setBlocoAlvo(b); setNotaAprovar(''); setView('approve') }} style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#22C55E', border: '1px solid #22C55E', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>✅ Aprovar</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Submissão */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Submissão</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><div style={S.label}>Submetido por</div><div style={S.value}>{submetidoPorNome || (row?.submetido_por ? '—' : '—')}</div></div>
              <div><div style={S.label}>Submetido em</div><div style={S.value}>{row?.submetido_em ? new Date(row.submetido_em).toLocaleString('pt-BR') : '—'}</div></div>
              <div><div style={S.label}>Consultor responsável</div><div style={S.value}>{consultorResponsavelNome || '—'}</div></div>
            </div>
          </div>

          {/* Identificação */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Identificação</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><div style={S.label}>Ref. Risco</div><div style={S.value}>{row?.rr || '—'}</div></div>
              <div><div style={S.label}>Ref. Controle</div><div style={S.value}>{row?.rc || '—'}</div></div>
              <div><div style={S.label}>Área</div><div style={S.value}>{row?.area || '—'}</div></div>
              <div><div style={S.label}>Subprocesso</div><div style={S.value}>{row?.sub || '—'}</div></div>
              <div><div style={S.label}>Gerência</div><div style={S.value}>{row?.ger || '—'}</div></div>
              <div><div style={S.label}>Responsável Processo</div><div style={S.value}>{row?.resp_sub || '—'}</div></div>
            </div>
          </div>

          {/* Cenário Atual — F1-E1 (Indagação). Sempre visível pra revisão;
              quando vazio, destaca em vermelho pra admin/gerente reprovar
              e devolver pra consultora preencher. */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cenário Atual <span style={{ fontSize: 9, color: '#7A8B9C', fontWeight: 500, marginLeft: 6 }}>(como o processo é feito hoje)</span></div>
            {row?.cenario_atual && row.cenario_atual.trim() ? (
              <div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row.cenario_atual}</div>
            ) : (
              <div style={{
                background: '#FFEBEE', borderLeft: '3px solid #C62828',
                padding: '10px 14px', borderRadius: 4,
                fontSize: 12, fontWeight: 600, color: '#C62828',
                fontStyle: 'italic',
              }}>
                ⚠ Cenário Atual não preenchido. Recomendado reprovar e devolver pra consultora preencher antes de aprovar.
              </div>
            )}
          </div>

          {/* Descrição do Risco */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Descrição do Risco</div>
            <div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.dr || '—'}</div>
          </div>

          {/* Descrição do Controle */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Descrição do Controle</div>
            <div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.dc || '—'}</div>
          </div>

          {/* Atributos do Controle */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Atributos do Controle</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div><div style={S.label}>Categoria</div><div style={S.value}>{row?.cat || '—'}</div></div>
              <div><div style={S.label}>Frequência</div><div style={S.value}>{row?.freq || '—'}</div></div>
              <div><div style={S.label}>Natureza</div><div style={S.value}>{row?.nat || '—'}</div></div>
              <div><div style={S.label}>Característica</div><div style={S.value}>{row?.car || '—'}</div></div>
              <div><div style={S.label}>Sistema</div><div style={S.value}>{row?.sis || '—'}</div></div>
              <div><div style={S.label}>Controle Chave?</div><div style={S.value}>{row?.chave || '—'}</div></div>
            </div>
          </div>

          {/* Resultado / Recomendação */}
          {isDiag ? (
            <div style={S.section}>
              <div style={S.sectionTitle}>Recomendação / Melhoria</div>
              <div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.rec || row?.incons_ader || '—'}</div>
            </div>
          ) : (
            <div style={S.section}>
              <div style={S.sectionTitle}>Resultado da Análise</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><div style={S.label}>Inconsistência</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.incons || '—'}</div></div>
                <div><div style={S.label}>Recomendação / Melhoria</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.incons_ader || row?.rec || '—'}</div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><div style={S.label}>Impacto</div><div style={S.value}>{row?.imp || '—'}</div></div>
                  <div><div style={S.label}>Probabilidade</div><div style={S.value}>{row?.prob || '—'}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* Premissas */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Premissas do Controle</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><div style={S.label}>Quem</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.premissa_quem || '—'}</div></div>
              <div><div style={S.label}>Quando</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.premissa_quando || '—'}</div></div>
              <div><div style={S.label}>Onde</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.premissa_onde || '—'}</div></div>
              <div><div style={S.label}>Como</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.premissa_como || '—'}</div></div>
              <div><div style={S.label}>Por que</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.premissa_porque || '—'}</div></div>
              <div><div style={S.label}>Resultado esperado</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.premissa_resultado || '—'}</div></div>
            </div>
          </div>

          {/* Teste de Desenho */}
          {row?.dem_pa && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Teste de Desenho</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><div style={S.label}>Descrição</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row.dem_pa}</div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div><div style={S.label}>Responsável</div><div style={S.value}>{row?.resp_pa || '—'}</div></div>
                  <div><div style={S.label}>Prazo</div><div style={S.value}>{row?.dt_pa || '—'}</div></div>
                  <div><div style={S.label}>Status</div><div style={S.value}>{row?.st_pa || '—'}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* Ficha */}
          {row?.arquivo_ficha_url && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Ficha de Risco</div>
              <a href={row.arquivo_ficha_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#CC915E', fontWeight: 500 }}>
                📄 Abrir ficha
              </a>
            </div>
          )}

          {/* Botão de histórico */}
          <button onClick={() => setView('history')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#7A8B9C', width: '100%', textAlign: 'center', marginTop: 4 }}>
            📋 Ver Histórico de Revisões ({historico.length})
          </button>
        </div>

        {/* Aviso de auto-revisão */}
        {bloqueado && (
          <div style={{ background: '#FFF8E1', border: '1px solid #F0C419', borderRadius: 6, padding: '10px 14px', margin: '0 24px 8px', fontSize: 12, color: '#7A5C00', lineHeight: 1.5 }}>
            ⚠ Você importou ou submeteu este controle. Para garantir segregação de função, apenas um <strong>admin Polímata</strong> pode aprovar ou devolver controles que você mesmo subiu.
          </div>
        )}

        {/* Footer com ações */}
        <div style={S.footer}>
          <button onClick={requestClose} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#7A8B9C' }}>Fechar</button>
          {/* Aprovação agora é por bloco (painel acima). */}
        </div>
      </div>
    </div>
  )
}

export default ModalRevisar
