// InfoCell helper extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
import React from 'react'

function InfoCell({ label, value, wide }) {
  return (
    <div className="usr-info-cell" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div className="usr-info-label">{label}</div>
      <div className="usr-info-value" style={wide ? { whiteSpace: 'pre-wrap', lineHeight: 1.55 } : undefined}>{value || <span style={{color:'var(--txt3)',fontStyle:'italic'}}>—</span>}</div>
    </div>
  )
}

export default InfoCell
