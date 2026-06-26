// Step Passos do ModalAtualizar — passos de teste (Solicitações v2).
// Extraído em 22/mai/2026 (fatiamento Etapa 3). Diff-zero: visual idêntico.
import React from 'react'
import PassosTesteList from '../PassosTesteList'
import { textoAmostra } from '../../lib/amostragem'

export default function StepPassos({ row, passos, setPassos, saving, amostraInfo }) {
  return (
    <div>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Ref. Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.rc}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A8B9C', textTransform: 'uppercase', marginBottom: 4 }}>Área</div>
            <div style={{ fontSize: 12, color: '#00203E', fontWeight: 500 }}>{row.area}</div>
          </div>
        </div>
      </div>
      <div style={{ background: '#F3EEE4', border: '1px solid #E0D5C7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#00203E', lineHeight: 1.5 }}>
        <strong>Amostra a ser testada/pedida:</strong> {textoAmostra(amostraInfo)}
      </div>
      <PassosTesteList passos={passos} onChange={setPassos} disabled={saving} />
    </div>
  )
}
