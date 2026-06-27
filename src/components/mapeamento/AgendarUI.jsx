// ═══════════════════════════════════════════════════════════════════════════
// AgendarUI.jsx — conexão de calendário (Nylas) e agendamento de entrevista com
// bot de gravação. ConectarCalendario (header) + AgendarEntrevista (no detalhe).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const COBRE = '#A6512F', AZUL = '#00203E'

export function useCalendario(perfilId) {
  const [conn, setConn] = useState(null)
  const [loading, setLoading] = useState(true)
  const carregar = useCallback(async () => {
    if (!perfilId) { setLoading(false); return }
    const { data } = await supabase.from('mapeamento_calendarios').select('*').eq('perfil_id', perfilId).maybeSingle()
    setConn(data || null); setLoading(false)
  }, [perfilId])
  useEffect(() => { carregar() }, [carregar])
  return { conn, loading, recarregar: carregar }
}

// ─── Conectar calendário (header) ─────────────────────────────────────────────
export function ConectarCalendario({ perfil }) {
  const { conn, loading, recarregar } = useCalendario(perfil?.id)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('cal')
    if (p === 'ok') { setMsg('✓ Calendário conectado!'); recarregar() }
    else if (p === 'dominio') setMsg('Use um e-mail @polimatagrc.com.br.')
    else if (p === 'erro') setMsg('Falha ao conectar — tente novamente.')
    if (p) window.history.replaceState({}, '', window.location.pathname)
  }, [recarregar])

  const conectar = async () => {
    setBusy(true); setMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('nylas-connect', { body: { action: 'start' } })
      if (error || !data?.url) throw new Error(error?.message || 'sem URL')
      window.location.href = data.url
    } catch (e) { setMsg('Erro: ' + e.message); setBusy(false) }
  }

  if (loading) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {conn ? (
        <span style={{ fontSize: 11.5, color: '#15803D', background: 'rgba(34,197,94,0.10)', padding: '6px 12px', borderRadius: 999, fontWeight: 600 }}>
          📅 Calendário conectado: {conn.email}
          <button onClick={conectar} disabled={busy} style={{ marginLeft: 8, background: 'none', border: 'none', color: COBRE, cursor: 'pointer', fontSize: 11, fontWeight: 600, textDecoration: 'underline' }}>reconectar</button>
        </span>
      ) : (
        <button onClick={conectar} disabled={busy} style={{ background: '#fff', color: COBRE, border: `1px solid ${COBRE}`, borderRadius: 999, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'Montserrat' }}>
          {busy ? 'Abrindo…' : '📅 Conectar meu calendário'}
        </button>
      )}
      {msg && <span style={{ fontSize: 11, color: '#6B7280' }}>{msg}</span>}
    </div>
  )
}

// ─── Agendar entrevista (no detalhe do mapeamento) ────────────────────────────
export function AgendarEntrevista({ map, perfil, onAgendado }) {
  const { conn } = useCalendario(perfil?.id)
  const [aberto, setAberto] = useState(false)
  const [inicio, setInicio] = useState('')
  const [duracao, setDuracao] = useState(60)
  const [emails, setEmails] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [okMeet, setOkMeet] = useState(map?.reuniao_meet_url || '')

  const agendar = async () => {
    if (!inicio) { setErro('Escolha data e hora.'); return }
    setBusy(true); setErro('')
    try {
      const participantes = emails.split(/[,;\n]/).map((e) => e.trim()).filter(Boolean)
      const { data, error } = await supabase.functions.invoke('mapeamento-agendar', {
        body: { mapeamento_id: map.id, grant_id: conn.grant_id, inicio: new Date(inicio).toISOString(), duracao_min: Number(duracao), participantes },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setOkMeet(data.meet_url || 'agendada')
      setAberto(false); onAgendado?.()
    } catch (e) { setErro('Falha ao agendar: ' + e.message) }
    setBusy(false)
  }

  if (okMeet) {
    return (
      <div style={{ marginTop: 16, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 12.5, color: AZUL }}>
        🎥 <b>Entrevista agendada</b> — a IA entra na reunião e grava automaticamente.
        {okMeet !== 'agendada' && <> Link do Meet: <a href={okMeet} target="_blank" rel="noreferrer" style={{ color: COBRE, fontWeight: 600 }}>{okMeet}</a></>}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      {!conn ? (
        <div style={{ fontSize: 12, color: '#92400E', background: 'rgba(234,179,8,0.10)', padding: '10px 14px', borderRadius: 8 }}>
          Conecte seu calendário (botão no topo) para agendar a entrevista com gravação automática.
        </div>
      ) : !aberto ? (
        <button onClick={() => setAberto(true)} style={{ background: 'linear-gradient(135deg, #A6512F, #CC915E)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>
          🎥 Agendar entrevista (a IA grava)
        </button>
      ) : (
        <div style={{ background: '#fff', border: '1px solid rgba(0,32,62,0.12)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Agendar entrevista online</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Início<br/>
              <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ fontFamily: 'Montserrat', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
            </label>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Duração (min)<br/>
              <input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(e.target.value)} style={{ width: 90, fontFamily: 'Montserrat', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
            </label>
          </div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 10 }}>E-mail(s) do entrevistado (separe por vírgula)<br/>
            <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="fulano@empresa.com" style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
          </label>
          {erro && <div style={{ color: '#991B1B', fontSize: 12, marginBottom: 8 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={agendar} disabled={busy} style={{ background: 'linear-gradient(135deg, #A6512F, #CC915E)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'Montserrat' }}>
              {busy ? 'Agendando…' : 'Agendar e convidar'}
            </button>
            <button onClick={() => setAberto(false)} style={{ background: 'transparent', border: '1px solid rgba(0,32,62,0.2)', color: AZUL, borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
