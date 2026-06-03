// Pesos e contribuição dos controles.
// Extraído em 22/mai/2026 (fatiamento Etapa 7).
import { isAtivo, isEfetivo, isReprovado, getMultiplicador, getPesoFaseNormalizado } from './_shared'

// ─── PESO PROPORCIONAL DO CONTROLE (seção 3) ────────────────────────────────

/**
 * Calcula o peso proporcional de cada controle ativo dentro da área.
 * Retorna array de { controle, multiplicador, pesoControle }
 * 
 * IMPORTANTE: denominador ÚNICO para toda a área (soma de todos os multiplicadores)
 * NÃO separar por faixa de criticidade (bug #1 da planilha)
 * 
 * @param {Array} controlesArea - todos os controles da área
 * @returns {Array} controles com peso calculado
 */
export function calcularPesosControles(controlesArea) {
  const ativos = controlesArea.filter(isAtivo)
  if (ativos.length === 0) return []

  // Denominador único = soma de todos os multiplicadores dos controles ativos
  const denominador = ativos.reduce((sum, c) => sum + getMultiplicador(c), 0)

  return ativos.map(c => {
    const multiplicador = getMultiplicador(c)
    return {
      controle: c,
      multiplicador,
      pesoControle: denominador > 0 ? multiplicador / denominador : 0,
    }
  })
}

// ─── CONTRIBUIÇÃO DE UM CONTROLE (seções 5, 6, 7) ──────────────────────────

/**
 * Calcula a contribuição de um controle individual ao percentual da área.
 * Aplica: atalho F1→F3, regressão, progressão acumulada.
 * 
 * Campos esperados no controle (mapeados da tabela mrc):
 *   r1          - resultado F1 (Efetivo/Inefetivo/GAP)
 *   st_pa       - status plano de ação F2-E1 (Efetivo/Concluído)
 *   r_ader      - resultado F2-E2 (Efetivo/Inefetivo/GAP)
 *   r3          - resultado F3 (Efetivo/Inefetivo/GAP)
 *   r_f4c1      - resultado F4-C1 (Efetivo/Inefetivo/GAP)
 *   r_f4c2      - resultado F4-C2 (Efetivo/Inefetivo/GAP)
 *   r_f5        - resultado F5 (Efetivo/Inefetivo/GAP)
 *   status_risco - Existente/Descontinuado
 *   status_workflow - nao_iniciado/em_analise/teste_pendente/em_revisao/aprovado/reprovado (opcional)
 * 
 * @param {Object} controle - dados do controle
 * @param {number} pesoControle - peso proporcional (0 a 1)
 * @param {Object} options - { requireAprovado: boolean }
 * @returns {Object} { contribuicao, faseAtual, detalheFases, regrediu }
 */
