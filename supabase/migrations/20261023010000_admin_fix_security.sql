-- ADMIN-FIX-001/002/003: operaciones administrativas atómicas y auditoradas.
-- No elimina datos ni relaja RLS.

-- 1. Excepciones individuales de permisos (antes escritas directo desde el navegador).
create or replace function public.admin_set_employee_permission_override(
  p_employee_id uuid,
  p_permission_id uuid,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_employee record;
  v_permission record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select id, company_id, full_name into v_employee
  from public.employees where id = p_employee_id;
  if not found then raise exception 'El empleado no existe'; end if;

  if not private.company_administrator(v_employee.company_id) then
    raise exception 'No autorizado para gestionar permisos en esta empresa';
  end if;

  select id, code into v_permission from public.permissions where id = p_permission_id;
  if not found then raise exception 'El permiso no existe'; end if;

  if p_mode is null then
    delete from public.employee_permission_overrides
    where employee_id = p_employee_id and permission_id = p_permission_id;
  elsif p_mode in ('grant', 'revoke') then
    insert into public.employee_permission_overrides(employee_id, permission_id, mode)
    values (p_employee_id, p_permission_id, p_mode)
    on conflict (employee_id, permission_id) do update set mode = excluded.mode;
  else
    raise exception 'El modo del permiso no es válido';
  end if;

  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_employee.company_id, auth.uid(), 'employee_permission_override', p_employee_id,
    case when p_mode is null then 'removed' else 'set' end,
    jsonb_build_object('employee_id', p_employee_id, 'permission', v_permission.code, 'mode', p_mode)
  );
end;
$$;

revoke all on function public.admin_set_employee_permission_override(uuid, uuid, text) from public, anon;
grant execute on function public.admin_set_employee_permission_override(uuid, uuid, text) to authenticated;

-- 2. Guardado atómico de company_settings.
create or replace function public.save_company_settings(
  p_company_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_entry jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not private.settings_manager_for(p_company_id) then
    raise exception 'No autorizado para modificar la configuración de esta empresa';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'La configuración debe enviarse como una lista';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if nullif(trim(coalesce(v_entry->>'key', '')), '') is null then
      raise exception 'Cada configuración requiere una clave';
    end if;
    insert into public.company_settings(company_id, key, value)
    values (p_company_id, v_entry->>'key', coalesce(v_entry->'value', '{}'::jsonb))
    on conflict (company_id, key) do update set value = excluded.value;
  end loop;

  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    p_company_id, auth.uid(), 'company_settings', p_company_id, 'updated',
    jsonb_build_object('keys', (select jsonb_agg(e->>'key') from jsonb_array_elements(p_entries) e))
  );
end;
$$;

revoke all on function public.save_company_settings(uuid, jsonb) from public, anon;
grant execute on function public.save_company_settings(uuid, jsonb) to authenticated;

-- 3. Guardado atómico de empresa + settings relacionados.
create or replace function public.save_company_profile(
  p_company_id uuid,
  p_name text,
  p_tax_id text,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_entry jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not private.settings_manager_for(p_company_id) then
    raise exception 'No autorizado para modificar la configuración de esta empresa';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'La configuración debe enviarse como una lista';
  end if;

  update public.companies
  set name = coalesce(nullif(trim(p_name), ''), name),
      tax_id = nullif(trim(p_tax_id), '')
  where id = p_company_id;
  if not found then raise exception 'La empresa no existe'; end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if nullif(trim(coalesce(v_entry->>'key', '')), '') is null then
      raise exception 'Cada configuración requiere una clave';
    end if;
    insert into public.company_settings(company_id, key, value)
    values (p_company_id, v_entry->>'key', coalesce(v_entry->'value', '{}'::jsonb))
    on conflict (company_id, key) do update set value = excluded.value;
  end loop;

  insert into public.audit_logs(company_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    p_company_id, auth.uid(), 'company', p_company_id, 'profile_updated',
    jsonb_build_object(
      'name', p_name,
      'tax_id', p_tax_id,
      'keys', (select jsonb_agg(e->>'key') from jsonb_array_elements(p_entries) e)
    )
  );
end;
$$;

revoke all on function public.save_company_profile(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_company_profile(uuid, text, text, jsonb) to authenticated;

-- 4. Storage company-branding: la ruta debe iniciar con el id de la empresa.
--    Se conserva el bucket público para no romper enlaces históricos, pero las
--    escrituras y lecturas autenticadas quedan aisladas por empresa.
drop policy if exists "Firma institucional se puede subir" on storage.objects;
create policy "Firma institucional se puede subir"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and private.settings_manager_for(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Firma institucional se puede leer" on storage.objects;
create policy "Firma institucional se puede leer"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'company-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and private.settings_manager_for(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Firma institucional se puede eliminar" on storage.objects;
create policy "Firma institucional se puede eliminar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and private.settings_manager_for(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Firma institucional se puede actualizar" on storage.objects;
create policy "Firma institucional se puede actualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and private.settings_manager_for(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'company-branding'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and private.settings_manager_for(((storage.foldername(name))[1])::uuid)
  );