// ═══════════════════════════════════════════════════════════════════════════
// documentos.js — Bloco 2: arquivos no Supabase Storage (bucket 'documentos')
// Estrutura de pastas: projeto / área / subprocesso / controle / fase
//   (subfase F2 Desenho|Aderência, F4 Ciclo 1|2) / Evidencias | Fichas
// O caminho físico usa UUIDs (estável); a árvore visível usa a tabela
// public.documentos (registro) com os nomes reais.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from './supabase'

export const MAX_BYTES = 25 * 1024 * 1024
const EXTS_OK = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'zip']
const MIME_POR_EXT = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  zip: 'application/zip',
}

export function validarArquivo(nome, tamanho) {
  const ext = (nome.split('.').pop() || '').toLowerCase()
  if (!EXTS_OK.includes(ext)) return 'Tipo não permitido. Use PDF, Excel, Word, imagem (PNG/JPG) ou ZIP.'
  if (tamanho > MAX_BYTES) return 'Arquivo acima do limite de 25 MB.'
  return null
}

function slug(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 90)
}

// fase da solicitação/controle → [pasta da fase, subfase?]
export function faseFolders(fase) {
  const m = {
    'F2-E1': ['F2', 'Desenho'], 'F2E1': ['F2', 'Desenho'],
    'F2-E2': ['F2', 'Aderencia'], 'F2E2': ['F2', 'Aderencia'],
    'F4-C1': ['F4', 'Ciclo_1'], 'F4C1': ['F4', 'Ciclo_1'],
    'F4-C2': ['F4', 'Ciclo_2'], 'F4C2': ['F4', 'Ciclo_2'],
  }
  return m[fase] || [fase || 'Geral']
}
export const SUBFASE_LABEL = { Desenho: 'Desenho', Aderencia: 'Aderência', Ciclo_1: 'Ciclo 1', Ciclo_2: 'Ciclo 2' }

export function montarPath({ projetoId, areaId, subprocessoId, controleId, fase, categoria, nomeArquivo }) {
  const [f, sub] = faseFolders(fase)
  const partes = [projetoId, areaId || 'geral', subprocessoId || 'geral', controleId || 'geral', f]
  if (sub) partes.push(sub)
  partes.push(categoria === 'ficha' ? 'Fichas' : 'Evidencias')
  partes.push(Date.now() + '_' + slug(nomeArquivo))
  return partes.join('/')
}

/**
 * Sobe um arquivo (File ou Blob) e registra na tabela documentos.
 * meta: { projetoId, areaId, subprocessoId, controleId, solicitacaoId, fase, categoria, enviadoPor }
 */
export async function uploadDocumento({ arquivo, nomeArquivo, meta }) {
  const nome = nomeArquivo || arquivo.name
  const errVal = validarArquivo(nome, arquivo.size)
  if (errVal) throw new Error(errVal)
  const ext = (nome.split('.').pop() || '').toLowerCase()
  const contentType = arquivo.type || MIME_POR_EXT[ext] || 'application/octet-stream'
  const path = montarPath({
    projetoId: meta.projetoId, areaId: meta.areaId, subprocessoId: meta.subprocessoId,
    controleId: meta.controleId, fase: meta.fase, categoria: meta.categoria, nomeArquivo: nome,
  })
  const { error: upErr } = await supabase.storage.from('documentos').upload(path, arquivo, { contentType, upsert: false })
  if (upErr) throw new Error('Falha no upload: ' + upErr.message)
  const [, subfase] = faseFolders(meta.fase)
  const { error: regErr } = await supabase.from('documentos').insert([{
    projeto_id: meta.projetoId, area_id: meta.areaId || null, subprocesso_id: meta.subprocessoId || null,
    controle_id: meta.controleId || null, solicitacao_id: meta.solicitacaoId || null,
    fase: meta.fase || null, subfase: subfase || null, categoria: meta.categoria,
    nome_arquivo: nome, storage_path: path, tamanho_bytes: arquivo.size,
    content_type: contentType, enviado_por: meta.enviadoPor || null,
  }])
  if (regErr) {
    await supabase.storage.from('documentos').remove([path]).catch(() => {})
    throw new Error('Falha ao registrar o arquivo: ' + regErr.message)
  }
  return path
}

export async function urlDownload(storagePath) {
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(storagePath, 3600)
  if (error) throw new Error('Falha ao gerar link: ' + error.message)
  return data.signedUrl
}

export async function baixarDocumento(doc) {
  const url = await urlDownload(doc.storage_path)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.nome_arquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function excluirDocumento(doc) {
  const { error: regErr } = await supabase.from('documentos').delete().eq('id', doc.id)
  if (regErr) throw new Error(regErr.message)
  await supabase.storage.from('documentos').remove([doc.storage_path]).catch(() => {})
}

export async function listarPorSolicitacao(solicitacaoId) {
  const { data, error } = await supabase.from('documentos')
    .select('*').eq('solicitacao_id', solicitacaoId).order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export function fmtTamanho(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
