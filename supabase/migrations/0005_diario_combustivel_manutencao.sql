-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0005 — Diário de Bordo, Combustível e Manutenções
-- Cole no SQL Editor do Supabase (depois de 0001 a 0004) e clique em "Run".
-- ════════════════════════════════════════════════════════════

-- ── Data "efetiva" de um registro do diário ─────────────────
-- Prioriza a data real do uso (quando relatada depois), senão usa a data
-- em que o registro foi criado.
create or replace function data_efetiva_diario(p_data_uso_reportado date, p_criado_em timestamptz) returns date
language sql immutable as $$
  select coalesce(p_data_uso_reportado, p_criado_em::date);
$$;

-- ── Último horímetro conhecido do grupo ──────────────────────
create or replace function ultimo_horimetro(p_grupo_id uuid) returns numeric
language sql stable as $$
  select coalesce(max(horimetro_fim), 0) from diario_bordo where grupo_id = p_grupo_id and horimetro_fim > 0;
$$;

-- ── Criar registro no Diário de Bordo ────────────────────────
-- Sugere horimetro_inicio = horimetro_fim do último registro (se não
-- informado), calcula a diferença em relação a ele, e marca como
-- resolvido automaticamente quando é um "uso de rotina" (fechamento de um
-- relatório pendente, não um incidente).
create or replace function criar_registro_diario(
  p_grupo_id uuid,
  p_titulo text,
  p_relato text,
  p_prioridade text default 'normal',
  p_horimetro_inicio numeric default null,
  p_horimetro_fim numeric default 0,
  p_observacoes text default null,
  p_uso_rotina boolean default false,
  p_data_uso date default null
) returns diario_bordo
language plpgsql as $$
declare
  v_membro_id uuid;
  v_ultimo_fim numeric;
  v_horimetro_inicio numeric;
  v_diferenca numeric := 0;
  v_row diario_bordo;
begin
  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();
  if v_membro_id is null then raise exception 'Você não é membro deste grupo'; end if;

  select horimetro_fim into v_ultimo_fim from diario_bordo
   where grupo_id = p_grupo_id and horimetro_fim > 0
   order by criado_em desc limit 1;

  v_horimetro_inicio := coalesce(p_horimetro_inicio, v_ultimo_fim, 0);
  if v_ultimo_fim is not null then
    v_diferenca := v_horimetro_inicio - v_ultimo_fim;
  end if;

  insert into diario_bordo (
    grupo_id, autor_id, titulo, relato, prioridade,
    horimetro_inicio, horimetro_fim, diferenca_anterior, observacoes,
    data_uso_reportado, resolvido, data_resolucao, resolvido_por
  ) values (
    p_grupo_id, v_membro_id, p_titulo, p_relato, coalesce(p_prioridade, 'normal'),
    v_horimetro_inicio, coalesce(p_horimetro_fim, 0), v_diferenca, p_observacoes,
    p_data_uso,
    coalesce(p_uso_rotina, false),
    case when p_uso_rotina then current_date else null end,
    case when p_uso_rotina then v_membro_id else null end
  ) returning * into v_row;

  return v_row;
end;
$$;

-- ── Relatórios de uso pendentes ──────────────────────────────
create or replace function relatorios_pendentes_membro(p_membro_id uuid)
returns table(reserva_id uuid, data date, periodo text)
language sql stable as $$
  select r.id, r.data, r.periodo
  from reservas r
  where r.membro_id = p_membro_id
    and r.status <> 'cancelado'
    and r.data < current_date
    and not exists (
      select 1 from diario_bordo d
      where d.autor_id = p_membro_id
        and data_efetiva_diario(d.data_uso_reportado, d.criado_em) = r.data
    )
  order by r.data;
$$;

