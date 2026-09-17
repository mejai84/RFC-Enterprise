-- RFC Enterprise: directorio de empleados, roles y permisos individuales.
-- Mantiene separada la ficha laboral de la identidad de Supabase Auth para que
-- un empleado pueda registrarse antes de recibir o activar acceso al portal.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) >= 3),
  email text not null check (email = lower(trim(email))),
  job_title text not null check (char_length(trim(job_title)) >= 2),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index employees_company_email_key on public.employees(company_id, lower(email));
create index employees_company_active_idx on public.employees(company_id, is_active, full_name);
create index employees_branch_idx on public.employees(branch_id) where branch_id is not null;

create table public.employee_roles (
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (employee_id, role_id)
);
create index employee_roles_role_idx on public.employee_roles(role_id);

-- `grant` adds an exception to the role; `revoke` removes an inherited action.
create type public.employee_permission_mode as enum ('grant', 'revoke');
create table public.employee_permission_overrides (
  employee_id uuid not null references public.employees(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  mode public.employee_permission_mode not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (employee_id, permission_id)
);
create index employee_permission_overrides_permission_idx on public.employee_permission_overrides(permission_id);

create or replace function private.company_administrator(target_company uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = target_company
      and r.code = 'administrator'
  );
$$;

insert into public.roles (code, name, description) values
  ('administrator', 'Administrador / Gerencia General', 'Control total de la plataforma y de la configuración.'),
  ('resident_engineer', 'Ingeniero Residente / Director de Obra', 'Gestiona técnicamente las obras asignadas.'),
  ('warehouse_lead', 'Jefe de Almacén / Bodeguero', 'Custodia existencias, despachos y equipos.'),
  ('foreman', 'Maestro de Obra / Cuadrilla', 'Solicita insumos y registra devoluciones de frente de obra.'),
  ('auditor', 'Auditor / Contador de Costos', 'Consulta trazabilidad, costos y auditoría sin alterar inventario.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.permissions (code, name, description) values
  ('core.users.manage', 'Gestionar empleados', 'Crear empleados, activar o desactivar y administrar sus permisos.'),
  ('core.roles.manage', 'Gestionar roles', 'Administrar roles y su matriz de permisos.'),
  ('core.companies.manage', 'Gestionar empresa', 'Administrar empresas y sedes.'),
  ('core.modules.manage', 'Gestionar módulos', 'Administrar módulos habilitados.'),
  ('core.audit.read', 'Consultar auditoría', 'Consultar eventos de auditoría.'),
  ('dashboard.financials.view', 'Ver finanzas globales', 'Consultar presupuestos y gastos consolidados.'),
  ('dashboard.intelligence.view', 'Ver inteligencia de costos', 'Consultar análisis de materiales y costos.'),
  ('projects.view', 'Consultar proyectos', 'Consultar fichas y estados de obras.'),
  ('projects.manage', 'Gestionar proyectos', 'Crear y editar obras y presupuestos.'),
  ('projects.requisitions.create', 'Crear requisiciones', 'Solicitar materiales desde obra.'),
  ('projects.requisitions.approve', 'Aprobar requisiciones', 'Aprobar técnicamente requisiciones.'),
  ('inventory.catalog.view', 'Consultar catálogo', 'Consultar catálogo y niveles de stock.'),
  ('inventory.stock.manage', 'Gestionar existencias', 'Ajustar existencias y mínimos.'),
  ('inventory.dispatch.create', 'Despachar materiales', 'Emitir vales de salida.'),
  ('inventory.return.create', 'Registrar devoluciones', 'Registrar reintegros de sobrantes.'),
  ('inventory.tools.manage', 'Gestionar herramientas', 'Administrar préstamos y custodias.'),
  ('inventory.kardex.view', 'Consultar kardex', 'Consultar trazabilidad valorizada.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any (
  case r.code
    when 'administrator' then array['core.users.manage','core.roles.manage','core.companies.manage','core.modules.manage','core.audit.read','dashboard.financials.view','dashboard.intelligence.view','projects.view','projects.manage','projects.requisitions.create','projects.requisitions.approve','inventory.catalog.view','inventory.stock.manage','inventory.dispatch.create','inventory.return.create','inventory.tools.manage','inventory.kardex.view']
    when 'resident_engineer' then array['dashboard.intelligence.view','projects.view','projects.requisitions.create','projects.requisitions.approve','inventory.catalog.view','inventory.return.create','inventory.tools.manage']
    when 'warehouse_lead' then array['projects.view','inventory.catalog.view','inventory.stock.manage','inventory.dispatch.create','inventory.return.create','inventory.tools.manage','inventory.kardex.view']
    when 'foreman' then array['projects.view','projects.requisitions.create','inventory.catalog.view','inventory.return.create']
    when 'auditor' then array['core.audit.read','dashboard.financials.view','dashboard.intelligence.view','projects.view','inventory.catalog.view','inventory.kardex.view']
    else array[]::text[]
  end
)
on conflict do nothing;

alter table public.employees enable row level security;
alter table public.employee_roles enable row level security;
alter table public.employee_permission_overrides enable row level security;

create policy employees_member_read on public.employees for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = employees.company_id));
create policy employees_administrator_write on public.employees for all to authenticated
  using (private.company_administrator(company_id)) with check (private.company_administrator(company_id));
create policy employee_roles_member_read on public.employee_roles for select to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_roles.employee_id and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = e.company_id)));
create policy employee_roles_administrator_write on public.employee_roles for all to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_roles.employee_id and private.company_administrator(e.company_id)))
  with check (exists (select 1 from public.employees e where e.id = employee_roles.employee_id and private.company_administrator(e.company_id)));
create policy employee_permission_overrides_member_read on public.employee_permission_overrides for select to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_permission_overrides.employee_id and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = e.company_id)));
create policy employee_permission_overrides_administrator_write on public.employee_permission_overrides for all to authenticated
  using (exists (select 1 from public.employees e where e.id = employee_permission_overrides.employee_id and private.company_administrator(e.company_id)))
  with check (exists (select 1 from public.employees e where e.id = employee_permission_overrides.employee_id and private.company_administrator(e.company_id)));

create or replace function private.audit_employee_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare target_company uuid;
begin
  if tg_table_name = 'employees' then
    target_company := case when tg_op = 'DELETE' then old.company_id else new.company_id end;
  else
    target_company := (select company_id from public.employees where id = case when tg_op = 'DELETE' then old.employee_id else new.employee_id end);
  end if;
  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    target_company,
    auth.uid(),
    tg_table_name,
    case when tg_table_name = 'employees' then case when tg_op = 'DELETE' then old.id else new.id end else case when tg_op = 'DELETE' then old.employee_id else new.employee_id end end,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function private.audit_employee_change() from public, anon, authenticated;

create trigger employees_audit after insert or update or delete on public.employees for each row execute function private.audit_employee_change();
create trigger employee_roles_audit after insert or update or delete on public.employee_roles for each row execute function private.audit_employee_change();
create trigger employee_permission_overrides_audit after insert or update or delete on public.employee_permission_overrides for each row execute function private.audit_employee_change();
create trigger employees_updated before update on public.employees for each row execute function private.set_updated_at();
