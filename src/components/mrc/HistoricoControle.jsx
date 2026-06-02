import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

function HistoricoControle({ controleId, projetoId }) {
  const { perfil } = useAuth()
  const [comentarios, setComentarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoTexto, setNovoTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const isPolimata = perfil?.papel === 'admin_polimata' || perfil?.papel === 'consultor_polimata'

  async function load() {
    const { data } = await supabase.from('controle_comentarios').select('id, autor_nome, texto, criado_em').eq('controle_id', controleId).order('criado_em', { ascending: false })
    setComentarios(data || []); setLoading(false)
  }
  useEffect(() => { if (isPolimata) load(); else setLoading(false) }, [controleId, isPolimata])

  async function adicionar() {
    if (!novoTexto.trim()) return
    setSalvando(true)
    try {
      const { error } = await supabase.from('controle_comentarios').insert({
        controle_id: controleId,
        projeto_id: projetoId || null,
        autor_id: perfil?.id || null,
        autor_nome: perfil?.nome || null,
        texto: novoTexto.trim(),
      })
      if (error) throw error
      setNovoTexto(''); load()
    } catch(e) { alert('Erro ao salvar comentário: ' + e.message) }
    setSalvando(false)
  }
  if (loading) return <div style={{ padding: 16, color: 'var(--lt-text3)', fontSize: 12 }}>Carregando histórico…</div>
  if (!isPolimata) return (
    <div className="ms"><div className="ms-t">Histórico</div>
      <div style={{ fontSize: 12, color: 'var(--lt-text3)', fontStyle: 'italic', padding: '8px 0' }}>Nenhum histórico disponível.</div>
    </div>
  )

  const formAdicionar = isPolimata && (
    <div style={{ marginTop: 12, padding: 12, background: 'var(--lt-bg)', border: '1px solid var(--lt-border)', borderRadius: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>+ Adicionar comentário</div>
      <textarea value={novoTexto} onChange={e=>setNovoTexto(e.target.value)} rows={3} placeholder="Escreva uma anotação sobre este controle…" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--lt-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--lt-text)', background: '#fff', outline: 'none', resize: 'vertical' }} />
      <div style={{ marginTop: 6, textAlign: 'right' }}>
        <button onClick={adicionar} disabled={salvando || !novoTexto.trim()} style={{ background: 'var(--copper)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (salvando || !novoTexto.trim()) ? 0.5 : 1 }}>{salvando ? 'Salvando…' : 'Adicionar'}</button>
      </div>
    </div>
  )

  if (comentarios.length === 0) return (
    <div className="ms"><div className="ms-t">Histórico de Comentários</div>
      <div style={{ fontSize: 12, color: 'var(--lt-text3)', fontStyle: 'italic', padding: '8px 0' }}>
        Nenhum comentário registrado ainda. Os comentários aparecem aqui depois que você salva o controle (definitivo ou rascunho) — eles ajudam a lembrar onde a revisão parou, pendências externas, decisões metodológicas.
      </div>
      {formAdicionar}
    </div>
  )
  return (
    <div className="ms">
      <div className="ms-t">Histórico de Comentários ({comentarios.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {comentarios.map(c => (
          <div key={c.id} style={{ padding: '10px 14px', background: 'var(--lt-bg)', border: '1px solid var(--lt-border)', borderLeft: '3px solid var(--copper)', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)' }}>
              <span>{c.autor_nome || 'Anônimo'}</span>
              <span>{new Date(c.criado_em).toLocaleString('pt-BR')}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--lt-text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.texto}</div>
          </div>
        ))}
      </div>
      {formAdicionar}
    </div>
  )
}


export default HistoricoControle
