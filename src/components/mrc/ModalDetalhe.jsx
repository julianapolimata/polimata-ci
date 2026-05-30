import { useState } from 'react'
import { getCategoriaRecomendacao } from '../../lib/fases'
import {
  R1_MAP, IMP_MAP, PROB_MAP, HM_IMPS, HM_PROBS, HM_COLORS,
  badge, critBadge, badgeExistencia, getFaseInfo,
} from './badges'
import HistoricoControle from './HistoricoControle'

// ─── MODAL ───────────────────────────────────────────────────────────────────

export function ModalDetalhe({ row, projeto, onClose, onEditar, primaryAction, secondaryAction }) {
  const [tab, setTab] = useState('ident')
  if (!row) return null
  const isDiagModal = projeto?.f1_tem_teste === false
  const tabs = isDiagModal
    ? [{ id:'ident',label:'Identificação' },{ id:'f1',label:'Diagnóstico Inicial' },{ id:'historico',label:'Histórico' }]
    : [{ id:'ident',label:'Identificação' },{ id:'f1',label:'Diagnóstico Inicial' },{ id:'f2e1',label:'Teste de Desenho' },{ id:'f2e2',label:'Teste de Aderência' },{ id:'f3',label:'Revisão Controles Internos' },{ id:'f4c1',label:'Auditoria Contínua C1' },{ id:'f4c2',label:'Auditoria Contínua C2' },{ id:'f5',label:'Auditoria Independente' },{ id:'historico',label:'Histórico' }]
  const categoriaRec = getCategoriaRecomendacao(row, projeto)
  const corCategoria = ({
    'Implementar controle': '#EF4444',
    'Complementar / formalizar': '#FACC15',
    'Manter': '#22C55E',
  })[categoriaRec] || 'var(--copper)'
  const field = (l, v, fw) => { if (!v || v === 'N/A' || v === '') return null; return <div style={fw ? { marginBottom: 12 } : {}}><div className="ml">{l}</div><div className="mv">{v}</div></div> }
  const fieldTag = (l, v) => { if (!v || v === 'N/A' || v === '') return null; return <div><div className="ml">{l}</div><div style={{ marginTop: 3 }}><span className="tag">{v}</span></div></div> }
  const fieldText = (l, v) => { if (!v || v === 'N/A' || v === '') return null; return <div style={{ marginBottom: 14 }}>{l && <div className="ml">{l}</div>}<div className="mv-t">{v}</div></div> }
  const faseInfo = getFaseInfo(row)
  const impIdx = HM_IMPS.indexOf(row.imp); const probIdx = HM_PROBS.indexOf(row.prob)

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <div><div className="modal-ttl">{row.rc}{row.area ? ` · ${row.area}` : ''}</div><div className="modal-sub">{row.sub}</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {primaryAction && (
              <button onClick={primaryAction.onClick} title={primaryAction.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: primaryAction.bg || 'rgba(59,130,246,0.12)', border: `1px solid ${primaryAction.border || 'rgba(59,130,246,0.30)'}`, borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 700, color: primaryAction.color || '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit' }}>
                {primaryAction.label}
              </button>
            )}
            {secondaryAction && (
              <button onClick={secondaryAction.onClick} title={secondaryAction.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid rgba(204,145,94,0.30)', borderRadius: 999, padding: '6px 12px', fontSize: 11, fontWeight: 500, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {secondaryAction.label}
              </button>
            )}
            {!primaryAction && onEditar && (
              <button onClick={onEditar} title="Editar este controle" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(204,145,94,0.12)', border: '1px solid rgba(204,145,94,0.35)', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: 'var(--copper-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
            )}
            <button className="modal-cls" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-tabs">{tabs.map(t => (<div key={t.id} className={`mtab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</div>))}</div>
        <div className="modal-body">

          {tab === 'ident' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Identificação do Controle</div><div className="mr">{field('Ref. Risco', row.rr)}{field('Ref. Controle', row.rc)}</div><div className="mr">{field('Área', row.area)}{field('Subprocesso', row.sub)}</div><div className="mr">{field('Gerência', row.ger)}{field('Responsável Processo', row.resp_sub)}</div></div>
            <div className="ms"><div className="ms-t">Descrição do Risco</div>{fieldText(null, row.dr)}</div>
            <div className="ms"><div className="ms-t">Descrição do Controle</div>{fieldText(null, row.dc)}</div>
            <div className="ms"><div className="ms-t">Atributos do Controle</div><div className="mr3">{fieldTag('Categoria', row.cat)}{fieldTag('Frequência', row.freq)}{fieldTag('Natureza', row.nat)}</div><div className="mr3">{fieldTag('Característica', row.car)}{fieldTag('Sistema', row.sis)}{fieldTag('Controle Chave', row.chave)}</div>
              {!isDiagModal && (
                <div className="mr" style={{ marginTop: 12 }}>
                  <div><div className="ml">Fase Atual</div><div style={{ display:'flex',alignItems:'center',gap:8,marginTop:4 }}><span className="fp" style={{ borderLeft:`3px solid ${faseInfo.cor}`,color:faseInfo.cor }}>{faseInfo.label.split(' — ')[0]}</span><span className={`bd ${R1_MAP[faseInfo.resultado]||'b-na'}`}>{faseInfo.resultado}</span></div></div>
                  <div><div className="ml">Peso no Cálculo</div><div style={{ fontSize:22,fontWeight:300,fontFamily:"'Montserrat',sans-serif",marginTop:4 }}>{(({4:0.4,3:0.3,2:0.2,1:0.1}[row.crit]||0.1)/522*100).toFixed(3)}%</div></div>
                </div>
              )}
            </div>
            <div className="ms"><div className="ms-t">Posição no Mapa de Calor</div>
              <div style={{ display:'flex',gap:20,alignItems:'flex-start' }}>
                <div style={{ display:'grid',gridTemplateColumns:'60px repeat(4,1fr)',gap:3,maxWidth:260,flexShrink:0 }}>
                  {HM_IMPS.map((imp,ri) => (<div key={`row-${ri}`} style={{ display:'contents' }}><div style={{ fontSize:10,color:'var(--txt3)',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6 }}>{imp}</div>{HM_PROBS.map((prob,ci) => { const bg=HM_COLORS[ri][ci]; const isThis=ri===impIdx&&ci===probIdx; return (<div key={`${ri}-${ci}`} style={{ background:bg,borderRadius:4,aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',opacity:isThis?1:0.35,outline:isThis?'3px solid var(--gold)':'none',outlineOffset:-2 }}>{isThis&&<div style={{ width:10,height:10,borderRadius:'50%',background:'#fff',boxShadow:'0 0 6px rgba(0,0,0,.4)' }}/>}</div>) })}</div>))}
                  <div/>{HM_PROBS.map(p => <div key={p} style={{ fontSize:9,color:'var(--txt3)',textAlign:'center',paddingTop:2 }}>{p}</div>)}
                </div>
                <div style={{ flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:6 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,border:'1px solid var(--lt-border)',background:'var(--lt-bg)' }}>
                    <span className="ml" style={{ marginBottom:0,minWidth:80 }}>Impacto</span>
                    {row.imp ? <span className={`bd ${IMP_MAP[row.imp]||''}`}>{row.imp}</span> : <span style={{ color:'var(--txt3)',fontSize:11 }}>—</span>}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,border:'1px solid var(--lt-border)',background:'var(--lt-bg)' }}>
                    <span className="ml" style={{ marginBottom:0,minWidth:80 }}>Probabilidade</span>
                    {row.prob ? <span className={`bd ${PROB_MAP[row.prob]||''}`}>{row.prob}</span> : <span style={{ color:'var(--txt3)',fontSize:11 }}>—</span>}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:6,border:'1px solid var(--lt-border)',background:'var(--lt-bg)' }}>
                    <span className="ml" style={{ marginBottom:0,minWidth:80 }}>Criticidade</span>
                    {critBadge(row.crit) || <span style={{ color:'var(--txt3)',fontSize:11 }}>—</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>)}

          {tab === 'f1' && (<div className="tp active">
            {isDiagModal ? (
              <div className="ms"><div className="ms-t">Diagnóstico — Existência do Controle</div>
                <div className="mr3">
                  {field('Existência', row.existencia ? badgeExistencia(row.existencia) : null)}
                  {field('Impacto', row.imp ? badge(IMP_MAP[row.imp]||'', row.imp) : null)}
                  {field('Probabilidade', row.prob ? badge(PROB_MAP[row.prob]||'', row.prob) : null)}
                </div>
                <div className="mr">{field('Criticidade', critBadge(row.crit))}</div>
                {categoriaRec && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: `${corCategoria}15`, borderLeft: `3px solid ${corCategoria}`, borderRadius: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--lt-text3)', marginBottom: 2 }}>Ação Sugerida</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: corCategoria }}>{categoriaRec}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ms"><div className="ms-t">Resultado do Diagnóstico</div><div className="mr3">{field('Resultado Diagnóstico', row.r1 ? badge(R1_MAP[row.r1]||'b-na', row.r1) : null)}{field('Impacto', row.imp ? badge(IMP_MAP[row.imp]||'', row.imp) : null)}{field('Probabilidade', row.prob ? badge(PROB_MAP[row.prob]||'', row.prob) : null)}</div><div className="mr">{field('Criticidade', critBadge(row.crit))}</div></div>
            )}
            <div className="ms"><div className="ms-t">Cenário Atual</div>{row.cenario_atual && row.cenario_atual.trim() ? fieldText(null, row.cenario_atual) : <div style={{ fontSize: 12, color: '#C62828', fontStyle: 'italic', padding: '6px 10px', background: '#FFEBEE', borderLeft: '3px solid #C62828', borderRadius: 4 }}>— Não preenchido —</div>}</div>
            {row.passos_f1 && row.passos_f1 !== 'N/A' && <div className="ms"><div className="ms-t">Passos de Teste</div>{fieldText(null, row.passos_f1)}</div>}
            {row.incons && row.incons !== 'N/A' && <div className="ms"><div className="ms-t">Inconsistências Identificadas</div>{fieldText(null, row.incons)}</div>}
            {row.rec && row.rec !== 'N/A' && <div className="ms"><div className="ms-t">Recomendações</div>{fieldText(null, row.rec)}</div>}
          </div>)}

          {tab === 'f2e1' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Teste de Desenho</div><div className="mr3">{field('Demanda PA', row.dem_pa)}{field('Status PA', row.st_pa ? badge(R1_MAP[row.st_pa]||'b-na', row.st_pa) : null)}{field('Data Conclusão', row.dt_ult ? new Date(row.dt_ult).toLocaleDateString('pt-BR') : null)}</div>{field('Responsável PA', row.resp_pa, true)}{fieldText('Comentário PA', row.coment_pa)}</div>
            <div className="ms"><div className="ms-t">Controle Redesenhado</div>{fieldText('Novo Descritivo de Controle', row.dc_novo)}</div>
          </div>)}

          {tab === 'f2e2' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Resultado do Teste de Aderência</div><div className="mr">{field('Resultado', row.r_ader ? badge(R1_MAP[row.r_ader]||'b-na', row.r_ader) : null)}{row.dt_teste && field('Data Teste', new Date(row.dt_teste).toLocaleDateString('pt-BR'))}</div>{row.melhoria==='Sim'&&<div style={{marginBottom:8}}><span className="tag">Oportunidade de Melhoria</span></div>}{fieldText('Inconsistências', row.incons_ader)}{fieldText('Comentários', row.coment_ader)}</div>
          </div>)}

          {tab === 'f3' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Revisão dos Controles</div><div className="mr">{field('Status Revisão', row.st_f3 ? badge(R1_MAP[row.st_f3]||'b-na', row.st_f3) : null)}{field('Resultado Revisão', row.r3 ? badge(R1_MAP[row.r3]||'b-na', row.r3) : null)}</div>{fieldText('Inconsistências F3', row.incons_f3)}{fieldText('Recomendações F3', row.rec_f3)}</div>
          </div>)}

          {tab === 'f4c1' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Auditoria Contínua — Ciclo 1</div><div className="mr">{field('Resultado', row.r_f4c1 ? badge(R1_MAP[row.r_f4c1]||'b-na', row.r_f4c1) : null)}</div>{fieldText('Inconsistências', row.incons_f4c1)}{fieldText('Recomendações', row.rec_f4c1)}</div>
          </div>)}

          {tab === 'f4c2' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Auditoria Contínua — Ciclo 2</div><div className="mr">{field('Resultado', row.r_f4c2 ? badge(R1_MAP[row.r_f4c2]||'b-na', row.r_f4c2) : null)}</div>{fieldText('Inconsistências', row.incons_f4c2)}{fieldText('Recomendações', row.rec_f4c2)}</div>
          </div>)}

          {tab === 'f5' && (<div className="tp active">
            <div className="ms"><div className="ms-t">Auditoria Independente</div><div className="mr">{field('Resultado', row.r_f5 ? badge(R1_MAP[row.r_f5]||'b-na', row.r_f5) : null)}</div>{fieldText('Inconsistências', row.incons_f5)}{fieldText('Recomendações', row.rec_f5)}</div>
          </div>)}

          {tab === 'historico' && (<div className="tp active"><HistoricoControle controleId={row.id} projetoId={projeto?.id} /></div>)}

        </div>
        <div className="modal-ftr"><button className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  )
}

