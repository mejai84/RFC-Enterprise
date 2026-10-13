-- La reposicion deja de heredar los 240 dias de la tabla oficial.
--
-- La tabla del cliente esta construida sobre 240 dias, asi que ese numero
-- se quedo como valor por defecto de la reposicion de los 2.699 registros
-- de la matriz. Es un supuesto que no venia del documento: la reposicion
-- real depende de la vida util de cada concepto y de la obra, que puede
-- durar mas o menos de 240 dias.
--
-- Con cero, ninguna reposicion esta calculada. Es el estado honesto: el
-- valor se define concepto por concepto y no se hereda de la tabla.

alter table public.labor_role_dotacion
  alter column replacement_days drop not null;

/* La restriccion exigia un dia minimo, lo que impedia dejar el valor en
   cero. Cero es el estado legitimo: la reposicion aun no se ha definido. */
alter table public.labor_role_dotacion
  drop constraint if exists labor_role_dotacion_replacement_days_check;

alter table public.labor_role_dotacion
  add constraint labor_role_dotacion_replacement_days_check
  check (replacement_days is null or replacement_days >= 0);

comment on column public.labor_role_dotacion.replacement_days is
  'Cada cuantos dias se repone este concepto. Cero o sin valor significa que la cantidad se aplica una sola vez: todavia no se ha definido la reposicion de este concepto.';

/* Los 240 dias quedan como nota, no como valor: se deja registrado de
   donde venia antes de ponerlo en cero. */
update public.labor_role_dotacion
   set notes = trim(both ' ' from coalesce(nullif(notes, '') || ' ', '') ||
       'La reposicion venia heredada de 240 dias y se dejo en cero, pendiente de definir.')
 where replacement_days = 240;

update public.labor_role_dotacion
   set replacement_days = 0
 where replacement_days = 240;

/*
 * Total de la dotacion de un cargo:
 *
 *   - Con reposicion definida: la cantidad por reposicion se repite las
 *     veces que caben en el ano de referencia. Un casco con reposicion de
 *     1.095 dias no se repone dentro del ano, y eso es lo correcto.
 *   - Sin reposicion o en cero: la cantidad se aplica una sola vez.
 *
 * El ano de referencia sigue siendo el de la tabla del cliente, porque el
 * costo real que consume el APU es un promedio por dia. Lo que cambia es
 * que ya no se supone que todo se repone cada 240 dias.
 */
create or replace function private.recompute_role_dotacion()
returns void language sql as $$
  with calculo as (
    select m.labor_rate_role_id,
           sum(
             case
               when m.replacement_days is null or m.replacement_days <= 0
                 then m.quantity * coalesce(m.unit_value_override, c.default_unit_value)
               else m.quantity
                    * (240.0 / m.replacement_days)
                    * coalesce(m.unit_value_override, c.default_unit_value)
             end
           ) as total
      from public.labor_role_dotacion m
      join public.labor_dotacion_concepts c on c.id = m.concept_id
     group by m.labor_rate_role_id
  )
  update public.labor_rate_roles r
     set dotacion_total = t.total,
         dotacion_daily = round(t.total / 240.0, 2),
         updated_at = now()
    from calculo t
   where r.id = t.labor_rate_role_id;
$$;

select private.recompute_role_dotacion();
select private.recompute_role_computed_cost();