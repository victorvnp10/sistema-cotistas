-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0008 — Apenas o usuário master pode criar novos grupos
-- Cole no SQL Editor do Supabase e clique em "Run".
--
-- Antes: qualquer pessoa que criasse uma conta e não tivesse grupo caía
-- numa tela onde podia criar seu próprio grupo (self-service).
--
-- Agora: só o e-mail master pode criar um grupo -- e ele cria já
-- indicando quem vai ser o Admin daquele grupo (o novo gestor/cliente),
-- que recebe um convite (like já funciona para cotistas) em vez do
-- próprio master virar admin de todo grupo que criar.
-- ════════════════════════════════════════════════════════════

drop function if exists criar_grupo(text, text, int, text);

create or replace function criar_grupo(
  p_nome text, p_nome_recurso text, p_dia_virada int,
  p_admin_nome text, p_admin_email text
) returns grupos
language plpgsql security definer
set search_path = public
as $$
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
$$;
