// ProjetosConfig — shell de coordenação.
// Fatiamento Etapa 4 (22/mai/2026): cada aba/form virou arquivo próprio em ./projetos/.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNomeEmpresa } from '../../lib/formatNome'
import { FASES_LABEL } from './projetos/_consts'
import NovoProjetoForm from './projetos/NovoProjetoForm'
import DetalheProjeto from './projetos/DetalheProjeto'

export default function ProjetosConfig({ projetoIdInicial }) {
  const [clientes, setClientes] = useState([])
  const [perfisPolimata, setPerfisPolimata] = useState([])
  const [projetos, setProjetos] = useState([])
  const [projetoSel, setProjetoSel] = useState(null)
  const [modo, setModo] = useState(projetoIdInicial ? 'detalhe' : null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProjetos() }, [])

  async function loadProjetos() {
    setLoading(true)
    const [{ data: projs }, { data: cls }, { data: pfs }] = await Promise.all([
      supabase.from('projetos').select('*, clientes(id, nome, nome_fantasia)').order('nome'),
      supabase.from('clientes').select('id, nome, nome_fantasia').order('nome'),
      supabase.from('perfis').select('id, nome, papel').in('papel', ['admin_polimata','consultor_polimata']).eq('ativo', true).order('nome'),
    ])
    setProjetos(projs || [])
    setClientes(cls || [])
    setPerfisPolimata(pfs || [])
    if (projetoIdInicial && !projetoSel) {
      const p = (projs || []).find(x => x.id === projetoIdInicial)
      if (p) { setProjetoSel(p); setModo('detalhe') }
    }
    setLoading(false)
  }

  function fechar() { setModo(null); setProjetoSel(null); loadProjetos() }

  if (loading) return <div className="cfg-loading"><div className="spinner" /></div>

  return (
    <div className="cfg-section">
      {!modo && (
        <>
          <div className="cfg-section-hdr">
            <div>
              <div className="cfg-section-title">Projetos</div>
              <div className="cfg-section-sub">{projetos.length} projeto{projetos.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="btn-cfg-add" onClick={() => setModo('novo')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Novo Projeto
            </button>
          </div>
          <div className="cfg-cards">
            {projetos.map(p => (
              <div key={p.id} className="cfg-card" onClick={() => { setProjetoSel(p); setModo('detalhe') }}>
                <div className="cfg-card-avatar" style={{borderRadius:8,fontSize:14}}>{(p.nome||'P')[0]}</div>
                <div className="cfg-card-info">
                  <div className="cfg-card-nome">{p.nome}</div>
                  <div className="cfg-card-meta">
                    {formatNomeEmpresa(p.clientes?.nome_fantasia || p.clientes?.nome) || '—'}
                    <span style={{margin:'0 4px',opacity:0.3}}>·</span>
                    {FASES_LABEL[p.num_fases ?? 5]} · {(p.matriz_tamanho??4)}×{(p.matriz_tamanho??4)}
                    {p.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
                  </div>
                </div>
                <div className="cfg-card-arrow">›</div>
              </div>
            ))}
            {!projetos.length && <div className="cfg-empty">Nenhum projeto cadastrado.</div>}
          </div>
        </>
      )}
      {modo === 'novo' && <NovoProjetoForm clientes={clientes} perfisPolimata={perfisPolimata} onSave={fechar} onCancel={fechar} />}
      {modo === 'detalhe' && projetoSel && <DetalheProjeto projeto={projetoSel} perfisPolimata={perfisPolimata} onBack={fechar} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// NOVO PROJETO
// ══════════════════════════════════════════════════════
