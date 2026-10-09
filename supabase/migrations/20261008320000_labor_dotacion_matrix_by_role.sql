-- Dotación por cargo, en matriz, en vez de por nivel.
--
-- El libro del cliente agrupa la dotación por nivel porque es donde a
-- él le alcanza, pero para costear por cargo eso no sirve: un oficial de
-- pailería y un ayudante de pailería comparten nivel y llevan cosa
-- distinta. La fila de la matriz es el cargo.
--
-- El nivel queda como plantilla de partida: un cargo arranca con la
-- dotación de su nivel y sobrescribe lo que necesite. Así se corrige un
-- cargo sin tocar los otros, y se ve de un vistazo qué lleva cada uno.

/* ─────────────────────────────────────────────────────────────
 * 1. Catálogo de conceptos
 *
 *    Un concepto existe una sola vez en toda la empresa. Si sube el
 *    precio del overol, se cambia en el catálogo y las 68 filas que lo
 *    usan quedan al día. Por eso la matriz guarda la cantidad y no el
 *    precio: el precio vive en un solo lugar.
 * ───────────────────────────────────────────────────────────── */

create table if not exists public.labor_dotacion_concepts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unit text not null default 'unidad',
  /* Valor de referencia. Puede venir del documento del cliente o del
     precio de compra; la fila de la matriz puede apartarse de el. */
  default_unit_value numeric(14,2) not null default 0 check (default_unit_value >= 0),
  /* Vinculo opcional con el inventario, para saber que hay en bodega y
     a que precio se compro. No es obligatorio: hay conceptos que son
     puro costo de la obra y no se almacenan. */
  inventory_item_id uuid,
  category text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  foreign key (inventory_item_id) references public.inventory_items(id) on delete set null
);

alter table public.labor_dotacion_concepts enable row level security;

drop policy if exists labor_dotacion_concepts_member_read on public.labor_dotacion_concepts;
create policy labor_dotacion_concepts_member_read on public.labor_dotacion_concepts
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = labor_dotacion_concepts.company_id
  ));

drop policy if exists labor_dotacion_concepts_manager_write on public.labor_dotacion_concepts;
create policy labor_dotacion_concepts_manager_write on public.labor_dotacion_concepts
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_dotacion_concepts.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ))
  with check (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_dotacion_concepts.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ));

grant select, insert, update, delete on public.labor_dotacion_concepts to authenticated;

create index if not exists labor_dotacion_concepts_company_idx
  on public.labor_dotacion_concepts (company_id, name)
  where is_active;

/* ─────────────────────────────────────────────────────────────
 * 2. La matriz: cargo por concepto
 * ───────────────────────────────────────────────────────────── */

create table if not exists public.labor_role_dotacion (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  labor_rate_role_id uuid not null references public.labor_rate_roles(id) on delete cascade,
  concept_id uuid not null references public.labor_dotacion_concepts(id) on delete cascade,
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  /* Vacio = usar el valor del catalogo. Con valor = este cargo paga otra
     cosa, por ejemplo unas botas mas economicas. */
  unit_value_override numeric(14,2) check (unit_value_override >= 0),
  /* Heredado del nivel si no se corrige a mano. Sirve para saber que
     filas se han tocado y cuales todavia son plantilla. */
  inherited_from_level boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (labor_rate_role_id, concept_id)
);

alter table public.labor_role_dotacion enable row level security;

drop policy if exists labor_role_dotacion_member_read on public.labor_role_dotacion;
create policy labor_role_dotacion_member_read on public.labor_role_dotacion
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = labor_role_dotacion.company_id
  ));

drop policy if exists labor_role_dotacion_manager_write on public.labor_role_dotacion;
create policy labor_role_dotacion_manager_write on public.labor_role_dotacion
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_role_dotacion.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ))
  with check (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_role_dotacion.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ));

grant select, insert, update, delete on public.labor_role_dotacion to authenticated;

create index if not exists labor_role_dotacion_role_idx
  on public.labor_role_dotacion (labor_rate_role_id, concept_id);

create index if not exists labor_role_dotacion_company_idx
  on public.labor_role_dotacion (company_id, labor_rate_role_id);

comment on column public.labor_role_dotacion.inherited_from_level is
  'true = la fila todavia es la plantilla del nivel. En cuanto se edita a mano queda false y se ve que es una correccion.';

/* ─────────────────────────────────────────────────────────────
 * 3. El costo real pasa a vivir en el cargo
 *
 *    El salario oficial viene del nivel. La dotacion y los viaticos son
 *    del cargo. Por eso el costo calculado se guarda en el cargo, y el
 *    del nivel queda como respaldo mientras el cargo no tenga el suyo.
 * ───────────────────────────────────────────────────────────── */

alter table public.labor_rate_roles
  add column if not exists dotacion_total numeric(14,2);
alter table public.labor_rate_roles
  add column if not exists dotacion_daily numeric(14,2);
alter table public.labor_rate_roles
  add column if not exists computed_daily_cost numeric(14,2);

comment on column public.labor_rate_roles.dotacion_total is
  'Dotacion total de este cargo. Se hereda del nivel y se corrige por cargo.';
comment on column public.labor_rate_roles.dotacion_daily is
  'Dotacion del cargo dividida entre 240 dias.';
comment on column public.labor_rate_roles.computed_daily_cost is
  'Costo real de este cargo: salario oficial del nivel, mas provisiones, horas y la dotacion propia del cargo. Es lo que consume el APU.';

