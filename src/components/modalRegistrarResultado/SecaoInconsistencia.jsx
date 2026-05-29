// SecaoInconsistencia — bloco JSX extraído de ModalRegistrarResultado.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

export default function SecaoInconsistencia({ showInconsistencia, showInconsistenciaAlert, inconsistencia, setInconsistencia, resultado }) {
  return (
    <>
          {/* Alerta Inconsistência */}
          {showInconsistenciaAlert && (
            <div style={{
              background: '#FFF3E0',
              borderLeft: '3px solid #F57C00',
              padding: '0.8rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '12px',
              color: '#E65100'
            }}>
              ⚠️ Ao mudar o resultado do teste, as informações do campo "Inconsistências" serão perdidas
            </div>
          )}

          {/* Inconsistência (se Inefetivo/GAP) */}
          {showInconsistencia && (
            <div style={{
              background: '#F9F7F3',
              borderLeft: '3px solid #CC915E',
              padding: '1.5rem',
              borderRadius: '4px',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#00203E',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                letterSpacing: '0.5px'
              }}>
                Inconsistência Identificada
              </div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#00203E',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}>
                Qual inconsistência foi encontrada? <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <textarea
                value={inconsistencia}
                onChange={e => setInconsistencia(e.target.value)}
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
                placeholder="Descrever falha..."
              />
            </div>
          )}

    </>
  )
}
