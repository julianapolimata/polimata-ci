// StepIdentificacao — bloco JSX extraído de ModalNovoRisco.jsx em 22/mai/2026 (fatiamento Etapa 5).
import React from 'react'

export default function StepIdentificacao({ step, area, setArea, subprocesso, setSubprocesso, descRisco, setDescRisco, areas, areaFixa, subprocessos }) {
  return (
    <>
          {/* ─────────── PASSO 1 ─────────── */}
          {step === 1 && (
            <div>
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
                  Área <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                {areaFixa ? (
                  <div style={{
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    background: '#F5F5F5',
                    color: '#00203E',
                    fontWeight: 600
                  }}>
                    {areaFixa.nome}
                  </div>
                ) : (
                <select
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    background: 'white'
                  }}
                >
                  <option value="">Selecionar...</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
                )}
              </div>

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
                  Subprocesso <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <select
                  value={subprocesso}
                  onChange={e => setSubprocesso(e.target.value)}
                  disabled={!area}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    border: '1px solid #D0D0D0',
                    borderRadius: '4px',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '14px',
                    background: !area ? '#F5F5F5' : 'white',
                    opacity: !area ? 0.6 : 1
                  }}
                >
                  <option value="">Selecionar...</option>
                  {subprocessos.map(s => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>

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
                  Descrição do Risco <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <textarea
                  value={descRisco}
                  onChange={e => setDescRisco(e.target.value)}
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
                  placeholder="Descrever o risco..."
                />
              </div>

            </div>
          )}
    </>
  )
}
