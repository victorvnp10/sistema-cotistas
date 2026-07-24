-- ════════════════════════════════════════════════════════════
-- SCHEMA INICIAL — Sistema de Gestão de Cotistas
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode ser executado em um projeto novo, do zero.
-- ════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- GRUPOS (multi-tenant: cada grupo de cotistas é isolado dos demais)
-- ────────────────────────────────────────────────────────────
create table grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_recurso text not null default 'Embarcação',
  termo_cota text not null default 'cota',
  dia_virada int not null default 4 check (dia_virada between 1 and 28),
  moeda text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  logo_url text,
  criado_em timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- MEMBROS DO GRUPO (= "Cotistas")
-- ────────────────────────────────────────────────────────────
create table grupo_membros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  role text not null default 'cotista' check (role in ('admin','gestor','cotista')),
  cotas numeric(6,2) not null default 1 check (cotas > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (grupo_id, user_id)
);

-- ────────────────────────────────────────────────────────────
-- FERIADOS
-- ────────────────────────────────────────────────────────────
create table feriados (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  data date not null,
  descricao text not null,
  unique (grupo_id, data)
);

-- ────────────────────────────────────────────────────────────
-- RESERVAS
-- ────────────────────────────────────────────────────────────
create table reservas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  membro_id uuid not null references grupo_membros(id) on delete cascade,
  data date not null,
  periodo text not null check (periodo in ('M','T')),
  status text not null default 'confirmado' check (status in ('confirmado','cancelado')),
  criado_em timestamptz not null default now()
);
create unique index reservas_turno_unico
  on reservas (grupo_id, data, periodo)
  where status = 'confirmado';

-- ────────────────────────────────────────────────────────────
-- RECORRENTES (mensalidades / despesas fixas recorrentes) + histórico
-- ────────────────────────────────────────────────────────────
create table recorrentes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  tipo text not null check (tipo in ('receita','despesa')),
  descricao text not null,
  valor_atual numeric(12,2) not null check (valor_atual >= 0),
  dia_cobranca int not null check (dia_cobranca between 1 and 31),
  ativo boolean not null default true,
  data_inicio date,
  data_fim date,
  subtipo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table recorrentes_historico (
  id uuid primary key default gen_random_uuid(),
  recorrente_id uuid not null references recorrentes(id) on delete cascade,
  valor_anterior numeric(12,2) not null,
  valor_novo numeric(12,2) not null,
  alterado_por uuid references grupo_membros(id),
  vigencia_inicio date not null,
  vigencia_fim date,
  criado_em timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- LANÇAMENTOS (receitas/despesas eventuais + geradas automaticamente)
-- ────────────────────────────────────────────────────────────
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  tipo text not null check (tipo in ('receita','despesa')),
  descricao text not null,
  valor numeric(12,2) not null check (valor >= 0),
  valor_por_cota numeric(12,2),
  data date not null,
  lancado_por uuid references grupo_membros(id),
  origem text not null default 'manual'
    check (origem in ('manual','caixa_inicial','ajuste_caixa','recorrente','manutencao_horas','seguro')),
  origem_ref_id uuid,
  observacao text,
  criado_em timestamptz not null default now()
);
create index lancamentos_grupo_data_idx on lancamentos (grupo_id, data);
create index lancamentos_origem_idx on lancamentos (grupo_id, origem, origem_ref_id, data);

-- ────────────────────────────────────────────────────────────
-- CONFIRMAÇÕES DE PAGAMENTO
-- ────────────────────────────────────────────────────────────
create table confirmacoes_pagamento (
  id uuid primary key default gen_random_uuid(),
  recorrente_id uuid not null references recorrentes(id) on delete cascade,
  membro_id uuid not null references grupo_membros(id) on delete cascade,
  mes_referencia char(7) not null,
  confirmado boolean not null default false,
  data_confirmacao date,
  confirmado_por uuid references grupo_membros(id),
  unique (recorrente_id, membro_id, mes_referencia)
);

-- ────────────────────────────────────────────────────────────
-- CUSTO VARIÁVEL DE COMBUSTÍVEL/ÓLEO (vigências)
-- ────────────────────────────────────────────────────────────
create table historico_custo_combustivel (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  consumo_por_hora numeric(8,3) not null,
  custo_unidade numeric(10,2) not null,
  unidades numeric(8,2) not null,
  custo_por_hora numeric(10,4) generated always as
    (case when unidades > 0 then (custo_unidade / unidades) * consumo_por_hora else 0 end) stored,
  vigencia_inicio date not null,
  vigencia_fim date,
  alterado_por uuid references grupo_membros(id),
  criado_em timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- DIÁRIO DE BORDO
-- ────────────────────────────────────────────────────────────
create table diario_bordo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  autor_id uuid not null references grupo_membros(id),
  titulo text not null,
  relato text not null,
  prioridade text not null default 'normal' check (prioridade in ('normal','atencao','urgente')),
  resolvido boolean not null default false,
  data_resolucao date,
  resolvido_por uuid references grupo_membros(id),
  horimetro_inicio numeric(10,1) not null default 0,
  horimetro_fim numeric(10,1) not null default 0,
  tempo_uso numeric(10,1) generated always as
    (case when horimetro_fim > 0 and horimetro_fim >= horimetro_inicio
          then horimetro_fim - horimetro_inicio else 0 end) stored,
  diferenca_anterior numeric(10,1) default 0,
  observacoes text,
  data_uso_reportado date,
  criado_em timestamptz not null default now()
);
create index diario_autor_idx on diario_bordo (grupo_id, autor_id);

