import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── CONSTANTES ───────────────────────────────────────────────────────────
const STATUS_CFG = {
  aguardando:   { label: 'Aguardando',   color: '#1D4ED8', bg: 'rgba(59,130,246,0.10)' },
  em_andamento: { label: 'Em Andamento', color: '#92400E', bg: 'rgba(234,179,8,0.15)' },
  recebida:     { label: 'Recebida',     color: '#7C2D12', bg: 'rgba(234,88,12,0.15)' },
  validada:     { label: 'Validada',     color: '#15803D', bg: 'rgba(34,197,94,0.12)' },
  recusada:     { label: 'Recusada',     color: '#991B1B', bg: 'rgba(239,68,68,0.12)' },
  cancelada:    { label: 'Cancelada',    color: 'var(--lt-text3)', bg: 'rgba(0,32,62,0.06)' },
}
const FASES_OPCOES = ['F1','F2-E1','F2-E2','F3','F4-C1','F4-C2','F5']

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.aguardando
  return <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>{cfg.label}</span>
}

function diasEntre(d1, d2) {
  if (!d1 || !d2) return null
  const ms = new Date(d2).getTime() - new Date(d1).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function semaforoPrazo(prazo, status) {
  if (!prazo || ['validada','cancelada','recebida'].includes(status)) return null
  const dias = diasEntre(new Date(), prazo)
  if (dias < 0) return { label: `Atrasada ${Math.abs(dias)}d`, color: '#DC2626', bg: 'rgba(239,68,68,0.12)' }
  if (dias <= 3) return { label: `${dias}d restantes`, color: '#CA8A04', bg: 'rgba(234,179,8,0.12)' }
  return { label: `${dias}d restantes`, color: 'var(--lt-text3)', bg: 'rgba(0,32,62,0.04)' }
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────
export default function Solicitacoes({ projeto }) {
  const { perfil } = useAuth()
  const [solicitacoes, setSolicitacoes] = useState([])
  const [controles, setControles] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtStatus, setFiltStatus] = useState('')
  const [filtArea, setFiltArea] = useState('')
  const [filtFase, setFiltFase] = useState('')
  const [modalNova, setModalNova] = useState(false)
  const [modalEdit, setModalEdit] = useState(null)

  async function load() {
    if (!projeto?.id) return
    setLoading(true)
    const [solRes, ctrlRes, arRes] = await Promise.all([
      supabase.from('solicitacoes').select('*').eq('projeto_id', projeto.id).order('criado_em', { ascending: false }),
      supabase.from('mrc').select('id, rr, rc, dr, dc, area_id').eq('projeto_id', projeto.id).order('rc'),
      supabase.from('areas').select('id, nome, prefixo').eq('projeto_id', projeto.id).order('nome'),
    ])
    setSolicitacoes(solRes.data || [])
    setControles(ctrlRes.data || [])
    setAreas(arRes.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [projeto?.id])

  const ctrlMap = useMemo(() => {
    const m = {}; controles.forEach(c => { m[c.id] = c }); return m
  }, [controles])
  const areaMap = useMemo(() => {
    const m = {}; areas.forEach(a => { m[a.id] = a }); return m
  }, [areas])

  const filtradas = useMemo(() => solicitacoes.filter(s => {
    if (filtStatus && s.status !== filtStatus) return false
    if (filtArea && s.area_id !== filtArea) return false
    if (filtFase && s.fase !== filtFase) return false
    if (busca) {
      const q = busca.toLowerCase()
      const ctrl = ctrlMap[s.controle_id]
      const blob = [s.numero, s.titulo, s.descricao, ctrl?.rr, ctrl?.rc, s.responsavel_cliente_nome].filter(Boolean).join(' ').toLowerCase()
      if (!blob.includes(q)) return false
    }
    return true
  }), [solicitacoes, filtStatus, filtArea, filtFase, busca, ctrlMap])

  const kpis = useMemo(() => {
    const k = { total: filtradas.length, aguardando: 0, atrasadas: 0, recebidas: 0, validadas: 0 }
    const hoje = new Date()
    filtradas.forEach(s => {
      if (s.status === 'aguardando' || s.status === 'em_andamento') k.aguardando++
      if (s.status === 'recebida') k.recebidas++
      if (s.status === 'validada') k.validadas++
      if (s.prazo && new Date(s.prazo) < hoje && !['validada','cancelada','recebida'].includes(s.status)) k.atrasadas++
    })
    return k
  }, [filtradas])

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  const S = styles
  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.eyebrow}>Polímata · Gestão</div>
          <div style={S.title}>Solicitações de Evidência</div>
          <div style={S.sub}>{solicitacoes.length} solicita{solicitacoes.length === 1 ? 'ção' : 'ções'} · {projeto?.nome}</div>
        </div>
        <button onClick={() => setModalNova(true)} style={S.btnPrimary}>+ Nova Solicitação</button>
      </div>

      {/* KPIs */}
      <div style={S.kpiRow}>
        <div style={{ ...S.kpiCard, borderTopColor: 'var(--navy)' }}><div style={S.kpiLabel}>Total</div><div style={{ ...S.kpiValor, color: 'var(--navy)' }}>{kpis.total}</div><div style={S.kpiSub}>solicitações</div></div>
        <div style={{ ...S.kpiCard, borderTopColor: '#1D4ED8' }}><div style={S.kpiLabel}>Aguardando</div><div style={{ ...S.kpiValor, color: '#1D4ED8' }}>{kpis.aguardando}</div><div style={S.kpiSub}>esperando cliente</div></div>
        <div style={{ ...S.kpiCard, borderTopColor: '#DC2626' }}><div style={S.kpiLabel}>Atrasadas</div><div style={{ ...S.kpiValor, color: '#DC2626' }}>{kpis.atrasadas}</div><div style={S.kpiSub}>passaram do prazo</div></div>
        <div style={{ ...S.kpiCard, borderTopColor: '#EA580C' }}><div style={S.kpiLabel}>A Validar</div><div style={{ ...S.kpiValor, color: '#EA580C' }}>{kpis.recebidas}</div><div style={S.kpiSub}>cliente respondeu</div></div>
        <div style={{ ...S.kpiCard, borderTopColor: '#22C55E' }}><div style={S.kpiLabel}>Validadas</div><div style={{ ...S.kpiValor, color: '#22C55E' }}>{kpis.validadas}</div><div style={S.kpiSub}>concluídas</div></div>
      </div>

      {/* FILTROS */}
      <div style={S.filtros}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por número, controle, título, responsável…" style={{ ...S.filtroBase, flex: 1, minWidth: 240 }} />
        <select value={filtStatus} onChange={e=>setFiltStatus(e.target.value)} style={S.filtroBase}><option value="">Todos status</option>{Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
        <select value={filtArea} onChange={e=>setFiltArea(e.target.value)} style={S.filtroBase}><option value="">Todas áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
        <select value={filtFase} onChange={e=>setFiltFase(e.target.value)} style={S.filtroBase}><option value="">Todas fases</option>{FASES_OPCOES.map(f=><option key={f} value={f}>{f}</option>)}</select>
        <span style={{ fontSize: 11, color: 'var(--lt-text3)', fontWeight: 600 }}>{filtradas.length} resultado{filtradas.length===1?'':'s'}</span>
      </div>

      {/* TABELA */}
      <div style={S.tableWrap}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr>
              {['Nº','Área','Fase','Controle','Título','Responsável Cliente','Prazo','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--lt-text3)' }}>Nenhuma solicitação encontrada.</td></tr>}
            {filtradas.map(s => {
              const ctrl = ctrlMap[s.controle_id]
              const area = areaMap[s.area_id]
              const sem = semaforoPrazo(s.prazo, s.status)
              return (
                <tr key={s.id} onClick={() => setModalEdit(s)} style={S.row}>
                  <td style={{ ...S.td, fontWeight: 700, color: 'var(--copper)' }}>{s.numero}</td>
                  <td style={S.td}>{area?.nome || '—'}</td>
                  <td style={S.td}>{s.fase || '—'}</td>
                  <td style={{ ...S.td, color: 'var(--copper-text)', fontWeight: 600 }}>{ctrl?.rc || '—'}</td>
                  <td style={{ ...S.td, maxWidth: 280 }}>{s.titulo}</td>
                  <td style={S.td}>{s.responsavel_cliente_nome || '—'}</td>
                  <td style={S.td}>
                    {s.prazo ? new Date(s.prazo).toLocaleDateString('pt-BR') : '—'}
                    {sem && <div style={{ marginTop: 2, fontSize: 10, fontWeight: 600, color: sem.color, background: sem.bg, padding: '1px 6px', borderRadius: 4, display: 'inline-block' }}>{sem.label}</div>}
                  </td>
                  <td style={S.td}><StatusBadge status={s.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalNova && <ModalSolicitacao projeto={projeto} controles={controles} areas={areas} perfil={perfil} onClose={() => setModalNova(false)} onSaved={() => { setModalNova(false); load() }} />}
      {modalEdit && <ModalSolicitacao projeto={projeto} controles={controles} areas={areas} perfil={perfil} solicitacao={modalEdit} onClose={() => setModalEdit(null)} onSaved={() => { setModalEdit(null); load() }} />}
    </div>
  )
}

// ─── MODAL CRIAR / EDITAR / VALIDAR ───────────────────────────────────────
function ModalSolicitacao({ projeto, controles, areas, perfil, solicitacao, onClose, onSaved }) {
  const editing = !!solicitacao
  const [form, setForm] = useState({
    controle_id: solicitacao?.controle_id || '',
    fase: solicitacao?.fase || '',
    titulo: solicitacao?.titulo || '',
    descricao: solicitacao?.descricao || '',
    responsavel_cliente_nome: solicitacao?.responsavel_cliente_nome || '',
    responsavel_cliente_email: solicitacao?.responsavel_cliente_email || '',
    prazo: solicitacao?.prazo || '',
    status: solicitacao?.status || 'aguardando',
    evidencia_link: solicitacao?.evidencia_link || '',
    evidencia_descricao: solicitacao?.evidencia_descricao || '',
    comentarios: solicitacao?.comentarios || '',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function salvar() {
    if (!form.titulo.trim()) { setErro('Título é obrigatório'); return }
    if (!form.controle_id) { setErro('Selecione um controle'); return }
    setSaving(true); setErro('')
    try {
      const payload = {
        ...form,
        projeto_id: projeto.id,
        titulo: form.titulo.trim(),
        prazo: form.prazo || null,
        responsavel_polimata_id: perfil?.id || null,
        criado_por: perfil?.id || null,
      }
      if (editing) {
        const { error } = await supabase.from('solicitacoes').update(payload).eq('id', solicitacao.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('solicitacoes').insert([payload])
        if (error) throw error
      }
      onSaved()
    } catch(e) { setErro(e.message); setSaving(false) }
  }

  async function excluir() {
    if (!editing) return
    if (!confirm(`Excluir solicitação ${solicitacao.numero}?`)) return
    const { error } = await supabase.from('solicitacoes').delete().eq('id', solicitacao.id)
    if (error) { setErro(error.message); return }
    onSaved()
  }

  const ctrlSel = controles.find(c => c.id === form.controle_id)
  const M = mStyles

  return (
    <div style={M.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.header}>
          <div>
            <div style={M.eyebrow}>{editing ? `Solicitação ${solicitacao.numero}` : 'Nova solicitação'}</div>
            <div style={M.title}>{editing ? form.titulo || 'Editar solicitação' : 'Pedir evidência ao cliente'}</div>
          </div>
          <button onClick={onClose} style={M.close}>×</button>
        </div>

        <div style={M.body}>
          {erro && <div style={M.erro}>{erro}</div>}

          <div style={M.group}>
            <div style={M.groupTitle}>Vínculo</div>
            <div style={M.row2}>
              <div style={M.field}><label style={M.label}>Controle <span style={{color:'#DC2626'}}>*</span></label>
                <select value={form.controle_id} onChange={e=>u('controle_id', e.target.value)} style={M.input}>
                  <option value="">— Selecione —</option>
                  {controles.map(c => <option key={c.id} value={c.id}>{c.rc} · {(c.dc || '').slice(0, 70)}</option>)}
                </select>
              </div>
              <div style={M.field}><label style={M.label}>Fase</label>
                <select value={form.fase} onChange={e=>u('fase', e.target.value)} style={M.input}>
                  <option value="">—</option>
                  {FASES_OPCOES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            {ctrlSel && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--lt-text3)' }}>Risco: <strong>{ctrlSel.rr}</strong> — {(ctrlSel.dr || '').slice(0, 100)}</div>}
          </div>

          <div style={M.group}>
            <div style={M.groupTitle}>Pedido</div>
            <div style={M.field}><label style={M.label}>Título <span style={{color:'#DC2626'}}>*</span></label>
              <input value={form.titulo} onChange={e=>u('titulo', e.target.value)} placeholder="Ex: Disponibilizar política de compras vigente" style={M.input} />
            </div>
            <div style={M.field}><label style={M.label}>Descrição detalhada</label>
              <textarea value={form.descricao} onChange={e=>u('descricao', e.target.value)} rows={3} placeholder="Detalhe o que precisa: qual documento, período, formato esperado, etc." style={{ ...M.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={M.group}>
            <div style={M.groupTitle}>Responsável (cliente)</div>
            <div style={M.row2}>
              <div style={M.field}><label style={M.label}>Nome</label>
                <input value={form.responsavel_cliente_nome} onChange={e=>u('responsavel_cliente_nome', e.target.value)} placeholder="Ex: João Silva" style={M.input} />
              </div>
              <div style={M.field}><label style={M.label}>E-mail</label>
                <input type="email" value={form.responsavel_cliente_email} onChange={e=>u('responsavel_cliente_email', e.target.value)} placeholder="joao@cliente.com" style={M.input} />
              </div>
            </div>
            <div style={M.field}><label style={M.label}>Prazo</label>
              <input type="date" value={form.prazo} onChange={e=>u('prazo', e.target.value)} style={{ ...M.input, maxWidth: 200 }} />
            </div>
          </div>

          <div style={M.group}>
            <div style={M.groupTitle}>Resposta / Evidência</div>
            <div style={M.field}><label style={M.label}>Link do Google Drive</label>
              <input value={form.evidencia_link} onChange={e=>u('evidencia_link', e.target.value)} placeholder="https://drive.google.com/..." style={M.input} />
            </div>
            <div style={M.field}><label style={M.label}>Descrição da evidência</label>
              <textarea value={form.evidencia_descricao} onChange={e=>u('evidencia_descricao', e.target.value)} rows={2} placeholder="Resumo do que foi entregue" style={{ ...M.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={M.field}><label style={M.label}>Comentários</label>
              <textarea value={form.comentarios} onChange={e=>u('comentarios', e.target.value)} rows={2} placeholder="Observações livres" style={{ ...M.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={M.group}>
            <div style={M.groupTitle}>Status</div>
            <select value={form.status} onChange={e=>u('status', e.target.value)} style={{ ...M.input, maxWidth: 300 }}>
              {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={M.footer}>
          {editing && <button onClick={excluir} style={{ ...M.btn, color: '#DC2626', border: '1px solid rgba(239,68,68,0.3)' }}>Excluir</button>}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={M.btn}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ ...M.btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : (editing ? 'Salvar alterações' : '✓ Criar solicitação')}</button>
        </div>
      </div>
    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────
const styles = {
  page: { background: 'var(--lt-bg)', minHeight: '100vh', padding: '24px 28px', fontFamily: "'Montserrat', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper)', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 200, fontFamily: "'Raleway', sans-serif", color: 'var(--lt-text)', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: 'var(--lt-text3)', marginTop: 3 },
  btnPrimary: { background: 'var(--copper)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 },
  kpiCard: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, padding: '14px 16px', borderTop: '3px solid', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' },
  kpiLabel: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lt-text3)', marginBottom: 6 },
  kpiValor: { fontSize: 28, fontWeight: 300, lineHeight: 1 },
  kpiSub: { fontSize: 10, color: 'var(--lt-text3)', marginTop: 4 },
  filtros: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  filtroBase: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, color: 'var(--lt-text)', outline: 'none' },
  tableWrap: { background: 'var(--lt-card)', border: '1px solid var(--lt-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,37,64,0.06)' },
  th: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)', background: '#F0F2F5', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid var(--lt-border)' },
  td: { padding: '10px', borderBottom: '1px solid var(--lt-border)', fontSize: 11.5, color: 'var(--lt-text2)' },
  row: { cursor: 'pointer', transition: 'background .15s' },
}
const mStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 },
  modal: { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Montserrat', sans-serif", boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--lt-border)' },
  eyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--copper)', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: 600, color: '#00203E' },
  close: { background: 'none', border: 'none', fontSize: 24, color: 'var(--lt-text3)', cursor: 'pointer', lineHeight: 1, padding: 0 },
  body: { padding: '20px 24px', overflowY: 'auto' },
  group: { marginBottom: 18 },
  groupTitle: { fontSize: 10, fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  label: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--lt-text3)' },
  input: { padding: '8px 10px', border: '1px solid var(--lt-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--lt-text)', background: '#fff', outline: 'none' },
  erro: { marginBottom: 14, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#DC2626' },
  footer: { display: 'flex', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--lt-border)', background: '#fafbfc', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  btn: { background: '#fff', border: '1px solid var(--lt-border)', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, color: 'var(--lt-text)', cursor: 'pointer', fontFamily: 'inherit' },
  btnPrimary: { background: 'var(--copper)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}
