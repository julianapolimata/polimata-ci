// Nomenclatura oficial das fases da metodologia Polímata.
// Extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
// F1 Diagnóstico → F2 Implementação → F3 Revisão Integral
//   → F4 Auditoria Contínua → F5 Auditoria Independente

export const FASES_LABEL = {
  1: 'Até Fase 1 - Diagnóstico Inicial',
  2: 'Até Fase 2 - TOD e TOE',
  3: 'Até Fase 3 - Revisão Integral',
  4: 'Até Fase 4 - Auditoria Contínua',
  5: 'Até Fase 5 - Auditoria Independente',
}
export const FASES_DETALHE = {
  1: 'Projeto vai até a Fase 1. Pode ter apenas indagação (sem teste) ou incluir teste de efetividade — selecione no campo ao lado.',
  2: 'Projeto vai até a Fase 2 — Teste de Desenho (TOD) e Teste de Efetividade (TOE).',
  3: 'Projeto vai até a Fase 3 — Revisão Integral dos controles que avançaram (Efetivos na F1 ou na F2).',
  4: 'Projeto vai até a Fase 4 — adiciona dois ciclos de Auditoria Contínua (C1 e C2).',
  5: 'Ciclo completo — Fase 5 fecha com a Auditoria Independente.',
}
