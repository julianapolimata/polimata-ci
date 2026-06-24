// ═══════════════════════════════════════════════════════════════════════════
// sugestao.js — Motor de Sugestão Orçamentária (M11)
// 6 métodos com peso visual IGUAL. Entrada: séries mensais do realizado.
// serieAnoAnterior / serieDoisAnosAtras: arrays[12] (índice 0 = janeiro), null se sem dado.
// Retorno: array[12] de valores sugeridos (números, 2 casas).
// ═══════════════════════════════════════════════════════════════════════════

export const METODOS = [
  { id: 'repeticao',    nome: 'Repetição',         desc: 'Repete mês a mês o realizado do ano anterior.', intraAno: false },
  { id: 'media_movel',  nome: 'Média móvel',        desc: 'Média dos últimos 3, 6 ou 12 meses com dado, aplicada a todos os meses.', intraAno: true },
  { id: 'tendencia',    nome: 'Tendência linear',   desc: 'Regressão linear sobre o histórico, projetada para 12 meses.', intraAno: true },
  { id: 'sazonalidade', nome: 'Sazonalidade',       desc: 'Média por mês dos últimos 2 anos, preservando o padrão sazonal.', intraAno: false },
  { id: 'indice',       nome: 'Inflação/índice',    desc: 'Ano anterior corrigido por um índice percentual (ex.: IPCA).', intraAno: false },
  { id: 'ia',           nome: 'IA Híbrida',         desc: 'Combinação ponderada de tendência e sazonalidade.', intraAno: false },
]

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100

function mesesComDado(serie) {
  return (serie || []).map((v, i) => ({ v, i })).filter(x => x.v !== null && x.v !== undefined)
}

export function sugerir(metodo, serieAnoAnterior, serieDoisAnosAtras, opts = {}) {
  const s1 = serieAnoAnterior || Array(12).fill(null)
  const s2 = serieDoisAnosAtras || Array(12).fill(null)
  switch (metodo) {
    case 'repeticao':
      return s1.map(v => r2(v || 0))
    case 'media_movel': {
      const janela = Number(opts.janela) || 3
      const dados = [...mesesComDado(s2), ...mesesComDado(s1)]
      const ult = dados.slice(-janela).map(x => x.v)
      const media = ult.length ? ult.reduce((a, b) => a + b, 0) / ult.length : 0
      return Array(12).fill(r2(media))
    }
    case 'tendencia': {
      // regressão linear sobre a série concatenada (até 24 pontos)
      const pontos = [...mesesComDado(s2).map(x => ({ x: x.i, y: x.v })), ...mesesComDado(s1).map(x => ({ x: x.i + 12, y: x.v }))]
      if (pontos.length < 2) return sugerir('repeticao', s1, s2)
      const n = pontos.length
      const sx = pontos.reduce((a, p) => a + p.x, 0), sy = pontos.reduce((a, p) => a + p.y, 0)
      const sxx = pontos.reduce((a, p) => a + p.x * p.x, 0), sxy = pontos.reduce((a, p) => a + p.x * p.y, 0)
      const den = n * sxx - sx * sx
      const b = den ? (n * sxy - sx * sy) / den : 0
      const a = (sy - b * sx) / n
      return Array.from({ length: 12 }, (_, m) => r2(Math.max(0, a + b * (m + 24))))
    }
    case 'sazonalidade':
      return Array.from({ length: 12 }, (_, m) => {
        const vals = [s1[m], s2[m]].filter(v => v !== null && v !== undefined)
        return r2(vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0)
      })
    case 'indice': {
      const fator = 1 + (Number(opts.percentual) || 0) / 100
      return s1.map(v => r2((v || 0) * fator))
    }
    case 'ia': {
      const t = sugerir('tendencia', s1, s2)
      const z = sugerir('sazonalidade', s1, s2)
      return Array.from({ length: 12 }, (_, m) => r2(0.5 * t[m] + 0.5 * z[m]))
    }
    default:
      return Array(12).fill(0)
  }
}

// ── Projeção intra-ano: completa os meses futuros do ANO CORRENTE a partir dos
// meses já realizados. serieAnoCorrente: array[12] (0=jan), null nos meses sem dado.
// projeta SOMENTE de mesInicio..11 (0-based). Default Jul–Dez = mesInicio 6.
// Métodos aplicáveis: media_movel, tendencia. Demais exigem ano anterior → retorna nulls.
export function sugerirIntraAno(metodo, serieAnoCorrente, opts = {}) {
  const s = serieAnoCorrente || Array(12).fill(null)
  const excl = opts.excluirMeses || [] // índices 0-based a ignorar da base (ex.: mês corrente em aberto)
  const dados = mesesComDado(s).filter(x => !excl.includes(x.i))
  const out = Array(12).fill(null)
  const mesInicio = Number.isInteger(opts.mesInicio) ? opts.mesInicio : 6 // Jul
  if (!dados.length) return out
  if (metodo === 'media_movel') {
    const janela = Number(opts.janela) || 3
    const ult = dados.slice(-janela).map(x => x.v)
    const media = ult.reduce((a, b) => a + b, 0) / ult.length
    for (let m = mesInicio; m < 12; m++) out[m] = r2(media)
    return out
  }
  if (metodo === 'tendencia') {
    const pontos = dados.map(x => ({ x: x.i, y: x.v }))
    if (pontos.length < 2) return sugerirIntraAno('media_movel', s, opts)
    const n = pontos.length
    const sx = pontos.reduce((a, p) => a + p.x, 0), sy = pontos.reduce((a, p) => a + p.y, 0)
    const sxx = pontos.reduce((a, p) => a + p.x * p.x, 0), sxy = pontos.reduce((a, p) => a + p.x * p.y, 0)
    const den = n * sxx - sx * sx
    const b = den ? (n * sxy - sx * sy) / den : 0
    const a = (sy - b * sx) / n
    for (let m = mesInicio; m < 12; m++) out[m] = r2(Math.max(0, a + b * m))
    return out
  }
  return out // métodos que exigem ano anterior não se aplicam intra-ano
}

export const fmtBRL = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
export const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
