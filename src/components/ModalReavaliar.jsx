// ModalReavaliar — fluxo de reavaliação de controle CONCLUÍDO (aprovado + criticidade).
// 1) Solicitar: justificativa obrigatória → status reavaliacao_pendente + aviso ao gerente/admin.
// 2) Decidir (gerente/admin): libera para edição (status Em Correção) ou recusa (volta a Concluído).
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirm } from './ConfirmDialog'

const ModalReavaliar = ({ row, perfil, modo, onClose, onSaved }) => {
  // modo: 'solicitar' | 'decidir'
  const [justificativa, setJustificativa] = useState('')
  const [saving, setSaving] = useState(false)
  const { confirm } = useConfirm()

  async function solicitar() {
    if (!justificativa.trim()) { alert('A justificativa é obrigatória.'); return }
    setSaving(true)
    try {
      const { data: upd, error } = await supabase.from('mrc').update({
        status_workflow: 'reavaliacao_pendente',
        reavaliacao_justificativa: justificativa.trim(),
        reavaliacao_solicitada_por: perfil?.id || null,
        reavaliacao_solicitada_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id || null,
      }).eq('id', row.id).select('id')
      if (error) throw error
      if (!upd || upd.length === 0) throw new Error('Não foi possível gravar (verifique permissões).')
      supabase.functions.invoke('send-email', {
        body: { type: 'reavaliacao_solicitada', data: {
          autor_id: perfil?.id, ref: row.rc || row.rr, justificativa: justificativa.trim(),
          area_id: row.area_id, mrc_id: row.id,
          mensagem: `${row.rc} (${row.area || ''}): reavaliação solicitada. Justificativa: ${justificativa.trim()}`,
        } }
      }).catch(err => console.error('Erro ao notificar reavaliação:', err))
      onSaved?.(); onClose?.()
    } catch (err) { alert('Erro: ' + (err.message || err)) } finally { setSaving(false) }
  }

  async function decidir(aprovar) {
    const ok = await confirm({
      title: aprovar ? 'Liberar para edição?' : 'Recusar reavaliação?',
      message: aprovar
        ? 'O controle sai de Concluído e fica Em Correção para ser editado e reenviado à revisão.'
        : 'O controle volta ao status Concluído, sem alterações.',
      confirmText: aprovar ? 'Liberar' : 'Recusar', cancelText: 'Cancelar', variant: aprovar ? 'default' : 'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      const { error } = await supabase.from('mrc').update({
        status_workflow: aprovar ? 'reprovado' : 'aprovado',
        ...(aprovar ? {} : { reavaliacao_justificativa: null, reavaliacao_solicitada_por: null, reavaliacao_solicitada_em: null }),
        atualizado_em: new Date().toISOString(),
        atualizado_por: perfil?.id || null,
      }).eq('id', row.id)
      if (error) throw error
      const solicitante = row.reavaliacao_solicitada_por
      if (solicitante && solicitante !== perfil?.id) {
        await supabase.from('notificacoes').insert({
          para_id: solicitante, de_id: perfil?.id, tipo: aprovar ? 'aprovacao' : 'reprovacao',
          titulo: `Reavaliação ${aprovar ? 'aprovada' : 'recusada'} — ${row.rc || row.rr}`,
          mensagem: aprovar
            ? `${row.rc}: reavaliação aprovada. O controle está Em Correção e liberado para edição.`
            : `${row.rc}: reavaliação recusada. O controle permanece Concluído.`,
          lida: false, mrc_id: row.id,
        })
        supabase.functions.invoke('send-email', {
          body: { type: 'reavaliacao_decidida', data: { autor_id: solicitante, revisor_id: perfil?.id, ref: row.rc || row.rr, aprovada: aprovar, area_id: row.area_id } }
        }).catch(err => console.error('Erro ao enviar email:', err))
      }
      onSaved?.(); onClose?.()
    } catch (err) { alert('Erro: ' + (err.message || err)) } finally { setSaving(false) }
  }

  const lbl = { fontSize: 11, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxWidth: 540, width: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', background: '#00203E', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper-soft)', marginBottom: 4 }}>Matriz de Riscos · Controle</div>
            <div style={{ fontSize: 19, fontWeight: 300, fontFamily: "'Raleway', sans-serif" }}>{modo === 'solicitar' ? 'Solicitar Reavaliação' : 'Decidir Reavaliação'}</div>
            <div style={{ fontSize: 11.5, opacity: 0.72, marginTop: 4 }}>{row.rc}{row.dr ? ` · ${row.dr}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 26, color: 'white', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {modo === 'solicitar' ? (
            <>
              <div style={{ fontSize: 12.5, color: '#444', lineHeight: 1.6, marginBottom: 14 }}>
                Este controle está <strong>Concluído</strong> (aprovado e com criticidade avaliada). Para editá-lo é preciso justificar a reavaliação — o pedido segue para aprovação do gerente antes da edição ser liberada.
              </div>
              <div style={lbl}>Justificativa <span style={{ color: '#E24B4A' }}>*</span></div>
              <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)}
                placeholder="Por que este controle precisa ser reavaliado?"
                style={{ width: '100%', minHeight: 90, padding: 10, border: '1px solid #D0D0D0', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, resize: 'vertical' }} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: '#444', lineHeight: 1.6, marginBottom: 14 }}>
                Há uma solicitação de reavaliação para este controle. Ao liberar, ele sai de <strong>Concluído</strong> e fica <strong>Em Correção</strong> para edição e nova revisão.
              </div>
              <div style={lbl}>Justificativa apresentada</div>
              <div style={{ background: '#F3EEE4', borderRadius: 8, padding: 12, fontSize: 13, color: '#00203E', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{row.reavaliacao_justificativa || '—'}</div>
              {row.reavaliacao_solicitada_em && <div style={{ fontSize: 11, color: '#7A8B9C', marginTop: 8 }}>Solicitada em {new Date(row.reavaliacao_solicitada_em).toLocaleString('pt-BR')}</div>}
            </>
          )}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E8', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '10px 18px', border: '1px solid #D0D0D0', borderRadius: 6, background: 'white', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#00203E', cursor: 'pointer' }}>Cancelar</button>
          {modo === 'solicitar' ? (
            <button onClick={solicitar} disabled={saving || !justificativa.trim()} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: '#CC915E', color: 'white', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (saving || !justificativa.trim()) ? 0.5 : 1 }}>{saving ? 'Enviando...' : 'Solicitar Reavaliação'}</button>
          ) : (
            <>
              <button onClick={() => decidir(false)} disabled={saving} style={{ padding: '10px 18px', border: '1px solid rgba(198,40,40,0.4)', borderRadius: 6, background: 'white', color: '#C62828', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Recusar</button>
              <button onClick={() => decidir(true)} disabled={saving} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: '#15803D', color: 'white', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Salvando...' : 'Liberar para Edição'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModalReavaliar
