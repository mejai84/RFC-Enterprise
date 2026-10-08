-- Dotación por nivel, tomada de la hoja `dotacion` del libro del cliente.
--
-- En el Excel la celda AQ de cada nivel de la tabla salarial apunta a la
-- fila 30 de la hoja dotacion, que es la suma de los 26 conceptos de ese
-- perfil. La fila 31 ya lo divide entre 240 días para obtener el diario.
--
-- Se guarda el detalle concepto por concepto y por perfil, para que
-- cualquier valor del APU se pueda auditar hasta la cantidad y el valor
-- unitario que lo producen. Guardar solo el total no permitiría
-- reconstruir por qué un nivel cuesta más que otro.

create table if not exists public.labor_dotacion_items (
  id uuid primary key default gen_random_uuid(),
  labor_rate_table_id uuid not null references public.labor_rate_tables(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  /* Perfil dentro de la hoja: 1 a 6. En OCENSA coincide con el nivel. */
  profile smallint not null check (profile between 1 and 6),
  item_order integer not null default 0,
  concept text not null,
  unit text not null default 'unidad',
  unit_value numeric(14,2) not null default 0 check (unit_value >= 0),
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (labor_rate_table_id, profile, concept),
  foreign key (labor_rate_table_id, company_id) references public.labor_rate_tables(id, company_id) on delete cascade
);

alter table public.labor_dotacion_items enable row level security;

drop policy if exists labor_dotacion_items_member_read on public.labor_dotacion_items;
create policy labor_dotacion_items_member_read on public.labor_dotacion_items
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = labor_dotacion_items.company_id
  ));

drop policy if exists labor_dotacion_items_manager_write on public.labor_dotacion_items;
create policy labor_dotacion_items_manager_write on public.labor_dotacion_items
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_dotacion_items.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ))
  with check (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_dotacion_items.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ));

grant select, insert, update, delete on public.labor_dotacion_items to authenticated;

create index if not exists labor_dotacion_items_table_profile_idx
  on public.labor_dotacion_items (labor_rate_table_id, profile, item_order);

comment on column public.labor_dotacion_items.profile is
  'Perfil de la hoja dotacion del cliente, 1 a 6. En OCENSA coincide con el nivel.';

/* La dotacion del nivel queda disponible sin consultar el detalle. */
alter table public.labor_rate_entries
  add column if not exists dotacion_total numeric(14,2);
alter table public.labor_rate_entries
  add column if not exists dotacion_daily numeric(14,2);

comment on column public.labor_rate_entries.dotacion_total is
  'Dotacion total del perfil para 240 dias, tomada de la hoja dotacion del cliente.';
comment on column public.labor_rate_entries.dotacion_daily is
  'Dotacion total dividida entre 240 dias. Es la que se suma al costo diario.';

/* Catalogo inicial, transcrito de la hoja `dotacion` del libro COT-113-2026.
   Columnas D a I de esa hoja, con su encabezado 6, 5, 4, 3, 2 y 1. */
insert into public.labor_dotacion_items
  (labor_rate_table_id, company_id, profile, item_order, concept, unit, unit_value, quantity, line_total)
select t.id, t.company_id, v.profile::smallint, v.orden::int, v.concepto, v.unidad, v.valor::numeric, v.cantidad::numeric, v.total::numeric
from public.labor_rate_tables t
join (values
  (6, 1, 'overol inifugo', 'unidad', 400000, 3, 1200000),
  (5, 1, 'overol inifugo', 'unidad', 400000, 3, 1200000),
  (4, 1, 'overol inifugo', 'unidad', 400000, 3, 1200000),
  (3, 1, 'overol inifugo', 'unidad', 400000, 3, 1200000),
  (2, 1, 'overol inifugo', 'unidad', 400000, 3, 1200000),
  (1, 1, 'overol inifugo', 'unidad', 400000, 3, 1200000),
  (6, 2, 'camisa dril', 'unidad', 55000, 1, 55000),
  (5, 2, 'camisa dril', 'unidad', 55000, 1, 55000),
  (4, 2, 'camisa dril', 'unidad', 55000, 1, 55000),
  (3, 2, 'camisa dril', 'unidad', 55000, 1, 55000),
  (2, 2, 'camisa dril', 'unidad', 55000, 1, 55000),
  (1, 2, 'camisa dril', 'unidad', 55000, 1, 55000),
  (6, 3, 'pantalon dril', 'unidad', 55000, 1, 55000),
  (5, 3, 'pantalon dril', 'unidad', 55000, 1, 55000),
  (4, 3, 'pantalon dril', 'unidad', 55000, 1, 55000),
  (3, 3, 'pantalon dril', 'unidad', 55000, 1, 55000),
  (2, 3, 'pantalon dril', 'unidad', 55000, 1, 55000),
  (1, 3, 'pantalon dril', 'unidad', 55000, 1, 55000),
  (6, 4, 'casco con barbuquejo', 'unidad', 65000, 2, 130000),
  (5, 4, 'casco con barbuquejo', 'unidad', 65000, 2, 130000),
  (4, 4, 'casco con barbuquejo', 'unidad', 65000, 2, 130000),
  (3, 4, 'casco con barbuquejo', 'unidad', 65000, 2, 130000),
  (2, 4, 'casco con barbuquejo', 'unidad', 65000, 2, 130000),
  (1, 4, 'casco con barbuquejo', 'unidad', 65000, 2, 130000),
  (6, 5, 'capuchon', 'unidad', 15000, 3, 45000),
  (5, 5, 'capuchon', 'unidad', 15000, 3, 45000),
  (4, 5, 'capuchon', 'unidad', 15000, 3, 45000),
  (3, 5, 'capuchon', 'unidad', 15000, 3, 45000),
  (2, 5, 'capuchon', 'unidad', 15000, 3, 45000),
  (1, 5, 'capuchon', 'unidad', 15000, 3, 45000),
  (6, 6, 'tapaoido desch', 'unidad', 1500, 120, 180000),
  (5, 6, 'tapaoido desch', 'unidad', 1500, 50, 75000),
  (4, 6, 'tapaoido desch', 'unidad', 1500, 50, 75000),
  (3, 6, 'tapaoido desch', 'unidad', 1500, 200, 300000),
  (2, 6, 'tapaoido desch', 'unidad', 1500, 200, 300000),
  (1, 6, 'tapaoido desch', 'unidad', 1500, 200, 300000),
  (6, 7, 'tapa oido tipo copa', 'unidad', 35000, 3, 105000),
  (5, 7, 'tapa oido tipo copa', 'unidad', 35000, 3, 105000),
  (4, 7, 'tapa oido tipo copa', 'unidad', 35000, 3, 105000),
  (3, 7, 'tapa oido tipo copa', 'unidad', 35000, 3, 105000),
  (2, 7, 'tapa oido tipo copa', 'unidad', 35000, 3, 105000),
  (1, 7, 'tapa oido tipo copa', 'unidad', 35000, 3, 105000),
  (6, 8, 'gafas de seguridad', 'unidad', 15000, 6, 90000),
  (5, 8, 'gafas de seguridad', 'unidad', 15000, 6, 90000),
  (4, 8, 'gafas de seguridad', 'unidad', 15000, 6, 90000),
  (3, 8, 'gafas de seguridad', 'unidad', 15000, 7, 105000),
  (2, 8, 'gafas de seguridad', 'unidad', 15000, 7, 105000),
  (1, 8, 'gafas de seguridad', 'unidad', 15000, 7, 105000),
  (6, 9, 'careta 3M', 'unidad', 75000, 1, 75000),
  (5, 9, 'careta 3M', 'unidad', 75000, 1, 75000),
  (4, 9, 'careta 3M', 'unidad', 75000, 1, 75000),
  (3, 9, 'careta 3M', 'unidad', 75000, 1, 75000),
  (2, 9, 'careta 3M', 'unidad', 75000, 1, 75000),
  (1, 9, 'careta 3M', 'unidad', 75000, 1, 75000),
  (6, 10, 'filtros 3M', 'unidad', 75000, 1, 75000),
  (5, 10, 'filtros 3M', 'unidad', 75000, 1, 75000),
  (4, 10, 'filtros 3M', 'unidad', 75000, 1, 75000),
  (3, 10, 'filtros 3M', 'unidad', 75000, 2, 150000),
  (2, 10, 'filtros 3M', 'unidad', 75000, 2, 150000),
  (1, 10, 'filtros 3M', 'unidad', 75000, 2, 150000),
  (6, 11, 'tapa boca desechable 3M', 'unidad', 4000, 20, 80000),
  (5, 11, 'tapa boca desechable 3M', 'unidad', 4000, 10, 40000),
  (4, 11, 'tapa boca desechable 3M', 'unidad', 4000, 10, 40000),
  (3, 11, 'tapa boca desechable 3M', 'unidad', 4000, 100, 400000),
  (2, 11, 'tapa boca desechable 3M', 'unidad', 4000, 120, 480000),
  (1, 11, 'tapa boca desechable 3M', 'unidad', 4000, 120, 480000),
  (6, 12, 'guante de vaqueta', 'unidad', 7500, 8, 60000),
  (5, 12, 'guante de vaqueta', 'unidad', 7500, 6, 45000),
  (4, 12, 'guante de vaqueta', 'unidad', 7500, 8, 60000),
  (3, 12, 'guante de vaqueta', 'unidad', 7500, 16, 120000),
  (2, 12, 'guante de vaqueta', 'unidad', 7500, 16, 120000),
  (1, 12, 'guante de vaqueta', 'unidad', 7500, 16, 120000),
  (6, 13, 'guante tipo soldador', 'unidad', 45000, 1, 45000),
  (5, 13, 'guante nitrilo', 'unidad', 15000, 1, 15000),
  (3, 13, 'guante nitrilo', 'unidad', 15000, 16, 240000),
  (2, 13, 'guante nitrilo', 'unidad', 15000, 16, 240000),
  (1, 13, 'guante nitrilo', 'unidad', 15000, 16, 240000),
  (6, 14, 'guante presicion', 'unidad', 6500, 8, 52000),
  (5, 14, 'guante presicion', 'unidad', 6500, 8, 52000),
  (3, 14, 'guante presicion', 'unidad', 6500, 16, 104000),
  (2, 14, 'guante presicion', 'unidad', 6500, 8, 52000),
  (1, 14, 'guante presicion', 'unidad', 6500, 8, 52000),
  (3, 15, 'delantal de carnaza', 'unidad', 38700, 4, 154800),
  (2, 15, 'delantal de carnaza', 'unidad', 38700, 4, 154800),
  (1, 15, 'delantal de carnaza', 'unidad', 38700, 4, 154800),
  (3, 16, 'mangas de carnaza', 'unidad', 38700, 4, 154800),
  (2, 16, 'mangas de carnaza', 'unidad', 38700, 4, 154800),
  (1, 16, 'mangas de carnaza', 'unidad', 38700, 4, 154800),
  (4, 13, 'rodilleras', 'unidad', 35000, 4, 140000),
  (3, 17, 'rodilleras', 'unidad', 35000, 4, 140000),
  (2, 17, 'rodilleras', 'unidad', 35000, 4, 140000),
  (1, 17, 'rodilleras', 'unidad', 35000, 4, 140000),
  (4, 14, 'botas tipo soldador', 'unidad', 280000, 3, 840000),
  (3, 18, 'botas tipo obrero', 'unidad', 138500, 3, 415500),
  (2, 18, 'botas tipo obrero', 'unidad', 138500, 3, 415500),
  (1, 18, 'botas tipo obrero', 'unidad', 138500, 3, 415500),
  (6, 15, 'botas tipo ingeniero', 'unidad', 325000, 2.5, 812500),
  (5, 15, 'botas tipo ingeniero', 'unidad', 325000, 2.5, 812500),
  (6, 16, 'botas de caucho', 'unidad', 85000, 2.5, 212500),
  (5, 16, 'botas de caucho', 'unidad', 85000, 2.5, 212500),
  (4, 15, 'botas de caucho', 'unidad', 85000, 2.5, 212500),
  (3, 19, 'botas de caucho', 'unidad', 85000, 3, 255000),
  (2, 19, 'botas de caucho', 'unidad', 85000, 3, 255000),
  (1, 19, 'botas de caucho', 'unidad', 85000, 3, 255000),
  (6, 17, 'traje para invierno', 'unidad', 70000, 2.5, 175000),
  (5, 17, 'traje para invierno', 'unidad', 70000, 3, 210000),
  (4, 16, 'traje para invierno', 'unidad', 70000, 3, 210000),
  (3, 20, 'traje para invierno', 'unidad', 70000, 3, 210000),
  (2, 20, 'traje para invierno', 'unidad', 70000, 3, 210000),
  (1, 20, 'traje para invierno', 'unidad', 70000, 3, 210000),
  (3, 21, 'traje tiber', 'unidad', 30000, 120, 3600000),
  (2, 21, 'traje tiber', 'unidad', 30000, 120, 3600000),
  (1, 21, 'traje tiber', 'unidad', 30000, 120, 3600000),
  (1, 22, 'Chaleco', 'unidad', 0, 1, 40000)
) as v(profile, orden, concepto, unidad, valor, cantidad, total)
  on t.name = 'OCENSA - tabla salarial 2026-2027'
on conflict (labor_rate_table_id, profile, concept) do update
  set unit_value = excluded.unit_value,
      quantity = excluded.quantity,
      line_total = excluded.line_total,
      updated_at = now();

/* Cada nivel toma la dotacion de su perfil: en OCENSA el perfil coincide
   con el nivel, que es como lo resolvio la hoja del cliente. */
update public.labor_rate_entries e
   set dotacion_total = d.total,
       dotacion_daily = round(d.total / 240.0, 2)
  from (
    select labor_rate_table_id, profile, sum(line_total) as total
      from public.labor_dotacion_items
     group by labor_rate_table_id, profile
  ) d
 where e.labor_rate_table_id = d.labor_rate_table_id
   and d.profile = e.level
   and e.scale = 'propias';

/* El costo computado ya incluye la dotacion del perfil. */
create or replace function private.recompute_labor_computed_cost()
returns void language sql as $$
  with calculo as (
    select
      e.id,
      (
        (e.daily_basic_salary + e.transport_allowance)
        + (e.daily_basic_salary + e.transport_allowance) * (
             0.0834 + (0.0834 * 12) / 360 + 0.0834 + 0.0417 + 0.0696
           + 0.03 + 0.02 + 0.04 + 0.125 + 0.16
          )
        + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
           + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
        + e.food_allowance
        + e.non_salary_allowance
        + coalesce(e.dotacion_daily, 0)
        - (
            (e.daily_basic_salary + e.transport_allowance)
            + ((e.daily_basic_salary / 7.0) * 1.25 * 56.0
               + (e.daily_basic_salary / 7.0) * 2.90 * 14.0) / 240.0
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