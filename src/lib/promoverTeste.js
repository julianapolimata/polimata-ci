import { supabase } from './supabase'

// Promove um projeto de diagnóstico (f1_tem_teste=false) para F1 com teste.
// Chama a RPC atômica (gate server-side: todos os controles ativos Concluídos).
export async function promoverProjetoParaTeste(projetoId, numFases) {
  const { data, error } = await supabase.rpc('promover_projeto_para_teste', {
    p_projeto_id: projetoId,
    p_num_fases: numFases,
  })
  if (error) throw new Error(error.message)
  return data
}

// Resumo do diagnóstico p/ o gate e a tela de confirmação.
// Retorna total, pendentes (não Concluídos) e contagem por existência.
export async function resumoDiagnostico(projetoId) {
  const { data, error } = await supabase
    .from('mrc')
    .select('status_workflow, crit, existencia')
    .eq('projeto_id', projetoId)
    .eq('ativo', true)
  if (error) return { total: 0, pendentes: 0, existentes: 0, parciais: 0, inexistentes: 0 }
  const rows = data || []
  const concluido = c => c.status_workflow === 'aprovado' && c.crit != null
  return {
    total: rows.length,
    pendentes: rows.filter(c => !concluido(c)).length,
    existentes: rows.filter(c => c.existencia === 'Existente').length,
    parciais: rows.filter(c => c.existencia === 'Parcial').length,
    inexistentes: rows.filter(c => c.existencia === 'Inexistente').length,
  }
}
