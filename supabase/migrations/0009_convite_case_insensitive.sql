-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0009 — Convite por e-mail sem diferenciar maiúsculas/minúsculas
--
-- O arquivo que existia antes com este nome, na raiz do repositório,
-- estava corrompido (continha o código de um componente React em vez de
-- SQL) e nunca chegou a ser versionado corretamente -- esta migração
-- reconstrói o que já estava aplicado em produção.
--
-- Sem isso, um convite cadastrado como "Fulano@Gmail.com" nunca vinculava
-- à conta se a pessoa se cadastrasse como "fulano@gmail.com" (ou
-- vice-versa), já que a comparação de e-mail no Postgres é sensível a
-- maiúsculas/minúsculas por padrão.
-- ════════════════════════════════════════════════════════════

create or replace function vincular_convite_pendente() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.grupo_membros
     set user_id = new.id
   where lower(email) = lower(new.email)
     and user_id is null;
  return new;
end;
$$;
