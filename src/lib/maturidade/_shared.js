// Helpers e constantes compartilhadas do cálculo de maturidade.
// Extraído de calculoMaturidade.js em 22/mai/2026 (fatiamento Etapa 7).

// ─── ENGINE DE CÁLCULO — CI Polímata ────────────────────────────────────────
// Implementa METODOLOGIA_CALCULO.md v3 (validada 26/03/2026)
// Módulo puro — sem dependências React
// Constantes carregadas do banco via constantesLoader.js (com fallback local)

import { getConstantesSync } from '../constantesLoader'

// ─── CONSTANTES (fallback — fonte de verdade está no banco) ─────────────────

export const DEFAULTS_MULTIPLICADORES = { 4: 0.40, 3: 0.30, 2: 0.20, 1: 0.10 }
export const DEFAULTS_PESO_FASE = { F1: 0.10, F2E1: 0.125, F2E2: 0.125, F3: 0.25, F4C1: 0.15, F4C2: 0.15, F5: 0.10 }
export const DEFAULTS_REGUA = [
  { nivel: 'N1', nome: 'Não confiável',  min: 0,    max: 0.10  },
  { nivel: 'N2', nome: 'Informal',       min: 0.101, max: 0.25  },
  { nivel: 'N3', nome: 'Padronizado',    min: 0.251, max: 0.50  },
  { nivel: 'N4', nome: 'Monitorado',     min: 0.501, max: 0.80  },
  { nivel: 'N5', nome: 'Otimizado',      min: 0.801, max: 1.00  },
]

/** Retorna constantes do banco (cache) ou defaults locais */
export function getMultiplicadores() { return getConstantesSync().multiplicadores || DEFAULTS_MULTIPLICADORES }
export function getPesoFase() { return getConstantesSync().peso_fase || DEFAULTS_PESO_FASE }
export function getRegua() { return getConstantesSync().regua || DEFAULTS_REGUA }

// Alias para manter compatibilidade com exports existentes
export const PESO_FASE = DEFAULTS_PESO_FASE

// ─── NORMALIZAÇÃO DE PESOS POR NÚMERO DE FASES ─────────────────────────────

/** Mapa: num_fases → chaves de peso ativas */
export const FASES_POR_NUM = {
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
export function isEfetivo(resultado) {
  return resultado && resultado.toLowerCase() === 'efetivo'
}

/**
 * Verifica se um resultado indica reprovação (inefetivo ou GAP)
 */
export function isReprovado(resultado) {
  if (!resultado) return false
  const r = resultado.toLowerCase()
  return r === 'inefetivo' || r === 'gap'
}

/**
 * Verifica se o controle está ativo (não descontinuado)
 */
export function isAtivo(controle) {
  if (!controle.status_risco) return true
  return controle.status_risco.toLowerCase() !== 'descontinuado'
}

/**
 * Retorna o multiplicador de criticidade do controle.
 * Aceita criticidade numérica (1-4) ou textual.
 */
export function getMultiplicador(controle) {
  const crit = controle.crit ?? controle.criticidade
  const mult = getMultiplicadores()
  if (typeof crit === 'number') return mult[crit] || 0.10
  // Fallback para texto
  const map = { 'crítico': mult[4]||0.40, 'critico': mult[4]||0.40, 'significativo': mult[3]||0.30, 'moderado': mult[2]||0.20, 'baixo': mult[1]||0.10 }
  return map[(crit || '').toLowerCase()] || 0.10
}

