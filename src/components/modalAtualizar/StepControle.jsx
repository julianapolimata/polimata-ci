// Step 2 do ModalAtualizar — descritivo, características e premissas do controle.
// Extraído em 22/mai/2026 (fatiamento Etapa 3). Diff-zero: visual idêntico.
import React from 'react'

export default function StepControle({
  row,
  ctrlDescChoice, setCtrlDescChoice,
  novaDescControle, setNovaDescControle,
  editCat, setEditCat,
  editFreq, setEditFreq,
  editNat, setEditNat,
  editCar, setEditCar,
  editSis, setEditSis,
  editChave, setEditChave,
  pq, setPq,
  quando, setQuando,
  onde, setOnde,
  quem, setQuem,
  como, setComo,
  resultado, setResultado,
  isAutomatic,
}) {
  return (
    <div>
      {/* Context Card */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Área</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.area}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Descrição do Controle</div>
          <div style={{ fontSize: 12, color: '#00203E', marginTop: 6, lineHeight: 1.6 }}>{row.dc}</div>
        </div>
      </div>

      {/* Q: Descritivo */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 12 }}>Houve alteração no descritivo do controle?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            style={{
              padding: 12,
              border: ctrlDescChoice === 'nao' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: ctrlDescChoice === 'nao' ? '#00203E' : '#fafbfc',
              color: ctrlDescChoice === 'nao' ? 'white' : '#00203E',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setCtrlDescChoice('nao')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Não</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: ctrlDescChoice === 'nao' ? 0.9 : 0.6, fontWeight: 500 }}>manter como está</div>
          </button>
          <button
            style={{
              padding: 12,
              border: ctrlDescChoice === 'sim' ? '2px solid #00203E' : '1px solid #d1d5db',
              borderRadius: 6,
              background: ctrlDescChoice === 'sim' ? '#00203E' : '#fafbfc',
              color: ctrlDescChoice === 'sim' ? 'white' : '#00203E',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onClick={() => setCtrlDescChoice('sim')}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>✎</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sim</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: ctrlDescChoice === 'sim' ? 0.9 : 0.6, fontWeight: 500 }}>houve alteração</div>
          </button>
        </div>
      </div>

      {/* Se sim: Edit e Características e Premissas */}
      {ctrlDescChoice === 'sim' && (
        <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
          <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
            Editar descritivo do controle
          </div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Nova descrição do controle</label>
          <textarea
            value={novaDescControle}
            onChange={(e) => setNovaDescControle(e.target.value)}
            placeholder="Descreva o novo controle..."
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

          {/* CARACTERÍSTICAS */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
              Características do Controle
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Categoria *</label>
                <select value={editCat} onChange={(e) => setEditCat(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Autorização</option>
                  <option>Relatórios de Exceção</option>
                  <option>Indicadores de Performance</option>
                  <option>Interface/Conversão</option>
                  <option>Revisão Gerencial</option>
                  <option>Reconciliação</option>
                  <option>Acesso</option>
                  <option>Segregação de Funções</option>
                  <option>Configuração</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Frequência *</label>
                <select value={editFreq} onChange={(e) => setEditFreq(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Sob demanda</option>
                  <option>Diário</option>
                  <option>Múltiplas vezes ao dia</option>
                  <option>Semanal</option>
                  <option>Quinzenal</option>
                  <option>Mensal</option>
                  <option>Trimestral</option>
                  <option>Semestral</option>
                  <option>Anual</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Natureza *</label>
                <select value={editNat} onChange={(e) => setEditNat(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Preventivo</option>
                  <option>Detectivo</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Característica *</label>
                <select value={editCar} onChange={(e) => setEditCar(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Manual</option>
                  <option>Semi-Automatizado</option>
                  <option>Automatizado</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Sistema *</label>
                <select value={editSis} onChange={(e) => setEditSis(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>IBID</option>
                  <option>Fluig</option>
                  <option>Totvs Data Sul</option>
                  <option>N/A</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>Controle Chave *</label>
                <select value={editChave} onChange={(e) => setEditChave(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}>
                  <option value="">Selecione...</option>
                  <option>Controle Chave</option>
                  <option>Controle Compensatório</option>
                  <option>N/A</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6 PREMISSAS */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 16, background: '#CC915E', borderRadius: 2 }}></span>
              6 Premissas do Controle
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>1. Quem faz? *</label>
                <textarea
                  value={quem}
                  onChange={(e) => setQuem(e.target.value)}
                  disabled={isAutomatic}
                  placeholder={isAutomatic ? 'N/A (Controle Automatizado)' : 'Responsável...'}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: 12,
                    opacity: isAutomatic ? 0.5 : 1,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>2. Quando faz? *</label>
                <textarea
                  value={quando}
                  onChange={(e) => setQuando(e.target.value)}
                  placeholder="Periodicidade..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>3. Por quê faz? *</label>
                <textarea
                  value={pq}
                  onChange={(e) => setPq(e.target.value)}
                  placeholder="Justificativa..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>4. Como faz? *</label>
                <textarea
                  value={como}
                  onChange={(e) => setComo(e.target.value)}
                  placeholder="Procedimento..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>5. Onde faz? *</label>
                <textarea
                  value={onde}
                  onChange={(e) => setOnde(e.target.value)}
                  placeholder="Local..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#00203E', marginBottom: 6 }}>6. Qual o resultado? *</label>
                <textarea
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  placeholder="Resultado esperado..."
                  style={{ width: '100%', minHeight: 60, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 12 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
