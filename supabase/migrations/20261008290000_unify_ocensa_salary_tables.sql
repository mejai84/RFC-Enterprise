-- Unify the two OCENSA tables into one contractual table.
--
-- The client publishes one salary table with two scales inside it:
-- actividades propias and actividades no propias. The database had them
-- as two separate tables, so the quote form offered two OCENSA entries
-- that looked like different contracts and the user had to choose before
-- knowing which one applied.
--
-- The scale now belongs to the entry, not to the table. The table is the
-- client's document; the scale is a chapter inside it.

/* 1. The unique key has to change before any row can move.
      Both scales use codes N1..N6, so uniqueness by table+code can no
      longer hold; it becomes table+scale+code. */
alter table public.labor_rate_entries
  drop constraint if exists labor_rate_entries_labor_rate_table_id_code_key;
alter table public.labor_rate_entries
  drop constraint if exists labor_rate_entries_table_code_key;

alter table public.labor_rate_entries
  add column if not exists scale text not null default 'general'
  check (scale in ('general', 'propias', 'no_propias'));

alter table public.labor_rate_entries
  add constraint labor_rate_entries_table_scale_code_key
  unique (labor_rate_table_id, scale, code);

comment on column public.labor_rate_entries.scale is
  'Escala dentro de la tabla del cliente. Para OCENSA: propias o no propias.';

/* 2. Same for the roles. */
alter table public.labor_rate_roles
  add column if not exists scale text not null default 'general'
  check (scale in ('general', 'propias', 'no_propias'));

comment on column public.labor_rate_roles.scale is
  'Escala del cargo. Determina de que nivel toma el salario oficial.';

/* 3. A table may now carry more than one scale. */
alter table public.labor_rate_tables
  drop constraint if exists labor_rate_tables_activity_type_check;
alter table public.labor_rate_tables
  add constraint labor_rate_tables_activity_type_check
  check (activity_type in ('general', 'propias', 'no_propias', 'mixta'));

comment on column public.labor_rate_tables.activity_type is
  'general = una sola escala. propia o no_propia = esa escala. mixta = el documento trae varias escalas internas.';

/* 4. Build the single OCENSA table and move both scales into it. */
do $$
declare
  v_company uuid;
  v_nueva uuid;
  v_propias uuid;
  v_no_propias uuid;
begin
  select t.company_id into v_company
  from public.labor_rate_tables t
  where t.name = 'OCENSA - actividades propias'
  limit 1;

  if v_company is null then
    raise notice 'No hay tablas de OCENSA; no se hace nada.';
    return;
  end if;

  select id into v_propias from public.labor_rate_tables
    where company_id = v_company and name = 'OCENSA - actividades propias' limit 1;
  select id into v_no_propias from public.labor_rate_tables
    where company_id = v_company and name = 'OCENSA - actividades no propias' limit 1;

  insert into public.labor_rate_tables
    (company_id, client_name, name, version, activity_type, rate_unit, valid_from, valid_to, source_document, notes)
  values
    (v_company, 'OCENSA', 'OCENSA - tabla salarial 2026-2027', '2026-2027', 'mixta', 'day',
     date '2026-07-01', date '2027-06-30',
     'Tabla salarial OCENSA actividades propias y no propias',
     'Documento unico del cliente. La escala propias o no propias se elige por cargo.')
  on conflict (company_id, name, version) do update
    set activity_type = 'mixta', notes = excluded.notes, updated_at = now()
  returning id into v_nueva;

  /* La escala se fija antes de mover, para que no se pierda al cambiar de tabla. */
  update public.labor_rate_entries set scale = 'propias' where labor_rate_table_id = v_propias;
  update public.labor_rate_entries set scale = 'no_propias' where labor_rate_table_id = v_no_propias;
  update public.labor_rate_roles set scale = 'propias' where labor_rate_table_id = v_propias;
  update public.labor_rate_roles set scale = 'no_propias' where labor_rate_table_id = v_no_propias;

  /* Los roles no propias se reapuntan a su nivel equivalente, que ahora
     vive en la misma tabla con la escala no_propias. */
  update public.labor_rate_roles r
  set labor_rate_table_id = v_nueva,
      labor_rate_entry_id = e_destino.id
  from public.labor_rate_roles r_origen
  join public.labor_rate_entries e_origen on e_origen.id = r_origen.labor_rate_entry_id
  join public.labor_rate_entries e_destino
    on e_destino.labor_rate_table_id = v_nueva
   and e_destino.scale = 'no_propias'
   and e_destino.code = e_origen.code
  where r_origen.labor_rate_table_id = v_no_propias
    and r.id = r_origen.id;

  /* Las entradas de ambas escalas pasan a la tabla unica. */
  update public.labor_rate_entries set labor_rate_table_id = v_nueva
   where labor_rate_table_id in (v_propias, v_no_propias);

  /* Las dos tablas viejas dejan de ofrecerse. Se conservan por historico. */
  update public.labor_rate_tables
     set is_active = false,
         notes = 'Unificada en OCENSA - tabla salarial 2026-2027.'
   where id in (v_propias, v_no_propias) and id is distinct from v_nueva;

  raise notice 'Tabla unificada: %', v_nueva;
end;
$$;

create index if not exists labor_rate_entries_table_scale_idx
  on public.labor_rate_entries (labor_rate_table_id, scale, sort_order, name);

create index if not exists labor_rate_roles_table_scale_idx
  on public.labor_rate_roles (labor_rate_table_id, scale, name)
  where is_active;