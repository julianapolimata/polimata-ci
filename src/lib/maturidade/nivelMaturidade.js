// Determina o nível N1-N5 a partir do percentual.
// Extraído em 22/mai/2026 (fatiamento Etapa 7).
import { getRegua } from './_shared'

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
