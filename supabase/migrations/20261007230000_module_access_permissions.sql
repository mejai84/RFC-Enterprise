-- RFC Enterprise: permisos efectivos para menú y acceso a módulos.
-- employee_roles es la fuente preferida por trabajador; user_roles es respaldo
-- para membresías antiguas que aún no tengan rol laboral asignado.

insert into public.permissions (code, name, description) values
  ('core.profile.view', 'Ver mi perfil', 'Acceder a la configuración personal.'),
  ('dashboard.view', 'Ver resumen operativo', 'Acceder al resumen sin indicadores financieros restringidos.'),
  ('quotes.view', 'Consultar cotizaciones', 'Ver cotizaciones y su estado.'),
  ('quotes.manage', 'Gestionar cotizaciones', 'Crear, editar y convertir cotizaciones.'),
  ('attendance.self.record', 'Registrar mi jornada', 'Registrar entrada, tramos y salida propios.'),
  ('attendance.team.view', 'Consultar jornadas del equipo', 'Consultar jornadas declaradas del equipo autorizado.'),
  ('rentals.view', 'Consultar alquileres', 'Ver alquileres rápidos.'),
  ('rentals.manage', 'Gestionar alquileres', 'Crear y cerrar alquileres rápidos.'),
  ('reports.view', 'Consultar informes', 'Acceder a informes operativos.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any (
  case r.code
    when 'administrator' then array['core.profile.view','dashboard.view','quotes.view','quotes.manage','attendance.self.record','attendance.team.view','rentals.view','rentals.manage','reports.view']
    when 'general_management' then array['core.profile.view','dashboard.view','quotes.view','quotes.manage','attendance.team.view','rentals.view','rentals.manage','reports.view']
    when 'management' then array['core.profile.view','dashboard.view','quotes.view','quotes.manage','attendance.team.view','rentals.view','rentals.manage','reports.view']
    when 'resident_engineer' then array['core.profile.view','dashboard.view','quotes.view','quotes.manage','attendance.self.record','attendance.team.view','reports.view']
    when 'warehouse_lead' then array['core.profile.view','dashboard.view','attendance.self.record','rentals.view','rentals.manage','reports.view']
    when 'foreman' then array['core.profile.view','dashboard.view','attendance.self.record']
    when 'auditor' then array['core.profile.view','dashboard.view','quotes.view','attendance.team.view','reports.view']
    else array[]::text[]
  end
)
on conflict do nothing;

create or replace function public.my_effective_permissions()
returns table (code text)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select e.id as employee_id, e.company_id
    from public.employees e
    where e.profile_id = (select auth.uid()) and e.is_active
    limit 1
  ), role_ids as (
    select er.role_id
    from public.employee_roles er join me on me.employee_id = er.employee_id
    union all
    select ur.role_id
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and not exists (select 1 from public.employee_roles er join me on me.employee_id = er.employee_id)
  ), inherited as (
    select distinct p.id, p.code
    from role_ids rr join public.role_permissions rp on rp.role_id = rr.role_id
    join public.permissions p on p.id = rp.permission_id
  ), overridden as (
    select p.code, o.mode
    from public.employee_permission_overrides o
    join me on me.employee_id = o.employee_id
    join public.permissions p on p.id = o.permission_id
  )
  select i.code from inherited i where not exists (select 1 from overridden o where o.code = i.code and o.mode = 'revoke')
  union
  select o.code from overridden o where o.mode = 'grant';
$$;

revoke all on function public.my_effective_permissions() from public, anon;
grant execute on function public.my_effective_permissions() to authenticated;

comment on function public.my_effective_permissions() is
  'Permisos efectivos de la persona autenticada: rol laboral + excepciones individuales, con fallback a membresía antigua. Fuente para navegación y guardas de módulo; las tablas mantienen sus propias RLS.';
