// ═══════════════════════════════════════════════════════════════════════════
// Mapeamentos.jsx — Módulo Mapeamento de Processos
// Navegação: Cronograma (planejar processos + prazos + evolução) e
// Área (workspace de mapeamento: gravar/agendar → transcrição → POP/fluxo/matriz).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatNomeEmpresa } from '../lib/formatNome'
import { gerarPOPDocx } from '../lib/mapeamento/gerarPOPDocx'
import { gerarMatrizXlsx } from '../lib/mapeamento/gerarMatrizXlsx'
import { gerarFluxoDrawio } from '../lib/mapeamento/gerarFluxoDrawio'
import { prepararAudio } from '../lib/mapeamento/audio'
import { etapaAtualLabel } from '../lib/mapeamento/cronograma'
import { VisaoCliente, BlocoConsultor, ResumoProjeto } from '../components/mapeamento/CronogramaUI'
import { ConectarCalendario, AgendarEntrevista } from '../components/mapeamento/AgendarUI'

const COBRE = '#A6512F', AZUL = '#00203E'

const STATUS_CFG = {
  rascunho:      { label: 'A iniciar',          color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
  audio_enviado: { label: 'Na fila',            color: '#1D4ED8', bg: 'rgba(59,130,246,0.10)' },
  transcrevendo: { label: 'Transcrevendo…',     color: '#92400E', bg: 'rgba(234,179,8,0.15)' },
  transcrito:    { label: 'Transcrito',         color: '#0E7490', bg: 'rgba(6,182,212,0.10)' },
  estruturando:  { label: 'Estruturando…',      color: '#92400E', bg: 'rgba(234,179,8,0.15)' },
  estruturado:   { label: 'Documentos prontos', color: '#15803D', bg: 'rgba(34,197,94,0.12)' },
  erro:          { label: 'Erro',               color: '#991B1B', bg: 'rgba(239,68,68,0.12)' },
}
const EM_PROCESSO = ['audio_enviado', 'transcrevendo', 'estruturando']

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.rascunho
  return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}
function fmtDur(s) { if (!s && s !== 0) return '—'; const m = Math.floor(s / 60); return m ? `${m}min ${s % 60}s` : `${s}s` }
function fmtData(d) { if (!d) return '—'; try { return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') } catch { return '—' } }
function msDe(d) { return new Date(d.length <= 10 ? d + 'T00:00:00' : d).getTime() }
function siglaDeNome(nome) {
  const limpo = (nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z ]/g, '').trim()
  const w = limpo.split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0][0] + w[1][0] + (w[2] ? w[2][0] : '')).toUpperCase()
  return (w[0] || 'PRO').slice(0, 3).toUpperCase()
}

function PrazoChip({ map }) {
  if (!map.prazo) return <span style={{ color: '#9CA3AF' }}>—</span>
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dias = Math.round((new Date(map.prazo + 'T00:00:00') - hoje) / 86400000)
  let cor = '#0E7490', bg = 'rgba(6,182,212,0.10)', label = 'No prazo'
  if (map.etapa === 'vigente') { cor = '#15803D'; bg = 'rgba(34,197,94,0.12)'; label = 'Concluído' }
  else if (dias < 0) { cor = '#991B1B'; bg = 'rgba(239,68,68,0.12)'; label = `Atrasado ${Math.abs(dias)}d` }
  else if (dias <= 7) { cor = '#92400E'; bg = 'rgba(234,179,8,0.15)'; label = `Faltam ${dias}d` }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.3 }}>
      <span style={{ fontSize: 12, color: AZUL }}>{fmtData(map.prazo)}</span>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: cor, background: bg, padding: '1px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, width: 'fit-content' }}>{label}</span>
    </span>
  )
}

function baixarBlob(blob, nome) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000) }
function siglaCliente(nome) { const limpo = (nome || 'CLI').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, ''); return (limpo.slice(0, 3) || 'CLI').toUpperCase() }

function useGravador() {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const recRef = useRef(null), chunksRef = useRef([]), timerRef = useRef(null), resolveRef = useRef(null)
  const iniciar = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 28000 })
    chunksRef.current = []
    rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data) }
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); resolveRef.current?.(new Blob(chunksRef.current, { type: 'audio/webm' })) }
    rec.start(1000); recRef.current = rec; setSegundos(0); setGravando(true)
    timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
  }
  const parar = () => new Promise((resolve) => { resolveRef.current = resolve; clearInterval(timerRef.current); setGravando(false); recRef.current?.stop() })
  useEffect(() => () => clearInterval(timerRef.current), [])
  return { gravando, segundos, iniciar, parar }
}

