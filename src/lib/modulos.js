// ═══════════════════════════════════════════════════════════════════════════
// modulos.js — registro dos produtos/módulos do Sistema Polímata.
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
    ativo: true,
  },
  {
    id: 'mapeamento',
    nome: 'Mapeamento de Processos',
    descricao: 'Entrevista gravada → transcrição → POP, fluxograma BPMN e matriz de riscos COSO+ISO com RACI.',
    icone: '🎙',
    rota: '/mapeamentos',
    ativo: true,
  },
  {
    id: 'orcamento',
    nome: 'Orçamento',
    descricao: 'Planejamento e acompanhamento orçamentário.',
    icone: '💰',
    rota: null,
    ativo: false, // em desenvolvimento
  },
  {
    id: 'planejamento',
    nome: 'Planejamento Estratégico',
    descricao: 'Construção e monitoramento do plano estratégico.',
    icone: '🧭',
    rota: null,
    ativo: false, // em desenvolvimento
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
  return 'ci'
}
