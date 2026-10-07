-- RFC Enterprise: permisos de acceso por rol, alineados con la operacion real.
--
-- La siembra anterior uso `on conflict do nothing`, de modo que los permisos
-- antiguos de cada rol nunca se quitaron. El operario de campo conservaba
-- `projects.view` y `inventory.catalog.view`, por lo que le aparecian en el menu
-- modulos que no le corresponden. Aqui se reemplaza por completo la asignacion
-- de los roles operativos.

create temporary table rfc_role_permission_target (
  role_code text primary key,
  permission_codes text[] not null
) on commit drop;

insert into rfc_role_permission_target (role_code, permission_codes) values
  -- Operario de campo: solo su jornada y su perfil. No ve obras ni inventarios.
  ('field_worker', array['core.profile.view', 'attendance.self.record']),
  -- Maestro de obra: requisiciones y su propia jornada.
  ('foreman', array['core.profile.view', 'dashboard.view', 'attendance.self.record', 'projects.requisitions.create']),
  -- Jefe de almacen: inventario, kardex, despachos, devoluciones y jornada.
  ('warehouse_lead', array[
    'core.profile.view', 'dashboard.view', 'attendance.self.record',
    'inventory.catalog.view', 'inventory.kardex.view', 'inventory.stock.manage',
    'inventory.dispatch.create', 'inventory.return.create',
    'rentals.view', 'rentals.manage'
  ]),
  -- Ingeniero residente: cotizaciones, APU, obra completa y consulta de su equipo.
  ('resident_engineer', array[
    'core.profile.view', 'dashboard.view', 'quotes.view', 'quotes.manage',
    'apu.view', 'apu.manage', 'projects.view', 'projects.manage',
    'attendance.self.record', 'attendance.team.view',
    'inventory.catalog.view', 'inventory.kardex.view', 'reports.view'
  ]),
  -- Auditor: consulta sin modificar.
  ('auditor', array[
    'core.profile.view', 'dashboard.view', 'quotes.view',
    'attendance.team.view', 'inventory.kardex.view', 'reports.view'
  ]),
  -- Gerencia: operacion completa, sin administrar usuarios, roles ni configuracion.
  ('management', array[
    'core.profile.view', 'dashboard.view', 'dashboard.financials.view', 'dashboard.intelligence.view',
    'quotes.view', 'quotes.manage', 'apu.view', 'apu.manage',
    'projects.view', 'projects.manage', 'projects.requisitions.create', 'projects.requisitions.approve',
    'attendance.self.record', 'attendance.team.view',
    'rentals.view', 'rentals.manage',
    'inventory.catalog.view', 'inventory.kardex.view', 'inventory.stock.manage',
    'inventory.dispatch.create', 'inventory.return.create', 'inventory.tools.manage',
    'reports.view', 'core.audit.read'
  ]);

-- Primero se retiran todos los permisos previos de esos roles.
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.code in (select role_code from rfc_role_permission_target);

-- Luego se conceden exactamente los de la tabla objetivo.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from rfc_role_permission_target t
join public.roles r on r.code = t.role_code
join public.permissions p on p.code = any (t.permission_codes)
on conflict do nothing;

-- Comprobacion: ningun operario de campo puede conservar acceso a obras o inventarios.
do $$
declare
  v_leftovers integer;
begin
  select count(*) into v_leftovers
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where r.code = 'field_worker'
    and p.code in ('projects.view', 'projects.manage', 'inventory.catalog.view', 'quotes.view', 'reports.view');
  if v_leftovers > 0 then
    raise exception 'El operario de campo conserva % permiso(s) que no le corresponden', v_leftovers;
  end if;
end;
$$;

comment on function public.my_effective_permissions() is
  'Permisos efectivos de la persona autenticada: rol laboral, respaldo en membresia antigua y excepciones individuales. Es la unica fuente que consulted el menu, la guarda de ruta y los datos; las tablas conservan sus propias RLS.';