-- Cover the audit foreign keys used by employee access queries.
create index employees_created_by_idx on public.employees(created_by);
create index employee_roles_created_by_idx on public.employee_roles(created_by);
create index employee_permission_overrides_created_by_idx on public.employee_permission_overrides(created_by);

-- Keep the general member read policy separate from administrator mutations.
-- `for all` also covers SELECT and caused both policies to be evaluated.
drop policy employees_administrator_write on public.employees;
create policy employees_administrator_insert on public.employees for insert to authenticated
  with check (private.company_administrator(company_id));
create policy employees_administrator_update on public.employees for update to authenticated
  using (private.company_administrator(company_id))
  with check (private.company_administrator(company_id));
create policy employees_administrator_delete on public.employees for delete to authenticated
  using (private.company_administrator(company_id));

drop policy employee_roles_administrator_write on public.employee_roles;
create policy employee_roles_administrator_insert on public.employee_roles for insert to authenticated
  with check (exists (
    select 1 from public.employees e
    where e.id = employee_roles.employee_id
      and private.company_administrator(e.company_id)
  ));
create policy employee_roles_administrator_update on public.employee_roles for update to authenticated
  using (exists (
    select 1 from public.employees e
    where e.id = employee_roles.employee_id
      and private.company_administrator(e.company_id)
  )) with check (exists (
    select 1 from public.employees e
    where e.id = employee_roles.employee_id
      and private.company_administrator(e.company_id)
  ));
create policy employee_roles_administrator_delete on public.employee_roles for delete to authenticated
  using (exists (
    select 1 from public.employees e
    where e.id = employee_roles.employee_id
      and private.company_administrator(e.company_id)
  ));

drop policy employee_permission_overrides_administrator_write on public.employee_permission_overrides;
create policy employee_permission_overrides_administrator_insert on public.employee_permission_overrides for insert to authenticated
  with check (exists (
    select 1 from public.employees e
    where e.id = employee_permission_overrides.employee_id
      and private.company_administrator(e.company_id)
  ));
create policy employee_permission_overrides_administrator_update on public.employee_permission_overrides for update to authenticated
  using (exists (
    select 1 from public.employees e
    where e.id = employee_permission_overrides.employee_id
      and private.company_administrator(e.company_id)
  )) with check (exists (
    select 1 from public.employees e
    where e.id = employee_permission_overrides.employee_id
      and private.company_administrator(e.company_id)
  ));
create policy employee_permission_overrides_administrator_delete on public.employee_permission_overrides for delete to authenticated
  using (exists (
    select 1 from public.employees e
    where e.id = employee_permission_overrides.employee_id
      and private.company_administrator(e.company_id)
  ));
