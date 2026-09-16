-- RFC Enterprise: operaciones auditables de inventario, compras y conteos.
-- Ejecutar DESPUÉS de initial_erp_schema.sql y 20260916_projects_schedule.sql.
-- Cada tabla pública queda protegida por RLS; no requiere service_role en el navegador.

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  warehouse text not null, aisle text, shelf text, level text, bin text,
  -- `concat_ws` is STABLE, not IMMUTABLE; a generated expression must be immutable.
  code text generated always as (warehouse || coalesce('-' || aisle, '') || coalesce('-' || shelf, '') || coalesce('-' || level, '') || coalesce('-' || bin, '')) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (branch_id, warehouse, aisle, shelf, level, bin)
);

alter table public.inventory_stock add column if not exists location_id uuid references public.inventory_locations(id) on delete restrict;
alter table public.inventory_stock add column if not exists reorder_quantity numeric(14,3);
alter table public.inventory_stock add column if not exists unit_cost numeric(14,2) not null default 0 check(unit_cost >= 0);
create index if not exists inventory_stock_location_idx on public.inventory_stock(location_id);
create index if not exists inventory_stock_reorder_idx on public.inventory_stock(company_id, branch_id) where minimum_quantity is not null;

alter table public.inventory_movements add column if not exists project_id uuid references public.projects(id) on delete restrict;
alter table public.inventory_movements add column if not exists unit_cost numeric(14,2) not null default 0 check(unit_cost >= 0);
alter table public.inventory_movements add column if not exists supplier_name text;
alter table public.inventory_movements add column if not exists invoice_number text;
alter table public.inventory_movements add column if not exists count_session_id uuid;
create index if not exists inventory_movements_project_date_idx on public.inventory_movements(project_id, occurred_at desc) where project_id is not null;
create index if not exists inventory_movements_company_date_idx on public.inventory_movements(company_id, occurred_at desc);

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), branch_id uuid not null references public.branches(id),
  supplier_name text not null, invoice_number text not null, received_at timestamptz not null default now(),
  notes text, created_by uuid references public.profiles(id) on delete set null default auth.uid(), created_at timestamptz not null default now(),
  unique(company_id, supplier_name, invoice_number)
);
create table if not exists public.physical_counts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), branch_id uuid not null references public.branches(id),
  status text not null default 'draft' check(status in ('draft','submitted','approved','cancelled')),
  reason text not null, counted_at timestamptz not null default now(), counted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles(id) on delete set null, approved_at timestamptz, created_at timestamptz not null default now(),
  check((status <> 'approved') or (approved_by is not null and approved_at is not null))
);
create table if not exists public.physical_count_lines (
  id uuid primary key default gen_random_uuid(), count_id uuid not null references public.physical_counts(id) on delete cascade,
  stock_id uuid not null references public.inventory_stock(id) on delete restrict, system_quantity numeric(14,3) not null check(system_quantity >= 0),
  counted_quantity numeric(14,3) not null check(counted_quantity >= 0), reason text not null, unique(count_id, stock_id)
);
create table if not exists public.project_budget_adjustments (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  company_id uuid not null references public.companies(id), amount numeric(14,2) not null check(amount <> 0), reason text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(), created_at timestamptz not null default now()
);
create index if not exists project_budget_adjustments_project_date_idx on public.project_budget_adjustments(project_id, created_at desc);

alter table public.inventory_locations enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.physical_counts enable row level security;
alter table public.physical_count_lines enable row level security;
alter table public.project_budget_adjustments enable row level security;

create or replace function private.inventory_manager_for(target_company uuid) returns boolean language sql stable security invoker set search_path=public as $$
  select exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = target_company and r.code in ('administrator','inventory_manager'))
$$;
create or replace function private.project_is_dispatchable(target_project uuid, target_company uuid) returns boolean language sql stable security invoker set search_path=public as $$
  select exists (select 1 from public.projects p where p.id = target_project and p.company_id = target_company and p.status = 'active')
$$;
create or replace function private.apply_inventory_movement() returns trigger language plpgsql set search_path=public as $$
declare delta numeric(14,3); current_qty numeric(14,3);
begin
  if new.movement_type = 'exit' and (new.project_id is null or not private.project_is_dispatchable(new.project_id, new.company_id)) then
    raise exception 'La salida debe dirigirse a una obra activa de la misma empresa';
  end if;
  select quantity into current_qty from public.inventory_stock where id = new.stock_id and company_id = new.company_id and branch_id = new.branch_id for update;
  if not found then raise exception 'El movimiento no corresponde a la existencia seleccionada'; end if;
  delta := case new.movement_type when 'entry' then new.quantity when 'adjustment_in' then new.quantity else -new.quantity end;
  if current_qty + delta < 0 then raise exception 'Existencias insuficientes para registrar la salida'; end if;
  update public.inventory_stock set quantity = current_qty + delta, unit_cost = case when new.movement_type = 'entry' and new.unit_cost > 0 then new.unit_cost else unit_cost end where id = new.stock_id;
  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, after_data) values (new.company_id, new.branch_id, auth.uid(), 'inventory_movement', new.id, 'created', jsonb_build_object('type',new.movement_type,'quantity',new.quantity,'reference',new.reference,'project_id',new.project_id));
  return new;
end;
$$;

create policy inventory_locations_member_read on public.inventory_locations for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.company_id=inventory_locations.company_id));
create policy inventory_locations_manager_write on public.inventory_locations for all to authenticated using (private.inventory_manager_for(company_id)) with check (private.inventory_manager_for(company_id));
create policy purchase_receipts_member_read on public.purchase_receipts for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.company_id=purchase_receipts.company_id));
create policy purchase_receipts_manager_write on public.purchase_receipts for all to authenticated using (private.inventory_manager_for(company_id)) with check (private.inventory_manager_for(company_id));
create policy physical_counts_member_read on public.physical_counts for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.company_id=physical_counts.company_id));
create policy physical_counts_manager_write on public.physical_counts for all to authenticated using (private.inventory_manager_for(company_id)) with check (private.inventory_manager_for(company_id));
create policy physical_count_lines_member_read on public.physical_count_lines for select to authenticated using (exists (select 1 from public.physical_counts c join public.user_roles ur on ur.company_id=c.company_id where c.id=physical_count_lines.count_id and ur.user_id=(select auth.uid())));
create policy physical_count_lines_manager_write on public.physical_count_lines for all to authenticated using (exists (select 1 from public.physical_counts c where c.id=physical_count_lines.count_id and private.inventory_manager_for(c.company_id))) with check (exists (select 1 from public.physical_counts c where c.id=physical_count_lines.count_id and private.inventory_manager_for(c.company_id)));
create policy project_budget_adjustments_member_read on public.project_budget_adjustments for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.company_id=project_budget_adjustments.company_id));
create policy project_budget_adjustments_manager_insert on public.project_budget_adjustments for insert to authenticated with check (private.inventory_manager_for(company_id));

drop policy if exists movements_manager_insert on public.inventory_movements;
create policy movements_manager_insert on public.inventory_movements for insert to authenticated with check (private.inventory_manager_for(company_id));
