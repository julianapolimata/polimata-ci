// PorAreaTabela — bloco JSX extraído de PorArea.jsx em 22/mai/2026 (fatiamento Etapa 6).
// Diff-zero: cópia direta do parent. Recebe state e helpers via prop `ctx`.
import React from 'react'

export default function PorAreaTabela({ ctx }) {
  const { FASE_HDR, FASE_KEYS_VISIVEIS, FASE_W_PARA, PA, PA_DATA_COLS, RegressaoBadge, Td, badgeCrit, badgeR, canEdit, cf, cfSorted, faseThS, getAlertas, getStatusBadge, idxFases, isAdmin, isCliente, isDiagnostico, projeto, renderFaseCell, setAtualizarRow, setModalRow, setRowRegistrarResultado, setRowRevisar, sortArrow, tableScrollRef, tdS, toggleSort } = ctx
  return (
    <>
      {/* TABELA MRC */}
      <div style={PA.tabelaWrap}>
        <div ref={tableScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {PA_DATA_COLS.map((col, i) =>
                <th key={i} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 12px', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, width: col.w, minWidth: col.w, borderBottom: '1px solid var(--lt-border)', borderRight: '1px solid var(--lt-border)', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(col.k)}>{col.h}{sortArrow(col.k)}</th>)}
              {FASE_HDR.map((f, i) => { const w = FASE_W_PARA(idxFases[i]); return (<th key={`f${i}`} style={{ ...faseThS, width: w, minWidth: w, maxWidth: w, background: f.bg, borderRight: '1px solid rgba(255,255,255,0.28)', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(FASE_KEYS_VISIVEIS[i])}>{f.h}{sortArrow(FASE_KEYS_VISIVEIS[i])}</th>) })}
              {!isCliente && <th style={{ fontSize: 11, fontWeight: 600, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 12px', position: 'sticky', top: 0, zIndex: 2, width: 120, minWidth: 120, borderBottom: '1px solid var(--lt-border)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Ação</th>}
            </tr></thead>
            <tbody>{cfSorted.map((c, i) => (
              <tr key={c.id||i} onClick={() => setModalRow(c)} style={{ cursor: 'pointer', ...((c.status_risco === 'evitado' || c.status_risco === 'transferido') ? { opacity: 0.55, fontStyle: 'italic' } : {}) }} onMouseEnter={e => e.currentTarget.style.background='rgba(204,145,94,0.04)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ ...tdS, width: 95, minWidth: 95, fontSize: 11, color: 'var(--lt-text3)', textAlign: 'center' }}>{fmtDate(c.dt_ult || c.atualizado_em || c.criado_em)}</td>
                <Td w={120}>{c.sub}</Td>
                <td style={{ ...tdS, color: 'var(--copper-text)', fontWeight: 700, width: 80, minWidth: 80, textAlign: 'center' }}>{c.rr}</td><Td w={200}>{c.dr}</Td>
                <td style={{ ...tdS, color: 'var(--copper-text)', fontWeight: 700, width: 90, minWidth: 90, textAlign: 'center' }}>{c.rc}</td><Td w={200}>{c.dc}</Td>
                <td style={{ ...tdS, width: 90, minWidth: 90, textAlign: 'center' }}>{badgeR(getResultadoVitrine(c, projeto))}</td>
                <td style={{ ...tdS, width: 110, minWidth: 110, textAlign: 'center' }}>{badgeCrit(c.crit)}</td>
                <td style={{ ...tdS, width: 130, minWidth: 130, fontSize: 11, fontWeight: 500, textAlign: 'center' }}>{getFaseLabel(c)}{c.num_regressoes > 0 && <RegressaoBadge n={c.num_regressoes} />}</td>
                <td style={{ ...tdS, width: 110, minWidth: 110, textAlign: 'center' }}>{(() => { const st = getStatusComputado(c); const cfg = getStatusBadge(st); return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{cfg.label}</span> })()}</td>
                {/* Colunas de fase */}
                {idxFases.map(idx => { const w = FASE_W_PARA(idx); return (<td key={`fc${idx}`} style={{ ...tdS, width: w, minWidth: w, maxWidth: w, textAlign: 'center' }}>{renderFaseCell(c, idx)}</td>) })}
                {!isCliente && <td style={{ ...tdS, textAlign: 'center', width: 120, minWidth: 120 }}>
                    {(() => {
                      const st = getStatusComputado(c)
                      // Define UMA ação primária por contexto (a "próxima ação" do workflow)
                      let primary = null, secondary = null
                      // Em projeto diagnóstico (sem teste de efetividade), workflow simplificado:
                      // sempre permite editar o controle (existência, criticidade, etc.)
                      if (isDiagnostico && canEdit) {
                        primary = { label: '✏ Editar', color: 'var(--copper-text)', bg: 'rgba(204,145,94,0.12)', border: 'rgba(204,145,94,0.30)', onClick: () => setAtualizarRow(c) }
                      } else if (canEdit && st === 'rascunho') {
                        primary = { label: '▶ Continuar', color: '#92400E', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.40)', onClick: () => setAtualizarRow(c) }
                      } else if (canEdit && st === 'em_analise') {
                        primary = { label: 'Registrar Resultado', color: '#15803D', bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.35)', onClick: () => setRowRegistrarResultado(c) }
                        secondary = { label: '✏ Editar premissas', onClick: () => setAtualizarRow(c) }
                      } else if (isAdmin && st === 'em_revisao') {
                        primary = { label: 'Revisar', color: '#1D4ED8', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', onClick: () => setRowRevisar(c) }
                      } else if (canEdit && (st === 'nao_iniciado' || st === 'teste_pendente' || st === 'reprovado')) {
                        primary = { label: 'Atualizar', color: 'var(--copper-text)', bg: 'rgba(204,145,94,0.12)', border: 'rgba(204,145,94,0.30)', onClick: () => setAtualizarRow(c) }
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          {primary && <button onClick={e => { e.stopPropagation(); primary.onClick() }} style={{ background: primary.bg, border: `1px solid ${primary.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: primary.color, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>{primary.label}</button>}
                          {secondary && <button onClick={e => { e.stopPropagation(); secondary.onClick() }} style={{ background: 'transparent', border: 'none', padding: '2px 4px', fontSize: 10, fontWeight: 500, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{secondary.label}</button>}
                          {getAlertas(c).filter(a => a.label !== 'Resultado Pendente' || !primary).map((a, idx) => {
                            const baseStyle = { fontSize: 10, fontWeight: 700, color: a.color, background: a.bg, padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', lineHeight: 1.2 }
                            if (a.onClick) {
                              return <button key={idx} onClick={e => { e.stopPropagation(); a.onClick() }} style={{ ...baseStyle, border: `1px solid ${a.color}33`, cursor: 'pointer', fontFamily: 'inherit' }} title="Clique para abrir">{a.label}</button>
                            }
                            return <span key={idx} style={baseStyle}>{a.label}</span>
                          })}
                        </div>
                      )
                    })()}
                </td>}
              </tr>))}{cf.length === 0 && <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center', color: 'var(--lt-text3)' }}>Nenhum controle encontrado.</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}
