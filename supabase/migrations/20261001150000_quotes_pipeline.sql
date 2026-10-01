-- Migración: Módulo de Cotizaciones y Pipeline Comercial
-- Fecha: 2026-10-01
-- Descripción: Tablas para gestión de cotizaciones, solicitudes de clientes, flujo de estados y trazabilidad histórica.

-- 1. Tabla principal de Cotizaciones
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  code text not null,
  title text not null,
  client text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  email_origin text,
  status text not null default 'received' check (
    status in (
      'received',
      'in_review',
      'estimating',
      'sent',
      'awaiting_response',
      'revision_requested',
      'confirmed',
      'in_execution',
      'work_completed',
      'billing_pending',
      'closed',
      'lost'
    )
  ),
  responsible text not null,
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  received_at timestamptz not null default now(),
  deadline timestamptz,
  next_action text,
  project_id uuid references public.projects(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

-- 2. Índices de rendimiento
create index if not exists quotes_company_status_idx on public.quotes (company_id, status);
create index if not exists quotes_received_at_idx on public.quotes (company_id, received_at desc);

-- 3. Tabla de historial / trazabilidad de cambios de estado
create table if not exists public.quote_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by text not null,
  note text,
  changed_at timestamptz not null default now()
);

create index if not exists quote_history_quote_idx on public.quote_history (quote_id, changed_at desc);

-- 4. Seguridad Row-Level Security (RLS)
alter table public.quotes enable row level security;
alter table public.quote_history enable row level security;

-- Lectura para miembros autenticados de la compañía
create policy quotes_member_read on public.quotes
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.company_id = quotes.company_id
  ));

create policy quote_history_member_read on public.quote_history
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.company_id = quote_history.company_id
  ));

-- Inserción y actualización para administradores y líderes comerciales / operativos
create policy quotes_manager_insert on public.quotes
  for insert to authenticated
  with check (exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = quotes.company_id
      and r.code in ('administrator', 'inventory_manager', 'general_management')
  ));

create policy quotes_manager_update on public.quotes
  for update to authenticated
  using (exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = quotes.company_id
      and r.code in ('administrator', 'inventory_manager', 'general_management')
  ))
  with check (exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = quotes.company_id
      and r.code in ('administrator', 'inventory_manager', 'general_management')
  ));

create policy quote_history_manager_insert on public.quote_history
  for insert to authenticated
  with check (exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = quote_history.company_id
      and r.code in ('administrator', 'inventory_manager', 'general_management')
  ));

-- 5. Trigger de actualización automática
create trigger quotes_updated
  before update on public.quotes
  for each row
  execute function private.set_updated_at();
