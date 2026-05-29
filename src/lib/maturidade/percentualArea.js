// Percentual de maturidade da área e índice consolidado da empresa.
// Extraído em 22/mai/2026 (fatiamento Etapa 7).
import { calcularPesosControles, calcularContribuicaoControle } from './contribuicao'
import { getNivelMaturidade } from './nivelMaturidade'
import { getPesoFaseNormalizado, isEfetivo } from './_shared'

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

  // F1 é fixa quando diagnóstico concluído (normalizada conforme num_fases)
  const PF = getPesoFaseNormalizado(options.numFases || 5)
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
