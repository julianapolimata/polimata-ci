// AbaEstrutura extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import AreaFormV2 from './AreaFormV2'

function AbaEstrutura({ projetoId, areas, subprocessos, onReload }) {
  const [novaArea, setNovaArea] = useState(false)
  const [editandoArea, setEditandoArea] = useState(null)
  const [saving, setSaving] = useState(false)
  const [novoSub, setNovoSub] = useState({}) // { [areaId]: nome }
  const [expandido, setExpandido] = useState({}) // { [areaId]: bool }

  function toggleExpand(areaId) { setExpandido(p => ({...p, [areaId]: !p[areaId]})) }

  async function salvarArea(area) {
    setSaving(true)
    const subNomes = area._subprocessos || []
    const payload = {
      nome: area.nome, prefixo: (area.prefixo||'').toUpperCase(),
      peso: parseFloat(area.peso) || 0,
      gerencia: area.gerencia || null,
      gerencia_email: area.gerencia_email || null,
      gerencia_recebe_email_mensal: !!area.gerencia_recebe_email_mensal,
      resp_area_nome: area.resp_area_nome || null,
      resp_area_email: area.resp_area_email || null,
      resp_area_recebe_email_mensal: !!area.resp_area_recebe_email_mensal,
    }
    let areaId = area.id
    if (area.id) {
      await supabase.from('areas').update(payload).eq('id', area.id)
    } else {
      const numAreas = areas.length + 1
      if (!payload.peso) payload.peso = parseFloat((1 / numAreas).toFixed(4))
      const { data: inserted } = await supabase.from('areas').insert({ projeto_id: projetoId, ...payload, ordem: areas.length + 1 }).select('id').single()
      areaId = inserted?.id
      await recalcPesos(projetoId, numAreas)
    }
    // Sincronizar subprocessos: remover antigos, inserir novos
    if (areaId) {
      const existentes = subprocessos.filter(s => s.area_id === areaId)
      const existentesNomes = existentes.map(s => s.nome)
      // Remover os que foram apagados
      const remover = existentes.filter(s => !subNomes.includes(s.nome))
      for (const s of remover) { await supabase.from('subprocessos').delete().eq('id', s.id) }
      // Inserir os novos
      const novos = subNomes.filter(n => !existentesNomes.includes(n))
      if (novos.length > 0) {
        const baseOrdem = existentes.length - remover.length
        await supabase.from('subprocessos').insert(novos.map((n, i) => ({ area_id: areaId, nome: n, ordem: baseOrdem + i + 1 })))
      }
    }
    setEditandoArea(null); setNovaArea(false); setSaving(false)
    onReload()
    window.dispatchEvent(new CustomEvent('polimata:areas-updated'))
  }

  async function removerArea(id) {
    if (!confirm('Remover esta área e todos os seus subprocessos?')) return
    await supabase.from('areas').delete().eq('id', id)
    onReload()
    window.dispatchEvent(new CustomEvent('polimata:areas-updated'))
  }

  async function adicionarSubprocesso(areaId) {
    const nome = (novoSub[areaId] || '').trim()
    if (!nome) return
    const count = subprocessos.filter(s => s.area_id === areaId).length
    await supabase.from('subprocessos').insert({ area_id: areaId, nome, ordem: count + 1 })
    setNovoSub(p => ({...p, [areaId]: ''}))
    onReload()
  }

  async function removerSubprocesso(id) {
    await supabase.from('subprocessos').delete().eq('id', id)
    onReload()
  }

  const subsMap = {}
  subprocessos.forEach(s => { if (!subsMap[s.area_id]) subsMap[s.area_id] = []; subsMap[s.area_id].push(s) })

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:11,color:'var(--txt3)'}}>
          {areas.length} área{areas.length !== 1 ? 's' : ''} · Peso total: {(areas.reduce((s,a) => s + (a.peso||0), 0) * 100).toFixed(1)}%
        </div>
        <button className="btn-cfg-sm" onClick={() => setNovaArea(true)}>+ Nova Área</button>
      </div>

      {novaArea && (
        <AreaFormV2 area={{nome:'',prefixo:'',peso:'',gerencia:'',gerencia_email:'',gerencia_recebe_email_mensal:false,resp_area_nome:'',resp_area_email:'',resp_area_recebe_email_mensal:false}}
          onSave={salvarArea} onCancel={()=>setNovaArea(false)} saving={saving} />
      )}

      {areas.map(a => (
        <div key={a.id} style={{marginBottom:12}}>
          {editandoArea?.id === a.id ? (
            <AreaFormV2 area={editandoArea} onSave={salvarArea} onCancel={()=>setEditandoArea(null)} saving={saving} subprocessosExistentes={subsMap[editandoArea.id]||[]} />
          ) : (
            <div className="cfg-group" style={{padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,flex:1,cursor:'pointer'}} onClick={()=>toggleExpand(a.id)}>
                  <span style={{fontSize:10,color:'var(--txt3)',transition:'transform .15s',transform:expandido[a.id]?'rotate(90deg)':'rotate(0)'}}>{'▶'}</span>
                  <span className="tag-prefixo">{a.prefixo}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--txt1)'}}>{a.nome}</div>
                    {!expandido[a.id] && (
                      <div style={{fontSize:10,color:'var(--txt3)',marginTop:2}}>
                        {a.gerencia && <span>Gerência: {a.gerencia} · </span>}
                        {a.resp_area_nome && <span>Resp: {a.resp_area_nome} · </span>}
                        Peso: {(a.peso*100).toFixed(1)}%
                        <span style={{margin:'0 4px',opacity:0.3}}>·</span>
                        {(subsMap[a.id]||[]).length} subprocesso{(subsMap[a.id]||[]).length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn-tbl-edit" onClick={()=>setEditandoArea({...a})}>✏</button>
                  <button className="btn-tbl-del" onClick={()=>removerArea(a.id)}>✕</button>
                </div>
              </div>

              {expandido[a.id] && (
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                  {/* Dados gerais */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px 20px',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Área / Processo</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.nome || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Prefixo</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.prefixo || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Peso (%)</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.peso ? (a.peso*100).toFixed(1)+'%' : '—'}</div>
                    </div>
                  </div>

                  {/* Gerência */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Gerência</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.gerencia || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Email da Gerência {a.gerencia_recebe_email_mensal && <span style={{fontSize:10,color:'var(--copper-text)',marginLeft:4,fontWeight:700}} title="Recebe e-mail mensal">✉</span>}</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.gerencia_email || '—'}</div>
                    </div>
                  </div>

                  {/* Responsável */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Responsável da Área</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.resp_area_nome || '—'}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Email do Responsável {a.resp_area_recebe_email_mensal && <span style={{fontSize:10,color:'var(--copper-text)',marginLeft:4,fontWeight:700}} title="Recebe e-mail mensal">✉</span>}</div>
                      <div style={{fontSize:13,color:'var(--txt1)'}}>{a.resp_area_email || '—'}</div>
                    </div>
                  </div>

                  {/* Subprocessos */}
                  <div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>Subprocessos</div>
                    {(subsMap[a.id]||[]).length > 0 ? (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 20px',marginBottom:8}}>
                        {(subsMap[a.id]||[]).map((s, idx) => (
                          <div key={s.id} style={{fontSize:12,color:'var(--txt2)',padding:'4px 0',display:'flex',alignItems:'center',gap:6}}>
                            <span style={{display:'inline-block',minWidth:22,color:'var(--txt3)',fontWeight:600}}>{idx + 1}.</span>
                            <span style={{flex:1}}>{s.nome}</span>
                            <button
                              onClick={() => { if (confirm(`Remover subprocesso "${s.nome}"?`)) removerSubprocesso(s.id) }}
                              title="Remover subprocesso"
                              style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',padding:'2px 6px',fontSize:11,opacity:0.5,transition:'opacity .15s'}}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:11,color:'var(--txt3)',fontStyle:'italic',marginBottom:8}}>Nenhum subprocesso cadastrado</div>
                    )}
                    {/* Input + botão de adicionar */}
                    <div style={{display:'flex',gap:6,marginTop:6}}>
                      <input
                        type="text"
                        value={novoSub[a.id] || ''}
                        onChange={e => setNovoSub(p => ({...p, [a.id]: e.target.value}))}
                        onKeyDown={e => { if (e.key === 'Enter') adicionarSubprocesso(a.id) }}
                        placeholder="Novo subprocesso..."
                        style={{flex:1,padding:'6px 10px',fontSize:12,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,color:'var(--txt1)',outline:'none'}}
                      />
                      <button
                        onClick={() => adicionarSubprocesso(a.id)}
                        disabled={!(novoSub[a.id] || '').trim()}
                        style={{padding:'6px 12px',fontSize:11,background:'rgba(204,145,94,0.15)',border:'1px solid rgba(204,145,94,0.3)',borderRadius:6,color:'var(--copper)',cursor:(novoSub[a.id] || '').trim()?'pointer':'not-allowed',opacity:(novoSub[a.id] || '').trim()?1:0.4,fontWeight:600}}
                      >+ Adicionar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {!areas.length && !novaArea && <div className="cfg-empty">Nenhuma área cadastrada. Clique em "+ Nova Área" para começar.</div>}
    </div>
  )
}

async function recalcPesos(projetoId, totalAreas) {
  if (totalAreas < 1) return
  const pesoIgual = parseFloat((1 / totalAreas).toFixed(4))
  const { data: ars } = await supabase.from('areas').select('id, peso').eq('projeto_id', projetoId)
  // Only recalc if all weights are 0 or if there's a new area with 0
  const allZero = (ars || []).every(a => !a.peso || a.peso === 0)
  if (allZero) {
    for (const a of (ars || [])) {
      await supabase.from('areas').update({ peso: pesoIgual }).eq('id', a.id)
    }
  }
}


export default AbaEstrutura
