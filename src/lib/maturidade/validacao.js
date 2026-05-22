// Validação contra exemplo de referência (Compras).
// Extraído em 22/mai/2026 (fatiamento Etapa 7).
import { calcularContribuicaoControle } from './contribuicao'
import { calcularPercentualArea } from './percentualArea'

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
