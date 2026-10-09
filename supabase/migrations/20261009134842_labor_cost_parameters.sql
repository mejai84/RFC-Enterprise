-- Parametros nacionales configurables para el calculo comercial de mano de obra.
-- No representan nomina ni liquidacion laboral. Las cotizaciones guardan una
-- copia de los parametros usados para que su historico no cambie.

create table public.labor_cost_parameters (
  code text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  rate numeric(10,8) not null check (rate between 0 and 1),
  calculation_base text not null check (calculation_base in ('salario_transporte', 'cesantias', 'salario_transporte_mas_extras')),
  operation text not null check (operation in ('sumar', 'restar')),
  check (operation = 'restar' or calculation_base <> 'salario_transporte_mas_extras'),
  divisor numeric(12,2) not null default 1 check (divisor > 0),
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.labor_cost_parameters is
  'Parametros nacionales editables del costo laboral usado por APU y cotizaciones. Cada fila puede agregarse, desactivarse o modificarse sin tocar codigo.';

alter table public.labor_cost_parameters enable row level security;

create policy labor_cost_parameters_member_read on public.labor_cost_parameters
  for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid())));

create policy labor_cost_parameters_manager_write on public.labor_cost_parameters
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ))
  with check (exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ));

grant select, insert, update, delete on public.labor_cost_parameters to authenticated;

create trigger labor_cost_parameters_updated
  before update on public.labor_cost_parameters
  for each row execute function private.set_updated_at();

insert into public.labor_cost_parameters
  (code, label, rate, calculation_base, operation, divisor, description, sort_order)
values
  ('cesantias', 'Cesantias', 0.0834, 'salario_transporte', 'sumar', 1, 'Provision sobre salario y auxilio de transporte.', 10),
  ('interes_cesantias', 'Interes de cesantias', 0.12, 'cesantias', 'sumar', 360, 'Tasa anual dividida entre 360 dias.', 20),
  ('prima', 'Prima de servicios', 0.0834, 'salario_transporte', 'sumar', 1, 'Provision sobre salario y auxilio de transporte.', 30),
  ('vacaciones', 'Vacaciones', 0.0417, 'salario_transporte', 'sumar', 1, 'Provision sobre salario y auxilio de transporte.', 40),
  ('arl', 'ARL / riesgo laboral', 0.0696, 'salario_transporte', 'sumar', 1, 'Ajuste segun la clase de riesgo aplicable.', 50),
  ('icbf', 'ICBF', 0.03, 'salario_transporte', 'sumar', 1, 'Aporte parafiscal.', 60),
  ('sena', 'SENA', 0.02, 'salario_transporte', 'sumar', 1, 'Aporte parafiscal.', 70),
  ('caja_compensacion', 'Caja de compensacion', 0.04, 'salario_transporte', 'sumar', 1, 'Aporte parafiscal.', 80),
  ('eps', 'EPS', 0.125, 'salario_transporte', 'sumar', 1, 'Aporte a salud usado en el modelo comercial.', 90),
  ('pension', 'Pension', 0.16, 'salario_transporte', 'sumar', 1, 'Aporte a pension usado en el modelo comercial.', 100),
  ('salud_pension_descuento', 'Descuento salud y pension', 0.08, 'salario_transporte_mas_extras', 'restar', 1, 'Descuento reproducido desde la hoja de calculo comercial.', 110)
on conflict (code) do nothing;

