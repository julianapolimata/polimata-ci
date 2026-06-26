// Importar Orçado — template fixo (conta × 12 meses) → agrega por categoria → grava no cenário.
// A natureza vem da conta no plano de contas; valores em branco/zero são ignorados.
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrcDados, PageHeader, Card, HelpTag, KPICard, KPIGrid, BotaoVerde, BotaoSec, ErroBox, fmtBRL, THL, TH, TDL, TD } from './_shared'
import { baixarTemplateOrcado, parseOrcado } from '../../lib/orcamento/templateOrcado'

const ANO_ATUAL = new Date().getFullYear()

export default function ImportarOrcado({ projeto }) {
  const [ano, setAno] = useState(ANO_ATUAL)
  const d = useOrcDados(projeto, ano)
  const fileRef = useRef(null)
  const [cenarioId, setCenarioId] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [prev, setPrev] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [msg, setMsg] = useState('')

  const catById = new Map(d.categorias.map(c => [c.id, c]))

  async function processarArquivo(file) {
    setProcessando(true); setMsg(''); d.setErro(''); setPrev(null)
    try {
      const parse = await parseOrcado(file)
      if (!parse.linhas.length) { d.setErro('Nenhum valor válido no arquivo. Confira se usou o template padrão e preencheu os meses.'); return }
      const { data: mapa } = await supabase.from('orc_contas_mapa').select('conta_erp, categoria_id, em_escopo').eq('projeto_id', projeto.id)
      const byConta = new Map((mapa || []).map(m => [String(m.conta_erp), m]))
      const naoEnc = new Set(), foraEsc = new Set(), semCat = new Set(), ok = new Set()
      for (const c of parse.contas) {
        const m = byConta.get(c)
        if (!m) naoEnc.add(c)
        else if (m.em_escopo === false) foraEsc.add(c)
        else if (!m.categoria_id) semCat.add(c)
        else ok.add(c)
      }
      const agg = {}
      parse.linhas.forEach(l => { const m = byConta.get(l.codigo); if (!m || m.em_escopo === false || !m.categoria_id) return; const k = m.categoria_id + '|' + l.mes; agg[k] = (agg[k] || 0) + l.valor })
      const rows = Object.entries(agg).map(([k, v]) => { const [catId, mes] = k.split('|'); return { categoria_id: catId, mes: Number(mes) + 1, valor: Math.round(v * 100) / 100 } })
      const porCat = {}; rows.forEach(r => { porCat[r.categoria_id] = (porCat[r.categoria_id] || 0) + r.valor })
      setPrev({ rows, porCat, naoEnc: [...naoEnc], foraEsc: [...foraEsc], semCat: [...semCat], total: rows.reduce((s, r) => s + r.valor, 0), nContas: ok.size })
      setArquivo(file.name)
    } catch (e) { d.setErro(e.message) } finally { setProcessando(false) }
  }

  async function confirmar() {
    if (!prev?.rows.length) { d.setErro('Nada pronto pra gravar.'); return }
    let cid = cenarioId
    setGravando(true); d.setErro('')
    try {
      if (!cid) {
        if (!novoNome.trim()) { d.setErro('Escolha um cenário existente ou dê um nome ao novo.'); setGravando(false); return }
        const versao = (d.cenarios.reduce((mx, c) => Math.max(mx, c.versao || 0), 0)) + 1
        const { data: novo, error } = await supabase.from('orc_orcamentos').insert({ projeto_id: projeto.id, ano, versao, nome: novoNome.trim(), status: 'rascunho' }).select().single()
        if (error) throw error
        cid = novo.id
      }
      // substitui o orçado do cenário pelos valores importados
      await supabase.from('orc_orcamento_itens').delete().eq('orcamento_id', cid)
      const rows = prev.rows.map(r => ({ orcamento_id: cid, categoria_id: r.categoria_id, mes: r.mes, valor: r.valor, metodo: 'import', status_revisao: 'aceito' }))
      const { error } = await supabase.from('orc_orcamento_itens').insert(rows)
      if (error) throw error
      setMsg(`✓ Orçado importado: ${prev.nContas} conta(s) → ${Object.keys(prev.porCat).length} categoria(s), total ${fmtBRL(prev.total)}. Aprove o cenário em "Cenários" para usá-lo como comparação.`)
      setPrev(null); setArquivo(null); if (fileRef.current) fileRef.current.value = ''
      d.reload()
    } catch (e) { d.setErro(e.message) } finally { setGravando(false) }
  }

  const tipoLabel = { receita: 'Receita', deducao: 'Deduções', custo: 'Custos', despesa: 'Despesas', outros: 'Outros' }
  const porTipo = {}
  if (prev) Object.entries(prev.porCat).forEach(([cid, v]) => { const t = catById.get(cid)?.tipo || 'outros'; porTipo[t] = (porTipo[t] || 0) + v })

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1080, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Importar Orçado" subtitulo="Suba o orçamento do ano (conta × 12 meses) para um cenário">
        <select className="input-light" style={{ width: 'auto' }} value={ano} onChange={e => setAno(parseInt(e.target.value))}>
          {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <BotaoSec onClick={() => baixarTemplateOrcado()}>↓ Baixar template</BotaoSec>
      </PageHeader>
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />
      {msg && <div style={{ background: 'rgba(34,185,138,0.08)', border: '1px solid rgba(34,185,138,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{msg}</div>}

      <HelpTag><strong>Como funciona:</strong> baixe o template, adapte o orçamento do cliente (uma linha por conta do plano, um valor por mês) e suba aqui. O sistema agrega as contas por categoria gerencial e grava no cenário escolhido. Importe o <strong>plano de contas</strong> antes. <strong>Critério:</strong> orce em <strong>regime de competência</strong> (quando a despesa/receita ocorre), a mesma base do realizado — não por vencimento/pagamento (isso é fluxo de caixa).</HelpTag>

      <Card titulo="1 · Cenário de destino">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
          <select className="input-light" style={{ width: 220 }} value={cenarioId} onChange={e => setCenarioId(e.target.value)}>
            <option value="">— novo cenário —</option>
            {d.cenarios.map(c => <option key={c.id} value={c.id}>{(c.nome || 'v' + c.versao) + (c.status === 'aprovado' ? ' ★' : '')}</option>)}
          </select>
          {!cenarioId && <input className="input-light" style={{ width: 280 }} placeholder="Nome do novo cenário (ex.: Orçado 2026 oficial)" value={novoNome} onChange={e => setNovoNome(e.target.value)} />}
          <span style={{ color: 'var(--lt-text3)', fontSize: 11 }}>A importação substitui o orçado atual do cenário escolhido.</span>
        </div>
      </Card>

      <Card titulo="2 · Arquivo do orçado">
        <input ref={fileRef} type="file" accept=".xlsx" onChange={e => e.target.files[0] && processarArquivo(e.target.files[0])} style={{ fontSize: 12.5 }} />
        {processando && <div style={{ fontSize: 12.5, color: 'var(--lt-text3)', marginTop: 8 }}>Processando…</div>}
      </Card>

      {prev && (<>
        <KPIGrid>
          <KPICard label="Contas reconhecidas" value={String(prev.nContas)} delta={`${Object.keys(prev.porCat).length} categorias`} />
          <KPICard label="Total orçado" value={fmtBRL(prev.total)} delta="soma de todos os meses" />
          <KPICard label="Não reconhecidas" value={String(prev.naoEnc.length + prev.foraEsc.length + prev.semCat.length)} delta="ignoradas (ver abaixo)" />
        </KPIGrid>

        <Card titulo="Prévia por categoria" pad={false}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={THL}>Categoria</th><th style={THL}>Tipo</th><th style={TH}>Orçado no ano</th></tr></thead>
            <tbody>
              {Object.entries(prev.porCat).sort((a, b) => b[1] - a[1]).map(([cid, v]) => (
                <tr key={cid}><td style={TDL}>{catById.get(cid)?.nome || cid}</td><td style={TDL}>{tipoLabel[catById.get(cid)?.tipo] || '—'}</td><td style={TD}>{fmtBRL(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--lt-text3)', flexWrap: 'wrap', margin: '4px 2px 12px' }}>
          {Object.entries(porTipo).map(([t, v]) => <span key={t}><strong style={{ color: 'var(--lt-text)' }}>{tipoLabel[t]}:</strong> {fmtBRL(v)}</span>)}
        </div>

        {(prev.naoEnc.length + prev.foraEsc.length + prev.semCat.length) > 0 && (
          <Card titulo="Contas ignoradas">
            {prev.naoEnc.length > 0 && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Não cadastradas no plano ({prev.naoEnc.length}):</strong> <span style={{ color: 'var(--lt-text3)' }}>{prev.naoEnc.join(', ')}</span></p>}
            {prev.foraEsc.length > 0 && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Fora de escopo ({prev.foraEsc.length}):</strong> <span style={{ color: 'var(--lt-text3)' }}>{prev.foraEsc.join(', ')}</span></p>}
            {prev.semCat.length > 0 && <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Sem categoria gerencial ({prev.semCat.length}):</strong> <span style={{ color: 'var(--lt-text3)' }}>{prev.semCat.join(', ')}</span></p>}
          </Card>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <BotaoVerde onClick={confirmar} disabled={gravando}>{gravando ? 'Gravando…' : `Importar orçado (${fmtBRL(prev.total)})`}</BotaoVerde>
          <BotaoSec onClick={() => { setPrev(null); setArquivo(null); if (fileRef.current) fileRef.current.value = '' }}>Cancelar</BotaoSec>
        </div>
      </>)}
      {arquivo && !prev && <div style={{ fontSize: 11.5, color: 'var(--lt-text3)', marginTop: 8 }}>Arquivo: {arquivo}</div>}
    </div>
  )
}
