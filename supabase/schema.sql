-- ════════════════════════════════════════════════════════════
-- sistema-cotistas — schema completo do banco de dados
--
-- Arquivo ÚNICO para criar toda a estrutura do zero (extensões, tabelas,
-- funções, triggers, políticas RLS e o job agendado). Substitui o antigo
-- histórico fragmentado de `supabase/migrations/*.sql`.
--
-- Como usar (projeto Supabase novo):
--   1. Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
--      (Requer apenas que o projeto já exista — o schema `auth` já vem
--      pronto de fábrica em qualquer projeto Supabase.)
--   2. Configure Authentication → Providers → Google se for usar login
--      com Google (não dá pra fazer isso por SQL).
--   3. Ajuste `MASTER_EMAIL` em `src/lib/constants.ts` no frontend para o
--      e-mail que poderá criar grupos novos (a função eh_master() abaixo
--      já está com o e-mail hardcoded — troque nos dois lugares).
--   4. Rode `npm install && npm run dev` com VITE_SUPABASE_URL e
--      VITE_SUPABASE_ANON_KEY do novo projeto no `.env`.
--
-- Gerado a partir de introspecção direta do banco de produção em
-- 2026-08-12, atualizado em 2026-08-18 (migrações 0023–0024: excluido,
-- excluir_membro, master_excluir_grupo, master_trocar_admin,
-- master_excluir_membro, DELETE policy em grupos).
--
-- A partir de agora, mudanças de schema devem ser aplicadas direto no
-- banco (via MCP `apply_migration` ou SQL Editor) e depois refletidas
-- aqui — não recriamos uma sequência de migrações numeradas.
-- ════════════════════════════════════════════════════════════

-- ── Extensões ─────────────────────────────────────────────────
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pg_cron" with schema extensions;

-- ════════════════════════════════════════════════════════════
-- TABELAS
-- ════════════════════════════════════════════════════════════

-- ── Núcleo: grupo (barco) e seus cotistas ───────────────────
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_recurso text not null default 'Embarcação',
  termo_cota text not null default 'cota',
  dia_virada integer not null default 4 check (dia_virada >= 1 and dia_virada <= 28),
  moeda text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  logo_url text,
  criado_em timestamptz not null default now()
);

create table public.grupo_membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  user_id uuid references auth.users(id),
  nome text not null,
  email text not null,
  telefone text,
  role text not null default 'cotista' check (role = any (array['admin','gestor','cotista'])),
  cotas numeric(6,2) not null default 1 check (cotas > 0),
  ativo boolean not null default true,
  excluido boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (grupo_id, user_id)
);

-- ── Agenda ────────────────────────────────────────────────────
create table public.feriados (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  data date not null,
  descricao text not null,
  unique (grupo_id, data)
);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  membro_id uuid not null references public.grupo_membros(id),
  data date not null,
  periodo text not null check (periodo = any (array['M','T'])),
  status text not null default 'confirmado' check (status = any (array['confirmado','cancelado'])),
  criado_em timestamptz not null default now()
);
create unique index reservas_turno_unico on public.reservas (grupo_id, data, periodo) where (status = 'confirmado');

-- ── Diário de bordo / horímetro ──────────────────────────────
create table public.diario_bordo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  autor_id uuid not null references public.grupo_membros(id),
  titulo text not null,
  relato text not null,
  prioridade text not null default 'normal' check (prioridade = any (array['normal','atencao','urgente'])),
  resolvido boolean not null default false,
  data_resolucao date,
  resolvido_por uuid references public.grupo_membros(id),
  horimetro_inicio numeric(10,1) not null default 0,
  horimetro_fim numeric(10,1) not null default 0,
  tempo_uso numeric(10,1) generated always as (
    case when horimetro_fim > 0 and horimetro_fim >= horimetro_inicio
         then horimetro_fim - horimetro_inicio else 0 end
  ) stored,
  diferenca_anterior numeric(10,1) default 0,
  observacoes text,
  data_uso_reportado date,
  criado_em timestamptz not null default now()
);
create index diario_autor_idx on public.diario_bordo (grupo_id, autor_id);

-- Histórico de troca/sincronização do aparelho de horímetro (ver
-- CLAUDE.md, seção "Horímetro — cuidado especial", antes de mexer aqui).
create table public.ajustes_horimetro (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  data date not null default current_date,
  leitura_anterior numeric not null,
  leitura_novo_aparelho numeric not null default 0,
  delta numeric not null,
  motivo text,
  criado_por uuid references public.grupo_membros(id),
  criado_em timestamptz not null default now()
);

-- ── Orçamento ─────────────────────────────────────────────────
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  tipo text not null check (tipo = any (array['receita','despesa'])),
  descricao text not null,
  valor numeric(12,2) not null check (valor >= 0),
  valor_por_cota numeric(12,2),
  data date not null,
  lancado_por uuid references public.grupo_membros(id),
  origem text not null default 'manual' check (origem = any (array['manual','caixa_inicial','ajuste_caixa','recorrente','manutencao_horas','seguro'])),
  origem_ref_id uuid,
  observacao text,
  criado_em timestamptz not null default now()
);
create index lancamentos_grupo_data_idx on public.lancamentos (grupo_id, data);
create index lancamentos_origem_idx on public.lancamentos (grupo_id, origem, origem_ref_id, data);

create table public.recorrentes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  tipo text not null check (tipo = any (array['receita','despesa'])),
  descricao text not null,
  valor_atual numeric(12,2) not null check (valor_atual >= 0),
  dia_cobranca integer not null check (dia_cobranca >= 1 and dia_cobranca <= 31),
  ativo boolean not null default true,
  data_inicio date,
  data_fim date,
  subtipo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.recorrentes_historico (
  id uuid primary key default gen_random_uuid(),
  recorrente_id uuid not null references public.recorrentes(id),
  valor_anterior numeric(12,2) not null,
  valor_novo numeric(12,2) not null,
  alterado_por uuid references public.grupo_membros(id),
  vigencia_inicio date not null,
  vigencia_fim date,
  criado_em timestamptz not null default now()
);

create table public.confirmacoes_pagamento (
  id uuid primary key default gen_random_uuid(),
  recorrente_id uuid not null references public.recorrentes(id),
  membro_id uuid not null references public.grupo_membros(id),
  mes_referencia char(7) not null,
  confirmado boolean not null default false,
  data_confirmacao date,
  confirmado_por uuid references public.grupo_membros(id),
  unique (recorrente_id, membro_id, mes_referencia)
);

