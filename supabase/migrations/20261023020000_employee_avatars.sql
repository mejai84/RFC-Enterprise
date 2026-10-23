-- PERFIL-001: fotografía de perfil y avatar por cargo.
-- Bucket privado, ruta por empresa/empleado y RPC auditadas.

alter table public.employees
  add column if not exists avatar_path text;

comment on column public.employees.avatar_path is
  'Ruta del objeto en el bucket privado employee-avatars: {company_id}/{employee_id}/archivo.';

insert into storage.buckets (id, name, public)
values ('employee-avatars', 'employee-avatars', false)
on conflict (id) do update set public = false;

-- Lectura: el propio empleado o un administrador de su empresa.
drop policy if exists "Avatar propio o administrador puede leer" on storage.objects;
create policy "Avatar propio o administrador puede leer"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'employee-avatars'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (
      exists (
        select 1 from public.employees e
        where e.profile_id = (select auth.uid())
          and e.company_id = ((storage.foldername(name))[1])::uuid
          and e.id = ((storage.foldername(name))[2])::uuid
      )
      or private.company_administrator(((storage.foldername(name))[1])::uuid)
    )
  );

-- Escritura: solo el propio empleado dentro de su carpeta.
drop policy if exists "Avatar propio puede subir" on storage.objects;
create policy "Avatar propio puede subir"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'employee-avatars'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and exists (
      select 1 from public.employees e
      where e.profile_id = (select auth.uid())
        and e.company_id = ((storage.foldername(name))[1])::uuid
        and e.id = ((storage.foldername(name))[2])::uuid
    )
  );

drop policy if exists "Avatar propio puede actualizar" on storage.objects;
create policy "Avatar propio puede actualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'employee-avatars'
    and exists (
      select 1 from public.employees e
      where e.profile_id = (select auth.uid())
        and e.company_id = ((storage.foldername(name))[1])::uuid
        and e.id = ((storage.foldername(name))[2])::uuid
    )
  )
  with check (
    bucket_id = 'employee-avatars'
    and exists (
      select 1 from public.employees e
      where e.profile_id = (select auth.uid())
        and e.company_id = ((storage.foldername(name))[1])::uuid
        and e.id = ((storage.foldername(name))[2])::uuid
    )
  );

drop policy if exists "Avatar propio puede eliminar" on storage.objects;
create policy "Avatar propio puede eliminar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'employee-avatars'
    and exists (
      select 1 from public.employees e
      where e.profile_id = (select auth.uid())
        and e.company_id = ((storage.foldername(name))[1])::uuid
        and e.id = ((storage.foldername(name))[2])::uuid
    )
  );

-- Guarda la ruta y deja auditoría. Solo el propio empleado.
create or replace function public.set_my_avatar_path(p_path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_expected_prefix text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if nullif(trim(p_path), '') is null then raise exception 'La ruta de la foto no es válida'; end if;

  select * into v_employee
  from public.employees
  where profile_id = auth.uid() and is_active
  limit 1;
  if not found then raise exception 'Tu cuenta no está vinculada a un empleado activo'; end if;

  v_expected_prefix := v_employee.company_id::text || '/' || v_employee.id::text || '/';
  if left(p_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'La foto debe estar dentro de tu carpeta de empleado';
  end if;

  update public.employees
  set avatar_path = p_path, updated_at = now()
  where id = v_employee.id;

  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_employee.company_id, auth.uid(), 'employee_avatar', v_employee.id, 'updated',
    jsonb_build_object('avatar_path', p_path)
  );
end;
$$;

create or replace function public.clear_my_avatar_path()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select * into v_employee
  from public.employees
  where profile_id = auth.uid() and is_active
  limit 1;
  if not found then raise exception 'Tu cuenta no está vinculada a un empleado activo'; end if;

  update public.employees
  set avatar_path = null, updated_at = now()
  where id = v_employee.id;

  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action)
  values (v_employee.company_id, auth.uid(), 'employee_avatar', v_employee.id, 'removed');
end;
$$;

revoke all on function public.set_my_avatar_path(text) from public, anon;
revoke all on function public.clear_my_avatar_path() from public, anon;
grant execute on function public.set_my_avatar_path(text) to authenticated;
grant execute on function public.clear_my_avatar_path() to authenticated;
-- Colección visual elegida por el empleado o por Administración al crear la ficha.
-- Se guarda una clave de interfaz, no datos de raza o género.
alter table public.employees
  add column if not exists avatar_style text not null default 'style-02'
  check (avatar_style in ('style-01', 'style-02', 'style-03', 'style-04', 'style-05', 'style-06'));

create or replace function public.admin_create_employee(
  p_company_id uuid,
  p_branch_id uuid,
  p_full_name text,
  p_email text,
  p_job_title text,
  p_role_id uuid,
  p_avatar_style text default 'style-02'
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
    raise exception 'El rol seleccionado no es valido';
  end if;
  if coalesce(p_avatar_style, '') not in ('style-01', 'style-02', 'style-03', 'style-04', 'style-05', 'style-06') then
    raise exception 'El estilo de avatar no es valido';
  end if;

  insert into public.employees (
    company_id, branch_id, full_name, email, job_title, avatar_style, is_active
  ) values (
    p_company_id, p_branch_id, trim(p_full_name), lower(trim(p_email)), trim(p_job_title), p_avatar_style, true
  ) returning id into v_employee_id;

  insert into public.employee_roles (employee_id, role_id)
  values (v_employee_id, p_role_id);

  return v_employee_id;
end;
$$;

revoke all on function public.admin_create_employee(uuid, uuid, text, text, text, uuid, text) from public, anon;
grant execute on function public.admin_create_employee(uuid, uuid, text, text, text, uuid, text) to authenticated;