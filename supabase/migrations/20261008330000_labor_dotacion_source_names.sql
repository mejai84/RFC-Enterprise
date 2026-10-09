-- Los nombres del documento del cliente estan abreviados y no coinciden
-- con los del catalogo: "overol inifugo" contra "overol infiugo",
-- "tapaoido desch" contra "tapa oidos desechable", "tapa oido tipo copa"
-- contra "tapa oidos tipo copa". El resultado era que tres conceptos no
-- entraban a la matriz y cada cargo quedaba 1.485.000 por debajo de la
-- dotacion de su nivel.
--
-- El concepto guarda las dos formas: la que ve el usuario y la que
-- aparece en el documento. El emparejamiento se hace por la segunda,
-- que es la del cliente, y no por coincidencias de texto.

alter table public.labor_dotacion_concepts
  add column if not exists source_name text not null default '';

comment on column public.labor_dotacion_concepts.source_name is
  'Nombre tal como aparece en el documento del cliente. Es con este nombre que se empareja la matriz.';

/* El nombre del documento es la fuente de verdad para el emparejamiento. */
update public.labor_dotacion_concepts set source_name = name where source_name = '';

insert into public.labor_dotacion_concepts (company_id, name, source_name, unit, default_unit_value, category)
select c.id, v.legible, v.documento, 'unidad', v.valor, v.categoria
from public.companies c cross join (values
  ('Overol infiugo',                 'overol inifugo',       400000, 'Uniformes de trabajo'),
  ('Camisa dril',                    'camisa dril',           55000, 'Uniformes de trabajo'),
  ('Pantalon dril',                  'pantalon dril',         55000, 'Uniformes de trabajo'),
  ('Casco con barbuquejo',           'casco con barbuquejo',  65000, 'Equipos de proteccion personal'),
  ('Capuchon',                       'capuchon',              15000, 'Equipos de proteccion personal'),
  ('Tapa oidos desechable',          'tapaoido desch',         1500, 'Equipos de proteccion personal'),
  ('Tapa oidos tipo copa',           'tapa oido tipo copa',   35000, 'Equipos de proteccion personal'),
  ('Gafas de seguridad',             'gafas de seguridad',    15000, 'Equipos de proteccion personal'),
  ('Careta 3M',                      'careta 3M',             75000, 'Equipos de proteccion respiratoria'),
  ('Filtros 3M',                     'filtros 3M',            75000, 'Equipos de proteccion respiratoria'),
  ('Tapa boca desechable 3M',        'tapa boca desechable 3M', 4000, 'Equipos de proteccion respiratoria'),
  ('Guante de vaqueta',              'guante de vaqueta',      7500, 'Equipos de proteccion personal'),
  ('Guante tipo soldador',           'guante tipo soldador',  45000, 'Equipos de proteccion personal'),
  ('Guante nitrilo',                 'guante nitrilo',        15000, 'Equipos de proteccion personal'),
  ('Guante de presicion',            'guante presicion',       6500, 'Equipos de proteccion personal'),
  ('Delantal de carnaza',            'delantal de carnaza',   38700, 'Ropa de proteccion'),
  ('Mangas de carnaza',              'mangas de carnaza',     38700, 'Ropa de proteccion'),
  ('Botas tipo soldador',            'botas tipo soldador',  280000, 'Calzado de seguridad'),
  ('Botas tipo obrero',              'botas tipo obrero',    138500, 'Calzado de seguridad'),
  ('Botas tipo ingeniero',           'botas tipo ingeniero',  325000, 'Calzado de seguridad'),
  ('Botas de caucho',                'botas de caucho',       85000, 'Calzado de seguridad'),
  ('Traje para invierno',            'traje para invierno',   70000, 'Ropa de proteccion'),
  ('Traje tiber',                    'traje tiber',           30000, 'Ropa de proteccion'),
  ('Chaleco',                        'Chaleco',               40000, 'Ropa de proteccion'),
  ('Rodilleras',                     'rodilleras',            35000, 'Equipos de proteccion personal')
) as v(legible, documento, valor, categoria)
on conflict (company_id, name) do update
  set source_name = excluded.source_name,
      default_unit_value = excluded.default_unit_value,
      category = excluded.category,
      updated_at = now();

/* La matriz se rehace desde cero: ahora el emparejamiento es por el
   nombre del documento y entra todo. */
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

/* La validacion: cada cargo debe sumar exactamente lo que suma su nivel.
   Si algo no cuadra, la vista lo delata sin tener que comparar a mano. */
create or replace view public.v_labor_dotacion_desviacion as
select r.id as role_id,
       r.code as role_code,
       r.name as role_name,
       e.level,
       e.dotacion_total as por_nivel,
       r.dotacion_total as por_cargo,
       r.dotacion_total - e.dotacion_total as diferencia
  from public.labor_rate_roles r
  join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
 where r.is_active
   and r.dotacion_total is distinct from e.dotacion_total;

comment on view public.v_labor_dotacion_desviacion is
  'Cargos cuya dotacion ya no es la de su nivel. Estan vacios mientras la matriz sea solo plantilla y van apareciendo a medida que se corrija cargo por cargo.';