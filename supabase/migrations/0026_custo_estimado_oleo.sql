-- =============================================================
-- 0026_custo_estimado_oleo.sql
-- Campo de custo estimado por hora para óleo (projeção enquanto galão aberto)
-- =============================================================

-- 1. Nova coluna
ALTER TABLE public.historico_custo_oleo
  ADD COLUMN custo_estimado_por_hora numeric;

-- 2. custo_oleo_por_hora_vigente: usa estimativa se galão aberto
CREATE OR REPLACE FUNCTION public.custo_oleo_por_hora_vigente(p_grupo_id uuid, p_data date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_galao historico_custo_oleo;
  v_horas numeric;
begin
  select * into v_galao from historico_custo_oleo
    where grupo_id = p_grupo_id
      and data_inicio <= p_data
      and (data_fim is null or data_fim >= p_data)
    order by data_inicio desc
    limit 1;

  if v_galao.id is null then return 0; end if;

  -- Se galão aberto e tem custo estimado, usa a estimativa
  if v_galao.data_fim is null and v_galao.custo_estimado_por_hora is not null then
    return v_galao.custo_estimado_por_hora;
  end if;

  -- Senão, calcula do jeito antigo (custo_galao / horas reais)
  v_horas := horas_grupo_periodo(p_grupo_id, v_galao.data_inicio, v_galao.data_fim);
  if v_horas <= 0 then return 0; end if;

  return v_galao.custo_galao / v_horas;
end;
$function$;

-- 3. resumo_custo_oleo: dropar e recriar com nova assinatura
DROP FUNCTION public.resumo_custo_oleo(uuid);

CREATE OR REPLACE FUNCTION public.resumo_custo_oleo(p_grupo_id uuid)
 RETURNS TABLE(
   id uuid,
   custo_galao numeric,
   data_inicio date,
   data_fim date,
   horas_consumidas numeric,
   custo_estimado_por_hora numeric,
   custo_por_hora numeric
 )
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  r record;
  v_horas numeric;
  v_custo_efetivo numeric;
begin
  for r in select * from historico_custo_oleo where grupo_id = p_grupo_id order by data_inicio desc loop
    v_horas := horas_grupo_periodo(p_grupo_id, r.data_inicio, r.data_fim);

    -- Custo efetivo: se galão aberto com estimativa, usa estimativa; senão calcula
    if r.data_fim is null and r.custo_estimado_por_hora is not null then
      v_custo_efetivo := r.custo_estimado_por_hora;
    elsif v_horas > 0 then
      v_custo_efetivo := round(r.custo_galao / v_horas, 4);
    else
      v_custo_efetivo := null;
    end if;

    id := r.id;
    custo_galao := r.custo_galao;
    data_inicio := r.data_inicio;
    data_fim := r.data_fim;
    horas_consumidas := v_horas;
    custo_estimado_por_hora := r.custo_estimado_por_hora;
    custo_por_hora := v_custo_efetivo;
    return next;
  end loop;
end;
$function$;

-- 4. definir_custo_oleo: aceita custo_estimado_por_hora opcional
CREATE OR REPLACE FUNCTION public.definir_custo_oleo(
  p_grupo_id uuid,
  p_custo_galao numeric,
  p_data_inicio date DEFAULT CURRENT_DATE,
  p_custo_estimado_por_hora numeric DEFAULT NULL
)
 RETURNS historico_custo_oleo
 LANGUAGE plpgsql
AS $function$
declare
  v_membro_id uuid;
  v_row historico_custo_oleo;
begin
  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();

  update historico_custo_oleo
     set data_fim = p_data_inicio - 1
   where grupo_id = p_grupo_id and data_fim is null
     and data_inicio < p_data_inicio;

  insert into historico_custo_oleo (grupo_id, custo_galao, data_inicio, custo_estimado_por_hora, alterado_por)
  values (p_grupo_id, p_custo_galao, p_data_inicio, p_custo_estimado_por_hora, v_membro_id)
  returning * into v_row;

  return v_row;
end;
$function$;

-- 5. editar_custo_oleo_atual: aceita custo_estimado_por_hora opcional
CREATE OR REPLACE FUNCTION public.editar_custo_oleo_atual(
  p_id uuid,
  p_custo_galao numeric,
  p_data_inicio date,
  p_custo_estimado_por_hora numeric DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update historico_custo_oleo
     set custo_galao = p_custo_galao,
         data_inicio = coalesce(p_data_inicio, data_inicio),
         custo_estimado_por_hora = p_custo_estimado_por_hora
   where id = p_id;
end;
$function$;
