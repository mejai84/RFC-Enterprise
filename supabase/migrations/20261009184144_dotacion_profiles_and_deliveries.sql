-- Reusable PPE profiles, role overrides and inventory-backed employee deliveries.

create table public.labor_dotacion_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) >= 3),
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.labor_dotacion_profile_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.labor_dotacion_profiles(id) on delete cascade,
  concept_id uuid not null references public.labor_dotacion_concepts(id) on delete restrict,
  quantity numeric(10,2) not null check (quantity > 0),
  replacement_days integer not null default 240 check (replacement_days > 0),
  unit_value_override numeric(14,2) check (unit_value_override >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, concept_id)
);

alter table public.labor_dotacion_profiles enable row level security;
alter table public.labor_dotacion_profile_items enable row level security;

create policy labor_dotacion_profiles_member_read on public.labor_dotacion_profiles
  for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = labor_dotacion_profiles.company_id));
create policy labor_dotacion_profiles_manager_write on public.labor_dotacion_profiles
  for all to authenticated
  using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = labor_dotacion_profiles.company_id and r.code in ('administrator','resident_engineer','general_management')))
  with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = labor_dotacion_profiles.company_id and r.code in ('administrator','resident_engineer','general_management')));
create policy labor_dotacion_profile_items_member_read on public.labor_dotacion_profile_items
  for select to authenticated using (exists (select 1 from public.labor_dotacion_profiles p join public.user_roles ur on ur.company_id = p.company_id where p.id = labor_dotacion_profile_items.profile_id and ur.user_id = (select auth.uid())));
create policy labor_dotacion_profile_items_manager_write on public.labor_dotacion_profile_items
  for all to authenticated
  using (exists (select 1 from public.labor_dotacion_profiles p join public.user_roles ur on ur.company_id = p.company_id join public.roles r on r.id = ur.role_id where p.id = labor_dotacion_profile_items.profile_id and ur.user_id = (select auth.uid()) and r.code in ('administrator','resident_engineer','general_management')))
  with check (exists (select 1 from public.labor_dotacion_profiles p join public.user_roles ur on ur.company_id = p.company_id join public.roles r on r.id = ur.role_id where p.id = labor_dotacion_profile_items.profile_id and ur.user_id = (select auth.uid()) and r.code in ('administrator','resident_engineer','general_management')));
grant select, insert, update, delete on public.labor_dotacion_profiles, public.labor_dotacion_profile_items to authenticated;
create index labor_dotacion_profiles_company_active_idx on public.labor_dotacion_profiles(company_id, is_active, name);
create index labor_dotacion_profile_items_profile_idx on public.labor_dotacion_profile_items(profile_id, concept_id);
create trigger labor_dotacion_profiles_updated before update on public.labor_dotacion_profiles for each row execute function private.set_updated_at();
create trigger labor_dotacion_profile_items_updated before update on public.labor_dotacion_profile_items for each row execute function private.set_updated_at();

alter table public.labor_rate_roles add column if not exists dotacion_profile_id uuid references public.labor_dotacion_profiles(id) on delete set null;
alter table public.labor_role_dotacion add column if not exists replacement_days integer not null default 240 check (replacement_days > 0);

