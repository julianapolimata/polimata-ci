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

  // Base (Tabela 2). Para sob demanda, deriva a frequência efetiva pelo universo/período.
  let base
  if (freqInfo.key === 'sob_demanda') {
    const porMes = meses > 0 ? universo / meses : universo
    const eq = classificarFrequencia(
      porMes >= 15 ? 'diario' : porMes >= 3 ? 'semanal' : porMes >= 1.5 ? 'quinzenal' : porMes >= 0.5 ? 'mensal' : porMes >= 0.2 ? 'trimestral' : 'anual'
    )
    base = eq.baseManual
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

// Decisão de regressão por TAXA DE DESVIO (taxa tolerável). Item 29.
// 0 desvios → sem deficiência; >0 e ≤ taxaTolerada → 2/2 (aderência);
// > taxaTolerada → 2/1 (desenho); padrão sistêmico → sempre 2/1.
export function decidirRegressao(nErros, nAmostra, { taxaTolerada = 0.05, sistemico = false } = {}) {
  const n = Number(nErros) || 0
  const tam = Number(nAmostra) || 0
  if (n <= 0) return { destino: null, classe: 'sem_deficiencia', taxa: 0, rotulo: 'Sem deficiência identificada' }
  const taxa = tam > 0 ? n / tam : 1
  const pct = (taxa * 100).toFixed(1)
  const lim = (taxaTolerada * 100).toFixed(0)
  if (sistemico) return { destino: '2/1', classe: 'desenho', taxa, rotulo: `Padrão sistêmico → problema de desenho (volta à Fase 2/1)` }
  if (taxa <= taxaTolerada) return { destino: '2/2', classe: 'aderencia', taxa, rotulo: `${n}/${tam} = ${pct}% (≤ ${lim}%) → reforçar aderência (volta à Fase 2/2)` }
  return { destino: '2/1', classe: 'desenho', taxa, rotulo: `${n}/${tam} = ${pct}% (> ${lim}%) → problema de desenho (volta à Fase 2/1)` }
}