export function calcularContribuicaoControle(controle, pesoControle, options = {}) {
  const { requireAprovado = false, numFases = 5 } = options
  const PESO_FASE = getPesoFaseNormalizado(numFases)

  // Se workflow ativo e controle não aprovado → contribui 0
  if (requireAprovado && controle.status_workflow && controle.status_workflow !== 'aprovado') {
    return {
      contribuicao: 0,
      faseAtual: 'nao_iniciado',
      detalheFases: {},
      regrediu: false,
      atalhoF1: false,
    }
  }

  const resultado = {
    contribuicao: 0,
    faseAtual: 'F1',
    detalheFases: {},
    regrediu: false,
    atalhoF1: false,
  }

  const r1 = controle.r1
  const efetivoF1 = isEfetivo(r1)

  // ── F1 não contribui individualmente (é fixa 10% por área) ──
  resultado.detalheFases.F1 = { resultado: r1 || null, contribuicao: 0 }

  // Se F1 não tem resultado, controle ainda está em F1
  if (!r1 || r1 === 'Teste Não Realizado') {
    resultado.faseAtual = 'F1'
    return resultado
  }

  // ── Determinar caminho: atalho ou normal ──

  if (efetivoF1) {
    // ATALHO: Efetivo na F1 → pula F2, ganha 25% automático (seção 6)
    resultado.atalhoF1 = true
    const contribF2Auto = pesoControle * (PESO_FASE.F2E1 + PESO_FASE.F2E2) // 25%
    resultado.detalheFases.F2E1 = { resultado: 'auto', contribuicao: pesoControle * PESO_FASE.F2E1 }
    resultado.detalheFases.F2E2 = { resultado: 'auto', contribuicao: pesoControle * PESO_FASE.F2E2 }
    resultado.contribuicao = contribF2Auto
    resultado.faseAtual = 'F3'

    // ── F3 (após atalho) ──
    const r3 = controle.r3
    if (!r3 || r3 === 'Teste Não Realizado') {
      // Aguardando F3
      resultado.detalheFases.F3 = { resultado: null, contribuicao: 0 }
      return resultado
    }
    if (isReprovado(r3)) {
      // REGRESSÃO: perde F2 auto + F3, volta pra F2-E1 (seção 7)
      resultado.regrediu = true
      resultado.contribuicao = 0
      resultado.detalheFases.F2E1 = { resultado: 'auto→regrediu', contribuicao: 0 }
      resultado.detalheFases.F2E2 = { resultado: 'auto→regrediu', contribuicao: 0 }
      resultado.detalheFases.F3 = { resultado: r3, contribuicao: 0 }
      resultado.faseAtual = 'F2-E1 (regressão)'
      return resultado
    }
    // Efetivo na F3
    resultado.detalheFases.F3 = { resultado: r3, contribuicao: pesoControle * PESO_FASE.F3 }
    resultado.contribuicao += pesoControle * PESO_FASE.F3
    resultado.faseAtual = 'F4'

  } else {
    // CAMINHO NORMAL: Inefetivo ou GAP na F1 → F2-E1 → F2-E2 → F3
    resultado.faseAtual = 'F2-E1'

    // ── F2-E1: Plano de Ação e Teste de Desenho ──
    const stPa = controle.st_pa
    const r2e1 = controle.r2e1 // resultado do teste de desenho, se existir
    // F2-E1 progride quando o TOD é efetivo
    const f2e1Concluido = isEfetivo(stPa) || isEfetivo(r2e1)

    if (!f2e1Concluido) {
      resultado.detalheFases.F2E1 = { resultado: stPa || null, contribuicao: 0 }
      return resultado
    }

    // F2-E1 efetivo (TOD efetivo)
    resultado.detalheFases.F2E1 = { resultado: 'Efetivo', contribuicao: pesoControle * PESO_FASE.F2E1 }
    resultado.contribuicao += pesoControle * PESO_FASE.F2E1
    resultado.faseAtual = 'F2-E2'

    // ── F2-E2: Teste de Efetividade ──
    const rAder = controle.r_ader
    if (!rAder || rAder === 'Teste Não Realizado') {
      resultado.detalheFases.F2E2 = { resultado: null, contribuicao: 0 }
      return resultado
    }
    if (isReprovado(rAder)) {
      // REGRESSÃO a partir da F2-E2
      resultado.regrediu = true
      resultado.contribuicao = 0
      resultado.detalheFases.F2E1 = { resultado: 'regrediu', contribuicao: 0 }
      resultado.detalheFases.F2E2 = { resultado: rAder, contribuicao: 0 }
      resultado.faseAtual = 'F2-E1 (regressão)'
      return resultado
    }
    // Efetivo na F2-E2
    resultado.detalheFases.F2E2 = { resultado: rAder, contribuicao: pesoControle * PESO_FASE.F2E2 }
    resultado.contribuicao += pesoControle * PESO_FASE.F2E2
    resultado.faseAtual = 'F3'

    // ── F3: Revisão dos Controles (seção 8 - só efetivos da F2-E2) ──
    const r3 = controle.r3
    if (!r3 || r3 === 'Teste Não Realizado') {
      resultado.detalheFases.F3 = { resultado: null, contribuicao: 0 }
      return resultado
    }
    if (isReprovado(r3)) {
      // REGRESSÃO a partir da F3
      resultado.regrediu = true
      resultado.contribuicao = 0
      resultado.detalheFases.F2E1 = { ...resultado.detalheFases.F2E1, contribuicao: 0 }
      resultado.detalheFases.F2E2 = { ...resultado.detalheFases.F2E2, contribuicao: 0 }
      resultado.detalheFases.F3 = { resultado: r3, contribuicao: 0 }
      resultado.faseAtual = 'F2-E1 (regressão)'
      return resultado
    }
    // Efetivo na F3
    resultado.detalheFases.F3 = { resultado: r3, contribuicao: pesoControle * PESO_FASE.F3 }
    resultado.contribuicao += pesoControle * PESO_FASE.F3
    resultado.faseAtual = 'F4'
  }

  // ── F4-C1: Auditoria Contínua Ciclo 1 (seção 8) ──
  const rF4C1 = controle.r_f4c1
  if (rF4C1 && rF4C1 !== 'Teste Não Realizado' && rF4C1 !== 'N/A') {
    if (isReprovado(rF4C1)) {
      resultado.regrediu = true
      resultado.contribuicao = 0
      // Zera todas as fases F2+
      Object.keys(resultado.detalheFases).forEach(f => {
        if (f !== 'F1') resultado.detalheFases[f].contribuicao = 0
      })
      resultado.detalheFases.F4C1 = { resultado: rF4C1, contribuicao: 0 }
      resultado.faseAtual = 'F2-E1 (regressão)'
      return resultado
    }
    if (isEfetivo(rF4C1)) {
      resultado.detalheFases.F4C1 = { resultado: rF4C1, contribuicao: pesoControle * PESO_FASE.F4C1 }
      resultado.contribuicao += pesoControle * PESO_FASE.F4C1
      resultado.faseAtual = 'F4-C2'
    }
  } else if (rF4C1 !== 'N/A') {
    // Controle não selecionado para C1 ou aguardando teste
    resultado.detalheFases.F4C1 = { resultado: rF4C1 || null, contribuicao: 0 }
    // Se não foi selecionado (N/A), pode ir direto pro C2
    if (!rF4C1) return resultado
  }

  // Se resultado é N/A em F4-C1, controle não está nesse ciclo — pode estar no C2
  if (rF4C1 === 'N/A') {
    resultado.detalheFases.F4C1 = { resultado: 'N/A', contribuicao: 0 }
  }

  // ── F4-C2: Auditoria Contínua Ciclo 2 (seção 8) ──
  const rF4C2 = controle.r_f4c2
  if (rF4C2 && rF4C2 !== 'Teste Não Realizado' && rF4C2 !== 'N/A') {
    if (isReprovado(rF4C2)) {
      resultado.regrediu = true
      resultado.contribuicao = 0
      Object.keys(resultado.detalheFases).forEach(f => {
        if (f !== 'F1') resultado.detalheFases[f].contribuicao = 0
      })
      resultado.detalheFases.F4C2 = { resultado: rF4C2, contribuicao: 0 }
      resultado.faseAtual = 'F2-E1 (regressão)'
      return resultado
    }
    if (isEfetivo(rF4C2)) {
      resultado.detalheFases.F4C2 = { resultado: rF4C2, contribuicao: pesoControle * PESO_FASE.F4C2 }
      resultado.contribuicao += pesoControle * PESO_FASE.F4C2
      resultado.faseAtual = 'F5'
    }
  } else {
    resultado.detalheFases.F4C2 = { resultado: rF4C2 || null, contribuicao: 0 }
    if (rF4C2 === 'N/A') {
      resultado.detalheFases.F4C2 = { resultado: 'N/A', contribuicao: 0 }
    }
  }

  // ── F5: Auditoria Independente ──
  const rF5 = controle.r_f5
  if (rF5 && rF5 !== 'Teste Não Realizado' && rF5 !== 'N/A') {
    if (isReprovado(rF5)) {
      resultado.regrediu = true
      resultado.contribuicao = 0
      Object.keys(resultado.detalheFases).forEach(f => {
        if (f !== 'F1') resultado.detalheFases[f].contribuicao = 0
      })
      resultado.detalheFases.F5 = { resultado: rF5, contribuicao: 0 }
      resultado.faseAtual = 'F2-E1 (regressão)'
      return resultado
    }
    if (isEfetivo(rF5)) {
      resultado.detalheFases.F5 = { resultado: rF5, contribuicao: pesoControle * PESO_FASE.F5 }
      resultado.contribuicao += pesoControle * PESO_FASE.F5
      resultado.faseAtual = 'Completo'
    }
  } else {
    resultado.detalheFases.F5 = { resultado: rF5 || null, contribuicao: 0 }
  }

  return resultado
}
