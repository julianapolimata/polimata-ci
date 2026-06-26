// Step Ficha do ModalAtualizar — confirmar e baixar a ficha de risco.
// Extraído em 22/mai/2026 (fatiamento Etapa 3). Diff-zero: visual idêntico.
import React from 'react'
import { textoAmostra } from '../../lib/amostragem'

export default function StepFicha({
  row,
  novaDescRisco,
  novaDescControle,
  editCat,
  editFreq,
  editNat,
  editCar,
  saving,
  handleSaveFicha,
  handleSaveSemFicha,
  podeEnviarSemTeste,
  handleEnviarAprovacao,
  amostraInfo,
}) {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#00203E', marginBottom: 16 }}>Dados que serão incluídos na ficha</h3>

      <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Descrição do Risco</div>
          <div style={{ color: '#7A8B9C' }}>{novaDescRisco || row.dr}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Descrição do Controle</div>
          <div style={{ color: '#7A8B9C' }}>{novaDescControle || row.dc}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Categoria</div>
          <div style={{ color: '#7A8B9C' }}>{editCat || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Frequência</div>
          <div style={{ color: '#7A8B9C' }}>{editFreq || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Natureza</div>
          <div style={{ color: '#7A8B9C' }}>{editNat || '—'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, fontSize: 12, paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 600, color: '#00203E' }}>Característica</div>
          <div style={{ color: '#7A8B9C' }}>{editCar || '—'}</div>
        </div>
      </div>

      <div style={{ background: '#F3EEE4', border: '1px solid #E0D5C7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#00203E', lineHeight: 1.5 }}>
        <strong>Amostra a ser testada/pedida:</strong> {textoAmostra(amostraInfo)}
      </div>
      <div
        onClick={!saving ? handleSaveFicha : undefined}
        style={{ background: '#00203E', color: 'white', padding: 16, borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, cursor: saving ? 'wait' : 'pointer', transition: 'opacity .15s', opacity: saving ? 0.6 : 1 }}
      >
        <div style={{ background: '#CC915E', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>.XLSX</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Salvar e Baixar Ficha de Risco</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Ficha_de_Risco_{row.rc}.xlsx — pré-preenchida com os dados acima. Salva as alterações e baixa a ficha automaticamente.</div>
        </div>
      </div>

      <div
        onClick={!saving ? handleSaveSemFicha : undefined}
        style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: saving ? 'wait' : 'pointer', transition: 'opacity .15s', opacity: saving ? 0.6 : 1 }}
      >
        <div style={{ background: '#6b7280', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>💾</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#00203E', marginBottom: 2 }}>Salvar sem gerar ficha</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Salva as alterações, mas o teste ficará marcado como pendente.</div>
        </div>
      </div>

      {podeEnviarSemTeste && (
        <div
          onClick={!saving ? handleEnviarAprovacao : undefined}
          style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: saving ? 'wait' : 'pointer', transition: 'opacity .15s', opacity: saving ? 0.6 : 1 }}
        >
          <div style={{ background: '#15803D', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>✓</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46', marginBottom: 2 }}>Enviar para aprovação (sem novo teste)</div>
            <div style={{ fontSize: 11, color: '#047857' }}>Esta edição não altera o risco/controle nem os passos, então o teste atual continua válido. Vai direto para aprovação, mantendo o resultado.</div>
          </div>
        </div>
      )}

      <div style={{ background: '#FEF3C7', borderLeft: '3px solid #F59E0B', padding: 12, borderRadius: 6, fontSize: 12, color: '#92400E' }}>
        <strong>📌 Importante:</strong> Ao salvar com ficha, o controle receberá o status <strong>EM ANÁLISE</strong> até que o resultado do teste seja registrado. Ao salvar sem ficha, o controle será marcado como <strong>TESTE PENDENTE</strong>.
      </div>
    </div>
  )
}
