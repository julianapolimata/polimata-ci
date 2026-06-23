import { useState, useEffect } from 'react'
import { FASES_LABEL, FASES_DETALHE } from '../pages/config/projetos/_consts'
import { promoverProjetoParaTeste, resumoDiagnostico } from '../lib/promoverTeste'

// Tela de confirmação da promoção diagnóstico -> F1 com teste.
export default function ModalPromoverTeste({ projeto, onClose, onPromoted }) {
  const [resumo, setResumo] = useState(null)
  const [numFases, setNumFases] = useState(projeto?.num_fases && projeto.num_fases > 1 ? projeto.num_fases : 2)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (projeto?.id) resumoDiagnostico(projeto.id).then(setResumo)
  }, [projeto?.id])

  const podePromover = resumo && resumo.total > 0 && resumo.pendentes === 0

  async function confirmar() {
    if (!podePromover || saving) return
    setSaving(true); setErro('')
    try {
      const r = await promoverProjetoParaTeste(projeto.id, numFases)
      onPromoted?.(r)
    } catch (e) { setErro(e.message); setSaving(false) }
  }

  const card = { background: '#fff', borderRadius: 14, width: '92%', maxWidth: 560, fontFamily: "'Montserrat', sans-serif", overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#5D6E80', textTransform: 'uppercase', letterSpacing: 0.5 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,32,62,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ background: '#00203E', color: '#fff', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>↥</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Promover para teste</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{projeto?.nome}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {!resumo ? (
            <div style={{ color: '#5D6E80', fontSize: 13, textAlign: 'center', padding: 20 }}>Carregando diagnóstico…</div>
          ) : resumo.pendentes > 0 ? (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>
              <strong>Diagnóstico ainda não concluído.</strong><br />
              Faltam <strong>{resumo.pendentes}</strong> de {resumo.total} controles em "Concluído" (aprovado + criticidade avaliada). Conclua o diagnóstico antes de promover.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 16 }}>
                O projeto entra no fluxo de teste com a régua <strong>N1–N5</strong>. O <strong>retrato do diagnóstico é preservado</strong> — nada é perdido.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
                <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={lbl}>Existentes</div><div style={{ fontSize: 20, fontWeight: 700, color: '#15803D' }}>{resumo.existentes}</div>
                  <div style={{ fontSize: 10, color: '#5D6E80' }}>vão para teste</div>
                </div>
                <div style={{ background: 'rgba(234,179,8,0.10)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={lbl}>Parciais</div><div style={{ fontSize: 20, fontWeight: 700, color: '#CA8A04' }}>{resumo.parciais}</div>
                  <div style={{ fontSize: 10, color: '#5D6E80' }}>vão para teste</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={lbl}>Inexistentes</div><div style={{ fontSize: 20, fontWeight: 700, color: '#991B1B' }}>{resumo.inexistentes}</div>
                  <div style={{ fontSize: 10, color: '#5D6E80' }}>viram GAP (N1)</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={lbl}>Até qual fase o projeto vai? <span style={{ color: '#5D6E80', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(distribui os %)</span></div>
                <select value={numFases} onChange={e => setNumFases(parseInt(e.target.value))} style={{ width: '100%', maxWidth: 320, marginTop: 6, padding: '9px 12px', border: '1px solid #D0D0D0', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{FASES_LABEL[n]}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#5D6E80', marginTop: 6 }}>{FASES_DETALHE[numFases]}</div>
              </div>

              {erro && <div style={{ background: 'rgba(239,68,68,0.08)', color: '#991B1B', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{erro}</div>}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 22px', borderTop: '1px solid #EEF1F4', background: '#FAFBFC' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', color: '#00203E', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={!podePromover || saving} style={{ flex: 1, padding: '11px 16px', border: 'none', borderRadius: 8, background: podePromover ? '#CC915E' : '#D8DCE1', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: podePromover && !saving ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Promovendo…' : '↥ Promover para teste'}
          </button>
        </div>
      </div>
    </div>
  )
}
