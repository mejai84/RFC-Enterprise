-- Conteo colaborativo y carga inicial de inventario.
-- La base es la ?nica autoridad: el navegador nunca decide el saldo de sistema
-- ni puede aprobar, editar o borrar jornadas directamente.

alter table public.physical_counts
  add column if not exists count_kind text not null default 'periodic'
    check (count_kind in ('initial', 'periodic')),
  add column if not exists scope_type text not null default 'all'
    check (scope_type in ('all', 'location', 'category')),
  add column if not exists scope_value text,
  add column if not exists expected_line_count integer not null default 0
    check (expected_line_count >= 0),
  add column if not exists reconciled_summary jsonb;

alter table public.physical_count_lines
  alter column counted_quantity drop not null,
  add column if not exists counted_by uuid references public.profiles(id) on delete set null,
  add column if not exists counted_by_name text,
  add column if not exists counted_at timestamptz,
  add column if not exists notes text;

create table if not exists public.physical_count_new_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.physical_counts(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  brand text,
  unit text not null default 'unidad',
  inventory_group text not null default 'bodega',
  location text,
  counted_quantity numeric(14,3) not null check (counted_quantity >= 0),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  counted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  counted_by_name text,
  counted_at timestamptz not null default now(),
  approved_item_id uuid references public.inventory_items(id) on delete set null,
  approved_stock_id uuid references public.inventory_stock(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (count_id, sku)
);

alter table public.physical_count_new_items enable row level security;

-- La jornada abierta previa no se descarta: se convierte en un conteo inicial
-- con una fotograf?a verificable de toda la bodega.
update public.physical_counts
set count_kind = 'initial', scope_type = 'all'
where status = 'draft' and expected_line_count = 0;

insert into public.physical_count_lines (
  count_id, stock_id, system_quantity, counted_quantity, reason
)
select count_row.id, stock.id, stock.quantity, null, count_row.reason
from public.physical_counts count_row
join public.inventory_stock stock
  on stock.company_id = count_row.company_id
 and stock.branch_id = count_row.branch_id
where count_row.status = 'draft'
  and count_row.expected_line_count = 0
on conflict (count_id, stock_id) do nothing;

update public.physical_counts count_row
set expected_line_count = (
  select count(*) from public.physical_count_lines line where line.count_id = count_row.id
)
where count_row.status = 'draft';

create or replace function private.inventory_manager_for_branch(
  target_company uuid,
  target_branch uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles user_role
    join public.roles role on role.id = user_role.role_id
    where user_role.user_id = (select auth.uid())
      and user_role.company_id = target_company
      and (user_role.branch_id is null or user_role.branch_id = target_branch)
      and role.code in ('administrator', 'inventory_manager')
  )
$$;

-- Ninguna escritura queda expuesta por la API de tablas. Las tres RPC debajo
-- son la frontera transaccional de una jornada.
drop policy if exists physical_counts_member_read on public.physical_counts;
drop policy if exists physical_counts_manager_write on public.physical_counts;
drop policy if exists physical_count_lines_member_read on public.physical_count_lines;
drop policy if exists physical_count_lines_manager_write on public.physical_count_lines;

create policy physical_counts_manager_read
on public.physical_counts for select to authenticated
using (private.inventory_manager_for_branch(company_id, branch_id));

create policy physical_count_lines_manager_read
on public.physical_count_lines for select to authenticated
using (
  exists (
    select 1 from public.physical_counts count_row
    where count_row.id = physical_count_lines.count_id
      and private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id)
  )
);

create policy physical_count_new_items_manager_read
on public.physical_count_new_items for select to authenticated
using (
  exists (
    select 1 from public.physical_counts count_row
    where count_row.id = physical_count_new_items.count_id
      and private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id)
  )
);

revoke all on table public.physical_counts from anon, authenticated;
revoke all on table public.physical_count_lines from anon, authenticated;
revoke all on table public.physical_count_new_items from anon, authenticated;
grant select on table public.physical_counts to authenticated;
grant select on table public.physical_count_lines to authenticated;
grant select on table public.physical_count_new_items to authenticated;

create unique index if not exists physical_counts_one_open_session_per_branch_idx
  on public.physical_counts(company_id, branch_id)
  where status = 'draft';

create index if not exists physical_count_lines_progress_idx
  on public.physical_count_lines(count_id, counted_at nulls first);

create index if not exists physical_count_new_items_count_idx
  on public.physical_count_new_items(count_id, counted_at);

create or replace function public.inventory_count_branches()
returns table (branch_id uuid, branch_name text, company_id uuid)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select branch.id, branch.name, branch.company_id
  from public.branches branch
  where private.inventory_manager_for_branch(branch.company_id, branch.id)
  order by branch.name
$$;

