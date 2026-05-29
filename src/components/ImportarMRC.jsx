import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { gerarTemplateMRC } from '../lib/templateMRC'
import ExcelJS from 'exceljs'
import { formatNomeEmpresa } from '../lib/formatNome'

// ══════════════════════════════════════════════════════════════════════════════
// MAPEAMENTO: coluna Excel (0-indexed) → campo Supabase
// ══════════════════════════════════════════════════════════════════════════════

const HEADER_ROW = 11
const DATA_START_ROW = 13
const PREVIEW_COL_PROCESSO = 3

const COL_MAP = {
  0: 'dt_ult', 1: 'ger', 2: 'resp_sub', 4: 'sub', 5: 'rr', 6: 'dr',
  7: 'rc', 8: 'dc', 9: 'cat', 10: 'freq', 11: 'nat', 12: 'car',
  13: 'sis', 14: 'chave', 15: 'passos_f1', 16: 'r1', 17: 'incons',
  18: 'rec', 19: 'imp', 20: 'prob', 21: 'crit_label',
}

// Mapeamento para template diagnóstico (TEMPLATE_COLS_DIAG em templateMRC.js)
// Substitui colunas 17-20 de teste (passos_f1, r1, incons, rec) pela coluna
// única Existência. Imp/Prob/Crit ficam nas colunas 20-22 (deslocadas).
const COL_MAP_DIAG = {
  0: 'dt_ult', 1: 'ger', 2: 'resp_sub', 4: 'sub', 5: 'rr', 6: 'dr',
  7: 'rc', 8: 'dc', 9: 'cat', 10: 'freq', 11: 'nat', 12: 'car',
  13: 'sis', 14: 'chave', 15: 'existencia', 16: 'incons', 17: 'rec',
  18: 'imp', 19: 'prob', 20: 'crit_label',
}

function parseCrit(val) {
  if (!val) return null
  const s = String(val).trim().toLowerCase()
  if (s.startsWith('4') || s.includes('crítico') || s.includes('critico')) return 4
  if (s.startsWith('3') || s.includes('significativo')) return 3
  if (s.startsWith('2') || s.includes('moderado')) return 2
  if (s.startsWith('1') || s.includes('baixo')) return 1
  return null
}

function cleanVal(val) {
  if (val === null || val === undefined) return null
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed === '—' || trimmed === '-') return null
    return trimmed
  }
  if (val instanceof Date) return val.toISOString()
  return val
}

function normProb(val) {
  if (!val) return null
  const s = String(val).trim()
  return { extrema:'Extrema', alta:'Alta', média:'Média', media:'Média', baixa:'Baixa' }[s.toLowerCase()] || s
}

function normImp(val) {
  if (!val) return null
  const s = String(val).trim()
  return { crítico:'Crítico', critico:'Crítico', alto:'Alto', moderado:'Moderado', baixo:'Baixo' }[s.toLowerCase()] || s
}

// ══════════════════════════════════════════════════════════════════════════════
// FASES — lista completa com nomes amigáveis
// ══════════════════════════════════════════════════════════════════════════════

const TODAS_FASES = [
  { codigo: 'F1',    numero: 1, label: 'F1 — Diagnóstico Inicial' },
  { codigo: 'F2-E1', numero: 2, label: 'F2-E1 — Teste de Desenho' },
  { codigo: 'F2-E2', numero: 2, label: 'F2-E2 — Planos de Ação e Aderência' },
  { codigo: 'F3',    numero: 3, label: 'F3 — Controles Internos' },
  { codigo: 'F4-C1', numero: 4, label: 'F4-C1 — Auditoria Contínua (Ciclo 1)' },
  { codigo: 'F4-C2', numero: 4, label: 'F4-C2 — Auditoria Contínua (Ciclo 2)' },
  { codigo: 'F5',    numero: 5, label: 'F5 — Auditoria Independente' },
]

