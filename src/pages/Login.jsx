import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function Logo() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
      <img
        src="/logotipo-vertical-azul.png"
        alt="Polímata Consultoria em GRC"
        style={{ height: 72, width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}

export default function Login() {
  const [tela, setTela] = useState('login')

  return (
    <div className="login-bg">
      <div className="login-card">
        <Logo />
        <div className="login-divider" />
        {tela === 'login'   && <TelaLogin    onEsqueci={() => setTela('esqueci')} />}
        {tela === 'esqueci' && <TelaEsqueci  onVoltar={() => setTela('login')} onEnviado={() => setTela('enviado')} />}
        {tela === 'enviado' && <TelaEnviado  onVoltar={() => setTela('login')} />}
        <div className="login-footer">Polímata Consultoria em GRC · {new Date().getFullYear()}</div>
      </div>
    </div>
  )
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
      <h1 className="login-title">Acesse sua conta</h1>
      <p className="login-subtitle">Sistema de Controles Internos</p>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
        </div>
        <div className="login-field">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <label>Senha</label>
            <button type="button" onClick={() => setShowSenha(v => !v)}
              style={{background:'none', border:'none', color:'var(--txt3)', fontSize:10, cursor:'pointer', letterSpacing:'.3px', padding:0}}>
              {showSenha ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
        </div>
        {erro && <div className="login-erro">{erro}</div>}
        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        <button type="button" onClick={onEsqueci}
          style={{background:'none', border:'none', color:'var(--gold)', fontSize:11, cursor:'pointer', textAlign:'center', padding:'4px 0', letterSpacing:'.3px', textDecoration:'underline', textUnderlineOffset:3}}>
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
      redirectTo: `${window.location.origin}/redefinir-senha`
    })
    if (error) { setErro('Não foi possível enviar o email. Verifique o endereço informado.'); setLoading(false) }
    else onEnviado()
  }

  return (
    <>
      <button onClick={onVoltar}
        style={{background:'none', border:'none', color:'var(--txt3)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:5, marginBottom:20, padding:0, letterSpacing:'.3px'}}>
        ← Voltar ao login
      </button>
      <h1 className="login-title">Recuperar senha</h1>
      <p className="login-subtitle" style={{marginBottom:24}}>Informe seu email e enviaremos um link para redefinir sua senha.</p>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-field">
          <label>Email cadastrado</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
        </div>
        {erro && <div className="login-erro">{erro}</div>}
        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</button>
      </form>
    </>
  )
}

function TelaEnviado({ onVoltar }) {
  return (
    <>
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'8px 0 24px', textAlign:'center'}}>
        <div style={{width:56, height:56, borderRadius:'50%', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#22C55E'}}>✓</div>
        <div>
          <div style={{fontSize:16, fontWeight:600, color:'var(--txt1)', marginBottom:8}}>Email enviado!</div>
          <div style={{fontSize:12, color:'var(--txt3)', lineHeight:1.7, maxWidth:300}}>Verifique sua caixa de entrada e clique no link para redefinir sua senha. O link expira em 1 hora.</div>
        </div>
        <div style={{background:'rgba(204,145,94,0.06)', border:'1px solid var(--brd)', borderRadius:8, padding:'10px 16px', fontSize:11, color:'var(--txt3)', lineHeight:1.6}}>
          Não recebeu? Verifique a pasta de spam ou tente novamente.
        </div>
      </div>
      <button onClick={onVoltar} className="login-btn">Voltar ao login</button>
    </>
  )
}
