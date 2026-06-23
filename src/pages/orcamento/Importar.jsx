// Importar Realizado — template fixo do sistema → competência por linha → gravação por conta/mês
// A natureza (receita/despesa) vem da conta no plano de contas; aqui só conta+data+valor+descrição.
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrcDados, PageHeader, Card, HelpTag, KPICard, KPIGrid, Badge, BotaoVerde, BotaoSec, ErroBox, fmtBRL, MESES_ABREV, THL, TH, TDL, TD } from './_shared'
import { baixarTemplateRealizado, parseRealizado } from '../../lib/orcamento/templateRealizado'

const compLabel = (c) => { const [y, m] = c.split('-'); return `${MESES_ABREV[parseInt(m, 10) - 1]}/${y}` }

export default function Importar({ projeto }) {
  const ano = new Date().getFullYear()
  const d = useOrcDados(projeto, ano)
  const fileRef = useRef(null)
  const [arquivo, setArquivo] = useState(null)
  const [prev, setPrev] = useState(null)        // { parse, classe } — pré-visualização
  const [processando, setProcessando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [msg, setMsg] = useState('')
  // lançamento manual
  const [mAno, setMAno] = useState(ano); const [mMes, setMMes] = useState(new Date().getMonth())
  const [mCat, setMCat] = useState(''); const [mValor, setMValor] = useState(''); const [mDet, setMDet] = useState('')

  async function processarArquivo(file) {
    setProcessando(true); setMsg(''); d.setErro(''); setPrev(null)
    try {
      const parse = await parseRealizado(file)
      if (!parse.linhas.length) { d.setErro('Nenhum lançamento válido no arquivo. Confira se usou o template padrão.'); return }
      // mapa de contas (plano de contas já importado)
      const { data: mapa } = await supabase.from('orc_contas_mapa').select('conta_erp, categoria_id, em_escopo').eq('projeto_id', projeto.id)
      const byConta = new Map((mapa || []).map(m => [String(m.conta_erp), m]))

      // agrega por (conta, competência)
      const aggMap = new Map()
      parse.linhas.forEach(l => {
        const k = l.codigo + '|' + l.competencia
        const a = aggMap.get(k) || { codigo: l.codigo, competencia: l.competencia, valor: 0, n: 0, detalhe: l.descricao }
        a.valor += l.valor; a.n++; aggMap.set(k, a)
      })
      const aggs = [...aggMap.values()]

      // classifica cada conta distinta
      const naoEnc = new Set(), semCat = new Set(), foraEsc = new Set(), ok = new Set()
      for (const codigo of new Set(parse.linhas.map(l => l.codigo))) {
        const m = byConta.get(codigo)
        if (!m) naoEnc.add(codigo)
        else if (m.em_escopo === false) foraEsc.add(codigo)
        else if (!m.categoria_id) semCat.add(codigo)
        else ok.add(codigo)
      }
      const gravaveis = aggs.filter(a => ok.has(a.codigo)).map(a => ({ ...a, categoria_id: byConta.get(a.codigo).categoria_id }))
      setPrev({ parse, gravaveis, naoEnc: [...naoEnc], semCat: [...semCat], foraEsc: [...foraEsc],
        somaGrava: gravaveis.reduce((s, a) => s + a.valor, 0) })
      setArquivo(file.name)
    } catch (e) { d.setErro(e.message) } finally { setProcessando(false) }
  }

  async function confirmar() {
    if (!prev?.gravaveis.length) { d.setErro('Nenhuma conta pronta pra gravar (sem categoria ou fora do escopo).'); return }
    setGravando(true); d.setErro('')
    try {
      const comps = [...new Set(prev.gravaveis.map(a => a.competencia))].sort()
      const { data: imp, error: e1 } = await supabase.from('orc_importacoes').insert({
        projeto_id: projeto.id, arquivo_nome: arquivo, competencia_ini: comps[0], competencia_fim: comps[comps.length - 1],
        linhas: prev.gravaveis.length, status: 'concluida',
      }).select().single()
      if (e1) throw e1
      // substitui realizado importado dos meses afetados
      await supabase.from('orc_realizado').delete().eq('projeto_id', projeto.id).eq('origem', 'import').in('competencia', comps)
      const rows = prev.gravaveis.map(a => ({
        projeto_id: projeto.id, categoria_id: a.categoria_id, competencia: a.competencia,
        valor: Math.round(a.valor * 100) / 100, origem: 'import', importacao_id: imp.id,
        conta_erp: a.codigo, detalhe: a.detalhe,
      }))
      const { error: e2 } = await supabase.from('orc_realizado').insert(rows)
      if (e2) throw e2
      const ign = prev.naoEnc.length + prev.semCat.length + prev.foraEsc.length
      setMsg(`✓ ${rows.length} lançamentos gravados em ${comps.length} mês(es) — total ${fmtBRL(prev.somaGrava)}.` + (ign ? ` ${ign} conta(s) ignorada(s) — veja abaixo.` : ''))
      setPrev(null); setArquivo(null); d.reload()
    } catch (e) { d.setErro(e.message) } finally { setGravando(false) }
  }

  async function lancarManual() {
    if (!mCat || mValor === '') return
    const comp = `${mAno}-${String(mMes + 1).padStart(2, '0')}-01`
    const { error } = await supabase.from('orc_realizado').insert({ projeto_id: projeto.id, categoria_id: mCat, competencia: comp, valor: Math.abs(Number(mValor)), origem: 'manual', detalhe: mDet || null })
    if (error) { d.setErro(error.message); return }
    setMValor(''); setMDet(''); setMsg(`Lançamento manual gravado em ${MESES_ABREV[mMes]}/${mAno}.`); d.reload()
  }

  const meses = prev ? Object.entries(prev.parse.resumo.meses) : []

  return (
    <div style={{ padding: '20px 28px 40px', maxWidth: 1180, margin: '0 auto' }}>
      <PageHeader projeto={projeto} titulo="Importar Realizado" subtitulo={arquivo ? `Pré-visualização — ${arquivo}` : 'Template padrão → competência por linha → gravação por conta/mês'}>
        <BotaoSec onClick={baixarTemplateRealizado}>⬇ Baixar Template</BotaoSec>
        {prev && <BotaoSec onClick={() => { setPrev(null); setArquivo(null) }}>Cancelar</BotaoSec>}
        {prev
          ? <BotaoVerde onClick={confirmar} disabled={gravando || !prev.gravaveis.length}>{gravando ? 'Gravando…' : `Confirmar (${prev.gravaveis.length})`}</BotaoVerde>
          : <BotaoVerde onClick={() => fileRef.current?.click()} disabled={processando}>{processando ? 'Processando…' : '↑ Importar Realizado'}</BotaoVerde>}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processarArquivo(f); e.target.value = '' }} />
      </PageHeader>
      <ErroBox erro={d.erro} onClose={() => d.setErro('')} />
      {msg && <div style={{ background: 'rgba(34,185,138,0.08)', border: '1px solid rgba(34,185,138,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, marginBottom: 14 }}>{msg}</div>}

      {!prev && (
        <>
          <HelpTag><strong>Como funciona:</strong> baixe o template, adapte o relatório de realizado do cliente a ele (Plano de Contas, Data, Valor, Descrição) e importe. O mês de cada lançamento vem da coluna Data — dá pra importar vários meses de uma vez. A conta liga ao plano de contas (importe-o antes); a natureza receita/despesa vem da categoria da conta.</HelpTag>
          <Card titulo="Lançamento manual (alternativa ao template)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div><label style={{ fontSize: 11.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 4 }}>Mês</label>
                <select className="input-light" style={{ width: 120 }} value={mMes} onChange={e => setMMes(parseInt(e.target.value))}>{MESES_ABREV.map((m, i) => <option key={i} value={i}>{m}/{mAno}</option>)}</select></div>
              <div><label style={{ fontSize: 11.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 4 }}>Categoria</label>
                <select className="input-light" style={{ minWidth: 200 }} value={mCat} onChange={e => setMCat(e.target.value)}>
                  <option value="">Selecione…</option>{d.catsAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select></div>
              <div><label style={{ fontSize: 11.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 4 }}>Valor (R$)</label>
                <input type="number" step="0.01" className="input-light" style={{ width: 130 }} value={mValor} onChange={e => setMValor(e.target.value)} /></div>
              <div style={{ flex: 1, minWidth: 150 }}><label style={{ fontSize: 11.5, color: 'var(--lt-text3)', display: 'block', marginBottom: 4 }}>Detalhe</label>
                <input className="input-light" value={mDet} onChange={e => setMDet(e.target.value)} placeholder="opcional" /></div>
              <BotaoVerde onClick={lancarManual} disabled={!mCat || mValor === ''}>Lançar</BotaoVerde>
            </div>
          </Card>
        </>
      )}

      {prev && (
        <>
          <KPIGrid>
            <KPICard label="Vão gravar" value={fmtBRL(prev.somaGrava)} tone="success" delta={`${prev.gravaveis.length} conta×mês`} />
            <KPICard label="Meses no arquivo" value={meses.length} delta={meses.map(([c]) => compLabel(c)).join(' · ')} />
            <KPICard label="Sem categoria" value={prev.semCat.length + ' ⚠'} tone={prev.semCat.length ? 'warning' : null} delta="categorize no Plano de Contas" />
            <KPICard label="Fora do plano" value={prev.naoEnc.length + ' ✗'} tone={prev.naoEnc.length ? 'danger' : null} delta="contas ausentes no plano" />
          </KPIGrid>

          {(prev.naoEnc.length > 0 || prev.semCat.length > 0 || prev.foraEsc.length > 0 || prev.parse.erros.length > 0) && (
            <Card titulo="Avisos">
              {prev.parse.erros.length > 0 && <div style={{ fontSize: 12.5, marginBottom: 6 }}>• {prev.parse.erros.length} linha(s) ignorada(s) por dado inválido (linha {prev.parse.erros.slice(0, 8).map(e => e.linha).join(', ')}{prev.parse.erros.length > 8 ? '…' : ''}).</div>}
              {prev.naoEnc.length > 0 && <div style={{ fontSize: 12.5, marginBottom: 6 }}>• <strong>{prev.naoEnc.length} conta(s) não existem no plano de contas</strong> — não serão gravadas. Importe-as no Plano de Contas. Ex.: {prev.naoEnc.slice(0, 6).join(', ')}{prev.naoEnc.length > 6 ? '…' : ''}</div>}
              {prev.semCat.length > 0 && <div style={{ fontSize: 12.5, marginBottom: 6 }}>• <strong>{prev.semCat.length} conta(s) em escopo sem categoria</strong> — categorize no Plano de Contas (manual ou IA) e reimporte. Ex.: {prev.semCat.slice(0, 6).join(', ')}{prev.semCat.length > 6 ? '…' : ''}</div>}
              {prev.foraEsc.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--lt-text3)' }}>• {prev.foraEsc.length} conta(s) fora do escopo — ignoradas (esperado).</div>}
            </Card>
          )}

          <Card titulo="Por mês" pad={false}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={THL}>Competência</th><th style={TH}>Lançamentos</th><th style={TH}>Total do arquivo</th></tr></thead>
              <tbody>
                {meses.map(([c, v]) => (
                  <tr key={c}><td style={TDL}>{compLabel(c)}</td><td style={TD}>{v.qtd}</td><td style={{ ...TD, fontWeight: 600 }}>{fmtBRL(v.soma)}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div style={{ marginTop: 10 }}>
            <HelpTag>Só gravam as contas em escopo COM categoria no plano. Reimportar os mesmos meses substitui o realizado importado anterior (lançamentos manuais são preservados).</HelpTag>
          </div>
        </>
      )}
    </div>
  )
}
