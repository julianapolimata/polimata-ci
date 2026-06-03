import { useState, useEffect } from 'react'
import { buscarHistorico } from '../lib/auditLog'

const CAMPO_LABELS = {
  r1: 'F1 — Diagnóstico',
  st_pa: 'F2-E1 — Teste de Desenho',
  r_ader: 'F2-E2 — Efetividade',
  r3: 'F3 — Revisão Integral',
  r_f4c1: 'F4-C1',
  r_f4c2: 'F4-C2',
  r_f5: 'F5 — Auditoria Independente',
  status_workflow: 'Status workflow',
  status_risco: 'Situação do risco',
  controle: 'Nome do controle',
  risco: 'Descrição do risco',
  impacto: 'Impacto',
  probabilidade: 'Probabilidade',
  ficha_download: 'Download da ficha',
  atualizar_controle: 'Atualização',
}

function formatCampo(campo) {
  if (!campo) return ''
  return CAMPO_LABELS[campo] || campo.replace(/_/g, ' ')
}

function formatAcao(acao) {
  const map = { UPDATE: 'Alteração', INSERT: 'Criação', DELETE: 'Exclusão', WORKFLOW: 'Ação', LOGIN: 'Login', LOGOUT: 'Logout' }
  return map[acao] || acao
}

function acaoIcon(acao) {
  const map = { UPDATE: '✏️', INSERT: '➕', DELETE: '🗑️', WORKFLOW: '⚙️', LOGIN: '🔑', LOGOUT: '🚪' }
  return map[acao] || '📋'
}

function formatData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

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
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: {
    display: 'inline-block', padding: '1px 6px', borderRadius: 4,
    fontSize: 10, fontWeight: 600, background: 'rgba(204,145,94,0.12)', color: '#CC915E',
  },
  user: { fontSize: 12, fontWeight: 600, color: 'var(--txt1)' },
  date: { fontSize: 11, color: 'var(--txt3)', marginLeft: 'auto' },
  campo: { fontSize: 12, color: 'var(--txt2)', marginBottom: 4 },
  valores: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 },
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
}

export default function HistoricoTab({ registroId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!registroId) return
    setLoading(true)
    buscarHistorico(registroId).then(data => {
      setLogs(data)
      setLoading(false)
    })
  }, [registroId])

  if (loading) return <div style={S.loading}>Carregando histórico...</div>
  if (logs.length === 0) return <div style={S.empty}>Nenhuma alteração registrada para este controle</div>

  return (
    <div style={S.wrap}>
      <div style={S.timeline}>
        <div style={S.line} />
        {logs.map(log => (
          <div key={log.id} style={S.item}>
            <div style={S.dot}>{acaoIcon(log.acao)}</div>
            <div style={S.header}>
              <span style={S.badge}>{formatAcao(log.acao)}</span>
              <span style={S.user}>{log.usuario_nome || 'Sistema'}</span>
              <span style={S.date}>{formatData(log.criado_em)}</span>
            </div>
            {log.campo && (
              <div style={S.campo}>{formatCampo(log.campo)}</div>
            )}
            {(log.valor_anterior || log.valor_novo) && (
              <div style={S.valores}>
                {log.valor_anterior && <span style={S.old}>{log.valor_anterior}</span>}
                {log.valor_anterior && log.valor_novo && <span style={S.arrow}>→</span>}
                {log.valor_novo && <span style={S.novo}>{log.valor_novo}</span>}
              </div>
            )}
            {log.detalhes?.descricao && (
              <div style={S.detalhe}>{log.detalhes.descricao}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
