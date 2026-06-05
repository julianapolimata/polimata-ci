// AbaCaracteristicas extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { FASES_LABEL, FASES_DETALHE } from './_consts'
import InfoCell from './InfoCell'
import { vincularResponsavelAoProjeto } from '../../../lib/vinculoConsultor'

function AbaCaracteristicas({ dados, perfisPolimata = [], onUpdate, editando, setEditando }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [temControles, setTemControles] = useState(false)
  const [temResultadoTeste, setTemResultadoTeste] = useState(false)
  const [faseMinima, setFaseMinima] = useState(1)

  useEffect(() => {
    setForm({
      nome: dados.nome || '',
      descricao: dados.descricao || '',
      ativo: dados.ativo !== false,
      num_fases: dados.num_fases ?? 5,
      matriz_tamanho: dados.matriz_tamanho ?? 4,
      f1_tem_teste: dados.f1_tem_teste !== false,
      data_inicio: dados.data_inicio || '',
      data_previsao_conclusao: dados.data_previsao_conclusao || '',
      consultor_responsavel_id: dados.consultor_responsavel_id || '',
      sponsor_nome: dados.sponsor_nome || '',
      sponsor_sobrenome: dados.sponsor_sobrenome || '',
      sponsor_cargo: dados.sponsor_cargo || '',
      sponsor_email: dados.sponsor_email || '',
    })
    // Check constraints
    ;(async () => {
      const { count } = await supabase.from('mrc').select('id', { count:'exact', head:true }).eq('projeto_id', dados.id)
      const tem = (count || 0) > 0
      setTemControles(tem)
      if (!tem) { setFaseMinima(1); setTemResultadoTeste(false); return }
      const { data: rows } = await supabase.from('mrc').select('r1, r_ader, r3, r_f4c1, r_f4c2, r_f5').eq('projeto_id', dados.id)
      let max = 1
      let temR1 = false
      for (const r of (rows||[])) {
        if (r.r1 && String(r.r1).trim() !== '') temR1 = true
        if (r.r_f5) { max = 5; break }
        if (r.r_f4c1 || r.r_f4c2) max = Math.max(max, 4)
        if (r.r3) max = Math.max(max, 3)
        if (r.r_ader) max = Math.max(max, 2)
      }
      setFaseMinima(max)
      setTemResultadoTeste(temR1)
    })()
  }, [dados])

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))

  // Trava: f1_tem_teste true→false só se NÃO há nenhum r1 preenchido
  const f1TestePodeMudarParaFalse = !temResultadoTeste

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (form.data_inicio && form.data_previsao_conclusao && form.data_previsao_conclusao < form.data_inicio) {
      setErro('Previsão de conclusão não pode ser anterior à data de início'); return
    }
    setSaving(true); setErro('')
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
        num_fases: form.num_fases,
        data_inicio: form.data_inicio || null,
        data_previsao_conclusao: form.data_previsao_conclusao || null,
        consultor_responsavel_id: form.consultor_responsavel_id || null,
        sponsor_nome: form.sponsor_nome.trim() || null,
        sponsor_sobrenome: form.sponsor_sobrenome.trim() || null,
        sponsor_cargo: form.sponsor_cargo.trim() || null,
        sponsor_email: form.sponsor_email.trim() || null,
      }
      if (!temControles) payload.matriz_tamanho = form.matriz_tamanho
      // f1_tem_teste só atualiza se a mudança é permitida
      if (dados.f1_tem_teste !== form.f1_tem_teste) {
        if (form.f1_tem_teste === false && !f1TestePodeMudarParaFalse) {
          throw new Error('Não é possível desativar testes: já existem resultados de teste registrados')
        }
        payload.f1_tem_teste = form.f1_tem_teste
      }
      const { error } = await supabase.from('projetos').update(payload).eq('id', dados.id)
      if (error) throw new Error(error.message)
      // Consultor responsável novo: habilita acesso ao projeto + e-mail de aviso
      if (form.consultor_responsavel_id && form.consultor_responsavel_id !== (dados.consultor_responsavel_id || '')) {
        const consultorSel = perfisPolimata.find(x => x.id === form.consultor_responsavel_id)
        await vincularResponsavelAoProjeto(consultorSel, dados.id)
      }
      setEditando(false); onUpdate()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  // ── Helpers de visualização ──
  const fmtDate = (d) => {
    if (!d) return null
    const [y,m,day] = String(d).split('-')
    return `${day}/${m}/${y}`
  }
  const consultorNome = (() => {
    if (!dados.consultor_responsavel_id) return null
    const p = perfisPolimata.find(x => x.id === dados.consultor_responsavel_id)
    return p ? `${p.nome}${p.papel==='admin_polimata' ? ' (Admin)' : ''}` : '—'
  })()

  if (!editando) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:20}}>
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <button className="btn-cfg-sm" onClick={()=>setEditando(true)}>✏ Editar</button>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Dados do Projeto</div>
          <div className="usr-info-grid">
            <InfoCell label="Nome" value={dados.nome} />
            <InfoCell label="Status" value={dados.ativo ? 'Ativo' : 'Inativo'} />
            <InfoCell label="Descrição" value={dados.descricao} wide />
          </div>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Metodologia</div>
          <div className="usr-info-grid">
            <InfoCell label="Escopo" value={FASES_LABEL[dados.num_fases ?? 5]} />
            <InfoCell label="Inclui teste de efetividade?" value={dados.f1_tem_teste === false ? 'Não — diagnóstico apenas' : 'Sim — F1 inclui teste'} />
            <InfoCell label="Matriz de Calor" value={`${dados.matriz_tamanho??4}×${dados.matriz_tamanho??4}`} />
          </div>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Datas</div>
          <div className="usr-info-grid">
            <InfoCell label="Data de Início" value={fmtDate(dados.data_inicio)} />
            <InfoCell label="Previsão de Conclusão" value={fmtDate(dados.data_previsao_conclusao)} />
          </div>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Equipe Polímata</div>
          <div className="usr-info-grid">
            <InfoCell label="Consultor Responsável" value={consultorNome} />
          </div>
        </div>
        <div className="cfg-group">
          <div className="cfg-group-title">Sponsor do Projeto</div>
          <div className="usr-info-grid">
            <InfoCell label="Nome" value={[dados.sponsor_nome, dados.sponsor_sobrenome].filter(Boolean).join(' ') || null} />
            <InfoCell label="Cargo" value={dados.sponsor_cargo} />
            <InfoCell label="Email" value={dados.sponsor_email} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cfg-form" style={{gap:16}}>
      {erro && <div className="cfg-erro">{erro}</div>}

      {/* ── Dados do Projeto ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Dados do Projeto</div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} /></div>
          <div className="cfg-field"><label>Status</label>
            <select className="input-light" value={form.ativo?'ativo':'inativo'} onChange={e=>u('ativo',e.target.value==='ativo')}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
        <div className="cfg-field"><label>Descrição</label>
          <textarea className="input-light" rows={2} value={form.descricao} onChange={e=>u('descricao',e.target.value)} placeholder="Escopo, objetivo ou contexto do projeto (opcional)" style={{resize:'vertical',fontFamily:'inherit'}} />
        </div>
      </div>

      {/* ── Metodologia ── */}
      <div className="cfg-group">
        <div className="cfg-group-title">Metodologia</div>
        <div className="cfg-row3">
          <div className="cfg-field"><label>Até qual fase o projeto vai?</label>
            <select className="input-light" value={form.num_fases} onChange={e=>u('num_fases',parseInt(e.target.value))}>
              {[1,2,3,4,5].map(n => <option key={n} value={n} disabled={n<faseMinima}>{FASES_LABEL[n]}{n<faseMinima?' (há dados)':''}</option>)}
            </select>
            <span style={{fontSize:11,color:'var(--lt-text3)',marginTop:4,display:'block'}}>{FASES_DETALHE[form.num_fases]}</span>
            {faseMinima > 1 && <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Fase mínima: F{faseMinima}</span>}
          </div>
          <div className="cfg-field"><label>Inclui teste de efetividade?</label>
            <select className="input-light" value={form.f1_tem_teste?'sim':'nao'} onChange={e=>u('f1_tem_teste',e.target.value==='sim')}>
              <option value="sim">Sim — F1 inclui teste</option>
              <option value="nao" disabled={!f1TestePodeMudarParaFalse}>
                Não — diagnóstico apenas{!f1TestePodeMudarParaFalse?' (já há resultados)':''}
              </option>
            </select>
            {!form.f1_tem_teste && <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Sem régua de maturidade — entrega = mapa + criticidade + existência</span>}
            {!f1TestePodeMudarParaFalse && form.f1_tem_teste && <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Travado — já há resultados de teste registrados</span>}
          </div>
          <div className="cfg-field"><label>Matriz de Calor</label>
            {temControles ? (
              <><select className="input-light" value={form.matriz_tamanho} disabled style={{opacity:0.6}}><option>{form.matriz_tamanho}×{form.matriz_tamanho}</option></select>
              <span style={{fontSize:11,color:'var(--copper)',marginTop:4,display:'block'}}>Travada — projeto com controles</span></>
            ) : (
              <select className="input-light" value={form.matriz_tamanho} onChange={e=>u('matriz_tamanho',parseInt(e.target.value))}>
                <option value={4}>4 × 4</option><option value={5}>5 × 5</option>
              </select>
            )}
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
        <div className="cfg-row2">
          <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.sponsor_nome} onChange={e=>u('sponsor_nome',e.target.value)} /></div>
          <div className="cfg-field"><label>Sobrenome</label><input className="input-light" value={form.sponsor_sobrenome} onChange={e=>u('sponsor_sobrenome',e.target.value)} /></div>
        </div>
        <div className="cfg-row2">
          <div className="cfg-field"><label>Cargo</label><input className="input-light" value={form.sponsor_cargo} onChange={e=>u('sponsor_cargo',e.target.value)} /></div>
          <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.sponsor_email} onChange={e=>u('sponsor_email',e.target.value)} /></div>
        </div>
      </div>

      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" onClick={()=>setEditando(false)}>Cancelar</button>
        <button className="btn-cfg-save" onClick={salvar} disabled={saving}>{saving?'Salvando...':'✓ Salvar'}</button>
      </div>
    </div>
  )
}

// ── Aba Estrutura Organizacional ──

export default AbaCaracteristicas
