// ─── Utilitário centralizado de fases ────────────────────────────────────────
// Fonte única de verdade para determinar fase atual de cada controle.
// "Fase Atual" = próxima fase a ser executada (não a última concluída).
// Progressão: F1 → F2-E1 → F2-E2 → F3 → F4-C1 → F4-C2 → F5 → Concluído
// Atalho: F1 Efetivo pula F2 e vai direto para F3.

/**
 * Determina a PRÓXIMA fase a executar de um controle.
 * Caminha de F5 até F1 procurando a última fase concluída,
 * e retorna a fase seguinte na progressão.
 *
 * @param {Object} c - registro da MRC
 * @returns {Object} { codigo, numero, nome, label, resultado, cor, concluida? }
 */
export function getFaseInfo(c) {
  if (!c) return { ...FASES.F1 }

  // F5 concluída → ciclo completo
  if (c.r_f5 && c.r_f5 !== 'Teste Não Realizado') {
    return {
      codigo: 'F5', numero: 5,
      nome: 'Auditoria Independente',
      label: 'F5 — Auditoria Independente',
      resultado: c.r_f5,
      cor: 'var(--f5c, #7C3AED)',
      concluida: true,
    }
  }

  // F4-C2 concluída → próxima é F5
  if (c.r_f4c2 && c.r_f4c2 !== 'Teste Não Realizado') {
    return {
      codigo: 'F5', numero: 5,
      nome: 'Auditoria Independente',
      label: 'F5 — Auditoria Independente',
      resultado: '—',
      cor: 'var(--f5c, #7C3AED)',
    }
  }

  // F4-C1 concluída → próxima é F4-C2
  if (c.r_f4c1 && c.r_f4c1 !== 'Teste Não Realizado') {
    return {
      codigo: 'F4C2', numero: 4,
      nome: 'Auditoria Contínua',
      label: 'F4-C2 — Auditoria Contínua',
      resultado: '—',
      cor: 'var(--f4c, #0EA5E9)',
    }
  }

  // F3 concluída → próxima é F4-C1
  if (c.r3 && c.r3 !== 'Teste Não Realizado') {
    return {
      codigo: 'F4C1', numero: 4,
      nome: 'Auditoria Contínua',
      label: 'F4-C1 — Auditoria Contínua',
      resultado: '—',
      cor: 'var(--f4c, #0EA5E9)',
    }
  }

  // F2-E2 concluída → próxima é F3
  if (c.r_ader && c.r_ader !== 'Teste Não Realizado') {
    return {
      codigo: 'F3', numero: 3,
      nome: 'Revisão Integral',
      label: 'F3 — Revisão Integral',
      resultado: '—',
      cor: 'var(--f3c, #F59E0B)',
    }
  }

  // F2-E1 concluída → próxima é F2-E2
  if (c.st_pa && c.st_pa !== '') {
    return {
      codigo: 'F2E2', numero: 2,
      nome: 'Teste de Aderência',
      label: 'F2-E2 — Teste de Aderência',
      resultado: '—',
      cor: 'var(--f2e2c, #10B981)',
    }
  }

  // F1 concluída → depende do resultado
  if (c.r1 && c.r1 !== 'Teste Não Realizado') {
    // Atalho: F1 efetivo pula F2, vai direto para F3
    if (c.r1.toLowerCase() === 'efetivo') {
      return {
        codigo: 'F3', numero: 3,
        nome: 'Revisão Integral',
        label: 'F3 — Revisão Integral',
        resultado: '—',
        cor: 'var(--f3c, #F59E0B)',
      }
    }
    // F1 inefetivo/GAP → próxima é F2-E1
    return {
      codigo: 'F2E1', numero: 2,
      nome: 'Teste de Desenho',
      label: 'F2-E1 — Teste de Desenho',
      resultado: '—',
      cor: 'var(--f2e1c, #34D399)',
    }
  }

  // Nenhuma fase concluída → F1
  return { ...FASES.F1 }
}

/**
 * Retorna o resultado vitrine (último resultado válido, de F5 até F1).
 * Usado para exibir o resultado "atual" do controle independente da fase.
 */
export function getResultadoVitrine(c) {
  if (!c) return '—'
  const chain = [c.r_f5, c.r_f4c2, c.r_f4c1, c.r3, c.r_ader, c.st_pa, c.r1]
  for (const v of chain) { if (v && v !== 'Teste Não Realizado' && v !== 'N/A') return v }
  return c.r1 || '—'
}

/**
 * Retorna o nome amigável da fase atual.
 * @param {Object} c - registro da MRC
 * @returns {string} nome da fase
 */
export function getFaseAtual(c) {
  return getFaseInfo(c).nome
}

/**
 * Retorna o label curto da fase (para tabelas/exports).
 * @param {Object} c - registro da MRC
 * @returns {string} label da fase (ex: "F3 — Revisão Integral")
 */
export function getFaseLabel(c) {
  return getFaseInfo(c).label
}

/**
 * Retorna o número da fase (1-5) para cálculos.
 * @param {Object} c - registro da MRC
 * @returns {number} número da fase
 */
