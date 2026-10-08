-- Separate the official salary table from the computed cost of labor.
--
-- The distinction matters and until now it was lost in a single column:
--
--   total_daily_rate  = what the client company actually pays for that
--                       position, straight from its official document.
--                       This column is never recalculated. It is the
--                       informative and contractual base.
--
--   computed_daily_cost = what RFC must charge to recover that worker:
--                       official base plus social provisions, extra hours,
--                       Sunday hours and the worker's own allowances.
--                       This is what the APU consumes.
--
-- `total_daily_rate` used to be overwritten with this calculation, which
-- silently changed the official figure and mixed both meanings in one
-- field. They are now separate and each has a single owner.

alter table public.labor_rate_entries
  add column if not exists computed_daily_cost numeric(14,2);

comment on column public.labor_rate_entries.total_daily_rate is
  'Valor dia oficial de la empresa, tomado de su documento. No se recalcula: es la base informativa y contractual.';
comment on column public.labor_rate_entries.provision_daily is
  'Provisiones diarias calculadas por RFC sobre el valor oficial: cesantias, interes, prima, vacaciones, riesgo, ICBF, SENA, caja, EPS y pension.';
comment on column public.labor_rate_entries.extra_hours_daily is
  'Horas extra diurnas, nocturnas y dominicales del mes, calculadas por RFC sobre el salario oficial.';
comment on column public.labor_rate_entries.computed_daily_cost is
  'Costo real de mano de obra que usa el APU: valor oficial mas provisiones, horas y allowances. Es lo que RFC debe cobrar por un dia de este cargo.';

/*
 * Calculation, following the client's own spreadsheet cell by cell:
 *
 *   base              = salario dia + auxilio de transporte
 *   provision         = base + cesantias + interes + prima + vacaciones
 *                       + riesgo + icbf + sena + caja + eps + pension
 *   hora ordinaria    = salario dia / 7     (the sheet divides by 7)
 *   extra diurna      = hora * 1.25 * 56
 *   dominical         = hora * 2.90 * 14
 *   sub total         = base + provision extras
 *                       + alimentacion + no salarial
 *   salud y pension   = 8% of (base + extras)
 *   computed cost     = sub total - salud y pension
 *
 * Hours and allowances are monthly figures spread over the table's
 * 240 days, which is why they arrive here already divided.
 */
create or replace function private.recompute_labor_computed_cost()
returns void language sql as $$
  with calculo as (
    select
      e.id,
      (
        (e.daily_basic_salary + e.transport_allowance)
        + (e.daily_basic_salary + e.transport_allowance) * (
             0.0834
           + 0.0834 * 12.0 / 360.0
           + 0.0834
           + 0.0417
           + 0.0696
           + 0.03
           + 0.02
           + 0.04
           + 0.125
           + 0.16
          )
        + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0)
        + ((e.daily_basic_salary / 7.0) * 2.90 * 14.0)
        + e.food_allowance
        + e.non_salary_allowance
        - (
            (e.daily_basic_salary + e.transport_allowance)
            + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0)
            + ((e.daily_basic_salary / 7.0) * 2.90 * 14.0)
          ) * 0.08
      ) as costo
    from public.labor_rate_entries e
  )
  update public.labor_rate_entries e
  set computed_daily_cost = round(c.costo, 2),
      updated_at = now()
  from calculo c
  where e.id = c.id;
$$;

select private.recompute_labor_computed_cost();

-- The obsolete function is replaced by the one above.
drop function if exists private.recompute_labor_daily_rate();

create index if not exists labor_rate_entries_computed_cost_idx
  on public.labor_rate_entries (labor_rate_table_id, sort_order, name)
  where computed_daily_cost is not null;