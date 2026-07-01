// NovoProjetoWizard — criação de projeto em passos guiados (5/jun/2026).
// Substitui o formulário único por um assistente: Identificação → Metodologia →
// Equipe & Prazos → Revisão. Ao concluir, cria o projeto, vincula o consultor
// (acesso + e-mail) e devolve o id para o pai abrir direto a Estrutura.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatNomeEmpresa } from '../../../lib/formatNome'
import { FASES_LABEL, FASES_DETALHE } from './_consts'
import { MODULOS } from '../../../lib/modulos'
import { vincularResponsavelAoProjeto } from '../../../lib/vinculoConsultor'

const PASSOS_CI = ['Identificação', 'Metodologia', 'Equipe & Prazos', 'Revisão']
const PASSOS_SIMPLES = ['Identificação', 'Equipe & Prazos', 'Revisão']

export default function NovoProjetoWizard({ clientes, perfisPolimata, onCreated, onCancel, produtoInicial }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nome: '', cliente_id: '', descricao: '', ativo: true, produto: produtoInicial || 'ci',
    num_fases: 5, matriz_tamanho: 4, f1_tem_teste: true,
    data_inicio: '', data_previsao_conclusao: '',
    consultor_responsavel_id: '',
    sponsor_nome: '', sponsor_sobrenome: '', sponsor_cargo: '', sponsor_email: '',
  })
  const u = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const PASSOS = form.produto === 'ci' ? PASSOS_CI : PASSOS_SIMPLES

  const cliObj = clientes.find(c => c.id === form.cliente_id)
  const clienteNome = formatNomeEmpresa(cliObj?.nome_fantasia || cliObj?.nome) || ''
  const consultorNome = perfisPolimata.find(p => p.id === form.consultor_responsavel_id)?.nome || ''

  const podeAvancar = (() => {
    if (step === 0) return !!form.nome.trim() && !!form.cliente_id
    if (PASSOS[step] === 'Equipe & Prazos' && form.data_inicio && form.data_previsao_conclusao && form.data_previsao_conclusao < form.data_inicio) return false
    return true
  })()

  function avancar() {
    setErro('')
    if (step === 0 && !form.nome.trim()) { setErro('Informe o nome do projeto.'); return }
    if (step === 0 && !form.cliente_id) { setErro('Selecione o cliente.'); return }
    if (PASSOS[step] === 'Equipe & Prazos' && form.data_inicio && form.data_previsao_conclusao && form.data_previsao_conclusao < form.data_inicio) {
      setErro('A previsão de conclusão não pode ser anterior ao início.'); return
    }
    setStep(s => Math.min(s + 1, PASSOS.length - 1))
  }
  function voltar() { setErro(''); setStep(s => Math.max(s - 1, 0)) }

  async function criar() {
    setSaving(true); setErro('')
    try {
      const { data: novoProj, error } = await supabase.from('projetos').insert({
        nome: form.nome.trim(),
        produto: form.produto,
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
      }).select('id').single()
      if (error) throw new Error(error.message)
      if (form.consultor_responsavel_id && novoProj?.id) {
        const consultorSel = perfisPolimata.find(x => x.id === form.consultor_responsavel_id)
        await vincularResponsavelAoProjeto(consultorSel, novoProj.id)
      }
      onCreated(novoProj?.id)
    } catch (e) { setErro(e.message); setSaving(false) }
  }

  return (
    <div className="cfg-form">
      <div className="cfg-form-hdr">
        <button className="cfg-back" onClick={onCancel}>← Voltar</button>
        <div><div className="cfg-form-title">Novo Projeto</div><div className="cfg-form-sub">Passo {step + 1} de {PASSOS.length} · {PASSOS[step]}</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0 22px', gap: 0 }}>
        {PASSOS.map((p, i) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', flex: i < PASSOS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'all .2s', background: i < step ? '#15803D' : i === step ? '#00203E' : 'var(--lt-border, #E2E6EB)', color: i <= step ? '#fff' : 'var(--lt-text3, #8A97A6)' }}>{i < step ? '✓' : i + 1}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: i === step ? '#00203E' : 'var(--lt-text3, #8A97A6)', whiteSpace: 'nowrap' }}>{p}</div>
            </div>
            {i < PASSOS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? '#15803D' : 'var(--lt-border, #E2E6EB)', margin: '0 6px', marginBottom: 16 }} />}
          </div>
        ))}
      </div>

      {erro && <div className="cfg-erro">{erro}</div>}

      {step === 0 && (
        <div className="cfg-group">
          <div className="cfg-group-title">Identificação do Projeto</div>
          <div className="cfg-field"><label>Cliente <span className="req">*</span></label>
            <select className="input-light" value={form.cliente_id} onChange={e => u('cliente_id', e.target.value)}>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{formatNomeEmpresa(c.nome_fantasia || c.nome)}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 4, display: 'block' }}>O cliente é cadastrado no Polímata Gestão. Não aparece? Cadastre lá e aguarde a sincronização.</span>
          </div>
          <div className="cfg-field" style={{ maxWidth: 280 }}><label>Produto <span className="req">*</span></label>
            <select className="input-light" value={form.produto} onChange={e => u('produto', e.target.value)}>
              {MODULOS.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            {form.produto !== 'ci' && <span style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 4, display: 'block' }}>{(MODULOS.find(m => m.id === form.produto) || {}).descricao}</span>}
          </div>
          <div className="cfg-field"><label>Nome do Projeto <span className="req">*</span></label>
            <input className="input-light" value={form.nome} onChange={e => u('nome', e.target.value)} placeholder={form.produto === 'orcamento' ? 'Ex: Orçamento 2026' : 'Ex: Controles Internos 2026'} />
          </div>
          <div className="cfg-field"><label>Descrição</label>
            <textarea className="input-light" rows={2} value={form.descricao} onChange={e => u('descricao', e.target.value)} placeholder="Escopo, objetivo ou contexto do projeto (opcional)" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div className="cfg-field" style={{ maxWidth: 200 }}><label>Status</label>
            <select className="input-light" value={form.ativo ? 'ativo' : 'inativo'} onChange={e => u('ativo', e.target.value === 'ativo')}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      )}

      {PASSOS[step] === 'Metodologia' && (
        <div className="cfg-group">
          <div className="cfg-group-title">Metodologia</div>
          <div className="cfg-form-sub" style={{ marginTop: -6, marginBottom: 4 }}>Define o escopo metodológico e como o projeto será avaliado.</div>
          <div className="cfg-field"><label>Até qual fase o projeto vai?</label>
            <select className="input-light" value={form.num_fases} onChange={e => { const n = parseInt(e.target.value); u('num_fases', n); if (n >= 2) u('f1_tem_teste', true) }}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{FASES_LABEL[n]}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 4, display: 'block' }}>{FASES_DETALHE[form.num_fases]}</span>
          </div>
          <div className="cfg-row2">
            <div className="cfg-field"><label>Inclui teste de efetividade?</label>
              <select className="input-light" value={form.f1_tem_teste ? 'sim' : 'nao'} disabled={form.num_fases !== 1} onChange={e => u('f1_tem_teste', e.target.value === 'sim')}>
                <option value="sim">Sim — F1 inclui teste</option>
                <option value="nao" disabled={form.num_fases !== 1}>Não — diagnóstico apenas</option>
              </select>
              {form.num_fases !== 1
                ? <span style={{ fontSize: 11, color: 'var(--lt-text3)', marginTop: 4, display: 'block' }}>A partir da Fase 2 o teste é obrigatório — "diagnóstico apenas" só existe em "Até Fase 1 - Diagnóstico Inicial".</span>
                : (!form.f1_tem_teste && <span style={{ fontSize: 11, color: 'var(--copper)', marginTop: 4, display: 'block' }}>Sem régua de maturidade — entrega = mapa + criticidade + existência</span>)}
            </div>
            <div className="cfg-field"><label>Matriz de Calor</label>
              <select className="input-light" value={form.matriz_tamanho} onChange={e => u('matriz_tamanho', parseInt(e.target.value))}>
                <option value={4}>4 × 4</option><option value={5}>5 × 5</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {PASSOS[step] === 'Equipe & Prazos' && (
        <>
          <div className="cfg-group">
            <div className="cfg-group-title">Equipe Polímata</div>
            <div className="cfg-form-sub" style={{ marginTop: -6, marginBottom: 4 }}>O consultor responsável recebe acesso ao projeto e um e-mail de aviso automático.</div>
            <div className="cfg-field"><label>Consultor Responsável</label>
              <select className="input-light" value={form.consultor_responsavel_id} onChange={e => u('consultor_responsavel_id', e.target.value)}>
                <option value="">— Não atribuído —</option>
                {perfisPolimata.map(p => <option key={p.id} value={p.id}>{p.nome}{p.papel === 'admin_polimata' ? ' (Admin)' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="cfg-group">
            <div className="cfg-group-title">Prazos</div>
            <div className="cfg-row2">
              <div className="cfg-field"><label>Data de Início</label>
                <input className="input-light" type="date" value={form.data_inicio} onChange={e => u('data_inicio', e.target.value)} />
              </div>
              <div className="cfg-field"><label>Previsão de Conclusão</label>
                <input className="input-light" type="date" value={form.data_previsao_conclusao} onChange={e => u('data_previsao_conclusao', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="cfg-group">
            <div className="cfg-group-title">Sponsor do Projeto</div>
            <div className="cfg-form-sub" style={{ marginTop: -6, marginBottom: 4 }}>Responsável executivo do cliente que receberá o relatório geral (opcional).</div>
            <div className="cfg-row2">
              <div className="cfg-field"><label>Nome</label><input className="input-light" value={form.sponsor_nome} onChange={e => u('sponsor_nome', e.target.value)} placeholder="Nome" /></div>
              <div className="cfg-field"><label>Sobrenome</label><input className="input-light" value={form.sponsor_sobrenome} onChange={e => u('sponsor_sobrenome', e.target.value)} placeholder="Sobrenome" /></div>
            </div>
            <div className="cfg-row2">
              <div className="cfg-field"><label>Cargo</label><input className="input-light" value={form.sponsor_cargo} onChange={e => u('sponsor_cargo', e.target.value)} placeholder="Ex: Diretor Financeiro" /></div>
              <div className="cfg-field"><label>Email</label><input className="input-light" type="email" value={form.sponsor_email} onChange={e => u('sponsor_email', e.target.value)} placeholder="sponsor@empresa.com" /></div>
            </div>
          </div>
        </>
      )}

      {PASSOS[step] === 'Revisão' && (
        <div className="cfg-group">
          <div className="cfg-group-title">Revise antes de criar</div>
          <div className="usr-info-grid" style={{ marginBottom: 8 }}>
            <Resumo label="Produto" value={(MODULOS.find(m => m.id === form.produto) || {}).nome} />
            <Resumo label="Cliente" value={clienteNome} />
            <Resumo label="Projeto" value={form.nome} />
            <Resumo label="Status" value={form.ativo ? 'Ativo' : 'Inativo'} />
            {form.produto === 'ci' && (<>
            <Resumo label="Escopo" value={FASES_LABEL[form.num_fases]} />
            <Resumo label="Teste de efetividade" value={form.f1_tem_teste ? 'Sim' : 'Não — diagnóstico'} />
            <Resumo label="Matriz de calor" value={form.matriz_tamanho + ' × ' + form.matriz_tamanho} />
            </>)}
            <Resumo label="Consultor" value={consultorNome || '— Não atribuído —'} />
            <Resumo label="Início" value={fmt(form.data_inicio)} />
            <Resumo label="Previsão" value={fmt(form.data_previsao_conclusao)} />
            <Resumo label="Sponsor" value={[form.sponsor_nome, form.sponsor_sobrenome].filter(Boolean).join(' ') || '—'} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F3EEE4', border: '1px solid rgba(204,145,94,0.35)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#00203E', lineHeight: 1.5 }}>
            <span style={{ color: '#CC915E', fontWeight: 700, lineHeight: 1.4 }} aria-hidden="true">ⓘ</span>
            <span>
            {form.produto === 'ci'
              ? <>Ao criar, você será levado direto para a <strong style={{ color: '#9A6433' }}>Estrutura Organizacional</strong> do projeto para cadastrar as áreas, responsáveis e subprocessos — sem eles, o projeto fica vazio.</>
              : <>Ao criar, o projeto já aparece no seletor e leva direto ao módulo <strong style={{ color: '#9A6433' }}>{(MODULOS.find(m => m.id === form.produto) || {}).nome}</strong>.</>}
            </span>
          </div>
        </div>
      )}

      <div className="cfg-form-footer">
        <button className="btn-cfg-cancel" style={{ border: '1px solid #00203E', color: '#00203E', fontWeight: 600 }} onClick={step === 0 ? onCancel : voltar} disabled={saving}>{step === 0 ? 'Cancelar' : '← Anterior'}</button>
        {step < PASSOS.length - 1
          ? <button className="btn-cfg-save" onClick={avancar} disabled={!podeAvancar}>Próximo →</button>
          : <button className="btn-cfg-save" onClick={criar} disabled={saving}>{saving ? 'Criando...' : '✓ Criar Projeto'}</button>}
      </div>
    </div>
  )
}

function Resumo({ label, value }) {
  return (
    <div className="usr-info-cell">
      <div className="usr-info-label">{label}</div>
      <div className="usr-info-value">{value || '—'}</div>
    </div>
  )
}

function fmt(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return day + '/' + m + '/' + y
}
