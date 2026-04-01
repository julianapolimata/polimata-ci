import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIAS = ['Autorização','Relatórios de Exceção','Indicadores de Performance','Interface/Conversão','Revisão Gerencial','Reconciliação','Acesso','Segregação de Funções','Configuração','N/A']
const FREQUENCIAS = ['Sob demanda','Diário','Múltiplas vezes ao dia','Semanal','Quinzenal','Mensal','Trimestral','Semestral','Anual','N/A']
const NATUREZAS = ['Preventivo','Detectivo','N/A']
const CARACTERISTICAS = ['Manual','Semi-Automatizado','Automatizado','N/A']
const SISTEMAS = ['IBID','Fluig','Totvs Data Sul','N/A']
const CTRL_CHAVE = ['Sim','Não','N/A']

const PREMISSAS = [
  { key: 'premissa_porque', title: 'Por quê?', placeholder: 'Propósito do controle...', tooltip: 'Qual o propósito desta atividade? O que ela agrega ao processo? Descreva a razão de existir deste controle.' },
  { key: 'premissa_quando', title: 'Quando?', placeholder: 'Frequência de execução...', tooltip: 'Com qual frequência esta atividade deve ser realizada? Diariamente, semanalmente, sob demanda, etc.' },
  { key: 'premissa_onde', title: 'Onde?', placeholder: 'Local de registro...', tooltip: 'Em qual local essa atividade fica registrada? Sistema, planilha, documento físico, plataforma, etc.' },
  { key: 'premissa_quem', title: 'Quem?', placeholder: 'Responsável pela execução...', tooltip: 'No processo, quem é o responsável por executar esta atividade? Cargo ou nome do responsável. Desabilitado para controles automatizados.', disableOnAuto: true },
  { key: 'premissa_como', title: 'Como?', placeholder: 'Passo a passo...', tooltip: 'Qual o passo a passo para realizar esta atividade? Descreva o procedimento de execução do controle.' },
  { key: 'premissa_resultado', title: 'Qual o resultado?', placeholder: 'Produto final esperado...', tooltip: 'Qual o "produto final" gerado por esta atividade? Relatório, aprovação, registro, evidência, etc.' },
]

function isEfetivo(r) { return (r || '').toLowerCase() === 'efetivo' }

function getProximaFase(row) {
  // F1 Efetivo → atalho F3
  if (!row.r3 && !row.r_ader && !row.st_pa) {
    if (isEfetivo(row.r1)) return { label: 'F3 — Controles Internos', cls: 'f3' }
    return { label: 'F2-E1 — Plano de Ação', cls: 'f2' }
  }
  if (row.st_pa && !row.r_ader) {
    return { label: 'F2-E2 — Teste de Aderência', cls: 'f2' }
  }
  if (row.r_ader && !row.r3) {
    if (isEfetivo(row.r_ader)) return { label: 'F3 — Controles Internos', cls: 'f3' }
    return { label: 'F2-E1 — Plano de Ação', cls: 'f2' }
  }
  if (row.r3) {
    if (isEfetivo(row.r3)) return { label: 'F4 — Auditoria Contínua', cls: 'f4' }
    return { label: 'F2-E1 — Plano de Ação', cls: 'f2' }
  }
  return { label: 'F1 — Diagnóstico', cls: 'f1' }
}

function getFaseAtualLabel(row) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado') return 'F3 — Controles Internos'
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado') return 'F2-E2 — Teste de Aderência'
  if (row.st_pa && row.st_pa !== '') return 'F2-E1 — Plano de Ação'
  return 'F1 — Diagnóstico'
}

