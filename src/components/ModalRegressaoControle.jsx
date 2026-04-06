// src/components/ModalRegressaoControle.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const criticidadeMap = {
  1: { label: 'Baixo', color: '#22C55E' },
  2: { label: 'Moderado', color: '#EAB308' },
  3: { label: 'Significativo', color: '#F97316' },
  4: { label: 'Crítico', color: '#EF4444' }
};

const impactoOpcoes = [
  { id: 1, label: 'Baixo' },
  { id: 2, label: 'Moderado' },
  { id: 3, label: 'Alto' },
  { id: 4, label: 'Crítico' }
];

const probabilidadeOpcoes = [
  { id: 1, label: 'Rara' },
  { id: 2, label: 'Possível' },
  { id: 3, label: 'Provável' },
  { id: 4, label: 'Quase Certa' }
];

const getCriticidadeFromMatrix = (impacto, probabilidade) => {
  const matriz = {
    '1-1': 1, '1-2': 1, '1-3': 1, '1-4': 2,
    '2-1': 1, '2-2': 2, '2-3': 2, '2-4': 3,
    '3-1': 1, '3-2': 2, '3-3': 3, '3-4': 4,
    '4-1': 2, '4-2': 3, '4-3': 4, '4-4': 4,
  };
  return matriz[`${impacto}-${probabilidade}`] || 1;
};

export default function ModalRegressaoControle({ row, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [impacto, setImpacto] = useState(row.imp || 2);
  const [probabilidade, setProbabilidade] = useState(row.prob || 2);
  const [novaCriticidade, setNovaCriticidade] = useState(row.crit || 2);
  const [justificativaRevisao, setJustificativaRevisao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleImpactoChange = (val) => {
    const newImp = parseInt(val);
    setImpacto(newImp);
    const newCrit = getCriticidadeFromMatrix(newImp, probabilidade);
    setNovaCriticidade(newCrit);
  };

  const handleProbabilidadeChange = (val) => {
    const newProb = parseInt(val);
    setProbabilidade(newProb);
    const newCrit = getCriticidadeFromMatrix(impacto, newProb);
    setNovaCriticidade(newCrit);
  };

  const handleSalvar = async () => {
    if (!motivo.trim()) {
      setError('Motivo da regressão é obrigatório');
      return;
    }
    if (!justificativaRevisao.trim()) {
      setError('Justificativa da revisão de criticidade é obrigatória');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Atualizar MRC
      const { error: updateError } = await supabase
        .from('mrc')
        .update({
          // Reseta para F2-E1
          status_workflow: 'em_revisao', // Marca como em revisão para gerar novo PA
          st_pa: 'pendente', // PA em aberto novamente
          dem_pa: true,
          // Regressão: salva motivo na recomendação
          rec: motivo,
          // Reavaliação obrigatória de criticidade
          imp: impacto,
          prob: probabilidade,
          crit: novaCriticidade,
          crit_label: criticidadeMap[novaCriticidade].label,
          // Documentar a justificativa
          rec_f3: justificativaRevisao,
          // Timestamps
          atualizado_em: new Date().toISOString(),
          atualizado_por: 'admin_polimata'
        })
        .eq('id', row.id);

      if (updateError) throw updateError;

      // Registrar no audit log
      await supabase.from('mrc_audit_log').insert({
        mrc_id: row.id,
        campo: 'regressao_controle',
        valor_anterior: `status=${row.status_workflow}, crit=${row.crit}`,
        valor_novo: `status=em_revisao (regressão), crit=${novaCriticidade}`,
        usuario_id: 'admin_polimata',
        criado_em: new Date().toISOString()
      });

      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(`Erro ao salvar: ${err.message}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const fundo = '#FFFFFF';
  const navyBold = '#00112C';
  const corBotaoPrimario = '#CC915E';
  const corAlerta = '#FCD34D';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: 'Montserrat, sans-serif'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: fundo,
          borderRadius: 8,
          padding: 32,
          maxWidth: 550,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Aviso de regressão */}
        <div
          style={{
            backgroundColor: corAlerta,
            border: '2px solid #B45309',
            borderRadius: 6,
            padding: 12,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ fontSize: 13, color: '#92400E' }}>
            <strong>Atenção: Regressão de Controle</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              Este controle será retornado para F2-E1 (Plano de Ação) com avaliação de criticidade obrigatória.
            </p>
          </div>
        </div>

        <h2 style={{ color: navyBold, marginTop: 0, fontSize: 20, fontWeight: 600 }}>
          Registrar Regressão
        </h2>

        <div style={{ marginBottom: 20, fontSize: 13, color: '#666' }}>
          <p>
            <strong>Controle:</strong> {row.rc} — {row.dc}
          </p>
          <p>
            <strong>Status Anterior:</strong> {row.status_workflow}
          </p>
        </div>

        {step === 1 && (
          <>
            <h3 style={{ color: navyBold, fontSize: 14, fontWeight: 600 }}>
              1. Motivo da Regressão
            </h3>
            <p style={{ fontSize: 13, color: '#666' }}>
              Por que este controle não está mais efetivo? (Ex: falta de execução, mudança de processo, etc.)
            </p>

            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da regressão..."
              style={{
                width: '100%',
                minHeight: 100,
                padding: '10px 12px',
                border: '1px solid #ccc',
                borderRadius: 4,
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 12,
                marginBottom: 20,
                boxSizing: 'border-box'
              }}
            />

            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: corBotaoPrimario,
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Próximo
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ color: navyBold, fontSize: 14, fontWeight: 600 }}>
              2. Reavaliação de Criticidade (Obrigatória)
            </h3>
            <p style={{ fontSize: 13, color: '#666' }}>
              Com a regressão do controle, a criticidade deve ser reavaliada. Há alguma mudança no impacto ou probabilidade?
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: navyBold, fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Impacto (se materializado)
              </label>
              <select
                value={impacto}
                onChange={(e) => handleImpactoChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 12
                }}
              >
                {impactoOpcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}. {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: navyBold, fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Probabilidade de Ocorrência
              </label>
              <select
                value={probabilidade}
                onChange={(e) => handleProbabilidadeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 12
                }}
              >
                {probabilidadeOpcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}. {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                backgroundColor: '#F3EEE4',
                padding: 12,
                borderRadius: 4,
                marginBottom: 20,
                borderLeft: '4px solid ' + corBotaoPrimario
              }}
            >
              <strong style={{ color: navyBold, fontSize: 12 }}>Nova Criticidade:</strong>
              <div
                style={{
                  display: 'inline-block',
                  marginLeft: 8,
                  padding: '4px 8px',
                  borderRadius: 4,
                  backgroundColor: criticidadeMap[novaCriticidade]?.color,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12
                }}
              >
                {criticidadeMap[novaCriticidade]?.label}
              </div>
            </div>

            <h3 style={{ color: navyBold, fontSize: 14, fontWeight: 600 }}>
              3. Justificativa da Reavaliação
            </h3>

            <textarea
              value={justificativaRevisao}
              onChange={(e) => setJustificativaRevisao(e.target.value)}
              placeholder="Explique as razões para qualquer mudança na criticidade..."
              style={{
                width: '100%',
                minHeight: 100,
                padding: '10px 12px',
                border: '1px solid #ccc',
                borderRadius: 4,
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 12,
                marginBottom: 16,
                boxSizing: 'border-box'
              }}
            />

            {error && (
              <div
                style={{
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                  fontSize: 12
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#E5E7EB',
                  color: navyBold,
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleSalvar}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: corBotaoPrimario,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? 'Salvando...' : 'Registrar Regressão'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
