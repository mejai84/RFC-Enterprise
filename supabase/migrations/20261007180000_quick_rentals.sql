-- ALQ-003 · Persistencia empresarial del alquiler rapido.
-- Las tablas `quick_rentals` y `quick_rental_attachments` estaban referenciadas por la
-- interfaz pero nunca se crearon en la base de datos: toda escritura fallaba en silencio.

create table if not exists public.quick_rentals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  code text not null,
  equipment_id text,
  equipment_name text not null,
  customer_name text not null,
  customer_phone text,
  customer_document text,
  pickup_at date not null,
  due_at date not null,
  returned_at date,
  daily_rate numeric(14, 2) not null default 0 check (daily_rate >= 0),
  deposit numeric(14, 2) not null default 0 check (deposit >= 0),
  extra_charge numeric(14, 2) not null default 0 check (extra_charge >= 0),
  status text not null default 'active' check (status in ('active', 'returned', 'overdue')),
  delivery_notes text,
  return_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_rentals_period check (due_at >= pickup_at),
  constraint quick_rentals_code_unique unique (company_id, code)
);

comment on table public.quick_rentals is
  'Alquiler rapido de equipos: entrega, devolucion pactada, tarifa y deposito (ADR-103).';

create index if not exists quick_rentals_company_created_idx
  on public.quick_rentals (company_id, created_at desc);

create index if not exists quick_rentals_active_idx
  on public.quick_rentals (company_id, status)
  where returned_at is null;

create table if not exists public.quick_rental_attachments (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.quick_rentals (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('id_document', 'equipment_photo', 'signature', 'other')),
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

comment on table public.quick_rental_attachments is
  'Adjuntos del alquiler rapido: cedula, fotos del equipo y firma de entrega (ADR-103).';

create index if not exists quick_rental_attachments_rental_idx
  on public.quick_rental_attachments (rental_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.quick_rentals enable row level security;
alter table public.quick_rental_attachments enable row level security;

drop policy if exists quick_rentals_member_read on public.quick_rentals;
create policy quick_rentals_member_read on public.quick_rentals
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.company_id = quick_rentals.company_id
  ));

drop policy if exists quick_rentals_manager_write on public.quick_rentals;
create policy quick_rentals_manager_write on public.quick_rentals
  for all to authenticated
  using (private.inventory_manager_for(company_id))
  with check (private.inventory_manager_for(company_id));

drop policy if exists quick_rental_attachments_member_read on public.quick_rental_attachments;
create policy quick_rental_attachments_member_read on public.quick_rental_attachments
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.company_id = quick_rental_attachments.company_id
  ));

drop policy if exists quick_rental_attachments_manager_write on public.quick_rental_attachments;
create policy quick_rental_attachments_manager_write on public.quick_rental_attachments
  for all to authenticated
  using (private.inventory_manager_for(company_id))
  with check (private.inventory_manager_for(company_id));