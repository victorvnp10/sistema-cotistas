-- ════════════════════════════════════════════════════════════
-- MIGRAÇÃO 0004 — Job diário de recorrentes (todos os grupos)
-- Cole no SQL Editor do Supabase e clique em "Run".
--
-- Isso substitui o gatilho diário do Google Apps Script: todo dia, no dia
-- de cobrança de cada recorrente ativo, lança automaticamente o
-- lançamento correspondente (se ainda não tiver sido lançado neste mês) e,
-- para receitas, cria as confirmações de pagamento pendentes de cada
-- cotista ativo.
--
-- SE O "create extension pg_cron" ABAIXO DER ERRO: vá em Database →
-- Extensions no menu lateral do Supabase, procure "pg_cron" e ative pelo
-- botão (switch). Depois volte aqui e rode o script de novo.
-- ════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

create or replace function processar_recorrentes_do_dia() returns void
language plpgsql security definer as $$
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
$$;

-- Agenda para rodar todo dia às 06:00 (horário do servidor, UTC)
select cron.schedule(
  'processar-recorrentes-diario',
  '0 6 * * *',
  $$select processar_recorrentes_do_dia();$$
);
