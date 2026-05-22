// DetalheProjeto extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatNomeEmpresa } from '../../../lib/formatNome'
import AbaCaracteristicas from './AbaCaracteristicas'
import AbaEstrutura from './AbaEstrutura'

function DetalheProjeto({ projeto, perfisPolimata = [], onBack }) {
  const [dados, setDados] = useState(null)
  const [areas, setAreas] = useState([])
  const [subprocessos, setSubprocessos] = useState([])
  // responsaveis removido — gerência e resp. área já estão na Estrutura Organizacional
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('caract')
  const [editandoCaract, setEditandoCaract] = useState(false)

  const loadDados = useCallback(async () => {
    setLoading(true)
    const [{ data: proj }, { data: ars }, { data: subs }] = await Promise.all([
      supabase.from('projetos').select('*, clientes(nome, nome_fantasia)').eq('id', projeto.id).single(),
      supabase.from('areas').select('*').eq('projeto_id', projeto.id).order('ordem'),
      supabase.from('subprocessos').select('*').order('ordem'),
    ])
    setDados(proj)
    setAreas(ars || [])
    const areaIds = new Set((ars || []).map(a => a.id))
    setSubprocessos((subs || []).filter(s => areaIds.has(s.area_id)))
    setLoading(false)
  }, [projeto.id])

  useEffect(() => { loadDados() }, [loadDados])

  if (loading || !dados) return <div className="cfg-loading"><div className="spinner"/></div>

  return (
    <div className="cfg-detalhe">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onBack}>← Voltar</button>
        <div style={{flex:1}}>
          <div className="cfg-form-title">{dados.nome}</div>
          <div className="cfg-form-sub" style={{display:'flex',gap:8,alignItems:'center'}}>
            {formatNomeEmpresa(dados.clientes?.nome_fantasia || dados.clientes?.nome)}
            <span style={{opacity:0.3}}>·</span>
            {dados.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
          </div>
        </div>
      </div>

      <div className="cfg-tabs" style={{marginBottom:20,marginTop:16}}>
        {[
          {id:'caract', label:'Características'},
          {id:'estrutura', label:'Estrutura Organizacional'},
        ].map(t => (
          <button key={t.id} className={`cfg-tab ${aba===t.id?'active':''}`} onClick={()=>setAba(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'caract' && (
        <AbaCaracteristicas dados={dados} perfisPolimata={perfisPolimata} onUpdate={loadDados} editando={editandoCaract} setEditando={setEditandoCaract} />
      )}
      {aba === 'estrutura' && (
        <AbaEstrutura projetoId={projeto.id} areas={areas} subprocessos={subprocessos} onReload={loadDados} />
      )}
    </div>
  )
}

// ── Aba Características ──

export default DetalheProjeto