create or replace function public.apply_dotacion_profile_to_role(p_role_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_company_id uuid;
begin
  select company_id into v_company_id from public.labor_rate_roles where id = p_role_id;
  if not found then raise exception 'El cargo no existe'; end if;
  if not private.inventory_manager_for(v_company_id) then raise exception 'No tienes permiso para modificar la dotacion'; end if;
  if not exists (select 1 from public.labor_dotacion_profiles where id = p_profile_id and company_id = v_company_id and is_active) then raise exception 'El perfil de dotacion no pertenece a la empresa o no esta activo'; end if;
  delete from public.labor_role_dotacion where labor_rate_role_id = p_role_id;
  insert into public.labor_role_dotacion (company_id, labor_rate_role_id, concept_id, quantity, unit_value_override, inherited_from_level, notes, replacement_days)
  select v_company_id, p_role_id, i.concept_id, i.quantity, i.unit_value_override, false, i.notes, i.replacement_days from public.labor_dotacion_profile_items i where i.profile_id = p_profile_id;
  update public.labor_rate_roles set dotacion_profile_id = p_profile_id where id = p_role_id;
  perform public.recompute_labor_role_cost(p_role_id);
end;
$$;
revoke all on function public.apply_dotacion_profile_to_role(uuid, uuid) from public, anon;
grant execute on function public.apply_dotacion_profile_to_role(uuid, uuid) to authenticated;

create table public.employee_dotacion_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  delivery_type text not null check (delivery_type in ('initial','replacement','return')),
  reference text not null unique,
  notes text not null default '',
  delivered_by uuid references auth.users(id) on delete set null,
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.employee_dotacion_delivery_lines (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.employee_dotacion_deliveries(id) on delete cascade,
  stock_id uuid not null references public.inventory_stock(id) on delete restrict,
  item_name_snapshot text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  movement_id uuid references public.inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (delivery_id, stock_id)
);
alter table public.employee_dotacion_deliveries enable row level security;
alter table public.employee_dotacion_delivery_lines enable row level security;
create policy employee_dotacion_deliveries_member_read on public.employee_dotacion_deliveries for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = employee_dotacion_deliveries.company_id));
create policy employee_dotacion_delivery_lines_member_read on public.employee_dotacion_delivery_lines for select to authenticated using (exists (select 1 from public.employee_dotacion_deliveries d join public.user_roles ur on ur.company_id = d.company_id where d.id = employee_dotacion_delivery_lines.delivery_id and ur.user_id = (select auth.uid())));
grant select on public.employee_dotacion_deliveries, public.employee_dotacion_delivery_lines to authenticated;
create index employee_dotacion_deliveries_project_employee_idx on public.employee_dotacion_deliveries(project_id, employee_id, delivered_at desc);
create index employee_dotacion_delivery_lines_delivery_idx on public.employee_dotacion_delivery_lines(delivery_id);

create or replace function public.issue_employee_dotacion(p_project_id uuid, p_employee_id uuid, p_delivery_type text, p_notes text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_company_id uuid; v_delivery_id uuid; v_line jsonb; v_stock public.inventory_stock%rowtype; v_item public.inventory_items%rowtype; v_quantity numeric; v_movement_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id into v_company_id from public.projects where id = p_project_id;
  if not found then raise exception 'La obra no existe'; end if;
  if not private.inventory_manager_for(v_company_id) then raise exception 'No tienes permiso para entregar dotacion'; end if;
  if p_delivery_type not in ('initial','replacement','return') then raise exception 'Tipo de entrega no valido'; end if;
  if not exists (select 1 from public.project_employees where project_id = p_project_id and employee_id = p_employee_id and company_id = v_company_id) then raise exception 'El trabajador debe estar asignado a la obra antes de recibir dotacion'; end if;
  if coalesce(jsonb_typeof(p_lines), '') <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Agrega al menos un articulo de dotacion'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text, 0));
  insert into public.employee_dotacion_deliveries(company_id, project_id, employee_id, delivery_type, reference, notes, delivered_by)
  values (v_company_id, p_project_id, p_employee_id, p_delivery_type, 'DOT-' || upper(substr(gen_random_uuid()::text, 1, 8)), coalesce(trim(p_notes), ''), auth.uid()) returning id into v_delivery_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_quantity := nullif(v_line->>'quantity', '')::numeric;
    if v_quantity is null or v_quantity <= 0 then raise exception 'Cada cantidad debe ser mayor que cero'; end if;
    select * into v_stock from public.inventory_stock where id = (v_line->>'stock_id')::uuid and company_id = v_company_id for update;
    if not found or v_stock.inventory_group <> 'dotacion' then raise exception 'El articulo seleccionado no es una existencia de dotacion valida'; end if;
    if p_delivery_type <> 'return' and v_stock.quantity < v_quantity then raise exception 'Stock insuficiente para la entrega'; end if;
    select * into v_item from public.inventory_items where id = v_stock.item_id;
    insert into public.inventory_movements(stock_id, company_id, branch_id, project_id, movement_type, quantity, unit_cost, reference, notes, occurred_at, created_by, responsible_name)
    values (v_stock.id, v_company_id, v_stock.branch_id, p_project_id, case when p_delivery_type = 'return' then 'entry' else 'exit' end, v_quantity, v_stock.unit_cost, (select reference from public.employee_dotacion_deliveries where id = v_delivery_id), 'Dotacion para ' || coalesce(v_item.name, 'articulo'), now(), auth.uid(), (select full_name from public.employees where id = p_employee_id)) returning id into v_movement_id;
    insert into public.employee_dotacion_delivery_lines(delivery_id, stock_id, item_name_snapshot, quantity, unit_cost, movement_id)
    values (v_delivery_id, v_stock.id, v_item.name, v_quantity, v_stock.unit_cost, v_movement_id);
  end loop;
  return v_delivery_id;
end;
$$;
revoke all on function public.issue_employee_dotacion(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.issue_employee_dotacion(uuid, uuid, text, text, jsonb) to authenticated;
