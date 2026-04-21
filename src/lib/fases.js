// ─── Utilitário centralizado de fases ────────────────────────────────────────
// Fonte única de verdade para determinar fase atual, labels e info de cada controle.
// Substitui getFaseAtual/getFaseInfo/getFaseLabel duplicados em 5+ arquivos.

/**
 * Determina a fase atual de um controle baseado nos resultados preenchidos.
 * Retorna objeto completo com código, label, número, resultado e cor.
 *
 * @param {Object} c - registro da MRC
 * @returns {Object} { codigo, numero, nome, label, resultado, cor }
 */
export function getFaseInfo(c) {
  if (!c) return FASES.F1

  // F5 → Auditoria Independente
  if (c.r_f5 && c.r_f5 !== 'Teste Não Realizado') {
    return {
      codigo: 'F5', numero: 5,
      nome: 'Auditoria Independente',
      label: 'F5 \u2014 Auditoria Independente',
      resultado: c.r_f5,
      cor: 'var(--f5c, #7C3AED)',
    }
  }

  // F4-C2 → Auditoria Contínua Ciclo 2
  if (c.r_f4c2 && c.r_f4c2 !== 'Teste Não Realizado') {
    return {
      codigo: 'F4C2', numero: 4,
      nome: 'Auditoria Cont\u00EDnua',
      label: 'F4-C2 \u2014 Auditoria Cont\u00EDnua',
      resultado: c.r_f4c2,
      cor: 'var(--f4c, #0EA5E9)',
    }
  }

  // F4-C1 → Auditoria Contínua Ciclo 1
  if (c.r_f4c1 && c.r_f4c1 !== 'Teste Não Realizado') {
    return {
      codigo: 'F4C1', numero: 4,
      nome: 'Auditoria Cont\u00EDnua',
      label: 'F4-C1 \u2014 Auditoria Cont\u00EDnua',
      resultado: c.r_f4c1,
      cor: 'var(--f4c, #0EA5E9)',
    }
  }

  // F3 → Controles Internos (Revisão MRC)
  if (c.r3 && c.r3 !== 'Teste Não Realizado') {
    return {
      codigo: 'F3', numero: 3,
      nome: 'Controles Internos',
      label: 'F3 \u2014 Revis\u00E3o',
      resultado: c.r3,
      cor: 'var(--f3c, #F59E0B)',
    }
  }

  // F2-E2 → Teste de Aderência
  if (c.r_ader && c.r_ader !== 'Teste Não Realizado') {
    return {
      codigo: 'F2E2', numero: 2,
      nome: 'Teste de Ader\u00EAncia',
      label: 'F2-E2 \u2014 Teste de Ader\u00EAncia',
      resultado: c.r_ader,
      cor: 'var(--f2e2c, #10B981)',
    }
  }

  // F2-E1 → Plano de Ação (TOD)
  if (c.st_pa && c.st_pa !== '') {
    return {
      codigo: 'F2E1', numero: 2,
      nome: 'Plano de A\u00E7\u00E3o (TOD)',
      label: 'F2-E1 \u2014 Plano de A\u00E7\u00E3o (TOD)',
      resultado: c.st_pa || '\u2014',
      cor: 'var(--f2e1c, #34D399)',
    }
  }

  // F1 → Diagnóstico Inicial
  if (c.r1 && c.r1 !== 'Teste Não Realizado') {
    // Atalho: se F1 efetivo, próxima fase é F3 (pula F2)
    if (c.r1.toLowerCase() === 'efetivo') {
      return {
        codigo: 'F1_ATALHO', numero: 3,
        nome: 'Controles Internos',
        label: 'F1 \u2192 F3 (atalho)',
        resultado: c.r1,
        cor: 'var(--f1c, #6366F1)',
      }
    }
    return {
      codigo: 'F2E1', numero: 2,
      nome: 'Plano de A\u00E7\u00E3o e Teste de Desenho',
      label: 'F1 \u2014 Diagn\u00F3stico',
      resultado: c.r1,
      cor: 'var(--f1c, #6366F1)',
    }
  }

  // Sem resultado → F1
  return {
    codigo: 'F1', numero: 1,
    nome: 'Diagn\u00F3stico Inicial',
    label: 'F1 \u2014 Diagn\u00F3stico',
    resultado: '\u2014',
    cor: 'var(--f1c, #6366F1)',
  }
}

/**
 * Retorna o nome amigável da fase atual (compatível com versões anteriores).
 * @param {Object} c - registro da MRC
 * @returns {string} nome da fase
 */
export function getFaseAtual(c) {
  return getFaseInfo(c).nome
}

/**
 * Retorna o label curto da fase (para tabelas/exports).
 * @param {Object} c - registro da MRC
 * @returns {string} label da fase (ex: "F3 — Revisão")
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
    nome: 'Diagn\u00F3stico Inicial',
    label: 'F1 \u2014 Diagn\u00F3stico',
    resultado: '\u2014',
    cor: 'var(--f1c, #6366F1)',
  },
}
