-- Finish the OCENSA unification: move the roles into the unified table.
--
-- The previous migration moved the 11 salary entries but left 68 roles
-- behind in the two retired tables, so the quote form showed one OCENSA
-- table with no positions to pick from.
--
-- The cause was ordering: the roles were re-pointed to their matching
-- entry before those entries had been moved, so the match found nothing.
-- Since `labor_rate_entry_id` is a foreign key that survives the move,
-- the roles only need their table updated afterwards.

do $$
declare
  v_company uuid;
  v_nueva uuid;
begin
  select id into v_nueva
    from public.labor_rate_tables
   where name = 'OCENSA - tabla salarial 2026-2027'
   limit 1;

  if v_nueva is null then
    raise notice 'No existe la tabla unificada de OCENSA; no se hace nada.';
    return;
  end if;

  select company_id into v_company from public.labor_rate_tables where id = v_nueva;

  /* Un rol sigue vivo si su entrada quedo en la tabla unificada. */
  update public.labor_rate_roles r
     set labor_rate_table_id = v_nueva,
         scale = e.scale,
         updated_at = now()
    from public.labor_rate_entries e
   where r.labor_rate_entry_id = e.id
     and e.labor_rate_table_id = v_nueva
     and r.labor_rate_table_id is distinct from v_nueva;

  /* Un rol cuya entrada no llego no puede costing: se retira en vez de
     apuntar a un nivel inexistente. */
  update public.labor_rate_roles r
     set is_active = false,
         updated_at = now()
   where r.labor_rate_table_id = v_nueva
     and not exists (
       select 1 from public.labor_rate_entries e
        where e.id = r.labor_rate_entry_id
          and e.labor_rate_table_id = v_nueva
          and e.scale = r.scale
     );
end;
$$;