import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ════════════════════════════════════════════════════════════════════════
// Login — identidade visual alinhada com o site institucional
// (seção "Fale com a gente" do polimatagrc.com.br)
// ════════════════════════════════════════════════════════════════════════

// Cores extraídas das variáveis CSS do polimatagrc.com.br (1:1)
const SITE = {
  copper:       '#C8895C',
  copperSoft:   '#D89E74',
  copperDeep:   '#A66F44',
  navy:         '#0A2540',
  navyDeep:     '#071A2E',
  navySoft:     '#15365A',
  cream:        '#F7F3EE',
  radius:       12,
  radiusLg:     24,
  container:    1200,
}

// Sistema tipográfico unificado — 6 tamanhos, 4 níveis de texto + 2 accents
const T = {
  // Tamanhos
  display:    'clamp(28px, 3vw, 38px)',
  title:      22,
  body:       15,
  cardValue:  15,
  small:      14,
  eyebrow:    12,
  // Pesos
  light:      200,
  regular:    400,
  medium:     500,
  semibold:   600,
  // Cores texto (sobre fundo navy/escuro)
  text:        'rgba(255,255,255,0.95)',
  textMuted:   'rgba(255,255,255,0.70)',
  textSubtle:  'rgba(255,255,255,0.55)',
  textFaint:   'rgba(255,255,255,0.40)',
  accent:      SITE.copper,       // #C8895C — eyebrow, links primários
  accentSoft:  SITE.copperSoft,   // #D89E74 — links secundários
  // Letter-spacing
  lsEyebrow:   '0.2em',
  lsTitle:     '0.5px',
}

const BG_GRADIENT = `linear-gradient(145deg, ${SITE.navyDeep} 0%, ${SITE.navy} 60%, ${SITE.navySoft} 100%)`

const ICONS = {
  whatsapp: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0012.05 4 7.94 7.94 0 005.18 16L4 20l4.1-1.07a7.93 7.93 0 003.95 1h.01a7.94 7.94 0 005.54-13.6zm-5.55 12.21a6.6 6.6 0 01-3.36-.92l-.24-.14-2.43.64.65-2.37-.16-.25a6.61 6.61 0 01-1-3.49 6.6 6.6 0 0111.27-4.66 6.55 6.55 0 011.93 4.67 6.6 6.6 0 01-6.66 6.52zm3.61-4.94c-.2-.1-1.17-.58-1.35-.64s-.31-.1-.45.1-.51.64-.63.78-.23.15-.43.05a5.43 5.43 0 01-1.6-1 6 6 0 01-1.1-1.37c-.12-.2 0-.31.09-.41s.2-.23.3-.34a1.34 1.34 0 00.2-.34.37.37 0 000-.35c-.05-.1-.45-1.08-.62-1.48s-.33-.34-.45-.34h-.39a.74.74 0 00-.54.25 2.27 2.27 0 00-.7 1.69 3.94 3.94 0 00.83 2.1 9 9 0 003.45 3.05c.48.2.86.33 1.16.42a2.81 2.81 0 001.28.08 2.1 2.1 0 001.37-.96 1.69 1.69 0 00.12-.96c-.05-.09-.18-.14-.38-.24z"/></svg>
  ),
  email: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  ),
  linkedin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
  ),
}