-- ── Custos variáveis (combustível / óleo) ────────────────────
create table public.historico_custo_combustivel (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  consumo_por_hora numeric(8,3) not null,
  custo_unidade numeric(10,2) not null,
  unidades numeric(8,2) not null,
  custo_por_hora numeric(10,4) generated always as (
    case when unidades > 0 then (custo_unidade / unidades) * consumo_por_hora else 0 end
  ) stored,
  vigencia_inicio date not null,
  vigencia_fim date,
  alterado_por uuid references public.grupo_membros(id),
  criado_em timestamptz not null default now()
);

create table public.historico_custo_oleo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  custo_galao numeric not null check (custo_galao >= 0),
  data_inicio date not null,
  data_fim date,
  alterado_por uuid references public.grupo_membros(id),
  criado_em timestamptz not null default now()
);

-- ── Manutenção ────────────────────────────────────────────────
create table public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  descricao text not null,
  periodicidade text,
  tipo_gatilho text not null default 'data' check (tipo_gatilho = any (array['data','horas'])),
  proxima_data date,
  intervalo_horas numeric(10,1),
  horimetro_base numeric(10,1) not null default 0,
  custo_previsto numeric(12,2) default 0,
  custo_real numeric(12,2) default 0,
  feito boolean not null default false,
  data_execucao date,
  feito_por uuid references public.grupo_membros(id),
  observacao text,
  criado_em timestamptz not null default now(),
  data_inicio_ciclo date not null default current_date
);

create table public.rateio_manutencao (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id),
  descricao text not null,
  membro_id uuid not null references public.grupo_membros(id),
  horas numeric(10,1) not null default 0,
  valor numeric(12,2) not null,
  data date not null,
  confirmado boolean not null default false,
  data_confirmacao date
);

-- ── Seguro obrigatório ────────────────────────────────────────
create table public.seguros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  apolice text not null,
  seguradora text,
  data_inicio date not null,
  valor numeric(12,2) not null default 0,
  data_vencimento date not null,
  renovado_por uuid references public.grupo_membros(id),
  observacao text,
  criado_em timestamptz not null default now()
);

-- ── Informações úteis e avisos ────────────────────────────────
create table public.informacoes_uteis (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  categoria text not null check (categoria = any (array['Contato','Documento','Senha_Acesso','Procedimento','Outro'])),
  rotulo text not null,
  valor text not null,
  observacao text,
  autor_id uuid references public.grupo_membros(id),
  criado_em timestamptz not null default now()
);

create table public.avisos_embarcacao (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id),
  mensagem text not null,
  criado_por uuid references public.grupo_membros(id),
  criado_em timestamptz not null default now(),
  resolvido boolean not null default false,
  resolvido_por uuid references public.grupo_membros(id),
  resolvido_em timestamptz
);

