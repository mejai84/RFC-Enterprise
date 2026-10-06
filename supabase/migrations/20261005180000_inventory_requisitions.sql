-- Requisiciones compartidas: obra -> almacén. La emisión se concentra en una
-- función transaccional para conservar empresa, proyecto y existencias coherentes.
do $$
begin
  create type public.inventory_requisition_status as enum (
    'submitted', 'approved', 'partially_dispatched', 'dispatched', 'rejected', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.inventory_requisitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  branch_id uuid references public.branches(id),
  project_id uuid not null references public.projects(id),
  request_year smallint not null,
  request_number integer not null,
  code text generated always as (
    'REQ-' || request_year::text || '-' || lpad(request_number::text, 4, '0')
  ) stored,
  status public.inventory_requisition_status not null default 'submitted',
  requested_by uuid not null references auth.users(id),
  requested_by_name text not null,
  needed_by date,
  notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  dispatched_by uuid references auth.users(id),
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, request_year, request_number)
);

create table if not exists public.inventory_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.inventory_requisitions(id) on delete cascade,
  stock_id uuid not null references public.inventory_stock(id),
  requested_quantity numeric(14,3) not null check (requested_quantity > 0),
  approved_quantity numeric(14,3),
  dispatched_quantity numeric(14,3) not null default 0 check (dispatched_quantity >= 0),
  unit_snapshot text not null,
  item_name_snapshot text not null,
  unit_cost_snapshot numeric(16,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  check (approved_quantity is null or approved_quantity >= 0),
  check (dispatched_quantity <= coalesce(approved_quantity, requested_quantity))
);

create index if not exists inventory_requisitions_company_status_created_idx
  on public.inventory_requisitions (company_id, status, created_at desc);
create index if not exists inventory_requisitions_project_created_idx
  on public.inventory_requisitions (project_id, created_at desc);
create index if not exists inventory_requisition_lines_requisition_idx
  on public.inventory_requisition_lines (requisition_id);

alter table public.inventory_requisitions enable row level security;
alter table public.inventory_requisition_lines enable row level security;

create or replace function private.requisition_requester_for(target_company uuid)
returns boolean
language sql stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = target_company
      and r.code in ('administrator', 'management', 'resident_engineer', 'foreman',
        'administrative_assistant', 'administrative_staff', 'welder', 'field_worker')
  )
$$;

create policy "requisitions_read_by_company_member"
on public.inventory_requisitions for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.company_id = inventory_requisitions.company_id
));

create policy "requisition_lines_read_by_company_member"
on public.inventory_requisition_lines for select to authenticated
using (exists (
  select 1 from public.inventory_requisitions r
  join public.user_roles ur on ur.company_id = r.company_id
  where r.id = inventory_requisition_lines.requisition_id
    and ur.user_id = (select auth.uid())
));

create or replace function public.create_inventory_requisition(
  target_project uuid,
  requester_name text,
  target_needed_by date default null,
  request_notes text default null,
  request_lines jsonb default '[]'::jsonb
)
returns table (requisition_id uuid, requisition_code text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_company uuid;
  target_branch uuid;
  next_number integer;
  created_id uuid;
  line jsonb;
  line_stock public.inventory_stock%rowtype;
  line_item public.inventory_items%rowtype;
begin
  select company_id, branch_id into target_company, target_branch
  from public.projects where id = target_project;
  if not found then raise exception 'La obra seleccionada no existe'; end if;
  if not private.requisition_requester_for(target_company) then
    raise exception 'No tienes permiso para crear requisiciones para esta empresa';
  end if;
  if nullif(trim(requester_name), '') is null then
    raise exception 'Indica quién solicita el material';
  end if;
  if jsonb_typeof(request_lines) <> 'array' or jsonb_array_length(request_lines) = 0 then
    raise exception 'Agrega al menos un material a la requisición';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_company::text, 0));
  select coalesce(max(request_number), 0) + 1 into next_number
  from public.inventory_requisitions
  where company_id = target_company and request_year = extract(year from current_date)::smallint;

  insert into public.inventory_requisitions (
    company_id, branch_id, project_id, request_year, request_number,
    requested_by, requested_by_name, needed_by, notes
  ) values (
    target_company, target_branch, target_project, extract(year from current_date)::smallint, next_number,
    auth.uid(), trim(requester_name), target_needed_by, nullif(trim(request_notes), '')
  ) returning id into created_id;

  for line in select value from jsonb_array_elements(request_lines)
  loop
    select * into line_stock from public.inventory_stock
    where id = (line->>'stock_id')::uuid and company_id = target_company;
    if not found then raise exception 'Uno de los artículos no pertenece a la empresa'; end if;
    select * into line_item from public.inventory_items where id = line_stock.item_id;
    insert into public.inventory_requisition_lines (
      requisition_id, stock_id, requested_quantity, unit_snapshot, item_name_snapshot, unit_cost_snapshot, notes
    ) values (
      created_id, line_stock.id, (line->>'quantity')::numeric, line_item.unit,
      line_item.name, line_stock.unit_cost, nullif(trim(line->>'notes'), '')
    );
  end loop;

  return query select r.id, r.code from public.inventory_requisitions r where r.id = created_id;
end;
$$;

revoke all on function public.create_inventory_requisition(uuid, text, date, text, jsonb) from public, anon;
grant execute on function public.create_inventory_requisition(uuid, text, date, text, jsonb) to authenticated;
