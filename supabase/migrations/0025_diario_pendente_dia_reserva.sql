-- Inclui reservas de HOJE como pendentes (antes só mostrava reservas já passadas)
-- Isso permite que o cotista veja na Dashboard um alerta no dia da reserva

CREATE OR REPLACE FUNCTION public.relatorios_pendentes_membro(p_membro_id uuid)
 RETURNS TABLE(reserva_id uuid, data date, periodo text)
 LANGUAGE sql
 STABLE
AS $function$
  select r.id, r.data, r.periodo
  from reservas r
  where r.membro_id = p_membro_id
    and r.status <> 'cancelado'
    and r.data <= current_date
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
  join reservas r on r.membro_id = gm.id and r.status <> 'cancelado' and r.data <= current_date
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
