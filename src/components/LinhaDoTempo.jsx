import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { buscarHistorico } from '../lib/auditLog'
import { formatCampo, formatValor, nomeUsuario } from '../lib/campoLabels'

// Linha do tempo do controle — visão de NEGÓCIO (não o log miúdo).
// Só os eventos-chave: submissão, passagens de fase (aprovação/devolução),
// resultados de teste, criticidade, existência (diagnóstico) e regressões.
// Fontes: revisoes (decisões por fase) + recorte do audit_log.
// Sem armazenamento novo — funciona retroativamente.

const RESULT_CAMPOS = ['r1', 'st_pa', 'r_ader', 'r3', 'r_f4c1', 'r_f4c2', 'r_f5']

function fmtData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const COR = {
  verde:    { dot: '#16A34A', badge: 'rgba(22,163,74,0.12)',  txt: '#15803D' },
  vermelho: { dot: '#D32F2F', badge: 'rgba(211,47,47,0.10)',  txt: '#C0392B' },
  azul:     { dot: '#1D4ED8', badge: 'rgba(59,130,246,0.12)', txt: '#1D4ED8' },
  cobre:    { dot: '#CC915E', badge: 'rgba(204,145,94,0.14)', txt: '#A6512F' },
}

const S = {
  wrap: { padding: '16px 0' },
  loading: { textAlign: 'center', padding: 32, color: 'var(--txt3)', fontSize: 13 },
  empty: { textAlign: 'center', padding: 32, color: 'var(--txt3)', fontSize: 13 },
  timeline: { position: 'relative', paddingLeft: 24 },
  line: { position: 'absolute', left: 8, top: 4, bottom: 4, width: 2, background: 'var(--brd)', borderRadius: 1 },
  item: { position: 'relative', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.04)' },
  dot: { position: 'absolute', left: -20, top: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--card-bg, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, zIndex: 1 },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  titulo: { fontSize: 12.5, fontWeight: 600, color: 'var(--txt1)' },
  data: { fontSize: 11, color: 'var(--txt3)', marginLeft: 'auto' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 },
  detalhe: { fontSize: 11.5, color: 'var(--txt2)', marginTop: 2, lineHeight: 1.45 },
  autor: { fontSize: 11, color: 'var(--txt3)', fontStyle: 'italic', marginTop: 2 },
}

export default function LinhaDoTempo({ controle, projeto }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    async function go() {
      if (!controle?.id) { setLoading(false); return }
      setLoading(true)
      const [revRes, logs] = await Promise.all([
        supabase.from('revisoes').select('tipo, nota, fase, criado_em').eq('mrc_id', controle.id).order('criado_em', { ascending: true }),
        buscarHistorico(controle.id, 300),
      ])
      if (cancel) return
      const revs = revRes?.data || []
      const evs = []
      for (const r of revs) {
        if (r.tipo === 'submissao') evs.push({ t: r.criado_em, cor: 'azul', icon: '↑', titulo: 'Enviado para revisão' + (r.fase ? ` — ${r.fase}` : ''), nota: r.nota })
        else if (r.tipo === 'aprovacao') evs.push({ t: r.criado_em, cor: 'verde', icon: '✓', titulo: 'Aprovado' + (r.fase ? ` — ${r.fase}` : ''), nota: r.nota })
        else if (r.tipo === 'reprovacao') evs.push({ t: r.criado_em, cor: 'vermelho', icon: '↺', titulo: 'Devolvido para correção' + (r.fase ? ` — ${r.fase}` : ''), nota: r.nota })
      }
      for (const l of (logs || [])) {
        if (l.acao === 'REGRESSAO') { evs.push({ t: l.criado_em, cor: 'vermelho', icon: '↺', titulo: 'Regressão', autor: nomeUsuario(l), nota: l.detalhes?.descricao }); continue }
        if (l.acao !== 'UPDATE') continue
        if (RESULT_CAMPOS.includes(l.campo) && l.valor_novo) {
          evs.push({ t: l.criado_em, cor: 'cobre', icon: '●', titulo: `Resultado — ${formatCampo(l.campo)}`, autor: nomeUsuario(l), valor: formatValor(l.campo, l.valor_novo) })
        } else if (l.campo === 'crit' && l.valor_novo) {
          evs.push({ t: l.criado_em, cor: 'cobre', icon: '●', titulo: 'Criticidade avaliada', autor: nomeUsuario(l), valor: `Nota ${l.valor_novo}` })
        } else if (l.campo === 'existencia' && l.valor_novo) {
          evs.push({ t: l.criado_em, cor: 'cobre', icon: '●', titulo: 'Diagnóstico — existência do controle', autor: nomeUsuario(l), valor: l.valor_novo })
        }
      }
      evs.sort((a, b) => new Date(a.t) - new Date(b.t))
      setEventos(evs)
      setLoading(false)
    }
    go()
    return () => { cancel = true }
  }, [controle?.id])

  if (loading) return <div style={S.loading}>Carregando linha do tempo...</div>
  if (eventos.length === 0) return <div style={S.empty}>Nenhuma passagem de fase, resultado ou criticidade registrada para este controle ainda.</div>

  return (
    <div style={S.wrap}>
      <div style={S.timeline}>
        <div style={S.line} />
        {eventos.map((e, i) => {
          const c = COR[e.cor] || COR.cobre
          return (
            <div key={i} style={S.item}>
              <div style={{ ...S.dot, border: `2px solid ${c.dot}`, color: c.dot }}>{e.icon}</div>
              <div style={S.header}>
                <span style={S.titulo}>{e.titulo}</span>
                {e.valor && <span style={{ ...S.badge, background: c.badge, color: c.txt }}>{e.valor}</span>}
                <span style={S.data}>{fmtData(e.t)}</span>
              </div>
              {e.nota && <div style={S.detalhe}>{e.nota}</div>}
              {e.autor && <div style={S.autor}>{e.autor}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
