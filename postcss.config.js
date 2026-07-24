-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0006 — Seguro e Painel do Gestor
-- Cole no SQL Editor do Supabase (depois de 0001 a 0005) e clique em "Run".
-- ════════════════════════════════════════════════════════════

-- ── Renovar apólice de seguro (opcionalmente lança a despesa) ──
create or replace function renovar_seguro(
  p_grupo_id uuid, p_apolice text, p_seguradora text, p_data_inicio date, p_valor numeric,
  p_data_vencimento date, p_lancar_despesa boolean, p_observacao text default null
) returns seguros
language plpgsql as $$
declare
  v_membro_id uuid;
  v_saldo numeric;
  v_row seguros;
begin
  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();
  if v_membro_id is null then raise exception 'Você não é membro deste grupo'; end if;

  if p_lancar_despesa and p_valor > 0 then
    v_saldo := saldo_atual(p_grupo_id);
    if v_saldo - p_valor < -0.005 then
      raise exception 'Esta despesa deixaria o caixa negativo. Saldo atual: R$ %.', to_char(v_saldo, 'FM999999990.00');
    end if;
  end if;

  insert into seguros (grupo_id, apolice, seguradora, data_inicio, valor, data_vencimento, renovado_por, observacao)
  values (p_grupo_id, p_apolice, p_seguradora, p_data_inicio, p_valor, p_data_vencimento, v_membro_id, p_observacao)
  returning * into v_row;

  if p_lancar_despesa and p_valor > 0 then
    insert into lancamentos (grupo_id, tipo, descricao, valor, data, lancado_por, origem, origem_ref_id, observacao)
    values (p_grupo_id, 'despesa', 'Seguro Obrigatório - Renovação', p_valor, p_data_inicio, v_membro_id, 'seguro', v_row.id, null);
  end if;

  return v_row;
end;
$$;

-- ── Um dia conta pra escala de prioridade (fim de semana ou feriado) ──
create or replace function conta_para_escala(p_grupo_id uuid, p_data date) returns boolean
language sql stable as $$
  select extract(dow from p_data) in (0, 6)
    or exists(select 1 from feriados where grupo_id = p_grupo_id and data = p_data);
$$;

-- ── Custo de combustível TOTAL do grupo (todos os cotistas) num mês ──
create or replace function custo_combustivel_total_mes(p_grupo_id uuid, p_mes_ref date) returns numeric
language sql stable as $$
  select coalesce(sum(custo_combustivel_membro_mes(gm.id, p_mes_ref)), 0)
  from grupo_membros gm where gm.grupo_id = p_grupo_id and gm.ativo;
$$;

-- ── Despesa mensal total (Custo Fixo do mês + Combustível do mês ANTERIOR) ──
create or replace function despesa_mensal_total(p_grupo_id uuid, p_mes_ref date) returns jsonb
language plpgsql stable as $$
declare
  v_custo_fixo numeric;
  v_custo_variavel numeric;
  v_mes_combustivel date := (date_trunc('month', p_mes_ref) - interval '1 month')::date;
begin
  v_custo_fixo := custo_fixo_mes(p_grupo_id, p_mes_ref);
  v_custo_variavel := custo_combustivel_total_mes(p_grupo_id, v_mes_combustivel);
  return jsonb_build_object('custoFixo', v_custo_fixo, 'custoVariavel', v_custo_variavel, 'total', v_custo_fixo + v_custo_variavel);
end;
$$;

-- ── Receitas/despesas do mês, incluindo recorrentes "previstos" (ainda não lançados) ──
create or replace function calc_totais_mes_com_previstos(p_grupo_id uuid, p_mes_ref date)
returns jsonb
language plpgsql stable as $$
declare
  v_mes_prefixo text := to_char(p_mes_ref, 'YYYY-MM');
  v_receitas numeric := 0;
  v_despesas numeric := 0;
  v_receitas_detalhe jsonb := '[]'::jsonb;
  v_despesas_detalhe jsonb := '[]'::jsonb;
  l record;
  rec record;
  v_ja_lancado boolean;
  v_ultimo_dia_mes date := (date_trunc('month', p_mes_ref) + interval '1 month - 1 day')::date;
  v_primeiro_dia_mes date := date_trunc('month', p_mes_ref)::date;
  v_dia_clamp int;
  v_data_prevista date;
  v_valor_previsto numeric;
  v_total_cotas numeric;
