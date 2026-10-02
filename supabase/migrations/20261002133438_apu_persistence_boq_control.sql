-- APU persistente, versionable y control presupuestal por ítem BOQ.
create table public.apu_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  quote_id uuid,
  quote_code text,
  code text not null,
  name text not null,
  unit text not null default 'und',
  work_quantity numeric(14,4) not null default 1 check (work_quantity > 0),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'superseded', 'archived')),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table public.apu_versions (
  id uuid primary key default gen_random_uuid(),
  apu_analysis_id uuid not null references public.apu_analyses(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'superseded')),
  direct_cost numeric(14,2) not null default 0 check (direct_cost >= 0),
  indirect_percentage numeric(7,4) not null default 0 check (indirect_percentage >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  change_note text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  unique (apu_analysis_id, version_number)
);

create table public.apu_version_lines (
  id uuid primary key default gen_random_uuid(),
  apu_version_id uuid not null references public.apu_versions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  category text not null check (category in ('materials', 'equipment', 'labor', 'transport')),
  name text not null,
  quantity numeric(14,4) not null default 0 check (quantity >= 0),
  yield_per_day numeric(14,4) not null default 1 check (yield_per_day >= 0),
  daily_rate numeric(14,2) not null default 0 check (daily_rate >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  inventory_product_id uuid,
  labor_position_id uuid references public.apu_labor_positions(id) on delete set null,
  labor_code text,
  labor_level smallint,
  labor_activity_type text check (labor_activity_type in ('propias', 'no_propias')),
  unit text,
  created_at timestamptz not null default now()
);

create table public.project_boq_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid,
  apu_analysis_id uuid not null references public.apu_analyses(id) on delete restrict,
  apu_version_id uuid not null references public.apu_versions(id) on delete restrict,
  code text not null,
  description text not null,
  unit text not null,
  contract_quantity numeric(14,4) not null check (contract_quantity > 0),
  budget_unit_cost numeric(14,2) not null check (budget_unit_cost >= 0),
  budget_total numeric(14,2) not null check (budget_total >= 0),
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, apu_analysis_id)
);

create table public.project_boq_cost_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  boq_item_id uuid not null references public.project_boq_items(id) on delete cascade,
  cost_type text not null check (cost_type in ('committed', 'actual')),
  amount numeric(14,2) not null check (amount >= 0),
  occurred_at timestamptz not null default now(),
  source_type text not null default 'manual' check (source_type in ('manual', 'purchase_order', 'inventory_movement', 'payroll', 'equipment', 'subcontract')),
  reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index apu_analyses_company_status_updated_idx on public.apu_analyses (company_id, status, updated_at desc);
create index apu_analyses_project_idx on public.apu_analyses (project_id) where project_id is not null;
create index apu_versions_analysis_version_idx on public.apu_versions (apu_analysis_id, version_number desc);
create index apu_version_lines_version_category_idx on public.apu_version_lines (apu_version_id, category);
create index project_boq_items_project_status_idx on public.project_boq_items (project_id, status);
create index project_boq_cost_entries_boq_type_date_idx on public.project_boq_cost_entries (boq_item_id, cost_type, occurred_at desc);

alter table public.apu_analyses enable row level security;
alter table public.apu_versions enable row level security;
alter table public.apu_version_lines enable row level security;
alter table public.project_boq_items enable row level security;
alter table public.project_boq_cost_entries enable row level security;

create policy apu_analyses_member_read on public.apu_analyses for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = apu_analyses.company_id));
create policy apu_versions_member_read on public.apu_versions for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = apu_versions.company_id));
create policy apu_version_lines_member_read on public.apu_version_lines for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = apu_version_lines.company_id));
create policy project_boq_items_member_read on public.project_boq_items for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = project_boq_items.company_id));
create policy project_boq_cost_entries_member_read on public.project_boq_cost_entries for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = project_boq_cost_entries.company_id));

create policy apu_analyses_manager_write on public.apu_analyses for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = apu_analyses.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = apu_analyses.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management')));
create policy apu_versions_manager_write on public.apu_versions for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = apu_versions.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = apu_versions.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management')));
create policy apu_version_lines_manager_write on public.apu_version_lines for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = apu_version_lines.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = apu_version_lines.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management')));
create policy project_boq_items_manager_write on public.project_boq_items for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = project_boq_items.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = project_boq_items.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management')));
create policy project_boq_cost_entries_manager_write on public.project_boq_cost_entries for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = project_boq_cost_entries.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = (select auth.uid()) and ur.company_id = project_boq_cost_entries.company_id and r.code in ('administrator', 'resident_engineer', 'inventory_manager', 'general_management')));

grant select, insert, update, delete on public.apu_analyses, public.apu_versions, public.apu_version_lines, public.project_boq_items, public.project_boq_cost_entries to authenticated;

create trigger apu_analyses_updated before update on public.apu_analyses for each row execute function private.set_updated_at();
create trigger project_boq_items_updated before update on public.project_boq_items for each row execute function private.set_updated_at();
