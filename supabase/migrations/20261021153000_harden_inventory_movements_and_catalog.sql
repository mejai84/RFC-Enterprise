-- INV-026 / INV-027: inventario y kardex como libro mayor auditable.
-- Todas las mutaciones de stock pasan por RPCs transaccionales; la API no puede
-- editar saldos ni insertar movimientos directamente.

alter table public.inventory_movements
  add column if not exists operation_kind text,
  add column if not exists client_request_id uuid,
  add column if not exists quantity_before numeric(14,3),
  add column if not exists quantity_after numeric(14,3);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_movements_operation_kind_check'
      and conrelid = 'public.inventory_movements'::regclass
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_operation_kind_check
      check (operation_kind is null or operation_kind in ('entry', 'exit', 'adjustment', 'return', 'transfer', 'opening', 'count', 'purchase', 'dispatch', 'writeoff', 'loan'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_stock_minimum_quantity_nonnegative'
      and conrelid = 'public.inventory_stock'::regclass
  ) then
    alter table public.inventory_stock
      add constraint inventory_stock_minimum_quantity_nonnegative
      check (minimum_quantity is null or minimum_quantity >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_items_units_per_purchase_positive'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_units_per_purchase_positive
      check (units_per_purchase is null or units_per_purchase > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_items_purchase_unit_cost_nonnegative'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_purchase_unit_cost_nonnegative
      check (purchase_unit_cost is null or purchase_unit_cost >= 0);
  end if;
end
$$;

-- La restricción anterior hacía que el segundo artículo manual (o hallazgo de
-- conteo) chocara con NULLS NOT DISTINCT. Las filas importadas conservan su
-- unicidad solo cuando realmente tienen identificador de origen.
alter table public.inventory_items
  drop constraint if exists inventory_items_company_id_source_group_source_row_key;

create unique index if not exists inventory_items_source_reference_unique
  on public.inventory_items(company_id, source_group, source_row)
  where source_group is not null and source_row is not null;

create index if not exists inventory_items_company_normalized_sku_idx
  on public.inventory_items(company_id, lower(btrim(sku)))
  where sku is not null and btrim(sku) <> '';

create unique index if not exists inventory_movements_company_request_unique
  on public.inventory_movements(company_id, client_request_id)
  where client_request_id is not null;

create index if not exists inventory_movements_branch_id_idx
  on public.inventory_movements(branch_id);
create index if not exists inventory_movements_created_by_idx
  on public.inventory_movements(created_by)
  where created_by is not null;
create index if not exists inventory_locations_company_id_idx
  on public.inventory_locations(company_id);

-- Llaves compuestas: impiden combinar UUID válidos de otra empresa o sede.
create unique index if not exists inventory_items_id_company_unique
  on public.inventory_items(id, company_id);
create unique index if not exists branches_id_company_unique
  on public.branches(id, company_id);
create unique index if not exists inventory_stock_id_company_branch_unique
  on public.inventory_stock(id, company_id, branch_id);
create unique index if not exists projects_id_company_unique
  on public.projects(id, company_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventory_stock_item_company_fk') then
    alter table public.inventory_stock add constraint inventory_stock_item_company_fk
      foreign key (item_id, company_id) references public.inventory_items(id, company_id) not valid;
    alter table public.inventory_stock validate constraint inventory_stock_item_company_fk;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_stock_branch_company_fk') then
    alter table public.inventory_stock add constraint inventory_stock_branch_company_fk
      foreign key (branch_id, company_id) references public.branches(id, company_id) not valid;
    alter table public.inventory_stock validate constraint inventory_stock_branch_company_fk;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_stock_scope_fk') then
    alter table public.inventory_movements add constraint inventory_movements_stock_scope_fk
      foreign key (stock_id, company_id, branch_id) references public.inventory_stock(id, company_id, branch_id) not valid;
    alter table public.inventory_movements validate constraint inventory_movements_stock_scope_fk;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_movements_project_company_fk') then
    alter table public.inventory_movements add constraint inventory_movements_project_company_fk
      foreign key (project_id, company_id) references public.projects(id, company_id) not valid;
    alter table public.inventory_movements validate constraint inventory_movements_project_company_fk;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inventory_locations_branch_company_fk') then
    alter table public.inventory_locations add constraint inventory_locations_branch_company_fk
      foreign key (branch_id, company_id) references public.branches(id, company_id) not valid;
    alter table public.inventory_locations validate constraint inventory_locations_branch_company_fk;
  end if;
end
$$;

-- Resuelve permisos por empresa, no por "primer empleado del usuario". Los
-- roles de empleado tienen prioridad sobre user_roles (la fuente que sincroniza
-- la app) y los overrides se aplican solo dentro de la empresa correspondiente.
create or replace function private.inventory_has_permission(target_company uuid, requested text[])
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with me as (
    select employee.id as employee_id
    from public.employees employee
    where employee.profile_id = (select auth.uid())
      and employee.is_active
      and employee.company_id = target_company
    limit 1
  ),
  role_ids as (
    select employee_role.role_id
    from public.employee_roles employee_role
    join me on me.employee_id = employee_role.employee_id
    union
    select user_role.role_id
    from public.user_roles user_role
    where user_role.user_id = (select auth.uid())
      and user_role.company_id = target_company
      and not exists (
        select 1
        from public.employee_roles employee_role
        join me on me.employee_id = employee_role.employee_id
      )
  ),
  inherited as (
    select distinct permission.code
    from role_ids
    join public.role_permissions role_permission on role_permission.role_id = role_ids.role_id
    join public.permissions permission on permission.id = role_permission.permission_id
  ),
  overridden as (
    select permission.code, override.mode::text as mode
    from public.employee_permission_overrides override
    join me on me.employee_id = override.employee_id
    join public.permissions permission on permission.id = override.permission_id
  )
  select exists (
    select 1
    from inherited
    where inherited.code = any(requested)
      and not exists (
        select 1 from overridden
        where overridden.code = inherited.code and overridden.mode = 'revoke'
      )
    union
    select 1
    from overridden
    where overridden.code = any(requested) and overridden.mode = 'grant'
  );
$$;

create or replace function private.inventory_can_read_company(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select private.inventory_has_permission(
    target_company,
    array[
      'inventory.catalog.view', 'inventory.items.read', 'inventory.items.manage',
      'inventory.stock.read', 'inventory.stock.manage', 'inventory.movements.read',
      'inventory.movements.create', 'inventory.dispatch.create', 'inventory.return.create',
      'inventory.tools.manage', 'inventory.kardex.view', 'inventory.reports.read'
    ]
  );
$$;

create or replace function private.inventory_can_read_branch(target_company uuid, target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select private.inventory_can_read_company(target_company)
    and exists (
      select 1
      from public.user_roles user_role
      where user_role.user_id = (select auth.uid())
        and user_role.company_id = target_company
        and user_role.branch_id = target_branch
      union all
      select 1
      from public.employees employee
      where employee.profile_id = (select auth.uid())
        and employee.is_active
        and employee.company_id = target_company
        and (employee.branch_id is null or employee.branch_id = target_branch)
    );
$$;

create or replace function private.inventory_can_manage_branch(target_company uuid, target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select private.inventory_manager_for_branch(target_company, target_branch)
    or (
      private.inventory_can_read_branch(target_company, target_branch)
      and private.inventory_has_permission(
        target_company,
        array['inventory.stock.manage', 'inventory.movements.create', 'inventory.items.manage']
      )
    );
$$;

revoke all on function private.inventory_has_permission(uuid, text[]) from public;
revoke all on function private.inventory_can_read_company(uuid) from public;
revoke all on function private.inventory_can_read_branch(uuid, uuid) from public;
revoke all on function private.inventory_can_manage_branch(uuid, uuid) from public;
-- Las políticas RLS se evalúan con los privilegios del usuario que consulta.
-- El esquema private no es visible para authenticated, así que se expone un
-- envoltorio público mínimo y se mantiene el resto del esquema cerrado.
create or replace function public.inventory_reader_for_company(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$ select private.inventory_can_read_company(target_company); $$;

create or replace function public.inventory_reader_for_branch(target_company uuid, target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$ select private.inventory_can_read_branch(target_company, target_branch); $$;

create or replace function public.inventory_manager_access(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$ select private.inventory_manager_for(target_company); $$;

revoke all on function public.inventory_reader_for_company(uuid) from public, anon;
revoke all on function public.inventory_reader_for_branch(uuid, uuid) from public, anon;
revoke all on function public.inventory_manager_access(uuid) from public, anon;
grant execute on function public.inventory_reader_for_company(uuid) to authenticated;
grant execute on function public.inventory_reader_for_branch(uuid, uuid) to authenticated;
grant execute on function public.inventory_manager_access(uuid) to authenticated;

drop policy if exists items_member_read on public.inventory_items;
drop policy if exists stock_member_read on public.inventory_stock;
drop policy if exists movements_member_read on public.inventory_movements;
drop policy if exists stock_manager_update on public.inventory_stock;
drop policy if exists movements_manager_insert on public.inventory_movements;
drop policy if exists "inventory categories read by company member" on public.inventory_categories;
drop policy if exists "inventory categories managed by inventory manager" on public.inventory_categories;
drop policy if exists inventory_locations_member_read on public.inventory_locations;
drop policy if exists inventory_locations_manager_write on public.inventory_locations;
drop policy if exists inventory_writeoffs_manager_write on public.inventory_writeoffs;

create policy items_inventory_reader
  on public.inventory_items for select to authenticated
  using (public.inventory_reader_for_company(company_id));
create policy stock_inventory_reader
  on public.inventory_stock for select to authenticated
  using (public.inventory_reader_for_branch(company_id, branch_id));
create policy movements_inventory_reader
  on public.inventory_movements for select to authenticated
  using (public.inventory_reader_for_branch(company_id, branch_id));
create policy inventory_categories_inventory_reader
  on public.inventory_categories for select to authenticated
  using (public.inventory_reader_for_company(company_id));
create policy inventory_categories_inventory_manager_write
  on public.inventory_categories for all to authenticated
  using (public.inventory_manager_access(company_id))
  with check (public.inventory_manager_access(company_id));
create policy inventory_locations_inventory_reader
  on public.inventory_locations for select to authenticated
  using (public.inventory_reader_for_branch(company_id, branch_id));
create policy inventory_locations_inventory_manager_write
  on public.inventory_locations for all to authenticated
  using (public.inventory_manager_access(company_id))
  with check (public.inventory_manager_access(company_id));
create policy inventory_writeoffs_inventory_manager_write
  on public.inventory_writeoffs for all to authenticated
  using (public.inventory_manager_access(company_id))
  with check (public.inventory_manager_access(company_id));

revoke insert, update, delete, truncate, references, trigger on public.inventory_stock from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.inventory_movements from anon, authenticated;
grant select on public.inventory_stock, public.inventory_movements to authenticated;

create or replace function private.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  delta numeric(14,3);
  current_quantity numeric(14,3);
  current_cost numeric(14,2);
  current_status text;
  next_cost numeric(14,2);
  next_status text;
  resolved_kind text;
begin
  if nullif(btrim(new.reference), '') is null then
    raise exception 'El movimiento requiere una referencia o documento';
  end if;
  if new.unit_cost < 0 then
    raise exception 'El costo unitario no puede ser negativo';
  end if;
  if new.movement_type = 'transfer' and new.quantity <> 0 then
    raise exception 'Un traslado no modifica la cantidad';
  end if;
  if new.movement_type <> 'transfer' and new.quantity <= 0 then
    raise exception 'La cantidad del movimiento debe ser mayor que cero';
  end if;

  select stock.quantity, stock.unit_cost, stock.valuation_status
    into current_quantity, current_cost, current_status
  from public.inventory_stock stock
  join public.inventory_items item on item.id = stock.item_id and item.company_id = stock.company_id
  join public.branches branch on branch.id = stock.branch_id and branch.company_id = stock.company_id
  where stock.id = new.stock_id
    and stock.company_id = new.company_id
    and stock.branch_id = new.branch_id
  for update of stock;

  if not found then
    raise exception 'El movimiento no corresponde a una existencia de la empresa y sede seleccionadas';
  end if;

  if new.project_id is not null and not exists (
    select 1 from public.projects project
    where project.id = new.project_id and project.company_id = new.company_id
  ) then
    raise exception 'La obra no pertenece a la empresa del movimiento';
  end if;

  delta := case new.movement_type
    when 'entry' then new.quantity
    when 'adjustment_in' then new.quantity
    when 'transfer' then 0
    else -new.quantity
  end;

  if current_quantity + delta < 0 then
    raise exception 'No hay existencias suficientes para registrar el movimiento';
  end if;

  next_cost := current_cost;
  next_status := current_status;
  if new.movement_type = 'entry' and new.unit_cost > 0 then
    next_cost := case
      when current_quantity <= 0 or current_status <> 'confirmed' or current_cost <= 0 then new.unit_cost
      else round(((current_quantity * current_cost) + (new.quantity * new.unit_cost)) / (current_quantity + new.quantity), 2)
    end;
    next_status := 'confirmed';
  end if;

  -- El origen se conserva aunque la función que escribe el movimiento sea
  -- antigua. Los documentos del sistema tienen prefijos estables.
  resolved_kind := coalesce(nullif(btrim(new.operation_kind), ''), case
    when new.reference like 'CONTEO-%' then 'count'
    when new.reference like 'COMPRA-%' then 'purchase'
    when new.reference like 'VALE-%' then 'dispatch'
    when new.reference like 'DOT-%' then 'dispatch'
    when new.reference like 'BAJA-%' then 'writeoff'
    when new.reference like 'DEV-%' then 'return'
    when new.reference like 'TRASLADO-%' then 'transfer'
    when new.reference like 'ING-APERTURA-%' then 'opening'
    when new.movement_type = 'entry' then 'entry'
    when new.movement_type = 'exit' then 'exit'
    when new.movement_type = 'transfer' then 'transfer'
    else 'adjustment'
  end);
  if resolved_kind not in ('entry', 'exit', 'adjustment', 'return', 'transfer', 'opening', 'count', 'purchase', 'dispatch', 'writeoff', 'loan') then
    raise exception 'Tipo operativo de movimiento no válido';
  end if;

  new.created_by := coalesce(new.created_by, auth.uid());
  new.occurred_at := coalesce(new.occurred_at, now());
  new.operation_kind := resolved_kind;
  new.quantity_before := coalesce(new.quantity_before, current_quantity);
  new.quantity_after := current_quantity + delta;

  update public.inventory_stock
     set quantity = new.quantity_after,
         unit_cost = next_cost,
         valuation_status = next_status
   where id = new.stock_id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    new.company_id,
    new.branch_id,
    new.created_by,
    'inventory_movement',
    new.id,
    'registered',
    jsonb_build_object('quantity', current_quantity, 'unit_cost', current_cost),
    jsonb_build_object(
      'movement_type', new.movement_type,
      'operation_kind', new.operation_kind,
      'quantity', new.quantity,
      'quantity_before', new.quantity_before,
      'quantity_after', new.quantity_after,
      'unit_cost', new.unit_cost,
      'reference', new.reference,
      'project_id', new.project_id,
      'request_id', new.client_request_id
    )
  );

  return new;
end;
$$;

create or replace function public.register_inventory_movement(
  p_stock_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reference text,
  p_project_id uuid default null,
  p_responsible_name text default null,
  p_notes text default null,
  p_operation_kind text default null,
  p_client_request_id uuid default null
)
returns table(
  movement_id uuid,
  quantity_before numeric,
  quantity_after numeric,
  unit_cost numeric,
  occurred_at timestamptz,
  operation_kind text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  stock_row public.inventory_stock%rowtype;
  saved_row public.inventory_movements%rowtype;
  resolved_cost numeric(14,2);
  resolved_kind text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para registrar movimientos';
  end if;

  select * into stock_row from public.inventory_stock where id = p_stock_id for update;
  if not found then
    raise exception 'La existencia seleccionada no existe';
  end if;
  if not private.inventory_can_manage_branch(stock_row.company_id, stock_row.branch_id) then
    raise exception 'No tienes permiso para registrar movimientos en esta sede';
  end if;

  if p_client_request_id is not null then
    select * into saved_row
    from public.inventory_movements movement
    where movement.company_id = stock_row.company_id
      and movement.client_request_id = p_client_request_id;
    if found then
      return query select saved_row.id, saved_row.quantity_before, saved_row.quantity_after,
        saved_row.unit_cost, saved_row.occurred_at, saved_row.operation_kind;
      return;
    end if;
  end if;

  if p_movement_type not in ('entry', 'exit', 'adjustment_in', 'adjustment_out') then
    raise exception 'Usa la operación de traslado para cambiar una ubicación';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  resolved_kind := coalesce(nullif(btrim(p_operation_kind), ''), case
    when p_movement_type = 'entry' then 'entry'
    when p_movement_type = 'exit' then 'exit'
    else 'adjustment'
  end);
  if (p_movement_type = 'entry' and resolved_kind not in ('entry', 'return'))
     or (p_movement_type = 'exit' and resolved_kind <> 'exit')
     or (p_movement_type in ('adjustment_in', 'adjustment_out') and resolved_kind <> 'adjustment') then
    raise exception 'El tipo operativo no corresponde al movimiento';
  end if;

  resolved_cost := coalesce(p_unit_cost, stock_row.unit_cost, 0);
  if resolved_cost < 0 then
    raise exception 'El costo unitario no puede ser negativo';
  end if;

  insert into public.inventory_movements(
    stock_id, company_id, branch_id, project_id, movement_type, quantity,
    unit_cost, reference, notes, responsible_name, occurred_at, created_by,
    operation_kind, client_request_id
  ) values (
    stock_row.id, stock_row.company_id, stock_row.branch_id, p_project_id,
    p_movement_type, p_quantity, resolved_cost, btrim(p_reference),
    nullif(btrim(p_notes), ''), nullif(btrim(p_responsible_name), ''), now(), auth.uid(),
    resolved_kind, p_client_request_id
  ) returning * into saved_row;

  return query select saved_row.id, saved_row.quantity_before, saved_row.quantity_after,
    saved_row.unit_cost, saved_row.occurred_at, saved_row.operation_kind;
end;
$$;

create or replace function public.relocate_inventory_stock(
  p_stock_id uuid,
  p_destination text,
  p_reference text,
  p_reason text default null,
  p_responsible_name text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  stock_row public.inventory_stock%rowtype;
  movement_id uuid;
  origin text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para trasladar existencias'; end if;
  if nullif(btrim(p_destination), '') is null then raise exception 'La ubicación destino es obligatoria'; end if;
  if nullif(btrim(p_reference), '') is null then raise exception 'El traslado requiere una referencia'; end if;

  select * into stock_row from public.inventory_stock where id = p_stock_id for update;
  if not found then raise exception 'La existencia seleccionada no existe'; end if;
  if not private.inventory_can_manage_branch(stock_row.company_id, stock_row.branch_id) then
    raise exception 'No tienes permiso para trasladar existencias en esta sede';
  end if;

  if p_client_request_id is not null then
    select id into movement_id from public.inventory_movements movement
    where movement.stock_id = stock_row.id and movement.company_id = stock_row.company_id
      and movement.client_request_id = p_client_request_id;
    if found then return movement_id; end if;
  end if;

  origin := coalesce(stock_row.location, 'Sin ubicación');
  if btrim(p_destination) = origin then raise exception 'La ubicación destino debe ser diferente de la actual'; end if;

  insert into public.inventory_movements(
    stock_id, company_id, branch_id, movement_type, quantity, unit_cost, reference,
    notes, responsible_name, occurred_at, created_by, operation_kind, client_request_id
  ) values (
    stock_row.id, stock_row.company_id, stock_row.branch_id, 'transfer', 0,
    stock_row.unit_cost, btrim(p_reference),
    concat_ws(' ', nullif(btrim(p_reason), ''), 'Origen:', origin, 'Destino:', btrim(p_destination)),
    nullif(btrim(p_responsible_name), ''), now(), auth.uid(), 'transfer', p_client_request_id
  ) returning id into movement_id;

  update public.inventory_stock set location = btrim(p_destination) where id = stock_row.id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    stock_row.company_id, stock_row.branch_id, auth.uid(), 'inventory_stock', stock_row.id, 'relocated',
    jsonb_build_object('location', origin),
    jsonb_build_object('location', btrim(p_destination), 'movement_id', movement_id, 'reference', btrim(p_reference))
  );

  return movement_id;
end;
$$;

create or replace function public.update_inventory_minimum(
  p_stock_id uuid,
  p_minimum_quantity numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  stock_row public.inventory_stock%rowtype;
  resolved_minimum numeric(14,3);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para actualizar el mínimo'; end if;
  if p_minimum_quantity is not null and p_minimum_quantity < 0 then
    raise exception 'El stock mínimo no puede ser negativo';
  end if;

  select * into stock_row from public.inventory_stock where id = p_stock_id for update;
  if not found then raise exception 'La existencia seleccionada no existe'; end if;
  if not private.inventory_can_manage_branch(stock_row.company_id, stock_row.branch_id) then
    raise exception 'No tienes permiso para actualizar el mínimo de esta sede';
  end if;

  resolved_minimum := p_minimum_quantity;
  update public.inventory_stock set minimum_quantity = resolved_minimum where id = stock_row.id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    stock_row.company_id, stock_row.branch_id, auth.uid(), 'inventory_stock', stock_row.id, 'minimum_updated',
    jsonb_build_object('minimum_quantity', stock_row.minimum_quantity),
    jsonb_build_object('minimum_quantity', resolved_minimum)
  );

  return resolved_minimum;
end;
$$;

create or replace function public.create_inventory_item_with_opening_balance(
  p_company_id uuid, p_branch_id uuid, p_sku text, p_name text, p_category text,
  p_brand text, p_unit text, p_notes text, p_inventory_group text, p_location text,
  p_minimum_quantity numeric, p_unit_cost numeric, p_quantity numeric, p_purchase_unit text,
  p_units_per_purchase numeric, p_purchase_unit_cost numeric, p_technical_reference text,
  p_model text, p_serial_number text, p_acquired_at date, p_warranty_until date,
  p_asset_condition text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  item_id uuid;
  stock_id uuid;
  opening_reference text;
begin
  if auth.uid() is null or not private.inventory_can_manage_branch(p_company_id, p_branch_id) then
    raise exception 'No autorizado para crear artículos de inventario en esta sede';
  end if;
  if nullif(btrim(p_name), '') is null or nullif(btrim(p_unit), '') is null then
    raise exception 'El nombre y la unidad de consumo son obligatorios';
  end if;
  if p_inventory_group not in ('bodega', 'dotacion', 'trabajadores') then
    raise exception 'Grupo de inventario no válido';
  end if;
  if coalesce(p_quantity, 0) < 0 or coalesce(p_unit_cost, 0) < 0
     or (p_minimum_quantity is not null and p_minimum_quantity < 0)
     or (p_units_per_purchase is not null and p_units_per_purchase <= 0)
     or (p_purchase_unit_cost is not null and p_purchase_unit_cost < 0) then
    raise exception 'Las cantidades y costos deben ser válidos y no negativos';
  end if;
  if nullif(btrim(p_sku), '') is not null and exists (
    select 1 from public.inventory_items item
    where item.company_id = p_company_id
      and lower(btrim(item.sku)) = lower(btrim(p_sku))
  ) then
    raise exception 'Ya existe un artículo con ese SKU en la empresa';
  end if;

  insert into public.inventory_items(
    company_id, sku, name, category, brand, unit, notes, technical_reference, model,
    serial_number, acquired_at, warranty_until, asset_condition, purchase_unit,
    units_per_purchase, purchase_unit_cost
  ) values (
    p_company_id, nullif(btrim(p_sku), ''), btrim(p_name), nullif(btrim(p_category), ''),
    nullif(btrim(p_brand), ''), btrim(p_unit), nullif(btrim(p_notes), ''),
    nullif(btrim(p_technical_reference), ''), nullif(btrim(p_model), ''),
    nullif(btrim(p_serial_number), ''), p_acquired_at, p_warranty_until,
    nullif(btrim(p_asset_condition), ''), nullif(btrim(p_purchase_unit), ''),
    p_units_per_purchase, p_purchase_unit_cost
  ) returning id into item_id;

  insert into public.inventory_stock(
    item_id, company_id, branch_id, inventory_group, location, quantity,
    minimum_quantity, unit_cost, valuation_status
  ) values (
    item_id, p_company_id, p_branch_id, p_inventory_group, nullif(btrim(p_location), ''), 0,
    p_minimum_quantity, coalesce(p_unit_cost, 0),
    case when coalesce(p_unit_cost, 0) = 0 then 'pending' else 'confirmed' end
  ) returning id into stock_id;

  if coalesce(p_quantity, 0) > 0 then
    opening_reference := 'ING-APERTURA-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || left(stock_id::text, 8);
    insert into public.inventory_movements(
      stock_id, company_id, branch_id, movement_type, quantity, reference, notes,
      unit_cost, created_by, operation_kind
    ) values (
      stock_id, p_company_id, p_branch_id, 'entry', p_quantity, opening_reference,
      'Entrada inicial al crear artículo', coalesce(p_unit_cost, 0), auth.uid(), 'opening'
    );
  end if;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    p_company_id, p_branch_id, auth.uid(), 'inventory_item', item_id, 'created',
    jsonb_build_object('stock_id', stock_id, 'sku', nullif(btrim(p_sku), ''), 'name', btrim(p_name))
  );

  return stock_id;
end;
$$;

-- El préstamo de herramientas también debe pasar por el Kardex. Antes este
-- trigger cambiaba la cantidad de la existencia sin dejar movimiento; ahora
-- inserta una salida/devolución y deja que el único trigger de movimientos
-- actualice el saldo.
create or replace function private.apply_tool_loan_stock()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  loan_stock uuid;
  stock_company uuid;
  stock_branch uuid;
  stock_quantity numeric(14,3);
  stock_cost numeric(14,2);
  tool_label text;
  old_state text;
  new_state text;
  loan_code text;
  loan_project uuid;
  worker text;
  movement_kind public.inventory_movement_type;
  movement_operation text;
  movement_reference text;
  movement_notes text;
begin
  loan_stock := coalesce(new.stock_id, old.stock_id);
  if loan_stock is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  old_state := case when tg_op in ('UPDATE', 'DELETE') then old.status::text else null end;
  new_state := case when tg_op in ('INSERT', 'UPDATE') then new.status::text else null end;
  if new_state is not distinct from old_state then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select stock.company_id, stock.branch_id, stock.quantity, stock.unit_cost, item.name
    into stock_company, stock_branch, stock_quantity, stock_cost, tool_label
  from public.inventory_stock stock
  join public.inventory_items item on item.id = stock.item_id and item.company_id = stock.company_id
  where stock.id = loan_stock
  for update of stock;
  if not found then
    raise exception 'El préstamo no corresponde a una existencia válida';
  end if;

  loan_code := coalesce(new.code, old.code, 'PRESTAMO-' || coalesce(new.id, old.id)::text);
  loan_project := coalesce(new.project_id, old.project_id);
  worker := coalesce(new.worker_name, old.worker_name);

  if new_state = 'active' then
    if stock_quantity <= 0 then
      raise exception 'No hay unidades disponibles de %', coalesce(tool_label, 'la herramienta');
    end if;
    movement_kind := 'exit';
    movement_operation := 'loan';
    movement_reference := 'PRESTAMO-' || loan_code;
    movement_notes := 'Préstamo de herramienta a ' || coalesce(worker, 'trabajador');
  elsif old_state = 'active' and new_state is distinct from 'damaged' then
    movement_kind := 'entry';
    movement_operation := 'return';
    movement_reference := 'DEV-PRESTAMO-' || loan_code;
    movement_notes := 'Devolución/cancelación de préstamo de ' || coalesce(tool_label, 'herramienta');
  else
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into public.inventory_movements(
    stock_id, company_id, branch_id, project_id, movement_type, quantity,
    unit_cost, reference, notes, responsible_name, occurred_at, created_by,
    operation_kind
  ) values (
    loan_stock, stock_company, stock_branch, loan_project, movement_kind, 1,
    coalesce(stock_cost, 0), movement_reference, movement_notes, worker, now(), auth.uid(),
    movement_operation
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- La dotación usa el mismo Kardex y distingue una devolución de una entrega.
create or replace function public.issue_employee_dotacion(p_project_id uuid, p_employee_id uuid, p_delivery_type text, p_notes text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_delivery_id uuid;
  v_line jsonb;
  v_stock public.inventory_stock%rowtype;
  v_item public.inventory_items%rowtype;
  v_quantity numeric;
  v_movement_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id into v_company_id from public.projects where id = p_project_id;
  if not found then raise exception 'La obra no existe'; end if;
  if not private.inventory_manager_for(v_company_id) then raise exception 'No tienes permiso para entregar dotación'; end if;
  if p_delivery_type not in ('initial', 'replacement', 'return') then raise exception 'Tipo de entrega no válido'; end if;
  if not exists (
    select 1 from public.project_employees
    where project_id = p_project_id and employee_id = p_employee_id and company_id = v_company_id
  ) then
    raise exception 'El trabajador debe estar asignado a la obra antes de recibir dotación';
  end if;
  if coalesce(jsonb_typeof(p_lines), '') <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Agrega al menos un artículo de dotación';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text, 0));
  insert into public.employee_dotacion_deliveries(company_id, project_id, employee_id, delivery_type, reference, notes, delivered_by)
  values (v_company_id, p_project_id, p_employee_id, p_delivery_type, 'DOT-' || upper(substr(gen_random_uuid()::text, 1, 8)), coalesce(trim(p_notes), ''), auth.uid())
  returning id into v_delivery_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_quantity := nullif(v_line->>'quantity', '')::numeric;
    if v_quantity is null or v_quantity <= 0 then raise exception 'Cada cantidad debe ser mayor que cero'; end if;
    select * into v_stock from public.inventory_stock
    where id = (v_line->>'stock_id')::uuid and company_id = v_company_id
    for update;
    if not found or v_stock.inventory_group <> 'dotacion' then
      raise exception 'El artículo seleccionado no es una existencia de dotación válida';
    end if;
    if p_delivery_type <> 'return' and v_stock.quantity < v_quantity then
      raise exception 'Stock insuficiente para la entrega';
    end if;
    select * into v_item from public.inventory_items where id = v_stock.item_id;
    insert into public.inventory_movements(
      stock_id, company_id, branch_id, project_id, movement_type, quantity,
      unit_cost, reference, notes, occurred_at, created_by, responsible_name, operation_kind
    ) values (
      v_stock.id, v_company_id, v_stock.branch_id, p_project_id,
      case when p_delivery_type = 'return' then 'entry' else 'exit' end,
      v_quantity, v_stock.unit_cost,
      (select reference from public.employee_dotacion_deliveries where id = v_delivery_id),
      'Dotación para ' || coalesce(v_item.name, 'artículo'), now(), auth.uid(),
      (select full_name from public.employees where id = p_employee_id),
      case when p_delivery_type = 'return' then 'return' else 'dispatch' end
    ) returning id into v_movement_id;
    insert into public.employee_dotacion_delivery_lines(delivery_id, stock_id, item_name_snapshot, quantity, unit_cost, movement_id)
    values (v_delivery_id, v_stock.id, v_item.name, v_quantity, v_stock.unit_cost, v_movement_id);
  end loop;

  return v_delivery_id;
end;
$$;

revoke all on function public.register_inventory_movement(uuid, public.inventory_movement_type, numeric, numeric, text, uuid, text, text, text, uuid) from public, anon;
revoke all on function public.relocate_inventory_stock(uuid, text, text, text, text, uuid) from public, anon;
revoke all on function public.update_inventory_minimum(uuid, numeric) from public, anon;
revoke all on function public.create_inventory_item_with_opening_balance(uuid, uuid, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, numeric, numeric, text, text, text, date, date, text) from public, anon;
grant execute on function public.register_inventory_movement(uuid, public.inventory_movement_type, numeric, numeric, text, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.relocate_inventory_stock(uuid, text, text, text, text, uuid) to authenticated;
grant execute on function public.update_inventory_minimum(uuid, numeric) to authenticated;
grant execute on function public.create_inventory_item_with_opening_balance(uuid, uuid, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, numeric, numeric, text, text, text, date, date, text) to authenticated;
