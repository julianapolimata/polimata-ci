// ─── ENGINE DE CÁLCULO — CI Polímata ────────────────────────────────────────
// Implementa METODOLOGIA_CALCULO.md v3 (validada 26/03/2026)
// Módulo puro — sem dependências React
// Constantes carregadas do banco via constantesLoader.js (com fallback local)

import { getConstantesSync } from './constantesLoader'

// ─── CONSTANTES (fallback — fonte de verdade está no banco) ─────────────────

const DEFAULTS_MULTIPLICADORES = { 4: 0.40, 3: 0.30, 2: 0.20, 1: 0.10 }
const DEFAULTS_PESO_FASE = { F1: 0.10, F2E1: 0.125, F2E2: 0.125, F3: 0.25, F4C1: 0.15, F4C2: 0.15, F5: 0.10 }
const DEFAULTS_REGUA = [
  { nivel: 'N1', nome: 'Não confiável',  min: 0,    max: 0.10  },
  { nivel: 'N2', nome: 'Informal',       min: 0.101, max: 0.25  },
  { nivel: 'N3', nome: 'Padronizado',    min: 0.251, max: 0.50  },
  { nivel: 'N4', nome: 'Monitorado',     min: 0.501, max: 0.80  },
  { nivel: 'N5', nome: 'Otimizado',      min: 0.801, max: 1.00  },
]

/** Retorna constantes do banco (cache) ou defaults locais */
function getMultiplicadores() { return getConstantesSync().multiplicadores || DEFAULTS_MULTIPLICADORES }
function getPesoFase() { return getConstantesSync().peso_fase || DEFAULTS_PESO_FASE }
function getRegua() { return getConstantesSync().regua || DEFAULTS_REGUA }

// Alias para manter compatibilidade com exports existentes
export const PESO_FASE = DEFAULTS_PESO_FASE

// ─── NORMALIZAÇÃO DE PESOS POR NÚMERO DE FASES ─────────────────────────────

/** Mapa: num_fases → chaves de peso ativas */
const FASES_POR_NUM = {
  1: ['F1'],
  2: ['F1', 'F2E1', 'F2E2'],
  3: ['F1', 'F2E1', 'F2E2', 'F3'],
  4: ['F1', 'F2E1', 'F2E2', 'F3', 'F4C1', 'F4C2'],
  5: ['F1', 'F2E1', 'F2E2', 'F3', 'F4C1', 'F4C2', 'F5'],
}

/**
 * Retorna pesos normalizados para somar 100% dado o número de fases do projeto.
 * Fases inativas recebem peso 0. Fases ativas são proporcionalmente reescaladas.
 *
 * @param {number} numFases - 1 a 5 (default 5 = sem mudança)
 * @returns {Object} pesos normalizados { F1, F2E1, F2E2, F3, F4C1, F4C2, F5 }
 */
