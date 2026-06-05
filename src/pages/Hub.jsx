// ═══════════════════════════════════════════════════════════════════════════
// Hub.jsx — vitrine de produtos do Sistema Polímata, exibida após o login.
// Cada card é um módulo; o acesso vem de perfis.modulos (admin vê todos).
// ═══════════════════════════════════════════════════════════════════════════
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { MODULOS, modulosDoPerfil } from '../lib/modulos'
import { papelLabel } from './dashboard/_shared'

const ICONE = {
  ci: <><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>,
  mapeamento: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></>,
  orcamento: <><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  planejamento: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
}

function IconeModulo({ id }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#CC915E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONE[id] || <circle cx="12" cy="12" r="9"/>}
    </svg>
  )
}

export default function Hub() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const meus = modulosDoPerfil(perfil)
  const meusIds = meus.map(m => m.id)
  const isPolimata = ['admin_polimata', 'consultor_polimata'].includes(perfil?.papel)
  const visiveis = MODULOS.filter(m => meusIds.includes(m.id) || (isPolimata && !m.ativo))

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--bg0, #00112C)', fontFamily: 'Montserrat', display: 'flex', flexDirection: 'column' }}>
      {/* Topo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 36px', borderBottom: '1px solid rgba(243,238,228,0.08)' }}>
        <img src="/logotipo-2cores.png" alt="Polímata" style={{ height: 40, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--cream, #F3EEE4)', fontWeight: 500 }}>{perfil?.nome}</div>
            <div style={{ fontSize: 10, color: 'rgba(243,238,228,0.5)' }}>{papelLabel(perfil?.papel)}</div>
          </div>
          <button onClick={signOut} title="Sair" style={{ background: 'rgba(204,145,94,0.12)', border: '1px solid rgba(204,145,94,0.3)', color: '#CC915E', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>Sair ↩</button>
        </div>
      </div>

      {/* Título */}
      <div style={{ textAlign: 'center', marginTop: 56 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2.2, textTransform: 'uppercase', color: '#CC915E' }}>Sistema Polímata</div>
        <div style={{ fontSize: 30, fontWeight: 200, color: '#F3EEE4', fontFamily: 'Raleway, Montserrat', marginTop: 8 }}>O que vamos fazer hoje?</div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center', padding: '48px 36px', maxWidth: 1100, margin: '0 auto' }}>
        {visiveis.map(m => (
          <button key={m.id} onClick={() => m.ativo && navigate(m.rota)} disabled={!m.ativo}
            style={{
              width: 300, textAlign: 'left', padding: '26px 24px', borderRadius: 16,
              background: m.ativo ? 'rgba(243,238,228,0.04)' : 'rgba(243,238,228,0.02)',
              border: m.ativo ? '1px solid rgba(204,145,94,0.35)' : '1px dashed rgba(243,238,228,0.12)',
              cursor: m.ativo ? 'pointer' : 'default', fontFamily: 'Montserrat',
              transition: 'transform .15s, border-color .15s', opacity: m.ativo ? 1 : 0.55,
            }}
            onMouseEnter={e => { if (m.ativo) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#CC915E' } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = m.ativo ? 'rgba(204,145,94,0.35)' : 'rgba(243,238,228,0.12)' }}
          >
            <div style={{ marginBottom: 14 }}><IconeModulo id={m.id} /></div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#F3EEE4', marginBottom: 8 }}>{m.nome}</div>
            <div style={{ fontSize: 12, color: 'rgba(243,238,228,0.55)', lineHeight: 1.55, minHeight: 56 }}>{m.descricao}</div>
            <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: m.ativo ? '#CC915E' : 'rgba(243,238,228,0.35)' }}>
              {m.ativo ? 'Abrir →' : 'Em breve'}
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'auto', textAlign: 'center', padding: 22, fontSize: 10, color: 'rgba(243,238,228,0.3)' }}>
        Polímata Consultoria em GRC · {new Date().getFullYear()}
      </div>
    </div>
  )
}
