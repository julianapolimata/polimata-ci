import { supabase } from './supabase'

/**
 * Registra uma ação de auditoria manualmente (workflow, login, etc.)
 * Triggers automáticos capturam UPDATE/INSERT/DELETE no banco.
 * Esta função é para ações de workflow que não alteram campos diretamente.
 */
export async function registrarAuditLog({
  tabela = 'mrc',
  registroId = null,
  acao = 'WORKFLOW',
  campo = null,
  valorAnterior = null,
  valorNovo = null,
  projetoId = null,
  detalhes = null,
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let usuarioNome = ''
    const { data: perfil } = await supabase
      .from('perfis')
      .select('nome')
      .eq('id', user.id)
      .single()
    if (perfil) usuarioNome = perfil.nome

    await supabase.from('audit_log').insert({
      tabela,
      registro_id: registroId,
      acao,
      campo,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      usuario_id: user.id,
      usuario_nome: usuarioNome,
      projeto_id: projetoId,
      detalhes,
    })
  } catch (err) {
    console.error('Erro ao registrar audit log:', err)
  }
}

// ── Ações de workflow pré-definidas ─────────────────────────────────────────

export function logBaixarFicha(controle, projetoId) {
  return registrarAuditLog({
    tabela: 'mrc',
    registroId: controle.id,
    acao: 'WORKFLOW',
    campo: 'ficha_download',
    projetoId,
    detalhes: { descricao: `Ficha baixada: ${controle.controle || controle.id}` },
  })
}

export function logRegistrarResultado(controle, fase, resultado, projetoId) {
  return registrarAuditLog({
    tabela: 'mrc',
    registroId: controle.id,
    acao: 'WORKFLOW',
    campo: fase,
    valorNovo: resultado,
    projetoId,
    detalhes: { descricao: `Resultado registrado na ${fase}: ${resultado}`, fase },
  })
}

export function logAprovar(controle, projetoId) {
  return registrarAuditLog({
    tabela: 'mrc',
    registroId: controle.id,
    acao: 'WORKFLOW',
    campo: 'status_workflow',
    valorAnterior: 'em_revisao',
    valorNovo: 'aprovado',
    projetoId,
    detalhes: { descricao: `Controle aprovado: ${controle.controle || controle.id}` },
  })
}

export function logDevolver(controle, motivo, projetoId) {
  return registrarAuditLog({
    tabela: 'mrc',
    registroId: controle.id,
    acao: 'WORKFLOW',
    campo: 'status_workflow',
    valorAnterior: 'em_revisao',
    valorNovo: 'reprovado',
    projetoId,
    detalhes: { descricao: `Controle devolvido: ${controle.controle || controle.id}`, motivo },
  })
}

export function logLogin() {
  return registrarAuditLog({
    tabela: 'auth',
    acao: 'LOGIN',
    detalhes: { descricao: 'Login realizado' },
  })
}

export function logLogout() {
  return registrarAuditLog({
    tabela: 'auth',
    acao: 'LOGOUT',
    detalhes: { descricao: 'Logout realizado' },
  })
}

export function logRegressao(controle, faseOrigem, numRegressao, projetoId) {
  return registrarAuditLog({
    tabela: 'mrc',
    registroId: controle.id,
    acao: 'REGRESSAO',
    campo: 'num_regressoes',
    valorAnterior: String(numRegressao - 1),
    valorNovo: String(numRegressao),
    projetoId,
    detalhes: {
      descricao: `Regressão #${numRegressao}: controle "${controle.controle || controle.rc || controle.id}" regrediu de ${faseOrigem} para F2-E1`,
      fase_origem: faseOrigem,
      num_regressao: numRegressao,
    },
  })
}

export function logAtualizarControle(controle, projetoId) {
  return registrarAuditLog({
    tabela: 'mrc',
    registroId: controle.id,
    acao: 'WORKFLOW',
    campo: 'atualizar_controle',
    projetoId,
    detalhes: { descricao: `Controle atualizado via modal: ${controle.controle || controle.id}` },
  })
}

// ── Buscar logs para um registro específico (modal inline) ──────────────────

export async function buscarHistorico(registroId, limite = 50) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('registro_id', registroId)
    .order('criado_em', { ascending: false })
    .limit(limite)

  if (error) {
    console.error('Erro ao buscar histórico:', error)
    return []
  }
  return data || []
}

// ── Buscar logs gerais (tela admin) ─────────────────────────────────────────

export async function buscarAuditLogs({ projetoId, tabela, acao, usuarioId, busca, limite = 100, offset = 0 }) {
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + limite - 1)

  if (projetoId) query = query.eq('projeto_id', projetoId)
  if (tabela) query = query.eq('tabela', tabela)
  if (acao) query = query.eq('acao', acao)
  if (usuarioId) query = query.eq('usuario_id', usuarioId)
  if (busca) query = query.or(`campo.ilike.%${busca}%,valor_novo.ilike.%${busca}%,usuario_nome.ilike.%${busca}%`)

  const { data, error, count } = await query
  if (error) {
    console.error('Erro ao buscar audit logs:', error)
    return { logs: [], total: 0 }
  }
  return { logs: data || [], total: count || 0 }
}