-- ────────────────────────────────────────────────────────────
-- MANUTENÇÕES + RATEIO
-- ────────────────────────────────────────────────────────────
create table manutencoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  descricao text not null,
  periodicidade text,
  tipo_gatilho text not null default 'data' check (tipo_gatilho in ('data','horas')),
  proxima_data date,
  intervalo_horas numeric(10,1),
  horimetro_base numeric(10,1) not null default 0,
  custo_previsto numeric(12,2) default 0,
  custo_real numeric(12,2) default 0,
  feito boolean not null default false,
  data_execucao date,
  feito_por uuid references grupo_membros(id),
  observacao text,
  criado_em timestamptz not null default now()
);

create table rateio_manutencao (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references manutencoes(id) on delete cascade,
  descricao text not null,
  membro_id uuid not null references grupo_membros(id),
  horas numeric(10,1) not null default 0,
  valor numeric(12,2) not null,
  data date not null,
  confirmado boolean not null default false,
  data_confirmacao date
);

-- ────────────────────────────────────────────────────────────
-- SEGURO
-- ────────────────────────────────────────────────────────────
create table seguros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  apolice text not null,
  seguradora text,
  data_inicio date not null,
  valor numeric(12,2) not null default 0,
  data_vencimento date not null,
  renovado_por uuid references grupo_membros(id),
  observacao text,
  criado_em timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- INFORMAÇÕES ÚTEIS
