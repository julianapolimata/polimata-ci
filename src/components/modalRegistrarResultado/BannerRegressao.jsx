// BannerRegressao — bloco JSX extraído de ModalRegistrarResultado.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

export default function BannerRegressao({ isRegressao, resultado, faseAtual, row }) {
  return (
    <>
          {/* Banner de regressão (se resultado Inefetivo/GAP em F3+) */}
          {isRegressao && (
            <div style={{
              background: '#FFF8E1',
              borderLeft: '4px solid #F9A825',
              padding: '1rem 1.25rem',
              borderRadius: '4px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>&#9888;</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E65100', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Atenção — Regressão de Controle
                </div>
                <div style={{ fontSize: 13, color: '#00203E', lineHeight: 1.5 }}>
                  Este resultado regredirá o controle à <strong>Fase 2-E1 (Teste de Desenho)</strong> e a regressão impactará o nível de maturidade da área.
                  {(row?.num_regressoes || 0) > 0 && (
                    <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#7A8B9C' }}>
                      Este controle já regrediu {row.num_regressoes} vez{row.num_regressoes > 1 ? 'es' : ''} anteriormente.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

    </>
  )
}
