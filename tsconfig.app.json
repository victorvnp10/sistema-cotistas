-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0003 — Funções do módulo Orçamento
-- Cole no SQL Editor do Supabase (depois de já ter rodado 0001 e 0002) e
-- clique em "Run".
--
-- Por que funções no banco em vez de calcular no aplicativo?
-- Este cálculo (custo fixo, reserva de emergência, mensalidade, proteção
-- contra caixa negativo) é a regra de negócio mais sensível do sistema —
-- fazer aqui garante que ninguém consiga burlar a proteção de caixa
-- negativo nem calcular a mensalidade errado, não importa por onde a
-- gravação seja feita.
--
-- LIMITAÇÃO CONHECIDA (será resolvida na Fase 4 — Painel do Gestor):
-- custo_fixo_mes/reserva_emergencia_mes usam o valor ATUAL dos recorrentes,
-- não o valor histórico vigente em meses passados. Para o mês atual e o
-- próximo (o que a maioria das telas mostra) isso não faz diferença. Vamos
-- ajustar para usar `recorrentes_historico` quando construirmos relatórios
-- de meses fechados.
-- ════════════════════════════════════════════════════════════

-- ── Total de cotas ativas do grupo ──────────────────────────
create or replace function total_cotas_ativas(p_grupo_id uuid) returns numeric
language sql stable as $$
  select coalesce(sum(cotas), 0) from grupo_membros where grupo_id = p_grupo_id and ativo;
$$;

-- ── Saldo atual em caixa (nunca exibido negativo) ───────────
create or replace function saldo_atual(p_grupo_id uuid) returns numeric
language sql stable as $$
  select greatest(0,
    coalesce(sum(case when tipo = 'receita' then valor else 0 end), 0) -
    coalesce(sum(case when tipo = 'despesa' then valor else 0 end), 0)
  )
  from lancamentos
  where grupo_id = p_grupo_id and data <= current_date;
$$;

-- ── Reserva de emergência acumulada até uma data ────────────
-- (exclui despesas de manutenção por horas, que têm cobrança própria)
create or replace function reserva_acumulada_ate(p_grupo_id uuid, p_data date) returns numeric
language sql stable as $$
  select greatest(0,
    coalesce(sum(case when tipo = 'receita' then valor else 0 end), 0) -
    coalesce(sum(case when tipo = 'despesa' and origem <> 'manutencao_horas' then valor else 0 end), 0)
  )
  from lancamentos
  where grupo_id = p_grupo_id and data <= p_data;
$$;

-- ── Custo Fixo do mês (valor ABSOLUTO, não por cota) ────────
create or replace function custo_fixo_mes(p_grupo_id uuid, p_mes_ref date) returns numeric
language sql stable as $$
  select
    coalesce((
      select sum(valor_atual) from recorrentes
      where grupo_id = p_grupo_id and tipo = 'despesa' and ativo
        and (data_inicio is null or data_inicio <= (date_trunc('month', p_mes_ref) + interval '1 month - 1 day')::date)
        and (data_fim is null or data_fim >= date_trunc('month', p_mes_ref)::date)
    ), 0)
    +
    coalesce((
      select sum(valor) from lancamentos
      where grupo_id = p_grupo_id and tipo = 'despesa'
        and origem not in ('recorrente', 'manutencao_horas')
        and date_trunc('month', data) = date_trunc('month', p_mes_ref)
    ), 0);
$$;

-- ── Reserva de Emergência do mês (valor POR COTA) ───────────
create or replace function reserva_emergencia_mes(p_grupo_id uuid, p_mes_ref date) returns numeric
language sql stable as $$
  select
    coalesce((
      select sum(valor_atual) from recorrentes
      where grupo_id = p_grupo_id and tipo = 'receita' and ativo
        and (data_inicio is null or data_inicio <= (date_trunc('month', p_mes_ref) + interval '1 month - 1 day')::date)
        and (data_fim is null or data_fim >= date_trunc('month', p_mes_ref)::date)
    ), 0)
    +
    coalesce((
      select sum(coalesce(valor_por_cota, 0)) from lancamentos
      where grupo_id = p_grupo_id and tipo = 'receita'
        and origem <> 'recorrente'
        and date_trunc('month', data) = date_trunc('month', p_mes_ref)
    ), 0);
$$;

-- ── Mensalidade de UM cotista (mês atual + próximo mês) ─────
create or replace function mensalidade_membro(p_membro_id uuid, p_mes_ref date default current_date)
returns jsonb
language plpgsql stable as $$
declare
  v_grupo_id uuid;
  v_cotas numeric;
  v_total_cotas numeric;
  v_mes_atual date := date_trunc('month', p_mes_ref)::date;
  v_mes_proximo date := (date_trunc('month', p_mes_ref) + interval '1 month')::date;
  v_custo_fixo_atual numeric;
  v_reserva_atual numeric;
  v_custo_fixo_prox numeric;
  v_reserva_prox numeric;
  v_saldo_reserva_inicio_mes numeric;
  v_coberto numeric := 0;
  v_custo_fixo_pc_atual numeric;
  v_coberto_pc numeric;