export function getFaseNumero(c) {
  return getFaseInfo(c).numero
}

/**
 * Campos de trabalho por fase — se algum está preenchido, a fase está "em andamento".
 * Mapeado pelo código retornado por getFaseInfo().
 */
const CAMPOS_FASE = {
  F1:   ['passos_f1', 'r1'],
  F2E1: ['dem_pa', 'resp_pa', 'dt_pa', 'st_pa', 'coment_pa'],
  F2E2: ['dt_teste', 'dc_novo', 'r_ader', 'melhoria', 'incons_ader', 'coment_ader'],
  F3:   ['st_f3', 'r3', 'incons_f3', 'rec_f3'],
  F4C1: ['r_f4c1', 'incons_f4c1', 'rec_f4c1', 'coment_f4c1', 'dt_f4c1'],
  F4C2: ['r_f4c2', 'incons_f4c2', 'rec_f4c2', 'coment_f4c2', 'dt_f4c2'],
  F5:   ['r_f5', 'incons_f5', 'rec_f5', 'coment_f5', 'dt_f5'],
}

function temDadosNaFase(c, codigoFase) {
  const campos = CAMPOS_FASE[codigoFase]
  if (!campos) return false
  return campos.some(k => {
    const v = c[k]
    return v && v !== '' && v !== 'Teste Não Realizado' && v !== 'N/A'
  })
}

/**
 * Computa o status atual com base na fase atual e nos dados preenchidos.
 * - status_workflow em_revisao / aprovado / reprovado → prevalece (estados do workflow)
 * - Fase concluída (F5 com resultado) → 'aprovado' (ciclo completo)
 * - Fase atual com dados salvos → 'em_analise'
 * - Fase atual sem dados → 'nao_iniciado'
 *
 * @param {Object} c - registro da MRC
 * @returns {string} status computado (mesmo vocabulário de status_workflow)
 */
export function getStatusComputado(c) {
  if (!c) return 'nao_iniciado'

  // Estados explícitos do workflow têm prioridade
  const sw = c.status_workflow
  if (sw === 'em_revisao' || sw === 'aprovado' || sw === 'reprovado') return sw

  const info = getFaseInfo(c)

  // Ciclo completo (F5 concluída)
  if (info.concluida) return 'aprovado'

  // Verifica se a fase atual (próxima a executar) tem dados
  if (temDadosNaFase(c, info.codigo)) return 'em_analise'

  return 'nao_iniciado'
}

/**
 * Ordem das fases para comparação de progressão.
 * Cada chave de resultado do MRC mapeada a um índice ordinal.
 */
const FASE_ORDER = { r1: 0, st_pa: 1, r_ader: 2, r3: 3, r_f4c1: 4, r_f4c2: 5, r_f5: 6 }
const FASE_KEYS = ['r1', 'st_pa', 'r_ader', 'r3', 'r_f4c1', 'r_f4c2', 'r_f5']

/**
 * Retorna a chave da fase onde o controle parou (última fase com dados).
 * Usada para deduzir em qual fase o risco foi evitado/transferido.
 */
function getLastPhaseKey(c) {
  for (let i = FASE_KEYS.length - 1; i >= 0; i--) {
    const k = FASE_KEYS[i]
    const v = c[k]
    if (v && v !== '' && v !== 'Teste Não Realizado') return k
  }
  return 'r1' // sem dados = estava na F1
}

/**
 * Para controles evitados/transferidos, retorna o que exibir em cada coluna de fase.
 * - Na fase onde parou: 'Evitado' ou 'Transferido'
 * - Nas fases seguintes: 'N/A'
 * - Nas fases anteriores: valor normal
 * - null = usar lógica normal
 *
 * @param {Object} c - registro MRC
 * @param {string} faseKey - chave da coluna (r1, st_pa, r_ader, r3, r_f4c1, r_f4c2, r_f5)
 * @returns {string|null} override de display ou null para lógica normal
 */
export function getFaseDisplayOverride(c, faseKey) {
  if (!c) return null
  const sr = (c.status_risco || '').toLowerCase()
  if (sr !== 'evitado' && sr !== 'transferido') return null

  const stoppedAt = getLastPhaseKey(c)
  const stoppedIdx = FASE_ORDER[stoppedAt] ?? 0
  const currentIdx = FASE_ORDER[faseKey] ?? 0

  // Na fase em que parou: mostrar o status_risco com primeira letra maiúscula
  if (currentIdx === stoppedIdx) {
    return sr === 'evitado' ? 'Evitado' : 'Transferido'
  }
  // Fases posteriores: N/A (nunca serão executadas)
  if (currentIdx > stoppedIdx) return 'N/A'
  // Fases anteriores: mostrar valor normal (return null)
  return null
}

// Constantes de referência
const FASES = {
  F1: {
    codigo: 'F1', numero: 1,
    nome: 'Diagnóstico Inicial',
    label: 'F1 — Diagnóstico',
    resultado: '—',
    cor: 'var(--f1c, #6366F1)',
  },
}
