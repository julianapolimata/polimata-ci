import React from 'react'

/**
 * Lista editável de passos de teste de um controle.
 * Cada item: { id?, descricao, documentacao_solicitada, gerar_solicitacao }
 *
 * Layout por linha:
 *   [#] [✓ Solicitar] [Passo de Teste] [✕]
 *
 * Caixinha = "Incluir na lista de Solicitações". Quando marcada, ao salvar
 * o controle, o conteúdo de "Documentação Solicitada" vira a descrição
 * de uma solicitação de evidência para o cliente.
 */
const PassosTesteList = ({ passos, onChange, disabled = false }) => {
  function setItem(idx, patch) {
    onChange(passos.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }
  function addItem() {
    onChange([...passos, { id: null, descricao: '', documentacao_solicitada: '', gerar_solicitacao: false, _local: true }])
  }
  function removeItem(idx) {
    onChange(passos.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#00203E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid #CC915E' }}>
        Passos de Teste
      </div>
      <div style={{ fontSize: 11, color: 'var(--lt-text3, #5D6E80)', lineHeight: 1.55, marginBottom: '1rem' }}>
        Cada linha tem o <strong>passo de teste</strong> (o que vai ser feito). Marque <strong>“Solicitar”</strong> para
        incluir o passo na lista de <strong>Solicitações de Evidências</strong> — a documentação a ser pedida ao cliente
        é detalhada lá, no painel de Solicitações. Desmarcar cancela a solicitação correspondente.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {passos.length === 0 && (
          <div style={{ padding: '12px 14px', border: '1px dashed #D0D0D0', borderRadius: 6, fontSize: 12, color: 'var(--lt-text3, #5D6E80)', background: '#FAFAFA' }}>
            Nenhum passo cadastrado. Clique em “+ Adicionar passo” para começar.
          </div>
        )}

        {passos.map((p, idx) => (
          <div
            key={p.id || `local-${idx}`}
            style={{
              padding: 12,
              border: '1px solid #E5E7EB',
              borderRadius: 6,
              background: 'white',
              display: 'grid',
              gridTemplateColumns: '32px 90px 1fr 28px',
              gap: 10,
              alignItems: 'start',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-text3, #5D6E80)', textAlign: 'center', paddingTop: 8 }}>{idx + 1}</div>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                paddingTop: 4,
                cursor: disabled ? 'not-allowed' : 'pointer',
                userSelect: 'none',
              }}
              title="Incluir na lista de Solicitações"
            >
              <input
                type="checkbox"
                checked={!!p.gerar_solicitacao}
                onChange={e => setItem(idx, { gerar_solicitacao: e.target.checked })}
                disabled={disabled}
                style={{ width: 18, height: 18, accentColor: '#CC915E', cursor: disabled ? 'not-allowed' : 'pointer' }}
              />
              <span style={{ fontSize: 10, fontWeight: 600, color: p.gerar_solicitacao ? 'var(--copper-text, #A6512F)' : 'var(--lt-text3, #5D6E80)', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' }}>
                Solicitar
              </span>
            </label>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--lt-text3, #5D6E80)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
                Passo de Teste
              </label>
              <textarea
                value={p.descricao || ''}
                onChange={e => setItem(idx, { descricao: e.target.value })}
                disabled={disabled}
                placeholder="O que será feito neste passo…"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D0D0D0', borderRadius: 4, fontFamily: 'Montserrat, sans-serif', fontSize: 13, minHeight: 60, resize: 'vertical', background: disabled ? '#F5F5F5' : 'white', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="button"
              onClick={() => removeItem(idx)}
              disabled={disabled}
              title="Remover passo"
              style={{
                background: 'none',
                border: '1px solid #E5E7EB',
                borderRadius: 4,
                padding: '4px 6px',
                fontSize: 14,
                color: '#7A8B9C',
                cursor: disabled ? 'not-allowed' : 'pointer',
                alignSelf: 'start',
                marginTop: 18,
                height: 28,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        style={{
          marginTop: 12,
          background: 'transparent',
          border: '1px dashed #CC915E',
          color: 'var(--copper-text, #A6512F)',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        + Adicionar passo
      </button>
    </div>
  )
}

export default PassosTesteList
