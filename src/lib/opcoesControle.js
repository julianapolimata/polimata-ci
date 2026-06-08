// opcoesControle.js — FONTE ÚNICA das opções de atributos do controle.
// Criado 8/jun/2026 para acabar com a divergência entre criação (StepCaracteristicas),
// manutenção (StepControle) e template de importação (templateMRC).
// Regra: N/A só faz sentido em Sistema (controle manual sem sistema). Os demais
// atributos são obrigatórios e não têm N/A. "Requisito Não Atendido" é exclusivo
// do diagnóstico Parcial e entra condicionalmente (não faz parte das listas base).

export const CATEGORIAS = [
  'Revisão gerencial', 'Reconciliação', 'Autorização', 'Formalização', 'Configuração',
  'Segregação de função', 'Relatório de exceção', 'Acesso Sistêmico', 'Interface/conversão',
  'Políticas/Procedimentos', 'Indicadores de Performance',
]
export const FREQUENCIAS = [
  'Sob demanda', 'Múltiplas vezes ao dia', 'Diária', 'Semanal', 'Quinzenal',
  'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal',
]
export const NATUREZAS = ['Preventivo', 'Detectivo', 'Corretivo']
export const CARACTERISTICAS = ['Manual', 'Automático', 'Semi-automatizado']
export const CONTROLE_CHAVE = ['Controle Chave', 'Controle Compensatório']
export const RNA = 'Requisito Não Atendido'
