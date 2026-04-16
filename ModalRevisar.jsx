import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Helper: nomes completos das fases
function getFaseAtual(c) {
  if (c.r_f5 && c.r_f5 !== 'Teste Não Realizado') return 'Auditoria Independente'
  if (c.r_f4c2 && c.r_f4c2 !== 'Teste Não Realizado') return 'Auditoria Contínua'
  if (c.r_f4c1 && c.r_f4c1 !== 'Teste Não Realizado') return 'Auditoria Contínua'
  if (c.r3 && c.r3 !== 'Teste Não Realizado') return 'Controles Internos'
  if (c.r_ader && c.r_ader !== 'Teste Não Realizado') return 'Teste de Aderência'
  if (c.st_pa && c.st_pa !== '') return 'Plano de Ação e Teste de Desenho'
  if (c.r1 && c.r1 !== 'Teste Não Realizado') {
    if (c.r1.toLowerCase() === 'efetivo') return 'Controles Internos'
    return 'Plano de Ação e Teste de Desenho'
  }
  return 'Diagnóstico Inicial'
}

const CRIT_MAP = {
  4: { label: 'Crítico', bg: '#FFEBEE', color: '#C62828' },
  3: { label: 'Significativo', bg: '#FFF3E0', color: '#E65100' },
  2: { label: 'Moderado', bg: '#FFCC80', color: '#E65100' },
  1: { label: 'Baixo', bg: '#E8F5E9', color: '#1B5E20' },
}