function getResultadoAtual(row) {
  if (row.r3 && row.r3 !== 'Teste Não Realizado') return row.r3
  if (row.r_ader && row.r_ader !== 'Teste Não Realizado') return row.r_ader
  if (row.r1 && row.r1 !== 'Teste Não Realizado') return row.r1
  return 'Teste Não Realizado'
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ModalAtualizar({ row, onClose, onSaved, areas, projetoId }) {
  const { perfil } = useAuth()

  // Steps
  const [step, setStep] = useState(1)

  // Step 1
  const [riscoChoice, setRiscoChoice] = useState(null) // 'nao' | 'sim'
  const [statusChoice, setStatusChoice] = useState(null) // 'existente' | 'evitado' | 'transferido'
  const [novaDescRisco, setNovaDescRisco] = useState(row.dr || '')
  const [motivoInativacao, setMotivoInativacao] = useState('')
  const [areaDestino, setAreaDestino] = useState('')
  const [subDestino, setSubDestino] = useState('')
  const [gerDestino, setGerDestino] = useState('')
  const [respDestino, setRespDestino] = useState('')

  // Step 2
  const [controleChoice, setControleChoice] = useState(null) // 'nao' | 'sim'
  const [editDc, setEditDc] = useState(row.dc || '')
  const [editCat, setEditCat] = useState(row.cat || 'N/A')
  const [editFreq, setEditFreq] = useState(row.freq || 'N/A')
  const [editNat, setEditNat] = useState(row.nat || 'N/A')
  const [editCar, setEditCar] = useState(row.car || 'N/A')
  const [editSis, setEditSis] = useState(row.sis || 'N/A')
  const [editChave, setEditChave] = useState(row.chave || 'N/A')
  const [premissas, setPremissas] = useState({
    premissa_porque: row.premissa_porque || '',
    premissa_quando: row.premissa_quando || '',
    premissa_onde: row.premissa_onde || '',
    premissa_quem: row.premissa_quem || '',
    premissa_como: row.premissa_como || '',
    premissa_resultado: row.premissa_resultado || '',
  })

  // UI
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Dados auxiliares
  const [gerentes, setGerentes] = useState([])
  const [responsaveis, setResponsaveis] = useState([])
  const [subprocessos, setSubprocessos] = useState([])

  useEffect(() => {
    if (!projetoId) return
    loadAuxData()
  }, [projetoId])

  async function loadAuxData() {
    // Buscar gerentes e responsáveis únicos da MRC do projeto
    const { data } = await supabase.from('mrc').select('ger, resp_sub, sub').eq('projeto_id', projetoId).eq('ativo', true)
    if (data) {
      setGerentes([...new Set(data.map(d => d.ger).filter(Boolean))].sort())
      setResponsaveis([...new Set(data.map(d => d.resp_sub).filter(Boolean))].sort())
      setSubprocessos([...new Set(data.map(d => d.sub).filter(Boolean))].sort())
    }
  }

  const isAutomatic = editCar === 'Automatizado'
  const faseAtual = getFaseAtualLabel(row)
  const resultadoAtual = getResultadoAtual(row)
  const proximaFase = getProximaFase(row)

  // ═══ NAVIGATION ═══
  function nextStep() { if (step < 3) setStep(step + 1) }
  function prevStep() { if (step > 1) setStep(step - 1) }

  const isEndFlow = riscoChoice === 'sim' && (statusChoice === 'evitado' || statusChoice === 'transferido')

  const canAdvanceStep1 = riscoChoice === 'nao' || (riscoChoice === 'sim' && statusChoice === 'existente')
  const canAdvanceStep2 = controleChoice !== null

  // ═══ SAVE FUNCTIONS ═══
  async function handleEvitar() {
    if (!motivoInativacao.trim()) return alert('Preencha a justificativa.')
    setSaving(true)
    const updates = {
      status_risco: 'evitado',
      motivo_inativacao: motivoInativacao,
      ativo: false,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id,
    }
    await supabase.from('mrc').update(updates).eq('id', row.id)
    await logAudit(row.id, 'status_risco', 'existente', 'evitado')
    await logAudit(row.id, 'ativo', 'true', 'false')
    setSaving(false)
    onSaved?.()
    onClose()
  }

  async function handleTransferir() {
    if (!areaDestino || !subDestino) return alert('Selecione área e subprocesso de destino.')
    setSaving(true)

    // Encontrar área destino
    const areaDest = areas.find(a => a.nome === areaDestino)
    if (!areaDest) { setSaving(false); return alert('Área não encontrada.') }

    // Gerar menor referência disponível
    const prefixo = areaDest.prefixo || areaDestino.substring(0, 3).toUpperCase()
    const { data: existentes } = await supabase
      .from('mrc')
      .select('rr, rc')
      .eq('area_id', areaDest.id)
      .eq('projeto_id', projetoId)
      .eq('ativo', true)

    const novaRefRisco = gerarMenorRef('R', prefixo, (existentes || []).map(e => e.rr))
    const novaRefControle = gerarMenorRef('C', prefixo, (existentes || []).map(e => e.rc))

    // Criar cópia na nova área
    const copia = { ...row }
    delete copia.id
    delete copia.criado_em
    delete copia.atualizado_em
    copia.area_id = areaDest.id
    copia.area = areaDestino
    copia.sub = subDestino
    copia.ger = gerDestino || copia.ger
    copia.resp_sub = respDestino || copia.resp_sub
    copia.rr = novaRefRisco
    copia.rc = novaRefControle
    copia.transferido_de = row.id
    copia.ref_anterior = row.rr
    copia.status_risco = 'existente'
    copia.ativo = true
    copia.criado_em = new Date().toISOString()
    copia.atualizado_em = new Date().toISOString()
    copia.criado_por = perfil?.id
    copia.atualizado_por = perfil?.id

    await supabase.from('mrc').insert([copia])

    // Inativar original
    await supabase.from('mrc').update({
      status_risco: 'transferido',
      ativo: false,
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id,
    }).eq('id', row.id)

    await logAudit(row.id, 'status_risco', 'existente', 'transferido')
    await logAudit(row.id, 'ativo', 'true', 'false')

    setSaving(false)
    onSaved?.()
    onClose()
  }

  async function handleSalvarComFicha() {
    const ok = await salvarAlteracoes('em_analise')
    if (ok) gerarFichaExcel()
  }

  async function handleSalvarSemFicha() {
    await salvarAlteracoes('teste_pendente')
  }

  async function salvarAlteracoes(statusWorkflow) {
    setSaving(true)
    const updates = {
      atualizado_em: new Date().toISOString(),
      atualizado_por: perfil?.id,
      status_workflow: statusWorkflow,
    }

    // Step 1: risco editado
    if (riscoChoice === 'sim' && statusChoice === 'existente') {
      if (novaDescRisco !== row.dr) {
        updates.dr = novaDescRisco
        await logAudit(row.id, 'dr', row.dr, novaDescRisco)
      }
    }

    // Step 2: controle editado
    if (controleChoice === 'sim') {
      const campos = { dc: editDc, cat: editCat, freq: editFreq, nat: editNat, car: editCar, sis: editSis, chave: editChave }
      for (const [campo, valor] of Object.entries(campos)) {
        if (valor !== row[campo]) {
          updates[campo] = valor
          await logAudit(row.id, campo, row[campo], valor)
        }
      }
      // Premissas
      for (const p of PREMISSAS) {
        const val = premissas[p.key]
        if (val !== (row[p.key] || '')) {
          updates[p.key] = val
          await logAudit(row.id, p.key, row[p.key] || '', val)
        }
      }
    }

    const { error } = await supabase.from('mrc').update(updates).eq('id', row.id)
    if (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar: ' + error.message)
      setSaving(false)
      return false
    }
    setSaving(false)
    onSaved?.()
    onClose()
    return true
  }

  function gerarFichaExcel() {
    // Dados consolidados (do form ou do row original)
    const dc = controleChoice === 'sim' ? editDc : row.dc
    const dr = (riscoChoice === 'sim' && statusChoice === 'existente') ? novaDescRisco : row.dr
    const cat = controleChoice === 'sim' ? editCat : row.cat
    const freq = controleChoice === 'sim' ? editFreq : row.freq
    const nat = controleChoice === 'sim' ? editNat : row.nat
    const car = controleChoice === 'sim' ? editCar : row.car
    const sis = controleChoice === 'sim' ? editSis : row.sis
    const chave = controleChoice === 'sim' ? editChave : row.chave
    const prems = controleChoice === 'sim' ? premissas : {
      premissa_porque: row.premissa_porque || '',
      premissa_quando: row.premissa_quando || '',
      premissa_onde: row.premissa_onde || '',
      premissa_quem: row.premissa_quem || '',
      premissa_como: row.premissa_como || '',
      premissa_resultado: row.premissa_resultado || '',
    }

    // Construir CSV como fallback simples (funciona sem ExcelJS)
    // Header + dados pré-preenchidos no formato da ficha
    const linhas = [
      'POLÍMATA · CONSULTORIA EM GRC',
      'FICHA DE RISCO — EXECUÇÃO DO TESTE',
      '',
      'IDENTIFICAÇÃO',
      `Área / Processo,${row.area || ''}`,
      `Subprocesso,${row.sub || ''}`,
      `Ref. Risco,${row.rr || ''}`,
      `Ref. Controle,${row.rc || ''}`,
      `Gerência,${row.ger || ''}`,
      `Responsável Subprocesso,${row.resp_sub || ''}`,
      `Descrição do Risco,"${(dr || '').replace(/"/g, '""')}"`,
      `Descrição do Controle,"${(dc || '').replace(/"/g, '""')}"`,
      '',
      'ATRIBUTOS DO CONTROLE',
      `Categoria,${cat || ''}`,
      `Frequência,${freq || ''}`,
      `Natureza,${nat || ''}`,
      `Característica,${car || ''}`,
      `Sistema,${sis || ''}`,
      `Controle Chave?,${chave || ''}`,
      '',
      'PRÓXIMA FASE',
      `Fase,${proximaFase.label}`,
      `Profissional,${perfil?.nome || ''}`,
      `Data de Geração,${new Date().toLocaleDateString('pt-BR')}`,
      '',
      '1. AS 6 PREMISSAS DO CONTROLE',
      `1. Quem faz,"${(prems.premissa_quem || '').replace(/"/g, '""')}"`,
      `2. Quando faz,"${(prems.premissa_quando || '').replace(/"/g, '""')}"`,
      `3. Por quê faz,"${(prems.premissa_porque || '').replace(/"/g, '""')}"`,
      `4. Como faz,"${(prems.premissa_como || '').replace(/"/g, '""')}"`,
      `5. Onde faz,"${(prems.premissa_onde || '').replace(/"/g, '""')}"`,
      `6. Qual o resultado,"${(prems.premissa_resultado || '').replace(/"/g, '""')}"`,
      '',
      '2. PASSOS DE TESTE',
      'Atividade / Passo,Status (a/r/NA),Observação',
      'Passo 1,,',
      'Passo 2,,',
      'Passo 3,,',
      'Passo 4,,',
      'Passo 5,,',
      'Passo 6,,',
      'Passo 7,,',
      'Passo 8,,',
      'Passo 9,,',
      'Passo 10,,',
      '',
      '3. CONCLUSÃO E RESULTADO',
      'Conclusão,',
      'Inconsistência Identificada,',
      'Recomendação / Melhoria,',
      '',
      'RESULTADO,',
      'Melhoria Identificada?,',
      'Descrição da Melhoria,',
      '',
      '4. EXECUÇÃO DO TESTE E EVIDÊNCIAS',
      '(inserir tabelas ou listas ou amostras testadas abaixo)',
    ]

    const csvContent = '\uFEFF' + linhas.join('\n') // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Ficha_de_Risco_${row.rc || 'controle'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function logAudit(mrcId, campo, anterior, novo) {
    try {
      await supabase.from('mrc_audit_log').insert([{
        mrc_id: mrcId,
        campo,
        valor_anterior: anterior || '',
        valor_novo: novo || '',
        usuario_id: perfil?.id,
      }])
    } catch (e) { /* silently fail if table doesn't exist yet */ }
  }

  // ═══ HELPERS ═══
  function gerarMenorRef(prefixoTipo, prefixoArea, existentes) {
    const pattern = new RegExp(`^${prefixoTipo}\\.${prefixoArea}\\.(\\d+)$`)
    const nums = new Set((existentes || []).filter(Boolean).map(r => {
      const m = r.match(pattern)
      return m ? parseInt(m[1]) : null
    }).filter(n => n !== null))

    for (let i = 1; i <= 999; i++) {
      if (!nums.has(i)) return `${prefixoTipo}.${prefixoArea}.${String(i).padStart(2, '0')}`
    }
    return `${prefixoTipo}.${prefixoArea}.999`
  }

  if (!row) return null

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* Confirm close dialog */}
      {showConfirm && (
        <div style={O.confirmOverlay} onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
          <div style={O.confirmDialog}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#00203E', marginBottom: 8 }}>Deseja sair?</h3>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>As alterações não salvas serão perdidas. Tem certeza que deseja fechar?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button style={{ ...O.btn, ...O.btnPrimary }} onClick={() => setShowConfirm(false)}>Continuar editando</button>
              <button style={{ ...O.btn, ...O.btnGhost }} onClick={onClose}>Sair sem salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Main overlay */}
      <div style={O.overlay} onClick={e => e.target === e.currentTarget && setShowConfirm(true)}>
        <div style={O.modal}>

          {/* Header */}
          <div style={O.header}>
            <div>
              <div style={O.headerTitle}>Atualizar Controle</div>
              <div style={O.headerSub}>{row.rc} · {row.area} · {row.sub}</div>
            </div>
            <button style={O.closeBtn} onClick={() => setShowConfirm(true)}>×</button>
          </div>

          {/* Stepper */}
          <div style={O.stepper}>
            {[
              { n: 1, label: 'Risco' },
              { n: 2, label: 'Controle' },
              { n: 3, label: 'Executar Teste' },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'contents' }}>
                {i > 0 && <div style={{ ...O.connector, ...(step > s.n - 1 ? { background: '#1B5E20' } : {}) }} />}
                <div
                  style={{ ...O.stepItem, ...(step === s.n ? {} : step > s.n ? { cursor: 'pointer' } : { opacity: 0.35, pointerEvents: 'none' }) }}
                  onClick={() => { if (s.n <= step) setStep(s.n) }}
                >
                  <div style={{
                    ...O.stepNum,
                    ...(step === s.n ? { background: '#00203E', color: '#fff', boxShadow: '0 0 0 3px rgba(0,32,62,0.2)' }
                      : step > s.n ? { background: '#1B5E20', color: '#fff' }
                      : {})
                  }}>
                    {step > s.n ? '✓' : s.n}
                  </div>
                  <div style={{
                    ...O.stepLabel,
                    ...(step === s.n ? { color: '#00203E' } : step > s.n ? { color: '#1B5E20' } : {})
                  }}>
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Body */}
          <div style={O.body}>

            {/* ═══ STEP 1 ═══ */}
            {step === 1 && (
              <div>
                {/* Context card */}
                <div style={O.ctxCard}>
                  <div style={O.ctxRow}>
                    <CtxItem label="Ref. Risco" value={row.rr} />
                    <CtxItem label="Ref. Controle" value={row.rc} />
                    <CtxItem label="Fase Atual" value={<span style={{ ...O.badgeFase, borderColor: 'var(--f1c,#00203E)', background: 'rgba(0,32,62,0.06)', color: '#00203E' }}>{faseAtual}</span>} />
                    <CtxItem label="Resultado" value={<ResultBadge r={resultadoAtual} />} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={O.ctxLabel}>Descrição do Risco</div>
                    <div style={{ fontSize: 11, color: '#333', marginTop: 2, lineHeight: 1.6 }}>{row.dr}</div>
                  </div>
                </div>

                {/* Question */}
                <div style={{ marginBottom: 20 }}>
                  <div style={O.qLabel}>Houve alteração no descritivo do risco?</div>
                  <div style={O.choices}>
                    <ChoiceBtn selected={riscoChoice === 'nao'} onClick={() => { setRiscoChoice('nao'); setStatusChoice(null) }} icon="✓" label="Não, manter como está" />
                    <ChoiceBtn selected={riscoChoice === 'sim'} onClick={() => setRiscoChoice('sim')} icon="✎" label="Sim, houve alteração" />
                  </div>
                </div>

                {/* Sub: status */}
                {riscoChoice === 'sim' && (
                  <div>
                    <div style={O.divider} />
                    <div style={{ marginBottom: 20 }}>
                      <div style={O.qLabel}>Qual o novo status do risco?</div>
                      <div style={O.choices}>
                        <ChoiceBtn selected={statusChoice === 'existente'} onClick={() => setStatusChoice('existente')} icon="📝" label="Existente" sublabel="— editar descritivo" />
                        <ChoiceBtn selected={statusChoice === 'evitado'} onClick={() => setStatusChoice('evitado')} icon="🚫" label="Evitado" sublabel="— descontinuar" variant="danger" />
                        <ChoiceBtn selected={statusChoice === 'transferido'} onClick={() => setStatusChoice('transferido')} icon="↗" label="Transferido" sublabel="— mover para outra área" variant="warn" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Existente: editar */}
                {riscoChoice === 'sim' && statusChoice === 'existente' && (
                  <FormSection title="Editar descritivo do risco">
                    <Field label="Nova descrição do risco">
                      <textarea style={O.textarea} rows={3} value={novaDescRisco} onChange={e => setNovaDescRisco(e.target.value)} />
                    </Field>
                  </FormSection>
                )}

                {/* Evitado */}
                {riscoChoice === 'sim' && statusChoice === 'evitado' && (
                  <FormSection>
                    <InfoBox type="danger" icon="⚠">
                      <strong>Atenção:</strong> Ao marcar como evitado, a linha será <strong>inativada</strong> e a referência {row.rr} ficará disponível para reutilização. O controle {row.rc} também será inativado. Esta ação pode ser revertida pelo administrador.
                    </InfoBox>
                    <Field label="Justificativa da descontinuação *" hint="Obrigatório. Ficará registrado no histórico de alterações.">
                      <textarea style={O.textarea} rows={3} placeholder="Explique por que o risco foi evitado..." value={motivoInativacao} onChange={e => setMotivoInativacao(e.target.value)} />
                    </Field>
                  </FormSection>
                )}

                {/* Transferido */}
                {riscoChoice === 'sim' && statusChoice === 'transferido' && (
                  <FormSection>
                    <InfoBox type="info" icon="ℹ">
                      O risco e seu controle serão copiados para a área de destino com nova referência. A linha original será inativada.
                    </InfoBox>
                    <div style={O.formSectionTitle}><span style={O.formTitleBar} />Destino da transferência</div>
                    <div style={O.grid2}>
                      <Field label="Área de destino *">
                        <select style={O.select} value={areaDestino} onChange={e => setAreaDestino(e.target.value)}>
                          <option value="">Selecione a área...</option>
                          {areas.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
                        </select>
                      </Field>
                      <Field label="Subprocesso *">
                        <select style={O.select} value={subDestino} onChange={e => setSubDestino(e.target.value)}>
                          <option value="">Selecione o subprocesso...</option>
                          {subprocessos.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div style={{ ...O.grid2, marginTop: 12 }}>
                      <Field label="Gerência responsável *">
                        <select style={O.select} value={gerDestino} onChange={e => setGerDestino(e.target.value)}>
                          <option value="">Selecione o gerente...</option>
                          {gerentes.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </Field>
                      <Field label="Responsável Subprocesso *">
                        <select style={O.select} value={respDestino} onChange={e => setRespDestino(e.target.value)}>
                          <option value="">Selecione o responsável...</option>
                          {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </Field>
                    </div>
                    <InfoBox type="warn" icon="💡" style={{ marginTop: 14 }}>
                      A nova referência será gerada automaticamente (menor disponível na área destino).
                    </InfoBox>
                  </FormSection>
                )}
              </div>
            )}

            {/* ═══ STEP 2 ═══ */}
            {step === 2 && (
              <div>
                <div style={O.ctxCard}>
                  <div style={O.ctxRow}>
                    <CtxItem label="Ref. Controle" value={row.rc} />
                    <CtxItem label="Área" value={row.area} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={O.ctxLabel}>Descrição do Controle</div>
                    <div style={{ fontSize: 11, color: '#333', marginTop: 2, lineHeight: 1.6 }}>{row.dc}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={O.qLabel}>Houve alteração no descritivo do controle?</div>
                  <div style={O.choices}>
                    <ChoiceBtn selected={controleChoice === 'nao'} onClick={() => setControleChoice('nao')} icon="✓" label="Não, manter como está" />
                    <ChoiceBtn selected={controleChoice === 'sim'} onClick={() => setControleChoice('sim')} icon="✎" label="Sim, houve alteração" />
                  </div>
                </div>

                {controleChoice === 'sim' && (
                  <FormSection title="Editar atributos do controle">
                    <Field label="Descrição do Controle *">
                      <textarea style={O.textarea} rows={3} value={editDc} onChange={e => setEditDc(e.target.value)} />
                    </Field>

                    <div style={O.fieldRow}>
                      <Field label="Categoria"><SelectField value={editCat} onChange={setEditCat} options={CATEGORIAS} /></Field>
                      <Field label="Frequência"><SelectField value={editFreq} onChange={setEditFreq} options={FREQUENCIAS} /></Field>
                    </div>
                    <div style={O.fieldRow}>
                      <Field label="Natureza"><SelectField value={editNat} onChange={setEditNat} options={NATUREZAS} /></Field>
                      <Field label="Característica"><SelectField value={editCar} onChange={v => { setEditCar(v); if (v === 'Automatizado') setPremissas(p => ({ ...p, premissa_quem: '' })) }} options={CARACTERISTICAS} /></Field>
                    </div>
                    <div style={O.fieldRow}>
                      <Field label="Sistema utilizado"><SelectField value={editSis} onChange={setEditSis} options={SISTEMAS} /></Field>
                      <Field label="Controle Chave?"><SelectField value={editChave} onChange={setEditChave} options={CTRL_CHAVE} /></Field>
                    </div>

                    {/* 6 Premissas */}
                    <div style={O.divider} />
                    <div style={O.formSectionTitle}><span style={O.formTitleBar} />Premissas do Controle</div>
                    <InfoBox type="info" icon="ℹ">
                      Responda as 6 perguntas que caracterizam o controle. Passe o mouse sobre o <strong>ⓘ</strong> para ver a explicação de cada pergunta.
                    </InfoBox>

                    <div style={O.premissasGrid}>
                      {PREMISSAS.map(p => {
                        const isDisabled = p.disableOnAuto && isAutomatic
                        return (
                          <div key={p.key} style={{ ...O.perguntaCard, ...(isDisabled ? { opacity: 0.45 } : {}) }}>
                            <div style={O.perguntaHeader}>
                              <span style={O.perguntaTitle}>{p.title}</span>
                              <Tooltip text={p.tooltip} />
                            </div>
                            <textarea
                              style={{ ...O.perguntaTextarea, ...(isDisabled ? { background: '#f5f3ef', color: '#bbb', cursor: 'not-allowed' } : {}) }}
                              placeholder={isDisabled ? 'Desabilitado para controles automatizados' : p.placeholder}
                              disabled={isDisabled}
                              value={premissas[p.key]}
                              onChange={e => setPremissas(prev => ({ ...prev, [p.key]: e.target.value }))}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </FormSection>
                )}
              </div>
            )}

            {/* ═══ STEP 3 ═══ */}
            {step === 3 && (
              <div>
                <InfoBox type="success" icon="✓">
                  Risco e controle confirmados. Agora gere a <strong>Ficha de Risco</strong> para executar o teste do controle.
                </InfoBox>

                <div style={O.formSectionTitle}><span style={O.formTitleBar} />Dados que serão incluídos na ficha</div>
                <table style={O.previewTable}>
                  <tbody>
                    <PreviewRow label="Área / Processo" value={row.area} />
                    <PreviewRow label="Subprocesso" value={row.sub} />
                    <PreviewRow label="Ref. Risco" value={row.rr} gold />
                    <PreviewRow label="Ref. Controle" value={row.rc} gold />
                    <PreviewRow label="Descrição do Risco" value={riscoChoice === 'sim' && statusChoice === 'existente' ? novaDescRisco : row.dr} truncate />
                    <PreviewRow label="Descrição do Controle" value={controleChoice === 'sim' ? editDc : row.dc} truncate />
                    <PreviewRow label="Categoria" value={controleChoice === 'sim' ? editCat : row.cat} />
                    <PreviewRow label="Frequência" value={controleChoice === 'sim' ? editFreq : row.freq} />
                    <PreviewRow label="Natureza" value={controleChoice === 'sim' ? editNat : row.nat} />
                    <PreviewRow label="Característica" value={controleChoice === 'sim' ? editCar : row.car} />
                    <tr>
                      <td style={O.previewLabel}>Próxima Fase</td>
                      <td style={O.previewValue}>
                        <span style={{ ...O.badgeFase, borderColor: proximaFase.cls === 'f3' ? '#660033' : proximaFase.cls === 'f2' ? '#1D3B5C' : proximaFase.cls === 'f4' ? '#660066' : '#00203E', background: 'rgba(0,32,62,0.06)', color: '#00203E' }}>
                          {proximaFase.label}
                        </span>
                      </td>
                    </tr>
                    <PreviewRow label="Profissional" value={perfil?.nome || 'Usuário'} />
                    <PreviewRow label="Data de Geração" value={new Date().toLocaleDateString('pt-BR')} />
                  </tbody>
                </table>

                {/* Primary: Salvar e Baixar */}
                <div style={O.fichaCard} onClick={!saving ? handleSalvarComFicha : undefined}>
                  <div style={O.fichaIcon}>📋</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: '#F3EEE4', marginBottom: 2 }}>Salvar e Baixar Ficha de Risco</h4>
                    <p style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.4, color: '#F3EEE4' }}>
                      Ficha_de_Risco_{row.rc}.xlsx — pré-preenchida com os dados acima.<br />
                      Salva as alterações e baixa a ficha automaticamente.
                    </p>
                  </div>
                  <div style={O.fichaBadge}>.xlsx</div>
                </div>

                {/* Secondary: Salvar sem ficha */}
                <div style={O.fichaSecondary} onClick={!saving ? handleSalvarSemFicha : undefined}>
                  <div style={{ ...O.fichaIcon, background: 'rgba(0,32,62,0.06)', color: '#00203E', fontSize: 18 }}>💾</div>
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 2 }}>Salvar sem gerar ficha</h4>
                    <p style={{ fontSize: 10, color: '#999', lineHeight: 1.4 }}>Salva as alterações, mas o teste ficará marcado como pendente.</p>
                  </div>
                </div>

                <div style={O.divider} />

                <InfoBox type="info" icon="📌">
                  Ao salvar com ficha, o controle receberá o status <span style={O.badgeAnalise}>Em Análise</span> até que o resultado do teste seja registrado.
                  <br />Ao salvar sem ficha, o controle será marcado como <span style={O.badgePendente}>Teste Pendente</span>.
                </InfoBox>
              </div>
            )}

          </div>

          {/* Footer */}
          <div style={O.footer}>
            <button style={{ ...O.btn, ...O.btnGhost, ...O.btnSm }} onClick={() => setShowConfirm(true)}>Cancelar</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 1 && !isEndFlow && (
                <button style={{ ...O.btn, ...O.btnGhost, ...O.btnSm }} onClick={prevStep}>← Voltar</button>
              )}

              {/* Próximo (steps 1-2, not end flows) */}
              {step === 1 && !isEndFlow && canAdvanceStep1 && (
                <button style={{ ...O.btn, ...O.btnPrimary }} onClick={nextStep} disabled={!canAdvanceStep1}>Próximo →</button>
              )}
              {step === 2 && (
                <button style={{ ...O.btn, ...O.btnPrimary }} onClick={nextStep} disabled={!canAdvanceStep2}>Próximo →</button>
              )}

              {/* End flow buttons */}
              {step === 1 && statusChoice === 'evitado' && (
                <button style={{ ...O.btn, ...O.btnDanger }} onClick={handleEvitar} disabled={saving}>
                  {saving ? 'Salvando...' : 'Confirmar Inativação'}
                </button>
              )}
              {step === 1 && statusChoice === 'transferido' && (
                <button style={{ ...O.btn, ...O.btnPrimary }} onClick={handleTransferir} disabled={saving}>
                  {saving ? 'Salvando...' : 'Confirmar Transferência'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function CtxItem({ label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      <div style={O.ctxLabel}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#00203E' }}>{value}</div>
    </div>
  )
}

function ResultBadge({ r }) {
  if (!r || r === 'Teste Não Realizado') return <span style={{ ...O.badge, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{r || '—'}</span>
  if ((r || '').toLowerCase() === 'efetivo') return <span style={{ ...O.badge, background: 'rgba(27,94,32,0.08)', color: '#1B5E20' }}>Efetivo</span>
  if ((r || '').toLowerCase() === 'inefetivo') return <span style={{ ...O.badge, background: 'rgba(183,28,28,0.08)', color: '#B71C1C' }}>Inefetivo</span>
  if ((r || '').toLowerCase().includes('gap')) return <span style={{ ...O.badge, background: 'rgba(230,81,0,0.08)', color: '#E65100' }}>GAP</span>
  return <span style={{ ...O.badge, background: 'rgba(0,0,0,0.04)', color: '#999' }}>{r}</span>
}

function ChoiceBtn({ selected, onClick, icon, label, sublabel, variant }) {
  const base = { ...O.choiceBtn }
  if (selected) {
    if (variant === 'danger') Object.assign(base, { borderColor: '#B71C1C', background: 'rgba(183,28,28,0.08)', color: '#B71C1C' })
    else if (variant === 'warn') Object.assign(base, { borderColor: '#E65100', background: 'rgba(230,81,0,0.08)', color: '#E65100' })
    else Object.assign(base, { borderColor: '#00203E', background: 'rgba(0,32,62,0.06)', color: '#00203E' })
  }
  return (
    <button style={base} onClick={onClick}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      {label}
      {sublabel && <span style={{ fontWeight: 400, fontSize: 10, color: '#999' }}>{sublabel}</span>}
    </button>
  )
}

function FormSection({ title, children }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e0d8' }}>
      {title && <div style={O.formSectionTitle}><span style={O.formTitleBar} />{title}</div>}
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      {label && <label style={O.fieldLabel}>{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function SelectField({ value, onChange, options }) {
  return (
    <select style={O.select} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function InfoBox({ type, icon, children, style: extraStyle }) {
  const colors = {
    danger: { bg: 'rgba(183,28,28,0.08)', color: '#B71C1C', border: 'rgba(183,28,28,0.15)' },
    warn: { bg: 'rgba(249,168,37,0.08)', color: '#7A6000', border: 'rgba(249,168,37,0.2)' },
    success: { bg: 'rgba(27,94,32,0.08)', color: '#1B5E20', border: 'rgba(27,94,32,0.15)' },
    info: { bg: 'rgba(0,32,62,0.04)', color: '#00203E', border: 'rgba(0,32,62,0.1)' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{ padding: '10px 14px', borderRadius: 4, fontSize: 11, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, background: c.bg, color: c.color, border: `1px solid ${c.border}`, ...extraStyle }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>{children}</div>
    </div>
  )
}

function Tooltip({ text }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={O.tooltipIcon} title={text}>i</span>
    </span>
  )
}

function PreviewRow({ label, value, gold, truncate }) {
  const v = truncate && value && value.length > 80 ? value.slice(0, 80) + '...' : value
  return (
    <tr>
      <td style={O.previewLabel}>{label}</td>
      <td style={{ ...O.previewValue, ...(gold ? { color: '#CC915E', fontWeight: 600 } : {}) }}>{v || '—'}</td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const O = {
  // Overlay & Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,17,44,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,17,44,0.12)', width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },

  // Header
  header: { background: '#00203E', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  headerTitle: { fontSize: 14, fontWeight: 700, color: '#F3EEE4' },
  headerSub: { fontSize: 10, color: 'rgba(243,238,228,0.6)', fontWeight: 400 },
  closeBtn: { width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#F3EEE4', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Stepper
  stepper: { display: 'flex', alignItems: 'center', padding: '14px 24px', background: 'rgba(0,32,62,0.04)', borderBottom: '1px solid #e5e0d8', flexShrink: 0 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
  stepNum: { width: 26, height: 26, borderRadius: '50%', background: '#ddd', color: '#999', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' },
  stepLabel: { fontSize: 10, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' },
  connector: { flex: 1, height: 2, background: '#ddd', margin: '0 12px', minWidth: 20, transition: 'background 0.2s' },

  // Body
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 },

  // Context card
  ctxCard: { background: 'rgba(0,32,62,0.04)', borderRadius: 4, padding: '12px 16px', marginBottom: 20, borderLeft: '3px solid #CC915E' },
  ctxRow: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  ctxLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#999', marginBottom: 2 },

  // Questions
  qLabel: { fontSize: 12, fontWeight: 600, color: '#00203E', marginBottom: 10 },
  choices: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  choiceBtn: { padding: '10px 18px', borderRadius: 4, border: '2px solid #e5e0d8', background: '#fff', fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' },

  // Forms
  formSectionTitle: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#00203E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  formTitleBar: { display: 'inline-block', width: 3, height: 14, background: '#CC915E', borderRadius: 2 },
  fieldLabel: { display: 'block', fontSize: 10, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  fieldRow: { display: 'flex', gap: 12, marginBottom: 12 },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #e5e0d8', borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: '#333', background: '#fff', outline: 'none', resize: 'vertical', minHeight: 64, lineHeight: 1.6 },
  select: { width: '100%', padding: '8px 12px', border: '1px solid #e5e0d8', borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: '#333', background: '#fff', outline: 'none', cursor: 'pointer' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  divider: { height: 1, background: '#e5e0d8', margin: '16px 0' },

  // Premissas
  premissasGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 },
  perguntaCard: { background: 'rgba(0,32,62,0.04)', border: '1px solid #e5e0d8', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  perguntaHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  perguntaTitle: { fontSize: 11, fontWeight: 700, color: '#00203E', textTransform: 'uppercase' },
  perguntaTextarea: { width: '100%', padding: '6px 10px', border: '1px solid #e5e0d8', borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: '#333', background: '#fff', outline: 'none', resize: 'vertical', minHeight: 52, lineHeight: 1.5 },
  tooltipIcon: { width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,32,62,0.08)', color: '#00203E', fontSize: 10, fontWeight: 700, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' },

  // Badges
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 3, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },
  badgeFase: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600, borderLeft: '3px solid' },
  badgeAnalise: { background: 'rgba(204,145,94,0.15)', color: '#A6512F', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.5, display: 'inline-block' },
  badgePendente: { background: 'rgba(249,168,37,0.15)', color: '#9A7B00', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.5, display: 'inline-block' },

  // Preview table
  previewTable: { width: '100%', borderCollapse: 'collapse', fontSize: 11, margin: '12px 0' },
  previewLabel: { padding: '6px 10px', borderBottom: '1px solid #e5e0d8', fontWeight: 600, color: '#00203E', width: 160, fontSize: 10 },
  previewValue: { padding: '6px 10px', borderBottom: '1px solid #e5e0d8', color: '#333' },

  // Ficha cards
  fichaCard: { background: 'linear-gradient(135deg, #00203E 0%, #1D3B5C 100%)', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', margin: '12px 0', transition: 'transform 0.15s, box-shadow 0.15s' },
  fichaIcon: { width: 44, height: 44, background: 'rgba(255,255,255,0.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  fichaBadge: { marginLeft: 'auto', background: 'rgba(204,145,94,0.25)', color: '#CC915E', padding: '4px 12px', borderRadius: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  fichaSecondary: { background: '#fff', border: '2px dashed #e5e0d8', borderRadius: 8, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', margin: '8px 0', transition: 'all 0.15s' },

  // Footer
  footer: { padding: '14px 24px', borderTop: '1px solid #e5e0d8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0 },

  // Buttons
  btn: { fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, padding: '8px 20px', borderRadius: 4, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' },
  btnPrimary: { background: '#00203E', color: '#F3EEE4' },
  btnGhost: { background: 'transparent', color: '#666', border: '1px solid #e5e0d8' },
  btnGold: { background: '#CC915E', color: '#fff' },
  btnDanger: { background: '#B71C1C', color: '#fff' },
  btnSm: { fontSize: 11, padding: '6px 14px' },

  // Confirm dialog
  confirmOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,17,44,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  confirmDialog: { background: '#fff', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,17,44,0.12)', padding: 24, maxWidth: 400, width: '90%', textAlign: 'center' },
}
