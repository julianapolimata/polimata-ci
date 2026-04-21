import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ExcelJS from 'exceljs'

// ══════════════════════════════════════════════════════════════════════════════
// MAPEAMENTO: coluna Excel (0-indexed) → campo Supabase
// Baseado na estrutura da MRC Brascabos (header na linha 11, dados a partir da 12)
// ══════════════════════════════════════════════════════════════════════════════

const HEADER_ROW = 11
const DATA_START_ROW = 12

// Coluna 5 (Processo) é usada APENAS no preview, não é campo da tabela mrc
const PREVIEW_COL_PROCESSO = 5

const COL_MAP = {
  1:  'dt_ult',       // Última Atualização
  3:  'ger',          // Gerência
  4:  'resp_sub',     // Responsável Subprocesso
  // col 5 (Processo/Área) → usado só no preview, não vai pro Supabase
  6:  'sub',          // Subprocesso
  7:  'rr',           // Ref. Risco
  8:  'dr',           // Descrição do Risco
  9:  'rc',           // Ref. Controle
  10: 'dc',           // Descrição do Controle
  11: 'cat',          // Categoria de Controle
  12: 'freq',         // Frequência
  13: 'nat',          // Natureza
  14: 'car',          // Característica
  15: 'sis',          // Sistema
  16: 'chave',        // Controle Chave?
  17: 'passos_f1',    // Passos de Teste
  18: 'r1',           // Resultado F1
  19: 'incons',       // Inconsistência
  20: 'rec',          // Recomendação
  21: 'imp',          // Impacto
  22: 'prob',         // Probabilidade
  23: 'crit_label',   // Criticidade (texto: "1. Baixo", etc.)
  29: 'dem_pa',       // Demanda Plano de Ação?
  30: 'resp_pa',      // Responsável PA
  31: 'dt_pa',        // Data Limite PA
  33: 'st_pa',        // Status PA
  34: 'coment_pa',    // Histórico/Comentários PA
  35: 'dt_teste',     // Data Teste Aderência
  36: 'dc_novo',      // Nova Descrição Controle
  44: 'r_ader',       // Resultado Teste Aderência
  45: 'melhoria',     // Melhoria Identificada?
  46: 'incons_ader',  // Inconsistência Aderência
  47: 'coment_ader',  // Comentários Aderência
  50: 'status_risco', // Status Risco
  56: 'r3',           // Resultado F3
  57: 'incons_f3',    // Inconsistência F3
  58: 'rec_f3',       // Recomendação F3
}

// Mapeia criticidade texto → integer
function parseCrit(val) {
  if (!val) return null
  const s = String(val).trim().toLowerCase()
  if (s.startsWith('4') || s.includes('crítico') || s.includes('critico')) return 4
  if (s.startsWith('3') || s.includes('significativo')) return 3
  if (s.startsWith('2') || s.includes('moderado')) return 2
  if (s.startsWith('1') || s.includes('baixo')) return 1
  return null
}

// Limpa valor: N/A, n/a, vazio → null
function cleanVal(val) {
  if (val === null || val === undefined) return null
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed === '—' || trimmed === '-') return null
    return trimmed
  }
  if (val instanceof Date) {
    return val.toISOString()
  }
  return val
}

// Converte probabilidade texto → padrão do sistema
function normProb(val) {
  if (!val) return null
  const s = String(val).trim()
  const map = { 'extrema': 'Extrema', 'alta': 'Alta', 'média': 'Média', 'media': 'Média', 'baixa': 'Baixa' }
  return map[s.toLowerCase()] || s
}

// Converte impacto texto → padrão do sistema
function normImp(val) {
  if (!val) return null
  const s = String(val).trim()
  const map = { 'crítico': 'Crítico', 'critico': 'Crítico', 'alto': 'Alto', 'moderado': 'Moderado', 'baixo': 'Baixo' }
  return map[s.toLowerCase()] || s
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════════════════════

export default function ImportarMRC({ projetoId, areas, onImported }) {
  const { perfil } = useAuth()
  const [file, setFile] = useState(null)
  const [areaSelecionada, setAreaSelecionada] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const isAdmin = perfil?.papel === 'admin_polimata'
  if (!isAdmin) return null

  const areaNome = areas?.find(a => a.id === areaSelecionada)?.nome || ''

  // Ler o Excel e gerar preview
  async function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(null)
    setResultado(null)
    setErro(null)
    setLoading(true)

    try {
      const buffer = await f.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)

      const ws = wb.worksheets[0]
      if (!ws) throw new Error('Nenhuma aba encontrada no arquivo.')

      // Ler headers (linha 11)
      const headerRow = ws.getRow(HEADER_ROW)
      const headers = []
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value ? String(cell.value).trim() : ''
      })

      // Ler dados (linha 12+)
      const rows = []
      for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const vals = []
        let hasData = false
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let v = cell.value
          if (v && typeof v === 'object' && v.richText) {
            v = v.richText.map(rt => rt.text).join('')
          }
          if (v && typeof v === 'object' && v.result !== undefined) {
            v = v.result
          }
          vals[colNumber - 1] = v
          if (v !== null && v !== undefined && String(v).trim() !== '') hasData = true
        })
        if (hasData && vals[7]) {
          rows.push(vals)
        }
      }

      setPreview({ headers, rows })
    } catch (err) {
      setErro(`Erro ao ler arquivo: ${err.message}`)
    }
    setLoading(false)
  }

  // Abre o pop-up de confirmação
  function handleClickImportar() {
    setShowConfirm(true)
  }

  // Executar importação (chamado após confirmação no pop-up)
  async function handleImportar() {
    setShowConfirm(false)
    if (!preview || !areaSelecionada || !projetoId) return

    const areaObj = areas.find(a => a.id === areaSelecionada)
    if (!areaObj) { setErro('Área não encontrada.'); return }

    setImporting(true)
    setResultado(null)
    setErro(null)

    try {
      // 1. Deletar controles existentes da área
      const { error: delError } = await supabase
        .from('mrc')
        .delete()
        .eq('projeto_id', projetoId)
        .eq('area_id', areaObj.id)

      if (delError) throw new Error(`Erro ao limpar área: ${delError.message}`)

      // 2. Mapear e inserir novos controles
      const registros = preview.rows.map(row => {
        const reg = {
          projeto_id: projetoId,
          area_id: areaObj.id,
          ativo: true,
          status_workflow: 'nao_iniciado',
          criado_por: perfil?.id || null,
          atualizado_por: perfil?.id || null,
        }

        Object.entries(COL_MAP).forEach(([colIdx, field]) => {
          const val = row[parseInt(colIdx)]
          const cleaned = cleanVal(val)

          if (field === 'crit_label') {
            reg.crit_label = cleaned
            reg.crit = parseCrit(cleaned)
          } else if (field === 'imp') {
            reg.imp = normImp(cleaned)
          } else if (field === 'prob') {
            reg.prob = normProb(cleaned)
          } else if (field === 'dt_ult' || field === 'dt_pa' || field === 'dt_teste') {
            if (cleaned && cleaned instanceof Date) {
              reg[field] = cleaned.toISOString()
            } else if (cleaned && typeof cleaned === 'string') {
              try {
                const d = new Date(cleaned)
                if (!isNaN(d)) reg[field] = d.toISOString()
                else reg[field] = null
              } catch { reg[field] = null }
            } else {
              reg[field] = null
            }
          } else {
            reg[field] = typeof cleaned === 'string' ? cleaned : cleaned !== null ? String(cleaned) : null
          }
        })

        return reg
      })

      // Inserir em batches de 50
      const batchSize = 50
      let inserted = 0
      for (let i = 0; i < registros.length; i += batchSize) {
        const batch = registros.slice(i, i + batchSize)
        const { error: insError } = await supabase.from('mrc').insert(batch)
        if (insError) throw new Error(`Erro ao inserir batch ${i}: ${insError.message}`)
        inserted += batch.length
      }

      // 3. Atualizar gerente na tabela areas (pega do primeiro controle)
      const gerente = registros.find(r => r.ger)?.ger || null
      if (gerente) {
        await supabase
          .from('areas')
          .update({ gerente })
          .eq('id', areaObj.id)
      }

      setResultado({ ok: true, msg: `${inserted} controles importados com sucesso para "${areaObj.nome}".${gerente ? ` Gerente atualizado: ${gerente}.` : ''}` })
      setFile(null)
      setPreview(null)
      if (onImported) onImported()
    } catch (err) {
      setErro(err.message)
      setResultado({ ok: false, msg: err.message })
    }
    setImporting(false)
  }

  const previewCount = preview?.rows?.length || 0

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.title}>Importar MRC</div>
        <div style={S.subtitle}>Upload de matriz Excel para sobrescrever os controles de uma área.</div>
        <div style={S.warningBox}>
          <div style={S.warningIcon}>⚠</div>
          <div style={S.warningText}>
            <strong>ATENÇÃO:</strong> Esta ação apaga TODOS os controles existentes da área selecionada e insere os do arquivo. Essa operação não pode ser desfeita.
          </div>
        </div>
      </div>

      {/* STEP 1: Selecionar área */}
      <div style={S.section}>
        <div style={S.sectionTitle}>1. Selecione a área</div>
        <select value={areaSelecionada} onChange={e => setAreaSelecionada(e.target.value)} style={S.select}>
          <option value="">— Selecione a área —</option>
          {(areas || []).map(a => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </div>

      {/* STEP 2: Upload do arquivo */}
      <div style={S.section}>
        <div style={S.sectionTitle}>2. Selecione o arquivo Excel (.xlsx)</div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={S.fileInput}
          disabled={!areaSelecionada}
        />
        {!areaSelecionada && <div style={S.hint}>Selecione a área primeiro.</div>}
        {loading && <div style={S.loading}>Lendo arquivo...</div>}
        {erro && <div style={S.error}>{erro}</div>}
      </div>

      {/* STEP 3: Preview */}
      {preview && (
        <div style={S.section}>
          <div style={S.sectionTitle}>3. Preview — {previewCount} controles encontrados</div>
          <div style={S.previewWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>Ref. Risco</th>
                  <th style={S.th}>Ref. Controle</th>
                  <th style={S.th}>Processo</th>
                  <th style={S.th}>Subprocesso</th>
                  <th style={S.th}>Resultado F1</th>
                  <th style={S.th}>Impacto</th>
                  <th style={S.th}>Criticidade</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td style={S.td}>{i + 1}</td>
                    <td style={{ ...S.td, color: '#CC915E', fontWeight: 600 }}>{row[7] || '—'}</td>
                    <td style={{ ...S.td, color: '#CC915E', fontWeight: 600 }}>{row[9] || '—'}</td>
                    <td style={S.td}>{row[PREVIEW_COL_PROCESSO] || '—'}</td>
                    <td style={S.td}>{row[6] || '—'}</td>
                    <td style={S.td}>{row[18] || '—'}</td>
                    <td style={S.td}>{row[21] || '—'}</td>
                    <td style={S.td}>{row[23] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewCount > 20 && <div style={S.hint}>Mostrando 20 de {previewCount} controles.</div>}
          </div>
        </div>
      )}

      {/* STEP 4: Confirmar */}
      {preview && areaSelecionada && (
        <div style={S.section}>
          <div style={S.confirmBox}>
            <div style={S.confirmText}>
              Importar <strong>{previewCount} controles</strong> para a área <strong>"{areaNome}"</strong>?
              <br />Todos os controles existentes dessa área serão removidos.
              {preview.rows[0]?.[3] && <><br />Gerente será atualizado para: <strong>{preview.rows[0][3]}</strong></>}
            </div>
            <button
              onClick={handleClickImportar}
              disabled={importing}
              style={importing ? { ...S.btnImportar, opacity: 0.5 } : S.btnImportar}
            >
              {importing ? 'Importando...' : `Importar ${previewCount} controles`}
            </button>
          </div>
        </div>
      )}

      {/* RESULTADO */}
      {resultado && (
        <div style={{ ...S.resultado, background: resultado.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', borderColor: resultado.ok ? '#22C55E' : '#EF4444' }}>
          {resultado.ok ? '✓' : '✕'} {resultado.msg}
        </div>
      )}

      {/* ════════ POP-UP DE CONFIRMAÇÃO ════════ */}
      {showConfirm && (
        <div style={S.overlay} onClick={() => setShowConfirm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalIcon}>⚠</div>
            <div style={S.modalTitle}>Confirmar importação</div>
            <div style={S.modalBody}>
              Todos os controles existentes da área <strong>"{areaNome}"</strong> serão <span style={{ color: '#EF4444', fontWeight: 700 }}>permanentemente apagados</span> e substituidos pelos <strong>{previewCount} controles</strong> do arquivo.
              <br /><br />
              <strong>Essa ação não pode ser desfeita.</strong>
            </div>
            <div style={S.modalActions}>
              <button onClick={() => setShowConfirm(false)} style={S.btnCancelar}>
                Cancelar
              </button>
              <button onClick={handleImportar} style={S.btnConfirmar}>
                Sim, apagar e importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS — TEMA ESCURO
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  wrap: { padding: '24px 32px', maxWidth: 900, fontFamily: "'Montserrat', sans-serif" },
  header: { marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 600, color: '#F3EEE4' },
  subtitle: { fontSize: 12, color: 'rgba(243,238,228,0.6)', marginTop: 4 },

  // Aviso amarelo chamativo
  warningBox: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    marginTop: 14, padding: '12px 16px', borderRadius: 8,
    background: '#FBBF24', border: '2px solid #F59E0B',
  },
  warningIcon: { fontSize: 20, lineHeight: 1, flexShrink: 0 },
  warningText: { fontSize: 12, color: '#1a1a1a', lineHeight: 1.5 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#CC915E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  select: { width: '100%', maxWidth: 400, padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(243,238,228,0.2)', fontFamily: 'inherit', fontSize: 12, color: '#F3EEE4', background: '#1D3B5C', cursor: 'pointer' },
  fileInput: { fontFamily: 'inherit', fontSize: 12, color: '#F3EEE4' },
  hint: { fontSize: 10, color: 'rgba(243,238,228,0.5)', marginTop: 4 },
  loading: { fontSize: 11, color: '#CC915E', marginTop: 6 },
  error: { fontSize: 11, color: '#EF4444', marginTop: 6, background: 'rgba(239,68,68,0.12)', padding: '6px 10px', borderRadius: 4 },
  previewWrap: { maxHeight: 400, overflow: 'auto', border: '1px solid rgba(243,238,228,0.15)', borderRadius: 6 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#F3EEE4', background: '#1D3B5C', position: 'sticky', top: 0, zIndex: 2 },
  td: { padding: '6px 10px', borderBottom: '1px solid rgba(243,238,228,0.1)', color: 'rgba(243,238,228,0.85)', background: 'rgba(0,32,62,0.4)', fontSize: 11 },
  confirmBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(29,59,92,0.4)', border: '1px solid rgba(204,145,94,0.3)', borderRadius: 8, padding: '14px 18px', gap: 16 },
  confirmText: { fontSize: 12, color: '#F3EEE4', lineHeight: 1.5 },
  btnImportar: { background: '#CC915E', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
  resultado: { marginTop: 16, padding: '12px 16px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 500, color: '#F3EEE4' },

  // Pop-up de confirmação
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    background: '#00203E', border: '2px solid #F59E0B', borderRadius: 12,
    padding: '28px 32px', maxWidth: 480, width: '90%',
    fontFamily: "'Montserrat', sans-serif", textAlign: 'center',
  },
  modalIcon: { fontSize: 40, marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#FBBF24', marginBottom: 12 },
  modalBody: { fontSize: 13, color: '#F3EEE4', lineHeight: 1.6, marginBottom: 24, textAlign: 'left' },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'center' },
  btnCancelar: {
    background: 'transparent', color: '#F3EEE4',
    border: '1px solid rgba(243,238,228,0.3)', borderRadius: 6,
    padding: '10px 24px', fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  btnConfirmar: {
    background: '#EF4444', color: '#fff',
    border: 'none', borderRadius: 6,
    padding: '10px 24px', fontSize: 12, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer',
  },
}
