// SecaoPA — bloco JSX extraído de ModalRegistrarResultado.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

export default function SecaoPA({ showPA, temPA, setTemPA, paDesc, setPaDesc, paResp, setPaResp, paPrazo, setPaPrazo, paStatus, setPaStatus, justificativaPA, setJustificativaPA, responsaveis, resultado }) {
  return (
    <>
          {/* Teste de Desenho (se Inefetivo/GAP) */}
          {showPA && (
            <div style={{
              background: '#F9F7F3',
              borderLeft: '3px solid #CC915E',
              padding: '1.5rem',
              borderRadius: '4px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#00203E',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                letterSpacing: '0.5px'
              }}>
                2. Teste de Desenho
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
                Haverá plano de ação?
              </label>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                {[
                  { value: 'sim', label: 'Sim' },
                  { value: 'nao', label: 'Não' }
                ].map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="temPA"
                      value={opt.value}
                      checked={temPA === opt.value}
                      onChange={e => setTemPA(e.target.value)}
                      style={{ accentColor: '#CC915E' }}
                    />
                    <span style={{ fontSize: '14px' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {temPA === 'sim' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#00203E',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px'
                    }}>
                      Descrição da ação <span style={{ color: '#E24B4A' }}>*</span>
                    </label>
                    <textarea
                      value={paDesc}
                      onChange={e => setPaDesc(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        border: '1px solid #D0D0D0',
                        borderRadius: '4px',
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '14px',
                        minHeight: '60px',
                        resize: 'vertical'
                      }}
                      placeholder="O que será feito?"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        Responsável <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      <select
                        value={paResp}
                        onChange={e => setPaResp(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          border: '1px solid #D0D0D0',
                          borderRadius: '4px',
                          fontFamily: 'Montserrat, sans-serif',
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Selecionar...</option>
                        {responsaveis.map(r => (
                          <option key={r.id} value={r.id}>{r.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        Prazo <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={paPrazo}
                        onChange={e => setPaPrazo(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.8rem',
                          border: '1px solid #D0D0D0',
                          borderRadius: '4px',
                          fontFamily: 'Montserrat, sans-serif',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#00203E',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px'
                    }}>
                      Status <span style={{ color: '#E24B4A' }}>*</span>
                    </label>
                    <select
                      value={paStatus}
                      onChange={e => setPaStatus(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.8rem',
                        border: '1px solid #D0D0D0',
                        borderRadius: '4px',
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '14px'
                      }}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="desenvolvimento">Em Desenvolvimento</option>
                      <option value="efetivo">Efetivo</option>
                    </select>
                  </div>
                </div>
              )}

              {temPA === 'nao' && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#00203E',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    Por que não haverá plano de ação?
                  </label>
                  <textarea
                    value={justificativaPA}
                    onChange={e => setJustificativaPA(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      border: '1px solid #D0D0D0',
                      borderRadius: '4px',
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: '14px',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                    placeholder="Justificar ausência de PA..."
                  />
                </div>
              )}
            </div>
          )}

    </>
  )
}
