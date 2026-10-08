-- The extra-hours figure belongs to a month, not to a day.
--
-- The previous migration summed the whole month's overtime into the
-- per-day cost, which produced a figure ten times too high: a Nivel 6
-- worker showed 3.4 million per day. The official sheet spreads those
-- monthly amounts over the table's 240 days.
--
-- same calculation, corrected:

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
        + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0 + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
        + e.food_allowance
        + e.non_salary_allowance
        - (
            (e.daily_basic_salary + e.transport_allowance)
            + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0 + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
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