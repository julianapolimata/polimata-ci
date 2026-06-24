// Orçado vs Realizado — análise mensal de desvios com semáforo
import { useState, useMemo } from 'react'
import { useOrcDados, useItens, PageHeader, Card, SeletorAno, Semaforo, fmtNum, MESES_ABREV, TIPOS, ErroBox } from './_shared'

export default function Comparativo({ projeto }) {
  const [ano, setAno] = useState(new Date().getFullYear())
  const d = useOrcDados(projeto, ano)
  const [cenarioId, setCenarioId] = useState(null)
  const cenario = d.cenarios.find(c => c.id === cenarioId) || d.cenarios.find(c => c.status === 'aprovado') || d.cenarios[d.cenarios.length - 1]
  const { porCat } = useItens(cenario?.id)
  const [busca, setBusca] = useState('')
  const [mesIni, setMesIni] = useState(0)
  const [mesFim, setMesFim] = useState(() => new Date().getMonth())
  const [abertos, setAbertos] = useState({})

  const meses = useMemo(() => Array.from({ length: Math.max(0, mesFim - mesIni + 1) }, (_, i) => mesIni + i), [mesIni, mesFim])
  const q = busca.trim().toLowerCase()
  const grupos = useMemo(() => TIPOS.map(t => ({
    tipo: t,
    cats: d.catsAtivas.filter(c => c.tipo === t.id && (!q || c.nome.toLowerCase().includes(q))),
  })).filter(g => g.cats.length), [d.catsAtivas, q])

  const celula = (catId, m) => {
    const o = porCat[catId]?.valores?.[m] ?? null
    const r = d.realPorCat[catId]?.[ano]?.[m] ?? null
    const pct = (o !== null && o !== 0 && r !== null) ? ((r - o) / Math.abs(o)) * 100 : null
    return { o, r, pct }
  }

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Orçado vs Realizado" subtitulo={`Análise mensal de desvios — Exercício ${ano}${cenario ? ` | Cenário: ${cenario.nome || 'v' + cenario.versao}${cenario.status === 'aprovado' ? ' ★' : ''}` : ''}`}>
        <SeletorAno ano={ano} setAno={setAno} />
      </PageHeader>
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14, fontSize: 12 }}>
        <label style={{ color: 'var(--lt-text3)' }}>Cenário:</label>
        <select className="input-light" style={{ width: 170 }} value={cenario?.id || ''} onChange={e => setCenarioId(e.target.value)}>
          {d.cenarios.map(c => <option key={c.id} value={c.id}>{(c.nome || 'v' + c.versao) + (c.status === 'aprovado' ? ' ★' : '')}</option>)}
          {!d.cenarios.length && <option value="">— sem orçamento —</option>}
        </select>
        <label style={{ color: 'var(--lt-text3)' }}>Período:</label>
        <select className="input-light" style={{ width: 90 }} value={mesIni} onChange={e => setMesIni(parseInt(e.target.value))}>{MESES_ABREV.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
        <span style={{ color: 'var(--lt-text3)' }}>a</span>
        <select className="input-light" style={{ width: 90 }} value={mesFim} onChange={e => setMesFim(parseInt(e.target.value))}>{MESES_ABREV.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
        <input className="input-light" style={{ marginLeft: 'auto', width: 200 }} placeholder="Buscar categoria…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <Card pad={false}>
        <div style={{ overflow: 'auto', maxHeight: '72vh' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 280 + meses.length * 210 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ padding: '7px 12px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lt-text3)', textAlign: 'left', borderBottom: '1px solid var(--lt-brd)', position: 'sticky', left: 0, top: 0, zIndex: 6, background: '#fff', minWidth: 200, boxShadow: 'inset 0 -1px 0 var(--lt-brd)' }}>Categoria</th>
                {meses.map(m => <th key={m} colSpan={3} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--lt-text)', borderBottom: '1px solid var(--lt-brd)', borderLeft: '2px solid var(--lt-brd)', textAlign: 'center', background: '#EAF6F1', position: 'sticky', top: 0, zIndex: 4, boxShadow: 'inset 0 -1px 0 var(--lt-brd)' }}>{MESES_ABREV[m]}</th>)}
              </tr>
              <tr>
                {meses.map(m => (
                  ['Orçado', 'Realizado', 'Δ%'].map(h => <th key={m + h} style={{ padding: '5px 10px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lt-text3)', textAlign: 'right', borderBottom: '1px solid var(--lt-brd)', borderLeft: h === 'Orçado' ? '2px solid var(--lt-brd)' : 'none', background: '#fff', position: 'sticky', top: 31, zIndex: 4, boxShadow: 'inset 0 -1px 0 var(--lt-brd)' }}>{h}</th>)
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map(g => {
                const totalCelula = (m) => g.cats.reduce((acc, c) => { const x = celula(c.id, m); return { o: acc.o + (x.o || 0), r: acc.r + (x.r || 0) } }, { o: 0, r: 0 })
                return [
                  <tr key={g.tipo.id} onClick={() => setAbertos(a => ({ ...a, [g.tipo.id]: !a[g.tipo.id] }))} style={{ background: 'var(--lt-bg)', cursor: 'pointer' }}>
                    <td style={{ padding: '7px 12px', fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, position: 'sticky', left: 0, zIndex: 2, background: 'var(--lt-bg)' }}>{abertos[g.tipo.id] ? '▾ ' : '▸ '}{g.tipo.id === 'receita' ? '' : '(-) '}{g.tipo.nome}</td>
                    {meses.map(m => {
                      const t = totalCelula(m); const pct = t.o ? ((t.r - t.o) / Math.abs(t.o)) * 100 : null
                      return ['o', 'r', 'p'].map(k => (
                        <td key={m + k} style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, textAlign: 'right', borderLeft: k === 'o' ? '2px solid var(--lt-brd)' : 'none' }}>
                          {k === 'o' ? fmtNum(t.o) : k === 'r' ? fmtNum(t.r) : <Semaforo pct={pct} tipo={g.tipo.id} />}
                        </td>
                      ))
                    })}
                  </tr>,
                  ...(abertos[g.tipo.id] ? g.cats : []).map(c => (
                    <tr key={c.id}>
                      <td style={{ padding: '6px 12px 6px 28px', fontSize: 12.5, borderBottom: '1px solid var(--lt-brd)', position: 'sticky', left: 0, zIndex: 2, background: '#fff' }}>{c.nome}</td>
                      {meses.map(m => {
                        const x = celula(c.id, m)
                        return ['o', 'r', 'p'].map(k => (
                          <td key={m + k} style={{ padding: '5px 10px', fontSize: 12, textAlign: 'right', borderBottom: '1px solid var(--lt-brd)', borderLeft: k === 'o' ? '2px solid var(--lt-brd)' : 'none', color: k === 'o' ? 'var(--lt-text3)' : 'var(--lt-text)' }}>
                            {k === 'o' ? fmtNum(x.o) : k === 'r' ? fmtNum(x.r) : <Semaforo pct={x.pct} tipo={c.tipo} />}
                          </td>
                        ))
                      })}
                    </tr>
                  )),
                ]
              })}
              {!grupos.length && <tr><td colSpan={1 + meses.length * 3} style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--lt-text3)' }}>Sem categorias — cadastre no Plano de Contas.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ fontSize: 11, color: 'var(--lt-text3)' }}>Clique num grupo (Receita, Custos…) para abrir as categorias. Semáforo: 🟢 desvio ≤5% · 🟡 5–10% · 🔴 &gt;10% (sempre na direção desfavorável à natureza da categoria).</div>
    </div>
  )
}
