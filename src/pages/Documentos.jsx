// ═══════════════════════════════════════════════════════════════════════════
// Documentos — Bloco 2: árvore de pastas (registro) + arquivos do Storage
// Visão exclusiva Polímata. Cliente vê apenas os anexos nas suas solicitações.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { baixarDocumento, excluirDocumento, fmtTamanho, faseFolders, SUBFASE_LABEL } from '../lib/documentos'

const FASE_NOME = { F1: 'Fase 1', F2: 'Fase 2', F3: 'Fase 3', F4: 'Fase 4', F5: 'Fase 5', Geral: 'Geral' }

function faseDisplay(doc) {
  const [f, sub] = faseFolders(doc.fase)
  const base = FASE_NOME[f] || f
  const subLbl = doc.subfase ? (SUBFASE_LABEL[doc.subfase] || doc.subfase) : (sub ? (SUBFASE_LABEL[sub] || sub) : null)
  return subLbl ? `${base} — ${subLbl}` : base
}

export default function Documentos({ projeto }) {
  const { perfil } = useAuth()
  const isPolimata = ['admin_polimata', 'consultor_polimata'].includes(perfil?.papel)
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [abertos, setAbertos] = useState(() => new Set())
  const [selecionado, setSelecionado] = useState('')

  async function load() {
    if (!projeto?.id) return
    setLoading(true); setErro('')
    const { data, error } = await supabase.from('documentos')
      .select('*, areas(nome), subprocessos(nome), mrc(rc), perfis(nome)')
      .eq('projeto_id', projeto.id).order('criado_em', { ascending: false })
    if (error) setErro(error.message)
    setDocs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [projeto?.id])

  // nó da árvore por documento: [área, subprocesso, controle, fase, categoria]
  const docPath = (d) => {
    const area = d.areas?.nome || 'Sem área'
    const sub = d.subprocessos?.nome || 'Geral'
    const ctrl = d.mrc?.rc || 'Geral'
    const fase = faseDisplay(d)
    const cat = d.categoria === 'ficha' ? 'Fichas' : 'Evidências'
    return [area, sub, ctrl, fase, cat]
  }

  const arvore = useMemo(() => {
    const raiz = new Map()
    docs.forEach(d => {
      let nivel = raiz
      docPath(d).forEach(parte => {
        if (!nivel.has(parte)) nivel.set(parte, { filhos: new Map(), qtde: 0 })
        const no = nivel.get(parte)
        no.qtde++
        nivel = no.filhos
      })
    })
    return raiz
  }, [docs])

  const arquivosVisiveis = useMemo(() => {
    if (!selecionado) return docs
    return docs.filter(d => (docPath(d).join('///') + '///').startsWith(selecionado + '///'))
  }, [docs, selecionado])

  function toggle(chave) {
    setAbertos(prev => { const n = new Set(prev); n.has(chave) ? n.delete(chave) : n.add(chave); return n })
    setSelecionado(s => s === chave ? '' : chave)
  }

  async function excluir(d) {
    if (!confirm(`Excluir o arquivo "${d.nome_arquivo}"? Essa ação fica registrada.`)) return
    try { await excluirDocumento(d); load() } catch (e) { setErro(e.message) }
  }

  function renderNivel(mapa, prefixo, profundidade) {
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt', { numeric: true })).map(([nome, no]) => {
      const chave = prefixo ? prefixo + '///' + nome : nome
      const aberto = abertos.has(chave)
      const ehSel = selecionado === chave
      const temFilhos = no.filhos.size > 0
      return (
        <div key={chave}>
          <button onClick={() => toggle(chave)} style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
            background: ehSel ? 'rgba(204,145,94,0.10)' : 'none', border: 'none', cursor: 'pointer',
            padding: `5px 8px 5px ${8 + profundidade * 14}px`, borderRadius: 6,
            fontSize: 12, color: ehSel ? 'var(--copper-text)' : 'var(--lt-text2)', fontWeight: ehSel ? 700 : 500, fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: 11 }}>{temFilhos ? (aberto ? '📂' : '📁') : '📄'}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
            <span style={{ fontSize: 10, color: 'var(--lt-text3)' }}>{no.qtde}</span>
          </button>
          {aberto && temFilhos && renderNivel(no.filhos, chave, profundidade + 1)}
        </div>
      )
    })
  }

  if (!isPolimata) return <div style={{ padding: 40, fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: 'var(--lt-text2)' }}>Esta área é exclusiva da equipe Polímata.</div>

  return (
    <div style={{ background: 'var(--lt-bg)', minHeight: '100vh', padding: '24px 28px', fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper)', marginBottom: 4 }}>Arquivos do projeto</div>
        <div style={{ fontSize: 22, fontWeight: 200, fontFamily: "'Raleway', sans-serif", color: 'var(--lt-text)' }}>Documentos</div>
        <div style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 3 }}>{docs.length} arquivo{docs.length === 1 ? '' : 's'} · {projeto?.nome}</div>
      </div>

      {erro && <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{erro}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: 10, boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 8px 8px' }}>Pastas</div>
          {loading ? <div style={{ padding: 12, fontSize: 12, color: 'var(--lt-text3)' }}>Carregando...</div>
            : arvore.size === 0 ? <div style={{ padding: 12, fontSize: 12, color: 'var(--lt-text3)', lineHeight: 1.5 }}>Nenhum arquivo ainda. As pastas aparecem automaticamente quando o cliente anexa evidências ou uma ficha é gerada.</div>
            : renderNivel(arvore, '', 0)}
          {selecionado && <button onClick={() => setSelecionado('')} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--copper-text)', fontWeight: 600, fontFamily: 'inherit', padding: '0 8px' }}>← Ver todos</button>}
        </div>

        <div style={{ background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' }}>
          {selecionado && <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--lt-text3)', borderBottom: '1px solid var(--lt-border)' }}>{selecionado.split('///').join(' › ')}</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Arquivo', 'Local', 'Tipo', 'Enviado por', 'Data', ''].map(h => <th key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--lt-border)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {arquivosVisiveis.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', fontSize: 12, color: 'var(--lt-text3)' }}>{loading ? 'Carregando...' : 'Nenhum arquivo nesta pasta.'}</td></tr>}
              {arquivosVisiveis.map(d => (
                <tr key={d.id}>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--lt-border)', fontSize: 12, color: 'var(--lt-text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {d.nome_arquivo}<div style={{ fontSize: 10, color: 'var(--lt-text3)' }}>{fmtTamanho(d.tamanho_bytes)}</div></td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--lt-border)', fontSize: 11, color: 'var(--lt-text3)' }}>{d.mrc?.rc || '—'} · {faseDisplay(d)}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--lt-border)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, color: d.categoria === 'ficha' ? '#1D4ED8' : '#15803D', background: d.categoria === 'ficha' ? 'rgba(59,130,246,0.10)' : 'rgba(34,197,94,0.12)' }}>{d.categoria === 'ficha' ? 'Ficha' : 'Evidência'}</span>
                  </td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--lt-border)', fontSize: 11.5, color: 'var(--lt-text2)' }}>{d.perfis?.nome || '—'}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--lt-border)', fontSize: 11.5, color: 'var(--lt-text2)' }}>{d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--lt-border)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button onClick={() => baixarDocumento(d).catch(e => setErro(e.message))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--copper-text)', fontFamily: 'inherit', marginRight: 10 }}>Baixar</button>
                    <button onClick={() => excluir(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#DC2626', fontFamily: 'inherit' }}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
