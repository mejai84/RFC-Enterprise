-- Catálogo salarial de mano de obra disponible para los APU.
create table public.apu_labor_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  activity_type text not null check (activity_type in ('propias', 'no_propias')),
  specialty text not null,
  specialty_label text not null,
  level smallint not null check (level between 1 and 6),
  daily_basic_salary numeric(14,2) not null check (daily_basic_salary >= 0),
  transport_allowance numeric(14,2) not null default 0 check (transport_allowance >= 0),
  food_allowance numeric(14,2) not null default 0 check (food_allowance >= 0),
  non_salary_allowance numeric(14,2) not null default 0 check (non_salary_allowance >= 0),
  total_daily_rate numeric(14,2) not null check (total_daily_rate >= 0),
  valid_from date not null,
  valid_to date not null check (valid_to >= valid_from),
  source_document text not null,
  summary text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code, valid_from)
);

create index apu_labor_positions_company_active_name_idx
  on public.apu_labor_positions (company_id, is_active, name);

create index apu_labor_positions_company_filters_idx
  on public.apu_labor_positions (company_id, activity_type, specialty, level)
  where is_active;

alter table public.apu_labor_positions enable row level security;

create policy apu_labor_positions_member_read
  on public.apu_labor_positions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_labor_positions.company_id
    )
  );

create policy apu_labor_positions_manager_insert
  on public.apu_labor_positions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_labor_positions.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

create policy apu_labor_positions_manager_update
  on public.apu_labor_positions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_labor_positions.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_labor_positions.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

create policy apu_labor_positions_manager_delete
  on public.apu_labor_positions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = apu_labor_positions.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

grant select, insert, update, delete on table public.apu_labor_positions to authenticated;

create trigger apu_labor_positions_updated
  before update on public.apu_labor_positions
  for each row
  execute function private.set_updated_at();
