// ═══════════════════════════════════════════════════════════════════════════
// AgendarUI.jsx — conexão de calendário (Nylas) e entrevistas com bot de gravação.
// ConectarCalendario (header) + ReunioesProcesso (no detalhe): um processo pode ter
// VÁRIAS entrevistas agendadas; "Consolidar" junta as transcrições e regenera os docs.
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

// ─── Reuniões do processo (no detalhe do mapeamento) ──────────────────────────
function fmtDataHora(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function ChipReuniao({ r }) {
  const temTranscricao = (r.transcricao || '').trim()
  let cor = '#92400E', bg = 'rgba(234,179,8,0.15)', label = 'Agendada'
  if (r.status === 'gravada' && temTranscricao) { cor = '#15803D'; bg = 'rgba(34,197,94,0.12)'; label = 'Gravada' }
  else if (r.status === 'gravada') { cor = '#0E7490'; bg = 'rgba(6,182,212,0.10)'; label = 'Gravada (sem transcrição)' }
  else if (r.status === 'erro') { cor = '#991B1B'; bg = 'rgba(239,68,68,0.12)'; label = 'Erro' }
  return <span style={{ fontSize: 9.5, fontWeight: 700, color: cor, background: bg, padding: '2px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{label}</span>
}

export function ReunioesProcesso({ map, perfil, carregar }) {
  const { conn } = useCalendario(perfil?.id)
  const [reunioes, setReunioes] = useState([])
  const [aberto, setAberto] = useState(false)
  const [inicio, setInicio] = useState('')
  const [duracao, setDuracao] = useState(60)
  const [emails, setEmails] = useState('')
  const [titulo, setTitulo] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [consolidando, setConsolidando] = useState(false)

  const carregarReunioes = useCallback(async () => {
    const { data } = await supabase.from('mapeamento_reunioes').select('*').eq('mapeamento_id', map.id).order('inicio', { ascending: true })
    setReunioes(data || [])
  }, [map.id])
  useEffect(() => { carregarReunioes() }, [carregarReunioes])
  // enquanto houver reunião agendada (aguardando gravação), atualiza sozinho
  useEffect(() => {
    if (!reunioes.some((r) => r.status === 'agendada')) return
    const t = setInterval(carregarReunioes, 15000); return () => clearInterval(t)
  }, [reunioes, carregarReunioes])

  const agendar = async () => {
    if (!inicio) { setErro('Escolha data e hora.'); return }
    setBusy(true); setErro('')
    try {
      const participantes = emails.split(/[,;\n]/).map((e) => e.trim()).filter(Boolean)
      const { data, error } = await supabase.functions.invoke('mapeamento-agendar', {
        body: { mapeamento_id: map.id, grant_id: conn.grant_id, inicio: new Date(inicio).toISOString(), duracao_min: Number(duracao), participantes, titulo: titulo.trim() || undefined },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setAberto(false); setInicio(''); setEmails(''); setTitulo('')
      await carregarReunioes()
    } catch (e) { setErro('Falha ao agendar: ' + e.message) }
    setBusy(false)
  }

  const gravadas = reunioes.filter((r) => (r.transcricao || '').trim())
  const consolidar = async () => {
    if (!gravadas.length) return
    setConsolidando(true); setErro('')
    try {
      const combinado = gravadas
        .map((r, i) => `=== Reunião ${i + 1}${r.titulo ? ' — ' + r.titulo : ''}${r.inicio ? ' (' + fmtDataHora(r.inicio) + ')' : ''} ===\n${r.transcricao}`)
        .join('\n\n')
      const { error: upErr } = await supabase.from('mapeamentos').update({ transcricao: combinado, status: 'transcrito' }).eq('id', map.id)
      if (upErr) throw new Error(upErr.message)
      const { error: fnErr } = await supabase.functions.invoke('mapeamento-pipeline', { body: { mapeamento_id: map.id, etapa: 'estruturar' } })
      if (fnErr) throw new Error(fnErr.message)
      carregar?.()
    } catch (e) { setErro('Falha ao consolidar: ' + e.message) }
    setConsolidando(false)
  }

  const inProc = ['estruturando', 'transcrevendo', 'audio_enviado'].includes(map.status)

  return (
    <div style={{ marginTop: 16, background: '#fff', border: '1px solid rgba(0,32,62,0.12)', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: reunioes.length ? 12 : 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          🎥 Entrevistas {reunioes.length > 0 && <span style={{ color: '#6B7280' }}>({reunioes.length})</span>}
        </div>
        {conn && !aberto && (
          <button onClick={() => setAberto(true)} style={{ background: 'rgba(204,145,94,0.10)', color: COBRE, border: '1px solid rgba(204,145,94,0.35)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>
            ＋ Agendar entrevista
          </button>
        )}
      </div>

      {reunioes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {reunioes.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', background: '#F8F6F1', borderRadius: 8 }}>
              <ChipReuniao r={r} />
              <span style={{ fontSize: 12.5, color: AZUL, fontWeight: 500 }}>{r.titulo || 'Entrevista'}</span>
              {r.inicio && <span style={{ fontSize: 11.5, color: '#6B7280' }}>· {fmtDataHora(r.inicio)}</span>}
              {r.meet_url && <a href={r.meet_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: COBRE, fontWeight: 600, marginLeft: 'auto' }}>Abrir Meet ↗</a>}
            </div>
          ))}
        </div>
      )}

      {!conn ? (
        <div style={{ fontSize: 12, color: '#92400E', background: 'rgba(234,179,8,0.10)', padding: '10px 14px', borderRadius: 8 }}>
          Conecte seu calendário (botão no topo da página) para agendar entrevistas com gravação automática.
        </div>
      ) : aberto ? (
        <div style={{ background: '#F8F6F1', border: '1px solid rgba(0,32,62,0.10)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Início<br/>
              <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ fontFamily: 'Montserrat', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
            </label>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Duração (min)<br/>
              <input type="number" min={15} step={15} value={duracao} onChange={(e) => setDuracao(e.target.value)} style={{ width: 90, fontFamily: 'Montserrat', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
            </label>
            <label style={{ fontSize: 11, color: '#6B7280', flex: 1, minWidth: 160 }}>Título (opcional)<br/>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex.: Parte 2 — exceções" style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }} />
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
            <button onClick={() => { setAberto(false); setErro('') }} style={{ background: 'transparent', border: '1px solid rgba(0,32,62,0.2)', color: AZUL, borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>Cancelar</button>
          </div>
        </div>
      ) : reunioes.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6B7280' }}>Nenhuma entrevista agendada ainda. A IA entra na reunião e grava automaticamente.</div>
      ) : null}

      {gravadas.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,32,62,0.08)' }}>
          {erro && !aberto && <div style={{ color: '#991B1B', fontSize: 12, marginBottom: 8 }}>{erro}</div>}
          <button onClick={consolidar} disabled={consolidando || inProc} style={{ background: 'linear-gradient(135deg, #00203E, #16466e)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 12.5, fontWeight: 600, cursor: (consolidando || inProc) ? 'wait' : 'pointer', fontFamily: 'Montserrat' }}>
            {consolidando ? 'Consolidando…' : `🧩 Consolidar ${gravadas.length} gravaç${gravadas.length > 1 ? 'ões' : 'ão'} e gerar documentos`}
          </button>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Junta as transcrições das entrevistas gravadas e (re)gera POP, fluxograma e matriz do conjunto.</div>
        </div>
      )}
    </div>
  )
}
