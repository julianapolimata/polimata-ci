import { useState } from 'react'

// Bolinha "!" que mostra o motivo da reprovação num tooltip estilizado (hover).
export default function MotivoReprovacao({ texto }) {
  const [hover, setHover] = useState(false)
  if (!texto) return null
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#C62828', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'default', textTransform: 'none', fontStyle: 'normal' }}>!</span>
      {hover && (
        <span style={{ position: 'absolute', top: '135%', right: 0, zIndex: 60, background: '#fff', color: '#00203E', border: '1px solid #E0D5C7', borderLeft: '3px solid #C62828', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '8px 12px', fontSize: 11, fontWeight: 500, lineHeight: 1.45, width: 'max-content', maxWidth: 260, whiteSpace: 'normal', textTransform: 'none', fontStyle: 'normal', textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#C62828', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Motivo da reprovação</span>
          {texto}
        </span>
      )}
    </span>
  )
}
