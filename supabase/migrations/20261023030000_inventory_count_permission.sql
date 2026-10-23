-- Asegura que exista el permiso de conciliación de conteo y se asigne a administradores.
insert into public.permissions (code, name)
values ('inventory.count.approve', 'Conciliar y cerrar la jornada de conteo físico')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'administrator'
  and p.code = 'inventory.count.approve'
on conflict (role_id, permission_id) do nothing;