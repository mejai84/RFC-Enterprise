-- Ejecutar en Supabase SQL Editor. Registra el calendario operativo de cada obra.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  code text not null,
  name text not null,
  client text not null,
  location text,
  material_budget numeric(14,2) not null check (material_budget >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'on_hold', 'completed')),
  start_date date not null,
  estimated_end_date date not null,
  actual_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  check (estimated_end_date >= start_date),
  check (actual_end_date is null or actual_end_date >= start_date)
);

create index if not exists projects_company_status_end_idx on public.projects (company_id, status, estimated_end_date);
alter table public.projects enable row level security;
create policy projects_member_read on public.projects for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = projects.company_id));
create policy projects_manager_insert on public.projects for insert to authenticated with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = projects.company_id and r.code in ('administrator', 'inventory_manager')));
create policy projects_manager_update on public.projects for update to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = projects.company_id and r.code in ('administrator', 'inventory_manager'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = projects.company_id and r.code in ('administrator', 'inventory_manager')));
create trigger projects_updated before update on public.projects for each row execute function private.set_updated_at();
