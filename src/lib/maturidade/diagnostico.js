// Cálculo de diagnóstico (projetos sem teste de efetividade).
// Extraído em 22/mai/2026 (fatiamento Etapa 7).


// ═══════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO (projetos com f1_tem_teste=false)
// ═══════════════════════════════════════════════════════════════════════════
// Para projetos que param em F1-E1 (Indagação), sem teste de efetividade.
// Em vez de régua N1-N5, calcula distribuição de existência × criticidade.

/**
 * Retorna o tipo de entrega do projeto.
 * @param {Object} projeto - objeto do projeto (deve ter f1_tem_teste)
 * @returns {'maturidade'|'diagnostico'}
 */
export function getTipoEntrega(projeto) {
  return projeto?.f1_tem_teste === false ? 'diagnostico' : 'maturidade'
}

/**
 * Calcula o diagnóstico de uma área (distribuição existência × criticidade).
 * Para projetos sem teste de efetividade.
 *
 * @param {Array} controlesArea - controles da área
 * @returns {Object} { total, existentes, parciais, inexistentes, sem_classificacao,
 *                     criticos, significativos, moderados, baixos, sem_avaliacao,
 *                     matriz }
 */
export function calcularDiagnosticoArea(controlesArea) {
  const ativos = (controlesArea || []).filter(c =>
    c.ativo !== false &&
    (c.status_risco || '').toLowerCase() !== 'descontinuado'
  )

  const dist = { Existente: 0, Parcial: 0, Inexistente: 0, sem: 0 }
  const crits = { 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 }
  const matriz = {}

  for (const c of ativos) {
    const ex = c.existencia || null
    if (ex === 'Existente') dist.Existente++
    else if (ex === 'Parcial') dist.Parcial++
    else if (ex === 'Inexistente') dist.Inexistente++
    else dist.sem++

    const crit = c.crit || 0
    crits[crit] = (crits[crit] || 0) + 1

    const key = `${ex || 'Sem classificação'}|${crit}`
    matriz[key] = (matriz[key] || 0) + 1
  }

  return {
    total: ativos.length,
    existentes: dist.Existente,
    parciais: dist.Parcial,
    inexistentes: dist.Inexistente,
    sem_classificacao: dist.sem,
    criticos: crits[4] || 0,
    significativos: crits[3] || 0,
    moderados: crits[2] || 0,
    baixos: crits[1] || 0,
    sem_avaliacao: crits[0] || 0,
    matriz,
  }
}

/**
 * Calcula o diagnóstico do projeto inteiro, com agregados por área.
 *
 * @param {Array} controles - todos os controles do projeto
 * @param {Array} areas - áreas do projeto (para detalhamento)
 * @returns {Object} totais do projeto + array areas[] com diagnóstico de cada
 */
export function calcularDiagnosticoProjeto(controles, areas = []) {
  const total = calcularDiagnosticoArea(controles)
  const porArea = areas.map(area => {
    const cs = (controles || []).filter(c => c.area_id === area.id)
    const diag = calcularDiagnosticoArea(cs)
    return {
      area_id: area.id,
      area_nome: area.nome,
      peso: area.peso,
      ...diag,
    }
  })
  return { ...total, areas: porArea }
}
