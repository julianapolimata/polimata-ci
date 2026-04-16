import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TIPO_CONFIG = {
  submissao: { icon: '📤', label: 'Submissão', color: '#3B82F6' },
  aprovacao: { icon: '✅', label: 'Aprovado', color: '#22C55E' },
  reprovacao: { icon: '↩', label: 'Reprovado', color: '#EF4444' },
  sistema: { icon: '🔔', label: 'Sistema', color: '#CC915E' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Agora'
  if (min < 60) return `Há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Há ${h}h`
  const d = Math.floor(h / 24)
  return `Há ${d}d`
}

const NotificacoesPanel = () => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)

  const naoLidas = notifs.filter(n => !n.lida).length

  useEffect(() => {
    if (user?.id) loadNotifs()

    // Polling a cada 30 segundos
    const interval = setInterval(() => {
      if (user?.id) loadNotifs()
    }, 30000)

    return () => clearInterval(interval)
  }, [user?.id])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function loadNotifs() {
    const { data } = await supabase
      .from('notificacoes')
      .select('*, de:perfis!de_id(nome)')
      .eq('para_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(50)
    setNotifs(data || [])
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.lida).map(n => n.id)
    if (ids.length === 0) return
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
  }

  async function markRead(id) {
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Botão sino */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          background: open ? 'rgba(204,145,94,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(204,145,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: 16 }}>🔔</span>
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#EF4444', color: '#fff',
            fontSize: 8, fontWeight: 700,
            padding: '1px 5px', borderRadius: 8,
            minWidth: 16, textAlign: 'center', lineHeight: '14px'
          }}>
            {naoLidas}
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 44,
          right: 0,
          width: 380,
          maxHeight: 'calc(100vh - 100px)',
          background: '#0A1628',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#F3EEE4' }}>🔔 Notificações</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(243,238,228,0.4)', cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
            {notifs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'rgba(243,238,228,0.3)', fontSize: 12 }}>
                Nenhuma notificação
              </div>
            ) : (
              notifs.map(n => {
                const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.sistema
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      transition: 'background .15s',
                      background: n.lida ? 'transparent' : 'rgba(204,145,94,0.04)',
                      borderLeft: n.lida ? 'none' : '3px solid #CC915E',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(243,238,228,0.7)', lineHeight: 1.5 }}>
                      {n.de?.nome && <strong style={{ color: '#F3EEE4', fontWeight: 600 }}>{n.de.nome} </strong>}
                      {n.mensagem}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(243,238,228,0.25)', marginTop: 4 }}>
                      {timeAgo(n.criado_em)}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{
              padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <button
                onClick={markAllRead}
                disabled={naoLidas === 0}
                style={{
                  fontSize: 10, color: naoLidas > 0 ? '#CC915E' : 'rgba(243,238,228,0.25)',
                  background: 'none', border: 'none', cursor: naoLidas > 0 ? 'pointer' : 'default',
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600
                }}
              >
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificacoesPanel
