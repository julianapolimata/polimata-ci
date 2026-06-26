// ModalReabrir — fluxo de reabertura de controle INATIVO (evitado/transferido/descontinuado).
// 1) Solicitar: justificativa obrigatória. Se solo (gerente/admin sem dono ou dono===eu) reabre na hora;
//    senão, fica "Reabertura pendente" aguardando o gerente.
// 2) Decidir (gerente/admin): reabre (volta ativo/Existente) ou recusa (segue inativo).
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirm } from './ConfirmDialog'

const ModalReabrir = ({ row, perfil, modo, onClose, onSaved }) => {
  // modo: 'solicitar' | 'decidir'
  const [justificativa, setJustificativa] = useState('')
  const [saving, setSaving] = useState(false)
  const { confirm } = useConfirm()
  const donoCtrl = row?.consultor_id || row?.submetido_por || row?.criado_por
  const podeAprovar = ['admin_polimata', 'gerente_polimata'].includes(perfil?.papel) && (!donoCtrl || donoCtrl === perfil?.id)

  // Reabre: volta a ATIVO + situação Existente, limpa os campos de reabertura.
  // Não mexe no status_workflow — o controle retorna ao estado que tinha antes de ser inativado.
  function reativarUpdate(extra = {}) {
    return supabase.from('mrc').update({
      ativo: true,
      status_risco: 'existente',
      reabertura_justificativa: null,
      reabertura_solicitada_por: null,
      reabertura_solicitada_em: null,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id || null,
      ...extra,
    }).eq('id', row.id).select('id')
  }

  async function solicitar() {
    if (!justificativa.trim()) { alert('A justificativa é obrigatória.'); return }
    setSaving(true)
    try {
      if (podeAprovar) {
        const { data: upd, error } = await reativarUpdate()
        if (error) throw error
        if (!upd || upd.length === 0) throw new Error('Não foi possível gravar (verifique permissões).')
      } else {
        const { data: upd, error } = await supabase.from('mrc').update({
          reabertura_justificativa: justificativa.trim(),
          reabertura_solicitada_por: perfil?.id || null,
          reabertura_solicitada_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
          atualizado_por: perfil?.id || null,
        }).eq('id', row.id).select('id')
        if (error) throw error
        if (!upd || upd.length === 0) throw new Error('Não foi possível gravar (verifique permissões).')
      }
      onSaved?.(); onClose?.()
    } catch (err) { alert('Erro: ' + (err.message || err)) } finally { setSaving(false) }
  }

  async function decidir(aprovar) {
    const ok = await confirm({
      title: aprovar ? 'Reabrir o controle?' : 'Recusar reabertura?',
      message: aprovar
        ? 'O controle volta a ficar ATIVO (situação Existente) e retorna ao fluxo normal, no estado que tinha antes de ser inativado.'
        : 'O controle permanece inativo, sem alterações.',
      confirmText: aprovar ? 'Reabrir' : 'Recusar', cancelText: 'Cancelar', variant: aprovar ? 'default' : 'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      const solicitante = row.reabertura_solicitada_por
      if (aprovar) {
        const { data: upd, error } = await reativarUpdate()
        if (error) throw error
        if (!upd || upd.length === 0) throw new Error('Não foi possível gravar (verifique permissões).')
      } else {
        const { error } = await supabase.from('mrc').update({
          reabertura_justificativa: null,
          reabertura_solicitada_por: null,
          reabertura_solicitada_em: null,
          atualizado_em: new Date().toISOString(),
          atualizado_por: perfil?.id || null,
        }).eq('id', row.id)
        if (error) throw error
      }
      if (solicitante && solicitante !== perfil?.id) {
        await supabase.from('notificacoes').insert({
          para_id: solicitante, de_id: perfil?.id, tipo: aprovar ? 'aprovacao' : 'reprovacao',
          titulo: `Reabertura ${aprovar ? 'aprovada' : 'recusada'} — ${row.rc || row.rr}`,
          mensagem: aprovar
            ? `${row.rc}: reabertura aprovada. O controle está ativo novamente.`
            : `${row.rc}: reabertura recusada. O controle permanece inativo.`,
          lida: false, mrc_id: row.id,
        })
      }
      onSaved?.(); onClose?.()
    } catch (err) { alert('Erro: ' + (err.message || err)) } finally { setSaving(false) }
  }

  const lbl = { fontSize: 11, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }
  const sit = (row.status_risco || '').toLowerCase()
  const sitLabel = sit === 'evitado' ? 'Evitado' : sit === 'transferido' ? 'Transferido' : sit === 'descontinuado' ? 'Descontinuado' : 'Inativo'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxWidth: 540, width: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', background: '#00203E', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper-soft)', marginBottom: 4 }}>Matriz de Riscos · Controle</div>
            <div style={{ fontSize: 19, fontWeight: 300, fontFamily: "'Raleway', sans-serif" }}>{modo === 'solicitar' ? 'Reabrir Controle' : 'Decidir Reabertura'}</div>
            <div style={{ fontSize: 11.5, opacity: 0.72, marginTop: 4 }}>{row.rc}{row.dr ? ` · ${row.dr}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 26, color: 'white', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {modo === 'solicitar' ? (
            <>
              <div style={{ fontSize: 12.5, color: '#444', lineHeight: 1.6, marginBottom: 14 }}>
                Este controle está <strong>{sitLabel}</strong> (inativo). Para trazê-lo de volta é preciso justificar a reabertura — {podeAprovar ? 'ao confirmar, ele volta a ficar ativo na hora.' : 'o pedido segue para aprovação do gerente antes da reabertura.'}
              </div>
              <div style={lbl}>Justificativa <span style={{ color: '#E24B4A' }}>*</span></div>
              <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)}
                placeholder="Por que este controle precisa ser reaberto?"
                style={{ width: '100%', minHeight: 90, padding: 10, border: '1px solid #D0D0D0', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, resize: 'vertical' }} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: '#444', lineHeight: 1.6, marginBottom: 14 }}>
                Há uma solicitação de reabertura para este controle (<strong>{sitLabel}</strong>). Ao reabrir, ele volta a ficar <strong>ativo</strong> (situação Existente) e retorna ao fluxo normal.
              </div>
              <div style={lbl}>Justificativa apresentada</div>
              <div style={{ background: '#F3EEE4', borderRadius: 8, padding: 12, fontSize: 13, color: '#00203E', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{row.reabertura_justificativa || '—'}</div>
              {row.reabertura_solicitada_em && <div style={{ fontSize: 11, color: '#7A8B9C', marginTop: 8 }}>Solicitada em {new Date(row.reabertura_solicitada_em).toLocaleString('pt-BR')}</div>}
            </>
          )}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E8', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '10px 18px', border: '1px solid #D0D0D0', borderRadius: 6, background: 'white', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#00203E', cursor: 'pointer' }}>Cancelar</button>
          {modo === 'solicitar' ? (
            <button onClick={solicitar} disabled={saving || !justificativa.trim()} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: '#CC915E', color: 'white', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: (saving || !justificativa.trim()) ? 0.5 : 1 }}>{saving ? 'Salvando...' : (podeAprovar ? 'Reabrir agora' : 'Solicitar Reabertura')}</button>
          ) : (
            <>
              <button onClick={() => decidir(false)} disabled={saving} style={{ padding: '10px 18px', border: '1px solid rgba(198,40,40,0.4)', borderRadius: 6, background: 'white', color: '#C62828', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Recusar</button>
              <button onClick={() => decidir(true)} disabled={saving} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: '#15803D', color: 'white', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Salvando...' : 'Reabrir'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModalReabrir
