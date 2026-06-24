// ═══════════════════════════════════════════════════════════════════════════
// modulos.js — registro dos produtos/módulos do Polímata App.
// Para adicionar um novo produto: incluir aqui + criar as rotas/página.
// O acesso por usuário é controlado pela coluna perfis.modulos (text[]).
// ═══════════════════════════════════════════════════════════════════════════

export const MODULOS = [
  {
    id: 'ci',
    nome: 'Controles Internos',
    descricao: 'Matriz de riscos e controles, dashboards de maturidade, fases F1–F5, solicitações e relatórios.',
    icone: '🛡️',
    rota: '/ci',
    cor: 'var(--prod-ci)',
    ativo: true,
  },
  {
    id: 'mapeamento',
    nome: 'Mapeamento de Processos',
    descricao: 'Entrevista gravada → transcrição → POP, fluxograma BPMN e matriz de riscos COSO+ISO com RACI.',
    icone: '🎙',
    rota: '/mapeamentos',
    cor: 'var(--prod-mapeamento)',
    ativo: true,
  },
  {
    id: 'orcamento',
    nome: 'Gestão Orçamentária',
    descricao: 'Histórico, orçado, realizado e análise de desvios por categoria.',
    icone: '💰',
    rota: '/orcamento',
    cor: 'var(--prod-orcamento)',
    ativo: true,
  },
  {
    id: 'planejamento',
    nome: 'Planejamento Estratégico',
    descricao: 'Construção e monitoramento do plano estratégico.',
    icone: '🧭',
    rota: '/planejamento',
    cor: 'var(--prod-planejamento)',
    ativo: true,
  },
]

/** Módulos que o perfil pode acessar (admin vê todos os ativos). */
export function modulosDoPerfil(perfil) {
  if (!perfil) return []
  if (perfil.papel === 'admin_polimata') return MODULOS.filter(m => m.ativo)
  const habilitados = perfil.modulos || ['ci']
  return MODULOS.filter(m => m.ativo && habilitados.includes(m.id))
}

/** Identifica o módulo corrente a partir do pathname. */
export function moduloDaRota(pathname) {
  if (pathname === '/' || pathname === '') return 'hub'
  if (pathname.startsWith('/mapeamentos')) return 'mapeamento'
  if (pathname.startsWith('/orcamento')) return 'orcamento'
  if (pathname.startsWith('/planejamento')) return 'planejamento'
  return 'ci'
}
