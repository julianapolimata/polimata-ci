// Importar Títulos (unificado) — um arquivo com Competência + Vencimento alimenta
// o RESULTADO (realizado/orçado, por competência) e o FLUXO DE CAIXA (por vencimento).
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrcDados, PageHeader, Card, HelpTag, KPICard, KPIGrid, BotaoVerde, BotaoSec, ErroBox, fmtBRL } from './_shared'
import { baixarTemplateTitulos, parseTitulos } from '../../lib/orcamento/templateTitulos'

const ANO_ATUAL = new Date().getFullYear()
const primeiroDia = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

export default function ImportarTitulos({ projeto }) {
  const [ano, setAno] = useState(ANO_ATUAL)
  const d = useOrcDados(projeto, ano)
  const fileRef = useRef(null)
  const [destino, setDestino] = useState('orcado')
  const [cenarioId, setCenarioId] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [prev, setPrev] = useState(null)
  const [gravando, setGravando] = useState(false)
  const [msg, setMsg] = useState('')


  async function processar(file) {
    setMsg(''); d.setErro(''); setPrev(null)
    try {
      const { linhas } = await parseTitulos(file)
      if (!linhas.length) { d.setErro('Nenhum título válido. Confira o template.'); return }
      const { data: mapa } = await supabase.from('orc_contas_mapa').select('conta_erp, categoria_id, em_escopo').eq('projeto_id', projeto.id)
      const byConta = new Map((mapa || []).map(m => [String(m.conta_erp), m]))
      const naoEnc = new Set(), foraEsc = new Set(), semCat = new Set()
      const gravaveis = []
      for (const l of linhas) {
        const m = byConta.get(l.codigo)
        if (!m) { naoEnc.add(l.codigo); continue }
        if (m.em_escopo === false) { foraEsc.add(l.codigo); continue }
        if (!m.categoria_id) { semCat.add(l.codigo); continue }
        gravaveis.push({ ...l, categoria_id: m.categoria_id })
      }
      const comCaixa = linhas.filter(l => l.vencimento)
      const resAno = gravaveis.filter(l => l.competencia && new Date(l.competencia + 'T00:00:00').getFullYear() === ano)
      setPrev({
        linhas, gravaveis, comCaixa,
        naoEnc: [...naoEnc], foraEsc: [...foraEsc], semCat: [...semCat],
        totResultado: gravaveis.reduce((s, l) => s + l.valor, 0),
        totResultadoAno: resAno.reduce((s, l) => s + l.valor, 0),
        totCaixa: comCaixa.reduce((s, l) => s + l.valor, 0),
        nEnt: comCaixa.filter(l => l.tipo === 'entrada').length, nSai: comCaixa.filter(l => l.tipo === 'saida').length,
        arquivo: file.name,
      })
    } catch (e) { d.setErro(e.message) }
  }

  async function chunkInsert(tabela, rows) {
    const CH = 500
    for (let i = 0; i < rows.length; i += CH) { const { error } = await supabase.from(tabela).insert(rows.slice(i, i + CH)); if (error) throw error }
  }

  async function confirmar() {
    if (!prev) return
    setGravando(true); d.setErro('')
    try {
      // ── FLUXO DE CAIXA (por vencimento) ──
      const cashRows = prev.comCaixa.map(l => ({ projeto_id: projeto.id, tipo: l.tipo, vencimento: l.vencimento, valor: l.valor, pago: l.pago, data_pagamento: l.data_pagamento, parceiro: l.parceiro, documento: l.documento, origem: 'import' }))
      await supabase.from('orc_fluxo').delete().eq('projeto_id', projeto.id).eq('origem', 'import')
      await chunkInsert('orc_fluxo', cashRows)

      // ── RESULTADO (por competência) ──
      let resumoRes = ''
      if (destino === 'realizado') {
        const seen = new Set()
        const resRows = prev.gravaveis.filter(l => l.competencia).map(l => {
          const comp = primeiroDia(l.competencia)
          const k = [l.codigo, comp, l.valor, l.documento || '', l.parceiro || ''].join('|')
          const dup = seen.has(k); seen.add(k)
          return { projeto_id: projeto.id, categoria_id: l.categoria_id, competencia: comp, valor: l.valor, origem: 'import', conta_erp: l.codigo, detalhe: l.documento, tipo_mov: l.tipo === 'entrada' ? 'Receber' : 'Pagar', parceiro: l.parceiro, documento: l.documento, em_quarentena: dup, quarentena_motivo: dup ? 'duplicado no arquivo importado' : null }
        })
        const comps = [...new Set(resRows.map(r => r.competencia))]
        if (comps.length) await supabase.from('orc_realizado').delete().eq('projeto_id', projeto.id).eq('origem', 'import').in('competencia', comps)
        await chunkInsert('orc_realizado', resRows)
        resumoRes = `${resRows.length} lançamentos no realizado`
      } else {
        let cid = cenarioId
        if (!cid) {
          if (!novoNome.trim()) { d.setErro('Escolha um cenário ou nomeie o novo.'); setGravando(false); return }
          const versao = d.cenarios.reduce((mx, c) => Math.max(mx, c.versao || 0), 0) + 1
          const { data: novo, error } = await supabase.from('orc_orcamentos').insert({ projeto_id: projeto.id, ano, versao, nome: novoNome.trim(), status: 'rascunho' }).select().single()
          if (error) throw error; cid = novo.id
        }
        const agg = {}
        prev.gravaveis.forEach(l => { if (!l.competencia) return; const dt = new Date(l.competencia + 'T00:00:00'); if (dt.getFullYear() !== ano) return; const k = l.categoria_id + '|' + (dt.getMonth() + 1); agg[k] = (agg[k] || 0) + l.valor })
        const rows = Object.entries(agg).map(([k, v]) => { const [catId, mes] = k.split('|'); return { orcamento_id: cid, categoria_id: catId, mes: Number(mes), valor: Math.round(v * 100) / 100, metodo: 'import', status_revisao: 'aceito' } })
        await supabase.from('orc_orcamento_itens').delete().eq('orcamento_id', cid)
        await chunkInsert('orc_orcamento_itens', rows)
        resumoRes = `${rows.length} células de orçado (${ano})`
      }
      setMsg(`✓ Importado: caixa ${cashRows.length} títulos (${fmtBRL(prev.totCaixa)}) · resultado ${resumoRes}.`)
      setPrev(null); if (fileRef.current) fileRef.current.value = ''
      d.reload()
    } catch (e) { d.setErro(e.message) } finally { setGravando(false) }
  }

  const ign = prev ? prev.naoEnc.length + prev.foraEsc.length + prev.semCat.length : 0

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Importar Títulos" subtitulo="Um arquivo com as duas datas → alimenta o resultado (competência) e o caixa (vencimento)">
        <select className="input-light" style={{ width: 'auto' }} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <BotaoSec onClick={() => baixarTemplateTitulos()}>↓ Baixar template</BotaoSec>
      </PageHeader>
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />
      {msg && <div style={{ background: 'rgba(34,185,138,0.08)', border: '1px solid rgba(34,185,138,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{msg}</div>}

      <HelpTag><strong>Importação unificada:</strong> a coluna <strong>Competência</strong> (abertura) entra no resultado/DRE; a coluna <strong>Vencimento</strong> (+ Pago) entra no fluxo de caixa. Assim você mantém um único arquivo de títulos para as duas visões. Importe o plano de contas antes.</HelpTag>

      <Card titulo="1 · Destino do resultado">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
          {[['orcado', 'Orçado (cenário)'], ['realizado', 'Realizado']].map(([id, lbl]) => (
            <button key={id} onClick={() => setDestino(id)} style={{ fontSize: 12.5, borderRadius: 999, padding: '6px 14px', cursor: 'pointer', border: '1px solid var(--lt-brd)', background: destino === id ? 'rgba(204,145,94,0.12)' : 'transparent', color: destino === id ? 'var(--copper, #A6512F)' : 'var(--lt-text3)' }}>{lbl}</button>
          ))}
          {destino === 'orcado' && (<>
            <span style={{ color: 'var(--lt-text3)', marginLeft: 8 }}>Cenário:</span>
            <select className="input-light" style={{ width: 200 }} value={cenarioId} onChange={e => setCenarioId(e.target.value)}>
              <option value="">— novo cenário —</option>
              {d.cenarios.map(c => <option key={c.id} value={c.id}>{(c.nome || 'v' + c.versao) + (c.status === 'aprovado' ? ' ★' : '')}</option>)}
            </select>
            {!cenarioId && <input className="input-light" style={{ width: 230 }} placeholder="Nome do novo cenário" value={novoNome} onChange={e => setNovoNome(e.target.value)} />}
          </>)}
          <span style={{ color: 'var(--lt-text3)', fontSize: 11, width: '100%' }}>O fluxo de caixa é sempre atualizado (por vencimento). {destino === 'realizado' ? 'No resultado, grava como realizado por competência.' : 'No resultado, grava no cenário de orçado por competência.'}</span>
        </div>
      </Card>

      <Card titulo="2 · Arquivo de títulos">
        <input ref={fileRef} type="file" accept=".xlsx" onChange={e => e.target.files[0] && processar(e.target.files[0])} style={{ fontSize: 12.5 }} />
      </Card>

      {prev && (<>
        <KPIGrid>
          <KPICard label="Títulos no caixa" value={String(prev.comCaixa.length)} delta={`${prev.nEnt} a receber · ${prev.nSai} a pagar`} />
          <KPICard label="Total no caixa (vencimento)" value={fmtBRL(prev.totCaixa)} delta="entra no fluxo de caixa" />
          <KPICard label={destino === 'orcado' ? `Resultado ${ano} (competência)` : 'Resultado (competência)'} value={fmtBRL(destino === 'orcado' ? prev.totResultadoAno : prev.totResultado)} delta={`${prev.gravaveis.length} títulos mapeados`} />
          <KPICard label="Contas ignoradas" value={String(ign)} delta="fora do escopo/não cadastradas" />
        </KPIGrid>
        {ign > 0 && (
          <Card titulo="Contas ignoradas no resultado">
            {prev.naoEnc.length > 0 && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Não cadastradas ({prev.naoEnc.length}):</strong> <span style={{ color: 'var(--lt-text3)' }}>{prev.naoEnc.join(', ')}</span></p>}
            {prev.foraEsc.length > 0 && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Fora de escopo ({prev.foraEsc.length}):</strong> <span style={{ color: 'var(--lt-text3)' }}>{prev.foraEsc.join(', ')}</span></p>}
            {prev.semCat.length > 0 && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Sem categoria ({prev.semCat.length}):</strong> <span style={{ color: 'var(--lt-text3)' }}>{prev.semCat.join(', ')}</span></p>}
            <p style={{ fontSize: 11, color: 'var(--lt-text3)', margin: '6px 0 0' }}>Essas contas não entram no resultado, mas ainda contam no caixa (o caixa não depende de categoria).</p>
          </Card>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <BotaoVerde onClick={confirmar} disabled={gravando}>{gravando ? 'Gravando…' : 'Importar (resultado + caixa)'}</BotaoVerde>
          <BotaoSec onClick={() => { setPrev(null); if (fileRef.current) fileRef.current.value = '' }}>Cancelar</BotaoSec>
        </div>
        <p style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 8 }}>Arquivo: {prev.arquivo}</p>
      </>)}
    </div>
  )
}
