import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { buscarAuditLogs } from '../../lib/auditLog'
import { formatCampo, formatValor, nomeUsuario, isManutencaoSistema } from '../../lib/campoLabels'

const TABELAS = [
  { value: '', label: 'Todas' },
  { value: 'mrc', label: 'MRC (Controles)' },
  { value: 'areas', label: 'Áreas' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'subprocessos', label: 'Subprocessos' },
  { value: 'auth', label: 'Autenticação' },
]

const ACOES = [
  { value: '', label: 'Todas' },
  { value: 'UPDATE', label: 'Alteração' },
  { value: 'INSERT', label: 'Criação' },
  { value: 'DELETE', label: 'Exclusão' },
  { value: 'WORKFLOW', label: 'Ação de workflow' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
]

function formatAcao(acao) {
  const map = { UPDATE: 'Alteração', INSERT: 'Criação', DELETE: 'Exclusão', WORKFLOW: 'Workflow', LOGIN: 'Login', LOGOUT: 'Logout' }
  return map[acao] || acao
}

function formatAcaoColor(acao) {
  const map = {
    UPDATE: { bg: 'rgba(204,145,94,0.12)', color: '#CC915E' },
    INSERT: { bg: 'rgba(76,175,80,0.12)', color: '#388E3C' },
    DELETE: { bg: 'rgba(244,67,54,0.12)', color: '#D32F2F' },
    WORKFLOW: { bg: 'rgba(0,32,62,0.10)', color: '#00203E' },
    LOGIN: { bg: 'rgba(76,175,80,0.08)', color: '#4CAF50' },
    LOGOUT: { bg: 'rgba(158,158,158,0.12)', color: '#757575' },
  }
  return map[acao] || { bg: '#f5f5f5', color: '#666' }
}

function formatData(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function truncate(str, max = 40) {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S = {
  wrap: { fontFamily: "'Montserrat', sans-serif" },
  filters: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: 500, color: 'var(--lt-text3)' },
  select: {
    padding: '7px 10px', fontSize: 12, border: '1px solid var(--lt-border)',
    borderRadius: 6, background: 'var(--lt-card, #fff)', color: 'var(--lt-text)',
    fontFamily: 'inherit', minWidth: 140,
  },
  input: {
    padding: '7px 10px', fontSize: 12, border: '1px solid var(--lt-border)',
    borderRadius: 6, background: 'var(--lt-card, #fff)', color: 'var(--lt-text)',
    fontFamily: 'inherit', minWidth: 200,
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 },
  th: {
    textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600,
    color: 'var(--lt-text3)', borderBottom: '2px solid var(--lt-border)',
    position: 'sticky', top: 0, background: 'var(--lt-card, #fff)', zIndex: 2,
  },
  td: {
    padding: '9px 12px', borderBottom: '1px solid var(--lt-border)',
    color: 'var(--lt-text)', verticalAlign: 'top',
  },
  badge: (bg, color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    fontSize: 10, fontWeight: 600, background: bg, color,
  }),
  empty: {
    textAlign: 'center', padding: 40, color: 'var(--lt-text3)', fontSize: 13,
  },
  pager: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, fontSize: 12, color: 'var(--lt-text3)',
  },
  pagerBtn: {
    padding: '6px 14px', fontSize: 12, border: '1px solid var(--lt-border)',
    borderRadius: 6, background: 'var(--lt-card, #fff)', color: 'var(--lt-text)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  tableWrap: { overflowX: 'auto', maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', borderRadius: 8, border: '1px solid var(--lt-border)' },
  loading: { textAlign: 'center', padding: 40, color: 'var(--lt-text3)', fontSize: 13 },
  countBadge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 10,
    fontSize: 11, fontWeight: 600, background: 'rgba(0,32,62,0.08)', color: 'var(--lt-text)',
    marginLeft: 8,
  },
}

const PER_PAGE = 50

export default function AuditLogConfig() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  // Filters
  const [filtroTabela, setFiltroTabela] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')

  // Projetos for filter
  const [projetos, setProjetos] = useState([])
  const [filtroProjeto, setFiltroProjeto] = useState('')

  useEffect(() => {
    supabase.from('projetos').select('id, nome').order('nome').then(({ data }) => {
      setProjetos(data || [])
    })
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(filtroBusca), 400)
    return () => clearTimeout(t)
  }, [filtroBusca])

  // Fetch logs
  useEffect(() => {
    setLoading(true)
    buscarAuditLogs({
      projetoId: filtroProjeto || null,
      tabela: filtroTabela || null,
      acao: filtroAcao || null,
      busca: buscaDebounced || null,
      limite: PER_PAGE,
      offset: page * PER_PAGE,
    }).then(({ logs: l, total: t }) => {
      setLogs(l)
      setTotal(t)
      setLoading(false)
    })
  }, [filtroTabela, filtroAcao, filtroProjeto, buscaDebounced, page])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [filtroTabela, filtroAcao, filtroProjeto, buscaDebounced])

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div style={S.wrap}>
      {/* Filters */}
      <div style={S.filters}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Projeto</span>
          <select style={S.select} value={filtroProjeto} onChange={e => setFiltroProjeto(e.target.value)}>
            <option value="">Todos</option>
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Tabela</span>
          <select style={S.select} value={filtroTabela} onChange={e => setFiltroTabela(e.target.value)}>
            {TABELAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Ação</span>
          <select style={S.select} value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}>
            {ACOES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Buscar</span>
          <input
            style={S.input}
            placeholder="Campo, valor ou usuário..."
            value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)}
          />
        </div>
        <span style={S.countBadge}>{total} registro{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Data/Hora</th>
              <th style={S.th}>Usuário</th>
              <th style={S.th}>Ação</th>
              <th style={S.th}>Tabela</th>
              <th style={S.th}>Campo</th>
              <th style={S.th}>Anterior</th>
              <th style={S.th}>Novo</th>
              <th style={S.th}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={S.loading}>Carregando...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} style={S.empty}>Nenhum registro de auditoria encontrado</td></tr>
            ) : logs.map(log => {
              const acaoStyle = formatAcaoColor(log.acao)
              return (
                <tr key={log.id} style={{ transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...S.td, whiteSpace: 'nowrap', fontSize: 11 }}>{formatData(log.criado_em)}</td>
                  <td style={{ ...S.td, fontWeight: 500, ...(isManutencaoSistema(log) ? { color: 'var(--lt-text3)', fontStyle: 'italic', fontWeight: 400 } : {}) }}>{nomeUsuario(log)}</td>
                  <td style={S.td}>
                    <span style={S.badge(acaoStyle.bg, acaoStyle.color)}>{formatAcao(log.acao)}</span>
                  </td>
                  <td style={{ ...S.td, fontSize: 11 }}>{log.tabela}</td>
                  <td style={S.td}>{formatCampo(log.campo) || '—'}</td>
                  <td style={{ ...S.td, fontSize: 11, color: 'var(--lt-text3)' }}>{truncate(formatValor(log.campo, log.valor_anterior))}</td>
                  <td style={{ ...S.td, fontSize: 11, fontWeight: 500 }}>{truncate(formatValor(log.campo, log.valor_novo))}</td>
                  <td style={{ ...S.td, fontSize: 11, color: 'var(--lt-text3)' }}>
                    {log.detalhes?.descricao ? truncate(log.detalhes.descricao, 50) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      {totalPages > 1 && (
        <div style={S.pager}>
          <button style={S.pagerBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            ← Anterior
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button style={S.pagerBtn} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
