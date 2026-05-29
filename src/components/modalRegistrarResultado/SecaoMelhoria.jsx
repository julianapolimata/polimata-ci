// SecaoMelhoria — bloco JSX extraído de ModalRegistrarResultado.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

export default function SecaoMelhoria({ showDescMelhoria, melhoria, setMelhoria, descMelhoria, setDescMelhoria }) {
  return (
    <>
          {/* Melhoria (sempre) */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#00203E',
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
                color: '#00203E',
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

    </>
  )
}
