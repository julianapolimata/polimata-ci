import { useState } from 'react'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { papelLabel } from './_shared'
import { MODULOS } from '../../lib/modulos'

// ══════════════════════════════════════════════════════════════════════════════
// SELETOR DE PROJETOS (tela pós-login)
// ══════════════════════════════════════════════════════════════════════════════

export default function ProjectSelector({ projetos, resumos, perfil, onSelect, signOut, onAdmin, onHub }) {
  const nome = perfil?.nome?.split(' ')[0] || ''
  const [busca, setBusca] = useState('')
  const q = busca.trim().toLowerCase()
  const filtrados = q
    ? projetos.filter(p => {
        const cli = formatNomeEmpresa(p.clientes?.nome_fantasia || p.clientes?.nome) || ''
        return (p.nome || '').toLowerCase().includes(q) || cli.toLowerCase().includes(q)
      })
    : projetos
  return (
    <div style={{ height: '100vh', background: 'linear-gradient(145deg, #00112C 0%, #00203E 60%, #1D3B5C 100%)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Accent radial sutil — eco do login */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '60%', height: '140%', background: 'radial-gradient(ellipse at center, rgba(204,145,94,0.10) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(ellipse at center, rgba(91,143,249,0.06) 0%, transparent 55%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', position: 'relative', zIndex: 1 }}>

      <div style={{ width: '100%', maxWidth: 880, margin: 'auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logotipo-2cores.png" alt="Polímata GRC" style={{ height: 46, marginBottom: 14, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 21, fontWeight: 200, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif", letterSpacing: '.5px', margin: '0 0 6px' }}>
            Selecione um projeto
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(247,243,238,0.55)', margin: 0 }}>
            {nome ? `Bem-vindo(a), ${nome}` : 'Bem-vindo(a) ao Polímata GRC'}
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: 420, margin: '0 auto 18px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--copper-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente ou projeto..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 38px', background: 'rgba(0,32,62,0.55)', border: '1px solid rgba(204,145,94,0.22)', borderRadius: 10, color: 'var(--cream)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12, alignItems: 'start' }}>
          {filtrados.length === 0 && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(247,243,238,0.5)', fontSize: 13, padding: '20px 0' }}>Nenhum projeto encontrado.</div>}
          {filtrados.map(p => {
            const r = resumos[p.id] || {}
            const clienteNome = formatNomeEmpresa(p.clientes?.nome_fantasia || p.clientes?.nome) || '—'
            const isMap = p.produto === 'mapeamento'
            const prodCor = (MODULOS.find(mm => mm.id === (p.produto || 'ci')) || {}).cor || 'var(--copper)'
            const isAtivo = p.ativo !== false
            const mat = r.maturidade
            const isDiagP = r.isDiag === true
            const matColor = mat ? (mat.nivel === 'N5' ? '#22D4A0' : mat.nivel === 'N4' ? '#5B8FF9' : mat.nivel === 'N3' ? '#D4A030' : mat.nivel === 'N2' ? '#F97316' : '#EF4444') : (isDiagP ? '#CC915E' : null)
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p)}
                style={{
                  background: 'rgba(0,32,62,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(204,145,94,0.18)', borderRadius: 12,
                  padding: '8px 20px', cursor: 'pointer', transition: 'all .2s ease',
                  opacity: isAtivo ? 1 : 0.55, position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(204,145,94,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,17,44,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(204,145,94,0.18)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Linha de cor do produto no topo */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${prodCor} 0%, transparent 100%)` }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Eyebrow: nome do projeto */}
                    <div style={{ fontSize: 9.5, color: 'var(--copper-soft)', textTransform: 'uppercase', letterSpacing: '1.6px', fontWeight: 600, marginBottom: 1 }}>{p.nome}</div>
                    {/* Título: nome do cliente */}
                    <div style={{ fontSize: 15, fontWeight: 300, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif", letterSpacing: '.3px', lineHeight: 1.15 }}>{clienteNome}</div>
                    {r.ultimaAtividade && <div style={{ fontSize: 10.5, color: 'rgba(247,243,238,0.45)', marginTop: 2 }}>Últ. atividade: {r.ultimaAtividade}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 600, letterSpacing: 0.3,
                      background: isAtivo ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                      color: isAtivo ? '#4ADE80' : 'var(--txt3)',
                      border: `1px solid ${isAtivo ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      {isAtivo ? 'Ativo' : 'Concluído'}
                    </span>
                    {mat && !isDiagP && (
                      <span style={{
                        fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3,
                        background: `${matColor}22`, color: matColor, border: `1px solid ${matColor}55`,
                      }} title={mat.nome}>
                        {mat.nivel}
                      </span>
                    )}
                    {isDiagP && (
                      <span style={{
                        fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3,
                        background: 'rgba(204,145,94,0.15)', color: 'var(--copper)', border: '1px solid rgba(204,145,94,0.4)',
                      }} title="Diagnóstico Apenas (sem teste de efetividade)">
                        Diagnóstico
                      </span>
                    )}
                    {isMap && (
                      <span style={{
                        fontSize: 10, padding: '3px 12px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3,
                        background: 'rgba(204,145,94,0.15)', color: 'var(--copper)', border: '1px solid rgba(204,145,94,0.4)',
                      }} title="Mapeamento de Processos">
                        Mapeamento
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 11, color: 'rgba(247,243,238,0.35)', marginBottom: 12 }}>
            {papelLabel(perfil?.papel)} — {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} disponíve{projetos.length !== 1 ? 'is' : 'l'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {onHub && (
              <button onClick={onHub} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(204,145,94,0.08)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 8,
                color: 'var(--copper)', fontSize: 11, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
                Hub de produtos
              </button>
            )}
            {onAdmin && (
              <button onClick={onAdmin} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(204,145,94,0.08)', border: '1px solid rgba(204,145,94,0.25)', borderRadius: 8,
                color: 'var(--copper)', fontSize: 11, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Administração
              </button>
            )}
            <button onClick={signOut} style={{ background: 'transparent', border: '1px solid var(--brd)', borderRadius: 8, color: 'var(--txt3)', fontSize: 11, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Sair
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
