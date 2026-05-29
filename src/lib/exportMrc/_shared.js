// Helpers e constantes compartilhadas do gerador de Excel MRC.
// Extraído de exportMRC.js em 22/mai/2026 (fatiamento Etapa 9).
import ExcelJS from 'exceljs'
import { getFaseLabel as getFaseLabelUtil, getFaseInfo, getStatusComputado, normalizeFaseValue } from '../fases'
import { getStatusConfig } from '../statusWorkflow'
import { supabase } from '../supabase'

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT MRC PARA EXCEL (.xlsx) — Polímata brand
// ══════════════════════════════════════════════════════════════════════════════

export const NAVY = '00203E'
export const GOLD = 'CC915E'
export const CREME = 'F3EEE4'
export const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
export const CREME_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREME } }
export const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } }
export const COL_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: '001A3A' } }
export const COL_HEADER_FONT = { name: 'Montserrat', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
export const BODY_FONT = { name: 'Montserrat', size: 9, color: { argb: 'FF333333' } }
export const GOLD_FONT = { name: 'Montserrat', size: 9, bold: true, color: { argb: GOLD } }
export const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
}
export const CREME_BORDER = {
  top: { style: 'thin', color: { argb: CREME } },
  bottom: { style: 'thin', color: { argb: CREME } },
  left: { style: 'thin', color: { argb: CREME } },
  right: { style: 'thin', color: { argb: CREME } },
}

// ── COLUNAS DO EXCEL ──
// B-W: Vitrine (última atualização)
// X-AD: Histórico de resultado por fase
// AE-AF: Campos computados
export const MRC_COLUMNS = [
  // ── VITRINE (B-W) — sempre a última atualização ──
  { key: 'dt_ult', header: 'Data Última Atualização', width: 18, fmt: 'date' },
  { key: 'ger', header: 'Gerência', width: 18 },
  { key: 'resp_sub', header: 'Responsável Área', width: 20 },
  { key: 'area', header: 'Área', width: 22 },
  { key: 'sub', header: 'Subprocesso', width: 20 },
  { key: 'rr', header: 'Ref. Risco', width: 12 },
  { key: 'dr', header: 'Descrição do Risco', width: 40 },
  { key: 'rc', header: 'Ref. Controle', width: 14 },
  { key: 'dc', header: 'Descrição do Controle', width: 40 },
  { key: 'cat', header: 'Categoria de Controle', width: 18 },
  { key: 'freq', header: 'Frequência', width: 14 },
  { key: 'nat', header: 'Natureza', width: 12 },
  { key: 'car', header: 'Característica', width: 14 },
  { key: 'sis', header: 'Sistema', width: 14 },
  { key: 'chave', header: 'Controle Chave?', width: 14 },
  { key: 'passos_f1', header: 'Passos de Teste', width: 40 },
  { key: '_vitrine_resultado', header: 'Resultado', width: 14, computed: true },
  { key: '_vitrine_incons', header: 'Descrição da Inconsistência', width: 40, computed: true },
  { key: '_vitrine_rec', header: 'Recomendação / Melhoria', width: 40, computed: true },
  { key: 'imp', header: 'Impacto', width: 12 },
  { key: 'prob', header: 'Probabilidade', width: 14 },
  { key: 'crit_label', header: 'Criticidade', width: 16 },
  // ── HISTÓRICO POR FASE (X-AD) ──
  { key: '_hist_f1', header: 'F1 Diagnóstico', width: 14, computed: true },
  { key: '_hist_f2d', header: 'F2 Desenho', width: 14, computed: true },
  { key: '_hist_f2e', header: 'F2 Efetividade', width: 14, computed: true },
  { key: '_hist_f3', header: 'F3 Revisão Integral', width: 14, computed: true },
  { key: '_hist_f4c1', header: 'F4 AI - Ciclo 1', width: 14, computed: true },
  { key: '_hist_f4c2', header: 'F4 AI - Ciclo 2', width: 14, computed: true },
  { key: '_hist_f5', header: 'F5 Auditoria Externa', width: 14, computed: true },
  // ── COMPUTADOS (AE-AF) ──
  { key: 'fase', header: 'Fase Atual', width: 24, computed: true },
  { key: 'status_atual', header: 'Status Atual', width: 18, computed: true },
  // Colunas de regressão são adicionadas dinamicamente em buildMRCSheet
]

export const CRIT_LABEL_MAP = { 4: '4. Crítico', 3: '3. Significativo', 2: '2. Moderado', 1: '1. Baixo' }
export const HM_IMP_LABELS = ['Crítico', 'Alto', 'Moderado', 'Baixo']
export const HM_PROB_LABELS = ['Extrema', 'Alta', 'Média', 'Baixa']
export const HM_COLORS = [
  ['EF4444', 'EF4444', 'F97316', 'EAB308'],
  ['EF4444', 'F97316', 'EAB308', 'EAB308'],
  ['F97316', 'EAB308', 'EAB308', '22C55E'],
  ['EAB308', '22C55E', '22C55E', '22C55E'],
]

export function isYellowish(c) { return c === 'EAB308' || c === 'FACC15' }
export function impToIdx(v) { return { 'Crítico': 0, 'Alto': 1, 'Moderado': 2, 'Baixo': 3 }[v] ?? -1 }
export function probToIdx(v) { return { 'Extrema': 0, 'Alta': 1, 'Média': 2, 'Baixa': 3 }[v] ?? -1 }

export function getFaseLabel(row) {
  return getFaseLabelUtil(row)
}

export function getResultadoColor(valor) {
  const v = (valor || '').toLowerCase()
  if (v === 'efetivo') return { argb: '1B5E20' }
  if (v === 'inefetivo') return { argb: 'B71C1C' }
  if (v === 'gap' || v === 'gap de processo') return { argb: 'E65100' }
  return null
}

export function getCritColor(crit) {
  const map = { 4: 'EF4444', 3: 'F97316', 2: 'EAB308', 1: '22C55E' }
  return map[crit] ? { argb: map[crit] } : null
}

export function infoLine(clienteNome, projetoNome, count) {
  const parts = []
  if (clienteNome) parts.push(`Cliente: ${clienteNome}`)
  if (projetoNome) parts.push(`Projeto: ${projetoNome}`)
  parts.push(`${count} controles`)
  parts.push(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`)
  return parts.join('  ·  ')
}

export async function fetchIconBase64() {
  try {
    const resp = await fetch('/icon.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

export function fillCreme(ws, fromRow, toRow, fromCol, toCol) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c)
      if (!cell.fill || !cell.fill.fgColor || cell.fill.fgColor.argb === '00000000') {
        cell.fill = CREME_FILL
      }
    }
  }
}
