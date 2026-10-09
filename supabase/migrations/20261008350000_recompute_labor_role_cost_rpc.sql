-- Recalcular la dotacion y el costo real de un cargo.
--
-- La matriz necesita poder recalcular al guardar una fila. Se expone una
-- sola funcion con las mismas reglas de escritura que el resto de tablas
-- salariales y con search_path fijo.
--
-- El total de la dotacion va en subconsultas escalares y no en un LATERAL:
-- Postgres no deja que un LATERAL de un UPDATE referencie la tabla que se
-- esta actualizando.

create or replace function public.recompute_labor_role_cost(p_role_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (
    select 1 from public.labor_rate_roles r
     where r.id = p_role_id
       and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.company_id = r.company_id)
  ) then
    raise exception 'El cargo no existe o no pertenece a la empresa';
  end if;

  select coalesce(sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value)), 0)
    into v_total
    from public.labor_role_dotacion m
    join public.labor_dotacion_concepts c on c.id = m.concept_id
   where m.labor_rate_role_id = p_role_id;

  update public.labor_rate_roles r
     set dotacion_total = v_total,
         dotacion_daily = round(v_total / 240.0, 2)
   where r.id = p_role_id;

  update public.labor_rate_roles r
     set computed_daily_cost = round(
           (e.daily_basic_salary + e.transport_allowance)
           + (e.daily_basic_salary + e.transport_allowance) * (
               0.0834 + (0.0834 * 12) / 360 + 0.0834 + 0.0417 + 0.0696
             + 0.03 + 0.02 + 0.04 + 0.125 + 0.16
            )
           + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
              + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
           + e.food_allowance
           + e.non_salary_allowance
           + round(v_total / 240.0, 2)
           - (
               (e.daily_basic_salary + e.transport_allowance)
               + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
                  + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
             ) * 0.08
         , 2),
         updated_at = now()
    from public.labor_rate_entries e
   where r.id = p_role_id
     and e.id = r.labor_rate_entry_id;
end;
$$;

revoke all on function public.recompute_labor_role_cost(uuid) from public, anon;
grant execute on function public.recompute_labor_role_cost(uuid) to authenticated;

comment on function public.recompute_labor_role_cost(uuid) is
  'Recalcula la dotacion y el costo real de un cargo despues de editar su matriz. Devuelve error si el cargo no es de la empresa del usuario.';
