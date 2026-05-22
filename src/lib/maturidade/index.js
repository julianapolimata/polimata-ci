// Entrypoint do módulo de maturidade.
// Extraído em 22/mai/2026 (fatiamento Etapa 7).
export {
  DEFAULTS_MULTIPLICADORES, DEFAULTS_PESO_FASE, DEFAULTS_REGUA,
  getMultiplicadores, getPesoFase, getRegua,
  isEfetivo, isReprovado, isAtivo, getMultiplicador,
  PESO_FASE, FASES_POR_NUM, getPesoFaseNormalizado,
} from './_shared'
export { calcularPesosControles, calcularContribuicaoControle } from './contribuicao'
export { calcularPercentualArea, calcularIndiceEmpresa } from './percentualArea'
export { getNivelMaturidade } from './nivelMaturidade'
export { validarExemploCompras } from './validacao'
export { getTipoEntrega, calcularDiagnosticoArea, calcularDiagnosticoProjeto } from './diagnostico'