begin
  for l in select * from lancamentos where grupo_id = p_grupo_id and to_char(data, 'YYYY-MM') = v_mes_prefixo loop
    if l.tipo = 'receita' then
      v_receitas := v_receitas + l.valor;
      v_receitas_detalhe := v_receitas_detalhe || jsonb_build_object(
        'id', l.id, 'descricao', l.descricao, 'valor', l.valor, 'data', l.data,
        'isAuto', l.origem <> 'manual', 'previsto', false, 'observacao', coalesce(l.observacao, '')
      );
    else
      v_despesas := v_despesas + l.valor;
      v_despesas_detalhe := v_despesas_detalhe || jsonb_build_object(
        'id', l.id, 'descricao', l.descricao, 'valor', l.valor, 'data', l.data,
        'isAuto', l.origem <> 'manual', 'previsto', false, 'observacao', coalesce(l.observacao, '')
      );
    end if;
  end loop;

  v_total_cotas := total_cotas_ativas(p_grupo_id);

  for rec in select * from recorrentes
    where grupo_id = p_grupo_id and ativo
      and (data_inicio is null or data_inicio <= v_ultimo_dia_mes)
      and (data_fim is null or data_fim >= v_primeiro_dia_mes)
  loop
    select exists(
      select 1 from lancamentos
      where grupo_id = p_grupo_id and to_char(data, 'YYYY-MM') = v_mes_prefixo
        and origem = 'recorrente' and origem_ref_id = rec.id
    ) into v_ja_lancado;

    if not v_ja_lancado then
      v_dia_clamp := least(rec.dia_cobranca, extract(day from v_ultimo_dia_mes)::int);
      v_data_prevista := (v_primeiro_dia_mes + (v_dia_clamp - 1) * interval '1 day')::date;
      v_valor_previsto := case when rec.tipo = 'receita' then rec.valor_atual * v_total_cotas else rec.valor_atual end;

      if rec.tipo = 'receita' then
        v_receitas := v_receitas + v_valor_previsto;
        v_receitas_detalhe := v_receitas_detalhe || jsonb_build_object(
          'id', rec.id, 'descricao', rec.descricao, 'valor', v_valor_previsto, 'data', v_data_prevista,
          'isAuto', true, 'previsto', true, 'observacao', 'Recorrente previsto (ainda não lançado neste mês)'
        );
      else
        v_despesas := v_despesas + v_valor_previsto;
        v_despesas_detalhe := v_despesas_detalhe || jsonb_build_object(
          'id', rec.id, 'descricao', rec.descricao, 'valor', v_valor_previsto, 'data', v_data_prevista,
          'isAuto', true, 'previsto', true, 'observacao', 'Recorrente previsto (ainda não lançado neste mês)'
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'receitas', v_receitas, 'despesas', v_despesas, 'saldo', v_receitas - v_despesas,
    'receitasDetalhe', v_receitas_detalhe, 'despesasDetalhe', v_despesas_detalhe
  );
end;
$$;

-- ── Painel do Gestor completo (só Admin/Gestor) ──────────────
create or replace function painel_gestor(p_grupo_id uuid, p_mes_ref date, p_ano_ref int)
returns jsonb
language plpgsql stable as $$
declare
  v_mes_prefixo text := to_char(p_mes_ref, 'YYYY-MM');
  v_ano_prefixo text := p_ano_ref::text;
  v_por_usuario jsonb := '[]'::jsonb;
  r record;
  v_dum int; v_dtm int; v_dua int; v_dta int;
  v_hm numeric; v_ha numeric;
  v_tot_dum int := 0; v_tot_dtm int := 0; v_tot_dua int := 0; v_tot_dta int := 0;
  v_tot_hm numeric := 0; v_tot_ha numeric := 0;
  v_calc jsonb;
  v_despesa_mensal jsonb;
  v_saldo_atual numeric;
  v_seguro jsonb := null;
  v_apolice record;
  v_prox_manutencao jsonb := null;
  v_man record;
  v_melhor_chave numeric;
  v_chave numeric;
  v_horimetro_atual numeric;
  v_custo_comb_hora numeric;
  v_custo_comb_total_mes numeric;
  v_manutencoes_horas jsonb := '[]'::jsonb;
  v_rateios_pendentes int;
  v_relatorios_pendentes jsonb := '[]'::jsonb;
  rp record;
