-- El catalogo quedo con 50 conceptos donde deberian ser 25.
--
-- La unicidad estaba puesta sobre (company_id, name) y Postgres compara
-- textos distinguiendo mayusculas, asi que al sembrar los nombres
-- legibles quedaron conviviendo con los nombres abrviados anteriores:
-- "Overol infiugo" y "overol infiugo" son filas distintas. Como el
-- emparejamiento de la matriz es por nombre del documento, cada concepto
-- emparejaba con dos filas y la dotacion de cada cargo salia duplicada.
--
-- La unicidad correcta es sobre el nombre del documento normalizado, que
-- es la clave con la que se empareja la matriz. Primero se quitan las
-- filas repetidas y despues se crea el indice unico, porque un indice
-- sobre expresion falla si todavia hay duplicados.

alter table public.labor_dotacion_concepts
  drop constraint if exists labor_dotacion_concepts_company_id_name_key;

/* Se conserva la fila cuyo nombre es el legible, es decir el que no esta
   todo en minusculas. La otra es la variante abreviada del documento. */
delete from public.labor_dotacion_concepts a
  using public.labor_dotacion_concepts b
 where a.company_id = b.company_id
   and lower(a.source_name) = lower(b.source_name)
   and a.id <> b.id
   and a.name = lower(a.name)
   and b.name <> lower(b.name);

/* Por si quedara mas de una con el mismo nombre normalizado, se deja solo
   la mas reciente. */
delete from public.labor_dotacion_concepts a
  using public.labor_dotacion_concepts b
 where a.company_id = b.company_id
   and lower(a.source_name) = lower(b.source_name)
   and a.id <> b.id
   and a.created_at < b.created_at;

create unique index if not exists labor_dotacion_concepts_source_name_key
  on public.labor_dotacion_concepts (company_id, lower(source_name));

/* La matriz se rehace: algunas filas apuntaban a conceptos que se fueron. */
delete from public.labor_role_dotacion;

insert into public.labor_role_dotacion
  (company_id, labor_rate_role_id, concept_id, quantity, unit_value_override, inherited_from_level)
select r.company_id,
       r.id,
       cat.id,
       i.quantity,
       null,
       true
  from public.labor_rate_roles r
  join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
  join public.labor_dotacion_items i
    on i.labor_rate_table_id = e.labor_rate_table_id
   and i.profile = e.level
  join public.labor_dotacion_concepts cat
    on cat.company_id = r.company_id
   and lower(cat.source_name) = lower(i.concept)
where r.is_active
on conflict (labor_rate_role_id, concept_id) do nothing;

select private.recompute_role_dotacion();
select private.recompute_role_computed_cost();