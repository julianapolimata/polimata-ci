// Fonte única da matriz de calor por tamanho (4x4 ou 5x5).
// Criticidade = PRODUTO Impacto × Probabilidade, dividido em 4 faixas.
// Decisão Juliana 16/jun/2026: ambos os tamanhos por produto.

// Faixas de criticidade (nível 1-4) — cores vivas (criticidade_config).
export const CRIT_CORES = { 1: '#22C55E', 2: '#EAB308', 3: '#F97316', 4: '#EF4444' }
export const CRIT_NOMES = { 1: 'Baixo', 2: 'Moderado', 3: 'Significativo', 4: 'Crítico' }

// Rótulos do MAIOR para o MENOR (índice 0 = topo da matriz / maior valor).
const CFG = {
  4: {
    imps:  ['Crítico', 'Alto', 'Moderado', 'Baixo'],
    probs: ['Extrema', 'Alta', 'Média', 'Baixa'],
    // produto 1..16
    faixa: (s) => (s <= 3 ? 1 : s <= 6 ? 2 : s <= 11 ? 3 : 4),
  },
  5: {
    imps:  ['Muito alto', 'Alto', 'Moderado', 'Baixo', 'Muito baixo'],
    probs: ['Muito alta', 'Alta', 'Média', 'Baixa', 'Muito baixa'],
    // produto 1..25
    faixa: (s) => (s <= 4 ? 1 : s <= 9 ? 2 : s <= 14 ? 3 : 4),
  },
}

export function matrizSize(projetoOuTamanho) {
  const t = typeof projetoOuTamanho === 'object' && projetoOuTamanho
    ? projetoOuTamanho.matriz_tamanho
    : projetoOuTamanho
  return t === 5 ? 5 : 4
}

export function getMatriz(size) { return CFG[matrizSize(size)] }

export function imps(size) { return getMatriz(size).imps }
export function probs(size) { return getMatriz(size).probs }

// índice da linha/coluna (0 = topo/maior). Aceita tamanho explícito (default 4).
export function impToIdx(label, size = 4) {
  const i = getMatriz(size).imps.indexOf(label || '')
  return i < 0 ? -1 : i
}
export function probToIdx(label, size = 4) {
  const i = getMatriz(size).probs.indexOf(label || '')
  return i < 0 ? -1 : i
}

// valor numérico (1 = menor; N = maior). idx 0 (topo) → N.
export function impValor(label, size) {
  const arr = getMatriz(size).imps; const i = arr.indexOf(label || '')
  return i < 0 ? null : arr.length - i
}
export function probValor(label, size) {
  const arr = getMatriz(size).probs; const i = arr.indexOf(label || '')
  return i < 0 ? null : arr.length - i
}

// label <-> número (1..N). número maior = mais grave.
export function impLabelFromNum(n, size) {
  const arr = getMatriz(size).imps; const idx = arr.length - Number(n)
  return arr[idx] ?? null
}
export function probLabelFromNum(n, size) {
  const arr = getMatriz(size).probs; const idx = arr.length - Number(n)
  return arr[idx] ?? null
}

export function faixaFromScore(score, size) { return getMatriz(size).faixa(score) }

// criticidade (nível 1-4) por produto, a partir dos rótulos.
export function critNivel(impLabel, probLabel, size) {
  const iv = impValor(impLabel, size), pv = probValor(probLabel, size)
  if (!iv || !pv) return null
  return getMatriz(size).faixa(iv * pv)
}
// criticidade por números (1..N)
export function critNivelByNum(impNum, probNum, size) {
  const iv = Number(impNum), pv = Number(probNum)
  if (!iv || !pv) return null
  return getMatriz(size).faixa(iv * pv)
}

export function critCor(nivel) { return CRIT_CORES[nivel] || '#ccc' }
export function critNome(nivel) { return CRIT_NOMES[nivel] || '' }

// grade de cores [ri][ci] (ri/ci 0 = maior).
export function coresMatriz(size) {
  const cfg = getMatriz(size)
  return cfg.imps.map(imp => cfg.probs.map(prob => critCor(critNivel(imp, prob, size))))
}
