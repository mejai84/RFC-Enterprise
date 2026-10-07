-- Persistencia de operaciones de obra y catálogos configurables.
-- Cada registro conserva la empresa y queda protegido por las mismas reglas
-- de inventario; la interfaz solo confirma después de una escritura exitosa.

alter table public.inventory_movements
  add column if not exists responsible_name text;

create table if not exists public.project_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create index if not exists project_employees_project_idx
  on public.project_employees (project_id, assigned_at);
create index if not exists project_employees_company_employee_idx
  on public.project_employees (company_id, employee_id);

create table if not exists public.project_reopenings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 3),
  previous_actual_end_date date,
  new_estimated_end_date date not null,
  reopened_by uuid references auth.users(id) on delete set null default auth.uid(),
  reopened_at timestamptz not null default now(),
  check (new_estimated_end_date >= coalesce(previous_actual_end_date, new_estimated_end_date))
);

create index if not exists project_reopenings_project_date_idx
  on public.project_reopenings (project_id, reopened_at desc);

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null check (length(trim(name)) >= 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists inventory_categories_company_active_idx
  on public.inventory_categories (company_id, is_active, name);

create or replace function public.assign_project_employee(
  target_project uuid,
  target_employee uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_company uuid;
  assigned_id uuid;
begin
  select company_id into target_company from public.projects where id = target_project;
  if not found then raise exception 'La obra seleccionada no existe'; end if;
  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para asignar personal a esta obra';
  end if;
  if not exists (select 1 from public.employees where id = target_employee and company_id = target_company and is_active) then
    raise exception 'El empleado no está activo o no pertenece a la misma empresa';
  end if;

  insert into public.project_employees (company_id, project_id, employee_id)
  values (target_company, target_project, target_employee)
  on conflict (project_id, employee_id) do update set assigned_at = public.project_employees.assigned_at
  returning id into assigned_id;

  return assigned_id;
end;
$$;

create or replace function public.remove_project_employee(
  target_project uuid,
  target_employee uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare target_company uuid;
begin
  select company_id into target_company from public.projects where id = target_project;
  if not found then raise exception 'La obra seleccionada no existe'; end if;
  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para retirar personal de esta obra';
  end if;
  delete from public.project_employees
  where project_id = target_project and employee_id = target_employee;
end;
$$;

create or replace function public.reopen_project(
  target_project uuid,
  reopen_reason text,
  target_estimated_end_date date
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare project_row public.projects%rowtype;
begin
  select * into project_row from public.projects where id = target_project for update;
  if not found then raise exception 'La obra seleccionada no existe'; end if;
  if not private.inventory_manager_for(project_row.company_id) then
    raise exception 'No tienes permiso para reabrir esta obra';
  end if;
  if project_row.status <> 'completed' then raise exception 'Solo se pueden reabrir obras finalizadas'; end if;
  if length(trim(coalesce(reopen_reason, ''))) < 3 then raise exception 'Indica el motivo de la reapertura'; end if;
  if target_estimated_end_date < project_row.start_date then raise exception 'La nueva fecha estimada no puede ser anterior al inicio'; end if;

  update public.projects
  set status = 'active', actual_end_date = null, estimated_end_date = target_estimated_end_date
  where id = target_project;
  insert into public.project_reopenings (
    company_id, project_id, reason, previous_actual_end_date, new_estimated_end_date
  ) values (
    project_row.company_id, target_project, trim(reopen_reason), project_row.actual_end_date, target_estimated_end_date
  );
end;
$$;

create or replace function public.adjust_project_budget(
  target_project uuid,
  adjustment_amount numeric,
  adjustment_reason text
)
returns numeric
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare project_row public.projects%rowtype;
declare project_spent numeric(14,2);
declare next_budget numeric(14,2);
begin
  select * into project_row from public.projects where id = target_project for update;
  if not found then raise exception 'La obra seleccionada no existe'; end if;
  if not private.inventory_manager_for(project_row.company_id) then
    raise exception 'No tienes permiso para ajustar el presupuesto';
  end if;
  if coalesce(adjustment_amount, 0) = 0 then raise exception 'El ajuste debe ser diferente de cero'; end if;
  if length(trim(coalesce(adjustment_reason, ''))) < 3 then raise exception 'Indica el motivo del ajuste'; end if;

  select coalesce(sum(case when movement_type = 'exit' then quantity * unit_cost when movement_type = 'entry' then -quantity * unit_cost else 0 end), 0)
    into project_spent
  from public.inventory_movements
  where project_id = target_project;
  next_budget := project_row.material_budget + adjustment_amount;
  if next_budget < project_spent then raise exception 'El nuevo presupuesto no puede ser menor al gasto acumulado'; end if;

  update public.projects set material_budget = next_budget where id = target_project;
  insert into public.project_budget_adjustments (project_id, company_id, amount, reason)
  values (target_project, project_row.company_id, adjustment_amount, trim(adjustment_reason));
  return next_budget;
end;
$$;

revoke all on function public.assign_project_employee(uuid, uuid) from public, anon;
revoke all on function public.remove_project_employee(uuid, uuid) from public, anon;
revoke all on function public.reopen_project(uuid, text, date) from public, anon;
revoke all on function public.adjust_project_budget(uuid, numeric, text) from public, anon;
grant execute on function public.assign_project_employee(uuid, uuid) to authenticated;
grant execute on function public.remove_project_employee(uuid, uuid) to authenticated;
grant execute on function public.reopen_project(uuid, text, date) to authenticated;
grant execute on function public.adjust_project_budget(uuid, numeric, text) to authenticated;

alter table public.project_employees enable row level security;
alter table public.project_reopenings enable row level security;
alter table public.inventory_categories enable row level security;

create policy "project employees read by company member"
on public.project_employees for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.company_id = project_employees.company_id
));

create policy "project employees managed by inventory manager"
on public.project_employees for all to authenticated
using ((select private.inventory_manager_for(company_id)))
with check ((select private.inventory_manager_for(company_id)));

create policy "project reopenings read by company member"
on public.project_reopenings for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.company_id = project_reopenings.company_id
));

create policy "project reopenings managed by inventory manager"
on public.project_reopenings for insert to authenticated
with check ((select private.inventory_manager_for(company_id)));

create policy "inventory categories read by company member"
on public.inventory_categories for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.company_id = inventory_categories.company_id
));

create policy "inventory categories managed by inventory manager"
on public.inventory_categories for all to authenticated
using ((select private.inventory_manager_for(company_id)))
with check ((select private.inventory_manager_for(company_id)));