create or replace function private.recompute_labor_computed_cost()
returns void
language sql
set search_path = public, private, pg_temp
as $$
  with parametros as (
    select
      coalesce(sum(rate / divisor) filter (where operation = 'sumar' and calculation_base = 'salario_transporte'), 0) as tasa_base_suma,
      coalesce(sum(rate / divisor) filter (where operation = 'restar' and calculation_base = 'salario_transporte'), 0) as tasa_base_resta,
      coalesce(sum(rate / divisor) filter (where operation = 'sumar' and calculation_base = 'cesantias'), 0) as tasa_cesantias_suma,
      coalesce(sum(rate / divisor) filter (where operation = 'restar' and calculation_base = 'cesantias'), 0) as tasa_cesantias_resta,
      coalesce(sum(rate / divisor) filter (where operation = 'restar' and calculation_base = 'salario_transporte_mas_extras'), 0) as tasa_base_extras_resta
    from public.labor_cost_parameters
    where is_active
  ),
  calculo as (
    select
      e.id,
      e.daily_basic_salary + e.transport_allowance as base_laboral,
      ((e.daily_basic_salary / 7.0) * 1.25 * 56.0 + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0 as extras,
      p.tasa_base_suma,
      p.tasa_base_resta,
      p.tasa_cesantias_suma,
      p.tasa_cesantias_resta,
      p.tasa_base_extras_resta,
      (e.daily_basic_salary + e.transport_allowance) * (
        p.tasa_base_suma + p.tasa_cesantias_suma * coalesce((select rate / divisor from public.labor_cost_parameters where code = 'cesantias' and is_active), 0)
      ) as provision,
      (e.daily_basic_salary + e.transport_allowance) * (
        p.tasa_base_resta + p.tasa_cesantias_resta * coalesce((select rate / divisor from public.labor_cost_parameters where code = 'cesantias' and is_active), 0)
      ) + ((e.daily_basic_salary + e.transport_allowance) + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0 + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0) * p.tasa_base_extras_resta as descuentos
    from public.labor_rate_entries e
    cross join parametros p
  )
  update public.labor_rate_entries e
     set provision_daily = round(c.provision, 2),
         extra_hours_daily = round(c.extras, 2),
         computed_daily_cost = round(
           c.base_laboral + c.provision + c.extras + e.food_allowance + e.non_salary_allowance
           - c.descuentos,
           2
         ),
         updated_at = now()
    from calculo c
   where e.id = c.id;
$$;

create or replace function private.recompute_labor_role_computed_cost()
returns void
language sql
set search_path = public, private, pg_temp
as $$
  with parametros as (
    select
      coalesce(sum(rate / divisor) filter (where operation = 'sumar' and calculation_base = 'salario_transporte'), 0) as tasa_base_suma,
      coalesce(sum(rate / divisor) filter (where operation = 'restar' and calculation_base = 'salario_transporte'), 0) as tasa_base_resta,
      coalesce(sum(rate / divisor) filter (where operation = 'sumar' and calculation_base = 'cesantias'), 0) as tasa_cesantias_suma,
      coalesce(sum(rate / divisor) filter (where operation = 'restar' and calculation_base = 'cesantias'), 0) as tasa_cesantias_resta,
      coalesce(sum(rate / divisor) filter (where operation = 'restar' and calculation_base = 'salario_transporte_mas_extras'), 0) as tasa_base_extras_resta
    from public.labor_cost_parameters
    where is_active
  ),
  calculo as (
    select
      r.id,
      e.daily_basic_salary + e.transport_allowance as base_laboral,
      ((e.daily_basic_salary / 7.0) * 1.25 * 56.0 + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0 as extras,
      p.tasa_base_suma,
      p.tasa_base_resta,
      p.tasa_cesantias_suma,
      p.tasa_cesantias_resta,
      p.tasa_base_extras_resta,
      (e.daily_basic_salary + e.transport_allowance) * (
        p.tasa_base_suma + p.tasa_cesantias_suma * coalesce((select rate / divisor from public.labor_cost_parameters where code = 'cesantias' and is_active), 0)
      ) as provision,
      (e.daily_basic_salary + e.transport_allowance) * (
        p.tasa_base_resta + p.tasa_cesantias_resta * coalesce((select rate / divisor from public.labor_cost_parameters where code = 'cesantias' and is_active), 0)
      ) + ((e.daily_basic_salary + e.transport_allowance) + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0 + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0) * p.tasa_base_extras_resta as descuentos,
      e.food_allowance,
      e.non_salary_allowance,
      coalesce(r.dotacion_daily, 0) as dotacion
    from public.labor_rate_roles r
    join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
    cross join parametros p
  )
  update public.labor_rate_roles r
     set computed_daily_cost = round(
       c.base_laboral + c.provision + c.extras + c.food_allowance + c.non_salary_allowance + c.dotacion
       - c.descuentos,
       2
     ),
     updated_at = now()
    from calculo c
   where r.id = c.id;
$$;

create or replace function private.recompute_labor_costs_after_parameter_change()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  perform private.recompute_labor_computed_cost();
  perform private.recompute_labor_role_computed_cost();
  return null;
end;
$$;

create trigger labor_cost_parameters_recompute
  after insert or update or delete on public.labor_cost_parameters
  for each statement execute function private.recompute_labor_costs_after_parameter_change();

create or replace function public.recompute_labor_role_cost(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (
    select 1 from public.labor_rate_roles r
    where r.id = p_role_id
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.company_id = r.company_id
      )
  ) then
    raise exception 'El cargo no existe o no pertenece a la empresa';
  end if;

  select coalesce(sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value)), 0)
    into v_total
    from public.labor_role_dotacion m
    join public.labor_dotacion_concepts c on c.id = m.concept_id
   where m.labor_rate_role_id = p_role_id;

  update public.labor_rate_roles
     set dotacion_total = v_total,
         dotacion_daily = round(v_total / 240.0, 2)
   where id = p_role_id;

  perform private.recompute_labor_role_computed_cost();
end;
$$;

revoke all on function public.recompute_labor_role_cost(uuid) from public, anon;
grant execute on function public.recompute_labor_role_cost(uuid) to authenticated;

select private.recompute_labor_computed_cost();
select private.recompute_labor_role_computed_cost();

