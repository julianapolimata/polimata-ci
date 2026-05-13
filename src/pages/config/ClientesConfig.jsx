import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatNomeEmpresa } from '../../lib/formatNome'

// ════════════════════════════════════════════════════════════════════════
// ClientesConfig — READ-ONLY (cadastro feito no Sistema Gerencial)
// ════════════════════════════════════════════════════════════════════════
// Os clientes são cadastrados no projeto polimata-gestao (gerencial) e
// replicados para este projeto via webhook (Edge Function clientes-webhook).
// Por isso esta tela não permite criar/editar dados de identificação —
// apenas visualização.
//
// Exceção: a aba "Sistemas" do detalhe continua editável, porque sistemas
// são específicos da operação de controles internos e não fazem parte do
// cadastro replicado.
// ════════════════════════════════════════════════════════════════════════

export default function ClientesConfig({ onAbrirProjeto }) {
  const [clientes, setClientes] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, cnpj, ativo, telefone, email, segmento, cidade, estado, contato_nome, contato_cargo, contato_telefone, contato_email')
      .order('nome')
    const { data: projetosData } = await supabase
      .from('projetos')
      .select('id, nome, ativo, cliente_id')
    setClientes((clientesData || []).map(c => ({
      ...c,
      projetos: (projetosData || []).filter(p => p.cliente_id === c.id)
    })))
    setLoading(false)
  }

  function fechar() { setClienteSel(null); loadClientes() }

  if (loading) return <div className="cfg-loading"><div className="spinner" /></div>

  return (
    <div className="cfg-section">
      {!clienteSel && (
        <>
          <ReadOnlyBanner />
          <div className="cfg-section-hdr">
            <div>
              <div className="cfg-section-title">Clientes cadastrados</div>
              <div className="cfg-section-sub">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="cfg-cards">
            {clientes.map(c => (
              <div key={c.id} className="cfg-card" onClick={() => setClienteSel(c)}>
                <div className="cfg-card-avatar">{(formatNomeEmpresa(c.nome) || formatNomeEmpresa(c.nome_fantasia) || '?')[0]}</div>
                <div className="cfg-card-info">
                  <div className="cfg-card-nome">{formatNomeEmpresa(c.nome)}</div>
                  {c.nome_fantasia && c.nome_fantasia.trim() && c.nome_fantasia !== c.nome && (
                    <div className="cfg-card-fantasia">{formatNomeEmpresa(c.nome_fantasia)}</div>
                  )}
                  <div className="cfg-card-meta">
                    {c.cnpj ? formatCNPJ(c.cnpj) : 'Sem CNPJ'}
                    <span style={{margin:'0 4px',opacity:0.3}}>·</span>
                    {c.projetos?.length || 0} projeto{c.projetos?.length !== 1 ? 's' : ''}
                    {c.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
                  </div>
                </div>
                <div className="cfg-card-arrow">›</div>
              </div>
            ))}
            {!clientes.length && <div className="cfg-empty">Nenhum cliente cadastrado.</div>}
          </div>
        </>
      )}
      {clienteSel && (
        <DetalheCliente
          cliente={clienteSel}
          onBack={fechar}
          onAbrirProjeto={onAbrirProjeto}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Banner read-only — mostrado nas duas vistas (listagem e detalhe)
// ──────────────────────────────────────────────────────────────────────
function ReadOnlyBanner() {
  return (
    <div style={{
      background: 'rgba(204, 145, 94, 0.08)',
      border: '1px solid rgba(204, 145, 94, 0.3)',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      fontSize: 12,
      lineHeight: 1.5,
      color: 'var(--lt-text2)',
    }}>
      <span style={{ fontSize: 14, marginTop: -1 }}>ℹ</span>
      <div>
        <strong style={{ color: 'var(--copper-text)', fontWeight: 600 }}>
          Cadastro feito no Sistema Gerencial.
        </strong>{' '}
        Os dados dos clientes (razão social, CNPJ, contatos, segmento) são gerenciados
        no <em>Polímata Gestão</em> e sincronizados automaticamente. Para alterar essas
        informações, edite no Sistema Gerencial — as mudanças aparecem aqui em segundos.
      </div>
    </div>
  )
}


function SistemasBanner() {
  return (
    <div style={{
      background: 'rgba(204, 145, 94, 0.08)',
      border: '1px solid rgba(204, 145, 94, 0.3)',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      fontSize: 12,
      lineHeight: 1.5,
      color: 'var(--lt-text2)',
    }}>
      <span style={{ fontSize: 14, marginTop: -1 }}>ℹ</span>
      <div>
        <strong style={{ color: 'var(--copper-text)', fontWeight: 600 }}>
          Sistemas usados pelo cliente.
        </strong>{' '}
        Liste aqui os sistemas que aparecerão na lista suspensa do cadastro de controle
        (ex.: TOTVS Protheus, SAP, Excel, e-mail). São compartilhados entre todos os
        projetos deste cliente.
      </div>
    </div>
  )
}

function formatCNPJ(v) {
  const n = (v||'').replace(/\D/g,'')
  if (n.length !== 14) return v
  return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')
}

// ════════════════════════════════════════════════════════════════════════
// DETALHE CLIENTE — read-only para Identificação/Contato; Sistemas editável
// ════════════════════════════════════════════════════════════════════════
function DetalheCliente({ cliente, onBack, onAbrirProjeto }) {
  const [dados, setDados] = useState(null)
  const [sistemas, setSistemas] = useState([])
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('info')
  const [novaSisNome, setNovaSisNome] = useState('')

  useEffect(() => { loadDados() }, [])

  async function loadDados() {
    setLoading(true)
    const [{ data: cli }, { data: sis }, { data: projs }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', cliente.id).single(),
      supabase.from('sistemas').select('*').eq('cliente_id', cliente.id).order('nome'),
      supabase.from('projetos').select('id, nome, ativo, num_fases, matriz_tamanho, criado_em').eq('cliente_id', cliente.id).order('nome'),
    ])
    setDados(cli)
    setSistemas(sis || [])
    setProjetos(projs || [])
    setLoading(false)
  }

  async function adicionarSistema() {
    if (!novaSisNome.trim()) return
    await supabase.from('sistemas').insert({ cliente_id: cliente.id, nome: novaSisNome.trim() })
    setNovaSisNome(''); loadDados()
  }

  async function removerSistema(id) {
    await supabase.from('sistemas').delete().eq('id', id); loadDados()
  }

  if (loading || !dados) return <div className="cfg-loading"><div className="spinner"/></div>

  return (
    <div className="cfg-detalhe">
      {aba === 'info' && <ReadOnlyBanner />}
      {aba === 'sistemas' && <SistemasBanner />}
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onBack}>← Voltar</button>
        <div style={{flex:1}}>
          <div className="cfg-form-title">{formatNomeEmpresa(dados.nome)}</div>
          {dados.nome_fantasia && dados.nome_fantasia.trim() && dados.nome_fantasia !== dados.nome && (
            <div className="cfg-form-fantasia">{formatNomeEmpresa(dados.nome_fantasia)}</div>
          )}
          <div className="cfg-form-sub" style={{display:'flex',gap:8,alignItems:'center'}}>
            {dados.cnpj && <span>{formatCNPJ(dados.cnpj)}</span>}
            {dados.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}
          </div>
        </div>
      </div>

      <div className="cfg-tabs" style={{marginBottom:20,marginTop:16}}>
        {[
          {id:'info', label:'Informações'},
          {id:'sistemas', label:'Sistemas'},
          {id:'projetos', label:`Projetos (${projetos.length})`},
        ].map(t => (
          <button key={t.id} className={`cfg-tab ${aba===t.id?'active':''}`} onClick={()=>setAba(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ABA INFO (READ-ONLY) ── */}
      {aba === 'info' && (
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          <div className="cfg-group">
            <div className="cfg-group-title">Dados da Empresa</div>
            <div className="usr-info-grid">
              <InfoCell label="Razão Social" value={formatNomeEmpresa(dados.nome)} />
              <InfoCell label="Nome Fantasia" value={formatNomeEmpresa(dados.nome_fantasia)} />
              <InfoCell label="CNPJ" value={dados.cnpj ? formatCNPJ(dados.cnpj) : null} />
              <InfoCell label="Segmento" value={dados.segmento} />
              <InfoCell label="Telefone" value={dados.telefone} />
              <InfoCell label="Email" value={dados.email} />
              <InfoCell label="Cidade" value={dados.cidade} />
              <InfoCell label="Estado" value={dados.estado} />
            </div>
          </div>

          <div className="cfg-group">
            <div className="cfg-group-title">Contato Principal</div>
            <div className="usr-info-grid">
              <InfoCell label="Nome" value={dados.contato_nome} />
              <InfoCell label="Cargo" value={dados.contato_cargo} />
              <InfoCell label="Telefone" value={dados.contato_telefone} />
              <InfoCell label="Email" value={dados.contato_email} />
            </div>
          </div>
        </div>
      )}

      {/* ── ABA SISTEMAS (EDITÁVEL — não é sincronizado) ── */}
      {aba === 'sistemas' && (
        <div>
          <div className="cfg-chips" style={{marginBottom:16}}>
            {sistemas.map(s => (
              <div key={s.id} className="cfg-chip" style={{display:'flex',alignItems:'center',gap:8}}>
                {s.nome}
                <button onClick={()=>removerSistema(s.id)} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:12,padding:0}}>✕</button>
              </div>
            ))}
            {!sistemas.length && <div className="cfg-empty">Nenhum sistema cadastrado.</div>}
          </div>
          <div style={{display:'flex',gap:8,maxWidth:400}}>
            <input className="input-light" style={{flex:1}} value={novaSisNome} onChange={e=>setNovaSisNome(e.target.value)} placeholder="Nome do sistema..." onKeyDown={e=>e.key==='Enter'&&adicionarSistema()} />
            <button className="btn-cfg-sm" onClick={adicionarSistema}>+ Adicionar</button>
          </div>
        </div>
      )}

      {/* ── ABA PROJETOS (read-only + link) ── */}
      {aba === 'projetos' && (
        <div>
          {projetos.length > 0 ? (
            <div className="cfg-table-wrap">
              <table className="cfg-table">
                <thead><tr><th>Projeto</th><th>Fases</th><th>Matriz</th><th>Status</th><th style={{width:80}}></th></tr></thead>
                <tbody>
                  {projetos.map(p => (
                    <tr key={p.id}>
                      <td style={{fontWeight:500}}>{p.nome}</td>
                      <td style={{textAlign:'center'}}>{p.num_fases ?? 5}</td>
                      <td style={{textAlign:'center'}}>{(p.matriz_tamanho ?? 4)}×{(p.matriz_tamanho ?? 4)}</td>
                      <td>{p.ativo ? <span className="badge-ativo">Ativo</span> : <span className="badge-inativo">Inativo</span>}</td>
                      <td>
                        {onAbrirProjeto && (
                          <button className="btn-cfg-sm" onClick={() => onAbrirProjeto(p.id)} style={{fontSize:10}}>
                            Abrir →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cfg-empty">
              Nenhum projeto cadastrado para este cliente.
              {onAbrirProjeto && <div style={{marginTop:8,fontSize:11}}>Crie um projeto na aba <strong>Projetos</strong> das Configurações.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div className="usr-info-cell">
      <div className="usr-info-label">{label}</div>
      <div className="usr-info-value">{value || <span style={{color:'var(--txt3)',fontStyle:'italic'}}>—</span>}</div>
    </div>
  )
}
