-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0021 — Vínculo bidirecional de convite ↔ conta
--
-- Bug corrigido: o gatilho `ao_criar_conta_vincular_convite` (auth.users
-- INSERT, ver 0002) só vincula um convite se a CONTA for criada DEPOIS
-- do convite. Se a pessoa já tinha se cadastrado sozinha (ou por
-- qualquer outro motivo já existia auth.users) ANTES do admin criar o
-- registro de convite em grupo_membros, o vínculo nunca acontecia -- ela
-- ficava presa na tela "Aguardando convite" para sempre, mesmo logando
-- normalmente. Foi exatamente o que aconteceu com um cotista real do
-- sistema (registro corrigido manualmente ao aplicar esta migração).
--
-- Esta migração cobre a direção que faltava: ao inserir um novo convite
-- em grupo_membros, procura na hora se já existe uma conta com aquele
-- e-mail e vincula imediatamente. Com as duas migrações (0002 e esta),
-- a ordem entre "criar convite" e "criar conta" deixa de importar.
-- ════════════════════════════════════════════════════════════

create or replace function vincular_membro_a_conta_existente() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select id into new.user_id
      from auth.users
     where lower(email) = lower(new.email)
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists ao_convidar_vincular_conta_existente on grupo_membros;
create trigger ao_convidar_vincular_conta_existente
  before insert on grupo_membros
  for each row execute function vincular_membro_a_conta_existente();

-- Corrige retroativamente quem já ficou preso por causa desse bug.
update grupo_membros gm
   set user_id = au.id
  from auth.users au
 where gm.user_id is null
   and lower(gm.email) = lower(au.email);