-- ════════════════════════════════════════════════════════════
-- FUNÇÕES
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.alterar_valor_recorrente(p_recorrente_id uuid, p_novo_valor numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.calc_totais_mes_com_previstos(p_grupo_id uuid, p_mes_ref date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.concluir_manutencao(p_manutencao_id uuid, p_data_fechamento date, p_custo_real numeric DEFAULT NULL::numeric, p_reagendar_dias integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_grupo_id uuid;
  v_descricao text;
  v_data_inicio_ciclo date;
  v_total_horas numeric := 0;
  v_total_cotas numeric;
  v_saldo numeric;
  v_membro_id uuid;
  v_horimetro_atual numeric;
  v_nova_proxima_data date;
  r record;
begin
  select grupo_id, descricao, data_inicio_ciclo into v_grupo_id, v_descricao, v_data_inicio_ciclo
    from manutencoes where id = p_manutencao_id;
  if v_grupo_id is null then raise exception 'Manutenção não encontrada'; end if;

  select id into v_membro_id from grupo_membros where grupo_id = v_grupo_id and user_id = auth.uid();

  if p_custo_real is not null and p_custo_real > 0 then
    v_saldo := saldo_atual(v_grupo_id);
    if v_saldo - p_custo_real < -0.005 then
      raise exception 'Esta despesa deixaria o caixa negativo. Saldo atual: R$ %.', to_char(v_saldo, 'FM999999990.00');
    end if;

    select coalesce(sum(horas), 0) into v_total_horas
      from horas_por_membro_periodo(v_grupo_id, v_data_inicio_ciclo, p_data_fechamento);

    if v_total_horas > 0 then
      for r in select * from horas_por_membro_periodo(v_grupo_id, v_data_inicio_ciclo, p_data_fechamento) loop
        insert into rateio_manutencao (manutencao_id, descricao, membro_id, horas, valor, data)
        values (p_manutencao_id, v_descricao, r.membro_id, r.horas, round(p_custo_real * (r.horas / v_total_horas), 2), p_data_fechamento);
      end loop;
    else
      v_total_cotas := total_cotas_ativas(v_grupo_id);
      for r in select id, cotas from grupo_membros where grupo_id = v_grupo_id and ativo loop
        insert into rateio_manutencao (manutencao_id, descricao, membro_id, horas, valor, data)
        values (p_manutencao_id, v_descricao, r.id, 0, round(p_custo_real * (r.cotas / v_total_cotas), 2), p_data_fechamento);
      end loop;
    end if;

    insert into lancamentos (grupo_id, tipo, descricao, valor, data, lancado_por, origem, origem_ref_id, observacao)
    values (v_grupo_id, 'despesa', 'Manutenção periódica: ' || v_descricao, p_custo_real, p_data_fechamento, v_membro_id, 'manutencao_horas', p_manutencao_id, null);
  end if;

  v_horimetro_atual := ultimo_horimetro(v_grupo_id);

  if p_reagendar_dias is not null and p_reagendar_dias > 0 then
    v_nova_proxima_data := p_data_fechamento + (p_reagendar_dias || ' days')::interval;
  else
    v_nova_proxima_data := null;
  end if;

  update manutencoes
     set feito = false,
         data_execucao = p_data_fechamento,
         feito_por = v_membro_id,
         data_inicio_ciclo = p_data_fechamento,
         horimetro_base = v_horimetro_atual,
         proxima_data = coalesce(v_nova_proxima_data, proxima_data),
         custo_real = coalesce(p_custo_real, custo_real)
   where id = p_manutencao_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.concluir_manutencao_horas(p_manutencao_id uuid, p_custo_real numeric)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.conta_para_escala(p_grupo_id uuid, p_data date)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select extract(dow from p_data) in (0, 6)
    or exists(select 1 from feriados where grupo_id = p_grupo_id and data = p_data);
$function$;

CREATE OR REPLACE FUNCTION public.criar_grupo(p_nome text, p_nome_recurso text, p_dia_virada integer, p_admin_nome text, p_admin_email text)
 RETURNS grupos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_grupo grupos;
  v_user_id uuid := auth.uid();
  v_email text;
  v_admin_email text;
  v_admin_nome text;
begin
  if v_user_id is null then
    raise exception 'É necessário estar autenticado para criar um grupo';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  if v_email is distinct from 'victornogueirapinto@gmail.com' then
    raise exception 'Apenas o usuário master pode criar novos grupos.';
  end if;

  v_admin_email := coalesce(nullif(trim(p_admin_email), ''), v_email);
  v_admin_nome := coalesce(nullif(trim(p_admin_nome), ''), 'Admin');

  insert into grupos (nome, nome_recurso, dia_virada)
  values (p_nome, coalesce(nullif(p_nome_recurso, ''), 'Embarcação'), coalesce(p_dia_virada, 4))
  returning * into v_grupo;

  -- Convite do admin do novo grupo: se for o e-mail de outra pessoa, ela
  -- entra como "convite pendente" (mesmo mecanismo já usado para
  -- convidar cotistas) e é conectada automaticamente quando criar a
  -- própria conta com este e-mail.
  insert into grupo_membros (grupo_id, user_id, nome, email, role, cotas, ativo)
  values (
    v_grupo.id,
    case when v_admin_email = v_email then v_user_id else null end,
    v_admin_nome, v_admin_email, 'admin', 1, true
  );

  return v_grupo;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_lancamento(p_grupo_id uuid, p_tipo text, p_descricao text, p_valor numeric, p_data date, p_observacao text DEFAULT NULL::text)
 RETURNS lancamentos
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.criar_registro_diario(p_grupo_id uuid, p_titulo text, p_relato text, p_prioridade text DEFAULT 'normal'::text, p_horimetro_inicio numeric DEFAULT NULL::numeric, p_horimetro_fim numeric DEFAULT 0, p_observacoes text DEFAULT NULL::text, p_uso_rotina boolean DEFAULT false, p_data_uso date DEFAULT NULL::date)
 RETURNS diario_bordo
 LANGUAGE plpgsql
AS $function$
declare
  v_membro_id uuid;
  v_ultimo_fim numeric;
  v_horimetro_inicio numeric;
  v_diferenca numeric := 0;
  v_row diario_bordo;
begin
  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();
  if v_membro_id is null then raise exception 'Você não é membro deste grupo'; end if;

  v_ultimo_fim := ultima_leitura_horimetro(p_grupo_id);

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
$function$;

CREATE OR REPLACE FUNCTION public.custo_combustivel_membro_mes(p_membro_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(d.tempo_uso * custo_combustivel_por_hora_vigente(d.grupo_id, data_efetiva_diario(d.data_uso_reportado, d.criado_em))), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and date_trunc('month', data_efetiva_diario(d.data_uso_reportado, d.criado_em)) = date_trunc('month', p_mes_ref);
$function$;

CREATE OR REPLACE FUNCTION public.custo_combustivel_por_hora_vigente(p_grupo_id uuid, p_data date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(custo_por_hora, 0) from historico_custo_combustivel
  where grupo_id = p_grupo_id
    and vigencia_inicio <= p_data
    and (vigencia_fim is null or vigencia_fim >= p_data)
  order by vigencia_inicio desc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.custo_combustivel_total_mes(p_grupo_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(custo_combustivel_membro_mes(gm.id, p_mes_ref)), 0)
  from grupo_membros gm where gm.grupo_id = p_grupo_id and gm.ativo;
$function$;

CREATE OR REPLACE FUNCTION public.custo_fixo_mes(p_grupo_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.custo_oleo_membro_mes(p_membro_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(d.tempo_uso * custo_oleo_por_hora_vigente(d.grupo_id, data_efetiva_diario(d.data_uso_reportado, d.criado_em))), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and date_trunc('month', data_efetiva_diario(d.data_uso_reportado, d.criado_em)) = date_trunc('month', p_mes_ref);
$function$;

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

  v_horas := horas_grupo_periodo(p_grupo_id, v_galao.data_inicio, v_galao.data_fim);
  if v_horas <= 0 then return 0; end if;

  return v_galao.custo_galao / v_horas;
end;
$function$;

CREATE OR REPLACE FUNCTION public.custo_oleo_total_mes(p_grupo_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(custo_oleo_membro_mes(gm.id, p_mes_ref)), 0)
  from grupo_membros gm where gm.grupo_id = p_grupo_id and gm.ativo;
$function$;

CREATE OR REPLACE FUNCTION public.data_efetiva_diario(p_data_uso_reportado date, p_criado_em timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(p_data_uso_reportado, p_criado_em::date);
$function$;

CREATE OR REPLACE FUNCTION public.definir_custo_combustivel(p_grupo_id uuid, p_consumo_por_hora numeric, p_custo_unidade numeric, p_unidades numeric, p_data_inicio date DEFAULT CURRENT_DATE)
 RETURNS historico_custo_combustivel
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.definir_custo_oleo(p_grupo_id uuid, p_custo_galao numeric, p_data_inicio date DEFAULT CURRENT_DATE)
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

  insert into historico_custo_oleo (grupo_id, custo_galao, data_inicio, alterado_por)
  values (p_grupo_id, p_custo_galao, p_data_inicio, v_membro_id)
  returning * into v_row;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.despesa_mensal_total(p_grupo_id uuid, p_mes_ref date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_custo_fixo numeric;
  v_custo_variavel numeric;
  v_mes_oleo date := (date_trunc('month', p_mes_ref) - interval '1 month')::date;
begin
  v_custo_fixo := custo_fixo_mes(p_grupo_id, p_mes_ref);
  v_custo_variavel := custo_oleo_total_mes(p_grupo_id, v_mes_oleo);
  return jsonb_build_object('custoFixo', v_custo_fixo, 'custoVariavel', v_custo_variavel, 'total', v_custo_fixo + v_custo_variavel);
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_custo_combustivel_atual(p_id uuid, p_consumo_por_hora numeric, p_custo_unidade numeric, p_unidades numeric, p_data_inicio date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update historico_custo_combustivel
     set consumo_por_hora = p_consumo_por_hora,
         custo_unidade = p_custo_unidade,
         unidades = p_unidades,
         vigencia_inicio = coalesce(p_data_inicio, vigencia_inicio)
   where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_custo_oleo_atual(p_id uuid, p_custo_galao numeric, p_data_inicio date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update historico_custo_oleo
     set custo_galao = p_custo_galao,
         data_inicio = coalesce(p_data_inicio, data_inicio)
   where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_lancamento(p_id uuid, p_descricao text, p_valor numeric, p_data date, p_observacao text DEFAULT NULL::text)
 RETURNS lancamentos
 LANGUAGE plpgsql
AS $function$
declare
  v_row lancamentos;
  v_grupo_id uuid;
  v_tipo text;
  v_valor_antigo numeric;
  v_total_cotas numeric;
  v_valor_final numeric;
  v_valor_por_cota numeric;
  v_saldo_atual numeric;
  v_saldo_sem_este numeric;
begin
  select grupo_id, tipo, valor into v_grupo_id, v_tipo, v_valor_antigo from lancamentos where id = p_id;
  if v_grupo_id is null then raise exception 'Lançamento não encontrado'; end if;
  if not eh_gestor_ou_admin(v_grupo_id) then raise exception 'Sem permissão'; end if;
  v_total_cotas := total_cotas_ativas(v_grupo_id);
  if v_tipo = 'receita' then
    v_valor_por_cota := p_valor;
    v_valor_final := p_valor * v_total_cotas;
  else
    v_valor_final := p_valor;
    v_valor_por_cota := null;
    if p_data <= current_date then
      v_saldo_atual := saldo_atual(v_grupo_id);
      v_saldo_sem_este := v_saldo_atual + v_valor_antigo;
      if v_saldo_sem_este - v_valor_final < -0.005 then
        raise exception 'Esta despesa deixaria o caixa negativo. Saldo sem este lançamento: R$ %.', to_char(v_saldo_sem_este, 'FM999999990.00');
      end if;
    end if;
  end if;
  update lancamentos set descricao = p_descricao, valor = v_valor_final, valor_por_cota = v_valor_por_cota, data = p_data, observacao = p_observacao where id = p_id returning * into v_row;
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.eh_admin(p_grupo_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from grupo_membros
    where grupo_id = p_grupo_id and user_id = auth.uid() and ativo and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.eh_gestor_ou_admin(p_grupo_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from grupo_membros
    where grupo_id = p_grupo_id and user_id = auth.uid() and ativo
      and role in ('admin','gestor')
  );
$function$;

CREATE OR REPLACE FUNCTION public.eh_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(auth.jwt() ->> 'email', '') = 'victornogueirapinto@gmail.com';
$function$;

CREATE OR REPLACE FUNCTION public.eh_membro_ativo(p_grupo_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from grupo_membros
    where grupo_id = p_grupo_id and user_id = auth.uid() and ativo
  );
$function$;

CREATE OR REPLACE FUNCTION public.excluir_membro(p_membro_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_grupo_id uuid;
  v_is_admin boolean;
BEGIN
  SELECT grupo_id INTO v_grupo_id
  FROM grupo_membros
  WHERE id = p_membro_id;

  IF v_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado.';
  END IF;

  SELECT eh_admin(v_grupo_id) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir cotistas.';
  END IF;

  UPDATE grupo_membros
  SET
    nome = 'Excluído',
    email = 'excluido-' || left(p_membro_id::text, 8),
    telefone = NULL,
    user_id = NULL,
    ativo = false,
    excluido = true
  WHERE id = p_membro_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fechar_custo_oleo(p_id uuid, p_data_fim date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update historico_custo_oleo set data_fim = p_data_fim where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.horas_combustivel_membro_mes(p_membro_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(d.tempo_uso), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and date_trunc('month', data_efetiva_diario(d.data_uso_reportado, d.criado_em)) = date_trunc('month', p_mes_ref);
$function$;

CREATE OR REPLACE FUNCTION public.horas_grupo_periodo(p_grupo_id uuid, p_data_inicio date, p_data_fim date DEFAULT NULL::date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(d.tempo_uso), 0)
  from diario_bordo d
  where d.grupo_id = p_grupo_id
    and d.horimetro_fim > 0
    and data_efetiva_diario(d.data_uso_reportado, d.criado_em) >= p_data_inicio
    and (p_data_fim is null or data_efetiva_diario(d.data_uso_reportado, d.criado_em) <= p_data_fim);
$function$;

CREATE OR REPLACE FUNCTION public.horas_membro_periodo(p_membro_id uuid, p_data_inicio date, p_data_fim date DEFAULT NULL::date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(d.tempo_uso), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and data_efetiva_diario(d.data_uso_reportado, d.criado_em) >= p_data_inicio
    and (p_data_fim is null or data_efetiva_diario(d.data_uso_reportado, d.criado_em) <= p_data_fim);
$function$;

CREATE OR REPLACE FUNCTION public.horas_oleo_membro_mes(p_membro_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(d.tempo_uso), 0)
  from diario_bordo d
  where d.autor_id = p_membro_id
    and d.horimetro_fim > 0
    and date_trunc('month', data_efetiva_diario(d.data_uso_reportado, d.criado_em)) = date_trunc('month', p_mes_ref);
$function$;

CREATE OR REPLACE FUNCTION public.horas_por_membro_desde_horimetro(p_grupo_id uuid, p_horimetro_base numeric)
 RETURNS TABLE(membro_id uuid, horas numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select d.autor_id, sum(d.tempo_uso)
  from diario_bordo d
  where d.grupo_id = p_grupo_id and d.horimetro_fim > 0 and d.horimetro_inicio >= p_horimetro_base
  group by d.autor_id;
$function$;

CREATE OR REPLACE FUNCTION public.horas_por_membro_periodo(p_grupo_id uuid, p_data_inicio date, p_data_fim date DEFAULT NULL::date)
 RETURNS TABLE(membro_id uuid, horas numeric)
 LANGUAGE sql
 STABLE
AS $function$
  select d.autor_id, sum(d.tempo_uso)
  from diario_bordo d
  where d.grupo_id = p_grupo_id
    and d.horimetro_fim > 0
    and data_efetiva_diario(d.data_uso_reportado, d.criado_em) >= p_data_inicio
    and (p_data_fim is null or data_efetiva_diario(d.data_uso_reportado, d.criado_em) <= p_data_fim)
  group by d.autor_id;
$function$;

CREATE OR REPLACE FUNCTION public.master_editar_nome_grupo(p_grupo_id uuid, p_nome text)
 RETURNS grupos
 LANGUAGE plpgsql
AS $function$
declare
  v_row grupos;
begin
  if not eh_master() then
    raise exception 'Sem permissão';
  end if;
  update grupos set nome = p_nome where id = p_grupo_id returning * into v_row;
  if v_row.id is null then raise exception 'Grupo não encontrado'; end if;
  return v_row;
end;
$function$;

-- ── master_excluir_grupo ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.master_excluir_grupo(p_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT eh_master() THEN
    RAISE EXCEPTION 'Apenas o usuário master pode excluir grupos.';
  END IF;

  DELETE FROM reservas WHERE grupo_id = p_grupo_id;
  DELETE FROM diario_bordo WHERE grupo_id = p_grupo_id;
  DELETE FROM ajustes_horimetro WHERE grupo_id = p_grupo_id;
  DELETE FROM lancamentos WHERE grupo_id = p_grupo_id;
  DELETE FROM recorrentes_historico WHERE recorrente_id IN (SELECT id FROM recorrentes WHERE grupo_id = p_grupo_id);
  DELETE FROM recorrentes WHERE grupo_id = p_grupo_id;
  DELETE FROM confirmacoes_pagamento WHERE recorrente_id IN (
    SELECT r.id FROM recorrentes r WHERE r.grupo_id = p_grupo_id
  );
  DELETE FROM rateio_manutencao WHERE manutencao_id IN (SELECT id FROM manutencoes WHERE grupo_id = p_grupo_id);
  DELETE FROM manutencoes WHERE grupo_id = p_grupo_id;
  DELETE FROM seguros WHERE grupo_id = p_grupo_id;
  DELETE FROM informacoes_uteis WHERE grupo_id = p_grupo_id;
  DELETE FROM avisos_embarcacao WHERE grupo_id = p_grupo_id;
  DELETE FROM historico_custo_combustivel WHERE grupo_id = p_grupo_id;
  DELETE FROM historico_custo_oleo WHERE grupo_id = p_grupo_id;
  DELETE FROM feriados WHERE grupo_id = p_grupo_id;
  DELETE FROM grupo_membros WHERE grupo_id = p_grupo_id;
  DELETE FROM grupos WHERE id = p_grupo_id;
END;
$function$;

-- ── master_trocar_admin ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.master_trocar_admin(
  p_grupo_id uuid,
  p_novo_admin_email text,
  p_novo_admin_nome text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_membro_existente RECORD;
  v_nome text;
BEGIN
  IF NOT eh_master() THEN
    RAISE EXCEPTION 'Apenas o usuário master pode trocar administradores.';
  END IF;

  IF p_novo_admin_email IS NULL OR trim(p_novo_admin_email) = '' THEN
    RAISE EXCEPTION 'E-mail do novo administrador é obrigatório.';
  END IF;

  v_nome := coalesce(nullif(trim(p_novo_admin_nome), ''), split_part(p_novo_admin_email, '@', 1));

  UPDATE grupo_membros
  SET role = 'cotista'
  WHERE grupo_id = p_grupo_id AND role = 'admin' AND ativo = true;

  SELECT id, user_id INTO v_membro_existente
  FROM grupo_membros
  WHERE grupo_id = p_grupo_id
    AND lower(email) = lower(trim(p_novo_admin_email))
    AND excluido = false
  LIMIT 1;

  IF v_membro_existente IS NOT NULL THEN
    UPDATE grupo_membros SET role = 'admin' WHERE id = v_membro_existente.id;
  ELSE
    INSERT INTO grupo_membros (grupo_id, user_id, nome, email, role, cotas, ativo)
    VALUES (p_grupo_id, NULL, v_nome, trim(p_novo_admin_email), 'admin', 1, true);
  END IF;
END;
$function$;

-- ── master_excluir_membro ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.master_excluir_membro(p_membro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NOT eh_master() THEN
    RAISE EXCEPTION 'Apenas o usuário master pode excluir membros de outros grupos.';
  END IF;

  UPDATE grupo_membros
  SET
    nome = 'Excluído',
    email = 'excluido-' || left(p_membro_id::text, 8),
    telefone = NULL,
    user_id = NULL,
    ativo = false,
    excluido = true
  WHERE id = p_membro_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mensalidade_membro(p_membro_id uuid, p_mes_ref date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
  v_custo_oleo_mes_anterior numeric;
  v_horas_mes_atual numeric;
  v_custo_oleo_mes_atual numeric;
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

  v_horas_mes_anterior := horas_oleo_membro_mes(p_membro_id, v_mes_anterior);
  v_custo_oleo_mes_anterior := custo_oleo_membro_mes(p_membro_id, v_mes_anterior);
  if v_horas_mes_anterior > 0 then
    v_variavel_atual := v_variavel_atual + v_custo_oleo_mes_anterior;
  end if;

  v_horas_mes_atual := horas_oleo_membro_mes(p_membro_id, v_mes_atual);
  v_custo_oleo_mes_atual := custo_oleo_membro_mes(p_membro_id, v_mes_atual);
  if v_horas_mes_atual > 0 then
    v_variavel_prox := v_variavel_prox + v_custo_oleo_mes_atual;
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
$function$;

CREATE OR REPLACE FUNCTION public.mensalidades_todos(p_grupo_id uuid)
 RETURNS TABLE(membro_id uuid, nome text, cotas numeric, custo_fixo_mes numeric, custo_variavel_mes numeric, reserva_emergencia_mes numeric, total_mes_atual numeric, custo_fixo_proximo_mes numeric, reserva_emergencia_proximo_mes numeric, total_proximo_mes numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.painel_gestor(p_grupo_id uuid, p_mes_ref date, p_ano_ref integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
  v_horas_restantes numeric;
  v_dias_restantes numeric;
  v_horimetro_atual numeric;
  v_custo_oleo_hora numeric;
  v_custo_oleo_total_mes numeric;
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
      'custoOleoMes', custo_oleo_membro_mes(r.id, p_mes_ref)
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
    v_horas_restantes := null;
    if v_man.intervalo_horas is not null then
      v_horas_restantes := v_man.intervalo_horas - horas_grupo_periodo(p_grupo_id, v_man.data_inicio_ciclo, null);
    end if;
    v_dias_restantes := null;
    if v_man.proxima_data is not null then
      v_dias_restantes := (v_man.proxima_data - current_date);
    end if;

    if v_horas_restantes is not null and v_dias_restantes is not null then
      v_chave := least(v_horas_restantes / 8.0, v_dias_restantes);
    elsif v_horas_restantes is not null then
      v_chave := v_horas_restantes / 8.0;
    elsif v_dias_restantes is not null then
      v_chave := v_dias_restantes;
    else
      v_chave := 999999;
    end if;

    if v_melhor_chave is null or v_chave < v_melhor_chave then
      v_melhor_chave := v_chave;
      v_prox_manutencao := jsonb_build_object(
        'descricao', v_man.descricao, 'periodicidade', v_man.periodicidade,
        'proximaData', v_man.proxima_data, 'horimetroAtual', v_horimetro_atual,
        'horasRestantes', v_horas_restantes, 'diasParaVencer', v_dias_restantes,
        'custoPrevisto', coalesce(v_man.custo_previsto, 0)
      );
    end if;
  end loop;

  v_custo_oleo_hora := coalesce(custo_oleo_por_hora_vigente(p_grupo_id, current_date), 0);
  v_custo_oleo_total_mes := custo_oleo_total_mes(p_grupo_id, p_mes_ref);

  for v_man in select * from manutencoes where grupo_id = p_grupo_id and intervalo_horas is not null loop
    v_manutencoes_horas := v_manutencoes_horas || jsonb_build_object(
      'descricao', v_man.descricao, 'proximaData', v_man.proxima_data,
      'intervaloHoras', v_man.intervalo_horas, 'dataInicioCiclo', v_man.data_inicio_ciclo,
      'horasUsadas', horas_grupo_periodo(p_grupo_id, v_man.data_inicio_ciclo, null),
      'horasRestantes', v_man.intervalo_horas - horas_grupo_periodo(p_grupo_id, v_man.data_inicio_ciclo, null),
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
      'custoOleoPorHora', v_custo_oleo_hora,
      'custoOleoTotalMes', v_custo_oleo_total_mes,
      'manutencoesHoras', v_manutencoes_horas,
      'rateiosPendentes', v_rateios_pendentes
    ),
    'relatoriosPendentesTodos', v_relatorios_pendentes
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.processar_recorrentes_do_dia()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  r record;
  ja_lancado boolean;
  total_cotas numeric;
  valor_final numeric;
  membro record;
begin
  for r in
    select * from recorrentes
    where ativo
      and dia_cobranca = extract(day from current_date)
      and (data_inicio is null or current_date >= data_inicio)
      and (data_fim is null or current_date <= data_fim)
  loop
    select exists (
      select 1 from lancamentos
      where grupo_id = r.grupo_id
        and origem = 'recorrente' and origem_ref_id = r.id
        and date_trunc('month', data) = date_trunc('month', current_date)
    ) into ja_lancado;

    if not ja_lancado then
      select total_cotas_ativas(r.grupo_id) into total_cotas;
      valor_final := case when r.tipo = 'receita' then r.valor_atual * total_cotas else r.valor_atual end;

      insert into lancamentos (grupo_id, tipo, descricao, valor, valor_por_cota, data, origem, origem_ref_id, observacao)
      values (
        r.grupo_id, r.tipo, r.descricao, valor_final,
        case when r.tipo = 'receita' then r.valor_atual else null end,
        current_date, 'recorrente', r.id, 'Lançamento automático diário'
      );

      if r.tipo = 'receita' then
        for membro in select id from grupo_membros where grupo_id = r.grupo_id and ativo loop
          insert into confirmacoes_pagamento (recorrente_id, membro_id, mes_referencia)
          values (r.id, membro.id, to_char(current_date, 'YYYY-MM'))
          on conflict (recorrente_id, membro_id, mes_referencia) do nothing;
        end loop;
      end if;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.projecao_manutencao_horas(p_grupo_id uuid)
 RETURNS TABLE(manutencao_id uuid, descricao text, proxima_data date, data_inicio_ciclo date, intervalo_horas numeric, horas_usadas numeric, horas_restantes numeric, custo_previsto numeric, membro_id uuid, membro_nome text, horas numeric, valor_estimado numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  m record;
  v_total_horas numeric;
  r record;
begin
  for m in
    select mnt.* from manutencoes mnt
    where mnt.grupo_id = p_grupo_id and not mnt.feito and mnt.intervalo_horas is not null
  loop
    v_total_horas := horas_grupo_periodo(p_grupo_id, m.data_inicio_ciclo, null);

    for r in
      select gm.id as mid, gm.nome as mnome, horas_membro_periodo(gm.id, m.data_inicio_ciclo, null) as horas_membro
      from grupo_membros gm where gm.grupo_id = p_grupo_id and gm.ativo
    loop
      manutencao_id := m.id;
      descricao := m.descricao;
      proxima_data := m.proxima_data;
      data_inicio_ciclo := m.data_inicio_ciclo;
      intervalo_horas := m.intervalo_horas;
      horas_usadas := v_total_horas;
      horas_restantes := m.intervalo_horas - v_total_horas;
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
$function$;

CREATE OR REPLACE FUNCTION public.registrar_troca_horimetro(p_grupo_id uuid, p_horas_reais_ate_troca numeric, p_leitura_aparelho_novo numeric, p_motivo text DEFAULT NULL::text, p_data date DEFAULT CURRENT_DATE)
 RETURNS ajustes_horimetro
 LANGUAGE plpgsql
AS $function$
declare
  v_membro_id uuid;
  v_row ajustes_horimetro;
begin
  if not eh_gestor_ou_admin(p_grupo_id) then
    raise exception 'Sem permissão';
  end if;

  select id into v_membro_id from grupo_membros where grupo_id = p_grupo_id and user_id = auth.uid();

  insert into ajustes_horimetro (
    grupo_id, data, leitura_anterior, leitura_novo_aparelho, delta, motivo, criado_por
  ) values (
    p_grupo_id,
    p_data,
    p_horas_reais_ate_troca,
    p_leitura_aparelho_novo,
    p_horas_reais_ate_troca - p_leitura_aparelho_novo,
    coalesce(p_motivo, 'Troca de aparelho de horímetro'),
    v_membro_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.relatorios_pendentes_membro(p_membro_id uuid)
 RETURNS TABLE(reserva_id uuid, data date, periodo text)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.relatorios_pendentes_todos(p_grupo_id uuid)
 RETURNS TABLE(membro_id uuid, nome text, pendentes bigint)
 LANGUAGE sql
 STABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.renovar_seguro(p_grupo_id uuid, p_apolice text, p_seguradora text, p_data_inicio date, p_valor numeric, p_data_vencimento date, p_lancar_despesa boolean, p_observacao text DEFAULT NULL::text)
 RETURNS seguros
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reserva_acumulada_ate(p_grupo_id uuid, p_data date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select greatest(0,
    coalesce(sum(case when tipo = 'receita' then valor else 0 end), 0) -
    coalesce(sum(case when tipo = 'despesa' and origem <> 'manutencao_horas' then valor else 0 end), 0)
  )
  from lancamentos
  where grupo_id = p_grupo_id and data <= p_data;
$function$;

CREATE OR REPLACE FUNCTION public.reserva_emergencia_mes(p_grupo_id uuid, p_mes_ref date)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.resumo_custo_oleo(p_grupo_id uuid)
 RETURNS TABLE(id uuid, custo_galao numeric, data_inicio date, data_fim date, horas_consumidas numeric, custo_por_hora numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  r record;
  v_horas numeric;
begin
  for r in select * from historico_custo_oleo where grupo_id = p_grupo_id order by data_inicio desc loop
    v_horas := horas_grupo_periodo(p_grupo_id, r.data_inicio, r.data_fim);
    id := r.id;
    custo_galao := r.custo_galao;
    data_inicio := r.data_inicio;
    data_fim := r.data_fim;
    horas_consumidas := v_horas;
    custo_por_hora := case when v_horas > 0 then round(r.custo_galao / v_horas, 4) else null end;
    return next;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.saldo_atual(p_grupo_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select greatest(0,
    coalesce(sum(case when tipo = 'receita' then valor else 0 end), 0) -
    coalesce(sum(case when tipo = 'despesa' then valor else 0 end), 0)
  )
  from lancamentos
  where grupo_id = p_grupo_id and data <= current_date;
$function$;

CREATE OR REPLACE FUNCTION public.total_cotas_ativas(p_grupo_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(sum(cotas), 0) from grupo_membros where grupo_id = p_grupo_id and ativo;
$function$;

CREATE OR REPLACE FUNCTION public.ultima_leitura_horimetro(p_grupo_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select t.valor from (
    select horimetro_fim as valor, criado_em from diario_bordo
      where grupo_id = p_grupo_id and horimetro_fim > 0
    union all
    select leitura_novo_aparelho as valor, criado_em from ajustes_horimetro
      where grupo_id = p_grupo_id
  ) t
  order by t.criado_em desc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.ultimo_horimetro(p_grupo_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(ultima_leitura_horimetro(p_grupo_id), 0);
$function$;

CREATE OR REPLACE FUNCTION public.vincular_convite_pendente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.grupo_membros
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.vincular_membro_a_conta_existente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.user_id is null then
    select id into new.user_id
      from auth.users
     where lower(email) = lower(new.email)
     limit 1;
  end if;
  return new;
end;
$function$;

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Vincula automaticamente uma conta recém-criada a um convite pendente
-- (grupo_membros com user_id nulo e o mesmo e-mail) já existente.
create trigger ao_criar_conta_vincular_convite
  after insert on auth.users
  for each row execute function public.vincular_convite_pendente();

-- Vincula um novo convite (grupo_membros inserido) a uma conta que já
-- existia antes do convite ser criado (direção inversa da anterior —
-- ver CLAUDE.md, fluxo de convite, migração 0021 original).
create trigger ao_convidar_vincular_conta_existente
  before insert on public.grupo_membros
  for each row execute function public.vincular_membro_a_conta_existente();

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

alter table public.grupos enable row level security;
alter table public.grupo_membros enable row level security;
alter table public.feriados enable row level security;
alter table public.reservas enable row level security;
alter table public.diario_bordo enable row level security;
alter table public.ajustes_horimetro enable row level security;
alter table public.lancamentos enable row level security;
alter table public.recorrentes enable row level security;
alter table public.recorrentes_historico enable row level security;
alter table public.confirmacoes_pagamento enable row level security;
alter table public.historico_custo_combustivel enable row level security;
alter table public.historico_custo_oleo enable row level security;
alter table public.manutencoes enable row level security;
alter table public.rateio_manutencao enable row level security;
alter table public.seguros enable row level security;
alter table public.informacoes_uteis enable row level security;
alter table public.avisos_embarcacao enable row level security;

-- ── grupos ────────────────────────────────────────────────────
create policy "usuario autenticado pode criar grupo" on public.grupos
  for insert with check (true);
create policy "master le todos os grupos" on public.grupos
  for select using (eh_master());
create policy "membros leem seu grupo" on public.grupos
  for select using (eh_membro_ativo(id));
create policy "admin atualiza config do grupo" on public.grupos
  for update using (eh_admin(id));
create policy "master atualiza qualquer grupo" on public.grupos
  for update using (eh_master());
create policy "master exclui grupos" on public.grupos
  for delete using (eh_master());

-- ── grupo_membros ─────────────────────────────────────────────
create policy "admin adiciona membros" on public.grupo_membros
  for insert with check (eh_admin(grupo_id));
create policy "fundador vira admin do grupo recem-criado" on public.grupo_membros
  for insert with check (
    user_id = auth.uid() and role = 'admin'
    and not exists (select 1 from grupo_membros gm2 where gm2.grupo_id = grupo_membros.grupo_id)
  );
create policy "master le todos os membros" on public.grupo_membros
  for select using (eh_master());
create policy "membros leem colegas do grupo" on public.grupo_membros
  for select using (eh_membro_ativo(grupo_id));
create policy "admin edita membros" on public.grupo_membros
  for update using (eh_admin(grupo_id));
create policy "admin exclui membros" on public.grupo_membros
  for delete using (eh_admin(grupo_id));

-- ── feriados ──────────────────────────────────────────────────
create policy "admin exclui feriados" on public.feriados
  for delete using (eh_admin(grupo_id));
create policy "admin gerencia feriados" on public.feriados
  for insert with check (eh_admin(grupo_id));
create policy "membros leem feriados" on public.feriados
  for select using (eh_membro_ativo(grupo_id));
create policy "admin atualiza feriados" on public.feriados
  for update using (eh_admin(grupo_id));

-- ── reservas ──────────────────────────────────────────────────
create policy "membros criam reservas" on public.reservas
  for insert with check (eh_membro_ativo(grupo_id));
create policy "membros leem reservas" on public.reservas
  for select using (eh_membro_ativo(grupo_id));
create policy "dono cancela reserva futura ou gestor cancela qualquer uma" on public.reservas
  for update using (
    eh_membro_ativo(grupo_id) and (
      (membro_id in (select grupo_membros.id from grupo_membros where grupo_membros.user_id = auth.uid()) and data >= current_date)
      or eh_gestor_ou_admin(grupo_id)
    )
  );

-- ── diario_bordo ──────────────────────────────────────────────
create policy "gestor exclui registro do diario" on public.diario_bordo
  for delete using (eh_gestor_ou_admin(grupo_id));
create policy "membros criam registro no diario" on public.diario_bordo
  for insert with check (eh_membro_ativo(grupo_id));
create policy "membros leem diario" on public.diario_bordo
  for select using (eh_membro_ativo(grupo_id));
create policy "autor ou gestor edita registro" on public.diario_bordo
  for update using (
    autor_id in (select grupo_membros.id from grupo_membros where grupo_membros.user_id = auth.uid())
    or eh_gestor_ou_admin(grupo_id)
  );

-- ── ajustes_horimetro ─────────────────────────────────────────
create policy "gestor exclui ajuste de horimetro" on public.ajustes_horimetro
  for delete using (eh_gestor_ou_admin(grupo_id));
create policy "gestor registra ajuste de horimetro" on public.ajustes_horimetro
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem ajustes de horimetro" on public.ajustes_horimetro
  for select using (eh_membro_ativo(grupo_id));

-- ── lancamentos ───────────────────────────────────────────────
create policy "gestor exclui lancamentos" on public.lancamentos
  for delete using (eh_gestor_ou_admin(grupo_id));
create policy "gestor lanca despesas/receitas" on public.lancamentos
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem lancamentos" on public.lancamentos
  for select using (eh_membro_ativo(grupo_id));
create policy "gestor edita lancamentos" on public.lancamentos
  for update using (eh_gestor_ou_admin(grupo_id));

-- ── recorrentes ───────────────────────────────────────────────
create policy "admin gerencia recorrentes" on public.recorrentes
  for insert with check (eh_admin(grupo_id));
create policy "membros leem recorrentes" on public.recorrentes
  for select using (eh_membro_ativo(grupo_id));
create policy "admin atualiza recorrentes" on public.recorrentes
  for update using (eh_admin(grupo_id));

-- ── recorrentes_historico ─────────────────────────────────────
create policy "gestor registra historico de valores" on public.recorrentes_historico
  for insert with check (
    exists (select 1 from recorrentes r where r.id = recorrentes_historico.recorrente_id and eh_admin(r.grupo_id))
  );
create policy "membros leem historico de valores" on public.recorrentes_historico
  for select using (
    exists (select 1 from recorrentes r where r.id = recorrentes_historico.recorrente_id and eh_membro_ativo(r.grupo_id))
  );

-- ── confirmacoes_pagamento ────────────────────────────────────
create policy "sistema cria confirmacoes" on public.confirmacoes_pagamento
  for insert with check (
    exists (select 1 from recorrentes r where r.id = confirmacoes_pagamento.recorrente_id and eh_membro_ativo(r.grupo_id))
  );
create policy "membros leem confirmacoes" on public.confirmacoes_pagamento
  for select using (
    exists (select 1 from recorrentes r where r.id = confirmacoes_pagamento.recorrente_id and eh_membro_ativo(r.grupo_id))
  );
create policy "cotista confirma o proprio pagamento" on public.confirmacoes_pagamento
  for update using (
    membro_id in (select grupo_membros.id from grupo_membros where grupo_membros.user_id = auth.uid())
    or exists (select 1 from recorrentes r where r.id = confirmacoes_pagamento.recorrente_id and eh_gestor_ou_admin(r.grupo_id))
  );

-- ── historico_custo_combustivel ───────────────────────────────
create policy "gestor gerencia custo combustivel" on public.historico_custo_combustivel
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem custo combustivel" on public.historico_custo_combustivel
  for select using (eh_membro_ativo(grupo_id));
create policy "gestor atualiza custo combustivel" on public.historico_custo_combustivel
  for update using (eh_gestor_ou_admin(grupo_id));

-- ── historico_custo_oleo ──────────────────────────────────────
create policy "gestor exclui custo oleo" on public.historico_custo_oleo
  for delete using (eh_gestor_ou_admin(grupo_id));
create policy "gestor gerencia custo oleo" on public.historico_custo_oleo
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem custo oleo" on public.historico_custo_oleo
  for select using (eh_membro_ativo(grupo_id));
create policy "gestor atualiza custo oleo" on public.historico_custo_oleo
  for update using (eh_gestor_ou_admin(grupo_id));

-- ── manutencoes ───────────────────────────────────────────────
create policy "gestor exclui manutencoes" on public.manutencoes
  for delete using (eh_gestor_ou_admin(grupo_id));
create policy "gestor gerencia manutencoes" on public.manutencoes
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem manutencoes" on public.manutencoes
  for select using (eh_membro_ativo(grupo_id));
create policy "gestor atualiza manutencoes" on public.manutencoes
  for update using (eh_gestor_ou_admin(grupo_id));

-- ── rateio_manutencao ─────────────────────────────────────────
create policy "sistema/gestor cria rateio" on public.rateio_manutencao
  for insert with check (
    exists (select 1 from manutencoes m where m.id = rateio_manutencao.manutencao_id and eh_gestor_ou_admin(m.grupo_id))
  );
create policy "membros leem rateio" on public.rateio_manutencao
  for select using (
    exists (select 1 from manutencoes m where m.id = rateio_manutencao.manutencao_id and eh_membro_ativo(m.grupo_id))
  );
create policy "cotista confirma o proprio rateio" on public.rateio_manutencao
  for update using (
    membro_id in (select grupo_membros.id from grupo_membros where grupo_membros.user_id = auth.uid())
    or exists (select 1 from manutencoes m where m.id = rateio_manutencao.manutencao_id and eh_gestor_ou_admin(m.grupo_id))
  );

-- ── seguros ───────────────────────────────────────────────────
create policy "admin exclui seguro" on public.seguros
  for delete using (eh_admin(grupo_id));
create policy "gestor gerencia seguro" on public.seguros
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem seguro" on public.seguros
  for select using (eh_membro_ativo(grupo_id));
create policy "gestor atualiza seguro" on public.seguros
  for update using (eh_gestor_ou_admin(grupo_id)) with check (eh_gestor_ou_admin(grupo_id));

-- ── informacoes_uteis ─────────────────────────────────────────
create policy "admin exclui informacoes" on public.informacoes_uteis
  for delete using (eh_admin(grupo_id));
create policy "membros criam informacoes" on public.informacoes_uteis
  for insert with check (eh_membro_ativo(grupo_id));
create policy "membros leem informacoes" on public.informacoes_uteis
  for select using (eh_membro_ativo(grupo_id));

-- ── avisos_embarcacao ─────────────────────────────────────────
create policy "gestor exclui aviso" on public.avisos_embarcacao
  for delete using (eh_gestor_ou_admin(grupo_id));
create policy "gestor cria aviso" on public.avisos_embarcacao
  for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "membros leem avisos" on public.avisos_embarcacao
  for select using (eh_membro_ativo(grupo_id));
create policy "gestor resolve aviso" on public.avisos_embarcacao
  for update using (eh_gestor_ou_admin(grupo_id));

-- ════════════════════════════════════════════════════════════
-- JOB AGENDADO (pg_cron)
-- ════════════════════════════════════════════════════════════

-- Todo dia às 06:00 UTC, gera os lançamentos do dia para as cobranças
-- recorrentes ativas de todos os grupos.
select cron.schedule(
  'processar-recorrentes-do-dia',
  '0 6 * * *',
  $$select processar_recorrentes_do_dia();$$
);
