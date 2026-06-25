import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logAtualizarControle } from '../lib/auditLog'
import { useConfirm } from './ConfirmDialog'

// Convenção do sistema: imp/prob gravados como RÓTULOS; crit = nível 1-4 pela
// POSIÇÃO na matriz de calor (não produto). Espelha HM_COLORS de mrc/badges.jsx.
const IMP_NUM2LABEL = { 1: 'Baixo', 2: 'Moderado', 3: 'Alto', 4: 'Crítico' }
const PROB_NUM2LABEL = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extrema' }
const IMP_LABEL2NUM = { 'Baixo': '1', 'Moderado': '2', 'Alto': '3', 'Crítico': '4' }
const PROB_LABEL2NUM = { 'Baixa': '1', 'Média': '2', 'Alta': '3', 'Extrema': '4' }
// linhas: imp 4→1 (Crítico→Baixo); colunas: prob 4→1 (Extrema→Baixa)
const MATRIZ_CRIT = {
  4: { 4: 4, 3: 4, 2: 3, 1: 2 },
  3: { 4: 4, 3: 3, 2: 2, 1: 2 },
  2: { 4: 3, 3: 2, 2: 2, 1: 1 },
  1: { 4: 2, 3: 1, 2: 1, 1: 1 },
}
const CRIT_INFO = {
  4: { label: 'Crítico',       color: '#FFEBEE', colorText: '#C62828' },
  3: { label: 'Significativo', color: '#FFCC80', colorText: '#E65100' },
  2: { label: 'Moderado',      color: '#FFF8E1', colorText: '#CA8A04' },
  1: { label: 'Baixo',         color: '#E8F5E9', colorText: '#1B5E20' },
}
function getCriticidadeLabel(crit) {
  return CRIT_INFO[crit] || { label: '', color: '', colorText: '' }
}

/**
 * Modal dedicado à avaliação de criticidade (impacto × probabilidade).
 * Spec Solicitações v2 (12/mai/2026): a criticidade saiu do ModalAtualizar /
 * ModalRegistrarResultado e ganhou modal próprio, acessado pelo alerta
 * "Criticidade Pendente" da coluna Ação.
 */
const ModalRegistrarCriticidade = ({ row, onClose, onSaved }) => {
  const [impacto, setImpacto] = useState(IMP_LABEL2NUM[row?.imp] || (/^[0-4]$/.test(String(row?.imp)) ? String(row.imp) : ''))
  const [probabilidade, setProbabilidade] = useState(PROB_LABEL2NUM[row?.prob] || (/^[0-4]$/.test(String(row?.prob)) ? String(row.prob) : ''))
  const [saving, setSaving] = useState(false)
  const { confirm } = useConfirm()
  const [dirty, setDirty] = useState(false)
  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({ title: 'Descartar alterações?', message: 'Há alterações não salvas neste formulário. Deseja fechar mesmo assim? As alterações serão perdidas.', confirmText: 'Descartar', cancelText: 'Continuar editando', variant: 'danger' })
      if (!ok) return
    }
    onClose?.()
  }

  const criticidade = (impacto && probabilidade && impacto !== '0' && probabilidade !== '0') ? MATRIZ_CRIT[parseInt(impacto)]?.[parseInt(probabilidade)] ?? null : null
  const critLabel = getCriticidadeLabel(criticidade)
  const canSave = !!impacto && !!probabilidade

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = {
        imp: impacto === '0' ? 'N/A' : IMP_NUM2LABEL[parseInt(impacto)] || null,
        prob: probabilidade === '0' ? 'N/A' : PROB_NUM2LABEL[parseInt(probabilidade)] || null,
        crit: criticidade,
        crit_label: critLabel.label || null,
        crit_revalidar: false,
        atualizado_em: new Date().toISOString(),
      }
      const { error } = await supabase.from('mrc').update(payload).eq('id', row.id)
      if (error) throw error
      logAtualizarControle?.(row, row.projeto_id)
      onSaved?.(row)
      onClose?.()
    } catch (err) {
      console.error('ModalRegistrarCriticidade:', err)
      alert('Erro ao salvar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onChangeCapture={() => setDirty(true)}>
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxWidth: 560, width: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* HEADER */}
        <div style={{ padding: '22px 24px 18px', background: '#00203E', color: 'white' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--copper-soft, #E0B894)', marginBottom: 4 }}>Matriz de Riscos · Controle</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 300, fontFamily: "'Raleway', sans-serif", letterSpacing: 0.3, lineHeight: 1.2 }}>Registrar Criticidade</div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.72, marginTop: 4 }}>{row?.rc}{row?.dr ? ` · ${row.dr}` : (row?.area ? ` · ${row.area}` : '')}</div>
            </div>
            <button onClick={requestClose} style={{ background: 'none', border: 'none', fontSize: 28, color: 'white', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {row?.cenario_atual && row.cenario_atual.trim() ? (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3, #5D6E80)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Cenário Atual</div>
              <div style={{ fontSize: 12, color: '#00203E', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{row.cenario_atual}</div>
            </div>
          ) : null}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3, #5D6E80)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Descrição do Risco</div>
            <div style={{ fontSize: 12, color: '#00203E', lineHeight: 1.5 }}>{row?.dr || '—'}</div>
          </div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lt-text3, #5D6E80)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 }}>Descrição do Controle</div>
            <div style={{ fontSize: 12, color: '#00203E', lineHeight: 1.5 }}>{row?.dc || '—'}</div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: '#00203E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #CC915E' }}>
            Avaliação da Criticidade
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#00203E', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Impacto <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <select value={impacto} onChange={e => setImpacto(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #D0D0D0', borderRadius: 4, fontFamily: 'Montserrat, sans-serif', fontSize: 14 }}>
                <option value="">Selecionar...</option>
                <option value="1">Baixo</option>
                <option value="2">Moderado</option>
                <option value="3">Alto</option>
                <option value="4">Crítico</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#00203E', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Probabilidade <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <select value={probabilidade} onChange={e => setProbabilidade(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #D0D0D0', borderRadius: 4, fontFamily: 'Montserrat, sans-serif', fontSize: 14 }}>
                <option value="">Selecionar...</option>
                <option value="1">Baixa</option>
                <option value="2">Média</option>
                <option value="3">Alta</option>
                <option value="4">Extrema</option>
              </select>
            </div>
          </div>

          {criticidade ? (
            <div style={{ background: '#F3EEE4', border: '1px solid #E0D5C7', padding: '1rem', borderRadius: 4, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ padding: '0.4rem 0.8rem', borderRadius: 4, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', background: critLabel.color, color: critLabel.colorText }}>
                {critLabel.label}
              </span>
              <span style={{ fontSize: 13, color: '#7A8B9C', fontWeight: 500 }}>
                Criticidade: {criticidade} (Impacto {impacto} × Prob {probabilidade}) / {critLabel.label}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--lt-text3, #5D6E80)', fontStyle: 'italic' }}>
              Selecione Impacto e Probabilidade para ver a criticidade calculada.
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', gap: 8, padding: 24, borderTop: '1px solid #e5e7eb', background: '#fafbfc' }}>
          <button onClick={requestClose} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#00203E' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{ flex: 1, padding: '12px 16px', border: 'none', borderRadius: 6, fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, cursor: !canSave || saving ? 'not-allowed' : 'pointer', background: '#CC915E', color: 'white', opacity: !canSave || saving ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar Criticidade'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalRegistrarCriticidade
