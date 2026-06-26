// ═══════════════════════════════════════════════════════════════════════════
// Mapeamentos.jsx — Módulo Mapeamento de Processos
// Áudio da entrevista → Whisper → Claude → POP (.docx), Matriz+RACI (.xlsx),
// Fluxograma BPMN (.drawio). Exclusivo Polímata (admin/consultor).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatNomeEmpresa } from '../lib/formatNome'
import { gerarPOPDocx } from '../lib/mapeamento/gerarPOPDocx'
import { gerarMatrizXlsx } from '../lib/mapeamento/gerarMatrizXlsx'
import { gerarFluxoDrawio } from '../lib/mapeamento/gerarFluxoDrawio'
import { prepararAudio } from '../lib/mapeamento/audio'
import { VisaoCliente, BlocoConsultor } from '../components/mapeamento/CronogramaUI'

const STATUS_CFG = {
  rascunho:      { label: 'Rascunho',          color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
  audio_enviado: { label: 'Na fila',           color: '#1D4ED8', bg: 'rgba(59,130,246,0.10)' },
  transcrevendo: { label: 'Transcrevendo…',    color: '#92400E', bg: 'rgba(234,179,8,0.15)', anim: true },
  transcrito:    { label: 'Transcrito',        color: '#0E7490', bg: 'rgba(6,182,212,0.10)' },
  estruturando:  { label: 'Estruturando…',     color: '#92400E', bg: 'rgba(234,179,8,0.15)', anim: true },
  estruturado:   { label: 'Concluído',         color: '#15803D', bg: 'rgba(34,197,94,0.12)' },
  erro:          { label: 'Erro',              color: '#991B1B', bg: 'rgba(239,68,68,0.12)' },
}
const EM_PROCESSO = ['audio_enviado', 'transcrevendo', 'estruturando']

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.rascunho
  return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

function fmtDur(s) {
  if (!s && s !== 0) return '—'
  const m = Math.floor(s / 60)
  return m ? `${m}min ${s % 60}s` : `${s}s`
}

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function siglaCliente(nome) {
  const limpo = (nome || 'CLI').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '')
  return (limpo.slice(0, 3) || 'CLI').toUpperCase()
}

