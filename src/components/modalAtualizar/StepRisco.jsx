// Step 1 do ModalAtualizar — escolha da situação do risco.
// Extraído em 22/mai/2026 (fatiamento Etapa 3). Diff-zero: visual idêntico, apenas em arquivo próprio.
import React from 'react'

export default function StepRisco({
  row,
  areas,
  statusChoice, setStatusChoice,
  newStatus, setNewStatus,
  descChoice, setDescChoice,
  motivoInativacao, setMotivoInativacao,
  novaDescRisco, setNovaDescRisco,
  areaDestino, setAreaDestino,
  subDestino, setSubDestino,
  subprocessosDestino,
  loadSubprocessosDestino,
}) {
  return (
    <div>
      {/* Context Card */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Risco</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rr}</div>
          </div>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Fase Atual</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>F1 · Diagnóstico</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Resultado</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>Efetivo</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Risco</div>
          <div style={{ fontSize: 12, color: '#00203E', marginTop: 6, lineHeight: 1.6 }}>{row.dr}</div>
        </div>
      </div>

      {/* Q1: Situação do Risco */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 2 }}>Houve alteração na situação do risco?</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>A situação pode ser: existente, evitado ou transferido.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button
            style={{
              padding: 12,
              border: statusChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: statusChoice === 'nao' ? '#00203E' : '#fafbfc',
              color: statusChoice === 'nao' ? 'white' : '#00203E',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setStatusChoice('nao')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Não</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: statusChoice === 'nao' ? 0.9 : 0.6, fontWeight: 500 }}>mantém existente</div>
          </button>
          <button
            style={{
              padding: 12,
              border: statusChoice === 'sim' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: statusChoice === 'sim' ? '#00203E' : '#fafbfc',
              color: statusChoice === 'sim' ? 'white' : '#00203E',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setStatusChoice('sim')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>⚡</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sim</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: statusChoice === 'sim' ? 0.9 : 0.6, fontWeight: 500 }}>alterou status</div>
          </button>
        </div>
      </div>

      {/* Sub: Nova Status */}
      {statusChoice === 'sim' && (
        <div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Qual a nova situação do risco?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  padding: 12,
                  border: newStatus === 'evitado' ? '2px solid #EF4444' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: newStatus === 'evitado' ? '#EF4444' : '#fafbfc',
                  color: newStatus === 'evitado' ? 'white' : '#00203E',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setNewStatus('evitado')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>🚫</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Evitado</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: newStatus === 'evitado' ? 0.9 : 0.6, fontWeight: 500 }}>descontinuar</div>
              </button>
              <button
                style={{
                  padding: 12,
                  border: newStatus === 'transferido' ? '2px solid #F59E0B' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: newStatus === 'transferido' ? '#F59E0B' : '#fafbfc',
                  color: newStatus === 'transferido' ? 'white' : '#00203E',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setNewStatus('transferido')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>↗</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Transferido</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: newStatus === 'transferido' ? 0.9 : 0.6, fontWeight: 500 }}>mover para outra área</div>
              </button>
            </div>
          </div>

          {/* Evitado */}
          {newStatus === 'evitado' && (
            <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
              <div style={{ background: '#FEE2E2', borderLeft: '3px solid #EF4444', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#991B1B' }}>
                <strong>⚠️ Atenção:</strong> Ao marcar como evitado, a linha será <strong>inativada</strong> e a referência {row.rr} ficará disponível para reutilização. O controle {row.rc} também será inativado.
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Justificativa da descontinuação *</label>
                <textarea
                  value={motivoInativacao}
                  onChange={(e) => setMotivoInativacao(e.target.value)}
                  placeholder="Explique por que o risco foi evitado..."
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: 12,
                    marginBottom: 16,
                  }}
                />
              </div>
            </div>
          )}

          {/* Transferido */}
          {newStatus === 'transferido' && (
            <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
              <div style={{ background: '#DBEAFE', borderLeft: '3px solid #3B82F6', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#1E40AF' }}>
                <strong>ℹ️ Informação:</strong> O risco e seu controle serão copiados para a área de destino com nova referência. A linha original será inativada.
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
                  Destino da transferência
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Área de destino *</label>
                    <select
                      value={areaDestino}
                      onChange={(e) => {
                        setAreaDestino(e.target.value)
                        loadSubprocessosDestino(e.target.value)
                        setSubDestino('')
                      }}
                      style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                    >
                      <option value="">Selecione a área...</option>
                      {areas && areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Subprocesso *</label>
                    <select
                      value={subDestino}
                      onChange={(e) => setSubDestino(e.target.value)}
                      disabled={!areaDestino}
                      style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12, opacity: !areaDestino ? 0.5 : 1 }}
                    >
                      <option value="">Selecione o subprocesso...</option>
                      {subprocessosDestino && subprocessosDestino.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Q2: Descritivo (se status = nao) */}
      {statusChoice === 'nao' && (
        <div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Houve alteração no descritivo do risco?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                style={{
                  padding: 12,
                  border: descChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: descChoice === 'nao' ? '#00203E' : '#fafbfc',
                  color: descChoice === 'nao' ? 'white' : '#00203E',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setDescChoice('nao')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Não</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: descChoice === 'nao' ? 0.9 : 0.6, fontWeight: 500 }}>manter como está</div>
              </button>
              <button
                style={{
                  padding: 12,
                  border: descChoice === 'sim' ? '2px solid #00203E' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: descChoice === 'sim' ? '#00203E' : '#fafbfc',
                  color: descChoice === 'sim' ? 'white' : '#00203E',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onClick={() => setDescChoice('sim')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>✎</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Sim</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: descChoice === 'sim' ? 0.9 : 0.6, fontWeight: 500 }}>houve alteração</div>
              </button>
            </div>
          </div>

          {descChoice === 'sim' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
                Editar descritivo do risco
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Nova descrição do risco</label>
              <textarea
                value={novaDescRisco}
                onChange={(e) => setNovaDescRisco(e.target.value)}
                placeholder="Descreva o novo risco..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 10,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 12,
                  marginBottom: 16,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
