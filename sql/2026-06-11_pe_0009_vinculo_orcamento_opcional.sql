-- =====================================================================
-- 2026-06-11 · pe_0009_vinculo_orcamento_opcional (APLICADA via Supabase MCP)
-- Vínculo OPCIONAL entre Planejamento Estratégico e Gestão Orçamentária.
-- Nem toda empresa tem orçamento: pe_config.orcamento_vinculado é o flag
-- por projeto. Quando ligado, aponta para um projeto do produto
-- 'orcamento' (mesmo cliente) e o realizado alimenta os KRs sozinho.
-- Contrato explícito: o ÚNICO ponto de contato entre módulos é o
-- trigger em orc_realizado → pe_sync_orcamento_categoria() →
-- pe_ingest_budget_value(). Sem joins diretos nas telas/views.
-- =====================================================================

create table if not exists public.pe_config (
  projeto_id          uuid primary key references public.projetos(id) on delete cascade,
  orcamento_vinculado boolean not null default false,
  orc_projeto_id      uuid references public.projetos(id) on delete set null,
  atualizado_em       timestamptz not null default now()
);

alter table public.pe_config enable row level security;
create policy pe_config_select on public.pe_config for select using (
  meu_papel() = 'admin_polimata'
  or projeto_id in (select p.id from projetos p where p.cliente_id = meu_cliente_id())
  or projeto_id in (select pp.projeto_id from perfis_projetos pp where pp.perfil_id = auth.uid())
);
create policy pe_config_insert on public.pe_config for insert with check (
  meu_papel() = 'admin_polimata'
  or (meu_papel() = 'consultor_polimata'
      and projeto_id in (select pp.projeto_id from perfis_projetos pp where pp.perfil_id = auth.uid()))
);
create policy pe_config_update on public.pe_config for update using (
  meu_papel() = 'admin_polimata'
  or (meu_papel() = 'consultor_polimata'
      and projeto_id in (select pp.projeto_id from perfis_projetos pp where pp.perfil_id = auth.uid()))
);
create policy pe_config_delete on public.pe_config for delete using (meu_papel() = 'admin_polimata');

create trigger trg_pe_config_upd before update on public.pe_config
  for each row execute function public.pe_tg_set_atualizado_em();

-- Métricas em pe_budget_links.metrica:
--   'realizado' = realizado acumulado do ano corrente da categoria
--   'desvio'    = |realizado - orçado| / orçado × 100, acumulado até o
--                 mês corrente (versão mais recente do orçamento)
create or replace function public.pe_sync_orcamento_categoria(p_orc_projeto uuid, p_categoria uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record; lnk record;
  v_ano int := extract(year from current_date)::int;
  v_mes int := extract(month from current_date)::int;
  v_real numeric; v_orc numeric; v_val numeric;
begin
  for cfg in
    select * from pe_config
    where orc_projeto_id = p_orc_projeto and orcamento_vinculado = true
  loop
    for lnk in
      select * from pe_budget_links
      where projeto_id = cfg.projeto_id
        and ref_externa = p_categoria::text
        and sistema_externo = 'orcamento'
        and ativo = true
    loop
      select coalesce(sum(valor), 0) into v_real
      from orc_realizado
      where projeto_id = p_orc_projeto and categoria_id = p_categoria
        and extract(year from competencia)::int = v_ano
        and extract(month from competencia)::int <= v_mes;

      if lnk.metrica = 'realizado' then
        v_val := v_real;
      elsif lnk.metrica = 'desvio' then
        select coalesce(sum(i.valor), 0) into v_orc
        from orc_orcamento_itens i
        join orc_orcamentos o on o.id = i.orcamento_id
        where o.projeto_id = p_orc_projeto and o.ano = v_ano
          and i.categoria_id = p_categoria and i.mes <= v_mes
          and o.versao = (select max(o2.versao) from orc_orcamentos o2 where o2.projeto_id = p_orc_projeto and o2.ano = v_ano);
        if v_orc = 0 then continue; end if;
        v_val := round(abs(v_real - v_orc) / v_orc * 100, 2);
      else
        continue;
      end if;

      perform pe_ingest_budget_value(cfg.projeto_id, lnk.ref_externa, v_val, current_date, 'orcamento', lnk.metrica);
    end loop;
  end loop;
end $$;

revoke execute on function public.pe_sync_orcamento_categoria(uuid, uuid) from anon, public;
grant  execute on function public.pe_sync_orcamento_categoria(uuid, uuid) to authenticated;

create or replace function public.pe_tg_orc_realizado_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT','UPDATE') and new.categoria_id is not null then
    perform pe_sync_orcamento_categoria(new.projeto_id, new.categoria_id);
  end if;
  if tg_op in ('UPDATE','DELETE') and old.categoria_id is not null then
    perform pe_sync_orcamento_categoria(old.projeto_id, old.categoria_id);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_pe_sync_orc on public.orc_realizado;
create trigger trg_pe_sync_orc
  after insert or update or delete on public.orc_realizado
  for each row execute function public.pe_tg_orc_realizado_sync();
