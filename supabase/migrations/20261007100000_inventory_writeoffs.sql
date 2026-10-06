-- Bajas de inventario por deterioro, daño, vencimiento o pérdida (INV-008).
-- La salida queda registrada como asiento auditable y el umbral de aprobación
-- se configura por empresa, nunca como constante en el código.

do $$
begin
  create type public.inventory_writeoff_reason as enum (
    'deterioro', 'daño', 'vencimiento', 'perdida', 'obsoleto'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_writeoff_status as enum (
    'draft', 'pending_approval', 'approved', 'rejected', 'applied'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.inventory_writeoff_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  approval_threshold numeric(14,2) not null default 5000000 check (approval_threshold >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_writeoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  branch_id uuid not null references public.branches(id),
  code text not null,
  stock_id uuid not null references public.inventory_stock(id),
  item_name text not null,
  unit text not null,
  reason public.inventory_writeoff_reason not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  total_value numeric(16,2) not null default 0 check (total_value >= 0),
  available_before numeric(14,3) not null default 0,
  status public.inventory_writeoff_status not null default 'draft',
  requires_approval boolean not null default false,
  evidence_paths text[] not null default '{}',
  notes text,
  requested_by uuid not null references auth.users(id),
  requested_by_name text not null,
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_by_name text,
  approved_at timestamptz,
  rejection_reason text,
  movement_id uuid references public.inventory_movements(id),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists inventory_writeoffs_company_status_created_idx
  on public.inventory_writeoffs (company_id, status, created_at desc);
create index if not exists inventory_writeoffs_stock_idx
  on public.inventory_writeoffs (stock_id, created_at desc);

alter table public.inventory_writeoffs enable row level security;
alter table public.inventory_writeoff_policies enable row level security;

drop policy if exists inventory_writeoffs_member_read on public.inventory_writeoffs;
create policy inventory_writeoffs_member_read on public.inventory_writeoffs
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = inventory_writeoffs.company_id
  ));

drop policy if exists inventory_writeoffs_manager_write on public.inventory_writeoffs;
create policy inventory_writeoffs_manager_write on public.inventory_writeoffs
  for all to authenticated
  using (private.inventory_manager_for(company_id))
  with check (private.inventory_manager_for(company_id));

drop policy if exists inventory_writeoff_policies_member_read on public.inventory_writeoff_policies;
create policy inventory_writeoff_policies_member_read on public.inventory_writeoff_policies
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = inventory_writeoff_policies.company_id
  ));

drop policy if exists inventory_writeoff_policies_admin_write on public.inventory_writeoff_policies;
create policy inventory_writeoff_policies_admin_write on public.inventory_writeoff_policies
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = inventory_writeoff_policies.company_id
      and r.code = 'administrator'
  ))
  with check (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = inventory_writeoff_policies.company_id
      and r.code = 'administrator'
  ));

create or replace function private.next_writeoff_code(target_company uuid)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  next_number integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('writeoff:' || target_company::text, 0));
  select coalesce(max((regexp_match(code, '-(\d+)$'))[1]::int), 0) + 1 into next_number
  from public.inventory_writeoffs
  where company_id = target_company and code like 'BAJA-' || extract(year from current_date)::text || '-%';
  return 'BAJA-' || extract(year from current_date)::text || '-' || lpad(next_number::text, 4, '0');
end;
$$;

