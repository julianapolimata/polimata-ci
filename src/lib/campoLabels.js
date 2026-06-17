// Rótulos amigáveis dos campos do banco para o log de auditoria.
// Compartilhado entre HistoricoTab (modal) e AuditLogConfig (tela admin).

export const CAMPO_LABELS = {
  // Fases / resultados
  r1: 'F1 — Diagnóstico',
  st_pa: 'F2-E1 — Teste de Desenho',
  r_ader: 'F2-E2 — Efetividade',
  r3: 'F3 — Revisão Integral',
  r_f4c1: 'F4-C1 — Auditoria Contínua',
  r_f4c2: 'F4-C2 — Auditoria Contínua',
  r_f5: 'F5 — Auditoria Independente',
  // Identificação
  rr: 'Ref. do risco',
  rc: 'Ref. do controle',
  dr: 'Descrição do risco',
  dc: 'Descrição do controle',
  risco: 'Descrição do risco',
  controle: 'Nome do controle',
  cenario_atual: 'Cenário atual',
  existencia: 'Existência do controle',
  // Características do controle
  cat: 'Categoria',
  nat: 'Natureza',
  car: 'Característica',
  freq: 'Frequência',
  sis: 'Sistema',
  chave: 'Controle-chave',
  // Premissas
  premissa_porque: 'Premissa — Por quê',
  premissa_quando: 'Premissa — Quando',
  premissa_onde: 'Premissa — Onde',
  premissa_quem: 'Premissa — Quem',
  premissa_como: 'Premissa — Como',
  premissa_resultado: 'Premissa — Resultado',
  // Criticidade
  imp: 'Impacto',
  prob: 'Probabilidade',
  crit: 'Criticidade (nota)',
  crit_label: 'Criticidade',
  impacto: 'Impacto',
  probabilidade: 'Probabilidade',
  // Datas / responsáveis
  dt_implementacao: 'Data de implementação',
  consultor_id: 'Consultor responsável',
  atualizado_por: 'Atualizado por',
  submetido_por: 'Submetido por',
  submetido_em: 'Submetido em',
  aprovado_por: 'Aprovado por',
  aprovado_em: 'Aprovado em',
  criado_por: 'Criado por',
  // Workflow
  status_workflow: 'Status do workflow',
  status_risco: 'Situação do risco',
  edicao_pendente: 'Edição pendente',
  num_regressoes: 'Nº de regressões',
  // Reavaliação
  reavaliacao_justificativa: 'Reavaliação — justificativa',
  reavaliacao_solicitada_por: 'Reavaliação — solicitada por',
  reavaliacao_solicitada_em: 'Reavaliação — solicitada em',
  // Estrutura (áreas / subprocessos / projetos)
  nome: 'Nome',
  ordem: 'Ordem',
  ativo: 'Ativo',
  peso: 'Peso (%)',
  prefixo: 'Prefixo',
  // Ações de workflow registradas manualmente
  ficha_download: 'Download da ficha',
  atualizar_controle: 'Atualização do controle',
}

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  nao_iniciado: 'Não iniciado',
  em_revisao: 'Em revisão',
  aprovado: 'Aprovado',
  reprovado: 'Em correção',
  reavaliacao_pendente: 'Reavaliação pendente',
  em_andamento: 'Em análise',
  em_analise: 'Em análise',
  concluido: 'Concluído',
}

export function formatCampo(campo) {
  if (!campo) return ''
  return CAMPO_LABELS[campo] || campo.replace(/_/g, ' ')
}

// Traduz alguns valores técnicos (status) para rótulos de negócio.
export function formatValor(campo, valor) {
  if (valor == null || valor === '') return valor
  if (campo === 'status_workflow' && STATUS_LABELS[valor]) return STATUS_LABELS[valor]
  return valor
}

// Linha de manutenção do sistema = alteração feita direto no banco, sem usuário.
export function isManutencaoSistema(log) {
  return !log.usuario_id && !log.usuario_nome
}

export function nomeUsuario(log) {
  if (isManutencaoSistema(log)) return 'Sistema (manutenção)'
  return log.usuario_nome || '—'
}