function getFasesDisponiveis(numFases) {
  const n = numFases || 5
  return TODAS_FASES.filter(f => f.numero <= n)
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════════════════════

export default function ImportarMRC({ projetoId, projeto, areas, onImported, allowNonAdmin }) {
  const { perfil } = useAuth()
  const [file, setFile] = useState(null)
  const [areaSelecionada, setAreaSelecionada] = useState('')
  const [faseSelecionada, setFaseSelecionada] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  // ── Consultor responsável (recebe os controles devolvidos na revisão) ──
  const [consultores, setConsultores] = useState([])
  const [modoConsultor, setModoConsultor] = useState('unico') // 'unico' | 'por_area'
  const [consultorUnico, setConsultorUnico] = useState('')
  const [consultoresPorArea, setConsultoresPorArea] = useState({}) // { areaId: consultorId }

  // Limpar Base state
  const [projetos, setProjetos] = useState([])
  const [lbProjeto, setLbProjeto] = useState('')
  const [lbConfirm, setLbConfirm] = useState('')
  const [lbLoading, setLbLoading] = useState(false)
  const [lbResult, setLbResult] = useState(null)

  // Apagar TUDO state
  const [atProjeto, setAtProjeto] = useState('')
  const [atConfirm, setAtConfirm] = useState('')
  const [atLoading, setAtLoading] = useState(false)
  const [atResult, setAtResult] = useState(null)

  const isAdmin = perfil?.papel === 'admin_polimata'
  useEffect(() => {
    supabase.from('projetos').select('id, nome, clientes(nome)').order('nome')
      .then(({ data }) => { if (data) setProjetos(data) })
  }, [])


  // Carregar consultores ativos (admin e consultor Polímata podem ser responsáveis)
  useEffect(() => {
    supabase.from('perfis')
      .select('id, nome, email, papel')
      .in('papel', ['consultor_polimata', 'admin_polimata'])
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => { if (data) setConsultores(data) })
  }, [])

  if (!isAdmin && !allowNonAdmin) return null

  const isTodasAreas = areaSelecionada === '__todas__'
  const areaNome = isTodasAreas ? 'Todas as áreas' : (areas?.find(a => a.id === areaSelecionada)?.nome || '')
  const faseLabel = TODAS_FASES.find(f => f.codigo === faseSelecionada)?.label || ''
  const fasesDisponiveis = getFasesDisponiveis(projeto?.num_fases)


  // ── Ler Excel e preview ──
  async function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setPreview(null); setResultado(null); setErro(null); setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]
      if (!ws) throw new Error('Nenhuma aba encontrada no arquivo.')
      const rows = []
      for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
        const row = ws.getRow(r); const vals = []; let hasData = false
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let v = cell.value
          if (v && typeof v === 'object' && v.richText) v = v.richText.map(rt => rt.text).join('')
          if (v && typeof v === 'object' && v.result !== undefined) v = v.result
          vals[colNumber - 1] = v
          if (v !== null && v !== undefined && String(v).trim() !== '') hasData = true
        })
        if (hasData && vals[5]) rows.push(vals)
      }
      setPreview({ rows })
    } catch (err) { setErro(`Erro ao ler arquivo: ${err.message}`) }
    setLoading(false)
  }

  // ── Importação ──
  async function handleImportar() {
    setShowConfirm(false)
    if (!preview || !areaSelecionada || !faseSelecionada || !projetoId) return
    // Garantir que o consultor responsável foi escolhido (regra: sempre obrigatório)
    if (modoConsultor === 'unico' && !consultorUnico) { setErro('Selecione o consultor responsável.'); return }
    if (modoConsultor === 'por_area' && isTodasAreas) {
      const faltantes = (areas || []).filter(a => !consultoresPorArea[a.id])
      if (faltantes.length > 0) { setErro(`Falta consultor responsável em ${faltantes.length} área(s): ${faltantes.slice(0,3).map(a=>a.nome).join(', ')}${faltantes.length>3 ? '…' : ''}`); return }
    }
    setImporting(true); setResultado(null); setErro(null)
    const isDiag = projeto?.f1_tem_teste === false
    const colMap = isDiag ? COL_MAP_DIAG : COL_MAP
    try {
      if (isTodasAreas) {
        // Importar para todas as áreas — apaga TUDO do projeto e insere sem area_id específico
        const { error: delError } = await supabase.from('mrc').delete().eq('projeto_id', projetoId)
        if (delError) throw new Error(`Erro ao limpar projeto: ${delError.message}`)
        const registros = preview.rows.map(row => {
          const reg = { projeto_id: projetoId, ativo: true, status_workflow: 'em_revisao', criado_por: perfil?.id || null, atualizado_por: perfil?.id || null, submetido_por: perfil?.id || null, submetido_em: new Date().toISOString() }
          // Tentar vincular à área pelo nome do processo (coluna 2 = área)
          const areaNomeExcel = cleanVal(row[3])
          if (areaNomeExcel) {
            const areaMatch = (areas || []).find(a => a.nome.toLowerCase() === areaNomeExcel.toLowerCase())
            if (areaMatch) reg.area_id = areaMatch.id
          }
          // Consultor responsável
          if (modoConsultor === 'unico') {
            if (consultorUnico) reg.consultor_id = consultorUnico
          } else if (modoConsultor === 'por_area' && reg.area_id) {
            const c = consultoresPorArea[reg.area_id]
            if (c) reg.consultor_id = c
          }
          Object.entries(colMap).forEach(([colIdx, field]) => {
            const val = row[parseInt(colIdx)]; const cleaned = cleanVal(val)
            if (field === 'crit_label') { reg.crit_label = cleaned; reg.crit = parseCrit(cleaned) }
            else if (field === 'imp') reg.imp = normImp(cleaned)
            else if (field === 'prob') reg.prob = normProb(cleaned)
            else if (field === 'dt_ult' || field === 'dt_pa' || field === 'dt_teste') {
              if (cleaned instanceof Date) reg[field] = cleaned.toISOString()
              else if (typeof cleaned === 'string') { try { const d = new Date(cleaned); reg[field] = !isNaN(d) ? d.toISOString() : null } catch { reg[field] = null } }
              else reg[field] = null
            } else reg[field] = typeof cleaned === 'string' ? cleaned : cleaned !== null ? String(cleaned) : null
          })
          return reg
        })
        const batchSize = 50; let inserted = 0
        for (let i = 0; i < registros.length; i += batchSize) {
          const batch = registros.slice(i, i + batchSize)
          const { error: insError } = await supabase.from('mrc').insert(batch)
          if (insError) throw new Error(`Erro ao inserir batch ${i}: ${insError.message}`)
          inserted += batch.length
        }
        setResultado({ ok: true, msg: `${inserted} controles importados para todas as áreas (${faseLabel}) e já entraram na fila de revisão.` })
      } else {
        // Importar para área específica
        const areaObj = areas.find(a => a.id === areaSelecionada)
        if (!areaObj) { setErro('Área não encontrada.'); return }
        const { error: delError } = await supabase.from('mrc').delete().eq('projeto_id', projetoId).eq('area_id', areaObj.id)
        if (delError) throw new Error(`Erro ao limpar área: ${delError.message}`)
        const registros = preview.rows.map(row => {
          const reg = { projeto_id: projetoId, area_id: areaObj.id, ativo: true, status_workflow: 'em_revisao', criado_por: perfil?.id || null, atualizado_por: perfil?.id || null, submetido_por: perfil?.id || null, submetido_em: new Date().toISOString() }
          // Consultor responsável (sempre 'único' quando importa para uma área específica)
          if (consultorUnico) reg.consultor_id = consultorUnico
          Object.entries(colMap).forEach(([colIdx, field]) => {
            const val = row[parseInt(colIdx)]; const cleaned = cleanVal(val)
            if (field === 'crit_label') { reg.crit_label = cleaned; reg.crit = parseCrit(cleaned) }
            else if (field === 'imp') reg.imp = normImp(cleaned)
            else if (field === 'prob') reg.prob = normProb(cleaned)
            else if (field === 'dt_ult' || field === 'dt_pa' || field === 'dt_teste') {
              if (cleaned instanceof Date) reg[field] = cleaned.toISOString()
              else if (typeof cleaned === 'string') { try { const d = new Date(cleaned); reg[field] = !isNaN(d) ? d.toISOString() : null } catch { reg[field] = null } }
              else reg[field] = null
            } else reg[field] = typeof cleaned === 'string' ? cleaned : cleaned !== null ? String(cleaned) : null
          })
          return reg
        })
        const batchSize = 50; let inserted = 0
        for (let i = 0; i < registros.length; i += batchSize) {
          const batch = registros.slice(i, i + batchSize)
          const { error: insError } = await supabase.from('mrc').insert(batch)
          if (insError) throw new Error(`Erro ao inserir batch ${i}: ${insError.message}`)
          inserted += batch.length
        }
        const gerente = registros.find(r => r.ger)?.ger || null
        if (gerente) await supabase.from('areas').update({ gerente }).eq('id', areaObj.id)
        setResultado({ ok: true, msg: `${inserted} controles importados para "${areaObj.nome}" (${faseLabel}) e já entraram na fila de revisão.${gerente ? ` Gerente atualizado: ${gerente}.` : ''}` })
      }
      setFile(null); setPreview(null)
      if (onImported) onImported()
    } catch (err) { setErro(err.message); setResultado({ ok: false, msg: err.message }) }
    setImporting(false)
  }

  // ── Limpar Base ──
  const lbProjetoNome = projetos.find(p => p.id === lbProjeto)?.nome || ''
  const canLimpar = lbProjeto && lbConfirm === 'LIMPAR'

  async function handleLimparBase() {
    if (!canLimpar) return
    if (!confirm(`Tem certeza que deseja limpar TODOS os resultados do projeto "${lbProjetoNome}"? Esta ação não pode ser desfeita.`)) return
    setLbLoading(true); setLbResult(null)
    try {
      const { data, error } = await supabase.rpc('limpar_base_projeto', { p_projeto_id: lbProjeto })
      if (error) throw error
      setLbResult({ ok: true, dados: data }); setLbConfirm('')
    } catch (err) { setLbResult({ ok: false, erro: err.message }) }
    setLbLoading(false)
  }

  // ── Apagar TUDO ──
  const atProjetoNome = projetos.find(p => p.id === atProjeto)?.nome || ''
  const canApagarTudo = atProjeto && atConfirm === 'APAGAR TUDO'
  async function handleApagarTudo() {
    if (!canApagarTudo) return
    if (!confirm(`ATENÇÃO MÁXIMA: apagar TUDO do projeto "${atProjetoNome}"?\n\nVai remover todos os controles MRC (risco, controle, identificação, resultados). O projeto e as áreas continuam, mas começa do zero.\n\nIRREVERSÍVEL.`)) return
    setAtLoading(true); setAtResult(null)
    try {
      const { data, error } = await supabase.rpc('apagar_mrc_projeto', { p_projeto_id: atProjeto })
      if (error) throw error
      setAtResult({ ok: true, dados: data }); setAtConfirm('')
    } catch (err) { setAtResult({ ok: false, erro: err.message }) }
    setAtLoading(false)
  }

  const previewCount = preview?.rows?.length || 0

  // ── Estilos (variáveis CSS — tema claro) ──
  const card = { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 10, padding: '18px 22px' }
  const secTitle = { fontSize: 13, fontWeight: 700, color: 'var(--copper)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }
  const label = { fontSize: 11, fontWeight: 600, color: 'var(--lt-text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }
  const selectS = { width: '100%', maxWidth: 400, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--lt-border)', fontFamily: 'inherit', fontSize: 12, color: 'var(--lt-text)', background: 'var(--lt-bg)', cursor: 'pointer' }
  const inputS = { ...selectS, maxWidth: 200 }

  return (
    <div style={{ padding: '20px 28px', maxWidth: 900, fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── Título ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--lt-text)' }}>Manutenção MRC</div>
        <div style={{ fontSize: 12, color: 'var(--lt-text3)', marginTop: 3 }}>Gerencie a Matriz de Riscos e Controles — baixe o template, importe dados em massa ou limpe a base de testes.</div>
      </div>

      {/* ══════ 1. TEMPLATE ══════ */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)', marginBottom: 3 }}>Template MRC</div>
          <div style={{ fontSize: 11, color: 'var(--lt-text3)', lineHeight: 1.5 }}>Planilha vazia com todos os campos e validações de dados (dropdowns). Use como base para o mapeamento de processos antes de importar no sistema.</div>
        </div>
        <button
          onClick={() => gerarTemplateMRC(undefined, projeto)}
          style={{ background: 'var(--copper)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Baixar Template
        </button>
      </div>

      {/* ══════ 2. IMPORTAR POR ÁREA ══════ */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={secTitle}>Importar MRC por Área</div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.10)', border: '1.5px solid rgba(239,68,68,0.45)', marginBottom: 16 }}>
          <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, color: '#DC2626' }}>⚠</span>
          <div style={{ fontSize: 11.5, color: 'var(--lt-text2)', lineHeight: 1.55 }}>
            <strong style={{ color: '#DC2626', fontSize: 12 }}>ATENÇÃO — Importação substitui o conteúdo existente.</strong>
            <div style={{ marginTop: 4 }}>Esta ação <strong>apaga TODOS os controles atuais da área selecionada</strong> e os substitui pelos do arquivo Excel enviado. Tudo que estiver na área hoje (risco, controle, testes, resultados, recomendações) será <strong>sobreposto</strong>.</div>
            <div style={{ marginTop: 4, color: '#DC2626', fontWeight: 600 }}>Esta operação é irreversível.</div>
          </div>
        </div>

        {/* Step 1 — Área */}
        <div style={{ marginBottom: 14 }}>
          <div style={label}>1. Selecione a área</div>
          <select value={areaSelecionada} onChange={e => setAreaSelecionada(e.target.value)} style={selectS}>
            <option value="">— Selecione a área —</option>
            <option value="__todas__">Todas as áreas</option>
            {(areas || []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
          {isTodasAreas && <div style={{ fontSize: 10, color: '#D97706', marginTop: 4 }}>Todos os controles do projeto serão substituídos pelos do arquivo.</div>}
        </div>

        {/* Step 2 — Fase */}
        <div style={{ marginBottom: 14 }}>
          <div style={label}>2. Selecione a fase</div>
          <select value={faseSelecionada} onChange={e => setFaseSelecionada(e.target.value)} disabled={!areaSelecionada} style={selectS}>
            <option value="">— Selecione a fase —</option>
            {fasesDisponiveis.map(f => <option key={f.codigo} value={f.codigo}>{f.label}</option>)}
          </select>
          {!areaSelecionada && <div style={{ fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 }}>Selecione a área primeiro.</div>}
        </div>

        {/* Step 2.5 — Consultor responsável */}
        <div style={{ marginBottom: 14 }}>
          <div style={label}>3. Consultor responsável <span style={{ fontWeight: 400, color: 'var(--lt-text3)', textTransform: 'none', letterSpacing: 0 }}>— receberá os controles devolvidos na revisão</span></div>

          {/* Modo: único / por área */}
          <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--lt-text2)', cursor: 'pointer' }}>
              <input type="radio" name="modoConsultor" checked={modoConsultor === 'unico'} onChange={() => setModoConsultor('unico')} />
              Mesmo consultor para tudo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isTodasAreas ? 'var(--lt-text2)' : 'var(--lt-text3)', cursor: isTodasAreas ? 'pointer' : 'not-allowed' }}>
              <input type="radio" name="modoConsultor" checked={modoConsultor === 'por_area'} onChange={() => setModoConsultor('por_area')} disabled={!isTodasAreas} />
              Um consultor por área {!isTodasAreas && <span style={{ fontSize: 10, color: 'var(--lt-text3)' }}>(só p/ "Todas as áreas")</span>}
            </label>
          </div>

          {/* Dropdown único */}
          {modoConsultor === 'unico' && (
            <select value={consultorUnico} onChange={e => setConsultorUnico(e.target.value)} style={selectS}>
              <option value="">— Selecione o consultor —</option>
              {consultores.map(c => <option key={c.id} value={c.id}>{c.nome} {c.papel === 'admin_polimata' ? '(Admin)' : ''}</option>)}
            </select>
          )}

          {/* Dropdowns por área */}
          {modoConsultor === 'por_area' && isTodasAreas && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflow: 'auto', padding: 12, border: '1px solid var(--lt-border)', borderRadius: 6, background: 'var(--lt-bg)' }}>
              {(areas || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--lt-text3)' }}>Nenhuma área cadastrada no projeto.</div>}
              {(areas || []).map(a => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--lt-text2)', fontWeight: 500 }}>{a.nome}</div>
                  <select value={consultoresPorArea[a.id] || ''} onChange={e => setConsultoresPorArea(prev => ({ ...prev, [a.id]: e.target.value }))} style={{ ...selectS, maxWidth: '100%' }}>
                    <option value="">— Selecione —</option>
                    {consultores.map(c => <option key={c.id} value={c.id}>{c.nome} {c.papel === 'admin_polimata' ? '(Admin)' : ''}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: 'var(--lt-text3)', marginTop: 6 }}>
            Quando você devolver um controle na revisão, o consultor responsável recebe um e-mail imediato para corrigir e reenviar.
          </div>
        </div>

        {/* Step 3 — Arquivo */}
        <div style={{ marginBottom: 14 }}>
          <div style={label}>4. Selecione o arquivo Excel (.xlsx)</div>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={!areaSelecionada || !faseSelecionada} style={{ fontFamily: 'inherit', fontSize: 12, color: 'var(--lt-text2)' }} />
          {(!areaSelecionada || !faseSelecionada) && <div style={{ fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 }}>Selecione a área e a fase primeiro.</div>}
          {loading && <div style={{ fontSize: 11, color: 'var(--copper)', marginTop: 6 }}>Lendo arquivo...</div>}
          {erro && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6, background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: 4 }}>{erro}</div>}
        </div>

        {/* Step 4 — Preview */}
        {preview && (
          <div style={{ marginBottom: 14 }}>
            <div style={label}>5. Preview — {previewCount} controles encontrados</div>
            <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--lt-border)', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>{['#','Ref. Risco','Ref. Controle','Processo','Subprocesso','Resultado F1','Impacto','Criticidade'].map(h =>
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: 'var(--lt-card)', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--lt-border)' }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 20).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 ? 'rgba(0,32,62,0.02)' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--lt-text3)', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--copper)', fontWeight: 600, fontSize: 11 }}>{row[5] || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--copper)', fontWeight: 600, fontSize: 11 }}>{row[7] || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--lt-text2)', fontSize: 11 }}>{row[PREVIEW_COL_PROCESSO] || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--lt-text2)', fontSize: 11 }}>{row[4] || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--lt-text2)', fontSize: 11 }}>{row[16] || row[15] || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--lt-text2)', fontSize: 11 }}>{row[19] || row[18] || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--lt-border)', color: 'var(--lt-text2)', fontSize: 11 }}>{row[21] || row[20] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewCount > 20 && <div style={{ fontSize: 10, color: 'var(--lt-text3)', padding: '6px 10px' }}>Mostrando 20 de {previewCount} controles.</div>}
            </div>
          </div>
        )}

        {/* Step 6 — Confirmar */}
        {preview && areaSelecionada && faseSelecionada && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(204,145,94,0.06)', border: '1px solid rgba(204,145,94,0.2)', borderRadius: 8, padding: '12px 16px', gap: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--lt-text2)', lineHeight: 1.5 }}>
              Importar <strong>{previewCount} controles</strong> para <strong>"{areaNome}"</strong> na fase <strong>{faseLabel}</strong>?
              <br />{isTodasAreas ? 'Todos os controles do projeto serão removidos.' : 'Todos os controles existentes dessa área serão removidos.'}
              {!isTodasAreas && preview.rows[0]?.[1] && <><br />Gerente será atualizado para: <strong>{preview.rows[0][1]}</strong></>}
            </div>
            <button onClick={() => setShowConfirm(true)} disabled={importing} style={{ background: 'var(--copper)', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', opacity: importing ? 0.5 : 1 }}>
              {importing ? 'Importando...' : `Importar ${previewCount} controles`}
            </button>
          </div>
        )}

        {resultado && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 500, color: 'var(--lt-text2)', background: resultado.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderColor: resultado.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
            {resultado.ok ? '✓' : '✕'} {resultado.msg}
          </div>
        )}
      </div>

      {/* ══════ 3. LIMPAR BASE (admin only) ══════ */}
      {isAdmin && <div style={card}>
        <div style={secTitle}>Limpar Base de Testes</div>
        <div style={{ fontSize: 12, color: 'var(--lt-text2)', lineHeight: 1.5, marginBottom: 14 }}>
          Remove todos os resultados de testes (F1 a F5), revisões e notificações de um projeto. A identificação dos controles (risco, controle, área) é <strong>mantida</strong>.
          <br /><strong style={{ color: '#DC2626' }}>Esta ação é irreversível.</strong>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={label}>Projeto</div>
          <select style={selectS} value={lbProjeto} onChange={e => { setLbProjeto(e.target.value); setLbResult(null) }}>
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => <option key={p.id} value={p.id}>{p.clientes?.nome ? `${formatNomeEmpresa(p.clientes.nome_fantasia || p.clientes.nome)} — ` : ''}{p.nome}</option>)}
          </select>
        </div>

        {lbProjeto && (
          <div style={{ marginBottom: 14 }}>
            <div style={label}>Digite <strong>LIMPAR</strong> para confirmar</div>
            <input style={inputS} value={lbConfirm} onChange={e => setLbConfirm(e.target.value)} placeholder="LIMPAR" />
          </div>
        )}

        <button onClick={handleLimparBase} disabled={!canLimpar || lbLoading} style={{ background: canLimpar ? '#DC2626' : 'var(--lt-border)', color: canLimpar ? '#fff' : 'var(--lt-text3)', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 12, fontWeight: 700, cursor: canLimpar ? 'pointer' : 'not-allowed', opacity: lbLoading ? 0.6 : 1, fontFamily: 'inherit' }}>
          {lbLoading ? 'Limpando...' : 'Limpar Base'}
        </button>

        {lbResult && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, background: lbResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderColor: lbResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
            {lbResult.ok ? (
              <div><strong style={{ color: '#16A34A' }}>Base limpa com sucesso!</strong><div style={{ marginTop: 4, color: 'var(--lt-text2)' }}>{lbResult.dados?.controles_resetados} controles resetados, {lbResult.dados?.revisoes_removidas} revisões removidas, {lbResult.dados?.notificacoes_removidas} notificações removidas.</div></div>
            ) : (
              <div><strong style={{ color: '#DC2626' }}>Erro:</strong> {lbResult.erro}</div>
            )}
          </div>
        )}
      </div>}

      {/* ══════ 4. APAGAR TUDO (admin only) ══════ */}
      {isAdmin && <div style={{ ...card, marginTop: 16, borderColor: '#DC2626', borderWidth: 2 }}>
        <div style={{ ...secTitle, color: '#DC2626' }}>⚠ Apagar Tudo do Projeto</div>
        <div style={{ fontSize: 12, color: 'var(--lt-text2)', lineHeight: 1.5, marginBottom: 14 }}>
          Apaga <strong>TODOS os controles MRC</strong> do projeto — risco, controle, identificação, testes, resultados, recomendações, tudo. Áreas e subprocessos são mantidos. Como se o projeto começasse do zero, pronto pra nova importação.
          <br /><strong style={{ color: '#DC2626' }}>Esta ação é totalmente irreversível e não pode ser desfeita.</strong>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={label}>Projeto</div>
          <select style={selectS} value={atProjeto} onChange={e => { setAtProjeto(e.target.value); setAtResult(null) }}>
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => <option key={p.id} value={p.id}>{p.clientes?.nome ? `${formatNomeEmpresa(p.clientes.nome_fantasia || p.clientes.nome)} — ` : ''}{p.nome}</option>)}
          </select>
        </div>
        {atProjeto && (
          <div style={{ marginBottom: 14 }}>
            <div style={label}>Digite <strong>APAGAR TUDO</strong> para confirmar</div>
            <input style={inputS} value={atConfirm} onChange={e => setAtConfirm(e.target.value)} placeholder="APAGAR TUDO" />
          </div>
        )}
        <button onClick={handleApagarTudo} disabled={!canApagarTudo || atLoading} style={{ background: canApagarTudo ? '#991B1B' : 'var(--lt-border)', color: canApagarTudo ? '#fff' : 'var(--lt-text3)', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 12, fontWeight: 700, cursor: canApagarTudo ? 'pointer' : 'not-allowed', opacity: atLoading ? 0.6 : 1, fontFamily: 'inherit' }}>
          {atLoading ? 'Apagando tudo...' : 'Apagar Tudo'}
        </button>
        {atResult && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, background: atResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderColor: atResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>
            {atResult.ok ? (
              <div><strong style={{ color: '#16A34A' }}>Projeto zerado!</strong><div style={{ marginTop: 4, color: 'var(--lt-text2)' }}>{atResult.dados?.controles_apagados} controles apagados, {atResult.dados?.revisoes_removidas} revisões, {atResult.dados?.notificacoes_removidas} notificações, {atResult.dados?.audit_removido} entradas de auditoria.</div></div>
            ) : (
              <div><strong style={{ color: '#DC2626' }}>Erro:</strong> {atResult.erro}</div>
            )}
          </div>
        )}
      </div>}

      {/* ══════ POP-UP CONFIRMAÇÃO ══════ */}
      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowConfirm(false)}>
          <div style={{ background: 'var(--lt-card)', border: '2px solid #F59E0B', borderRadius: 12, padding: '28px 32px', maxWidth: 480, width: '90%', fontFamily: "'Montserrat', sans-serif", textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginBottom: 12 }}>Confirmar importação</div>
            <div style={{ fontSize: 13, color: 'var(--lt-text2)', lineHeight: 1.6, marginBottom: 24, textAlign: 'left' }}>
              {isTodasAreas
                ? <>Todos os controles do projeto serão <span style={{ color: '#DC2626', fontWeight: 700 }}>permanentemente apagados</span> e substituídos pelos <strong>{previewCount} controles</strong> do arquivo.</>
                : <>Todos os controles existentes da área <strong>"{areaNome}"</strong> serão <span style={{ color: '#DC2626', fontWeight: 700 }}>permanentemente apagados</span> e substituídos pelos <strong>{previewCount} controles</strong> do arquivo.</>
              }
              <br /><br />Fase: <strong>{faseLabel}</strong>
              <br /><br /><strong>Essa ação não pode ser desfeita.</strong>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setShowConfirm(false)} style={{ background: 'transparent', color: 'var(--lt-text2)', border: '1px solid var(--lt-border)', borderRadius: 6, padding: '10px 24px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleImportar} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Sim, apagar e importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
