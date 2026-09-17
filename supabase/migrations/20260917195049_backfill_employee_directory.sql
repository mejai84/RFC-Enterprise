-- Sincroniza las cuentas que ya pertenecen a la empresa con el directorio
-- laboral. No modifica las fichas existentes: solo las enlaza si aún no tienen
-- perfil, y conserva tanto sus cargos como sus estados.
insert into public.employees (
  company_id,
  branch_id,
  profile_id,
  full_name,
  email,
  job_title,
  is_active
)
select distinct on (ur.company_id, lower(p.email))
  ur.company_id,
  ur.branch_id,
  p.id,
  coalesce(nullif(trim(p.display_name), ''), lower(trim(p.email))),
  lower(trim(p.email)),
  'Usuario del portal',
  p.is_active
from public.user_roles ur
join public.profiles p on p.id = ur.user_id
where p.email is not null
  and trim(p.email) <> ''
order by ur.company_id, lower(p.email), ur.branch_id nulls last
on conflict (company_id, lower(email)) do update
set profile_id = excluded.profile_id
where public.employees.profile_id is null;

-- Replica en el directorio los roles que ya determinan el acceso al portal.
insert into public.employee_roles (employee_id, role_id)
select e.id, ur.role_id
from public.user_roles ur
join public.profiles p on p.id = ur.user_id
join public.employees e
  on e.company_id = ur.company_id
 and lower(e.email) = lower(p.email)
on conflict (employee_id, role_id) do nothing;
