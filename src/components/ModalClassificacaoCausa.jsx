import { useState, useMemo } from 'react'
import { calcularAmostra, recomendacaoCausa, CETICISMO_PROFISSIONAL, CAUSAS_RAIZ, FASE_DESTINO_LABEL } from '../lib/amostragem'
import InfoTooltip from './InfoTooltip'

// Pop-up de classificação de causa-raiz da inefetividade (item 29).
// Define o caminho de regressão (2/1 desenho ou 2/2 aderência) sob ceticismo profissional.
export default function ModalClassificacaoCausa({ row, onClose, onConfirmar, inicial }) {
  const [universoManual, setUniversoManual] = useState(inicial?.universoManual ?? '')
  const calc = useMemo(
    () => calcularAmostra(row || {}, { universoManual: universoManual === '' ? null : Number(universoManual) }),
    [row, universoManual]
  )
  const [nTestado, setNTestado] = useState(inicial?.nTestado ?? '')
  const [nFalhas, setNFalhas] = useState(inicial?.nFalhas ?? '')
  const [causaRaiz, setCausaRaiz] = useState(inicial?.causaRaiz ?? '')
  const [justificativa, setJustificativa] = useState(inicial?.justificativa ?? '')

  // preenche nº testado com a amostra recomendada, se ainda vazio
  const amostraRec = calc.amostraFinal
  const nTestadoEf = nTestado === '' && amostraRec ? amostraRec : nTestado

  const rec = recomendacaoCausa(nFalhas, nTestadoEf)
  const causaSel = CAUSAS_RAIZ.find(c => c.valor === causaRaiz)
  const destino = causaSel?.destino || null

  const podeConfirmar = Number(nTestadoEf) > 0 && Number(nFalhas) >= 1 &&
    Number(nFalhas) <= Number(nTestadoEf) && causaRaiz && justificativa.trim()

  const L = { fontSize: 11, fontWeight: 600, color: '#00203E', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4, display: 'block' }
  const INP = { width: '100%', padding: '8px 10px', border: '1px solid #D0D0D0', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '92vw', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Montserrat', sans-serif" }}>
        <div style={{ padding: '20px 24px', background: '#00203E', color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#E0B894', marginBottom: 4 }}>Controle inefetivo</div>
          <div style={{ fontSize: 19, fontWeight: 300, fontFamily: "'Raleway', sans-serif" }}>Classificação da causa-raiz</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{row?.rc} · {row?.dr || row?.area}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* Amostra recomendada */}
          <div style={{ background: '#F3EEE4', border: '1px solid #E0D5C7', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#00203E', lineHeight: 1.5 }}>
            {calc.requerUniverseManual ? (
              <div>
                <div style={{ marginBottom: 8 }}><strong>Controle sob demanda.</strong> Informe quantas vezes o controle ocorreu no período para calcular a amostra:</div>
                <input type="number" min="0" value={universoManual} onChange={e => setUniversoManual(e.target.value)} placeholder="nº de ocorrências no período" style={{ ...INP, maxWidth: 240 }} />
              </div>
            ) : calc.ok ? (
              <div>
                <strong>Amostra recomendada: {calc.amostraFinal}</strong> {calc.itgc ? '(saídas) + avaliação de ITGCs' : ''}<br />
                <span style={{ color: '#5D6E80' }}>
                  {calc.periodoInicio ? `Período: ${calc.periodoInicio.toLocaleDateString('pt-BR')} → hoje · ` : ''}
                  {calc.universo != null ? `Universo: ${calc.universo} · ` : ''}
                  Base {calc.amostraBase}{calc.ajustes?.length ? ` · ${calc.ajustes.join(', ')}` : ''}
                </span>
              </div>
            ) : (
              <div style={{ color: '#C62828' }}>⚠ {calc.motivo}</div>
            )}
          </div>

          {/* Resultado do teste */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={L}>Nº de itens testados</label>
              <input type="number" min="1" value={nTestadoEf} onChange={e => setNTestado(e.target.value)} style={INP} />
            </div>
            <div>
              <label style={L}>Nº de itens com falha <span style={{ color: '#E24B4A' }}>*</span></label>
              <input type="number" min="0" value={nFalhas} onChange={e => setNFalhas(e.target.value)} style={INP} />
            </div>
          </div>

          {/* Recomendação do sistema */}
          {Number(nFalhas) >= 1 && Number(nTestadoEf) > 0 && (
            <div style={{ background: rec.sugestao === 'desenho' ? '#FFF5F5' : '#FFF8E1', border: `1px solid ${rec.sugestao === 'desenho' ? '#FED7D7' : '#F0E0A8'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#444', lineHeight: 1.55 }}>
              <strong style={{ color: '#00203E' }}>Recomendação do sistema:</strong><br />{rec.texto}
            </div>
          )}

          {/* Classificação sob ceticismo profissional */}
          <div style={{ fontSize: 13, color: '#00203E', lineHeight: 1.6, marginBottom: 10 }}>
            Esta classificação deve ser feita sob <strong>ceticismo profissional</strong> <InfoTooltip titulo="Ceticismo profissional" texto={CETICISMO_PROFISSIONAL} />. Com base nas suas análises e na indagação junto ao cliente, o controle foi inefetivo por <strong>falha de desenho</strong> ou por <strong>erro humano (execução)</strong>?
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={L}>Causa-raiz <span style={{ color: '#E24B4A' }}>*</span></label>
            <select value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} style={INP}>
              <option value="">— Selecione —</option>
              {CAUSAS_RAIZ.map(c => <option key={c.valor} value={c.valor}>{c.rotulo} → {FASE_DESTINO_LABEL[c.destino]}</option>)}
            </select>
            {destino && <div style={{ fontSize: 11, color: 'var(--copper-text, #A6512F)', marginTop: 6, fontWeight: 600 }}>Caminho de retorno: {FASE_DESTINO_LABEL[destino]}</div>}
          </div>

          <div>
            <label style={L}>Justificativa <span style={{ color: '#E24B4A' }}>*</span></label>
            <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={3} placeholder="Descreva a análise/indagação que fundamenta a causa-raiz escolhida." style={{ ...INP, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 20, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => onConfirmar?.({ nTestado: Number(nTestadoEf), nFalhas: Number(nFalhas), causaRaiz, destino, justificativa: justificativa.trim(), amostraRecomendada: calc.amostraFinal })}
            disabled={!podeConfirmar}
            style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: podeConfirmar ? 'pointer' : 'not-allowed', background: '#CC915E', color: 'white', opacity: podeConfirmar ? 1 : 0.5, fontFamily: 'inherit' }}>
            Confirmar classificação
          </button>
        </div>
      </div>
    </div>
  )
}