-- Solicita la baja. Si el valor supera el umbral de la empresa, queda pendiente
-- de aprobación de un administrador; de lo contrario se aplica de inmediato.
create or replace function public.request_inventory_writeoff(
  target_company uuid,
  target_branch uuid,
  target_stock uuid,
  writeoff_reason text,
  writeoff_quantity numeric,
  writeoff_notes text default null,
  writeoff_evidence text[] default '{}'
)
returns table (writeoff_id uuid, writeoff_code text, writeoff_status text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_stock public.inventory_stock%rowtype;
  v_item public.inventory_items%rowtype;
  v_threshold numeric(14,2);
  v_code text;
  v_id uuid;
  v_total numeric(16,2);
  v_actor text;
  v_requires boolean;
  v_status public.inventory_writeoff_status;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para registrar bajas en esta empresa';
  end if;
  if writeoff_reason not in ('deterioro','daño','vencimiento','perdida','obsoleto') then
    raise exception 'Causa de baja no válida';
  end if;
  if writeoff_quantity is null or writeoff_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  select * into v_stock from public.inventory_stock
  where id = target_stock and company_id = target_company and branch_id = target_branch
  for update;
  if not found then raise exception 'La existencia no pertenece a esta empresa o sede'; end if;
  if v_stock.quantity < writeoff_quantity then
    raise exception 'No hay existencias suficientes para dar de baja % unidades', writeoff_quantity;
  end if;

  select * into v_item from public.inventory_items where id = v_stock.item_id;
  v_total := round(writeoff_quantity * v_stock.unit_cost, 2);
  v_code := private.next_writeoff_code(target_company);

  select coalesce(approval_threshold, 5000000) into v_threshold
  from public.inventory_writeoff_policies where company_id = target_company;
  if v_threshold is null then v_threshold := 5000000; end if;
  v_requires := v_total > v_threshold;
  v_status := case when v_requires then 'pending_approval'::public.inventory_writeoff_status
                   else 'approved'::public.inventory_writeoff_status end;

  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Usuario') into v_actor
  from public.profiles p where p.id = auth.uid();

  insert into public.inventory_writeoffs (
    company_id, branch_id, code, stock_id, item_name, unit, reason, quantity,
    unit_cost, total_value, available_before, status, requires_approval,
    evidence_paths, notes, requested_by, requested_by_name,
    approved_by, approved_by_name, approved_at
  ) values (
    target_company, target_branch, v_code, target_stock, v_item.name, v_item.unit,
    writeoff_reason::public.inventory_writeoff_reason, writeoff_quantity,
    v_stock.unit_cost, v_total, v_stock.quantity, v_status, v_requires,
    coalesce(writeoff_evidence, '{}'), nullif(trim(writeoff_notes), ''),
    auth.uid(), v_actor,
    case when v_requires then null else auth.uid() end,
    case when v_requires then null else v_actor end,
    case when v_requires then null else now() end
  ) returning id into v_id;

  return query select v_id, v_code, v_status::text;
end;
$$;

revoke all on function public.request_inventory_writeoff(uuid, uuid, uuid, text, numeric, text, text[]) from public, anon;
grant execute on function public.request_inventory_writeoff(uuid, uuid, uuid, text, numeric, text, text[]) to authenticated;

-- Aprueba y aplica la baja: genera el asiento de salida y descuenta la existencia
-- mediante el mismo disparador del Kardex, sin dejar el saldo en negativo.
create or replace function public.apply_inventory_writeoff(target_writeoff uuid)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_writeoff public.inventory_writeoffs%rowtype;
  v_role text;
  v_movement_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select * into v_writeoff from public.inventory_writeoffs
  where id = target_writeoff and company_id = (select company_id from user_roles where user_id = auth.uid() limit 1)
  for update;
  if not found then raise exception 'Baja no encontrada para su empresa'; end if;
  if v_writeoff.status = 'applied' then raise exception 'La baja ya fue aplicada'; end if;
  if v_writeoff.status = 'rejected' then raise exception 'La baja fue rechazada'; end if;

  select r.code into v_role from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid() and ur.company_id = v_writeoff.company_id
  limit 1;

  if v_writeoff.requires_approval and v_role <> 'administrator' then
    raise exception 'Esta baja supera el umbral y requiere aprobación de un administrador';
  end if;
  if not exists (
    select 1 from public.inventory_stock
    where id = v_writeoff.stock_id and quantity >= v_writeoff.quantity
  ) then
    raise exception 'Las existencias actuales no cubren la cantidad de la baja';
  end if;

  insert into public.inventory_movements (
    stock_id, company_id, branch_id, movement_type, quantity, unit_cost, reference, notes
  ) values (
    v_writeoff.stock_id, v_writeoff.company_id, v_writeoff.branch_id,
    'adjustment_out', v_writeoff.quantity, v_writeoff.unit_cost, v_writeoff.code,
    'Baja por ' || v_writeoff.reason::text || coalesce(': ' || v_writeoff.notes, '')
  ) returning id into v_movement_id;

  update public.inventory_writeoffs
  set status = 'applied', movement_id = v_movement_id, applied_at = now(),
      approved_by = coalesce(approved_by, auth.uid()),
      approved_by_name = coalesce(approved_by_name, v_writeoff.requested_by_name),
      approved_at = coalesce(approved_at, now()),
      updated_at = now()
  where id = target_writeoff;

  return v_writeoff.code;
end;
$$;

revoke all on function public.apply_inventory_writeoff(uuid) from public, anon;
grant execute on function public.apply_inventory_writeoff(uuid) to authenticated;

-- Rechaza una baja pendiente de aprobación.
create or replace function public.reject_inventory_writeoff(target_writeoff uuid, reject_reason text)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_code text;
  v_role text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if nullif(trim(reject_reason), '') is null then raise exception 'Indica el motivo del rechazo'; end if;

  select w.code into v_code
  from public.inventory_writeoffs w
  where w.id = target_writeoff and w.company_id = (select company_id from user_roles where user_id = auth.uid() limit 1)
  for update;
  if v_code is null then raise exception 'Baja no encontrada para su empresa'; end if;

  select r.code into v_role from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
    and ur.company_id = (select company_id from user_roles where user_id = auth.uid() limit 1)
  limit 1;
  if v_role <> 'administrator' then
    raise exception 'Solo un administrador puede rechazar una baja';
  end if;

  update public.inventory_writeoffs
  set status = 'rejected', rejection_reason = trim(reject_reason), updated_at = now()
  where id = target_writeoff;

  return v_code;
end;
$$;

revoke all on function public.reject_inventory_writeoff(uuid, text) from public, anon;
grant execute on function public.reject_inventory_writeoff(uuid, text) to authenticated;

-- Umbral configurable por empresa.
create or replace function public.set_writeoff_threshold(target_company uuid, new_threshold numeric)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if new_threshold is null or new_threshold < 0 then raise exception 'Umbral inválido'; end if;
  if not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and ur.company_id = target_company and r.code = 'administrator'
  ) then
    raise exception 'Solo un administrador puede cambiar el umbral de aprobación';
  end if;

  insert into public.inventory_writeoff_policies (company_id, approval_threshold, updated_at)
  values (target_company, new_threshold, now())
  on conflict (company_id) do update
    set approval_threshold = excluded.approval_threshold, updated_at = now();
end;
$$;

revoke all on function public.set_writeoff_threshold(uuid, numeric) from public, anon;
grant execute on function public.set_writeoff_threshold(uuid, numeric) to authenticated;