create or replace function public.open_physical_count(
  p_branch_id uuid,
  p_scope_type text default 'all',
  p_scope_value text default null,
  p_reason text default null,
  p_count_kind text default 'initial'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
  target_company uuid;
  snapshot_count integer;
  scope_label text;
begin
  select branch.company_id into target_company
  from public.branches branch
  where branch.id = p_branch_id;
  if target_company is null then raise exception 'La sede no existe'; end if;
  if not private.inventory_manager_for_branch(target_company, p_branch_id) then
    raise exception 'No autorizado para abrir conteos en esta sede';
  end if;
  if p_scope_type not in ('all', 'location', 'category') then
    raise exception 'El alcance no es v?lido';
  end if;
  if p_scope_type <> 'all' and nullif(trim(coalesce(p_scope_value, '')), '') is null then
    raise exception 'Selecciona el valor del alcance';
  end if;
  if p_count_kind not in ('initial', 'periodic') then
    raise exception 'El tipo de conteo no es v?lido';
  end if;

  select * into count_row
  from public.physical_counts
  where company_id = target_company and branch_id = p_branch_id and status = 'draft'
  for update;
  if found then return count_row.id; end if;

  scope_label := case p_scope_type
    when 'all' then 'Toda la bodega'
    when 'location' then 'Ubicaci?n: ' || trim(p_scope_value)
    else 'Categor?a: ' || trim(p_scope_value)
  end;

  insert into public.physical_counts(
    company_id, branch_id, status, reason, count_kind, scope_type, scope_value, counted_by
  ) values (
    target_company, p_branch_id, 'draft',
    coalesce(nullif(trim(p_reason), ''), 'Conteo f?sico ? ' || scope_label),
    p_count_kind, p_scope_type, nullif(trim(p_scope_value), ''), auth.uid()
  ) returning * into count_row;

  insert into public.physical_count_lines(
    count_id, stock_id, system_quantity, counted_quantity, reason
  )
  select count_row.id, stock.id, stock.quantity, null, count_row.reason
  from public.inventory_stock stock
  join public.inventory_items item on item.id = stock.item_id
  where stock.company_id = target_company
    and stock.branch_id = p_branch_id
    and (p_scope_type <> 'location' or coalesce(stock.location, '') = trim(p_scope_value))
    and (p_scope_type <> 'category' or coalesce(item.category, '') = trim(p_scope_value));

  get diagnostics snapshot_count = row_count;
  update public.physical_counts
  set expected_line_count = snapshot_count
  where id = count_row.id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    target_company, p_branch_id, auth.uid(), 'physical_count', count_row.id,
    'opened', jsonb_build_object('kind', p_count_kind, 'scope_type', p_scope_type,
      'scope_value', p_scope_value, 'expected_lines', snapshot_count)
  );
  return count_row.id;
end;
$$;

create or replace function public.save_physical_count_line(
  p_count_id uuid,
  p_stock_id uuid,
  p_counted_quantity numeric,
  p_counted_location text default null,
  p_unit_cost numeric default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
  line_row public.physical_count_lines%rowtype;
  actor_name text;
begin
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'La cantidad f?sica debe ser cero o mayor';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'El costo unitario no puede ser negativo';
  end if;

  select * into count_row from public.physical_counts where id = p_count_id for update;
  if not found then raise exception 'La jornada no existe'; end if;
  if not private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id) then
    raise exception 'No autorizado para registrar este conteo';
  end if;
  if count_row.status <> 'draft' then raise exception 'La jornada ya est? cerrada'; end if;

  select * into line_row
  from public.physical_count_lines
  where count_id = p_count_id and stock_id = p_stock_id
  for update;
  if not found then raise exception 'El art?culo no pertenece a la fotograf?a de esta jornada'; end if;
  if line_row.counted_by is not null and line_row.counted_by <> auth.uid() then
    raise exception 'Este art?culo ya fue registrado por otra persona y requiere revisi?n del responsable';
  end if;

  select coalesce(nullif(trim(display_name), ''), email, 'Usuario') into actor_name
  from public.profiles where id = auth.uid();

  update public.physical_count_lines
  set counted_quantity = p_counted_quantity,
      counted_location = nullif(trim(p_counted_location), ''),
      unit_cost = p_unit_cost,
      notes = nullif(trim(p_notes), ''),
      counted_by = auth.uid(),
      counted_by_name = actor_name,
      counted_at = now()
  where id = line_row.id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    count_row.company_id, count_row.branch_id, auth.uid(), 'physical_count_line', line_row.id,
    case when line_row.counted_at is null then 'recorded' else 'updated_by_counter' end,
    jsonb_build_object('counted_quantity', line_row.counted_quantity, 'unit_cost', line_row.unit_cost),
    jsonb_build_object('counted_quantity', p_counted_quantity, 'unit_cost', p_unit_cost,
      'location', p_counted_location)
  );
