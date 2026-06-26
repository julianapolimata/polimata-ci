// Cadastrar Orçado — revisão das sugestões: Histórico | Tendência | Método | Sugerido 💡 | Final | Status
import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrcDados, useItens, PageHeader, Card, KPICard, KPIGrid, SeletorAno, Badge, BotaoVerde, BotaoSec, ErroBox, fmtNum, fmtPct, TIPOS, MESES_ABREV, THL, TH, TDL, TD } from './_shared'
import { METODOS } from '../../lib/orcamento/sugestao'

const ICONE_METODO = { repeticao: '📋', media_movel: '📊', tendencia: '📈', sazonalidade: '📅', indice: '💰', ia: '🤖', manual: '✎', hibrido: '🤖' }
const PIPELINE = [
  { id: 'sugestoes', label: 'Sugestões Geradas' },
  { id: 'revisao', label: 'Revisão do Controller' },
  { id: 'em_aprovacao', label: 'Submetido ao Diretor' },
  { id: 'aprovado', label: 'Orçamento Aprovado' },
]

export default function CadastrarOrcado({ projeto }) {
  const [ano, setAno] = useState(new Date().getFullYear())
  const d = useOrcDados(projeto, ano)
  const [cenarioId, setCenarioId] = useState(null)
  const cenario = d.cenarios.find(c => c.id === cenarioId) || d.cenarios.find(c => c.status === 'aprovado') || d.cenarios[d.cenarios.length - 1]
  const { porCat, reload: reloadItens } = useItens(cenario?.id)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [editCat, setEditCat] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [expandCat, setExpandCat] = useState(null)
  const [mesEdit, setMesEdit] = useState([])
  const [msg, setMsg] = useState('')

  const linhas = useMemo(() => d.catsAtivas.map(c => {
    const it = porCat[c.id]
    const s1 = d.realPorCat[c.id]?.[ano - 1] || []
    const meses = s1.filter(v => v !== null && v !== undefined)
    const histMed = meses.length ? meses.reduce((a, b) => a + b, 0) / meses.length : null
    let tend = null
    if (meses.length >= 4) {
      const meio = Math.floor(meses.length / 2)
      const m1 = meses.slice(0, meio).reduce((a, b) => a + b, 0) / meio
      const m2 = meses.slice(meio).reduce((a, b) => a + b, 0) / (meses.length - meio)
      tend = m1 !== 0 ? ((m2 - m1) / Math.abs(m1)) * 100 : null
    }
    const totalSug = it ? it.sugerido.reduce((a, v) => a + (v || 0), 0) : null
    const totalFinal = it ? it.valores.reduce((a, v) => a + (v || 0), 0) : null
    return { c, it, histMed, tend, totalSug: totalSug || null, totalFinal: totalFinal || null, status: it?.status || 'pendente' }
  }), [d.catsAtivas, porCat, d.realPorCat, ano])

  const kpi = useMemo(() => ({
    geradas: linhas.filter(l => l.totalSug !== null).length,
    aceitas: linhas.filter(l => l.status === 'aceito' || l.status === 'sugerido').length,
    editadas: linhas.filter(l => l.status === 'editado').length,
    revisar: linhas.filter(l => l.status === 'revisar').length,
  }), [linhas])

  const visiveis = linhas.filter(l => filtroStatus === 'todos' || l.status === filtroStatus)
  const etapaAtual = cenario?.status === 'aprovado' ? 3 : cenario?.status === 'em_aprovacao' ? 2 : kpi.geradas > 0 ? 1 : 0

  async function setStatusLinha(catId, status) {
    await supabase.from('orc_orcamento_itens').update({ status_revisao: status }).eq('orcamento_id', cenario.id).eq('categoria_id', catId)
    reloadItens()
  }
  async function aceitarTodas() {
    await supabase.from('orc_orcamento_itens').update({ status_revisao: 'aceito' }).eq('orcamento_id', cenario.id).in('status_revisao', ['sugerido', 'revisar'])
    reloadItens(); setMsg('Todas as sugestões aceitas.')
  }
  async function salvarFinal(catId) {
    const anual = Number(editVal)
    if (!isFinite(anual)) { setEditCat(null); return }
    const it = porCat[catId]
    const baseSug = it?.sugerido?.some(v => v) ? it.sugerido : Array(12).fill(anual / 12)
    const somaSug = baseSug.reduce((a, v) => a + (v || 0), 0) || 1
    const rows = baseSug.map((v, m) => ({
      orcamento_id: cenario.id, categoria_id: catId, mes: m + 1,
      valor: Math.round(anual * ((v || somaSug / 12) / somaSug) * 100) / 100,
      sugerido: it?.sugerido?.[m] ?? null, metodo: 'manual',
      justificativa_ia: it?.just ?? null, confianca: it?.conf ?? null, status_revisao: 'editado',
    }))
    const { error } = await supabase.from('orc_orcamento_itens').upsert(rows, { onConflict: 'orcamento_id,categoria_id,mes' })
    if (error) d.setErro(error.message)
    setEditCat(null); reloadItens()
  }
  function abrirMeses(catId) {
    const it = porCat[catId]
    setExpandCat(catId)
    setMesEdit(Array.from({ length: 12 }, (_, m) => { const v = it?.valores?.[m]; return v === null || v === undefined ? '' : String(v) }))
  }
  async function salvarMes(catId, m, valStr) {
    const v = valStr === '' ? 0 : Number(valStr)
    if (!isFinite(v)) return
    const it = porCat[catId]
    const { error } = await supabase.from('orc_orcamento_itens').upsert([{ orcamento_id: cenario.id, categoria_id: catId, mes: m + 1, valor: Math.round(v * 100) / 100, sugerido: it?.sugerido?.[m] ?? null, metodo: 'manual', justificativa_ia: it?.just ?? null, confianca: it?.conf ?? null, status_revisao: 'editado' }], { onConflict: 'orcamento_id,categoria_id,mes' })
    if (error) d.setErro(error.message)
    reloadItens()
  }
  async function mudarStatusCenario(novo) {
    const { error } = await supabase.from('orc_orcamentos').update({ status: novo }).eq('id', cenario.id)
    if (error) { d.setErro(error.message); return }
    d.reload(); setMsg(novo === 'aprovado' ? '★ Orçamento aprovado!' : 'Submetido para aprovação.')
  }

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1280, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo={`Cadastrar Orçado — ${ano}`} subtitulo={cenario ? `Cenário: ${cenario.nome || 'v' + cenario.versao} · revise as sugestões ou edite os valores finais` : 'Crie um cenário na tela Cenários para começar'}>
        <SeletorAno ano={ano} setAno={setAno} />
        <select className="input-light" style={{ width: 150 }} value={cenario?.id || ''} onChange={e => setCenarioId(e.target.value)}>
          {d.cenarios.map(c => <option key={c.id} value={c.id}>{(c.nome || 'v' + c.versao) + (c.status === 'aprovado' ? ' ★' : '')}</option>)}
          {!d.cenarios.length && <option value="">—</option>}
        </select>
        {cenario && <BotaoSec onClick={aceitarTodas}>✓ Aceitar todas</BotaoSec>}
        {cenario?.status === 'rascunho' && <BotaoSec onClick={() => mudarStatusCenario('em_aprovacao')}>Submeter p/ aprovação</BotaoSec>}
        {cenario?.status === 'em_aprovacao' && <BotaoVerde onClick={() => mudarStatusCenario('aprovado')}>★ Aprovar orçamento</BotaoVerde>}
      </PageHeader>
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />
      {msg && <div style={{ background: 'rgba(34,185,138,0.08)', border: '1px solid rgba(34,185,138,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 0, marginBottom: 18 }}>
        {PIPELINE.map((p, i) => (
          <div key={p.id} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderBottom: '3px solid ' + (i < etapaAtual ? '#15803D' : i === etapaAtual ? 'var(--prod-orcamento)' : 'var(--lt-brd)'), background: i === etapaAtual ? 'rgba(34,185,138,0.06)' : 'transparent' }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--lt-text3)' }}>Etapa {i + 1}{i === etapaAtual ? ' — atual' : ''}</div>
            <div style={{ fontSize: 12, fontWeight: i === etapaAtual ? 700 : 500, color: i <= etapaAtual ? 'var(--lt-text)' : 'var(--lt-text3)' }}>{i < etapaAtual ? '✓ ' : ''}{p.label}</div>
          </div>
        ))}
      </div>

      <KPIGrid>
        <KPICard label="Sugestões geradas" value={kpi.geradas} tone="success" delta={`de ${linhas.length} categorias`} />
        <KPICard label="Aceitas / sem ajuste" value={kpi.aceitas} delta={kpi.geradas ? Math.round(kpi.aceitas / kpi.geradas * 100) + '% das sugestões' : '—'} />
        <KPICard label="Editadas pelo controller" value={kpi.editadas} tone={kpi.editadas ? 'warning' : null} />
        <KPICard label="Marcadas p/ revisar" value={kpi.revisar} tone={kpi.revisar ? 'danger' : null} delta="confiança IA < 60%" />
      </KPIGrid>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
        <label style={{ color: 'var(--lt-text3)' }}>Status:</label>
        <select className="input-light" style={{ width: 140 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option><option value="revisar">Para revisar</option><option value="editado">Editadas</option><option value="aceito">Aceitas</option><option value="sugerido">Sugeridas</option><option value="pendente">Sem sugestão</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--lt-text3)' }}>💡 Passe o mouse sobre o valor sugerido para ver a justificativa da IA</span>
      </div>

      <Card pad={false}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={THL}>Categoria</th><th style={TH}>Histórico méd. {ano - 1}</th><th style={TH}>Tendência</th><th style={THL}>Método</th>
            <th style={TH}>Sugerido (ano) 💡</th><th style={TH}>Orçado Final (ano)</th><th style={{ ...TH, textAlign: 'center' }}>Status</th><th style={TH} />
          </tr></thead>
          <tbody>
            {TIPOS.map(t => {
              const doTipo = visiveis.filter(l => l.c.tipo === t.id)
              if (!doTipo.length) return null
              return [
                <tr key={t.id} style={{ background: 'var(--lt-bg)' }}><td colSpan={8} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.id === 'receita' ? '' : '(-) '}{t.nome}</td></tr>,
                ...doTipo.flatMap(({ c, it, histMed, tend, totalSug, totalFinal, status }) => [
                  <tr key={c.id} style={status === 'revisar' ? { background: 'rgba(234,179,8,0.06)' } : {}}>
                    <td style={{ ...TDL, fontWeight: 600 }}>{c.nome}{status === 'revisar' ? ' ⚠' : ''}</td>
                    <td style={{ ...TD, color: 'var(--lt-text3)' }}>{fmtNum(histMed)}</td>
                    <td style={{ ...TD, color: tend === null ? 'var(--lt-text3)' : tend > 5 ? '#15803D' : tend < -5 ? '#B91C1C' : 'var(--lt-text3)' }}>{fmtPct(tend)}</td>
                    <td style={TDL}>{it?.metodo ? <span style={{ fontSize: 11.5 }}>{ICONE_METODO[it.metodo] || ''} {METODOS.find(m => m.id === it.metodo)?.nome || it.metodo}</span> : <span style={{ color: 'var(--lt-text3)' }}>—</span>}</td>
                    <td style={{ ...TD, cursor: it?.just ? 'help' : 'default' }} title={it?.just || ''}>
                      {totalSug !== null ? <><strong>{fmtNum(totalSug)}</strong> 💡{it?.conf !== null && it?.conf !== undefined ? <span style={{ fontSize: 9.5, color: 'var(--lt-text3)', display: 'block' }}>conf: {it.conf}%</span> : null}</> : '—'}
                    </td>
                    <td style={{ ...TD, background: 'rgba(34,185,138,0.06)', fontWeight: 700 }} onClick={() => { if (cenario) { setEditCat(c.id); setEditVal(totalFinal ?? totalSug ?? '') } }}>
                      {editCat === c.id
                        ? <input autoFocus type="number" className="input-light" style={{ width: 110, padding: '4px 6px', fontSize: 12, textAlign: 'right' }} value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => salvarFinal(c.id)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditCat(null) }} />
                        : <span style={{ cursor: cenario ? 'pointer' : 'default' }}>{totalFinal !== null ? fmtNum(totalFinal) + (status === 'editado' ? ' ✎' : ' ✓') : 'definir'}</span>}
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {status === 'aceito' && <Badge tone="success">Aceito</Badge>}
                      {status === 'sugerido' && <Badge tone="info">Sugerido</Badge>}
                      {status === 'editado' && <Badge tone="warning">Editado</Badge>}
                      {status === 'revisar' && <Badge tone="danger">Revisar</Badge>}
                      {status === 'pendente' && <Badge>—</Badge>}
                    </td>
                    <td style={TD}>
                      <button onClick={() => expandCat === c.id ? setExpandCat(null) : abrirMeses(c.id)} title="Editar mês a mês" disabled={!cenario} style={{ background: expandCat === c.id ? 'rgba(204,145,94,0.15)' : 'none', border: '1px solid var(--lt-brd)', borderRadius: 6, padding: '2px 7px', fontSize: 11, cursor: cenario ? 'pointer' : 'default', marginRight: 4 }}>📅</button>
                      {it && status !== 'aceito' && <button onClick={() => setStatusLinha(c.id, 'aceito')} title="Aceitar sugestão" style={{ background: 'none', border: '1px solid var(--lt-brd)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#15803D' }}>✓</button>}
                    </td>
                  </tr>,
                  expandCat === c.id && (
                    <tr key={c.id + '_m'}>
                      <td colSpan={8} style={{ padding: '10px 14px', background: 'rgba(204,145,94,0.05)' }}>
                        <div style={{ fontSize: 11, color: 'var(--lt-text3)', marginBottom: 6 }}>Orçado mês a mês — <strong>{c.nome}</strong> (edite cada mês; salva ao sair do campo)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {MESES_ABREV.map((mn, m) => (
                            <div key={m} style={{ display: 'flex', flexDirection: 'column', width: 80 }}>
                              <label style={{ fontSize: 10, color: 'var(--lt-text3)' }}>{mn}</label>
                              <input type="number" className="input-light" style={{ width: '100%', padding: '3px 5px', fontSize: 11.5, textAlign: 'right' }} value={mesEdit[m] ?? ''} onChange={e => setMesEdit(a => { const n = [...a]; n[m] = e.target.value; return n })} onBlur={e => salvarMes(c.id, m, e.target.value)} />
                            </div>
                          ))}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minWidth: 110 }}>
                            <label style={{ fontSize: 10, color: 'var(--lt-text3)' }}>Total ano</label>
                            <strong style={{ fontSize: 12.5 }}>{fmtNum(mesEdit.reduce((a, v) => a + (Number(v) || 0), 0))}</strong>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ]),
              ]
            })}
            {!visiveis.length && <tr><td colSpan={8} style={{ ...TDL, textAlign: 'center', padding: 24, color: 'var(--lt-text3)' }}>Nada aqui — gere sugestões no Gerador ou ajuste o filtro.</td></tr>}
          </tbody>
        </table>
      </Card>
      <div style={{ fontSize: 11, color: 'var(--lt-text3)' }}>Edite o total anual (redistribuído pelo perfil da sugestão) ou clique em 📅 para ajustar mês a mês. A visão mês a mês também aparece em Orçado vs Realizado. Critério: regime de competência (mesma base do realizado).</div>
    </div>
  )
}
