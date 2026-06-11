import { formatNomeEmpresa } from '../../lib/formatNome'
import { papelLabel } from './_shared'
import { MODULOS } from '../../lib/modulos'

// ══════════════════════════════════════════════════════════════════════════════
// SELETOR DE PROJETOS (tela pós-login)
// ══════════════════════════════════════════════════════════════════════════════

export default function ProjectSelector({ projetos, resumos, perfil, onSelect, signOut, onAdmin }) {
  const nome = perfil?.nome?.split(' ')[0] || ''
  return (
    <div style={{ height: '100vh', background: 'linear-gradient(145deg, #00112C 0%, #00203E 60%, #1D3B5C 100%)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Accent radial sutil — eco do login */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '60%', height: '140%', background: 'radial-gradient(ellipse at center, rgba(204,145,94,0.10) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-30%', left: '-10%', width: '50%', height: '100%', background: 'radial-gradient(ellipse at center, rgba(91,143,249,0.06) 0%, transparent 55%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', position: 'relative', zIndex: 1 }}>

      <div style={{ width: '100%', maxWidth: 720, margin: 'auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logotipo-2cores.png" alt="Polímata GRC" style={{ height: 46, marginBottom: 14, objectFit: 'contain' }} />
          <h1 style={{ fontSize: 21, fontWeight: 200, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif", letterSpacing: '.5px', margin: '0 0 6px' }}>
            Selecione um projeto
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(247,243,238,0.55)', margin: 0 }}>
            {nome ? `Bem-vindo(a), ${nome}` : 'Bem-vindo(a) ao Polímata GRC'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projetos.map(p => {
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
                  padding: '6px 18px', cursor: 'pointer', transition: 'all .2s ease',
                  opacity: isAtivo ? 1 : 0.55, position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(204,145,94,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,17,44,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(204,145,94,0.18)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Linha de cor do produto no topo */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${prodCor} 0%, transparent 100%)` }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 300, color: 'var(--cream)', fontFamily: "'Raleway', sans-serif", letterSpacing: '.3px' }}>{clienteNome}</span>
                    <span style={{ fontSize: 9, color: 'var(--copper-soft)', textTransform: 'uppercase', letterSpacing: '1.4px', fontWeight: 600 }}>{p.nome}</span>
                  </div>
                  {r.ultimaAtividade && <span style={{ fontSize: 10, color: 'rgba(247,243,238,0.4)', flexShrink: 0, whiteSpace: 'nowrap' }}>{r.ultimaAtividade}</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 9.5, padding: '2px 10px', borderRadius: 999, fontWeight: 600, letterSpacing: 0.3, background: isAtivo ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)', color: isAtivo ? '#4ADE80' : 'var(--txt3)', border: `1px solid ${isAtivo ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}` }}>{isAtivo ? 'Ativo' : 'Concluído'}</span>
                    {mat && !isDiagP && <span style={{ fontSize: 9.5, padding: '2px 10px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3, background: `${matColor}22`, color: matColor, border: `1px solid ${matColor}55` }} title={mat.nome}>{mat.nivel}</span>}
                    {isDiagP && <span style={{ fontSize: 9.5, padding: '2px 10px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3, background: 'rgba(204,145,94,0.15)', color: 'var(--copper)', border: '1px solid rgba(204,145,94,0.4)' }} title="Diagnóstico Apenas (sem teste de efetividade)">Diagnóstico</span>}
                    {isMap && <span style={{ fontSize: 9.5, padding: '2px 10px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3, background: 'rgba(204,145,94,0.15)', color: 'var(--copper)', border: '1px solid rgba(204,145,94,0.4)' }} title="Mapeamento de Processos">Mapeamento</span>}
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