begin
  if not eh_gestor_ou_admin(p_grupo_id) then
    raise exception 'Sem permissão';
  end if;

  for r in select * from grupo_membros where grupo_id = p_grupo_id order by nome loop
    select count(distinct data) into v_dum from reservas
      where membro_id = r.id and status <> 'cancelado' and to_char(data, 'YYYY-MM') = v_mes_prefixo
        and conta_para_escala(p_grupo_id, data);
    select count(distinct data) into v_dtm from reservas
      where membro_id = r.id and status <> 'cancelado' and to_char(data, 'YYYY-MM') = v_mes_prefixo;
    select count(distinct data) into v_dua from reservas
      where membro_id = r.id and status <> 'cancelado' and to_char(data, 'YYYY') = v_ano_prefixo
        and conta_para_escala(p_grupo_id, data);
    select count(distinct data) into v_dta from reservas
      where membro_id = r.id and status <> 'cancelado' and to_char(data, 'YYYY') = v_ano_prefixo;
    select coalesce(sum(d.tempo_uso), 0) into v_hm from diario_bordo d
      where d.autor_id = r.id and d.horimetro_fim > 0
        and to_char(data_efetiva_diario(d.data_uso_reportado, d.criado_em), 'YYYY-MM') = v_mes_prefixo;
    select coalesce(sum(d.tempo_uso), 0) into v_ha from diario_bordo d
      where d.autor_id = r.id and d.horimetro_fim > 0
        and to_char(data_efetiva_diario(d.data_uso_reportado, d.criado_em), 'YYYY') = v_ano_prefixo;

    v_por_usuario := v_por_usuario || jsonb_build_object(
      'membroId', r.id, 'nome', r.nome, 'ativo', r.ativo,
      'diasUteisMes', v_dum, 'diasTodosMes', v_dtm,
      'diasUteisAno', v_dua, 'diasTodosAno', v_dta,
      'horasMes', v_hm, 'horasAno', v_ha,
      'custoCombustivelMes', custo_combustivel_membro_mes(r.id, p_mes_ref)
    );

    v_tot_dum := v_tot_dum + v_dum; v_tot_dtm := v_tot_dtm + v_dtm;
    v_tot_dua := v_tot_dua + v_dua; v_tot_dta := v_tot_dta + v_dta;
    v_tot_hm := v_tot_hm + v_hm; v_tot_ha := v_tot_ha + v_ha;
  end loop;

  v_calc := calc_totais_mes_com_previstos(p_grupo_id, p_mes_ref);
  v_despesa_mensal := despesa_mensal_total(p_grupo_id, p_mes_ref);
  v_saldo_atual := saldo_atual(p_grupo_id);

  select * into v_apolice from seguros where grupo_id = p_grupo_id order by data_vencimento desc limit 1;
  if found then
    v_seguro := jsonb_build_object(
      'apolice', v_apolice.apolice, 'seguradora', v_apolice.seguradora,
      'dataInicio', v_apolice.data_inicio, 'dataVencimento', v_apolice.data_vencimento,
      'valor', v_apolice.valor, 'diasParaVencer', (v_apolice.data_vencimento - current_date)
    );
  end if;

  v_horimetro_atual := ultimo_horimetro(p_grupo_id);
  v_melhor_chave := null;
  for v_man in select * from manutencoes where grupo_id = p_grupo_id and not feito loop
    if v_man.tipo_gatilho = 'horas' then
      v_chave := ((v_man.horimetro_base + coalesce(v_man.intervalo_horas, 0)) - v_horimetro_atual) / 8.0;
    else
      v_chave := coalesce((v_man.proxima_data - current_date)::numeric, 999999);
    end if;
    if v_melhor_chave is null or v_chave < v_melhor_chave then
      v_melhor_chave := v_chave;
      if v_man.tipo_gatilho = 'horas' then
        v_prox_manutencao := jsonb_build_object(
          'descricao', v_man.descricao, 'tipoGatilho', 'horas', 'periodicidade', v_man.periodicidade,
          'proximaData', v_man.proxima_data, 'horimetroAtual', v_horimetro_atual,
          'horasRestantes', (v_man.horimetro_base + coalesce(v_man.intervalo_horas, 0)) - v_horimetro_atual,
          'custoPrevisto', coalesce(v_man.custo_previsto, 0), 'diasParaVencer', null
        );
      else
        v_prox_manutencao := jsonb_build_object(
          'descricao', v_man.descricao, 'tipoGatilho', 'data', 'periodicidade', v_man.periodicidade,
          'proximaData', v_man.proxima_data,
          'diasParaVencer', case when v_man.proxima_data is not null then (v_man.proxima_data - current_date) else null end,
          'horasRestantes', null, 'custoPrevisto', coalesce(v_man.custo_previsto, 0)
        );
      end if;
    end if;
  end loop;

  select custo_por_hora into v_custo_comb_hora from historico_custo_combustivel
    where grupo_id = p_grupo_id and vigencia_fim is null limit 1;
  v_custo_comb_hora := coalesce(v_custo_comb_hora, 0);
  v_custo_comb_total_mes := custo_combustivel_total_mes(p_grupo_id, p_mes_ref);

  for v_man in select * from manutencoes where grupo_id = p_grupo_id and tipo_gatilho = 'horas' loop
    v_manutencoes_horas := v_manutencoes_horas || jsonb_build_object(
      'descricao', v_man.descricao, 'proximaData', v_man.proxima_data,
      'intervaloHoras', v_man.intervalo_horas, 'horimetroBase', v_man.horimetro_base,
      'horimetroAtual', v_horimetro_atual,
      'horasRestantes', (v_man.horimetro_base + coalesce(v_man.intervalo_horas, 0)) - v_horimetro_atual,
      'custoPrevisto', coalesce(v_man.custo_previsto, 0)
    );
  end loop;

  select count(*) into v_rateios_pendentes from rateio_manutencao rm
    join manutencoes m on m.id = rm.manutencao_id
    where m.grupo_id = p_grupo_id and not rm.confirmado;

  for rp in select * from relatorios_pendentes_todos(p_grupo_id) loop
    v_relatorios_pendentes := v_relatorios_pendentes || jsonb_build_object(
      'membroId', rp.membro_id, 'nome', rp.nome, 'pendentes', rp.pendentes
    );
  end loop;

  return jsonb_build_object(
    'mesRef', v_mes_prefixo, 'anoRef', p_ano_ref,
    'porUsuario', v_por_usuario,
    'totais', jsonb_build_object(
      'diasUteisMes', v_tot_dum, 'diasTodosMes', v_tot_dtm,
      'diasUteisAno', v_tot_dua, 'diasTodosAno', v_tot_dta,
      'horasMes', v_tot_hm, 'horasAno', v_tot_ha
    ),
    'financeiro', jsonb_build_object(
      'custoFixoMes', v_despesa_mensal->'custoFixo',
      'custoVariavelMes', v_despesa_mensal->'custoVariavel',
      'despesaTotalMes', v_despesa_mensal->'total',
      'reservaEmergencia', v_saldo_atual,
      'receitasDetalhe', v_calc->'receitasDetalhe',
      'despesasDetalhe', v_calc->'despesasDetalhe'
    ),
    'seguro', v_seguro,
    'proximaManutencao', v_prox_manutencao,
    'custosVariaveis', jsonb_build_object(
      'custoCombustivelPorHora', v_custo_comb_hora,
      'custoCombustivelTotalMes', v_custo_comb_total_mes,
      'manutencoesHoras', v_manutencoes_horas,
      'rateiosPendentes', v_rateios_pendentes
    ),
    'relatoriosPendentesTodos', v_relatorios_pendentes
  );
end;
$$;