async function enviarAudio(mapId, projetoId, baseBlob, nomeBase, setEtapa) {
  setEtapa?.('Otimizando áudio…')
  const { parts, ext, contentType, duracaoSeg } = await prepararAudio(baseBlob)
  const safe = (nomeBase || `gravacao_${Date.now()}.webm`).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
  const semExt = safe.replace(/\.[^.]+$/, '')
  const paths = []
  for (let i = 0; i < parts.length; i++) {
    setEtapa?.(parts.length > 1 ? `Enviando parte ${i + 1}/${parts.length}…` : 'Enviando áudio…')
    const sufixo = parts.length > 1 ? `_p${i + 1}` : ''
    const nomeParte = ext ? `${semExt}${sufixo}.${ext}` : `${safe}${sufixo}`
    const path = `${projetoId}/${mapId}/${Date.now()}_${nomeParte}`
    const { error } = await supabase.storage.from('mapeamentos').upload(path, parts[i], { contentType })
    if (error) throw error
    paths.push(path)
  }
  const upd = { audio_path: paths[0], audio_nome: safe, status: 'audio_enviado' }
  if (paths.length > 1) upd.audio_parts = paths
  if (duracaoSeg) upd.audio_duracao_seg = duracaoSeg
  await supabase.from('mapeamentos').update(upd).eq('id', mapId)
}

