// Fluxo de Caixa — entradas/saídas por VENCIMENTO (regime de caixa), saldo acumulado,
// realizado (pago) × previsto (a vencer). Importador próprio + saldo inicial editável.
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Card, KPICard, KPIGrid, HelpTag, BotaoVerde, BotaoSec, ErroBox, fmtBRL, MESES_ABREV } from './_shared'
import { baixarTemplateFluxo, parseFluxo } from '../../lib/orcamento/templateFluxo'

const ANO_ATUAL = new Date().getFullYear()
const NAVY = '#00203E', COBRE = '#CC915E', VERDE = '#22B98A', RED = '#A32D2D'

function GraficoFluxo({ ent, sai, acum, saldoIni }) {
  const W = 720, H = 250, T = 16, B = 36, L = 6, R = 6
  const plotH = H - T - B
  const vals = [...ent, ...sai, ...acum, saldoIni]
  const max = Math.max(1, ...vals) * 1.08
  const min = Math.min(0, ...vals) * 1.08
  const y = (v) => T + plotH * (max - v) / (max - min)
  const zeroY = y(0)
  const slot = (W - L - R) / 12
  const bw = Math.min(13, slot / 2 - 3)
  const pts = acum.map((v, i) => `${L + slot * i + slot / 2},${y(v)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entradas, saídas e saldo de caixa acumulado por mês" style={{ display: 'block' }}>
      <line x1={L} y1={zeroY} x2={W - R} y2={zeroY} stroke="var(--lt-brd, #ddd)" strokeWidth="1" />
      {ent.map((_, i) => {
        const cx = L + slot * i + slot / 2
        return (
          <g key={i}>
            {ent[i] > 0 && <rect x={cx - bw - 1} y={y(ent[i])} width={bw} height={zeroY - y(ent[i])} rx="2" fill={VERDE} />}
            {sai[i] > 0 && <rect x={cx + 1} y={zeroY} width={bw} height={y(-sai[i]) - zeroY} rx="2" fill={COBRE} />}
            <text x={cx} y={H - 20} textAnchor="middle" fontSize="11" fill="var(--lt-text3, #888)">{MESES_ABREV[i]}</text>
          </g>
        )
      })}
      <polyline points={pts} fill="none" stroke={NAVY} strokeWidth="2" />
      {acum.map((v, i) => <circle key={i} cx={L + slot * i + slot / 2} cy={y(v)} r="2.6" fill={v < 0 ? RED : NAVY} />)}
    </svg>
  )
}

export default function FluxoCaixa({ projeto }) {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [titulos, setTitulos] = useState([])
  const [saldoIni, setSaldoIni] = useState(0)
  const [saldoEdit, setSaldoEdit] = useState('')
  const [modo, setModo] = useState('total')
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [modal, setModal] = useState(null)
  const [impOpen, setImpOpen] = useState(false)
  const [prev, setPrev] = useState(null)
  const [gravando, setGravando] = useState(false)
  const fileRef = useRef(null)

  async function carregar() {
    if (!projeto?.id) return
    const ini = `${ano}-01-01`, fim = `${ano}-12-31`
    const [{ data: tit }, { data: sal }] = await Promise.all([
      supabase.from('orc_fluxo').select('id, tipo, vencimento, valor, pago, data_pagamento, parceiro, documento, origem').eq('projeto_id', projeto.id).gte('vencimento', ini).lte('vencimento', fim).order('vencimento'),
      supabase.from('orc_fluxo_saldo').select('saldo_inicial').eq('projeto_id', projeto.id).eq('ano', ano).maybeSingle(),
    ])
    setTitulos(tit || []); const si = Number(sal?.saldo_inicial || 0); setSaldoIni(si); setSaldoEdit(String(si))
  }
  useEffect(() => { carregar() }, [projeto?.id, ano])

  const M = useMemo(() => {
    const ent = Array(12).fill(0), sai = Array(12).fill(0)
    titulos.forEach(t => {
      if ((modo === 'realizado' && !t.pago) || (modo === 'previsto' && t.pago)) return
      const m = new Date(t.vencimento + 'T00:00:00').getMonth()
      if (t.tipo === 'entrada') ent[m] += Number(t.valor); else sai[m] += Number(t.valor)
    })
    const saldoMes = ent.map((e, m) => e - sai[m])
    const acum = []; let a = Number(saldoIni) || 0
    for (let m = 0; m < 12; m++) { a += saldoMes[m]; acum.push(a) }
    let piorM = 0; acum.forEach((v, i) => { if (v < acum[piorM]) piorM = i })
    return { ent, sai, saldoMes, acum, totEnt: ent.reduce((x, y) => x + y, 0), totSai: sai.reduce((x, y) => x + y, 0), pior: acum.length ? acum[piorM] : 0, piorM, final: acum[11] || 0 }
  }, [titulos, saldoIni, modo])

  async function salvarSaldo() {
    const v = Number(saldoEdit)
    if (!isFinite(v)) return
    const { error } = await supabase.from('orc_fluxo_saldo').upsert({ projeto_id: projeto.id, ano, saldo_inicial: Math.round(v * 100) / 100 }, { onConflict: 'projeto_id,ano' })
    if (error) setErro(error.message); else { setSaldoIni(v); setMsg('Saldo inicial salvo.') }
  }

  async function processar(file) {
    setErro(''); setMsg(''); setPrev(null)
    try {
      const { linhas } = await parseFluxo(file)
      if (!linhas.length) { setErro('Nenhum título válido no arquivo. Confira o template.'); return }
      const ent = linhas.filter(l => l.tipo === 'entrada'), sai = linhas.filter(l => l.tipo === 'saida')
      setPrev({ linhas, nEnt: ent.length, nSai: sai.length, vEnt: ent.reduce((s, l) => s + l.valor, 0), vSai: sai.reduce((s, l) => s + l.valor, 0), arquivo: file.name })
    } catch (e) { setErro(e.message) }
  }
  async function confirmarImport() {
    if (!prev?.linhas.length) return
    setGravando(true); setErro('')
    try {
      await supabase.from('orc_fluxo').delete().eq('projeto_id', projeto.id).eq('origem', 'import')
      const rows = prev.linhas.map(l => ({ projeto_id: projeto.id, tipo: l.tipo, vencimento: l.vencimento, valor: l.valor, pago: l.pago, data_pagamento: l.data_pagamento, parceiro: l.parceiro, documento: l.documento, origem: 'import' }))
      const CH = 500
      for (let i = 0; i < rows.length; i += CH) { const { error } = await supabase.from('orc_fluxo').insert(rows.slice(i, i + CH)); if (error) throw error }
      setMsg(`✓ ${rows.length} títulos importados (${prev.nEnt} a receber, ${prev.nSai} a pagar).`)
      setPrev(null); if (fileRef.current) fileRef.current.value = ''
      carregar()
    } catch (e) { setErro(e.message) } finally { setGravando(false) }
  }

  function drill(m) {
    const tit = titulos.filter(t => {
      if ((modo === 'realizado' && !t.pago) || (modo === 'previsto' && t.pago)) return false
      return new Date(t.vencimento + 'T00:00:00').getMonth() === m
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    setModal({ m, tit })
  }

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Fluxo de Caixa" subtitulo={`${projeto?.nome || ''} · ${ano} · regime de caixa (por vencimento/pagamento)`}>
        <select className="input-light" style={{ width: 'auto' }} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <BotaoSec onClick={() => setImpOpen(o => !o)}>↑ Importar títulos</BotaoSec>
      </PageHeader>
      <ErroBox erro={erro} onClose={() => setErro('')} />
      {msg && <div style={{ background: 'rgba(34,185,138,0.08)', border: '1px solid rgba(34,185,138,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{msg}</div>}

      <HelpTag><strong>Regime de caixa:</strong> aqui o critério é quando o dinheiro entra/sai (vencimento/pagamento) — diferente do resultado, que é por competência. "Pago" = caixa realizado; em aberto = a vencer (previsto).</HelpTag>

      {impOpen && (
        <Card titulo="Importar títulos de caixa" extra={<BotaoSec onClick={() => baixarTemplateFluxo()}>↓ Baixar template</BotaoSec>}>
          <input ref={fileRef} type="file" accept=".xlsx" onChange={e => e.target.files[0] && processar(e.target.files[0])} style={{ fontSize: 12.5 }} />
          {prev && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>Prévia de <strong>{prev.arquivo}</strong>: {prev.nEnt} a receber ({fmtBRL(prev.vEnt)}) · {prev.nSai} a pagar ({fmtBRL(prev.vSai)}). <span style={{ color: 'var(--lt-text3)' }}>A importação substitui os títulos importados anteriormente.</span></div>
              <BotaoVerde onClick={confirmarImport} disabled={gravando}>{gravando ? 'Gravando…' : `Importar ${prev.linhas.length} títulos`}</BotaoVerde>
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 12.5 }}>
        <span style={{ color: 'var(--lt-text3)' }}>Saldo inicial de caixa ({ano}):</span>
        <input type="number" className="input-light" style={{ width: 150, textAlign: 'right' }} value={saldoEdit} onChange={e => setSaldoEdit(e.target.value)} onBlur={salvarSaldo} onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }} />
        <span style={{ flex: 1 }} />
        {[['total', 'Tudo'], ['realizado', 'Realizado (pago)'], ['previsto', 'Previsto (a vencer)']].map(([id, lbl]) => (
          <button key={id} onClick={() => setModo(id)} style={{ fontSize: 12, borderRadius: 999, padding: '5px 13px', cursor: 'pointer', border: '1px solid var(--lt-brd)', background: modo === id ? 'rgba(204,145,94,0.12)' : 'transparent', color: modo === id ? 'var(--copper, #A6512F)' : 'var(--lt-text3)' }}>{lbl}</button>
        ))}
      </div>

      <KPIGrid>
        <KPICard label="Entradas no ano" value={fmtBRL(M.totEnt)} delta="recebimentos" />
        <KPICard label="Saídas no ano" value={fmtBRL(M.totSai)} delta="pagamentos" />
        <KPICard label="Pior saldo acumulado" value={fmtBRL(M.pior)} delta={MESES_ABREV[M.piorM]} />
        <KPICard label="Saldo final projetado" value={fmtBRL(M.final)} delta={'inicial ' + fmtBRL(saldoIni)} />
      </KPIGrid>

      <Card titulo="Saldo de caixa ao longo do ano" extra={
        <span style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--lt-text3)', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: VERDE, marginRight: 4 }} />Entradas</span>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: COBRE, marginRight: 4 }} />Saídas</span>
          <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px solid ' + NAVY, marginRight: 4, verticalAlign: 'middle' }} />Saldo acumulado</span>
        </span>}>
        {titulos.length ? <GraficoFluxo ent={M.ent} sai={M.sai} acum={M.acum} saldoIni={Number(saldoIni) || 0} />
          : <p style={{ fontSize: 12.5, color: 'var(--lt-text3)', margin: 0 }}>Sem títulos de caixa em {ano}. Importe os títulos a pagar/receber por vencimento.</p>}
      </Card>

      {titulos.length > 0 && (
        <Card titulo="Mês a mês" pad={false}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: 'var(--lt-bg2, #f3f3f3)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Mês</th>
              <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>Entradas</th>
              <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>Saídas</th>
              <th style={{ textAlign: 'right', padding: '8px 8px', fontWeight: 600 }}>Saldo do mês</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Acumulado</th>
            </tr></thead>
            <tbody>
              {MESES_ABREV.map((mn, m) => (
                <tr key={m} onClick={() => drill(m)} style={{ borderTop: '1px solid var(--lt-brd)', cursor: 'pointer' }}>
                  <td style={{ padding: '7px 12px' }}>{mn}</td>
                  <td style={{ textAlign: 'right', padding: '7px 8px', color: VERDE }}>{M.ent[m] ? fmtBRL(M.ent[m]) : '—'}</td>
                  <td style={{ textAlign: 'right', padding: '7px 8px', color: COBRE }}>{M.sai[m] ? fmtBRL(M.sai[m]) : '—'}</td>
                  <td style={{ textAlign: 'right', padding: '7px 8px', color: M.saldoMes[m] < 0 ? RED : 'var(--lt-text)' }}>{fmtBRL(M.saldoMes[m])}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 600, color: M.acum[m] < 0 ? RED : 'var(--lt-text)' }}>{fmtBRL(M.acum[m])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ width: 'min(560px, 95%)', maxHeight: '85vh', overflowY: 'auto', background: 'var(--lt-card, #fff)', border: '1px solid var(--lt-brd)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{MESES_ABREV[modal.m]}/{ano} · {modal.tit.length} título(s)</div>
              <button onClick={() => setModal(null)} aria-label="Fechar" style={{ border: '1px solid var(--lt-brd)', background: 'transparent', borderRadius: 8, cursor: 'pointer', width: 30, height: 28 }}>✕</button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {modal.tit.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--lt-brd)' }}>
                  <span style={{ color: 'var(--lt-text3)', whiteSpace: 'nowrap' }}>{t.vencimento.slice(8, 10)}/{t.vencimento.slice(5, 7)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.parceiro || '—'}{t.documento ? ' · ' + t.documento : ''} {t.pago ? '✓ pago' : '· a vencer'}</span>
                  <span style={{ fontWeight: 600, color: t.tipo === 'entrada' ? VERDE : COBRE, whiteSpace: 'nowrap' }}>{t.tipo === 'entrada' ? '+' : '−'} {fmtBRL(Number(t.valor))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
