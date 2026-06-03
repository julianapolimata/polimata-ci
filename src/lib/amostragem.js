// ─── Motor de cálculo de amostra (item 29) ──────────────────────────────────
// Base: "Metodologia de Amostragem Polímata" (COSO/SOX-PCAOB AS 2315/IIA/ISO 31000).
// Tabela 2 (frequência × natureza) + Tabela 3 (ajustes de risco) + período/universo.
// Tabela 4 (classificação de exceções) → decisão de regressão 2/2 vs 2/1.

const COBERTURA_MESES = 12 // janela de cobertura padrão da política

function norm(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Frequência → { key, ocorrenciasMes (≈ execuções/mês), baseManual (Tabela 2) }
export function classificarFrequencia(freq) {
  const f = norm(freq)
  if (/multipla|varias vezes|diaria|diario/.test(f)) return { key: 'diario', ocorrenciasMes: 21, baseManual: 25 }
  if (/semanal/.test(f)) return { key: 'semanal', ocorrenciasMes: 4.33, baseManual: 15 }
  if (/quinzenal/.test(f)) return { key: 'quinzenal', ocorrenciasMes: 2, baseManual: 10 }
  if (/mensal/.test(f)) return { key: 'mensal', ocorrenciasMes: 1, baseManual: 5 }
  if (/trimestral/.test(f)) return { key: 'trimestral', ocorrenciasMes: 1 / 3, baseManual: 3 }
  if (/semestral/.test(f)) return { key: 'semestral', ocorrenciasMes: 1 / 6, baseManual: 2 }
  if (/bienal/.test(f)) return { key: 'bienal', ocorrenciasMes: 1 / 24, baseManual: 1 }
  if (/anual/.test(f)) return { key: 'anual', ocorrenciasMes: 1 / 12, baseManual: 1 }
  if (/demanda/.test(f)) return { key: 'sob_demanda', ocorrenciasMes: null, baseManual: null }
  return null
}

export function classificarNatureza(car) {
  const c = norm(car)
  if (/semi/.test(c)) return 'hibrido'
  if (/automatico/.test(c)) return 'automatico'
  if (/manual/.test(c)) return 'manual'
  return 'manual'
}

function parseData(s) {
  if (!s) return null
  const str = s.toString().trim()
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function mesesEntre(d1, d2) { return (d2 - d1) / (1000 * 60 * 60 * 24 * 30.4375) }

// Última data de teste = a mais recente entre as datas de fase preenchidas
export function ultimaDataTeste(row) {
  const datas = [row?.dt_teste, row?.dt_f4c1, row?.dt_f4c2, row?.dt_f5].map(parseData).filter(Boolean)
  return datas.length ? new Date(Math.max(...datas.map(d => d.getTime()))) : null
}

// Cálculo principal da amostra.
// universoManual: usado para 'sob demanda' (nº real de ocorrências informado pelo consultor).
export function calcularAmostra(row, { hoje = new Date(), universoManual = null } = {}) {
  const freqInfo = classificarFrequencia(row?.freq)
  const natureza = classificarNatureza(row?.car)
  const r = {
    ok: false, motivo: '', natureza, freqKey: freqInfo?.key || null,
    periodoInicio: null, periodoFim: hoje, universo: null,
    amostraBase: null, ajustes: [], fatorAjuste: 1, amostraFinal: null,
    requerUniverseManual: false, itgc: false,
  }
  if (!row?.freq || !freqInfo) { r.motivo = 'Frequência não informada ou não reconhecida.'; return r }
  if (!row?.car) { r.motivo = 'Natureza (característica) não informada.'; return r }

  // Automático puro: 1–3 + ITGC
  if (natureza === 'automatico') {
    r.ok = true; r.amostraBase = 3; r.amostraFinal = 3; r.itgc = true
    r.motivo = 'Controle automático: 1–3 amostras de saída + avaliação dos ITGCs (acesso, mudanças, operação, backup).'
    return r
  }

  // Período: início = mais recente entre implementação, último teste e janela de cobertura
  const impl = parseData(row?.dt_implementacao)
  const ult = ultimaDataTeste(row)
  const janela = new Date(hoje.getTime() - COBERTURA_MESES * 30.4375 * 24 * 60 * 60 * 1000)
  const inicio = new Date(Math.max(...[impl, ult, janela].filter(Boolean).map(d => d.getTime())))
  r.periodoInicio = inicio
  const meses = Math.max(0, mesesEntre(inicio, hoje))

  // Universo
  let universo
  if (freqInfo.key === 'sob_demanda') {
    if (universoManual == null || universoManual === '') {
      r.requerUniverseManual = true
      r.motivo = 'Controle sob demanda: informe o nº real de ocorrências no período para calcular a amostra.'
      return r
    }
    universo = Math.max(0, Math.round(Number(universoManual)))
  } else {
    universo = Math.round(freqInfo.ocorrenciasMes * meses)
  }
  r.universo = universo

  // Base. Frequência fixa → Tabela 2. Sob demanda → CURVA POR POPULAÇÃO (padrão de mercado).
  let base
  if (freqInfo.key === 'sob_demanda') {
    if (universo <= 10) base = universo                                   // população pequena → testar 100%
    else if (universo <= 50) base = Math.max(Math.ceil(universo * 0.10), 5)
    else if (universo <= 250) base = Math.min(Math.max(Math.ceil(universo * 0.10), 5), 25)
    else base = 25                                                        // > 250 → 25 (expandir 25→40→60 por exceções)
    r.curvaPopulacao = true
  } else {
    base = freqInfo.baseManual
  }
  r.amostraBase = base

  // Ajustes de risco que o sistema deriva (Tabela 3)
  let fator = 1; const ajustes = []
  const chave = norm(row?.chave)
  if (/chave/.test(chave)) { fator += 0.5; ajustes.push('+50% controle chave') }
  else if (/compensat/.test(chave)) { fator -= 0.15; ajustes.push('−15% controle compensatório') }
  if (impl && mesesEntre(impl, hoje) < 12) { fator += 0.25; ajustes.push('+25% controle novo (<1 ano)') }
  r.ajustes = ajustes; r.fatorAjuste = fator

  // Amostra final = base ajustada, limitada ao universo
  const ajustada = Math.ceil(base * fator)
  let final = Math.min(ajustada, universo)
  if (universo >= 1 && final < 1) final = 1
  r.amostraFinal = final; r.ok = true
  if (universo === 0) r.motivo = 'Nenhuma ocorrência no período (controle não executou desde a implementação/último teste). Aguardar próxima execução.'
  return r
}

// Decisão de regressão (item 29) — REGRA COMBINADA, aderente a amostras pequenas:
//   0 desvios → sem deficiência;
//   1 exceção → 2/2 (investigar causa-raiz / reforçar aderência) — Tabela 4;
//   2+ exceções: taxa ≤ taxaTolerada → 2/2; taxa > taxaTolerada → 2/1 (desenho);
//   padrão sistêmico → sempre 2/1.
//   (override do destino pelo gerente, com justificativa, fica por fora.)
export function decidirRegressao(nErros, nAmostra, { taxaTolerada = 0.05, sistemico = false } = {}) {
  const n = Number(nErros) || 0
  const tam = Number(nAmostra) || 0
  if (n <= 0) return { destino: null, classe: 'sem_deficiencia', taxa: 0, rotulo: 'Sem deficiência identificada' }
  const taxa = tam > 0 ? n / tam : 1
  const pct = (taxa * 100).toFixed(1); const lim = (taxaTolerada * 100).toFixed(0)
  if (sistemico) return { destino: '2/1', classe: 'desenho', taxa, rotulo: 'Padrão sistêmico → problema de desenho (volta à Fase 2/1)' }
  if (n === 1) return { destino: '2/2', classe: 'aderencia', taxa, rotulo: `1 exceção (1/${tam}) → investigar causa-raiz / reforçar aderência (volta à Fase 2/2)` }
  if (taxa <= taxaTolerada) return { destino: '2/2', classe: 'aderencia', taxa, rotulo: `${n}/${tam} = ${pct}% (≤ ${lim}%) → reforçar aderência (volta à Fase 2/2)` }
  return { destino: '2/1', classe: 'desenho', taxa, rotulo: `${n}/${tam} = ${pct}% (> ${lim}%) → problema de desenho (volta à Fase 2/1)` }
}

// ─── Textos do pop-up de classificação de causa-raiz (item 29) ──────────────
export const CETICISMO_PROFISSIONAL =
  'O ceticismo profissional é uma postura de mente questionadora e avaliação crítica. Significa não aceitar informações de forma cega ou presumir que tudo está correto. O profissional adota um estado de alerta para inconsistências, erros ou fraudes, buscando evidências sólidas antes de formar uma conclusão. (Fonte: Conselho Federal de Contabilidade — CFC.)'

// Opções da lista suspensa (causa-raiz → fase de retorno)
export const FASE_DESTINO_LABEL = {
  '2/1': 'Fase 2-E1 — Plano de Ação + Teste de Desenho (TOD)',
  '2/2': 'Fase 2-E2 — Teste de Efetividade (TOE)',
}

export const CAUSAS_RAIZ = [
  { valor: 'desenho', rotulo: 'Falha de desenho do controle', destino: '2/1' },
  { valor: 'aderencia', rotulo: 'Falha de execução/aderência (erro humano)', destino: '2/2' },
]

// Sugestão do sistema (com base na taxa de desvio). NÃO decide — apenas orienta.
export function recomendacaoCausa(nErros, nAmostra, { taxaTolerada = 0.05 } = {}) {
  const n = Number(nErros) || 0
  const tam = Number(nAmostra) || 0
  if (n <= 0) return { sugestao: null, destino: null, texto: 'Nenhuma falha na amostra — controle efetivo nesta fase.' }
  const taxa = tam > 0 ? n / tam : 1
  const pct = (taxa * 100).toFixed(1); const lim = (taxaTolerada * 100).toFixed(0)
  if (taxa > taxaTolerada) {
    return { sugestao: 'desenho', destino: '2/1', taxa,
      texto: `Resultado da amostra: ${n} falha(s) em ${tam} itens (${pct}%). Nossa metodologia entende que um índice de falha acima de ${lim}% tende a indicar que a causa-raiz está no desenho atual do controle. Recomendação: retorno à Fase 2-E1 — Plano de Ação + Teste de Desenho (TOD).` }
  }
  return { sugestao: 'aderencia', destino: '2/2', taxa,
    texto: `Resultado da amostra: ${n} falha(s) em ${tam} itens (${pct}%). Um índice dentro da faixa de desvio isolado (≤ ${lim}%) tende a indicar falha de execução/aderência (erro humano), não de desenho. Recomendação: retorno à Fase 2-E2 — Teste de Efetividade (TOE).` }
}
