// vinculoConsultor.js — vínculo automático consultor↔projeto + notificação por e-mail.
// Criado em 5/jun/2026: ao definir o consultor responsável de um projeto, o acesso
// (perfis_projetos) é habilitado automaticamente e o consultor recebe um e-mail.
import { supabase } from './supabase'

// Garante a linha em perfis_projetos (acesso do consultor ao projeto).
// Retorna true se o vínculo é novo, false se já existia (ou se falhou).
export async function garantirVinculoProjeto(perfilId, projetoId) {
  if (!perfilId || !projetoId) return false
  const { data: existente } = await supabase.from('perfis_projetos')
    .select('id').eq('perfil_id', perfilId).eq('projeto_id', projetoId).maybeSingle()
  if (existente) return false
  const { error } = await supabase.from('perfis_projetos')
    .insert({ perfil_id: perfilId, projeto_id: projetoId })
  if (error) { console.error('Erro ao vincular consultor ao projeto:', error); return false }
  return true
}

// E-mail "você foi vinculado(a) ao projeto X" — fire-and-forget, não bloqueia o save.
export function notificarVinculoConsultor(consultorId, projetosIds) {
  if (!consultorId || !projetosIds?.length) return
  supabase.functions.invoke('send-email', {
    body: { type: 'consultor_vinculado', data: { consultor_id: consultorId, projetos_ids: projetosIds } }
  }).catch(err => console.error('Erro ao enviar email de vínculo:', err))
}

// Fluxo completo p/ consultor responsável de projeto: habilita acesso (se papel
// consultor) e envia e-mail quando o vínculo é novo.
export async function vincularResponsavelAoProjeto(consultor, projetoId) {
  if (!consultor?.id || !projetoId) return
  let vinculoNovo = true
  if (consultor.papel === 'consultor_polimata') {
    vinculoNovo = await garantirVinculoProjeto(consultor.id, projetoId)
  }
  if (vinculoNovo) notificarVinculoConsultor(consultor.id, [projetoId])
}