begin
  select grupo_id, cotas into v_grupo_id, v_cotas from grupo_membros where id = p_membro_id;
  if v_grupo_id is null then
    raise exception 'Cotista não encontrado';
  end if;

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

  return jsonb_build_object(
    'cotas', v_cotas,
    'mesAtual', jsonb_build_object(
      'mesRef', to_char(v_mes_atual, 'YYYY-MM'),
      'custoFixo', round((v_custo_fixo_pc_atual - v_coberto_pc) * v_cotas, 2),
      'reservaEmergencia', round(v_reserva_atual * v_cotas, 2),
      'cobertoPelaReserva', round(v_coberto_pc * v_cotas, 2),
      'totalAPagar', round(((v_custo_fixo_pc_atual - v_coberto_pc) + v_reserva_atual) * v_cotas, 2)
    ),
    'proximoMes', jsonb_build_object(
      'mesRef', to_char(v_mes_proximo, 'YYYY-MM'),
      'custoFixo', round((case when v_total_cotas > 0 then v_custo_fixo_prox / v_total_cotas else v_custo_fixo_prox end) * v_cotas, 2),
      'reservaEmergencia', round(v_reserva_prox * v_cotas, 2),
      'totalAPagar', round(((case when v_total_cotas > 0 then v_custo_fixo_prox / v_total_cotas else v_custo_fixo_prox end) + v_reserva_prox) * v_cotas, 2)
    )
  );
end;
$$;

-- ── Mensalidade de TODOS os cotistas ativos (transparência) ─
create or replace function mensalidades_todos(p_grupo_id uuid)
returns table(
  membro_id uuid, nome text, cotas numeric,
  custo_fixo_mes numeric, reserva_emergencia_mes numeric, total_mes_atual numeric,
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
    reserva_emergencia_mes := (m->'mesAtual'->>'reservaEmergencia')::numeric;
    total_mes_atual := (m->'mesAtual'->>'totalAPagar')::numeric;
    custo_fixo_proximo_mes := (m->'proximoMes'->>'custoFixo')::numeric;
    reserva_emergencia_proximo_mes := (m->'proximoMes'->>'reservaEmergencia')::numeric;
    total_proximo_mes := (m->'proximoMes'->>'totalAPagar')::numeric;
    return next;
  end loop;
end;
$$;

-- ── Criar lançamento (receita "por cota" -> total; proteção de caixa) ──
create or replace function criar_lancamento(
  p_grupo_id uuid, p_tipo text, p_descricao text, p_valor numeric, p_data date, p_observacao text default null
) returns lancamentos
language plpgsql as $$
declare
  v_total_cotas numeric;
  v_valor_final numeric;
  v_valor_por_cota numeric;
  v_saldo numeric;
  v_row lancamentos;
  v_membro_id uuid;
begin
  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();
  if v_membro_id is null then
    raise exception 'Você não é membro deste grupo';
  end if;

  v_total_cotas := total_cotas_ativas(p_grupo_id);

  if p_tipo = 'receita' then
    v_valor_por_cota := p_valor;
    v_valor_final := p_valor * v_total_cotas;
  else
    v_valor_final := p_valor;
    v_valor_por_cota := null;

    if p_data <= current_date then
      v_saldo := saldo_atual(p_grupo_id);
      if v_saldo - v_valor_final < -0.005 then
        raise exception
          'Esta despesa deixaria o caixa negativo. Saldo atual: R$ %. Registre uma Reserva de Emergência antes ou reduza o valor.',
          to_char(v_saldo, 'FM999999990.00');
      end if;
    end if;
  end if;

  insert into lancamentos (grupo_id, tipo, descricao, valor, valor_por_cota, data, lancado_por, origem, observacao)
  values (p_grupo_id, p_tipo, p_descricao, v_valor_final, v_valor_por_cota, p_data, v_membro_id, 'manual', p_observacao)
  returning * into v_row;

  return v_row;
end;
$$;

-- ── Alterar valor de um recorrente (preserva histórico de vigência) ──
create or replace function alterar_valor_recorrente(p_recorrente_id uuid, p_novo_valor numeric)
returns void language plpgsql as $$
declare
  v_atual numeric;
  v_grupo_id uuid;
  v_membro_id uuid;
begin
  select valor_atual, grupo_id into v_atual, v_grupo_id from recorrentes where id = p_recorrente_id;
  if v_grupo_id is null then
    raise exception 'Recorrente não encontrado';
  end if;

  select id into v_membro_id from grupo_membros where grupo_id = v_grupo_id and user_id = auth.uid();

  update recorrentes_historico
     set vigencia_fim = current_date - 1
   where recorrente_id = p_recorrente_id and vigencia_fim is null;

  insert into recorrentes_historico (recorrente_id, valor_anterior, valor_novo, alterado_por, vigencia_inicio)
  values (p_recorrente_id, v_atual, p_novo_valor, v_membro_id, current_date);

  update recorrentes set valor_atual = p_novo_valor, atualizado_em = now() where id = p_recorrente_id;
end;
$$;
