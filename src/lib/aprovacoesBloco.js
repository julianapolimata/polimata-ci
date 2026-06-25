// ─── Aprovação por bloco (Risco / Controle / Teste) ─────────────────────────
// Item 10/11/13. Cada controle tem uma aprovação independente por bloco.
// Risco e Controle são únicos (fase = null); Teste reabre por fase.
// O status_workflow geral da mrc é DERIVADO destes blocos.
import { supabase } from './supabase'
import { getFaseInfo } from './fases'

export const BLOCO_LABEL = { cenario: 'Cenário Atual', risco: 'Risco', controle: 'Controle', teste: 'Teste' }

// Quais blocos se aplicam: diagnóstico (f1_tem_teste === false) = risco + controle.
// Demais = risco + controle + teste.
export function blocosAplicaveis(projeto) {
  const temTeste = !(projeto?.f1_tem_teste === false)
  return temTeste ? ['cenario', 'risco', 'controle', 'teste'] : ['cenario', 'risco', 'controle']
}

export function faseCodigoAtual(row, projeto) {
  return getFaseInfo(row, projeto?.num_fases, projeto?.f1_tem_teste === true)?.codigo || 'F1'
}

// Risco/Controle: fase null. Teste: código da fase atual.
export function faseDoBloco(bloco, row, projeto) {
  return bloco === 'teste' ? faseCodigoAtual(row, projeto) : null
}

export async function loadAprovacoes(mrcId) {
  if (!mrcId) return []
  const { data, error } = await supabase
    .from('controle_aprovacoes')
    .select('id, bloco, fase, status, revisor_id, nota, data_acao')
    .eq('mrc_id', mrcId)
  if (error) { console.error('loadAprovacoes:', error); return [] }
  return data || []
}

function achaBloco(aprovacoes, bloco, fase) {
  return (aprovacoes || []).find(e => e.bloco === bloco && (e.fase || null) === (fase || null))
}

// Garante as linhas 'a_aprovar' para os blocos aplicáveis da fase atual.
export async function ensureBlocos(row, projeto) {
  const mrcId = row?.id
  if (!mrcId) return []
  const blocos = blocosAplicaveis(projeto)
  const existentes = await loadAprovacoes(mrcId)
  const falta = []
  for (const b of blocos) {
    const f = faseDoBloco(b, row, projeto)
    if (!achaBloco(existentes, b, f)) falta.push({ mrc_id: mrcId, bloco: b, fase: f, status: 'a_aprovar' })
  }
  if (falta.length) {
    const { error } = await supabase.from('controle_aprovacoes').insert(falta)
    if (error) console.error('ensureBlocos insert:', error)
    return await loadAprovacoes(mrcId)
  }
  return existentes
}

export async function setBlocoStatus({ mrcId, bloco, fase, status, revisorId, nota }) {
  const isReset = status === 'a_aprovar'
  const payload = {
    status,
    revisor_id: isReset ? null : (revisorId || null),
    nota: isReset ? null : (nota || null),
    data_acao: isReset ? null : new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }
  let q = supabase.from('controle_aprovacoes').update(payload).eq('mrc_id', mrcId).eq('bloco', bloco)
  q = (fase == null) ? q.is('fase', null) : q.eq('fase', fase)
  const { data, error } = await q.select()
  if (error) { console.error('setBlocoStatus update:', error); throw error }
  if (!data || data.length === 0) {
    const { error: insErr } = await supabase
      .from('controle_aprovacoes')
      .insert([{ mrc_id: mrcId, bloco, fase: fase || null, ...payload }])
    if (insErr) { console.error('setBlocoStatus insert:', insErr); throw insErr }
  }
}

// Reabre um bloco (volta a 'a_aprovar') — usado na edição por seção (item 11).
export async function reabrirBloco({ mrcId, bloco, fase }) {
  await setBlocoStatus({ mrcId, bloco, fase: fase ?? null, status: 'a_aprovar' })
}

// Deriva o status geral a partir dos blocos aplicáveis da fase atual.
export function deriveStatusGeral(aprovacoes, row, projeto) {
  const blocos = blocosAplicaveis(projeto)
  const rel = blocos.map(b => achaBloco(aprovacoes, b, faseDoBloco(b, row, projeto)))
  if (rel.some(r => r?.status === 'reprovado')) return 'reprovado'
  if (rel.length && rel.every(r => r?.status === 'aprovado')) return 'aprovado'
  return 'em_revisao'
}