const ModalRevisar = ({ row, onClose, onAction }) => {
  const { user } = useAuth()
  const [view, setView] = useState('review') // review | approve | reject | history
  const [nota, setNota] = useState('')
  const [notaAprovar, setNotaAprovar] = useState('')
  const [processing, setProcessing] = useState(false)
  const [historico, setHistorico] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  const faseAtual = getFaseAtual(row || {})
  const crit = CRIT_MAP[row?.crit] || { label: '—', bg: '#EEE', color: '#666' }

  // Carregar histórico
  useEffect(() => {
    if (row?.id) loadHistorico()
  }, [row?.id])

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

  // ═══ APROVAR ═══
  async function handleAprovar() {
    setProcessing(true)
    try {
      // 1. Atualizar MRC
      const { error } = await supabase
        .from('mrc')
        .update({
          status_workflow: 'aprovado',
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (error) throw error

      // 2. Registrar revisão
      await supabase.from('revisoes').insert({
        mrc_id: row.id,
        autor_id: user?.id,
        tipo: 'aprovacao',
        nota: notaAprovar || null,
        status_antes: 'em_revisao',
        status_depois: 'aprovado',
        fase: faseAtual,
      })

      // 3. Notificar consultor que submeteu
      if (row.submetido_por) {
        await supabase.from('notificacoes').insert({
          para_id: row.submetido_por,
          de_id: user?.id,
          tipo: 'aprovacao',
          titulo: `Análise aprovada — ${row.rc || row.rr}`,
          mensagem: `${row.rc} (${row.area}) foi aprovado na fase ${faseAtual}.`,
          lida: false,
          mrc_id: row.id,
        })
      }

      onAction?.('aprovado')
      onClose?.()
    } catch (err) {
      console.error('Erro ao aprovar:', err)
      alert('Erro ao aprovar. Tente novamente.')
    } finally {
      setProcessing(false)
    }
  }

  // ═══ REPROVAR ═══
  async function handleReprovar() {
    if (!nota.trim()) return alert('A nota de reprovação é obrigatória.')
    setProcessing(true)
    try {
      // 1. Atualizar MRC
      const { error } = await supabase
        .from('mrc')
        .update({ status_workflow: 'reprovado' })
        .eq('id', row.id)
      if (error) throw error

      // 2. Registrar revisão
      await supabase.from('revisoes').insert({
        mrc_id: row.id,
        autor_id: user?.id,
        tipo: 'reprovacao',
        nota: nota,
        status_antes: 'em_revisao',
        status_depois: 'reprovado',
        fase: faseAtual,
      })

      // 3. Notificar consultor
      if (row.submetido_por) {
        await supabase.from('notificacoes').insert({
          para_id: row.submetido_por,
          de_id: user?.id,
          tipo: 'reprovacao',
          titulo: `Análise reprovada — ${row.rc || row.rr}`,
          mensagem: `${row.rc} (${row.area}) foi reprovado na fase ${faseAtual}. Motivo: ${nota.substring(0, 100)}${nota.length > 100 ? '...' : ''}`,
          lida: false,
          mrc_id: row.id,
        })
      }

      onAction?.('reprovado')
      onClose?.()
    } catch (err) {
      console.error('Erro ao reprovar:', err)
      alert('Erro ao reprovar. Tente novamente.')
    } finally {
      setProcessing(false)
    }
  }

  const S = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    modal: { background: 'white', borderRadius: 8, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' },
    header: { background: 'linear-gradient(135deg, #00203E 0%, #1D3B5C 100%)', color: '#F3EEE4', padding: '1.25rem 1.5rem', borderBottom: '3px solid #CC915E' },
    body: { padding: '1.5rem', overflowY: 'auto', flex: 1, fontFamily: "'Montserrat', sans-serif" },
    footer: { background: '#FAFAFA', borderTop: '1px solid #E0E0E0', padding: '1rem 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
    label: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
    value: { fontSize: 13, color: '#1D3B5C', fontWeight: 500, marginTop: 2 },
    btn: { padding: '0.7rem 1.2rem', fontSize: 12, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", textTransform: 'uppercase', letterSpacing: 0.3 },
    section: { background: '#F9F7F3', border: '1px solid #E8E2D8', borderRadius: 6, padding: '1rem', marginBottom: '1rem' },
    sectionTitle: { fontSize: 10, fontWeight: 700, color: '#1D3B5C', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #E0D5C7' },
  }

  // ═══ VIEW: CONFIRMAR APROVAÇÃO ═══
  if (view === 'approve') return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal}>
        <div style={{ ...S.header, borderBottomColor: '#22C55E' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>✅ Confirmar Aprovação</h2>
          <p style={{ margin: '0.3rem 0 0', fontSize: 11, opacity: 0.8 }}>{row?.rc} — {row?.area} — {faseAtual}</p>
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
          <button onClick={() => setView('review')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#666' }}>Voltar</button>
          <button onClick={handleAprovar} disabled={processing} style={{ ...S.btn, border: '1px solid #22C55E', background: '#22C55E', color: 'white', opacity: processing ? 0.5 : 1 }}>
            {processing ? 'Aprovando...' : '✅ Confirmar Aprovação'}
          </button>
        </div>
      </div>
    </div>
  )

  // ═══ VIEW: CONFIRMAR REPROVAÇÃO ═══
  if (view === 'reject') return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal}>
        <div style={{ ...S.header, borderBottomColor: '#EF4444' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>↩ Reprovar Análise</h2>
          <p style={{ margin: '0.3rem 0 0', fontSize: 11, opacity: 0.8 }}>{row?.rc} — {row?.area} — {faseAtual}</p>
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
            <div style={{ fontSize: 10, color: '#999', marginTop: 4, textAlign: 'right' }}>{nota.length} caracteres</div>
          </div>
        </div>
        <div style={S.footer}>
          <button onClick={() => setView('review')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#666' }}>Voltar</button>
          <button onClick={handleReprovar} disabled={processing || !nota.trim()} style={{ ...S.btn, border: '1px solid #EF4444', background: '#EF4444', color: 'white', opacity: processing || !nota.trim() ? 0.5 : 1 }}>
            {processing ? 'Reprovando...' : '↩ Confirmar Reprovação'}
          </button>
        </div>
      </div>
    </div>
  )

  // ═══ VIEW: HISTÓRICO ═══
  if (view === 'history') return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal}>
        <div style={S.header}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>📋 Histórico de Revisões — {row?.rc}</h2>
        </div>
        <div style={S.body}>
          {loadingHist ? <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Carregando...</div> :
            historico.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Nenhuma revisão registrada.</div> :
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
                      <span style={{ fontSize: 11, color: '#666' }}>por {h.autor?.nome || 'Desconhecido'}</span>
                      {h.fase && <span style={{ fontSize: 9, fontWeight: 600, color: '#CC915E', background: 'rgba(204,145,94,0.1)', padding: '1px 6px', borderRadius: 3 }}>{h.fase}</span>}
                    </div>
                    {h.nota && <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5, paddingLeft: 4, fontStyle: 'italic' }}>"{h.nota}"</div>}
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                      {new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>}
        </div>
        <div style={S.footer}>
          <button onClick={() => setView('review')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#666' }}>Voltar</button>
        </div>
      </div>
    </div>
  )

  // ═══ VIEW: REVISÃO PRINCIPAL ═══
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>🔍 Revisão de Análise</h2>
              <p style={{ margin: '0.3rem 0 0', fontSize: 11, opacity: 0.8 }}>{row?.rc} · {row?.rr} — {row?.area}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#F3EEE4', fontSize: 20, cursor: 'pointer', padding: 4, opacity: 0.7 }}>✕</button>
          </div>
        </div>
        <div style={S.body}>
          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: '1rem' }}>
            <div style={S.section}>
              <div style={S.label}>Resultado</div>
              <div style={{ marginTop: 4 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  background: row?.r1 === 'efetivo' ? '#E8F5E9' : row?.r1 === 'gap' ? '#FFEBEE' : '#FFF3E0',
                  color: row?.r1 === 'efetivo' ? '#1B5E20' : row?.r1 === 'gap' ? '#C62828' : '#E65100'
                }}>{row?.r1 || '—'}</span>
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
              <div style={{ ...S.value, fontSize: 11, color: '#CC915E', fontWeight: 600 }}>{faseAtual}</div>
            </div>
          </div>

          {/* Submissão */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Submissão</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><div style={S.label}>Submetido por</div><div style={S.value}>{row?.submetido_por || '—'}</div></div>
              <div><div style={S.label}>Submetido em</div><div style={S.value}>{row?.submetido_em ? new Date(row.submetido_em).toLocaleString('pt-BR') : '—'}</div></div>
            </div>
          </div>

          {/* Resultado do Teste */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Resultado do Teste</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><div style={S.label}>Inconsistência</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.incons || '—'}</div></div>
              <div><div style={S.label}>Recomendação / Melhoria</div><div style={{ ...S.value, whiteSpace: 'pre-wrap' }}>{row?.incons_ader || row?.rec || '—'}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={S.label}>Impacto</div><div style={S.value}>{row?.imp || '—'}</div></div>
                <div><div style={S.label}>Probabilidade</div><div style={S.value}>{row?.prob || '—'}</div></div>
              </div>
            </div>
          </div>

          {/* Premissas */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Premissas do Controle</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><div style={S.label}>Quem</div><div style={S.value}>{row?.quem || '—'}</div></div>
              <div><div style={S.label}>Quando</div><div style={S.value}>{row?.quando || '—'}</div></div>
              <div><div style={S.label}>Como</div><div style={S.value}>{row?.como || '—'}</div></div>
            </div>
          </div>

          {/* Plano de Ação */}
          {row?.dem_pa && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Plano de Ação</div>
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
          <button onClick={() => setView('history')} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#666', width: '100%', textAlign: 'center', marginTop: 4 }}>
            📋 Ver Histórico de Revisões ({historico.length})
          </button>
        </div>

        {/* Footer com ações */}
        <div style={S.footer}>
          <button onClick={onClose} style={{ ...S.btn, border: '1px solid #D0D0D0', background: 'white', color: '#666' }}>Fechar</button>
          <button onClick={() => setView('reject')} style={{ ...S.btn, border: '1px solid #EF4444', background: 'white', color: '#EF4444' }}>↩ Reprovar</button>
          <button onClick={() => setView('approve')} style={{ ...S.btn, border: '1px solid #22C55E', background: '#22C55E', color: 'white' }}>✅ Aprovar</button>
        </div>
      </div>
    </div>
  )
}

export default ModalRevisar
