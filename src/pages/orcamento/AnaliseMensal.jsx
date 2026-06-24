// Análise Mensal — a "sessão de fechamento" do mês: o que aconteceu, o que mais mexeu,
// alertas de materialidade, receita por situação e projeção do restante do ano
// (saldo: redistribuir × não acumula). Conta a história, não despeja matriz.
import { useState, useMemo, useEffect } from 'react'
import { useOrcDados, useItens, PageHeader, Card, KPICard, KPIGrid, fmtBRL, MESES_ABREV, ErroBox } from './_shared'

const ANO_ATUAL = new Date().getFullYear()
const NAVY = '#00203E', COBRE = '#CC915E', VERDE = '#22B98A', RED = '#A32D2D'
const LIM_PCT = 5, LIM_RS = 5000
const pct = (n) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1) + '%'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function AnaliseMensal({ projeto }) {
  const [ano, setAno] = useState(ANO_ATUAL)
  const d = useOrcDados(projeto, ano)
  const cenario = d.cenarios.find(c => c.status === 'aprovado') || d.cenarios[d.cenarios.length - 1]
  const { porCat } = useItens(cenario?.id)
  const [mes, setMes] = useState(null)
  const [modo, setModo] = useState('redistribuir')

  const temOrcado = useMemo(() => Object.values(porCat || {}).some(p => (p.valores || []).some(v => v != null && v !== 0)), [porCat])

  // mês padrão = último mês fechado (com saídas), evita o mês corrente em aberto
  useEffect(() => {
    const catTipo = {}; d.categorias.forEach(c => { catTipo[c.id] = c.tipo })
    let lastSaida = -1
    d.realizado.forEach(r => {
      const dt = new Date(r.competencia + 'T00:00:00'); if (dt.getFullYear() !== ano) return
      if (catTipo[r.categoria_id] !== 'receita') lastSaida = Math.max(lastSaida, dt.getMonth())
    })
    setMes(lastSaida >= 0 ? lastSaida : new Date().getMonth())
  }, [ano, d.realizado, d.categorias])

  const A = useMemo(() => {
    if (mes == null) return null
    const catTipo = {}; d.categorias.forEach(c => { catTipo[c.id] = c.tipo })
    const arrR = (id) => (d.realPorCat[id] && d.realPorCat[id][ano]) || []
    const arrO = (id) => (porCat[id] && porCat[id].valores) || []
    const somaTipo = (tipo, m, fonte) => d.catsAtivas.filter(c => c.tipo === tipo).reduce((s, c) => s + (((fonte === 'o' ? arrO(c.id) : arrR(c.id))[m]) || 0), 0)

    const recMes = somaTipo('receita', mes, 'r')
    const saiMes = somaTipo('deducao', mes, 'r') + somaTipo('custo', mes, 'r') + somaTipo('despesa', mes, 'r')
    const resMes = recMes - saiMes
    const recAnt = mes > 0 ? somaTipo('receita', mes - 1, 'r') : null
    const saiAnt = mes > 0 ? somaTipo('deducao', mes - 1, 'r') + somaTipo('custo', mes - 1, 'r') + somaTipo('despesa', mes - 1, 'r') : null
    const resAnt = recAnt == null ? null : recAnt - saiAnt
    const recOrc = somaTipo('receita', mes, 'o'), saiOrc = somaTipo('deducao', mes, 'o') + somaTipo('custo', mes, 'o') + somaTipo('despesa', mes, 'o')
    const resOrc = (recOrc || saiOrc) ? recOrc - saiOrc : null

    // movimentos vs mês anterior (todas as categorias com realizado no mês ou no anterior)
    const movers = d.catsAtivas.map(c => {
      const r = arrR(c.id), o = arrO(c.id)
      const atual = r[mes] || 0, ant = mes > 0 ? (r[mes - 1] || 0) : 0
      const orc = o[mes] || 0
      return { id: c.id, nome: c.nome, tipo: c.tipo, atual, ant, orc, deltaMoM: atual - ant, pctMoM: ant ? (atual - ant) / ant * 100 : null, deltaOrc: atual - orc, pctOrc: orc ? (atual - orc) / orc * 100 : null }
    }).filter(m => m.atual || m.ant)
    const top = movers.slice().sort((a, b) => Math.abs(b.deltaMoM) - Math.abs(a.deltaMoM)).slice(0, 6)

    // alertas de materialidade: vs orçado se houver; senão, salto vs mês anterior
    const alertas = movers.filter(m => {
      if (m.orc) { const desfav = m.tipo === 'receita' ? m.atual < m.orc : m.atual > m.orc; return desfav && Math.abs(m.deltaOrc) >= LIM_RS && Math.abs(m.pctOrc) >= LIM_PCT }
      return Math.abs(m.deltaMoM) >= LIM_RS && m.pctMoM != null && Math.abs(m.pctMoM) >= 15
    }).sort((a, b) => Math.abs(b.orc ? b.deltaOrc : b.deltaMoM) - Math.abs(a.orc ? a.deltaOrc : a.deltaMoM)).slice(0, 6)

    // receita por situação no mês
    const sit = { Faturado: 0, 'A faturar': 0, 'Sem nota': 0 }
    d.realizado.forEach(r => {
      const dt = new Date(r.competencia + 'T00:00:00'); if (dt.getFullYear() !== ano || dt.getMonth() !== mes) return
      if (catTipo[r.categoria_id] !== 'receita') return
      const s = sit[r.situacao] !== undefined ? r.situacao : 'Sem nota'; sit[s] += Number(r.valor)
    })

    // projeção do restante do ano (toggle saldo)
    const saidaCats = d.catsAtivas.filter(c => c.tipo !== 'receita')
    let saldoRedistr = 0
    saidaCats.forEach(c => { const r = arrR(c.id), o = arrO(c.id); for (let m = 0; m <= mes; m++) if (o[m]) saldoRedistr += (o[m] - (r[m] || 0)) })
    const mesesFut = 11 - mes
    const projSaida = (md) => {
      let tot = 0
      saidaCats.forEach(c => {
        const r = arrR(c.id), o = arrO(c.id)
        for (let m = 0; m <= mes; m++) tot += r[m] || 0
        for (let m = mes + 1; m < 12; m++) tot += (o[m] || 0)
      })
      if (md === 'redistribuir') tot += saldoRedistr // re-espalha o saldo dos meses orçados já fechados
      return tot
    }
    const recCats = d.catsAtivas.filter(c => c.tipo === 'receita')
    let projRec = 0
    recCats.forEach(c => { const r = arrR(c.id), o = arrO(c.id); for (let m = 0; m <= mes; m++) projRec += r[m] || 0; for (let m = mes + 1; m < 12; m++) projRec += o[m] || 0 })
    const projSaidaAno = projSaida(modo)
    const projResAno = projRec - projSaidaAno

    return { recMes, saiMes, resMes, resAnt, recOrc, resOrc, top, alertas, sit, saldoRedistr, mesesFut, projRec, projSaidaAno, projResAno, temFuturoOrc: saidaCats.some(c => arrO(c.id).slice(mes + 1).some(v => v)) }
  }, [mes, ano, d.catsAtivas, d.categorias, d.realPorCat, d.realizado, porCat, modo])

  const Seta = ({ up, cor }) => <span style={{ color: cor, fontWeight: 700 }}>{up ? '▲' : '▼'}</span>
  const sitTot = A ? (A.sit.Faturado + A.sit['A faturar'] + A.sit['Sem nota']) : 0

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Análise Mensal" subtitulo={`${projeto?.nome || ''} · fechamento do mês`} />
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14, fontSize: 12.5 }}>
        <span style={{ color: 'var(--lt-text3)' }}>Exercício</span>
        <select className="input-light" style={{ width: 'auto' }} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ color: 'var(--lt-text3)', marginLeft: 6 }}>Mês</span>
        <select className="input-light" style={{ width: 'auto' }} value={mes ?? ''} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>

      {!A ? <Card><div style={{ color: 'var(--lt-text3)', fontSize: 13 }}>Carregando…</div></Card> : (<>
        <KPIGrid>
          <KPICard label="Resultado do mês" value={fmtBRL(A.resMes)} delta={A.recMes ? pct(A.resMes / A.recMes * 100) + ' da receita' : ''} />
          <KPICard label="vs mês anterior" value={A.resAnt == null ? '—' : fmtBRL(A.resMes - A.resAnt)} delta={A.resAnt ? pct((A.resMes - A.resAnt) / Math.abs(A.resAnt) * 100) : 'sem base'} />
          <KPICard label="Receita do mês" value={fmtBRL(A.recMes)} delta={'saídas ' + fmtBRL(A.saiMes)} />
          <KPICard label="vs orçado do mês" value={A.resOrc == null ? 'sem orçado' : fmtBRL(A.resMes - A.resOrc)} delta={A.resOrc == null ? 'mês sem orçado' : 'orçado ' + fmtBRL(A.resOrc)} />
        </KPIGrid>

        <Card titulo={`O que aconteceu em ${MESES[mes]}`}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--lt-text)' }}>
            O resultado de <strong>{MESES[mes]}</strong> foi <strong style={{ color: A.resMes < 0 ? RED : VERDE }}>{fmtBRL(A.resMes)}</strong>
            {A.resAnt != null && <> ({pct(A.resAnt ? (A.resMes - A.resAnt) / Math.abs(A.resAnt) * 100 : 0)} vs {MESES_ABREV[mes - 1]})</>}, com receita de {fmtBRL(A.recMes)} e saídas de {fmtBRL(A.saiMes)}.
            {A.top[0] && <> O maior movimento do mês foi <strong>{A.top[0].nome}</strong>, que {A.top[0].deltaMoM >= 0 ? 'subiu' : 'caiu'} {fmtBRL(Math.abs(A.top[0].deltaMoM))} vs o mês anterior.</>}
            {A.alertas.length > 0 && <> Há <strong>{A.alertas.length}</strong> rubrica(s) acima do limiar de materialidade — veja os alertas abaixo.</>}
          </p>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <Card titulo="O que mais mexeu" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>vs mês anterior</span>}>
            {A.top.map(m => {
              const sobe = m.deltaMoM >= 0
              const ruim = m.tipo === 'receita' ? !sobe : sobe
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--lt-brd)', fontSize: 12.5 }}>
                  <Seta up={sobe} cor={ruim ? RED : VERDE} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
                  <span style={{ color: 'var(--lt-text3)', fontSize: 11.5 }}>{m.pctMoM == null ? '—' : pct(m.pctMoM)}</span>
                  <span style={{ width: 110, textAlign: 'right', fontWeight: 600 }}>{(sobe ? '+' : '−') + fmtBRL(Math.abs(m.deltaMoM)).replace('R$', 'R$')}</span>
                </div>
              )
            })}
            {!A.top.length && <p style={{ fontSize: 12, color: 'var(--lt-text3)', margin: 0 }}>Sem movimento no mês.</p>}
          </Card>

          <Card titulo="Alertas de materialidade" extra={<span style={{ fontSize: 11, color: 'var(--lt-text3)' }}>desvio &gt; {LIM_PCT}% e &gt; {fmtBRL(LIM_RS)}</span>}>
            {A.alertas.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--lt-brd)', fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: RED, flex: 'none' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
                <span style={{ color: 'var(--lt-text3)', fontSize: 11.5 }}>{m.orc ? 'vs orçado' : 'vs mês ant.'}</span>
                <span style={{ width: 90, textAlign: 'right', fontWeight: 600, color: RED }}>{pct(m.orc ? m.pctOrc : m.pctMoM)}</span>
              </div>
            ))}
            {!A.alertas.length && <p style={{ fontSize: 12, color: 'var(--lt-text3)', margin: 0 }}>Nada acima do limiar neste mês. 👍</p>}
          </Card>
        </div>

        <Card titulo={`Receita de ${MESES[mes]} por situação`}>
          {[['Faturado (com NF)', A.sit.Faturado, VERDE], ['A faturar (sem NF ainda)', A.sit['A faturar'], COBRE], ['Sem nota', A.sit['Sem nota'], '#A6512F']].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0', fontSize: 12.5 }}>
              <span style={{ width: 170, flex: 'none' }}>{r[0]}</span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', height: 16, width: Math.max(1.5, sitTot ? r[1] / sitTot * 100 : 0) + '%', background: r[2], borderRadius: 3 }} /></span>
              <span style={{ width: 150, textAlign: 'right', fontWeight: 500 }}>{fmtBRL(r[1])}{sitTot ? '  ·  ' + (r[1] / sitTot * 100).toFixed(0) + '%' : ''}</span>
            </div>
          ))}
          {!sitTot && <p style={{ fontSize: 12, color: 'var(--lt-text3)', margin: 0 }}>Sem receita lançada no mês.</p>}
        </Card>

        <Card titulo="Projeção do restante do ano" extra={
          <div style={{ display: 'flex', gap: 6 }}>
            {[['redistribuir', 'Redistribuir saldo'], ['perde', 'Não acumula (perde)']].map(([id, lbl]) => (
              <button key={id} onClick={() => setModo(id)} style={{ fontSize: 11.5, borderRadius: 999, padding: '5px 12px', cursor: 'pointer', border: '1px solid var(--lt-brd)', background: modo === id ? 'rgba(204,145,94,0.14)' : 'transparent', color: modo === id ? 'var(--copper, #A6512F)' : 'var(--lt-text3)' }}>{lbl}</button>
            ))}
          </div>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 8 }}>
            <KPICard label="Receita projetada (ano)" value={fmtBRL(A.projRec)} delta={`realizado + orçado`} />
            <KPICard label="Saídas projetadas (ano)" value={fmtBRL(A.projSaidaAno)} delta={modo === 'redistribuir' ? 'com saldo redistribuído' : 'orçado original'} />
            <KPICard label="Resultado projetado (ano)" value={fmtBRL(A.projResAno)} delta={A.projRec ? pct(A.projResAno / A.projRec * 100) : ''} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--lt-text3)', margin: '6px 2px 0', lineHeight: 1.5 }}>
            {modo === 'redistribuir'
              ? <><strong>Redistribuir:</strong> o saldo não consumido dos meses já orçados é re-espalhado nos meses a incorrer, mantendo o teto. </>
              : <><strong>Não acumula:</strong> cada mês mantém seu teto; o que não foi gasto se perde e os meses futuros seguem o orçado original. </>}
            {!temOrcado ? 'Cadastre/gere o orçado para a projeção ganhar base.' : (A.saldoRedistr === 0 ? 'Ainda não há saldo de meses orçados fechados para redistribuir — passa a valer quando os meses com orçado forem fechando.' : `Saldo a redistribuir: ${fmtBRL(A.saldoRedistr)} em ${A.mesesFut} mês(es).`)}
          </p>
        </Card>
      </>)}
    </div>
  )
}
