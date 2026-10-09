-- Completa los ultimos cargos de actividades no propias de OCENSA y
-- retira un duplicado.
--
-- Estos cinco no entraron en la entrega anterior porque su nombre coincide
-- con el de un cargo de actividades propias, y el filtro comparaba solo
-- por nombre sin mirar la escala. Son cargos distintos: viven en la
-- escala no propias con el salario de ese nivel.
--
-- Ademas quedo "Obrero Descontaminacion" dos veces en el Nivel 1, por dos
-- filas de la transcripcion con el mismo texto. Se deja una.

/* El duplicado: la fila mas antigua se apaga y conserva su historia. */
with duplicados as (
  select r.id,
         row_number() over (
           partition by r.labor_rate_entry_id, lower(regexp_replace(r.name, '[^a-z0-9 ]', '', 'g'))
           order by r.created_at
         ) as n
    from public.labor_rate_roles r
    join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
    join public.labor_rate_tables t on t.id = r.labor_rate_table_id
   where t.name = 'OCENSA - tabla salarial 2026-2027'
     and r.is_active
     and r.scale = 'no_propias'
     and e.level = 1
)
update public.labor_rate_roles r
   set is_active = false,
       summary = 'Registro duplicado del mismo cargo. Se conserva el primero.'
  from duplicados d
 where r.id = d.id and d.n > 1;

/* Los cinco que faltan. */
with faltantes (name, level, specialty, specialty_label, code, summary) as (
  values
    ('Conductor', 2, 'servicios_apoyo', 'Servicios de apoyo', 'NOPROP-CON-N2-N01',
     'Cargo oficial de la tabla AEX-INS-006 v26, escala de actividades no propias.'),
    ('Rescatista de Alturas', 2, 'obra_civil', 'Obra civil', 'NOPROP-RES-N2-N02',
     'Cargo oficial de la tabla AEX-INS-006 v26, escala de actividades no propias.'),
    ('Ayudante Soldadura', 4, 'soldadura', 'Soldadura', 'NOPROP-AYS-N4-N01',
     'Cargo oficial de la tabla AEX-INS-006 v26, escala de actividades no propias.'),
    ('Instrumentista', 4, 'electricidad_e_instrumentacion', 'Electricidad e instrumentación', 'NOPROP-INS-N4-N01',
     'Cargo oficial de la tabla AEX-INS-006 v26, escala de actividades no propias.'),
    ('Oficial de Obra Civil', 4, 'obra_civil', 'Obra civil', 'NOPROP-OFI-N4-N01',
     'Cargo oficial de la tabla AEX-INS-006 v26, escala de actividades no propias.')
)
insert into public.labor_rate_roles
  (company_id, labor_rate_table_id, labor_rate_entry_id, code, name, specialty, specialty_label,
   scale, summary, receives_hotel, receives_operational_transport, is_active)
select t.company_id, t.id, e.id, v.code, v.name, v.specialty, v.specialty_label,
       'no_propias', v.summary, false, false, true
  from faltantes v
  join public.labor_rate_tables t on t.name = 'OCENSA - tabla salarial 2026-2027'
  join public.labor_rate_entries e
    on e.labor_rate_table_id = t.id and e.scale = 'no_propias' and e.level = v.level
on conflict (labor_rate_table_id, code) do nothing;

/* Todos los cargos nuevos reciben la dotacion de su nivel. */
insert into public.labor_role_dotacion
  (company_id, labor_rate_role_id, concept_id, quantity, unit_value_override, inherited_from_level)
select r.company_id, r.id, cat.id, i.quantity, null, true
  from public.labor_rate_roles r
  join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
  join public.labor_dotacion_items i
    on i.labor_rate_table_id = e.labor_rate_table_id and i.profile = e.level
  join public.labor_dotacion_concepts cat
    on cat.company_id = r.company_id and lower(cat.source_name) = lower(i.concept)
  join public.labor_rate_tables t on t.id = r.labor_rate_table_id
 where t.name = 'OCENSA - tabla salarial 2026-2027'
   and r.is_active
   and r.created_at > now() - interval '10 minutes'
on conflict (labor_rate_role_id, concept_id) do nothing;

select private.recompute_role_dotacion();
select private.recompute_role_computed_cost();