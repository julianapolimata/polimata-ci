// ════════════════════════════════════════════════════════════════════════
// formatNomeEmpresa
//
// Title Case "inteligente" para nomes de empresa em português brasileiro:
// - Primeira letra de cada palavra em maiúscula
// - Preposições/artigos (de, da, do, e, em, ...) em minúsculas
//   (exceto se forem a primeira palavra)
// - Siglas jurídicas (LTDA, EIRELI, EPP, ME, MEI, SA, S/A, ...) em CAIXA ALTA
//
// Aplicada APENAS no display. Não muda o dado no banco — fonte da verdade
// é o cadastro do Sistema Gerencial.
//
// Exemplos:
//   "BRASCABOS"
//     → "Brascabos"
//   "BRASCABOS COMPONENTES ELETRICOS E ELETRONICOS LTDA"
//     → "Brascabos Componentes Eletricos e Eletronicos LTDA"
//   "PLANCUS DESENVOLVIMENTO INDÚSTRIA E COMÉRCIO DE MÓVEIS EIRELI"
//     → "Plancus Desenvolvimento Indústria e Comércio de Móveis EIRELI"
//   "TERRA CONTTEMPORANEA MOVEIS LTDA - EPP"
//     → "Terra Conttemporanea Moveis LTDA - EPP"
//   "Tramar"
//     → "Tramar"
// ════════════════════════════════════════════════════════════════════════

const PALAVRAS_MINUSCULAS = new Set([
  'de', 'da', 'do', 'das', 'dos',
  'e', 'em',
  'a', 'o', 'as', 'os',
  'para', 'por', 'pelo', 'pela', 'pelos', 'pelas',
  'na', 'no', 'nas', 'nos',
])

const SIGLAS_MAIUSCULAS = new Set([
  'LTDA', 'LTDA.', 'LTDA-EPP', 'LTDA-ME',
  'EIRELI',
  'EPP', 'ME', 'MEI',
  'SA', 'S/A', 'S.A', 'S.A.', 'SAS',
  'CIA', 'CIA.',
  'SC', 'SS',
  'EI',
])

function capitalizar(w) {
  if (!w) return w
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}

function formatToken(token, isFirst) {
  if (!token) return token
  if (!/[a-záéíóúâêîôûãõçàèìòùA-Z]/i.test(token)) return token

  const upper = token.toUpperCase()
  if (SIGLAS_MAIUSCULAS.has(upper)) return upper

  if (token.includes('-')) {
    return token
      .split('-')
      .map((p, i) => formatToken(p, isFirst && i === 0))
      .join('-')
  }
  if (token.includes('/')) {
    return token
      .split('/')
      .map((p, i) => formatToken(p, isFirst && i === 0))
      .join('/')
  }

  const lower = token.toLowerCase()
  if (!isFirst && PALAVRAS_MINUSCULAS.has(lower)) return lower
  return capitalizar(token)
}

export function formatNomeEmpresa(s) {
  if (!s) return s
  const text = String(s).trim().replace(/\s+/g, ' ')
  if (!text) return text
  return text
    .split(' ')
    .map((tok, i) => formatToken(tok, i === 0))
    .join(' ')
}

export default formatNomeEmpresa