end;
$$;

create or replace function public.add_physical_count_new_item(
  p_count_id uuid,
  p_sku text,
  p_name text,
  p_category text,
  p_brand text,
  p_unit text,
  p_location text,
  p_counted_quantity numeric,
  p_unit_cost numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
  candidate_id uuid;
  actor_name text;
begin
  if nullif(trim(p_sku), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'El art?culo nuevo requiere SKU y nombre';
  end if;
  if nullif(trim(p_unit), '') is null then raise exception 'El art?culo nuevo requiere unidad'; end if;
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'La cantidad f?sica debe ser cero o mayor';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'El costo no puede ser negativo'; end if;

  select * into count_row from public.physical_counts where id = p_count_id for update;
  if not found then raise exception 'La jornada no existe'; end if;
  if not private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id) then
    raise exception 'No autorizado para agregar art?culos';
  end if;
  if count_row.status <> 'draft' then raise exception 'La jornada ya est? cerrada'; end if;
  if exists (
    select 1 from public.inventory_items item
    where item.company_id = count_row.company_id and lower(coalesce(item.sku, '')) = lower(trim(p_sku))
  ) then raise exception 'Ya existe un art?culo con ese SKU en el cat?logo'; end if;
  if exists (
    select 1 from public.physical_count_new_items candidate
    where candidate.count_id = p_count_id and lower(candidate.sku) = lower(trim(p_sku))
  ) then raise exception 'Ese SKU ya fue agregado a esta jornada'; end if;

  select coalesce(nullif(trim(display_name), ''), email, 'Usuario') into actor_name
  from public.profiles where id = auth.uid();

  insert into public.physical_count_new_items(
    count_id, sku, name, category, brand, unit, location, counted_quantity,
    unit_cost, notes, counted_by, counted_by_name
  ) values (
    p_count_id, trim(p_sku), trim(p_name), nullif(trim(p_category), ''),
    nullif(trim(p_brand), ''), trim(p_unit), nullif(trim(p_location), ''),
    p_counted_quantity, p_unit_cost, nullif(trim(p_notes), ''), auth.uid(), actor_name
  ) returning id into candidate_id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    count_row.company_id, count_row.branch_id, auth.uid(), 'physical_count_new_item',
    candidate_id, 'recorded', jsonb_build_object('sku', trim(p_sku), 'quantity', p_counted_quantity)
  );
  return candidate_id;
end;
$$;

