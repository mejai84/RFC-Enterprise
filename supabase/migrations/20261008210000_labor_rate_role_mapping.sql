-- Connects the salary table selected in a quote with the APU job catalog.
-- A role inherits the cost of its level from the selected salary table.

create table if not exists public.labor_rate_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  labor_rate_table_id uuid not null,
  labor_rate_entry_id uuid not null,
  code text not null,
  name text not null,
  specialty text not null default 'general',
  specialty_label text not null default 'General',
  summary text not null default '',
  receives_hotel boolean not null default false,
  receives_operational_transport boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (labor_rate_table_id, code),
  foreign key (labor_rate_table_id, company_id)
    references public.labor_rate_tables(id, company_id) on delete cascade,
  foreign key (labor_rate_entry_id)
    references public.labor_rate_entries(id) on delete restrict
);

create index if not exists labor_rate_roles_table_active_name_idx
  on public.labor_rate_roles (labor_rate_table_id, is_active, name);

alter table public.labor_rate_roles enable row level security;

create policy labor_rate_roles_member_read on public.labor_rate_roles
  for select to authenticated using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid()) and ur.company_id = labor_rate_roles.company_id
    )
  );

create policy labor_rate_roles_manager_write on public.labor_rate_roles
  for all to authenticated using (
    exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = labor_rate_roles.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  ) with check (
    exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.company_id = labor_rate_roles.company_id
        and r.code in ('administrator', 'resident_engineer', 'general_management')
    )
  );

grant select, insert, update, delete on public.labor_rate_roles to authenticated;

create trigger labor_rate_roles_updated
  before update on public.labor_rate_roles
  for each row execute function private.set_updated_at();

-- Existing RFC roles are copied into the two OCENSA tables. Their cost is read
-- from the entry with the corresponding level, never from the static seed.
insert into public.labor_rate_roles (
  company_id, labor_rate_table_id, labor_rate_entry_id, code, name,
  specialty, specialty_label, summary, receives_hotel, receives_operational_transport
)
select
  p.company_id, t.id, e.id, p.code, p.name, p.specialty, p.specialty_label, p.summary,
  (p.name ilike '%capataz%' or p.name ilike '%conductor%'),
  (p.name ilike '%capataz%' or p.name ilike '%conductor%')
from public.apu_labor_positions p
join public.labor_rate_tables t
  on t.company_id = p.company_id
 and t.activity_type = p.activity_type
 and t.client_name = 'OCENSA'
join public.labor_rate_entries e
  on e.labor_rate_table_id = t.id
 and e.level = p.level
on conflict (labor_rate_table_id, code) do update set
  name = excluded.name,
  specialty = excluded.specialty,
  specialty_label = excluded.specialty_label,
  summary = excluded.summary,
  labor_rate_entry_id = excluded.labor_rate_entry_id,
  receives_hotel = excluded.receives_hotel,
  receives_operational_transport = excluded.receives_operational_transport,
  is_active = true;

-- Repair double-encoded values without embedding non-ASCII text in the migration.
update public.labor_rate_tables
set name = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
    source_document = convert_from(convert_to(source_document, 'LATIN1'), 'UTF8')
where name like '%' || chr(195) || chr(131) || '%'
   or source_document like '%' || chr(195) || chr(131) || '%';