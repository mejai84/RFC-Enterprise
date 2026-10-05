-- Perfiles operativos reutilizables. Los permisos individuales se manejan como excepciones.
insert into public.roles (code, name, description) values
  ('management', 'Gerencial', 'Consulta ejecutiva y seguimiento de proyectos sin administrar usuarios.'),
  ('administrative_assistant', 'Auxiliar administrativo', 'Apoyo documental, consulta de proyectos e inventario.'),
  ('administrative_staff', 'Administrativo', 'Gestión operativa y documental sin control de existencias.'),
  ('warehouse_operator', 'Almacenista', 'Recibe, controla y despacha materiales y herramientas.'),
  ('welder', 'Soldador', 'Consulta de obra, materiales autorizados y herramientas asignadas.'),
  ('field_worker', 'Obrero / ayudante', 'Consulta de obra y solicitud de insumos desde el frente de trabajo.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on p.code = any(
  case r.code
    when 'management' then array['dashboard.financials.view','dashboard.intelligence.view','projects.view','inventory.catalog.view','inventory.kardex.view','core.settings.read']
    when 'administrative_assistant' then array['projects.view','projects.requisitions.create','inventory.catalog.view','core.settings.read']
    when 'administrative_staff' then array['projects.view','projects.requisitions.create','projects.requisitions.approve','inventory.catalog.view','inventory.kardex.view','core.settings.read']
    when 'warehouse_operator' then array['projects.view','inventory.catalog.view','inventory.stock.manage','inventory.dispatch.create','inventory.return.create','inventory.tools.manage','inventory.kardex.view']
    when 'welder' then array['projects.view','projects.requisitions.create','inventory.catalog.view','inventory.return.create']
    when 'field_worker' then array['projects.view','projects.requisitions.create','inventory.catalog.view']
    else array[]::text[]
  end
)
on conflict do nothing;
