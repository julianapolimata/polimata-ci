// StepPassos — bloco JSX extraído de ModalNovoRisco.jsx em 22/mai/2026 (fatiamento Etapa 5).
import React from 'react'
import PassosTesteList from '../PassosTesteList'

export default function StepPassos({ step, passos, setPassos, saving, novoRiscoData, subprocesso }) {
  return (
    <>
          {/* ─────────── PASSO 3: Passos de Teste (Solicitações v2) ─────────── */}
          {step === 3 && (
            <div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Ref. Risco</div>
                    <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{novoRiscoData?.rr}</div>
                  </div>
                  <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Ref. Controle</div>
                    <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{novoRiscoData?.rc}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Subprocesso</div>
                    <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{subprocesso}</div>
                  </div>
                </div>
              </div>
              <PassosTesteList passos={passos} onChange={setPassos} disabled={saving} />
            </div>
          )}
    </>
  )
}
