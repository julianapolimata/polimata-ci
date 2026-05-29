// PorAreaFiltros — bloco JSX extraído de PorArea.jsx em 22/mai/2026 (fatiamento Etapa 6).
// Diff-zero: cópia direta do parent. Recebe state e helpers via prop `ctx`.
import React from 'react'

export default function PorAreaFiltros({ ctx }) {
  const { PA, busca, canEdit, cf, controles, crits, exportarSolicitacoesDaArea, ress, excelMenuAberto, excelMenuRef, expandirFiltros, exportarMRCExcel, fasesDisponiveis, filtAcao, filtCrit, filtFase, filtImp, filtRes, filtSit, filtStatus, gerarTemplateMRC, isCliente, isRealAdmin, nome, projeto, setBusca, setExcelMenuAberto, setExpandirFiltros, setFiltAcao, setFiltCrit, setFiltFase, setFiltImp, setFiltRes, setFiltSit, setFiltStatus, setModalNovoRisco, setSimularPerfil, simularPerfil } = ctx
  return (
    <>
      {/* FILTROS — duas linhas: essenciais (sempre) + drawer "Mais filtros" (colapsável) */}
      {(() => {
        const drawerFiltrosAtivos = (filtCrit ? 1 : 0) + (filtFase ? 1 : 0) + (filtRes ? 1 : 0) + (filtStatus ? 1 : 0) + (filtAcao ? 1 : 0)
        const drawerAberto = expandirFiltros || drawerFiltrosAtivos > 0
        const temAlgumFiltro = busca || filtCrit || filtImp || filtRes || filtFase || filtSit !== 'existente' || filtStatus || filtAcao
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginBottom: 6 }}>
            {/* Linha 1: busca + situação + toggle + contagem + limpar | toolbar de ações */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar risco, controle, inconsistência..." style={{ ...PA.filtroInput, flex: 1, minWidth: 220 }} />
              <select value={filtSit} onChange={e => setFiltSit(e.target.value)} style={PA.filtroSel}><option value="existente">Existentes</option><option value="evitado">Evitados</option><option value="transferido">Transferidos</option><option value="todos">Todos</option></select>
              <button onClick={() => setExpandirFiltros(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: drawerAberto ? 'rgba(204,145,94,0.10)' : 'var(--lt-card)', border: `1px solid ${drawerAberto ? 'rgba(204,145,94,0.35)' : 'var(--lt-border)'}`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 500, color: drawerAberto ? 'var(--copper-text)' : 'var(--lt-text2)', cursor: 'pointer', fontFamily: 'inherit' }} title="Mostrar/ocultar filtros adicionais">
                {drawerAberto ? '▾' : '▸'} Mais filtros
                {drawerFiltrosAtivos > 0 && <span style={{ background: 'var(--copper-text)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 9, fontWeight: 700, lineHeight: '14px', minWidth: 14, textAlign: 'center' }}>{drawerFiltrosAtivos}</span>}
              </button>
              <div style={{ fontSize: 11, color: 'var(--lt-text3)', background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '5px 12px', fontWeight: 500 }}>{cf.length} controles</div>
              {temAlgumFiltro && <button onClick={() => { setBusca(''); setFiltCrit(''); setFiltImp(''); setFiltRes(''); setFiltFase(''); setFiltSit('existente'); setFiltStatus(''); setFiltAcao('') }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✕ Limpar</button>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                {canEdit && <button onClick={() => setModalNovoRisco(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#00203E', border: '1px solid #00203E', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }} title="Criar novo risco"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo Risco</button>}
                <button onClick={() => gerarTemplateMRC()} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--copper-text)', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit' }} title="Baixar template MRC em branco"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Template</button>
                <div ref={excelMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                  <button onClick={() => setExcelMenuAberto(o => !o)} style={PA.btnExport} title="Exportar Excel da área">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                    Excel
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {excelMenuAberto && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--lt-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 220, zIndex: 100, overflow: 'hidden' }}>
                      <button
                        onClick={() => { setExcelMenuAberto(false); exportarMRCExcel(cf, `MRC_${nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}`, nome, formatNomeEmpresa(projeto?.clientes?.nome_fantasia || projeto?.clientes?.nome) || '', projeto?.nome || '') }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--lt-text)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--lt-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        MRC
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--lt-text3)', marginTop: 2 }}>Relatório executivo da área</div>
                      </button>
                      <div style={{ height: 1, background: 'var(--lt-border)' }} />
                      <button
                        onClick={() => { setExcelMenuAberto(false); exportarSolicitacoesDaArea() }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--lt-text)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--lt-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Lista de Solicitações
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--lt-text3)', marginTop: 2 }}>Solicitações dessa área (1 aba)</div>
                      </button>
                    </div>
                  )}
                </div>
                {isRealAdmin && (
                  <button onClick={() => setSimularPerfil(prev => prev ? null : 'gestor_cliente')} style={{ background: simularPerfil ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit' }} title="Simular visão do cliente">
                    {simularPerfil ? '← Voltar Admin' : 'Visão Cliente'}
                  </button>
                )}
              </div>
            </div>
            {/* Linha 2: drawer com filtros adicionais — visível quando aberto OU quando há filtros ativos */}
            {drawerAberto && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px', background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', marginRight: 4 }}>Filtros adicionais:</span>
                <select value={filtCrit} onChange={e => setFiltCrit(e.target.value)} style={PA.filtroSel}><option value="">Todas criticidades</option>{crits.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select value={filtFase} onChange={e => setFiltFase(e.target.value)} style={PA.filtroSel}><option value="">Todas as fases</option>{fasesDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}</select>
                <select value={filtRes} onChange={e => setFiltRes(e.target.value)} style={PA.filtroSel}><option value="">Todos resultados</option>{ress.map(c => <option key={c} value={c}>{c}</option>)}</select>
                {!isCliente && <select value={filtStatus} onChange={e => setFiltStatus(e.target.value)} style={{ ...PA.filtroSel, borderColor: 'var(--copper-text)' }} title="Filtro interno Polímata">
                  <option value="">Todos status</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="nao_iniciado">Não Iniciado</option>
                  <option value="em_analise">Em Análise</option>
                  <option value="teste_pendente">Teste Pendente</option>
                  <option value="em_revisao">Em Revisão</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Devolvido</option>
                </select>}
                {!isCliente && <select value={filtAcao} onChange={e => setFiltAcao(e.target.value)} style={{ ...PA.filtroSel, borderColor: 'var(--copper-text)' }} title="Filtro interno Polímata">
                  <option value="">Todas ações</option>
                  {PROXIMA_ACAO_OPCOES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>}
              </div>
            )}
          </div>
        )
      })()}
      {simularPerfil && (
        <div style={{ fontSize: 10, color: '#1D4ED8', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 6, padding: '4px 12px', marginBottom: 4, flexShrink: 0, textAlign: 'center', fontWeight: 500 }}>
          Simulando visão: Cliente
        </div>
      )}

    </>
  )
}
