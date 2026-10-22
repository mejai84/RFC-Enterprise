-- RFC Enterprise: Reestructuración de Seguridad, Datos y Arquitectura de Administración (Etapa 1 - P0)
-- Resuelve ADMIN-001 (desactivación atómica y anulación de permisos heredados),
-- ADMIN-003 (asignación atómica de roles y sincronización user_roles),
-- ADMIN-004 (creación atómica de ficha de empleado + rol base),
-- ADMIN-006 (protección contra desactivación o revocación del último administrador activo),
-- ADMIN-008 (seguridad y aislamiento en storage company-branding).

-- ============================================================================
-- 1. ADMIN-001: my_effective_permissions()
-- ============================================================================
create or replace function public.my_effective_permissions()
returns table (code text)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select e.id as employee_id, e.company_id, e.is_active
    from public.employees e
    where e.profile_id = (select auth.uid())
    limit 1
  ),
  role_ids as (
    -- Si el usuario tiene una ficha laboral activa, sus roles provienen de employee_roles
    select er.role_id
    from public.employee_roles er
    join me on me.employee_id = er.employee_id
    where me.is_active = true
    union all
    -- Solo fallback a user_roles si la cuenta NO tiene ninguna ficha de empleado registrada
    select ur.role_id
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and not exists (select 1 from me)
  ),
  inherited as (
    select distinct p.id, p.code
    from role_ids rr
    join public.role_permissions rp on rp.role_id = rr.role_id
    join public.permissions p on p.id = rp.permission_id
  ),
  overridden as (
    select p.code, o.mode
    from public.employee_permission_overrides o
    join me on me.employee_id = o.employee_id
    join public.permissions p on p.id = o.permission_id
    where me.is_active = true
  )
  select i.code from inherited i where not exists (select 1 from overridden o where o.code = i.code and o.mode = 'revoke')
  union
  select o.code from overridden o where o.mode = 'grant'
  union
  -- Todo usuario con sesión iniciada puede ver y administrar los datos personales de su propia cuenta
  select 'core.profile.view'::text
  where (select auth.uid()) is not null;
$$;

revoke all on function public.my_effective_permissions() from public, anon;
grant execute on function public.my_effective_permissions() to authenticated;

comment on function public.my_effective_permissions() is
  'Permisos efectivos de la persona autenticada. Si su ficha laboral está inactiva (is_active = false), se revocan todos los permisos operativos de inmediato y no se recurre a user_roles.';


-- ============================================================================
-- 2. ADMIN-001 / ADMIN-002: Verificación de Administrador de Empresa
-- ============================================================================
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
      and not exists (
        select 1
        from public.employees e
        where e.profile_id = (select auth.uid())
          and e.company_id = target_company
          and not e.is_active
      )
  );
$$;

create or replace function private.settings_manager_for(target_company uuid)
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
      and not exists (
        select 1
        from public.employees e
        where e.profile_id = (select auth.uid())
          and e.company_id = target_company
          and not e.is_active
      )
  );
$$;