// ─── Gravador de áudio ──────────────────────────────────────────────────────
function useGravador() {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const resolveRef = useRef(null)

  const iniciar = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 28000 })
    chunksRef.current = []
    rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data) }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      resolveRef.current?.(blob)
    }
    rec.start(1000)
    recRef.current = rec
    setSegundos(0)
    setGravando(true)
    timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
  }

  const parar = () => new Promise((resolve) => {
    resolveRef.current = resolve
    clearInterval(timerRef.current)
    setGravando(false)
    recRef.current?.stop()
  })

  useEffect(() => () => clearInterval(timerRef.current), [])
  return { gravando, segundos, iniciar, parar }
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function Mapeamentos({ projeto }) {
  const { perfil } = useAuth()
  const isPolimata = ['admin_polimata', 'consultor_polimata'].includes(perfil?.papel)
  const [lista, setLista] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [selId, setSelId] = useState(null)
  const [erroUi, setErroUi] = useState('')

  const sel = lista.find((m) => m.id === selId) || null
  const clienteNome = formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || 'Cliente'

  const carregar = useCallback(async () => {
    if (!projeto?.id) return
    const { data, error } = await supabase
      .from('mapeamentos').select('*')
      .eq('projeto_id', projeto.id)
      .order('criado_em', { ascending: false })
    if (!error) setLista(data || [])
    setLoading(false)
  }, [projeto?.id])

  useEffect(() => { setLoading(true); carregar() }, [carregar])
  useEffect(() => {
    supabase.from('areas').select('id, nome').eq('projeto_id', projeto?.id).order('ordem')
      .then(({ data }) => setAreas(data || []))
  }, [projeto?.id])

  // polling enquanto há processamento em andamento
  useEffect(() => {
    if (!lista.some((m) => EM_PROCESSO.includes(m.status))) return
    const t = setInterval(carregar, 6000)
    return () => clearInterval(t)
  }, [lista, carregar])

  const invocar = async (id, etapa = 'completo') => {
    setErroUi('')
    const { error } = await supabase.functions.invoke('mapeamento-pipeline', { body: { mapeamento_id: id, etapa } })
    if (error) setErroUi('Falha ao iniciar processamento: ' + error.message)
    setTimeout(carregar, 1500)
  }

  if (!isPolimata) {
    return <VisaoCliente projeto={projeto} />
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Montserrat' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: '#A6512F' }}>Polímata · Mapeamento</div>
          <div style={{ fontSize: 22, fontWeight: 300, color: '#00203E', fontFamily: 'Raleway, Montserrat' }}>Mapeamento de Processos</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Entrevista gravada → transcrição → POP, fluxograma BPMN e matriz de riscos COSO+ISO com RACI</div>
        </div>
        <button onClick={() => setModalNovo(true)} style={{ background: 'linear-gradient(135deg, #A6512F, #CC915E)', color: '#fff', border: 'none', borderRadius: 999, padding: '11px 22px', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat', cursor: 'pointer' }}>
          🎙 Novo mapeamento
        </button>
      </div>

      {erroUi && <div style={{ background: 'rgba(239,68,68,0.10)', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{erroUi}</div>}

      {/* Lista */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F3EEE4' }}>
              {['Processo', 'Sigla', 'Área', 'Áudio', 'Status', 'Criado em', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#00203E' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Carregando…</td></tr>}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#6B7280' }}>
                Nenhum mapeamento ainda. Clique em <b>Novo mapeamento</b>, grave (ou suba) a entrevista do processo e receba o pacote completo: POP, fluxograma e matriz de riscos.
              </td></tr>
            )}
            {lista.map((m) => (
              <tr key={m.id} onClick={() => setSelId(m.id === selId ? null : m.id)} style={{ borderTop: '1px solid rgba(0,32,62,0.06)', cursor: 'pointer', background: m.id === selId ? 'rgba(204,145,94,0.07)' : 'transparent' }}>
                <td style={{ padding: '11px 14px', fontWeight: 600, color: '#00203E' }}>{m.nome_processo}</td>
                <td style={{ padding: '11px 14px' }}>{m.sigla_processo || '—'}</td>
                <td style={{ padding: '11px 14px' }}>{areas.find((a) => a.id === m.area_id)?.nome || '—'}</td>
                <td style={{ padding: '11px 14px' }}>{fmtDur(m.audio_duracao_seg)}</td>
                <td style={{ padding: '11px 14px' }}><StatusBadge status={m.status} /></td>
                <td style={{ padding: '11px 14px', color: '#6B7280' }}>{new Date(m.criado_em).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '11px 14px', color: '#A6512F', fontWeight: 600 }}>{m.id === selId ? '▲' : '▼'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && <Detalhe map={sel} clienteNome={clienteNome} invocar={invocar} carregar={carregar} />}
      {modalNovo && <ModalNovo projeto={projeto} areas={areas} perfil={perfil} onFechar={() => setModalNovo(false)} onCriado={(id) => { setModalNovo(false); setSelId(id); carregar() }} invocar={invocar} />}
    </div>
  )
}

// ─── Detalhe ────────────────────────────────────────────────────────────────
function Detalhe({ map, clienteNome, invocar, carregar }) {
  const [transcricao, setTranscricao] = useState(map.transcricao || '')
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState('')
  useEffect(() => { setTranscricao(map.transcricao || '') }, [map.id, map.transcricao])

  const codigoBase = `${siglaCliente(clienteNome)}-${(map.sigla_processo || 'PRO').toUpperCase()}-POP-001`
  const pronto = map.status === 'estruturado' && map.estrutura
  const processando = EM_PROCESSO.includes(map.status)
  const e = map.estrutura || {}

  const salvarTranscricao = async () => {
    setSalvando(true)
    await supabase.from('mapeamentos').update({ transcricao }).eq('id', map.id)
    setSalvando(false)
    carregar()
  }

  const baixar = async (tipo) => {
    setGerando(tipo)
    try {
      const base = `${codigoBase.replace('POP-001', '')}${map.nome_processo.replace(/[^\wÀ-ú ]/g, '').replace(/ +/g, '_')}`
      if (tipo === 'pop') {
        const blob = await gerarPOPDocx(map.estrutura, { nomeProcesso: map.nome_processo, clienteNome, codigoBase, autor: 'Polímata Consultoria' })
        baixarBlob(blob, `POP_${base}.docx`)
      } else if (tipo === 'matriz') {
        const buf = await gerarMatrizXlsx(map.estrutura, { nomeProcesso: map.nome_processo, clienteNome, codigoBase })
        baixarBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Matriz_Riscos_RACI_${base}.xlsx`)
      } else if (tipo === 'fluxo') {
        const xml = gerarFluxoDrawio(map.estrutura, map.nome_processo)
        baixarBlob(new Blob([xml], { type: 'application/xml' }), `Fluxograma_${base}.drawio`)
      }
    } catch (err) {
      alert('Falha ao gerar arquivo: ' + err.message)
    }
    setGerando('')
  }

  const Btn = ({ onClick, children, primario, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{
      background: primario ? 'linear-gradient(135deg, #A6512F, #CC915E)' : 'rgba(204,145,94,0.10)',
      color: primario ? '#fff' : '#A6512F', border: primario ? 'none' : '1px solid rgba(204,145,94,0.35)',
      borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  )

  return (
    <div style={{ marginTop: 16, background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#00203E' }}>{map.nome_processo} <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>· {codigoBase}</span></div>
        <StatusBadge status={map.status} />
      </div>

      {map.status === 'erro' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', color: '#991B1B', padding: '12px 16px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
          <b>Erro no processamento:</b> {map.erro}
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Btn onClick={() => invocar(map.id, map.transcricao ? 'estruturar' : 'completo')} primario>Tentar novamente</Btn>
          </div>
        </div>
      )}

      {processando && (
        <div style={{ background: 'rgba(234,179,8,0.08)', color: '#92400E', padding: '12px 16px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
          ⏳ Processando — esta página atualiza sozinha. Transcrição e estruturação podem levar alguns minutos, conforme a duração do áudio.
        </div>
      )}

      {/* Downloads */}
      {pronto && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, padding: '14px 16px', background: '#F3EEE4', borderRadius: 10 }}>
          <Btn primario onClick={() => baixar('pop')} disabled={!!gerando}>{gerando === 'pop' ? 'Gerando…' : '📄 POP (.docx)'}</Btn>
          <Btn primario onClick={() => baixar('matriz')} disabled={!!gerando}>{gerando === 'matriz' ? 'Gerando…' : '📊 Matriz de Riscos + RACI (.xlsx)'}</Btn>
          <Btn primario onClick={() => baixar('fluxo')} disabled={!!gerando}>{gerando === 'fluxo' ? 'Gerando…' : '🔀 Fluxograma BPMN (.drawio)'}</Btn>
        </div>
      )}

      {/* Resumo da estrutura */}
      {pronto && (
        <div style={{ display: 'flex', gap: 22, marginBottom: 18, fontSize: 12, color: '#00203E', flexWrap: 'wrap' }}>
          <span><b>{(e.subprocessos || []).reduce((n, s) => n + (s.passos?.length || 0), 0)}</b> atividades</span>
          <span><b>{e.subprocessos?.length || 0}</b> subprocessos</span>
          <span><b>{e.riscos?.length || 0}</b> riscos</span>
          <span><b>{e.atores?.length || 0}</b> atores</span>
          <span><b>{e.sistemas?.length || 0}</b> sistemas</span>
          <span><b>{(e.subprocessos || []).reduce((n, s) => n + (s.pontos_atencao?.length || 0), 0)}</b> pontos de atenção</span>
        </div>
      )}

      {/* Lacunas */}
      {pronto && e.lacunas?.length > 0 && (
        <div style={{ background: 'rgba(204,145,94,0.08)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A6512F', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Lacunas — validar com o entrevistado</div>
          {e.lacunas.map((l, i) => <div key={i} style={{ fontSize: 12, color: '#1F2937', padding: '3px 0' }}>{i + 1}. {l}</div>)}
        </div>
      )}

      {/* Transcrição */}
      {(map.transcricao || pronto || map.status === 'transcrito') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00203E', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Transcrição da entrevista</div>
          <textarea value={transcricao} onChange={(ev) => setTranscricao(ev.target.value)} rows={8}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 12, lineHeight: 1.6, padding: 12, borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn onClick={salvarTranscricao} disabled={salvando || transcricao === (map.transcricao || '')}>{salvando ? 'Salvando…' : 'Salvar transcrição'}</Btn>
            <Btn primario onClick={async () => { await salvarTranscricao(); invocar(map.id, 'estruturar') }} disabled={processando || !transcricao.trim()}>
              {pronto ? '↻ Reestruturar com a transcrição revisada' : 'Estruturar'}
            </Btn>
          </div>
        </div>
      )}

      <BlocoConsultor map={map} onMudou={carregar} />
    </div>
  )
}

// ─── Modal novo mapeamento ─────────────────────────────────────────────────
function ModalNovo({ projeto, areas, perfil, onFechar, onCriado, invocar }) {
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [areaId, setAreaId] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [blobGravado, setBlobGravado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [etapaEnvio, setEtapaEnvio] = useState('')
  const [erro, setErro] = useState('')
  const grav = useGravador()

  const audioPronto = arquivo || blobGravado

  const criar = async () => {
    if (!nome.trim()) { setErro('Informe o nome do processo.'); return }
    if (!audioPronto) { setErro('Grave ou anexe o áudio da entrevista.'); return }
    const baseBlob = arquivo || blobGravado
    setEnviando(true); setErro('')
    try {
      setEtapaEnvio('Otimizando áudio…')
      const { parts, ext, contentType, duracaoSeg } = await prepararAudio(baseBlob)

      const { data: row, error: insErr } = await supabase.from('mapeamentos').insert({
        projeto_id: projeto.id, area_id: areaId || null,
        nome_processo: nome.trim(), sigla_processo: sigla.trim().toUpperCase() || null,
        status: 'rascunho', criado_por: perfil?.id || null,
      }).select().single()
      if (insErr) throw insErr

      const nomeArq = arquivo ? arquivo.name : `gravacao_${Date.now()}.webm`
      const safe = nomeArq.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
      const semExt = safe.replace(/\.[^.]+$/, '')
      const paths = []
      for (let i = 0; i < parts.length; i++) {
        setEtapaEnvio(parts.length > 1 ? `Enviando parte ${i + 1}/${parts.length}…` : 'Enviando áudio…')
        const sufixo = parts.length > 1 ? `_p${i + 1}` : ''
        const nomeParte = ext ? `${semExt}${sufixo}.${ext}` : `${safe}${sufixo}`
        const path = `${projeto.id}/${row.id}/${Date.now()}_${nomeParte}`
        const { error: upErr } = await supabase.storage.from('mapeamentos').upload(path, parts[i], { contentType })
        if (upErr) throw upErr
        paths.push(path)
      }

      const upd = { audio_path: paths[0], audio_nome: nomeArq, status: 'audio_enviado' }
      if (paths.length > 1) upd.audio_parts = paths
      if (duracaoSeg) upd.audio_duracao_seg = duracaoSeg
      await supabase.from('mapeamentos').update(upd).eq('id', row.id)
      await invocar(row.id, 'completo')
      onCriado(row.id)
    } catch (e2) {
      setErro('Falha: ' + e2.message)
      setEnviando(false)
      setEtapaEnvio('')
    }
  }

  const inp = { width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 13, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)', marginBottom: 12 }
  const lbl = { fontSize: 11, fontWeight: 700, color: '#00203E', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,17,44,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onFechar}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 520, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', fontFamily: 'Montserrat' }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#00203E', marginBottom: 4 }}>Novo mapeamento de processo</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 18 }}>Grave a entrevista de levantamento (ou anexe o áudio) e o sistema gera POP, fluxograma e matriz de riscos.</div>

        <label style={lbl}>Nome do processo *</label>
        <input style={inp} value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="ex.: Compras, Contas a Pagar, Faturamento" />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Sigla (p/ codificação)</label>
            <input style={inp} value={sigla} onChange={(ev) => setSigla(ev.target.value.toUpperCase().slice(0, 4))} placeholder="ex.: COM" />
          </div>
          <div style={{ flex: 2 }}>
            <label style={lbl}>Área (opcional)</label>
            <select style={inp} value={areaId} onChange={(ev) => setAreaId(ev.target.value)}>
              <option value="">—</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>

        <label style={lbl}>Áudio da entrevista *</label>
        <div style={{ border: '1px dashed rgba(0,32,62,0.25)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {!grav.gravando ? (
              <button onClick={async () => { setArquivo(null); setBlobGravado(null); try { await grav.iniciar() } catch { setErro('Microfone indisponível — verifique a permissão do navegador.') } }}
                style={{ background: '#00203E', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>
                ● Gravar agora
              </button>
            ) : (
              <button onClick={async () => setBlobGravado(await grav.parar())}
                style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>
                ■ Parar ({Math.floor(grav.segundos / 60)}:{String(grav.segundos % 60).padStart(2, '0')})
              </button>
            )}
            <span style={{ fontSize: 11, color: '#6B7280' }}>ou</span>
            <input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg" onChange={(ev) => { setBlobGravado(null); setArquivo(ev.target.files?.[0] || null) }} style={{ fontSize: 12, fontFamily: 'Montserrat' }} />
          </div>
          {blobGravado && <div style={{ fontSize: 12, color: '#15803D', marginTop: 10 }}>✓ Gravação pronta ({(blobGravado.size / 1024 / 1024).toFixed(1)} MB)</div>}
          {arquivo && <div style={{ fontSize: 12, color: '#15803D', marginTop: 10 }}>✓ {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(1)} MB)</div>}
          <div style={{ fontSize: 10, color: '#6B7280', marginTop: 8 }}>Grave por quanto tempo precisar — áudios longos são otimizados e divididos automaticamente antes do envio.</div>
        </div>

        {erro && <div style={{ background: 'rgba(239,68,68,0.10)', color: '#991B1B', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{erro}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onFechar} style={{ background: 'transparent', border: '1px solid rgba(0,32,62,0.2)', color: '#00203E', borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>Cancelar</button>
          <button onClick={criar} disabled={enviando} style={{ background: 'linear-gradient(135deg, #A6512F, #CC915E)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 12, fontWeight: 600, cursor: enviando ? 'wait' : 'pointer', fontFamily: 'Montserrat', opacity: enviando ? 0.6 : 1 }}>
            {enviando ? (etapaEnvio || 'Enviando…') : 'Enviar e processar'}
          </button>
        </div>
      </div>
    </div>
  )
}
