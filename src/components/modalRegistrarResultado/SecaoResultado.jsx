// SecaoResultado — bloco JSX extraído de ModalRegistrarResultado.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

export default function SecaoResultado({ resultado, handleResultadoChange }) {
  return (
    <>
          {/* Seção: Resultado */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#00203E',
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
              color: '#00203E',
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
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#CC915E' }}
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

    </>
  )
}
