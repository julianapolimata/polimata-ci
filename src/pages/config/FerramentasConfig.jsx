import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function FerramentasConfig() {
  const [projetos, setProjetos] = useState([])
  const [projetoSel, setProjetoSel] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    supabase.from('projetos').select('id, nome, clientes(nome)').order('nome')
      .then(({ data }) => { if (data) setProjetos(data) })
  }, [])

  const projetoNome = projetos.find(p => p.id === projetoSel)?.nome || ''
  const canExecute = projetoSel && confirmText === 'LIMPAR'

  async function handleLimpar() {
    if (!canExecute) return
    if (!confirm(`Tem certeza que deseja limpar TODOS os resultados do projeto "${projetoNome}"? Esta ação não pode ser desfeita.`)) return

    setLoading(true)
    setResultado(null)
    try {
      const { data, error } = await supabase.rpc('limpar_base_projeto', { p_projeto_id: projetoSel })
      if (error) throw error
      setResultado({ sucesso: true, dados: data })
      setConfirmText('')
    } catch (err) {
      setResultado({ sucesso: false, erro: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="cfg-area-block" style={{ maxWidth: 560 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>
          Limpar Base de Testes
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--txt2)', lineHeight: 1.5 }}>
          Remove todos os resultados de testes (F1 a F5), revisões e notificações de um projeto.
          A identificação dos controles (risco, controle, área) é mantida.
          <br /><strong style={{ color: '#DC2626' }}>Esta ação é irreversível.</strong>
        </p>

        <div className="cfg-field" style={{ marginBottom: 12 }}>
          <label>Projeto</label>
          <select className="input-light" value={projetoSel} onChange={e => { setProjetoSel(e.target.value); setResultado(null) }}>
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>{p.clientes?.nome ? `${p.clientes.nome} — ` : ''}{p.nome}</option>
            ))}
          </select>
        </div>

        {projetoSel && (
          <div className="cfg-field" style={{ marginBottom: 16 }}>
            <label>Digite <strong>LIMPAR</strong> para confirmar</label>
            <input
              className="input-light"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="LIMPAR"
              style={{ maxWidth: 200 }}
            />
          </div>
        )}

        <button
          onClick={handleLimpar}
          disabled={!canExecute || loading}
          style={{
            background: canExecute ? '#DC2626' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 24px',
            fontSize: 13,
            fontWeight: 600,
            cursor: canExecute ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Limpando...' : 'Limpar Base'}
        </button>

        {resultado && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: resultado.sucesso ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${resultado.sucesso ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            fontSize: 13,
          }}>
            {resultado.sucesso ? (
              <div>
                <strong style={{ color: '#16A34A' }}>Base limpa com sucesso!</strong>
                <div style={{ marginTop: 6, color: 'var(--txt2)' }}>
                  {resultado.dados?.controles_resetados} controles resetados,{' '}
                  {resultado.dados?.revisoes_removidas} revisões removidas,{' '}
                  {resultado.dados?.notificacoes_removidas} notificações removidas.
                </div>
              </div>
            ) : (
              <div><strong style={{ color: '#DC2626' }}>Erro:</strong> {resultado.erro}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
