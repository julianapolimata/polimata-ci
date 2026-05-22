// BannerReprovacao — bloco JSX extraído de ModalRegistrarResultado.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

export default function BannerReprovacao({ isReprovado, notaReprovacao, faseAtual }) {
  return (
    <>
          {/* Banner de reprovação (se aplicável) */}
          {isReprovado && notaReprovacao && (
            <div style={{
              background: '#FFF5F5',
              borderLeft: '4px solid #E24B4A',
              padding: '1rem 1.25rem',
              borderRadius: '4px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C62828', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                ↩ Análise Reprovada — Ação Necessária
              </div>
              <div style={{ fontSize: 13, color: '#00203E', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{notaReprovacao.nota}"
              </div>
              <div style={{ fontSize: 10, color: '#7A8B9C', marginTop: 6 }}>
                Reprovado por <strong style={{ color: '#7A8B9C' }}>{notaReprovacao.autor?.nome || '—'}</strong> em{' '}
                {new Date(notaReprovacao.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}<span style={{ color: '#CC915E' }}>{faseAtual}</span>
              </div>
            </div>
          )}

    </>
  )
}
