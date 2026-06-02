import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Pop-up para registrar comentário informal sobre o controle.
 * Aparece ao salvar (definitivo ou rascunho). Opcional.
 *
 * Props:
 * - controleId: uuid do controle (obrigatório)
 * - projetoId: uuid do projeto (opcional, mas recomendado)
 * - perfil: { id, nome } do autor
 * - acao: descrição curta do que está sendo salvo (ex: 'Rascunho criado')
 * - onClose: () => void — fecha sem registrar
 * - onSaved: () => void — chamado após registrar (com ou sem texto)
 */
export default function ModalComentario({ controleId, projetoId, perfil, acao = 'Salvar', onClose, onSaved }) {
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState(null)

  async function pular() {
    onSaved?.()
  }

  async function salvar() {
    if (!texto.trim()) { pular(); return }
    setSaving(true); setErro(null)
    try {
      const { error } = await supabase.from('controle_comentarios').insert({
        controle_id: controleId,
        projeto_id: projetoId || null,
        autor_id: perfil?.id || null,
        autor_nome: perfil?.nome || null,
        texto: texto.trim(),
      })
      if (error) throw error
      onSaved?.()
    } catch (e) {
      setErro(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', maxWidth: 520, width: '100%', fontFamily: "'Montserrat', sans-serif", boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>{acao}</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#00203E', marginBottom: 4 }}>Algum comentário para registrar?</div>
        <div style={{ fontSize: 12, color: 'var(--lt-text3)', marginBottom: 14, lineHeight: 1.5 }}>
          Opcional. Anote contexto, próximos passos, pendências externas — qualquer informação que ajude você ou outro consultor a retomar o trabalho depois. Fica salvo no histórico do controle.
        </div>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Ex: Cliente confirmou que o controle de aprovação foi migrado pro SAP em março. Aguardando evidência."
          autoFocus
          rows={4}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--lt-border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, color: 'var(--lt-text)', resize: 'vertical', outline: 'none' }}
        />
        {erro && <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 11, color: '#DC2626' }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={pular} disabled={saving} style={{ background: 'transparent', border: '1px solid var(--lt-border)', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, color: 'var(--lt-text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Pular
          </button>
          <button onClick={salvar} disabled={saving} style={{ background: 'var(--copper)', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Registrar comentário'}
          </button>
        </div>
      </div>
    </div>
  )
}
