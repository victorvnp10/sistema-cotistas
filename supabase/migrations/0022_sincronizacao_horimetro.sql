-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0022 — Sincronização robusta do horímetro
--
-- Problema: ultimo_horimetro() somava TODOS os ajustes de troca de
-- aparelho já registrados, para sempre. Isso é frágil -- qualquer ajuste
-- duplicado (ou um segundo ajuste feito pra "corrigir" o primeiro) fica
-- somado permanentemente, e o valor nunca mais bate com o aparelho físico
-- instalado na lancha (foi o que causou o horímetro mostrar 188.2h em vez
-- de 6.6h).
--
-- Correção: em vez de somar deltas, o horímetro atual passa a ser
-- simplesmente "a leitura mais recente conhecida" -- seja do último
-- lançamento do diário, seja de uma troca/ajuste registrado depois dele.
-- Não há mais soma cumulativa, então não há mais como duplicar o erro.
-- O histórico de trocas continua guardado (leitura antes + leitura do
-- aparelho novo), só que agora é só um registro informativo, não entra
-- em nenhuma conta.
-- ════════════════════════════════════════════════════════════

alter table ajustes_horimetro
  add column if not exists leitura_anterior numeric,
  add column if not exists leitura_novo_aparelho numeric;

-- Backfill (não deveria haver linhas hoje, mas por segurança): deriva os
-- dois valores novos a partir do delta antigo, assumindo aparelho novo
-- começando em 0.
update ajustes_horimetro
   set leitura_anterior = coalesce(leitura_anterior, delta),
       leitura_novo_aparelho = coalesce(leitura_novo_aparelho, 0)
 where leitura_anterior is null or leitura_novo_aparelho is null;

alter table ajustes_horimetro
  alter column leitura_anterior set not null,
  alter column leitura_novo_aparelho set not null,
  alter column leitura_novo_aparelho set default 0;

-- ── Leitura mais recente conhecida do horímetro (ou null se não há registro) ──
create or replace function ultima_leitura_horimetro(p_grupo_id uuid) returns numeric
language sql stable as $$
  select t.valor from (
    select horimetro_fim as valor, criado_em from diario_bordo
      where grupo_id = p_grupo_id and horimetro_fim > 0
    union all
    select leitura_novo_aparelho as valor, criado_em from ajustes_horimetro
      where grupo_id = p_grupo_id
  ) t
  order by t.criado_em desc
  limit 1;
$$;

-- ── Horímetro atual do grupo (0 se ainda não há nenhum registro) ──
create or replace function ultimo_horimetro(p_grupo_id uuid) returns numeric
language sql stable as $$
  select coalesce(ultima_leitura_horimetro(p_grupo_id), 0);
$$;

-- ── Criar registro no Diário de Bordo (usa a mesma leitura sincronizada) ──
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
$$;

-- ── Registrar troca de aparelho / ajuste de sincronização ──
-- p_horas_reais_ate_troca: leitura real antes da troca (guardada só pro
-- histórico). p_leitura_aparelho_novo: leitura inicial do aparelho
-- instalado agora (0 se novo, qualquer valor se usado) -- essa é a que
-- vira a nova referência de "horímetro atual".
create or replace function registrar_troca_horimetro(
  p_grupo_id uuid,
  p_horas_reais_ate_troca numeric,
  p_leitura_aparelho_novo numeric,
  p_motivo text default null,
  p_data date default current_date
) returns ajustes_horimetro
language plpgsql as $$
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
$$;
