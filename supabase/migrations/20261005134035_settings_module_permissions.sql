insert into public.permissions (code, name) values
  ('core.settings.read', 'Consultar configuracion'),
  ('core.settings.manage', 'Gestionar configuracion empresarial'),
  ('payroll.settings.manage', 'Gestionar parametros de nomina'),
  ('documents.settings.manage', 'Gestionar documentos e impresion')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.code in ('core.settings.read', 'core.settings.manage', 'payroll.settings.manage', 'documents.settings.manage')
where r.code = 'administrator' on conflict do nothing;

create or replace function private.settings_manager_for(target_company uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and ur.company_id = target_company and r.code = 'administrator')
$$;

drop policy if exists settings_manager_write on public.company_settings;
create policy settings_manager_write on public.company_settings for all to authenticated
using (private.settings_manager_for(company_id)) with check (private.settings_manager_for(company_id));