/* ─────────────────────────────────────────────────────────────
 * 4. Sembrar el catalogo con los 26 conceptos del cliente
 * ───────────────────────────────────────────────────────────── */

insert into public.labor_dotacion_concepts (company_id, name, unit, default_unit_value, category)
select c.id, v.concepto, 'unidad', v.valor, v.categoria
from public.companies c cross join (values
  ('overol infiugo',        400000, 'Uniformes de trabajo'),
  ('camisa dril',            55000, 'Uniformes de trabajo'),
  ('pantalon dril',          55000, 'Uniformes de trabajo'),
  ('casco con barbuquejo',    65000, 'Equipos de proteccion personal'),
  ('capuchon',               15000, 'Equipos de proteccion personal'),
  ('tapa oidos desechable',   1500, 'Equipos de proteccion personal'),
  ('tapa oidos tipo copa',   35000, 'Equipos de proteccion personal'),
  ('gafas de seguridad',     15000, 'Equipos de proteccion personal'),
  ('careta 3M',              75000, 'Equipos de proteccion respiratoria'),
  ('filtros 3M',             75000, 'Equipos de proteccion respiratoria'),
  ('tapa boca desechable 3M', 4000, 'Equipos de proteccion respiratoria'),
  ('guante de vaqueta',       7500, 'Equipos de proteccion personal'),
  ('guante tipo soldador',   45000, 'Equipos de proteccion personal'),
  ('guante nitrilo',         15000, 'Equipos de proteccion personal'),
  ('guante presicion',        6500, 'Equipos de proteccion personal'),
  ('delantal de carnaza',     38700, 'Ropa de proteccion'),
  ('mangas de carnaza',       38700, 'Ropa de proteccion'),
  ('botas tipo soldador',   280000, 'Calzado de seguridad'),
  ('botas tipo obrero',     138500, 'Calzado de seguridad'),
  ('botas tipo ingeniero',   325000, 'Calzado de seguridad'),
  ('botas de caucho',        85000, 'Calzado de seguridad'),
  ('traje para invierno',    70000, 'Ropa de proteccion'),
  ('traje tiber',            30000, 'Ropa de proteccion'),
  ('chaleco',                 40000, 'Ropa de proteccion'),
  ('rodilleras',             35000, 'Equipos de proteccion personal')
) as v(concepto, valor, categoria)
on conflict (company_id, name) do update
  set default_unit_value = excluded.default_unit_value,
      category = excluded.category,
      updated_at = now();

/* ─────────────────────────────────────────────────────────────
 * 5. Sembrar la matriz desde la plantilla del nivel
 *
 *    Cada cargo arranca con lo que lleva su nivel. No es la respuesta
 *    final: es el punto de partida para que el usuario corrija cargo por
 *    cargo lo que se diferencie.
 * ───────────────────────────────────────────────────────────── */

insert into public.labor_role_dotacion
  (company_id, labor_rate_role_id, concept_id, quantity, unit_value_override, inherited_from_level)
select r.company_id,
       r.id,
       d.concept_id,
       d.quantity,
       null,
       true
  from public.labor_rate_roles r
  join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
  join public.labor_dotacion_items i
    on i.labor_rate_table_id = e.labor_rate_table_id
   and i.profile = e.level
  join public.labor_dotacion_concepts cat
    on cat.company_id = r.company_id
   and lower(cat.name) = lower(i.concept)
  cross join lateral (
    select cat.id as concept_id, i.quantity as quantity
  ) d
where r.is_active
on conflict (labor_rate_role_id, concept_id) do nothing;

/* ─────────────────────────────────────────────────────────────
 * 6. Totales por cargo
 * ───────────────────────────────────────────────────────────── */

create or replace function private.recompute_role_dotacion()
returns void language sql as $$
  update public.labor_rate_roles r
     set dotacion_total = t.total,
         dotacion_daily = round(t.total / 240.0, 2),
         updated_at = now()
    from (
      select m.labor_rate_role_id,
             sum(m.quantity * coalesce(m.unit_value_override, c.default_unit_value)) as total
        from public.labor_role_dotacion m
        join public.labor_dotacion_concepts c on c.id = m.concept_id
       group by m.labor_rate_role_id
    ) t
   where r.id = t.labor_rate_role_id;
$$;

select private.recompute_role_dotacion();

/* El costo real del cargo: el mismo calculo del nivel, pero con la
   dotacion del cargo y no la del nivel. */
create or replace function private.recompute_role_computed_cost()
returns void language sql as $$
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
           + coalesce(r.dotacion_daily, 0)
           - (
               (e.daily_basic_salary + e.transport_allowance)
               + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
                  + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
             ) * 0.08
         , 2),
         updated_at = now()
    from public.labor_rate_entries e
   where e.id = r.labor_rate_entry_id;
$$;

select private.recompute_role_computed_cost();

/* Consulta de apoyo: que lleva cada cargo y cuanto cuesta. */
create or replace view public.v_labor_role_dotacion as
select r.id as role_id,
       r.company_id,
       r.labor_rate_table_id,
       r.code as role_code,
       r.name as role_name,
       r.scale,
       r.labor_rate_entry_id,
       e.code as level_code,
       e.level,
       e.total_daily_rate as official_daily_rate,
       r.dotacion_total,
       r.dotacion_daily,
       r.computed_daily_cost
  from public.labor_rate_roles r
  left join public.labor_rate_entries e on e.id = r.labor_rate_entry_id
 where r.is_active;

comment on view public.v_labor_role_dotacion is
  'Dotacion y costo real por cargo. El salario oficial viene del nivel; la dotacion y los viaticos son del cargo.';