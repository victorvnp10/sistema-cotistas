-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0002 — Convite de cotistas por e-mail
-- Cole no SQL Editor do Supabase (depois de já ter rodado a 0001) e clique
-- em "Run". Sem isso, o Admin não consegue convidar novos cotistas.
-- ════════════════════════════════════════════════════════════

-- Permite um registro de "convite pendente": o Admin cadastra o cotista
-- pelo e-mail antes de existir uma conta de login correspondente.
alter table grupo_membros alter column user_id drop not null;

-- Quando a pessoa convidada cria a própria conta (mesmo e-mail do convite),
-- este gatilho conecta automaticamente o login dela ao registro de cotista
-- que o Admin já tinha criado -- ela não precisa fazer mais nada.
create or replace function vincular_convite_pendente() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.grupo_membros
     set user_id = new.id
   where email = new.email
     and user_id is null;
  return new;
end;
$$;

drop trigger if exists ao_criar_conta_vincular_convite on auth.users;
create trigger ao_criar_conta_vincular_convite
  after insert on auth.users
  for each row execute function vincular_convite_pendente();
