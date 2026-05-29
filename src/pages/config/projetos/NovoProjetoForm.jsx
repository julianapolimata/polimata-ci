// NovoProjetoForm extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatNomeEmpresa } from '../../../lib/formatNome'
import { FASES_LABEL, FASES_DETALHE } from './_consts'

function NovoProjetoForm({ clientes, perfisPolimata, onSave, onCancel }) {
  const [form, setForm] = useState({
    nome: '', cliente_id: '', descricao: '', ativo: true,
    num_fases: 5, matriz_tamanho: 4, f1_tem_teste: true,
    data_inicio: '', data_previsao_conclusao: '',
    consultor_responsavel_id: '',
    sponsor_nome: '', sponsor_sobrenome: '', sponsor_cargo: '', sponsor_email: '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome do projeto é obrigatório'); return }
    if (!form.cliente_id) { setErro('Selecione o cliente'); return }
    if (form.data_inicio && form.data_previsao_conclusao && form.data_previsao_conclusao < form.data_inicio) {
      setErro('Previsão de conclusão não pode ser anterior à data de início'); return
    }
    setSaving(true); setErro('')
    try {
      const { error } = await supabase.from('projetos').insert({
        nome: form.nome.trim(),
        cliente_id: form.cliente_id,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
        num_fases: form.num_fases,
        matriz_tamanho: form.matriz_tamanho,
        f1_tem_teste: form.f1_tem_teste,
        data_inicio: form.data_inicio || null,
        data_previsao_conclusao: form.data_previsao_conclusao || null,
        consultor_responsavel_id: form.consultor_responsavel_id || null,
        sponsor_nome: form.sponsor_nome.trim() || null,
        sponsor_sobrenome: form.sponsor_sobrenome.trim() || null,
        sponsor_cargo: form.sponsor_cargo.trim() || null,
        sponsor_email: form.sponsor_email.trim() || null,
      })
      if (error) throw new Error(error.message)
      onSave()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-form">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onCancel}>← Voltar</button>
        <div><div className="cfg-form-title">Novo Projeto</div><div className="cfg-form-sub">Configure as informações do projeto</div></div>
      </div>
      {erro && <div className="cfg-erro">{erro}</div>}

      {/* ── Dados do Projeto ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Dados do Projeto</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome do Projeto <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Controles Internos 2026" /></div>
          <div className="cfg-field"><label>Cliente <span className="req">*</span></label>
            <select className="input-light" value={form.cliente_id} onChange={e=>u('cliente_id',e.target.value)}>
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{formatNomeEmpresa(c.nome_fantasia || c.nome)}</option>)}
            </select>
          </div>
        </div>
        <div className="cfg-field"><label>Descrição</label>
          <textarea className="input-light" rows={2} value={form.descricao} onChange={e=>u('descricao',e.target.value)} placeholder="Escopo, objetivo ou contexto do projeto (opcional)" style={{resize:'vertical',fontFamily:'inherit'}} />
        </div>
        <div className="cfg-field" style={{maxWidth:200}}><label>Status</label>
          <select className="input-light" value={form.ativo?'ativo':'inativo'} onChange={e=>u('ativo',e.target.value==='ativo')}>
            <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      {/* ── Metodologia ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Metodologia</div>
        <div className="cfg-form-sub" style={{marginTop:-6,marginBottom:4}}>Configurações que definem o escopo metodológico do projeto</div>
        <div className="cfg-row3">
          <div className="cfg-field"><label>Até qual fase o projeto vai?</label>
            <select className="input-light" value={form.num_fases} onChange={e=>u('num_fases',parseInt(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{FASES_LABEL[n]}</option>)}
            </select>
            <span style={{fontSize:11,color:'var(--lt-text3)',marginTop:4,display:'block'}}>{FASES_DETALHE[form.num_fases]}</span>
          </div>
          <div className="cfg-field"><label>Inclui teste de efetividade?</label>
            <select className="input-light" value={form.f1_tem_teste?'sim':'nao'} onChange={e=>u('f1_tem_teste',e.target.value==='sim')}>
              <option value="sim">Sim — F1 inclui teste</option>
              <option value="nao">Não — diagnóstico apenas</option>
            </select>
            {!form.f1_tem_teste && <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Sem régua de maturidade — entrega = mapa + criticidade + existência</span>}
          </div>
          <div className="cfg-field"><label>Matriz de Calor</label>
            <select className="input-light" value={form.matriz_tamanho} onChange={e=>u('matriz_tamanho',parseInt(e.target.value))}>
              <option value={4}>4 × 4</option><option value={5}>5 × 5</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Datas ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Datas</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Data de Início</label>
            <input className="input-light" type="date" value={form.data_inicio} onChange={e=>u('data_inicio',e.target.value)} />
          </div>
          <div className="cfg-field"><label>Previsão de Conclusão</label>
            <input className="input-light" type="date" value={form.data_previsao_conclusao} onChange={e=>u('data_previsao_conclusao',e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Equipe Polímata ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Equipe Polímata</div>
        <div className="cfg-form-sub" style={{marginTop:-6,marginBottom:4}}>Consultor responsável pela condução do projeto</div>
        <div className="cfg-field"><label>Consultor Responsável</label>
          <select className="input-light" value={form.consultor_responsavel_id} onChange={e=>u('consultor_responsavel_id',e.target.value)}>
            <option value="">— Não atribuído —</option>
            {perfisPolimata.map(p => <option key={p.id} value={p.id}>{p.nome}{p.papel==='admin_polimata' ? ' (Admin)' : ''}</option>)}
          </select>
        </div>
      </div>

      {/* ── Sponsor ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Sponsor do Projeto</div>
        <div className="cfg-form-sub" style={{marginTop:-6,marginBottom:4}}>Responsável executivo do cliente que receberá o relatório geral</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.sponsor_nome} onChange={e=>u('sponsor_nome',e.target.value)} placeholder="Nome" /></div>
          <div className="cfg-field"><label>Sobrenome</label><input className="input-light" value={form.sponsor_sobrenome} onChange={e=>u('sponsor_sobrenome',e.target.value)} placeholder="Sobrenome" /></div>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Cargo</label><input className="input-light" value={form.sponsor_cargo} onChange={e=>u('sponsor_cargo',e.target.value)} placeholder="Ex: Diretor Financeiro" /></div>
          <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.sponsor_email} onChange={e=>u('sponsor_email',e.target.value)} placeholder="sponsor@empresa.com" /></div>
        </div>
      </div>

      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving?'Salvando...':'✓ Criar Projeto'}</button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// DETALHE PROJETO (abas: Características, Estrutura, Responsáveis)
// ══════════════════════════════════════════════════════

export default NovoProjetoForm
