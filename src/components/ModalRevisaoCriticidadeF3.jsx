// src/components/ModalRevisaoCriticidadeF3.jsx
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

// Matriz de criticidade baseada em impacto × probabilidade
const getCriticidadeFromMatrix = (impacto, probabilidade) => {
  const matriz = {
    '1-1': 1, '1-2': 1, '1-3': 1, '1-4': 2,
    '2-1': 1, '2-2': 2, '2-3': 2, '2-4': 3,
    '3-1': 1, '3-2': 2, '3-3': 3, '3-4': 4,
    '4-1': 2, '4-2': 3, '4-3': 4, '4-4': 4,
  };
  return matriz[`${impacto}-${probabilidade}`] || 1;
};

export default function ModalRevisaoCriticidadeF3({ row, onClose, onSaved, projeto }) {
  const [step, setStep] = useState(1);
  const [impacto, setImpacto] = useState(row.imp || 2);
  const [probabilidade, setProbabilidade] = useState(row.prob || 2);
  const [novaCriticidade, setNovaCriticidade] = useState(row.crit || 2);
  const [justificativa, setJustificativa] = useState('');
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
    if (!justificativa.trim()) {
      setError('Justificativa da revisão é obrigatória');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const novoLabel = Object.values(criticidadeMap).find(c => 
        c.label === criticidadeMap[novaCriticidade].label
      );

      // Atualizar MRC
      const { error: updateError } = await supabase
        .from('mrc')
        .update({
          imp: impacto,
          prob: probabilidade,
          crit: novaCriticidade,
          crit_label: criticidadeMap[novaCriticidade].label,
          rec_f3: justificativa, // Armazena justificativa na recomendação F3
          atualizado_em: new Date().toISOString(),
          atualizado_por: 'admin_polimata' // TODO: obter do auth
        })
        .eq('id', row.id);

      if (updateError) throw updateError;

      // Registrar no audit log
      await supabase.from('mrc_audit_log').insert({
        mrc_id: row.id,
        campo: 'criticidade_f3_revisao',
        valor_anterior: `${row.imp}|${row.prob}|${row.crit}`,
        valor_novo: `${impacto}|${probabilidade}|${novaCriticidade}`,
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
          maxWidth: 500,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: navyBold, marginTop: 0, fontSize: 20, fontWeight: 600 }}>
          Revisão de Criticidade — Fase F3
        </h2>

        <div style={{ marginBottom: 20, fontSize: 13, color: '#666' }}>
          <p>
            <strong>Controle:</strong> {row.rc} — {row.dc}
          </p>
          <p>
            <strong>Criticidade Anterior:</strong>{' '}
            <span
              style={{
                display: 'inline-block',
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor: criticidadeMap[row.crit]?.color,
                color: '#fff',
                fontWeight: 600,
                fontSize: 12
              }}
            >
              {criticidadeMap[row.crit]?.label}
            </span>
          </p>
        </div>

        {step === 1 && (
          <>
            <h3 style={{ color: navyBold, fontSize: 14, fontWeight: 600 }}>
              1. Reavalie o Impacto e Probabilidade
            </h3>
            <p style={{ fontSize: 13, color: '#666' }}>
              Com base nas evidências coletadas na F3, ajuste os fatores de risco se necessário.
              A criticidade será recalculada automaticamente.
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
              <strong style={{ color: navyBold, fontSize: 12 }}>Nova Criticidade Calculada:</strong>
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
              2. Justifique a Revisão
            </h3>
            <p style={{ fontSize: 13, color: '#666' }}>
              Documente as razões para qualquer mudança na criticidade baseado nas evidências de F3.
            </p>

            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Após testes na F3, identificamos que o risco de não conformidade fiscal tem impacto crítico se não mitigado..."
              style={{
                width: '100%',
                minHeight: 120,
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
                {saving ? 'Salvando...' : 'Salvar Revisão'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
