import { useState, useEffect } from 'react'
import { buscarHistorico } from '../lib/auditLog'
import { formatCampo, formatValor, isManutencaoSistema, nomeUsuario } from '../lib/campoLabels'

function formatAcao(acao) {
  const map = { UPDATE: 'Alteração', INSERT: 'Criação', DELETE: 'Exclusão', WORKFLOW: 'Ação', LOGIN: 'Login', LOGOUT: 'Logout', REGRESSAO: 'Regressão' }
  return map[acao] || acao
}

function acaoIcon(acao) {
  const map = { UPDATE: '✏️', INSERT: '➕', DELETE: '🗑️', WORKFLOW: '⚙️', LOGIN: '🔑', LOGOUT: '🚪', REGRESSAO: '↩️' }
  return map[acao] || '📋'
}

function formatData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Alteração 'vazia': campo que mudou de nada para nada (ruído de salvamento, sem informação).
function vazio(v) { return v == null || String(v).trim() === '' }
function isAlteracaoVazia(log) { return log.acao === 'UPDATE' && !!log.campo && vazio(log.valor_anterior) && vazio(log.valor_novo) }

const S = {
  wrap: { padding: '16px 0' },
  loading: { textAlign: 'center', padding: 32, color: 'var(--txt3)', fontSize: 13 },
  empty: { textAlign: 'center', padding: 32, color: 'var(--txt3)', fontSize: 13 },
  timeline: { position: 'relative', paddingLeft: 24 },
  line: {
    position: 'absolute', left: 8, top: 0, bottom: 0, width: 2,
    background: 'var(--brd)', borderRadius: 1,
  },
  item: {
    position: 'relative', marginBottom: 16, paddingBottom: 16,
    borderBottom: '1px solid rgba(0,0,0,0.04)',
  },
  dot: {
    position: 'absolute', left: -20, top: 4, width: 14, height: 14,
    borderRadius: '50%', background: 'var(--card-bg, #fff)',
    border: '2px solid var(--copper)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 8,
    zIndex: 1,
  },
  dotSis: { border: '2px solid var(--txt3)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 4,
    fontSize: 10, fontWeight: 600, background: 'rgba(204,145,94,0.12)', color: '#CC915E',
  },
  badgeSis: { background: 'rgba(120,130,140,0.14)', color: 'var(--txt3)' },
  user: { fontSize: 12, fontWeight: 600, color: 'var(--txt1)' },
  userSis: { fontSize: 12, fontWeight: 500, color: 'var(--txt3)', fontStyle: 'italic' },
  date: { fontSize: 11, color: 'var(--txt3)', marginLeft: 'auto' },
  campo: { fontSize: 12, color: 'var(--txt2)', marginBottom: 4 },
  valores: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, flexWrap: 'wrap' },
  old: {
    background: 'rgba(244,67,54,0.06)', color: '#D32F2F', padding: '2px 6px',
    borderRadius: 4, textDecoration: 'line-through',
  },
  arrow: { color: 'var(--txt3)', fontSize: 10 },
  novo: {
    background: 'rgba(76,175,80,0.08)', color: '#388E3C', padding: '2px 6px',
    borderRadius: 4, fontWeight: 500,
  },
  detalhe: { fontSize: 11, color: 'var(--txt3)', marginTop: 4, fontStyle: 'italic' },
  toggle: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
    background: 'none', border: '1px solid var(--brd)', borderRadius: 6,
    padding: '5px 12px', fontSize: 11, color: 'var(--txt3)', cursor: 'pointer',
    fontFamily: 'inherit',
  },
}

export default function HistoricoTab({ registroId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarCompleto, setMostrarCompleto] = useState(false)

  useEffect(() => {
    if (!registroId) return
    setLoading(true)
    setMostrarCompleto(false)
    buscarHistorico(registroId).then(data => {
      setLogs(data)
      setLoading(false)
    })
  }, [registroId])

  if (loading) return <div style={S.loading}>Carregando histórico...</div>
  if (logs.length === 0) return <div style={S.empty}>Nenhuma alteração registrada para este controle</div>

  const ehRuido = (l) => isManutencaoSistema(l) || isAlteracaoVazia(l)
  const ruidoCount = logs.filter(ehRuido).length
  const visiveis = mostrarCompleto ? logs : logs.filter(l => !ehRuido(l))

  return (
    <div style={S.wrap}>
      {visiveis.length === 0 ? (
        <div style={S.empty}>Nenhuma movimentação de usuário registrada</div>
      ) : (
        <div style={S.timeline}>
          <div style={S.line} />
          {visiveis.map(log => {
            const sis = isManutencaoSistema(log)
            return (
              <div key={log.id} style={S.item}>
                <div style={{ ...S.dot, ...(sis ? S.dotSis : {}) }}>{acaoIcon(log.acao)}</div>
                <div style={S.header}>
                  <span style={{ ...S.badge, ...(sis ? S.badgeSis : {}) }}>{formatAcao(log.acao)}</span>
                  <span style={sis ? S.userSis : S.user}>{nomeUsuario(log)}</span>
                  <span style={S.date}>{formatData(log.criado_em)}</span>
                </div>
                {log.campo && (
                  <div style={S.campo}>{formatCampo(log.campo)}</div>
                )}
                {(log.valor_anterior || log.valor_novo) && (
                  <div style={S.valores}>
                    {log.valor_anterior && <span style={S.old}>{formatValor(log.campo, log.valor_anterior)}</span>}
                    {log.valor_anterior && log.valor_novo && <span style={S.arrow}>→</span>}
                    {log.valor_novo && <span style={S.novo}>{formatValor(log.campo, log.valor_novo)}</span>}
                  </div>
                )}
                {log.detalhes?.descricao && (
                  <div style={S.detalhe}>{log.detalhes.descricao}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {ruidoCount > 0 && (
        <button style={S.toggle} onClick={() => setMostrarCompleto(v => !v)}>
          {mostrarCompleto
            ? '▴ Ocultar registros técnicos'
            : `▾ Ver log completo (+${ruidoCount} registro${ruidoCount > 1 ? 's' : ''} técnico${ruidoCount > 1 ? 's' : ''}/de sistema)`}
        </button>
      )}
    </div>
  )
}
