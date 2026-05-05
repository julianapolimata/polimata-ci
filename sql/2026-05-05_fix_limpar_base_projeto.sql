-- ═══════════════════════════════════════════════════════════════════════════════
-- Migração: corrigir função limpar_base_projeto
-- Data: 2026-05-05
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Problemas da versão anterior:
--   1. Parâmetro chamava-se `projeto_id_param`, mas o frontend usa `p_projeto_id`
--   2. Função fazia DELETE FROM mrc — destruía a identificação dos controles
--      (risco, controle, área), o que contradiz o texto do botão na UI
--   3. Retornava { deleted_mrc_count, success }, mas o frontend lê
--      { controles_resetados, revisoes_removidas, notificacoes_removidas }
--
-- Esta versão:
--   • Mantém a identificação (rr, rc, dr, dc, area_id, sub, cat, freq, nat, car, sis, chave)
--   • Reseta todos os campos de teste (premissas + F1..F5) para NULL
--   • Reseta status_workflow → 'nao_iniciado' e num_regressoes → 0
--   • Apaga revisões e notificações ligadas ao projeto
--   • Mantém a checagem de admin_polimata
--   • Devolve { controles_resetados, revisoes_removidas, notificacoes_removidas }
--
-- Como aplicar:
--   1. Acesse https://supabase.com/dashboard/project/iqtkpyrpwxypwcwrhulx/sql
--   2. Cole este script e clique em "Run"
-- ═══════════════════════════════════════════════════════════════════════════════

-- Apaga a versão antiga (qualquer assinatura)
DROP FUNCTION IF EXISTS public.limpar_base_projeto(uuid);
DROP FUNCTION IF EXISTS public.limpar_base_projeto(projeto_id_param uuid);
DROP FUNCTION IF EXISTS public.limpar_base_projeto(p_projeto_id uuid);

CREATE OR REPLACE FUNCTION public.limpar_base_projeto(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_role          text;
  v_controles_count    int := 0;
  v_revisoes_count     int := 0;
  v_notif_count        int := 0;
BEGIN
  -- Segurança: somente admin_polimata pode limpar
  SELECT papel INTO v_user_role FROM public.perfis WHERE id = auth.uid();
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado em perfis';
  END IF;
  IF v_user_role <> 'admin_polimata' THEN
    RAISE EXCEPTION 'Permissão negada: apenas admin_polimata pode limpar a base do projeto';
  END IF;

  -- 1) Apaga revisões dos controles deste projeto
  DELETE FROM public.revisoes r
   USING public.mrc m
   WHERE r.mrc_id = m.id
     AND m.projeto_id = p_projeto_id;
  GET DIAGNOSTICS v_revisoes_count = ROW_COUNT;

  -- 2) Apaga notificações ligadas a este projeto (se a coluna existir)
  BEGIN
    EXECUTE format('DELETE FROM public.notificacoes WHERE projeto_id = %L', p_projeto_id);
    GET DIAGNOSTICS v_notif_count = ROW_COUNT;
  EXCEPTION
    WHEN undefined_column OR undefined_table THEN
      v_notif_count := 0;
  END;

  -- 3) Reseta os controles do projeto (mantém identificação)
  UPDATE public.mrc SET
    -- Premissas e F1
    passos_f1 = NULL,
    premissa_porque = NULL,
    premissa_quando = NULL,
    premissa_onde = NULL,
    premissa_quem = NULL,
    premissa_como = NULL,
    premissa_resultado = NULL,
    r1 = NULL,
    imp = NULL,
    prob = NULL,
    crit = NULL,
    -- F2-E1
    dem_pa = NULL,
    resp_pa = NULL,
    dt_pa = NULL,
    st_pa = NULL,
    coment_pa = NULL,
    -- F2-E2
    dt_teste = NULL,
    dc_novo = NULL,
    r_ader = NULL,
    melhoria = NULL,
    incons_ader = NULL,
    coment_ader = NULL,
    -- F3
    st_f3 = NULL,
    r3 = NULL,
    incons_f3 = NULL,
    rec_f3 = NULL,
    -- F4-C1
    r_f4c1 = NULL,
    incons_f4c1 = NULL,
    rec_f4c1 = NULL,
    coment_f4c1 = NULL,
    dt_f4c1 = NULL,
    -- F4-C2
    r_f4c2 = NULL,
    incons_f4c2 = NULL,
    rec_f4c2 = NULL,
    coment_f4c2 = NULL,
    dt_f4c2 = NULL,
    -- F5
    r_f5 = NULL,
    incons_f5 = NULL,
    rec_f5 = NULL,
    coment_f5 = NULL,
    dt_f5 = NULL,
    -- Workflow
    status_workflow = 'nao_iniciado',
    num_regressoes = 0,
    dt_ult = NULL,
    atualizado_em = now(),
    atualizado_por = auth.uid()
  WHERE projeto_id = p_projeto_id;
  GET DIAGNOSTICS v_controles_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'controles_resetados',    v_controles_count,
    'revisoes_removidas',     v_revisoes_count,
    'notificacoes_removidas', v_notif_count
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.limpar_base_projeto(uuid) TO authenticated;

COMMENT ON FUNCTION public.limpar_base_projeto(uuid) IS
  'Reseta todos os resultados de teste de um projeto (F1..F5, premissas, status). Mantém a identificação dos controles. Apaga revisões e notificações relacionadas. Restrito a admin_polimata.';
