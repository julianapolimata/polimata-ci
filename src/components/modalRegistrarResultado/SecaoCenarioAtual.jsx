// SecaoCenarioAtual — descreve como o processo e executado hoje, mesmo sem
// controle formalizado. Captura na F1-E1 (Indagacao). Sempre visivel, pois
// contextualiza tanto controles Efetivos quanto Inefetivos/GAP e tanto modo
// "diagnostico apenas" quanto projetos com teste de efetividade.
import React from 'react'

export default function SecaoCenarioAtual({ cenarioAtual, setCenarioAtual }) {
  return (
    <div style={{
      background: '#F4F6F9',
      borderLeft: '3px solid #00203E',
      padding: '1.5rem',
      borderRadius: '4px',
      marginBottom: '1.5rem',
    }}>
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: '#00203E',
        textTransform: 'uppercase',
        marginBottom: '0.4rem',
        letterSpacing: '0.5px',
      }}>
        Cenário Atual
      </div>
      <div style={{
        fontSize: '11px',
        color: '#5A6A7A',
        marginBottom: '1rem',
        lineHeight: 1.5,
      }}>
        Descreva como o processo é executado hoje, ainda que de forma informal ou ad-hoc.
        Esse contexto justifica a classificação acima e serve de baseline caso o projeto
        avance para Fase 2 (remediação).
      </div>
      <label style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: '#00203E',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}>
        Como o processo é feito hoje?
      </label>
      <textarea
        value={cenarioAtual}
        onChange={e => setCenarioAtual(e.target.value)}
        style={{
          width: '100%',
          padding: '0.8rem',
          border: '1px solid #D0D0D0',
          borderRadius: '4px',
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '14px',
          minHeight: '80px',
          resize: 'vertical',
        }}
        placeholder="Descreva como o processo é executado hoje."
      />
    </div>
  )
}
