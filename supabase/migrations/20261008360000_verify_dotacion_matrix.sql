-- Verifica que la matriz deja que un cargo difiera de su nivel sin tocar
-- los demas, y que la vista de desviacion lo detecta.

select 'ANTES' as momento, r.code, r.name, r.dotacion_total, r.computed_daily_cost
  from public.labor_rate_roles r
 where r.code in ('PROP-CIV-N4-ANDAM', 'PROP-SERV-N4-ALM')
 order by r.code;

-- Al andamiero se le quita el casco de obra: trabaja con capuchon en andamio.
update public.labor_role_dotacion m
   set quantity = 0,
       inherited_from_level = false,
       notes = 'No usa casco de obra; trabaja con capuchon en andamio.'
  from public.labor_rate_roles r, public.labor_dotacion_concepts c
 where m.labor_rate_role_id = r.id
   and m.concept_id = c.id
   and r.code = 'PROP-CIV-N4-ANDAM'
   and lower(c.name) like 'casco%';

update public.labor_rate_roles r
   set dotacion_total = coalesce((
         select sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value))
           from public.labor_role_dotacion m
           join public.labor_dotacion_concepts c on c.id = m.concept_id
          where m.labor_rate_role_id = r.id), 0),
       dotacion_daily = round(coalesce((
         select sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value))
           from public.labor_role_dotacion m
           join public.labor_dotacion_concepts c on c.id = m.concept_id
          where m.labor_rate_role_id = r.id), 0) / 240.0, 2)
 where r.code in ('PROP-CIV-N4-ANDAM', 'PROP-SERV-N4-ALM');

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
         + r.dotacion_daily
         - (
             (e.daily_basic_salary + e.transport_allowance)
             + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
                + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
           ) * 0.08
       , 2)
  from public.labor_rate_entries e
 where r.code in ('PROP-CIV-N4-ANDAM', 'PROP-SERV-N4-ALM')
   and e.id = r.labor_rate_entry_id;

select 'DESPUES' as momento, r.code, r.name, r.dotacion_total, r.computed_daily_cost,
       (select count(*) from public.labor_role_dotacion m
         where m.labor_rate_role_id = r.id and m.inherited_from_level = false) as filas_corregidas
  from public.labor_rate_roles r
 where r.code in ('PROP-CIV-N4-ANDAM', 'PROP-SERV-N4-ALM')
 order by r.code;

select 'DESVIACIONES' as momento, * from public.v_labor_dotacion_desviacion;

-- Se restaura la plantilla.
update public.labor_role_dotacion m
   set quantity = i.quantity, inherited_from_level = true, notes = ''
  from public.labor_rate_roles r,
       public.labor_dotacion_concepts c,
       public.labor_dotacion_items i
 where m.labor_rate_role_id = r.id
   and m.concept_id = c.id
   and r.code = 'PROP-CIV-N4-ANDAM'
   and lower(c.name) like 'casco%'
   and i.labor_rate_table_id = r.labor_rate_table_id
   and i.profile = 4
   and lower(i.concept) = lower(c.source_name);

update public.labor_rate_roles r
   set dotacion_total = coalesce((
         select sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value))
           from public.labor_role_dotacion m
           join public.labor_dotacion_concepts c on c.id = m.concept_id
          where m.labor_rate_role_id = r.id), 0),
       dotacion_daily = round(coalesce((
         select sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value))
           from public.labor_role_dotacion m
           join public.labor_dotacion_concepts c on c.id = m.concept_id
          where m.labor_rate_role_id = r.id), 0) / 240.0, 2)
 where r.code in ('PROP-CIV-N4-ANDAM');

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
         + r.dotacion_daily
         - (
             (e.daily_basic_salary + e.transport_allowance)
             + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
                + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
           ) * 0.08
       , 2)
  from public.labor_rate_entries e
 where r.code in ('PROP-CIV-N4-ANDAM')
   and e.id = r.labor_rate_entry_id;

select 'RESTAURADO' as momento, r.code, r.name, r.dotacion_total, r.computed_daily_cost
  from public.labor_rate_roles r
 where r.code in ('PROP-CIV-N4-ANDAM', 'PROP-SERV-N4-ALM')
 order by r.code;