create or replace function relatorios_pendentes_todos(p_grupo_id uuid)
returns table(membro_id uuid, nome text, pendentes bigint)
language sql stable as $$
  select gm.id, gm.nome, count(*)::bigint
  from grupo_membros gm
  join reservas r on r.membro_id = gm.id and r.status <> 'cancelado' and r.data < current_date
  where gm.grupo_id = p_grupo_id and gm.ativo
    and not exists (
      select 1 from diario_bordo d
      where d.autor_id = gm.id
        and data_efetiva_diario(d.data_uso_reportado, d.criado_em) = r.data
    )
  group by gm.id, gm.nome
  having count(*) > 0
  order by count(*) desc;
$$;

-- ── Custo de combustível vigente numa data ───────────────────
create or replace function custo_combustivel_por_hora_vigente(p_grupo_id uuid, p_data date) returns numeric
language sql stable as $$
  select coalesce(custo_por_hora, 0) from historico_custo_combustivel
  where grupo_id = p_grupo_id
    and vigencia_inicio <= p_data
    and (vigencia_fim is null or vigencia_fim >= p_data)
  order by vigencia_inicio desc
  limit 1;
$$;

create or replace function horas_combustivel_membro_mes(p_membro_id uuid, p_mes_ref date) returns numeric
language sql stable as $$
  select coalesce(sum(d.tempo_uso), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and date_trunc('month', data_efetiva_diario(d.data_uso_reportado, d.criado_em)) = date_trunc('month', p_mes_ref);
$$;

create or replace function custo_combustivel_membro_mes(p_membro_id uuid, p_mes_ref date) returns numeric
language sql stable as $$
  select coalesce(sum(d.tempo_uso * custo_combustivel_por_hora_vigente(d.grupo_id, data_efetiva_diario(d.data_uso_reportado, d.criado_em))), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and date_trunc('month', data_efetiva_diario(d.data_uso_reportado, d.criado_em)) = date_trunc('month', p_mes_ref);
$$;

-- ── Definir novo período de custo de combustível (novo galão/tanque) ─
create or replace function definir_custo_combustivel(
  p_grupo_id uuid, p_consumo_por_hora numeric, p_custo_unidade numeric, p_unidades numeric, p_data_inicio date default current_date
) returns historico_custo_combustivel
language plpgsql as $$
declare
  v_membro_id uuid;
  v_primeira boolean;
  v_data_inicio date;
  v_row historico_custo_combustivel;
begin
  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();

  select not exists(select 1 from historico_custo_combustivel where grupo_id = p_grupo_id) into v_primeira;
  v_data_inicio := case when v_primeira then '2000-01-01'::date else coalesce(p_data_inicio, current_date) end;

  update historico_custo_combustivel
     set vigencia_fim = v_data_inicio - 1
   where grupo_id = p_grupo_id and vigencia_fim is null
     and vigencia_inicio < v_data_inicio;

  insert into historico_custo_combustivel (grupo_id, consumo_por_hora, custo_unidade, unidades, vigencia_inicio, alterado_por)
  values (p_grupo_id, p_consumo_por_hora, p_custo_unidade, p_unidades, v_data_inicio, v_membro_id)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function editar_custo_combustivel_atual(
  p_id uuid, p_consumo_por_hora numeric, p_custo_unidade numeric, p_unidades numeric, p_data_inicio date
) returns void language plpgsql as $$
begin
  update historico_custo_combustivel
     set consumo_por_hora = p_consumo_por_hora,
         custo_unidade = p_custo_unidade,
         unidades = p_unidades,
         vigencia_inicio = coalesce(p_data_inicio, vigencia_inicio)
   where id = p_id;
end;
$$;

-- ── Manutenção por horímetro: horas por cotista desde uma base ──
create or replace function horas_por_membro_desde_horimetro(p_grupo_id uuid, p_horimetro_base numeric)
returns table(membro_id uuid, horas numeric)
language sql stable as $$
  select d.autor_id, sum(d.tempo_uso)
  from diario_bordo d
  where d.grupo_id = p_grupo_id and d.horimetro_fim > 0 and d.horimetro_inicio >= p_horimetro_base
  group by d.autor_id;
$$;

-- ── Concluir manutenção por horímetro (rateia pelo uso real) ────
create or replace function concluir_manutencao_horas(p_manutencao_id uuid, p_custo_real numeric)
returns void language plpgsql as $$
declare
  v_grupo_id uuid;
  v_descricao text;
  v_horimetro_base numeric;
  v_horimetro_atual numeric;
  v_total_horas numeric := 0;
  v_total_cotas numeric;
  v_saldo numeric;
  v_membro_id uuid;
  r record;
begin
  select grupo_id, descricao, horimetro_base into v_grupo_id, v_descricao, v_horimetro_base
    from manutencoes where id = p_manutencao_id and tipo_gatilho = 'horas';
  if v_grupo_id is null then raise exception 'Manutenção não encontrada ou não é por horímetro'; end if;

  select id into v_membro_id from grupo_membros where grupo_id = v_grupo_id and user_id = auth.uid();

  if p_custo_real <= 0 then raise exception 'Informe um custo válido'; end if;

  v_saldo := saldo_atual(v_grupo_id);
  if v_saldo - p_custo_real < -0.005 then
    raise exception 'Esta despesa deixaria o caixa negativo. Saldo atual: R$ %.', to_char(v_saldo, 'FM999999990.00');
  end if;

  v_horimetro_atual := ultimo_horimetro(v_grupo_id);
  if v_horimetro_atual < v_horimetro_base then v_horimetro_atual := v_horimetro_base; end if;

  select coalesce(sum(horas), 0) into v_total_horas from horas_por_membro_desde_horimetro(v_grupo_id, v_horimetro_base);

  if v_total_horas > 0 then
    for r in select * from horas_por_membro_desde_horimetro(v_grupo_id, v_horimetro_base) loop
      insert into rateio_manutencao (manutencao_id, descricao, membro_id, horas, valor, data)
      values (p_manutencao_id, v_descricao, r.membro_id, r.horas, round(p_custo_real * (r.horas / v_total_horas), 2), current_date);
    end loop;
  else
    v_total_cotas := total_cotas_ativas(v_grupo_id);
    for r in select id, cotas from grupo_membros where grupo_id = v_grupo_id and ativo loop
      insert into rateio_manutencao (manutencao_id, descricao, membro_id, horas, valor, data)
      values (p_manutencao_id, v_descricao, r.id, 0, round(p_custo_real * (r.cotas / v_total_cotas), 2), current_date);
    end loop;
  end if;

  insert into lancamentos (grupo_id, tipo, descricao, valor, data, lancado_por, origem, origem_ref_id, observacao)
  values (v_grupo_id, 'despesa', 'Manutenção (rateio por horas): ' || v_descricao, p_custo_real, current_date, v_membro_id, 'manutencao_horas', p_manutencao_id, null);

  update manutencoes
     set feito = false, data_execucao = current_date, feito_por = v_membro_id,
         horimetro_base = v_horimetro_atual, custo_real = p_custo_real
   where id = p_manutencao_id;
end;
$$;

-- ── Projeção ao vivo das manutenções por horímetro pendentes ──
create or replace function projecao_manutencao_horas(p_grupo_id uuid)
returns table(
  manutencao_id uuid, descricao text, proxima_data date, horimetro_base numeric,
  intervalo_horas numeric, horimetro_atual numeric, horas_restantes numeric,
  custo_previsto numeric, membro_id uuid, membro_nome text, horas numeric, valor_estimado numeric
)
language plpgsql stable as $$
declare
  m record;
  v_horimetro_atual numeric;
  v_total_horas numeric;
  r record;
begin
  v_horimetro_atual := ultimo_horimetro(p_grupo_id);

  for m in select * from manutencoes where grupo_id = p_grupo_id and tipo_gatilho = 'horas' and not feito loop
    select coalesce(sum(horas), 0) into v_total_horas from horas_por_membro_desde_horimetro(p_grupo_id, m.horimetro_base);

    for r in
      select gm.id as mid, gm.nome as mnome,
             coalesce((
               select sum(d.tempo_uso) from diario_bordo d
               where d.grupo_id = p_grupo_id and d.autor_id = gm.id and d.horimetro_fim > 0
                 and d.horimetro_inicio >= m.horimetro_base
             ), 0) as horas_membro
      from grupo_membros gm where gm.grupo_id = p_grupo_id and gm.ativo
    loop
      manutencao_id := m.id;
      descricao := m.descricao;
      proxima_data := m.proxima_data;
      horimetro_base := m.horimetro_base;
      intervalo_horas := m.intervalo_horas;
      horimetro_atual := v_horimetro_atual;
      horas_restantes := (m.horimetro_base + m.intervalo_horas) - v_horimetro_atual;
      custo_previsto := m.custo_previsto;
      membro_id := r.mid;
      membro_nome := r.mnome;
      horas := r.horas_membro;
      valor_estimado := case when v_total_horas > 0 and m.custo_previsto > 0
                              then round(m.custo_previsto * (r.horas_membro / v_total_horas), 2) else 0 end;
      return next;
    end loop;
  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- Atualiza mensalidade_membro para incluir o Custo Variável
-- (combustível, com 1 mês de atraso na cobrança, + rateio de manutenção
-- por horas ainda pendente)
-- ════════════════════════════════════════════════════════════
create or replace function mensalidade_membro(p_membro_id uuid, p_mes_ref date default current_date)
returns jsonb
language plpgsql stable as $$
declare
  v_grupo_id uuid;
  v_cotas numeric;
  v_total_cotas numeric;
  v_mes_atual date := date_trunc('month', p_mes_ref)::date;
  v_mes_proximo date := (date_trunc('month', p_mes_ref) + interval '1 month')::date;
  v_mes_anterior date := (date_trunc('month', p_mes_ref) - interval '1 month')::date;
  v_custo_fixo_atual numeric;
  v_reserva_atual numeric;
  v_custo_fixo_prox numeric;
  v_reserva_prox numeric;
  v_saldo_reserva_inicio_mes numeric;
  v_coberto numeric := 0;
  v_custo_fixo_pc_atual numeric;
  v_coberto_pc numeric;
  v_horas_mes_anterior numeric;
  v_custo_combustivel_mes_anterior numeric;
  v_horas_mes_atual numeric;
  v_custo_combustivel_mes_atual numeric;
  v_rateio_pendente numeric := 0;
  v_variavel_atual numeric := 0;
  v_variavel_prox numeric := 0;
begin
  select grupo_id, cotas into v_grupo_id, v_cotas from grupo_membros where id = p_membro_id;
  if v_grupo_id is null then raise exception 'Cotista não encontrado'; end if;

  v_total_cotas := total_cotas_ativas(v_grupo_id);
  v_custo_fixo_atual := custo_fixo_mes(v_grupo_id, v_mes_atual);
  v_reserva_atual := reserva_emergencia_mes(v_grupo_id, v_mes_atual);
  v_custo_fixo_prox := custo_fixo_mes(v_grupo_id, v_mes_proximo);
  v_reserva_prox := reserva_emergencia_mes(v_grupo_id, v_mes_proximo);

  v_saldo_reserva_inicio_mes := reserva_acumulada_ate(v_grupo_id, (v_mes_atual - interval '1 day')::date);
  if v_custo_fixo_atual > 0 and v_saldo_reserva_inicio_mes > 0 then
    v_coberto := least(v_custo_fixo_atual, v_saldo_reserva_inicio_mes);
  end if;

  v_custo_fixo_pc_atual := case when v_total_cotas > 0 then v_custo_fixo_atual / v_total_cotas else v_custo_fixo_atual end;
  v_coberto_pc := case when v_total_cotas > 0 then v_coberto / v_total_cotas else v_coberto end;

  v_horas_mes_anterior := horas_combustivel_membro_mes(p_membro_id, v_mes_anterior);
  v_custo_combustivel_mes_anterior := custo_combustivel_membro_mes(p_membro_id, v_mes_anterior);
  if v_horas_mes_anterior > 0 then
    v_variavel_atual := v_variavel_atual + v_custo_combustivel_mes_anterior;
  end if;

  v_horas_mes_atual := horas_combustivel_membro_mes(p_membro_id, v_mes_atual);
  v_custo_combustivel_mes_atual := custo_combustivel_membro_mes(p_membro_id, v_mes_atual);
  if v_horas_mes_atual > 0 then
    v_variavel_prox := v_variavel_prox + v_custo_combustivel_mes_atual;
  end if;

  select coalesce(sum(valor), 0) into v_rateio_pendente
    from rateio_manutencao where membro_id = p_membro_id and not confirmado;
  v_variavel_atual := v_variavel_atual + v_rateio_pendente;

  return jsonb_build_object(
    'cotas', v_cotas,
    'mesAtual', jsonb_build_object(
      'mesRef', to_char(v_mes_atual, 'YYYY-MM'),
      'custoFixo', round((v_custo_fixo_pc_atual - v_coberto_pc) * v_cotas, 2),
      'custoVariavel', round(v_variavel_atual, 2),
      'reservaEmergencia', round(v_reserva_atual * v_cotas, 2),
      'cobertoPelaReserva', round(v_coberto_pc * v_cotas, 2),
      'totalAPagar', round(((v_custo_fixo_pc_atual - v_coberto_pc) + v_reserva_atual) * v_cotas + v_variavel_atual, 2)
    ),
    'proximoMes', jsonb_build_object(
      'mesRef', to_char(v_mes_proximo, 'YYYY-MM'),
      'custoFixo', round((case when v_total_cotas > 0 then v_custo_fixo_prox / v_total_cotas else v_custo_fixo_prox end) * v_cotas, 2),
      'custoVariavel', round(v_variavel_prox, 2),
      'reservaEmergencia', round(v_reserva_prox * v_cotas, 2),
      'totalAPagar', round(((case when v_total_cotas > 0 then v_custo_fixo_prox / v_total_cotas else v_custo_fixo_prox end) + v_reserva_prox) * v_cotas + v_variavel_prox, 2)
    )
  );
end;
$$;

-- Atualiza mensalidades_todos para incluir o Custo Variável na listagem
-- (precisa apagar a função antiga primeiro: o formato das colunas de
-- retorno mudou, e o Postgres não permite "CREATE OR REPLACE" trocar isso)
drop function if exists mensalidades_todos(uuid);

create or replace function mensalidades_todos(p_grupo_id uuid)
returns table(
  membro_id uuid, nome text, cotas numeric,
  custo_fixo_mes numeric, custo_variavel_mes numeric, reserva_emergencia_mes numeric, total_mes_atual numeric,
  custo_fixo_proximo_mes numeric, reserva_emergencia_proximo_mes numeric, total_proximo_mes numeric
)
language plpgsql stable as $$
declare
  r record;
  m jsonb;
begin
  for r in select id, grupo_membros.nome from grupo_membros where grupo_id = p_grupo_id and ativo order by grupo_membros.nome loop
    m := mensalidade_membro(r.id);
    membro_id := r.id;
    nome := r.nome;
    cotas := (m->>'cotas')::numeric;
    custo_fixo_mes := (m->'mesAtual'->>'custoFixo')::numeric;
    custo_variavel_mes := (m->'mesAtual'->>'custoVariavel')::numeric;
    reserva_emergencia_mes := (m->'mesAtual'->>'reservaEmergencia')::numeric;
    total_mes_atual := (m->'mesAtual'->>'totalAPagar')::numeric;
    custo_fixo_proximo_mes := (m->'proximoMes'->>'custoFixo')::numeric;
    reserva_emergencia_proximo_mes := (m->'proximoMes'->>'reservaEmergencia')::numeric;
    total_proximo_mes := (m->'proximoMes'->>'totalAPagar')::numeric;
    return next;
  end loop;
end;
$$;