create or replace function public.approve_physical_count(target_count uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
  line_row record;
  new_item record;
  stock_row public.inventory_stock%rowtype;
  new_item_id uuid;
  new_stock_id uuid;
  pending_lines integer;
  movement_kind public.inventory_movement_type;
  new_items_total integer;
begin
  select * into count_row from public.physical_counts where id = target_count for update;
  if not found then raise exception 'Conteo no encontrado'; end if;
  if not private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id) then
    raise exception 'No autorizado para conciliar conteos';
  end if;
  if count_row.status <> 'draft' then raise exception 'La jornada ya fue procesada'; end if;

  select count(*) into pending_lines
  from public.physical_count_lines
  where count_id = target_count and counted_quantity is null;
  if pending_lines > 0 then
    raise exception 'Faltan % art?culos por contar. Registra tambi?n cero cuando no haya existencia.', pending_lines;
  end if;
  if count_row.expected_line_count = 0 and not exists (
    select 1 from public.physical_count_new_items where count_id = target_count
  ) then
    raise exception 'La jornada no tiene art?culos registrados';
  end if;

  -- Se detiene si hubo movimientos desde la fotograf?a: as? el resultado final
  -- jam?s mezcla un conteo de varios d?as con saldos que cambiaron despu?s.
  for line_row in
    select * from public.physical_count_lines where count_id = target_count order by id
  loop
    select * into stock_row
    from public.inventory_stock stock
    where stock.id = line_row.stock_id
      and stock.company_id = count_row.company_id
      and stock.branch_id = count_row.branch_id
    for update;
    if not found then raise exception 'Una l?nea de conteo no pertenece a esta sede'; end if;
    if stock_row.quantity <> line_row.system_quantity then
      raise exception 'El art?culo % cambi? desde que se abri? la jornada. Revisa y abre una nueva jornada.', line_row.stock_id;
    end if;
  end loop;

  for line_row in
    select * from public.physical_count_lines where count_id = target_count order by id
  loop
    select * into stock_row from public.inventory_stock where id = line_row.stock_id for update;
    if line_row.counted_quantity <> stock_row.quantity then
      movement_kind := case when line_row.counted_quantity > stock_row.quantity
        then 'adjustment_in' else 'adjustment_out' end;
      insert into public.inventory_movements(
        stock_id, company_id, branch_id, movement_type, quantity, reference,
        notes, count_session_id, unit_cost
      ) values (
        stock_row.id, count_row.company_id, count_row.branch_id, movement_kind,
        abs(line_row.counted_quantity - stock_row.quantity),
        'CONTEO-' || to_char(now(), 'YYYYMMDD'),
        'Conciliaci?n de conteo f?sico: ' || count_row.reason,
        target_count, coalesce(line_row.unit_cost, stock_row.unit_cost, 0)
      );
    end if;
    update public.inventory_stock
    set location = coalesce(nullif(trim(line_row.counted_location), ''), location),
        unit_cost = case when line_row.unit_cost is null then unit_cost else line_row.unit_cost end,
        valuation_status = case when line_row.unit_cost is null then valuation_status else 'confirmed' end,
        initial_value_source = case when line_row.unit_cost is null then initial_value_source else 'Conteo f?sico conciliado' end,
        initial_value_set_at = case when line_row.unit_cost is null then initial_value_set_at else now() end
    where id = stock_row.id;
  end loop;

  for new_item in
    select * from public.physical_count_new_items
    where count_id = target_count and status = 'draft'
    order by created_at
  loop
    if exists (
      select 1 from public.inventory_items item
      where item.company_id = count_row.company_id and lower(coalesce(item.sku, '')) = lower(new_item.sku)
    ) then raise exception 'El SKU % ya existe y debe revisarse antes de aprobar.', new_item.sku; end if;

    insert into public.inventory_items(company_id, sku, name, category, brand, unit, notes, source_group)
    values (count_row.company_id, new_item.sku, new_item.name, new_item.category,
      new_item.brand, new_item.unit, new_item.notes, 'physical_count')
    returning id into new_item_id;

    insert into public.inventory_stock(
      item_id, company_id, branch_id, inventory_group, location, quantity,
      unit_cost, valuation_status, initial_value_source, initial_value_set_at
    ) values (
      new_item_id, count_row.company_id, count_row.branch_id, new_item.inventory_group,
      new_item.location, 0, coalesce(new_item.unit_cost, 0),
      case when new_item.unit_cost is null then 'pending' else 'confirmed' end,
      case when new_item.unit_cost is null then null else 'Conteo f?sico inicial' end,
      case when new_item.unit_cost is null then null else now() end
    ) returning id into new_stock_id;

    if new_item.counted_quantity > 0 then
      insert into public.inventory_movements(
        stock_id, company_id, branch_id, movement_type, quantity, reference,
        notes, count_session_id, unit_cost
      ) values (
        new_stock_id, count_row.company_id, count_row.branch_id, 'adjustment_in',
        new_item.counted_quantity, 'CONTEO-' || to_char(now(), 'YYYYMMDD'),
        'Art?culo encontrado durante conteo f?sico: ' || new_item.name,
        target_count, coalesce(new_item.unit_cost, 0)
      );
    end if;

    update public.physical_count_new_items
    set status = 'approved', approved_item_id = new_item_id, approved_stock_id = new_stock_id,
        updated_at = now()
    where id = new_item.id;
  end loop;

  select count(*) into new_items_total
  from public.physical_count_new_items where count_id = target_count;

  update public.physical_counts
  set status = 'approved', approved_by = auth.uid(), approved_at = now(),
      reconciled_summary = jsonb_build_object(
        'expected_lines', expected_line_count,
        'counted_lines', expected_line_count,
        'new_items', new_items_total,
        'reconciled_at', now()
      )
  where id = target_count;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    count_row.company_id, count_row.branch_id, auth.uid(), 'physical_count', target_count,
    'reconciled', jsonb_build_object('expected_lines', count_row.expected_line_count,
      'new_items', new_items_total, 'approved_at', now())
  );
end;
$$;

revoke all on function public.inventory_count_branches() from public, anon;
revoke all on function public.open_physical_count(uuid, text, text, text, text) from public, anon;
revoke all on function public.save_physical_count_line(uuid, uuid, numeric, text, numeric, text) from public, anon;
revoke all on function public.add_physical_count_new_item(uuid, text, text, text, text, text, text, numeric, numeric, text) from public, anon;
revoke all on function public.approve_physical_count(uuid) from public, anon;
grant execute on function public.inventory_count_branches() to authenticated;
grant execute on function public.open_physical_count(uuid, text, text, text, text) to authenticated;
grant execute on function public.save_physical_count_line(uuid, uuid, numeric, text, numeric, text) to authenticated;
grant execute on function public.add_physical_count_new_item(uuid, text, text, text, text, text, text, numeric, numeric, text) to authenticated;
grant execute on function public.approve_physical_count(uuid) to authenticated;
