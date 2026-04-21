-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Novos status_workflow (CORRIGIDO)
-- Polímata CI — Abril 2026
-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUTAR TUDO DE UMA VEZ NO SQL EDITOR DO SUPABASE:
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. PRIMEIRO remover a constraint antiga (libera os valores)
ALTER TABLE mrc DROP CONSTRAINT IF EXISTS mrc_status_workflow_check;

-- 2. DEPOIS migrar os dados
UPDATE mrc SET status_workflow = 'nao_iniciado' WHERE status_workflow = 'rascunho';
UPDATE mrc SET status_workflow = 'em_analise'   WHERE status_workflow = 'ficha_gerada';

-- 3. POR ÚLTIMO criar a nova constraint
ALTER TABLE mrc ADD CONSTRAINT mrc_status_workflow_check
  CHECK (status_workflow = ANY (ARRAY[
    'nao_iniciado',
    'em_analise',
    'teste_pendente',
    'em_revisao',
    'aprovado',
    'reprovado'
  ]));

-- 4. Verificar resultado
SELECT status_workflow, COUNT(*) as total
FROM mrc
GROUP BY status_workflow
ORDER BY status_workflow;
