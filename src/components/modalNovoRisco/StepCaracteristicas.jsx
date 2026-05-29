// StepCaracteristicas — bloco JSX extraído de ModalNovoRisco.jsx em 22/mai/2026 (fatiamento Etapa 5).
import React from 'react'

export default function StepCaracteristicas({ isAutomatic, step, descControle, setDescControle, cat, setCat, freq, setFreq, nat, setNat, car, setCar, sis, setSis, chave, setChave, quem, setQuem, quando, setQuando, porque, setPorque, como, setComo, onde, setOnde, resultadoPremissa, setResultadoPremissa, sistemas }) {
  return (
    <>
          {/* ─────────── PASSO 2 ─────────── */}
          {step === 2 && (
            <div>
              {/* Seção: Descrição do Controle */}
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
                  1. Descrição do Controle
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
                  Descrição do Controle <span style={{ color: '#E24B4A' }}>*</span>
                </label>
                <textarea
                  value={descControle}
                  onChange={e => setDescControle(e.target.value)}
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
                  placeholder="Como o risco é mitigado?"
                />
              </div>

              {/* Seção: 6 Características (grid 2×3) */}
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
                  2. Características do Controle
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  {[
                    { label: 'Categoria', state: [cat, setCat], options: ['Revisão gerencial', 'Reconciliação', 'Autorização', 'Formalização', 'Configuração', 'Segregação de função', 'Relatório de exceção', 'Acesso Sistêmico', 'Interface/conversão', 'Políticas/Procedimentos', 'Indicadores de Performance'] },
                    { label: 'Frequência', state: [freq, setFreq], options: ['Sob demanda', 'Múltiplas vezes ao dia', 'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'] },
                    { label: 'Natureza', state: [nat, setNat], options: ['Preventivo', 'Detectivo', 'Corretivo'] },
                    { label: 'Característica', state: [car, setCar], options: ['Manual', 'Automático', 'Semi-automatizado'] },
                    { label: 'Sistema', state: [sis, setSis], options: sistemas.map(s => s.nome) },
                    { label: 'Controle Chave', state: [chave, setChave], options: ['Controle Chave', 'Controle Compensatório'] }
                  ].map((field, idx) => (
                    <div key={idx}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        {field.label} <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      <select
                        value={field.state[0]}
                        onChange={e => field.state[1](e.target.value)}
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
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção: 6 Premissas (grid 2×3) */}
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
                  3. Premissas do Controle
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  {[
                    { label: '1. Quem faz?', state: [quem, setQuem], type: 'text', disabled: isAutomatic },
                    { label: '2. Quando faz?', state: [quando, setQuando], type: 'text' },
                    { label: '3. Por quê faz?', state: [porque, setPorque], type: 'textarea' },
                    { label: '4. Como faz?', state: [como, setComo], type: 'textarea' },
                    { label: '5. Onde faz?', state: [onde, setOnde], type: 'text' },
                    { label: '6. Qual o resultado?', state: [resultadoPremissa, setResultadoPremissa], type: 'textarea' }
                  ].map((field, idx) => (
                    <div key={idx}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#00203E',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        {field.label} <span style={{ color: '#E24B4A' }}>*</span>
                      </label>
                      {field.type === 'text' ? (
                        <input
                          type="text"
                          value={field.state[0]}
                          onChange={e => field.state[1](e.target.value)}
                          disabled={field.disabled}
                          style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #D0D0D0',
                            borderRadius: '4px',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: '14px',
                            background: field.disabled ? '#F5F5F5' : 'white',
                            opacity: field.disabled ? 0.6 : 1
                          }}
                          placeholder={field.disabled ? 'N/A (Automatizado)' : ''}
                        />
                      ) : (
                        <textarea
                          value={field.state[0]}
                          onChange={e => field.state[1](e.target.value)}
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
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
    </>
  )
}
