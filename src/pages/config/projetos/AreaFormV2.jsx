// AreaFormV2 extraído de ProjetosConfig.jsx em 22/mai/2026 (fatiamento Etapa 4).
import { useState } from 'react'

function AreaFormV2({ area, onSave, onCancel, saving, subprocessosExistentes }) {
  const [form, setForm] = useState({...area})
  const existentes = (subprocessosExistentes || []).map(s => s.nome)
  const iniciais = existentes.length > 0 ? existentes : Array(10).fill('')
  // Garantir pelo menos 10 campos
  while (iniciais.length < 10) iniciais.push('')
  const [subs, setSubs] = useState(iniciais)
  const u = (f,v) => setForm(p=>({...p,[f]:v}))
  const uSub = (i,v) => { const n = [...subs]; n[i] = v; setSubs(n) }
  const addMoreSubs = () => setSubs(p => [...p, ...Array(5).fill('')])

  function handleSave() {
    const subNomes = subs.map(s => s.trim()).filter(Boolean)
    onSave({ ...form, _subprocessos: subNomes })
  }

  return (
    <div className="cfg-area-block" style={{marginBottom:12}}>
      <div className="cfg-row3">
        <div className="cfg-field"><label>Área / Processo <span className="req">*</span></label><input className="input-light" value={form.nome} onChange={e=>u('nome',e.target.value)} placeholder="Ex: Compras" /></div>
        <div className="cfg-field"><label>Prefixo <span className="req">*</span></label><input className="input-light" value={form.prefixo} onChange={e=>u('prefixo',e.target.value.toUpperCase())} placeholder="COM" maxLength={8} /></div>
        <div className="cfg-field"><label>Peso (%)</label><input className="input-light" type="number" value={form.peso ? (form.peso * 100).toFixed(1) : ''} onChange={e=>u('peso', e.target.value ? parseFloat(e.target.value)/100 : 0)} placeholder="Auto" min="0" step="0.1" />
          <span style={{fontSize:10,color:'var(--txt3)'}}>Deixe vazio para calcular automaticamente</span>
        </div>
      </div>
      <div className="cfg-row2" style={{marginTop:10}}>
        <div className="cfg-field"><label>Gerência</label><input className="input-light" value={form.gerencia||''} onChange={e=>u('gerencia',e.target.value)} placeholder="Ex: Diretoria Financeira" /></div>
        <div className="cfg-field">
          <label>Email da Gerência</label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <label style={{display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:10,color:'var(--txt3, #94a3b8)',whiteSpace:'nowrap',padding:'0 6px',border:'1px solid var(--lt-border, rgba(0,32,62,0.12))',borderRadius:6,height:32}} title="Marque para receber o e-mail de reporte mensal">
              <input type="checkbox" checked={!!form.gerencia_recebe_email_mensal} onChange={e=>u('gerencia_recebe_email_mensal', e.target.checked)} />
              ✉ mensal
            </label>
            <input className="input-light" style={{flex:1}} type="email" value={form.gerencia_email||''} onChange={e=>u('gerencia_email',e.target.value)} placeholder="gerencia@empresa.com" />
          </div>
        </div>
      </div>
      <div className="cfg-row2" style={{marginTop:10}}>
        <div className="cfg-field"><label>Responsável da Área</label><input className="input-light" value={form.resp_area_nome||''} onChange={e=>u('resp_area_nome',e.target.value)} placeholder="Nome do responsável" /></div>
        <div className="cfg-field">
          <label>Email do Responsável</label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <label style={{display:'inline-flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:10,color:'var(--txt3, #94a3b8)',whiteSpace:'nowrap',padding:'0 6px',border:'1px solid var(--lt-border, rgba(0,32,62,0.12))',borderRadius:6,height:32}} title="Marque para receber o e-mail de reporte mensal">
              <input type="checkbox" checked={!!form.resp_area_recebe_email_mensal} onChange={e=>u('resp_area_recebe_email_mensal', e.target.checked)} />
              ✉ mensal
            </label>
            <input className="input-light" style={{flex:1}} type="email" value={form.resp_area_email||''} onChange={e=>u('resp_area_email',e.target.value)} placeholder="resp@empresa.com" />
          </div>
        </div>
      </div>

      {/* Subprocessos inline */}
      <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.08)'}}>
        <label style={{fontSize:10,fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:10,display:'block'}}>Subprocessos</label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px'}}>
          {subs.map((s,i) => (
            <input key={i} className="input-light" style={{fontSize:11}} value={s} onChange={e=>uSub(i,e.target.value)}
              placeholder={`Subprocesso ${i+1}`} />
          ))}
        </div>
        <button type="button" onClick={addMoreSubs}
          style={{background:'none',border:'none',color:'var(--copper, #CC915E)',cursor:'pointer',fontSize:11,fontWeight:500,marginTop:8,padding:'4px 0',fontFamily:'inherit'}}>
          + Mais campos
        </button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button className="btn-cfg-cancel" onClick={onCancel}>Cancelar</button>
        <button className="btn-cfg-save" onClick={handleSave} disabled={saving||!form.nome?.trim()||!form.prefixo?.trim()}>{saving?'Salvando...':'✓ Salvar'}</button>
      </div>
    </div>
  )
}


export default AreaFormV2