-- ────────────────────────────────────────────────────────────
create table informacoes_uteis (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  categoria text not null check (categoria in ('Contato','Documento','Senha_Acesso','Procedimento','Outro')),
  rotulo text not null,
  valor text not null,
  observacao text,
  autor_id uuid references grupo_membros(id),
  criado_em timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

-- Função auxiliar: o usuário logado é membro ativo deste grupo?
create or replace function eh_membro_ativo(p_grupo_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from grupo_membros
    where grupo_id = p_grupo_id and user_id = auth.uid() and ativo
  );
$$;

-- O usuário logado é admin OU gestor deste grupo?
create or replace function eh_gestor_ou_admin(p_grupo_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from grupo_membros
    where grupo_id = p_grupo_id and user_id = auth.uid() and ativo
      and role in ('admin','gestor')
  );
$$;

-- O usuário logado é admin deste grupo?
create or replace function eh_admin(p_grupo_id uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from grupo_membros
    where grupo_id = p_grupo_id and user_id = auth.uid() and ativo and role = 'admin'
  );
$$;

alter table grupos enable row level security;
alter table grupo_membros enable row level security;
alter table feriados enable row level security;
alter table reservas enable row level security;
alter table recorrentes enable row level security;
alter table recorrentes_historico enable row level security;
alter table lancamentos enable row level security;
alter table confirmacoes_pagamento enable row level security;
alter table historico_custo_combustivel enable row level security;
alter table diario_bordo enable row level security;
alter table manutencoes enable row level security;
alter table rateio_manutencao enable row level security;
alter table seguros enable row level security;
alter table informacoes_uteis enable row level security;

-- GRUPOS
create policy "usuario autenticado pode criar grupo"
  on grupos for insert with check (auth.uid() is not null);
create policy "membros leem seu grupo"
  on grupos for select using (eh_membro_ativo(id));
create policy "admin atualiza config do grupo"
  on grupos for update using (eh_admin(id));

-- GRUPO_MEMBROS
create policy "fundador vira admin do grupo recem-criado"
  on grupo_membros for insert with check (
    user_id = auth.uid() and role = 'admin'
    and not exists (select 1 from grupo_membros gm2 where gm2.grupo_id = grupo_membros.grupo_id)
  );
create policy "admin adiciona membros"
  on grupo_membros for insert with check (eh_admin(grupo_id));
create policy "membros leem colegas do grupo"
  on grupo_membros for select using (eh_membro_ativo(grupo_id));
create policy "admin edita membros"
  on grupo_membros for update using (eh_admin(grupo_id));

-- FERIADOS
create policy "membros leem feriados" on feriados for select using (eh_membro_ativo(grupo_id));
create policy "admin gerencia feriados" on feriados for insert with check (eh_admin(grupo_id));
create policy "admin atualiza feriados" on feriados for update using (eh_admin(grupo_id));
create policy "admin exclui feriados" on feriados for delete using (eh_admin(grupo_id));

-- RESERVAS
create policy "membros leem reservas" on reservas for select using (eh_membro_ativo(grupo_id));
create policy "membros criam reservas" on reservas for insert with check (eh_membro_ativo(grupo_id));
create policy "dono ou gestor cancela reserva" on reservas for update using (
  eh_membro_ativo(grupo_id) and (
    membro_id in (select id from grupo_membros where user_id = auth.uid())
    or eh_gestor_ou_admin(grupo_id)
  )
);

-- RECORRENTES
create policy "membros leem recorrentes" on recorrentes for select using (eh_membro_ativo(grupo_id));
create policy "admin gerencia recorrentes" on recorrentes for insert with check (eh_admin(grupo_id));
create policy "admin atualiza recorrentes" on recorrentes for update using (eh_admin(grupo_id));

-- RECORRENTES_HISTORICO (leitura para todos do grupo; escrita só via função)
create policy "membros leem historico de valores" on recorrentes_historico for select using (
  exists (select 1 from recorrentes r where r.id = recorrente_id and eh_membro_ativo(r.grupo_id))
);
create policy "gestor registra historico de valores" on recorrentes_historico for insert with check (
  exists (select 1 from recorrentes r where r.id = recorrente_id and eh_admin(r.grupo_id))
);

-- LANÇAMENTOS
create policy "membros leem lancamentos" on lancamentos for select using (eh_membro_ativo(grupo_id));
create policy "gestor lanca despesas/receitas" on lancamentos for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "gestor edita lancamentos" on lancamentos for update using (eh_gestor_ou_admin(grupo_id));
create policy "gestor exclui lancamentos" on lancamentos for delete using (eh_gestor_ou_admin(grupo_id));

-- CONFIRMAÇÕES DE PAGAMENTO
create policy "membros leem confirmacoes" on confirmacoes_pagamento for select using (
  exists (select 1 from recorrentes r where r.id = recorrente_id and eh_membro_ativo(r.grupo_id))
);
create policy "cotista confirma o proprio pagamento" on confirmacoes_pagamento for update using (
  membro_id in (select id from grupo_membros where user_id = auth.uid())
  or exists (select 1 from recorrentes r where r.id = recorrente_id and eh_gestor_ou_admin(r.grupo_id))
);
create policy "sistema cria confirmacoes" on confirmacoes_pagamento for insert with check (
  exists (select 1 from recorrentes r where r.id = recorrente_id and eh_membro_ativo(r.grupo_id))
);

-- CUSTO DE COMBUSTÍVEL
create policy "membros leem custo combustivel" on historico_custo_combustivel for select using (eh_membro_ativo(grupo_id));
create policy "gestor gerencia custo combustivel" on historico_custo_combustivel for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "gestor atualiza custo combustivel" on historico_custo_combustivel for update using (eh_gestor_ou_admin(grupo_id));

-- DIÁRIO DE BORDO
create policy "membros leem diario" on diario_bordo for select using (eh_membro_ativo(grupo_id));
create policy "membros criam registro no diario" on diario_bordo for insert with check (eh_membro_ativo(grupo_id));
create policy "autor ou gestor edita registro" on diario_bordo for update using (
  autor_id in (select id from grupo_membros where user_id = auth.uid())
  or eh_gestor_ou_admin(grupo_id)
);
create policy "gestor exclui registro do diario" on diario_bordo for delete using (eh_gestor_ou_admin(grupo_id));

-- MANUTENÇÕES
create policy "membros leem manutencoes" on manutencoes for select using (eh_membro_ativo(grupo_id));
create policy "gestor gerencia manutencoes" on manutencoes for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "gestor atualiza manutencoes" on manutencoes for update using (eh_gestor_ou_admin(grupo_id));
create policy "gestor exclui manutencoes" on manutencoes for delete using (eh_gestor_ou_admin(grupo_id));

-- RATEIO DE MANUTENÇÃO
create policy "membros leem rateio" on rateio_manutencao for select using (
  exists (select 1 from manutencoes m where m.id = manutencao_id and eh_membro_ativo(m.grupo_id))
);
create policy "sistema/gestor cria rateio" on rateio_manutencao for insert with check (
  exists (select 1 from manutencoes m where m.id = manutencao_id and eh_gestor_ou_admin(m.grupo_id))
);
create policy "cotista confirma o proprio rateio" on rateio_manutencao for update using (
  membro_id in (select id from grupo_membros where user_id = auth.uid())
  or exists (select 1 from manutencoes m where m.id = manutencao_id and eh_gestor_ou_admin(m.grupo_id))
);

-- SEGURO
create policy "membros leem seguro" on seguros for select using (eh_membro_ativo(grupo_id));
create policy "gestor gerencia seguro" on seguros for insert with check (eh_gestor_ou_admin(grupo_id));
create policy "admin exclui seguro" on seguros for delete using (eh_admin(grupo_id));

-- INFORMAÇÕES ÚTEIS
create policy "membros leem informacoes" on informacoes_uteis for select using (eh_membro_ativo(grupo_id));
create policy "membros criam informacoes" on informacoes_uteis for insert with check (eh_membro_ativo(grupo_id));
create policy "admin exclui informacoes" on informacoes_uteis for delete using (eh_admin(grupo_id));

-- ════════════════════════════════════════════════════════════
-- Fim do schema inicial.
-- ════════════════════════════════════════════════════════════
