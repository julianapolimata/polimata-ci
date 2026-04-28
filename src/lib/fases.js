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
