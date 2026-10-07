-- RFC Enterprise: el administrador recibe APU por rol y no por excepciones individuales.
--
-- Los cuatro administradores actuales tenian `apu.view` y `apu.manage` como
-- excepciones individuales en `employee_permission_overrides`. Eso hacia que un
-- administrador recien creado quedara sin APU, y que quitar una excepcion cerrara
-- el modulo para alguien a quien administracion si considera autorizado. Aqui el
-- acceso se otorga por rol y se retiran las excepciones que quedan redundantes.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('apu.view', 'apu.manage')
where r.code = 'administrator'
on conflict do nothing;

-- El rol administrador ya no depende de filas individuales para APU.
delete from public.employee_permission_overrides o
using public.employees e, public.permissions p
where o.employee_id = e.id
  and o.permission_id = p.id
  and p.code in ('apu.view', 'apu.manage')
  and exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = e.profile_id
      and rp.permission_id = o.permission_id
  );

-- Comprobacion: quien tiene el rol administrador conserva APU sin excepciones.
do $$
declare
  v_sin_apu integer;
begin
  select count(*) into v_sin_apu
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where r.code = 'administrator'
    and not exists (
      select 1
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where rp.role_id = r.id and p.code in ('apu.view', 'apu.manage')
    );
  if v_sin_apu > 0 then
    raise exception 'El rol administrador quedo sin permisos de APU';
  end if;
end;
$$;