function ContatoItem({ icon, label, value, href }) {
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: SITE.radius,
        textDecoration: 'none',
        color: T.text,
        transition: 'all .2s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(200,137,92,0.20)',
        color: T.accentSoft,
        display: 'grid', placeItems: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: T.eyebrow, fontWeight: T.semibold, color: T.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</span>
        <span style={{ display: 'block', fontSize: T.cardValue, color: T.text, fontWeight: T.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      </div>
    </a>
  )
}

function Hero() {
  return (
    <div>
      <div style={{
        fontSize: T.eyebrow, color: T.accent,
        fontFamily: "'Montserrat', sans-serif",
        letterSpacing: T.lsEyebrow, fontWeight: T.semibold, textTransform: 'uppercase',
        marginBottom: 16,
      }}>
        Acesso ao Sistema
      </div>
      <h1 style={{
        fontSize: T.display, fontWeight: T.light,
        color: T.text, fontFamily: "'Raleway', sans-serif",
        lineHeight: 1.18, letterSpacing: T.lsTitle,
        margin: '0 0 22px',
      }}>
        Sua área de gestão de projetos
      </h1>
      <p style={{
        fontSize: T.body, color: T.textMuted,
        lineHeight: 1.75, margin: '0 0 28px', maxWidth: 460,
      }}>
        Acompanhe a evolução dos projetos, a maturidade dos seus
        processos, exporte relatórios e tenha sua matriz de riscos e
        controles atualizada em um clique. Tudo num só lugar, em
        sintonia com a metodologia Polímata.
      </p>

      <div style={{
        padding: '18px 22px',
        background: 'rgba(200,137,92,0.08)',
        border: '1px dashed rgba(200,137,92,0.30)',
        borderRadius: SITE.radius,
        fontSize: T.small, color: T.textMuted,
        lineHeight: 1.65,
        marginBottom: 18,
      }}>
        <strong style={{ color: T.accent, fontWeight: T.semibold }}>Ainda não é cliente?</strong>{' '}
        Conheça nossa metodologia de Governança, Riscos e Compliance no{' '}
        <a href="https://polimatagrc.com.br" target="_blank" rel="noopener noreferrer"
           style={{ color: T.accentSoft, textDecoration: 'underline', textUnderlineOffset: 2 }}>
          site institucional
        </a>{' '}— ou fale com a gente abaixo.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ContatoItem icon={ICONS.whatsapp} label="WhatsApp"  value="+55 (19) 99779-3378"        href="https://wa.me/5519997793378" />
        <ContatoItem icon={ICONS.email}    label="Email"     value="contato@polimatagrc.com.br" href="mailto:contato@polimatagrc.com.br" />
        <ContatoItem icon={ICONS.linkedin} label="LinkedIn"  value="Polímata Consultoria em GRC" href="https://www.linkedin.com/company/pol%C3%ADmata-consultoria-em-grc" />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Card de autenticação (login / esqueci / enviado)
// ──────────────────────────────────────────────────────────────────────
function AuthCard({ children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: SITE.radiusLg,
      padding: 40,
      boxShadow: '0 16px 48px rgba(7,26,46,0.35)',
      maxWidth: 540,
      width: '100%',
      margin: '0 auto',
    }}>
      {children}
      <div style={{
        fontSize: T.small, color: T.textFaint,
        textAlign: 'center', marginTop: 28,
      }}>
        Polímata Consultoria em GRC · {new Date().getFullYear()}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────
export default function Login() {
  const [tela, setTela] = useState('login')

  return (
    <div style={{
      minHeight: '100vh',
      background: BG_GRADIENT,
      position: 'relative',
      overflowX: 'hidden',
      fontFamily: "'Montserrat', sans-serif",
    }}>
      {/* Header branco — espelho do site institucional */}
      <header style={{
        position: 'relative',
        zIndex: 2,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,32,62,0.08)',
        minHeight: 90,
      }}>
        <div style={{
          maxWidth: SITE.container,
          margin: '0 auto',
          padding: '18px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}>
          <a href="https://polimatagrc.com.br" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} title="Voltar ao site institucional">
            <img
              src="/polimata-logo-horizontal.png"
              alt="Polímata Consultoria em GRC"
              style={{ height: 54, width: 'auto', objectFit: 'contain' }}
            />
          </a>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            background: SITE.copper,
            color: SITE.navy,
            borderRadius: 999,
            fontSize: T.body,
            fontWeight: T.medium,
            letterSpacing: '0.01em',
            fontFamily: "'Montserrat', sans-serif",
            whiteSpace: 'nowrap',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Acesso do Cliente
          </div>
        </div>
      </header>

      {/* Accent radials — eco do site / ProjectSelector */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '60%', height: '140%',
        background: 'radial-gradient(ellipse at center, rgba(204,145,94,0.10) 0%, transparent 55%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', left: '-10%',
        width: '55%', height: '100%',
        background: 'radial-gradient(ellipse at center, rgba(91,143,249,0.06) 0%, transparent 55%)',
        pointerEvents: 'none',
      }} />

      <div className="login-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 560px)',
        gap: 64,
        maxWidth: SITE.container,
        margin: '0 auto',
        padding: '40px 40px 60px',
        
        alignItems: 'start',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Esquerda: hero + contatos */}
        <Hero />

        {/* Direita: card de auth */}
        <AuthCard>
          {tela === 'login'   && <TelaLogin    onEsqueci={() => setTela('esqueci')} />}
          {tela === 'esqueci' && <TelaEsqueci  onVoltar={() => setTela('login')} onEnviado={() => setTela('enviado')} />}
          {tela === 'enviado' && <TelaEnviado  onVoltar={() => setTela('login')} />}
        </AuthCard>
      </div>

      {/* Responsivo: mobile vira stack */}
      <style>{`
        @media (max-width: 880px) {
          header { min-height: 70px !important; }
          header > div { padding: 14px 20px !important; gap: 12px !important; }
          header img { height: 40px !important; }
          header > div > div:last-child { padding: 10px 22px !important; font-size: 0.9rem !important; }
          .login-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
            padding: 32px 20px 48px !important;
          }
          .login-grid > div:first-child h1 {
            font-size: 26px !important;
          }
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// FORM LOGIN
// ══════════════════════════════════════════════════════════════════════
const fieldStyle = {
  width: '100%',
  padding: '13px 16px',
  fontSize: T.body,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  color: T.text,
  outline: 'none',
  transition: 'border-color .15s ease',
  boxSizing: 'border-box',
}
const labelStyle = {
  fontSize: T.eyebrow, fontWeight: T.semibold,
  color: T.textSubtle,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
  display: 'block',
}
const submitBtnStyle = {
  width: '100%',
  padding: '14px 18px',
  fontSize: T.body, fontWeight: T.semibold,
  background: `linear-gradient(135deg, ${SITE.copper} 0%, ${SITE.copperDeep} 100%)`,
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  cursor: 'pointer',
  letterSpacing: '0.04em',
  fontFamily: 'inherit',
  transition: 'transform .12s ease, box-shadow .12s ease',
  boxShadow: '0 6px 20px rgba(166,111,68,0.30)',
}

function TelaLogin({ onEsqueci }) {
  const { signIn } = useAuth()
  const [email, setEmail]         = useState('')
  const [senha, setSenha]         = useState('')
  const [erro, setErro]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await signIn(email, senha)
    if (error) setErro('Email ou senha incorretos.')
    setLoading(false)
  }

  return (
    <>
      <h2 style={{
        fontSize: T.title, fontWeight: T.light,
        color: T.text,
        fontFamily: "'Raleway', sans-serif",
        letterSpacing: T.lsTitle,
        margin: '0 0 6px', textAlign: 'center',
      }}>
        Acesse sua conta
      </h2>
      <p style={{
        fontSize: T.small, color: T.textSubtle,
        margin: '0 0 28px', textAlign: 'center',
      }}>
        Polímata Consultoria em Governança Corporativa
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoFocus
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(204,145,94,0.60)'}
            onBlur={e => e.target.style.borderColor = 'rgba(204,145,94,0.20)'}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Senha</label>
            <button type="button" onClick={() => setShowSenha(v => !v)}
              style={{ background: 'none', border: 'none', color: T.textSubtle, fontSize: T.eyebrow, cursor: 'pointer', padding: 0 }}>
              {showSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <input
            type={showSenha ? 'text' : 'password'}
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••"
            required
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(204,145,94,0.60)'}
            onBlur={e => e.target.style.borderColor = 'rgba(204,145,94,0.20)'}
          />
          <div style={{ fontSize: T.eyebrow, color: T.textFaint, marginTop: 6, lineHeight: 1.6 }}>
            Mínimo 8 caracteres · letras maiúsculas e minúsculas · um número e um caractere especial
          </div>
        </div>

        {erro && (
          <div style={{
            padding: '10px 14px', fontSize: T.small,
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 8,
            color: '#FCA5A5',
          }}>{erro}</div>
        )}

        <button type="submit" disabled={loading} style={submitBtnStyle}
          onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(166,81,47,0.42)' } }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(166,81,47,0.30)' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <button type="button" onClick={onEsqueci}
          style={{ background: 'none', border: 'none', color: T.accentSoft, fontSize: T.small, cursor: 'pointer', textAlign: 'center', padding: '6px 0', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Esqueci minha senha
        </button>
      </form>
    </>
  )
}

function TelaEsqueci({ onVoltar, onEnviado }) {
  const [email, setEmail]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setErro('Informe seu email'); return }
    setErro(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) { setErro('Não foi possível enviar o email. Verifique o endereço informado.'); setLoading(false) }
    else onEnviado()
  }

  return (
    <>
      <button onClick={onVoltar}
        style={{ background: 'none', border: 'none', color: T.textSubtle, fontSize: T.small, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 18, padding: 0 }}>
        ← Voltar ao login
      </button>
      <h2 style={{ fontSize: T.title, fontWeight: T.light, color: T.text, fontFamily: "'Raleway', sans-serif", letterSpacing: T.lsTitle, margin: '0 0 6px', textAlign: 'center' }}>
        Recuperar senha
      </h2>
      <p style={{ fontSize: T.small, color: T.textMuted, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6 }}>
        Informe seu email e enviaremos um link para redefinir sua senha.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Email cadastrado</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com" required autoFocus style={fieldStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(204,145,94,0.60)'}
            onBlur={e => e.target.style.borderColor = 'rgba(204,145,94,0.20)'}
          />
        </div>

        {erro && (
          <div style={{ padding: '10px 14px', fontSize: T.small, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 8, color: '#FCA5A5' }}>{erro}</div>
        )}

        <button type="submit" disabled={loading} style={submitBtnStyle}>
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>
    </>
  )
}

function TelaEnviado({ onVoltar }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0 22px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.40)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, color: '#22C55E', fontWeight: T.semibold,
        }}>✓</div>
        <div>
          <div style={{ fontSize: T.title, fontWeight: T.light, color: T.text, fontFamily: "'Raleway', sans-serif", marginBottom: 8 }}>Email enviado!</div>
          <div style={{ fontSize: T.small, color: T.textMuted, lineHeight: 1.7, maxWidth: 320 }}>
            Verifique sua caixa de entrada e clique no link para redefinir sua senha. O link expira em 1 hora.
          </div>
        </div>
        <div style={{ background: 'rgba(200,137,92,0.06)', border: '1px solid rgba(200,137,92,0.20)', borderRadius: 10, padding: '10px 16px', fontSize: T.small, color: T.textSubtle, lineHeight: 1.6 }}>
          Não recebeu? Verifique a pasta de spam ou tente novamente.
        </div>
      </div>
      <button onClick={onVoltar} style={submitBtnStyle}>Voltar ao login</button>
    </>
  )
}
