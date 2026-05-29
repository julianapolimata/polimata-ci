// ═══════════════════════════════════════════════════════════════════════════════
// statusWorkflow.js — Lógica centralizada de status do workflow
// ═══════════════════════════════════════════════════════════════════════════════
//
// Status no banco: nao_iniciado | em_analise | teste_pendente | em_revisao | aprovado | reprovado
//
// Visão CLIENTE (gestor_cliente / usuario_cliente):
//   Não Iniciado | Em Análise | Em Revisão | Aprovado | Reprovado
//   (teste_pendente aparece como "Em Análise" — cliente não precisa saber do detalhe)
//
// Visão PROFISSIONAL (admin_polimata / consultor_polimata):
//   Não Iniciado | Em Análise | Teste Pendente | Em Revisão | Aprovado | Devolvido
//   (reprovado aparece como "Devolvido" — indica que precisa de retrabalho)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Constantes de status ──────────────────────────────────────────────────────
export const STATUS = {
  RASCUNHO: 'rascunho',
  NAO_INICIADO: 'nao_iniciado',
  EM_ANALISE: 'em_analise',
  TESTE_PENDENTE: 'teste_pendente',
  EM_REVISAO: 'em_revisao',
  APROVADO: 'aprovado',
  REPROVADO: 'reprovado',
}

// ── Configuração visual por status ────────────────────────────────────────────
const CONFIG_PROFISSIONAL = {
  rascunho:       { label: 'Rascunho',       color: '#92400E',           bg: 'rgba(234,179,8,0.18)' },
  nao_iniciado:   { label: 'Não Iniciado',   color: 'var(--lt-text3)',   bg: 'rgba(0,32,62,0.05)' },
  em_analise:     { label: 'Em Análise',     color: 'var(--copper)',     bg: 'rgba(204,145,94,0.1)' },
  teste_pendente: { label: 'Teste Pendente', color: '#CA8A04',          bg: 'rgba(234,179,8,0.1)' },
  em_revisao:     { label: 'Em Revisão',     color: '#2563EB',          bg: 'rgba(59,130,246,0.08)' },
  aprovado:       { label: 'Aprovado',       color: 'var(--n4-vis)',          bg: 'rgba(34,197,94,0.1)' },
  reprovado:      { label: 'Devolvido',      color: 'var(--n1)',          bg: 'rgba(239,68,68,0.1)' },
}

const CONFIG_CLIENTE = {
  rascunho:       { label: 'Rascunho',     color: '#92400E',           bg: 'rgba(234,179,8,0.18)' },
  nao_iniciado:   { label: 'Não Iniciado', color: 'var(--lt-text3)',   bg: 'rgba(0,32,62,0.05)' },
  em_analise:     { label: 'Em Análise',   color: 'var(--copper)',     bg: 'rgba(204,145,94,0.1)' },
  teste_pendente: { label: 'Em Análise',   color: 'var(--copper)',     bg: 'rgba(204,145,94,0.1)' },
  em_revisao:     { label: 'Em Revisão',   color: '#2563EB',          bg: 'rgba(59,130,246,0.08)' },
  aprovado:       { label: 'Aprovado',     color: 'var(--n4-vis)',          bg: 'rgba(34,197,94,0.1)' },
  reprovado:      { label: 'Em Análise',   color: 'var(--copper)',     bg: 'rgba(204,145,94,0.1)' },
}

// Fallback para status desconhecido
const FALLBACK = { label: '—', color: 'var(--lt-text3)', bg: 'rgba(0,32,62,0.03)' }

// ── Helpers de perfil ─────────────────────────────────────────────────────────
export function isClienteRole(papel) {
  return papel === 'gestor_cliente' || papel === 'usuario_cliente'
}

export function isProfissionalRole(papel) {
  return papel === 'admin_polimata' || papel === 'consultor_polimata'
}

// ── Funções principais ────────────────────────────────────────────────────────

/**
 * Retorna { label, color, bg } para exibir o badge de status
 * @param {string} status - valor do status_workflow no banco
 * @param {string} papel - papel do usuário logado
 */
export function getStatusConfig(status, papel) {
  if (!status) return CONFIG_CLIENTE.nao_iniciado
  const config = isClienteRole(papel) ? CONFIG_CLIENTE : CONFIG_PROFISSIONAL
  return config[status] || FALLBACK
}

/**
 * Retorna apenas o label de exibição
 */
export function getStatusLabel(status, papel) {
  return getStatusConfig(status, papel).label
}

/**
 * Verifica se o profissional pode editar (Atualizar) o controle
 * Pode editar: nao_iniciado, em_analise, teste_pendente
 * Não pode: em_revisao, aprovado, reprovado (reprovado usa "↩ Editar" separado)
 */
export function canEditControl(status) {
  return [STATUS.NAO_INICIADO, STATUS.EM_ANALISE, STATUS.TESTE_PENDENTE].includes(status)
}

/**
 * Verifica se o profissional pode registrar resultado de teste
 * Pode: em_analise (baixou a ficha e realizou o teste)
 * Não pode: teste_pendente (salvou sem gerar ficha — precisa baixar a ficha primeiro)
 */
export function canRegisterResult(status) {
  return status === STATUS.EM_ANALISE
}

/**
 * Verifica se o controle foi devolvido (reprovado) e precisa de retrabalho
 */
export function isDevolvido(status) {
  return status === STATUS.REPROVADO
}

/**
 * Verifica se o controle está aguardando revisão
 */
export function isAguardandoRevisao(status) {
  return status === STATUS.EM_REVISAO
}

/**
 * Retorna a próxima ação a ser tomada com base no status_workflow.
 * Útil para a coluna "Ação" e filtros internos (visão Polímata).
 *
 * Mapeamento:
 *   nao_iniciado    → Atualizar         (preencher premissas)
 *   teste_pendente  → Baixar Ficha      (gerar ficha de teste)
 *   em_analise      → Registrar Resultado
 *   em_revisao      → Revisar           (admin)
 *   reprovado       → Editar            (controle devolvido)
 *   aprovado        → Concluído
 */
export const PROXIMA_ACAO = {
  nao_iniciado:   'Atualizar',
  teste_pendente: 'Baixar Ficha',
  em_analise:     'Registrar Resultado',
  em_revisao:     'Revisar',
  reprovado:      'Editar',
  aprovado:       'Concluído',
}

export function getProximaAcao(status) {
  return PROXIMA_ACAO[status] || '—'
}

/**
 * Lista de opções (label) usadas em filtros de "Próxima Ação".
 * Mantém ordem de fluxo natural do workflow.
 */
export const PROXIMA_ACAO_OPCOES = [
  'Atualizar',
  'Baixar Ficha',
  'Registrar Resultado',
  'Revisar',
  'Editar',
  'Concluído',
]

/**
 * Todos os valores válidos de status_workflow (para referência)
 */
export const ALL_STATUS = Object.values(STATUS)