const btnPrim = { background: `linear-gradient(135deg, ${COBRE}, #CC915E)`, color: '#fff', border: 'none', borderRadius: 999, padding: '11px 22px', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat', cursor: 'pointer' }
const th = { textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: AZUL }
const inp = { width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 13, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)' }

export default function Mapeamentos({ projeto }) {
  const { perfil } = useAuth()
  const { areaId } = useParams()
  const navigate = useNavigate()
  const isPolimata = ['admin_polimata', 'consultor_polimata'].includes(perfil?.papel)
  const [lista, setLista] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [planejar, setPlanejar] = useState(false)
  const [selId, setSelId] = useState(null)
  const [erroUi, setErroUi] = useState('')
  const clienteNome = formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || 'Cliente'

  const carregar = useCallback(async () => {
    if (!projeto?.id) return
    const { data, error } = await supabase.from('mapeamentos').select('*').eq('projeto_id', projeto.id).order('criado_em', { ascending: false })
    if (!error) setLista(data || [])
    setLoading(false)
  }, [projeto?.id])

  useEffect(() => { setLoading(true); carregar() }, [carregar])
  useEffect(() => { if (projeto?.id) supabase.from('areas').select('id, nome').eq('projeto_id', projeto.id).order('ordem').then(({ data }) => setAreas(data || [])) }, [projeto?.id])
  useEffect(() => { setSelId(null) }, [areaId])
  useEffect(() => { if (!lista.some((m) => EM_PROCESSO.includes(m.status))) return; const t = setInterval(carregar, 6000); return () => clearInterval(t) }, [lista, carregar])

  const invocar = async (id, etapa = 'completo') => {
    setErroUi('')
    const { error } = await supabase.functions.invoke('mapeamento-pipeline', { body: { mapeamento_id: id, etapa } })
    if (error) setErroUi('Falha ao iniciar processamento: ' + error.message)
    setTimeout(carregar, 1500)
  }

  if (!isPolimata) return <VisaoCliente projeto={projeto} />

  const areaAtual = areaId ? areas.find((a) => a.id === areaId) : null
  const listaArea = areaId ? lista.filter((m) => m.area_id === areaId) : lista
  const sel = listaArea.find((m) => m.id === selId) || null

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Montserrat' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: COBRE }}>Polímata · Mapeamento</div>
          <div style={{ fontSize: 22, fontWeight: 300, color: AZUL, fontFamily: 'Raleway, Montserrat' }}>{areaId ? (areaAtual?.nome || 'Área') : 'Cronograma'}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{areaId ? 'Grave ou agende a entrevista e gere POP, fluxograma BPMN e matriz de riscos.' : 'Cadastre os processos a mapear, defina prazos e acompanhe a evolução.'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <ConectarCalendario perfil={perfil} />
          {areaId ? <button onClick={() => setModalNovo(true)} style={btnPrim}>🎙 Novo mapeamento</button> : <button onClick={() => setPlanejar(true)} style={btnPrim}>＋ Cadastrar processo</button>}
        </div>
      </div>

      {erroUi && <div style={{ background: 'rgba(239,68,68,0.10)', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>{erroUi}</div>}

      {areaId ? <AreaWorkspace lista={listaArea} loading={loading} selId={selId} setSelId={setSelId} /> : <CronogramaView lista={lista} areas={areas} loading={loading} navigate={navigate} />}

      {sel && <Detalhe map={sel} projeto={projeto} perfil={perfil} clienteNome={clienteNome} invocar={invocar} carregar={carregar} />}

      {modalNovo && <ModalNovo projeto={projeto} areas={areas} areaFixa={areaId} perfil={perfil} onFechar={() => setModalNovo(false)} onCriado={(id) => { setModalNovo(false); setSelId(id); carregar() }} invocar={invocar} />}
      {planejar && <PlanejarModal projeto={projeto} areas={areas} perfil={perfil} onFechar={() => setPlanejar(false)} onCriado={() => { setPlanejar(false); carregar() }} />}
    </div>
  )
}

function CronogramaView({ lista, areas, loading, navigate }) {
  return (
    <>
      <ResumoProjeto lista={lista} />
      {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Carregando…</div>
        : lista.length === 0 ? <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', padding: 36, textAlign: 'center', color: '#6B7280' }}>Nenhum processo cadastrado. Clique em <b>Cadastrar processo</b> para planejar o que será mapeado, com início e prazo.</div>
        : <GanttCronograma lista={lista} areas={areas} navigate={navigate} />}
    </>
  )
}

function GanttCronograma({ lista, areas, navigate }) {
  const areaNome = (id) => areas.find((a) => a.id === id)?.nome || '—'
  const itens = lista.map((m) => {
    let ini = msDe(m.data_inicio || m.criado_em)
    let fim = msDe(m.prazo || m.data_inicio || m.criado_em)
    if (fim < ini) fim = ini
    if (fim === ini) fim = ini + 7 * 86400000
    return { m, ini, fim }
  }).sort((a, b) => a.ini - b.ini)
  const minMs = Math.min(...itens.map((x) => x.ini))
  const maxMs = Math.max(...itens.map((x) => x.fim))
  const sd = new Date(minMs), start = new Date(sd.getFullYear(), sd.getMonth(), 1).getTime()
  const ed = new Date(maxMs), end = new Date(ed.getFullYear(), ed.getMonth() + 1, 1).getTime()
  const total = Math.max(end - start, 1)
  const pct = (ms) => ((ms - start) / total) * 100
  const meses = []; let cur = new Date(start)
  while (cur.getTime() < end) { meses.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1) }
  const hoje = Date.now()
  const cor = (m) => {
    if (m.etapa === 'vigente') return '#22C55E'
    if (m.prazo && msDe(m.prazo) < hoje) return '#EF4444'
    if (EM_PROCESSO.includes(m.status) || m.status === 'transcrito') return '#CC915E'
    return COBRE
  }
  const LBL = 200
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', padding: 16, overflowX: 'auto' }}>
      <div style={{ minWidth: 680 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: LBL, flexShrink: 0 }} />
          <div style={{ position: 'relative', flex: 1, height: 22, borderBottom: '1px solid rgba(0,32,62,0.10)' }}>
            {meses.map((mz, i) => (
              <div key={i} style={{ position: 'absolute', left: pct(mz.getTime()) + '%', top: 0, fontSize: 10, color: '#6B7280', fontWeight: 600, textTransform: 'capitalize', paddingLeft: 4 }}>
                {mz.toLocaleDateString('pt-BR', { month: 'short' })}{mz.getMonth() === 0 ? ' ' + mz.getFullYear() : ''}
              </div>
            ))}
          </div>
        </div>
        {itens.map(({ m, ini, fim }) => (
          <div key={m.id} onClick={() => m.area_id && navigate('/mapeamentos/area/' + m.area_id)} style={{ display: 'flex', alignItems: 'center', cursor: m.area_id ? 'pointer' : 'default', borderTop: '1px solid rgba(0,32,62,0.05)' }}>
            <div style={{ width: LBL, flexShrink: 0, padding: '8px 10px 8px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: AZUL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome_processo}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{areaNome(m.area_id)}</div>
            </div>
            <div style={{ position: 'relative', flex: 1, height: 34 }}>
              {meses.map((mz, i) => <div key={i} style={{ position: 'absolute', left: pct(mz.getTime()) + '%', top: 0, bottom: 0, width: 1, background: 'rgba(0,32,62,0.05)' }} />)}
              {hoje >= start && hoje <= end && <div style={{ position: 'absolute', left: pct(hoje) + '%', top: 0, bottom: 0, width: 2, background: 'rgba(239,68,68,0.5)' }} />}
              <div title={`${fmtData(m.data_inicio)} → ${fmtData(m.prazo)}`} style={{ position: 'absolute', left: pct(ini) + '%', width: Math.max(pct(fim) - pct(ini), 1.5) + '%', top: 8, height: 18, background: cor(m), borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
                <span style={{ fontSize: 9.5, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{etapaAtualLabel(m)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 10 }}>A linha vermelha marca hoje. Clique numa barra para abrir a área e fazer o mapeamento.</div>
    </div>
  )
}

function AreaWorkspace({ lista, loading, selId, setSelId }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ background: '#F3EEE4' }}>{['Processo', 'Sigla', 'Prazo', 'Áudio', 'Status', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Carregando…</td></tr>}
          {!loading && lista.length === 0 && <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#6B7280' }}>Nenhum processo nesta área ainda. Clique em <b>Novo mapeamento</b> para gravar/agendar a entrevista, ou cadastre o processo no Cronograma.</td></tr>}
          {lista.map((m) => (
            <tr key={m.id} onClick={() => setSelId(m.id === selId ? null : m.id)} style={{ borderTop: '1px solid rgba(0,32,62,0.06)', cursor: 'pointer', background: m.id === selId ? 'rgba(204,145,94,0.07)' : 'transparent' }}>
              <td style={{ padding: '11px 14px', fontWeight: 600, color: AZUL }}>{m.nome_processo}</td>
              <td style={{ padding: '11px 14px' }}>{m.sigla_processo || '—'}</td>
              <td style={{ padding: '11px 14px' }}><PrazoChip map={m} /></td>
              <td style={{ padding: '11px 14px' }}>{fmtDur(m.audio_duracao_seg)}</td>
              <td style={{ padding: '11px 14px' }}><StatusBadge status={m.status} /></td>
              <td style={{ padding: '11px 14px', color: COBRE, fontWeight: 600 }}>{m.id === selId ? '▲' : '▼'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CapturaAudio({ map, projeto, invocar, carregar }) {
  const grav = useGravador()
  const [arquivo, setArquivo] = useState(null), [blobGravado, setBlobGravado] = useState(null)
  const [enviando, setEnviando] = useState(false), [etapa, setEtapa] = useState(''), [erro, setErro] = useState('')
  const base = arquivo || blobGravado
  const enviar = async () => {
    if (!base) { setErro('Grave ou anexe o áudio.'); return }
    setEnviando(true); setErro('')
    try { await enviarAudio(map.id, projeto.id, base, arquivo?.name, setEtapa); await invocar(map.id, 'completo'); carregar() }
    catch (e) { setErro('Falha: ' + e.message); setEnviando(false); setEtapa('') }
  }
  return (
    <div style={{ border: '1px dashed rgba(0,32,62,0.25)', borderRadius: 10, padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Entrevista — gravar ou subir o áudio</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {!grav.gravando ? (
          <button onClick={async () => { setArquivo(null); setBlobGravado(null); try { await grav.iniciar() } catch { setErro('Microfone indisponível — verifique a permissão do navegador.') } }} style={{ background: AZUL, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>● Gravar agora</button>
        ) : (
          <button onClick={async () => setBlobGravado(await grav.parar())} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>■ Parar ({Math.floor(grav.segundos / 60)}:{String(grav.segundos % 60).padStart(2, '0')})</button>
        )}
        <span style={{ fontSize: 11, color: '#6B7280' }}>ou</span>
        <input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg" onChange={(ev) => { setBlobGravado(null); setArquivo(ev.target.files?.[0] || null) }} style={{ fontSize: 12, fontFamily: 'Montserrat' }} />
        {base && <button onClick={enviar} disabled={enviando} style={{ ...btnPrim, borderRadius: 8, padding: '9px 18px' }}>{enviando ? (etapa || 'Enviando…') : 'Enviar e processar'}</button>}
      </div>
      {blobGravado && <div style={{ fontSize: 12, color: '#15803D', marginTop: 10 }}>✓ Gravação pronta ({(blobGravado.size / 1024 / 1024).toFixed(1)} MB)</div>}
      {arquivo && <div style={{ fontSize: 12, color: '#15803D', marginTop: 10 }}>✓ {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(1)} MB)</div>}
      {erro && <div style={{ color: '#991B1B', fontSize: 12, marginTop: 8 }}>{erro}</div>}
      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 8 }}>Grave por quanto tempo precisar — áudios longos são otimizados e divididos automaticamente.</div>
    </div>
  )
}

function Detalhe({ map, projeto, perfil, clienteNome, invocar, carregar }) {
  const [transcricao, setTranscricao] = useState(map.transcricao || '')
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState('')
  useEffect(() => { setTranscricao(map.transcricao || '') }, [map.id, map.transcricao])

  const codigoBase = `${siglaCliente(clienteNome)}-${(map.sigla_processo || 'PRO').toUpperCase()}-POP-001`
  const pronto = map.status === 'estruturado' && map.estrutura
  const processando = EM_PROCESSO.includes(map.status)
  const semAudio = !map.audio_path && (map.status === 'rascunho' || !map.status)
  const e = map.estrutura || {}

  const salvarTranscricao = async () => { setSalvando(true); await supabase.from('mapeamentos').update({ transcricao }).eq('id', map.id); setSalvando(false); carregar() }
  const baixar = async (tipo) => {
    setGerando(tipo)
    try {
      const base = `${codigoBase.replace('POP-001', '')}${map.nome_processo.replace(/[^\wÀ-ÿ ]/g, '').replace(/ +/g, '_')}`
      if (tipo === 'pop') baixarBlob(await gerarPOPDocx(map.estrutura, { nomeProcesso: map.nome_processo, clienteNome, codigoBase, autor: 'Polímata Consultoria' }), `POP_${base}.docx`)
      else if (tipo === 'matriz') baixarBlob(new Blob([await gerarMatrizXlsx(map.estrutura, { nomeProcesso: map.nome_processo, clienteNome, codigoBase })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Matriz_Riscos_RACI_${base}.xlsx`)
      else if (tipo === 'fluxo') baixarBlob(new Blob([gerarFluxoDrawio(map.estrutura, map.nome_processo)], { type: 'application/xml' }), `Fluxograma_${base}.drawio`)
    } catch (err) { alert('Falha ao gerar arquivo: ' + err.message) }
    setGerando('')
  }
  const Btn = ({ onClick, children, primario, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{ background: primario ? `linear-gradient(135deg, ${COBRE}, #CC915E)` : 'rgba(204,145,94,0.10)', color: primario ? '#fff' : COBRE, border: primario ? 'none' : '1px solid rgba(204,145,94,0.35)', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>{children}</button>
  )

  return (
    <div style={{ marginTop: 16, background: '#fff', borderRadius: 12, border: '1px solid rgba(0,32,62,0.08)', padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: AZUL }}>{map.nome_processo} <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>· {codigoBase}</span></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><PrazoChip map={map} /><StatusBadge status={map.status} /></div>
      </div>

      {map.status === 'erro' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', color: '#991B1B', padding: '12px 16px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
          <b>Erro no processamento:</b> {map.erro}
          <div style={{ marginTop: 10 }}><Btn onClick={() => invocar(map.id, map.transcricao ? 'estruturar' : 'completo')} primario>Tentar novamente</Btn></div>
        </div>
      )}
      {processando && <div style={{ background: 'rgba(234,179,8,0.08)', color: '#92400E', padding: '12px 16px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>⏳ Processando — esta página atualiza sozinha. Pode levar alguns minutos.</div>}

      {semAudio && (
        <div style={{ marginBottom: 8 }}>
          <AgendarEntrevista map={map} perfil={perfil} onAgendado={carregar} />
          <CapturaAudio map={map} projeto={projeto} invocar={invocar} carregar={carregar} />
        </div>
      )}

      {pronto && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, padding: '14px 16px', background: '#F3EEE4', borderRadius: 10 }}>
          <Btn primario onClick={() => baixar('pop')} disabled={!!gerando}>{gerando === 'pop' ? 'Gerando…' : '📄 POP (.docx)'}</Btn>
          <Btn primario onClick={() => baixar('matriz')} disabled={!!gerando}>{gerando === 'matriz' ? 'Gerando…' : '📊 Matriz de Riscos + RACI (.xlsx)'}</Btn>
          <Btn primario onClick={() => baixar('fluxo')} disabled={!!gerando}>{gerando === 'fluxo' ? 'Gerando…' : '🔀 Fluxograma BPMN (.drawio)'}</Btn>
        </div>
      )}
      {pronto && (
        <div style={{ display: 'flex', gap: 22, marginBottom: 18, fontSize: 12, color: AZUL, flexWrap: 'wrap' }}>
          <span><b>{(e.subprocessos || []).reduce((n, s) => n + (s.passos?.length || 0), 0)}</b> atividades</span>
          <span><b>{e.subprocessos?.length || 0}</b> subprocessos</span>
          <span><b>{e.riscos?.length || 0}</b> riscos</span>
          <span><b>{e.atores?.length || 0}</b> atores</span>
        </div>
      )}
      {pronto && e.lacunas?.length > 0 && (
        <div style={{ background: 'rgba(204,145,94,0.08)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COBRE, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Lacunas — validar com o entrevistado</div>
          {e.lacunas.map((l, i) => <div key={i} style={{ fontSize: 12, color: '#1F2937', padding: '3px 0' }}>{i + 1}. {l}</div>)}
        </div>
      )}

      {(map.transcricao || pronto || map.status === 'transcrito') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Transcrição da entrevista</div>
          <textarea value={transcricao} onChange={(ev) => setTranscricao(ev.target.value)} rows={8} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'Montserrat', fontSize: 12, lineHeight: 1.6, padding: 12, borderRadius: 8, border: '1px solid rgba(0,32,62,0.15)', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn onClick={salvarTranscricao} disabled={salvando || transcricao === (map.transcricao || '')}>{salvando ? 'Salvando…' : 'Salvar transcrição'}</Btn>
            <Btn primario onClick={async () => { await salvarTranscricao(); invocar(map.id, 'estruturar') }} disabled={processando || !transcricao.trim()}>{pronto ? '↻ Reestruturar' : 'Estruturar'}</Btn>
          </div>
        </div>
      )}

      <BlocoConsultor map={map} onMudou={carregar} />
    </div>
  )
}

function PlanejarModal({ projeto, areas, perfil, onFechar, onCriado }) {
  const [nome, setNome] = useState(''), [areaId, setAreaId] = useState(''), [inicio, setInicio] = useState(''), [prazo, setPrazo] = useState('')
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState('')
  const criar = async () => {
    if (!nome.trim()) { setErro('Informe o nome do processo.'); return }
    setSalvando(true); setErro('')
    const { error } = await supabase.from('mapeamentos').insert({ projeto_id: projeto.id, area_id: areaId || null, nome_processo: nome.trim(), sigla_processo: siglaDeNome(nome), data_inicio: inicio || null, prazo: prazo || null, status: 'rascunho', criado_por: perfil?.id || null })
    if (error) { setErro('Falha: ' + error.message); setSalvando(false); return }
    onCriado()
  }
  return (
    <Modal titulo="Cadastrar processo a mapear" sub="Planeje o processo e as datas. Depois abra a área para gravar/agendar a entrevista." onFechar={onFechar} onConfirmar={criar} salvando={salvando} confirmar={salvando ? 'Salvando…' : 'Cadastrar'} erro={erro}>
      <Campo label="Nome do processo *"><input style={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Compras, Contas a Pagar" /></Campo>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><Campo label="Início"><input type="date" style={inp} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Prazo"><input type="date" style={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Campo></div>
      </div>
      <Campo label="Área"><select style={inp} value={areaId} onChange={(e) => setAreaId(e.target.value)}><option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Campo>
    </Modal>
  )
}

function ModalNovo({ projeto, areas, areaFixa, perfil, onFechar, onCriado, invocar }) {
  const [nome, setNome] = useState(''), [areaId, setAreaId] = useState(areaFixa || ''), [inicio, setInicio] = useState(''), [prazo, setPrazo] = useState('')
  const [arquivo, setArquivo] = useState(null), [blobGravado, setBlobGravado] = useState(null)
  const [enviando, setEnviando] = useState(false), [etapaEnvio, setEtapaEnvio] = useState(''), [erro, setErro] = useState('')
  const grav = useGravador()
  const base = arquivo || blobGravado
  const criar = async () => {
    if (!nome.trim()) { setErro('Informe o nome do processo.'); return }
    if (!base) { setErro('Grave ou anexe o áudio da entrevista.'); return }
    setEnviando(true); setErro('')
    try {
      const { data: row, error: insErr } = await supabase.from('mapeamentos').insert({ projeto_id: projeto.id, area_id: areaId || null, nome_processo: nome.trim(), sigla_processo: siglaDeNome(nome), data_inicio: inicio || null, prazo: prazo || null, status: 'rascunho', criado_por: perfil?.id || null }).select().single()
      if (insErr) throw insErr
      await enviarAudio(row.id, projeto.id, base, arquivo?.name, setEtapaEnvio)
      await invocar(row.id, 'completo')
      onCriado(row.id)
    } catch (e2) { setErro('Falha: ' + e2.message); setEnviando(false); setEtapaEnvio('') }
  }
  return (
    <Modal titulo="Novo mapeamento de processo" sub="Grave a entrevista (ou anexe o áudio) e o sistema gera POP, fluxograma e matriz de riscos." onFechar={onFechar} onConfirmar={criar} salvando={enviando} confirmar={enviando ? (etapaEnvio || 'Enviando…') : 'Enviar e processar'} erro={erro}>
      <Campo label="Nome do processo *"><input style={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Compras, Faturamento" /></Campo>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><Campo label="Início"><input type="date" style={inp} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo label="Prazo"><input type="date" style={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Campo></div>
      </div>
      {!areaFixa && <Campo label="Área"><select style={inp} value={areaId} onChange={(e) => setAreaId(e.target.value)}><option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Campo>}
      <Campo label="Áudio da entrevista *">
        <div style={{ border: '1px dashed rgba(0,32,62,0.25)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {!grav.gravando ? (
              <button onClick={async () => { setArquivo(null); setBlobGravado(null); try { await grav.iniciar() } catch { setErro('Microfone indisponível.') } }} style={{ background: AZUL, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>● Gravar agora</button>
            ) : (
              <button onClick={async () => setBlobGravado(await grav.parar())} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>■ Parar ({Math.floor(grav.segundos / 60)}:{String(grav.segundos % 60).padStart(2, '0')})</button>
            )}
            <span style={{ fontSize: 11, color: '#6B7280' }}>ou</span>
            <input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg" onChange={(e) => { setBlobGravado(null); setArquivo(e.target.files?.[0] || null) }} style={{ fontSize: 12, fontFamily: 'Montserrat' }} />
          </div>
          {blobGravado && <div style={{ fontSize: 12, color: '#15803D', marginTop: 10 }}>✓ Gravação pronta ({(blobGravado.size / 1024 / 1024).toFixed(1)} MB)</div>}
          {arquivo && <div style={{ fontSize: 12, color: '#15803D', marginTop: 10 }}>✓ {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(1)} MB)</div>}
          <div style={{ fontSize: 10, color: '#6B7280', marginTop: 8 }}>Grave por quanto tempo precisar — áudios longos são otimizados e divididos automaticamente.</div>
        </div>
      </Campo>
    </Modal>
  )
}

function Campo({ label, children }) {
  return <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 700, color: AZUL, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 5 }}>{label}</label>{children}</div>
}
function Modal({ titulo, sub, children, onFechar, onConfirmar, salvando, confirmar, erro }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,17,44,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onFechar}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 26, width: 520, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', fontFamily: 'Montserrat' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, color: AZUL, marginBottom: 4 }}>{titulo}</div>
        {sub && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 18 }}>{sub}</div>}
        {children}
        {erro && <div style={{ background: 'rgba(239,68,68,0.10)', color: '#991B1B', padding: '9px 12px', borderRadius: 8, fontSize: 12, margin: '12px 0' }}>{erro}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button onClick={onFechar} style={{ background: 'transparent', border: '1px solid rgba(0,32,62,0.2)', color: AZUL, borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat' }}>Cancelar</button>
          <button onClick={onConfirmar} disabled={salvando} style={{ ...btnPrim, borderRadius: 8, padding: '10px 22px', opacity: salvando ? 0.6 : 1, cursor: salvando ? 'wait' : 'pointer' }}>{confirmar}</button>
        </div>
      </div>
    </div>
  )
}
