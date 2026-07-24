-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0007 — Criação atômica de grupo (corrige erro 403 no onboarding)
-- Cole no SQL Editor do Supabase e clique em "Run".
--
-- Por que precisamos disso: ao criar um grupo, o app pedia o registro de
-- volta (".select()") para saber o ID gerado. Mas a regra de leitura de
-- "grupos" exige que o usuário já seja membro ativo do grupo -- e nesse
-- exato instante ele ainda não é (isso só acontece no passo seguinte,
-- separado). O Postgres então recusa o "RETURNING" com o mesmo erro de
-- "violates row-level security policy", mesmo a gravação em si sendo
-- permitida. A correção: uma função no banco que cria o grupo E já
-- cadastra o criador como admin, tudo em uma única operação atômica,
-- sempre usando o próprio usuário logado (nunca um ID arbitrário vindo
-- do cliente).
-- ════════════════════════════════════════════════════════════

create or replace function criar_grupo(
  p_nome text, p_nome_recurso text, p_dia_virada int, p_nome_admin text
) returns grupos
language plpgsql security definer
set search_path = public
as $$
declare
  v_grupo grupos;
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'É necessário estar autenticado para criar um grupo';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  insert into grupos (nome, nome_recurso, dia_virada)
  values (p_nome, coalesce(nullif(p_nome_recurso, ''), 'Embarcação'), coalesce(p_dia_virada, 4))
  returning * into v_grupo;

  insert into grupo_membros (grupo_id, user_id, nome, email, role, cotas, ativo)
  values (v_grupo.id, v_user_id, p_nome_admin, coalesce(v_email, ''), 'admin', 1, true);

  return v_grupo;
end;
$$;