-- ============================================================================
-- 3. ADMIN-003 & ADMIN-006: Asignación Atómica de Rol y Protección del Último Admin
-- ============================================================================
create or replace function public.admin_assign_employee_role(
  p_employee_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_emp record;
  v_new_role record;
  v_old_role_code text;
  v_active_admins_count int;
begin
  select id, company_id, branch_id, profile_id, is_active into v_emp
  from public.employees where id = p_employee_id;
  if not found then
    raise exception 'El empleado no existe';
  end if;

  if not private.company_administrator(v_emp.company_id) then
    raise exception 'No autorizado para gestionar roles en esta empresa';
  end if;

  select id, code, name into v_new_role from public.roles where id = p_role_id;
  if not found then
    raise exception 'El rol solicitado no existe';
  end if;

  select r.code into v_old_role_code
  from public.employee_roles er
  join public.roles r on r.id = er.role_id
  where er.employee_id = p_employee_id
  limit 1;

  -- Si era administrador y se pretende cambiar a un rol no-admin, verificar que no sea el único
  if v_old_role_code = 'administrator' and v_new_role.code <> 'administrator' then
    select count(distinct e.id) into v_active_admins_count
    from public.employees e
    join public.employee_roles er on er.employee_id = e.id
    join public.roles r on r.id = er.role_id
    where e.company_id = v_emp.company_id
      and e.is_active = true
      and r.code = 'administrator'
      and e.id <> p_employee_id;

    if v_active_admins_count < 1 then
      raise exception 'No es posible revocar el rol al único administrador activo de la empresa';
    end if;
  end if;

  -- Actualización atómica de employee_roles
  delete from public.employee_roles where employee_id = p_employee_id;
  insert into public.employee_roles (employee_id, role_id)
  values (p_employee_id, p_role_id);

  -- Si tiene perfil vinculado en Auth/user_roles, sincronizar atómicamente la membresía
  if v_emp.profile_id is not null then
    delete from public.user_roles
    where user_id = v_emp.profile_id and company_id = v_emp.company_id;

    insert into public.user_roles (user_id, company_id, branch_id, role_id)
    values (v_emp.profile_id, v_emp.company_id, v_emp.branch_id, p_role_id);
  end if;
end;
$$;

revoke all on function public.admin_assign_employee_role(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_employee_role(uuid, uuid) to authenticated;


-- ============================================================================
-- 4. ADMIN-004: Creación Atómica de Empleado y Rol Base
-- ============================================================================
create or replace function public.admin_create_employee(
  p_company_id uuid,
  p_branch_id uuid,
  p_full_name text,
  p_email text,
  p_job_title text,
  p_role_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_employee_id uuid;
begin
  if not private.company_administrator(p_company_id) then
    raise exception 'No autorizado para crear empleados en esta empresa';
  end if;

  if not exists (select 1 from public.roles where id = p_role_id) then
    raise exception 'El rol seleccionado no es válido';
  end if;

  insert into public.employees (
    company_id,
    branch_id,
    full_name,
    email,
    job_title,
    is_active
  ) values (
    p_company_id,
    p_branch_id,
    trim(p_full_name),
    lower(trim(p_email)),
    trim(p_job_title),
    true
  ) returning id into v_employee_id;

  insert into public.employee_roles (employee_id, role_id)
  values (v_employee_id, p_role_id);

  return v_employee_id;
end;
$$;

revoke all on function public.admin_create_employee(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.admin_create_employee(uuid, uuid, text, text, text, uuid) to authenticated;


-- ============================================================================
-- 5. ADMIN-006: Desactivación Protegida de Empleados
-- ============================================================================
create or replace function public.admin_toggle_employee_active(
  p_employee_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_emp record;
  v_is_admin boolean;
  v_other_admins int;
  v_next_state boolean;
begin
  select id, company_id, is_active into v_emp
  from public.employees where id = p_employee_id;
  if not found then raise exception 'El empleado no existe'; end if;

  if not private.company_administrator(v_emp.company_id) then
    raise exception 'No autorizado para gestionar el estado de empleados en esta empresa';
  end if;

  v_next_state := not v_emp.is_active;

  -- Si se pretende desactivar, verificar que no sea el único administrador activo
  if not v_next_state then
    select exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = p_employee_id and r.code = 'administrator'
    ) into v_is_admin;

    if v_is_admin then
      select count(distinct e.id) into v_other_admins
      from public.employees e
      join public.employee_roles er on er.employee_id = e.id
      join public.roles r on r.id = er.role_id
      where e.company_id = v_emp.company_id
        and e.is_active = true
        and r.code = 'administrator'
        and e.id <> p_employee_id;

      if v_other_admins < 1 then
        raise exception 'No es posible desactivar al único administrador activo de la empresa';
      end if;
    end if;
  end if;

  update public.employees
  set is_active = v_next_state,
      updated_at = now()
  where id = p_employee_id;

  return v_next_state;
end;
$$;

revoke all on function public.admin_toggle_employee_active(uuid) from public, anon;
grant execute on function public.admin_toggle_employee_active(uuid) to authenticated;


-- ============================================================================
-- 6. ADMIN-008: Seguridad de Storage en company-branding
-- ============================================================================
drop policy if exists "Firma institucional se puede subir" on storage.objects;
create policy "Firma institucional se puede subir"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-branding'
    and exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.code = 'administrator'
    )
  );

drop policy if exists "Firma institucional se puede eliminar" on storage.objects;
create policy "Firma institucional se puede eliminar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company-branding'
    and exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.code = 'administrator'
    )
  );