export function getPesoFaseNormalizado(numFases = 5) {
  const base = getPesoFase()
  const chaves = FASES_POR_NUM[numFases] || FASES_POR_NUM[5]

  // Soma dos pesos das fases ativas
  const somaAtivas = chaves.reduce((s, k) => s + (base[k] || 0), 0)
  if (somaAtivas === 0) return base // fallback safety

  // Normalizar: cada fase ativa = (peso original / soma) para que o total dê 1.0
  const resultado = {}
  for (const k of Object.keys(base)) {
    resultado[k] = chaves.includes(k) ? (base[k] / somaAtivas) : 0
  }
  return resultado
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Verifica se um resultado é "efetivo"
 */
function isEfetivo(resultado) {
  return resultado && resultado.toLowerCase() === 'efetivo'
}

/**
 * Verifica se um resultado indica reprovação (inefetivo ou GAP)
 */
function isReprovado(resultado) {
  if (!resultado) return false
  const r = resultado.toLowerCase()
  return r === 'inefetivo' || r === 'gap'
}

/**
 * Verifica se o controle está ativo (não descontinuado)
 */
function isAtivo(controle) {
  if (!controle.status_risco) return true
  return controle.status_risco.toLowerCase() !== 'descontinuado'
}

/**
 * Retorna o multiplicador de criticidade do controle.
 * Aceita criticidade numérica (1-4) ou textual.
 */
function getMultiplicador(controle) {
  const crit = controle.crit ?? controle.criticidade
  const mult = getMultiplicadores()
  if (typeof crit === 'number') return mult[crit] || 0.10
  // Fallback para texto
  const map = { 'crítico': mult[4]||0.40, 'critico': mult[4]||0.40, 'significativo': mult[3]||0.30, 'moderado': mult[2]||0.20, 'baixo': mult[1]||0.10 }
  return map[(crit || '').toLowerCase()] || 0.10
}

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
 *   st_pa       - status plano de ação F2-E1 (Concluído/etc)
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
  const { requireAprovado = false } = options
  const PESO_FASE = getPesoFase()

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
    // F2-E1 é "concluído" quando o PA está concluído e/ou há resultado efetivo
    const f2e1Concluido = (stPa && stPa.toLowerCase() === 'concluído') || isEfetivo(r2e1)

    if (!f2e1Concluido) {
      resultado.detalheFases.F2E1 = { resultado: stPa || null, contribuicao: 0 }
      return resultado
    }

    // F2-E1 efetivo (PA concluído)
    resultado.detalheFases.F2E1 = { resultado: 'Efetivo', contribuicao: pesoControle * PESO_FASE.F2E1 }
    resultado.contribuicao += pesoControle * PESO_FASE.F2E1
    resultado.faseAtual = 'F2-E2'

    // ── F2-E2: Teste de Aderência ──
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

// ─── PERCENTUAL DA ÁREA (seção 5) ───────────────────────────────────────────

/**
 * Calcula o percentual de maturidade de uma área.
 * 
 * percentual_area = 10% (F1 fixa) + Σ (contribuições dos controles)
 * 
 * @param {Array} controlesArea - todos os controles da área (inclui descontinuados)
 * @param {boolean} f1Concluida - se o diagnóstico F1 da área está concluído
 * @param {Object} options - { requireAprovado: boolean }
 * @returns {Object} { percentual, nivel, nome, detalhePorControle, totais }
 */
export function calcularPercentualArea(controlesArea, f1Concluida = true, options = {}) {
  // Filtrar ativos
  const comPesos = calcularPesosControles(controlesArea)

  if (comPesos.length === 0) {
    return {
      percentual: 0,
      nivel: 'N1',
      nome: 'Não confiável',
      detalhePorControle: [],
      totais: { ativos: 0, efetivos: 0, inefetivos: 0, gap: 0, regredidos: 0 },
    }
  }

  // F1 é fixa: 10% quando diagnóstico concluído (seção 2)
  const PF = getPesoFase()
  const baseF1 = f1Concluida ? PF.F1 : 0

  // Calcular contribuição de cada controle
  const detalhePorControle = comPesos.map(({ controle, multiplicador, pesoControle }) => {
    const contrib = calcularContribuicaoControle(controle, pesoControle, options)
    return {
      id: controle.id,
      ref: controle.rc || controle.ref_controle,
      criticidade: controle.crit ?? controle.criticidade,
      multiplicador,
      pesoControle,
      ...contrib,
    }
  })

  // Somar contribuições F2+
  const somaContribuicoes = detalhePorControle.reduce((sum, d) => sum + d.contribuicao, 0)

  // Percentual total da área
  const percentual = baseF1 + somaContribuicoes

  // Régua
  const { nivel, nome } = getNivelMaturidade(percentual)

  // Totais para KPIs
  const totais = {
    ativos: comPesos.length,
    efetivos: detalhePorControle.filter(d => {
      const r1 = d.controle?.r1 || comPesos.find(p => p.controle.id === d.id)?.controle?.r1
      return isEfetivo(r1)
    }).length,
    inefetivos: detalhePorControle.filter(d => {
      const c = comPesos.find(p => p.controle.id === d.id)?.controle
      return c && c.r1 && c.r1.toLowerCase() === 'inefetivo'
    }).length,
    gap: detalhePorControle.filter(d => {
      const c = comPesos.find(p => p.controle.id === d.id)?.controle
      return c && c.r1 && c.r1.toLowerCase() === 'gap'
    }).length,
    regredidos: detalhePorControle.filter(d => d.regrediu).length,
  }

  return { percentual, nivel, nome, detalhePorControle, totais }
}

// ─── NÍVEL DE MATURIDADE (seção 9) ──────────────────────────────────────────

/**
 * Retorna nível e nome com base no percentual.
 * @param {number} percentual - 0 a 1 (ex: 0.3778 = 37,78%)
 * @returns {Object} { nivel, nome }
 */
export function getNivelMaturidade(percentual) {
  const regua = getRegua()
  // Tratar edge case
  if (percentual <= 0) return { nivel: regua[0]?.nivel || 'N1', nome: regua[0]?.nome || 'Não confiável' }
  if (percentual > 1) {
    const ultimo = regua[regua.length - 1]
    return { nivel: ultimo?.nivel || 'N5', nome: ultimo?.nome || 'Otimizado' }
  }

  // Percorrer régua do banco
  for (const faixa of regua) {
    if (percentual <= faixa.max) {
      return { nivel: faixa.nivel, nome: faixa.nome }
    }
  }
  // Fallback
  const ultimo = regua[regua.length - 1]
  return { nivel: ultimo?.nivel || 'N5', nome: ultimo?.nome || 'Otimizado' }
}

// ─── ÍNDICE CONSOLIDADO DA EMPRESA (seção 10) ───────────────────────────────

/**
 * Calcula o índice consolidado = média ponderada dos percentuais das áreas.
 * 
 * @param {Array} areas - [{ nome, peso, percentual }] onde peso é 0-1 (ex: 0.15 = 15%)
 * @returns {Object} { indice, nivel, nome, detalhePorArea }
 */
export function calcularIndiceEmpresa(areas) {
  if (!areas || areas.length === 0) {
    return { indice: 0, nivel: 'N1', nome: 'Não confiável', detalhePorArea: [] }
  }

  const somaPesos = areas.reduce((sum, a) => sum + (a.peso || 0), 0)

  const indice = areas.reduce((sum, a) => {
    const pesoNormalizado = somaPesos > 0 ? (a.peso || 0) / somaPesos : 0
    return sum + (a.percentual || 0) * pesoNormalizado
  }, 0)

  const { nivel, nome } = getNivelMaturidade(indice)

  const detalhePorArea = areas.map(a => ({
    nome: a.nome,
    peso: a.peso,
    percentual: a.percentual,
    nivel: getNivelMaturidade(a.percentual || 0),
    contribuicao: (a.percentual || 0) * ((a.peso || 0) / (somaPesos || 1)),
  }))

  return { indice, nivel, nome, detalhePorArea }
}

// ─── VALIDAÇÃO — EXEMPLO COMPRAS (seção 11) ─────────────────────────────────

/**
 * Executa o teste de validação contra o exemplo documentado:
 * Área de Compras → 37,78% → N3 (Padronizado)
 * 
 * @returns {Object} { passou, esperado, calculado, detalhes }
 */
export function validarExemploCompras() {
  // Simular os 4 controles do exemplo (seção 11 da metodologia)
  const controlesCompras = [
    {
      id: 'test-1', rc: 'C.COM.01', crit: 4,  // Crítico
      r1: 'Efetivo',                             // Atalho → F2 auto
      r3: null,                                   // Aguarda F3
      status_risco: 'Existente',
    },
    {
      id: 'test-2', rc: 'C.COM.02', crit: 3,  // Significativo
      r1: 'Inefetivo',                           // Normal
      st_pa: 'Concluído',                        // F2-E1 efetivo
      r_ader: 'Efetivo',                         // F2-E2 efetivo
      r3: 'Efetivo',                             // F3 efetivo
      status_risco: 'Existente',
    },
    {
      id: 'test-3', rc: 'C.COM.03', crit: 1,  // Baixo
      r1: 'GAP',                                  // Normal
      st_pa: 'Concluído',                        // F2-E1 efetivo
      r_ader: 'GAP',                             // F2-E2 → REGRESSÃO
      status_risco: 'Existente',
    },
    {
      id: 'test-4', rc: 'C.COM.04', crit: 1,  // Baixo
      r1: 'Inefetivo',                           // Normal
      // Aguarda F2-E1 (sem st_pa)
      status_risco: 'Existente',
    },
  ]

  const resultado = calcularPercentualArea(controlesCompras, true)
  const percentualArredondado = Math.round(resultado.percentual * 10000) / 100 // 37.78

  const passou = Math.abs(percentualArredondado - 37.78) < 0.01 && resultado.nivel === 'N3'

  return {
    passou,
    esperado: { percentual: 37.78, nivel: 'N3', nome: 'Padronizado' },
    calculado: {
      percentual: percentualArredondado,
      nivel: resultado.nivel,
      nome: resultado.nome,
    },
    detalhes: resultado.detalhePorControle.map(d => ({
      ref: d.ref,
      pesoControle: `${(d.pesoControle * 100).toFixed(1)}%`,
      contribuicao: `${(d.contribuicao * 100).toFixed(2)}%`,
      faseAtual: d.faseAtual,
      regrediu: d.regrediu,
      atalhoF1: d.atalhoF1,
    })),
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export {
  isEfetivo,
  isReprovado,
  isAtivo,
  getMultiplicador,
  getMultiplicadores,
  getPesoFase,
  getRegua,
}
