-- RFC Enterprise: consulta gerencial de declaraciones de jornada.
-- Solo lectura. El día local se calcula en el servidor para que el filtro de
-- período coincida con el calendario del usuario y no con el del navegador.

create or replace function public.list_work_check_ins(
  p_from date,
  p_to date,
  p_employee_id uuid default null,
  p_project_id uuid default null,
  p_search text default null,
  p_limit integer default 800
)
returns table (
  id uuid,
  employee_id uuid,
  employee_name text,
  project_label text,
  project_id uuid,
  site_name text,
  activity_description text,
  checked_in_at timestamptz,
  local_date date,
  local_time text
)
language sql
stable
security invoker
set search_path = public
as $$
  with visible as (
    select w.*
    from public.work_check_ins w
    where w.company_id in (
      select ur.company_id from public.user_roles ur where ur.user_id = (select auth.uid())
    )
  )
  select
    w.id,
    w.employee_id,
    coalesce(e.full_name, 'Empleado') as employee_name,
    case when p.code is null then null else p.code || ' · ' || p.name end as project_label,
    w.project_id,
    w.site_name,
    w.activity_description,
    w.checked_in_at,
    (w.checked_in_at at time zone 'America/Bogota')::date as local_date,
    to_char(w.checked_in_at at time zone 'America/Bogota', 'HH24:MI') as local_time
  from visible w
  left join public.employees e on e.id = w.employee_id
  left join public.projects p on p.id = w.project_id
  where (w.checked_in_at at time zone 'America/Bogota')::date between p_from and p_to
    and (p_employee_id is null or w.employee_id = p_employee_id)
    and (p_project_id is null or w.project_id = p_project_id)
    and (
      p_search is null
      or btrim(p_search) = ''
      or e.full_name ilike '%' || btrim(p_search) || '%'
      or w.site_name ilike '%' || btrim(p_search) || '%'
      or w.activity_description ilike '%' || btrim(p_search) || '%'
    )
  order by w.checked_in_at desc
  limit least(greatest(coalesce(p_limit, 800), 1), 2000);
$$;

revoke all on function public.list_work_check_ins(date, date, uuid, uuid, text, integer) from public, anon;
grant execute on function public.list_work_check_ins(date, date, uuid, uuid, text, integer) to authenticated;

comment on function public.list_work_check_ins(date, date, uuid, uuid, text, integer) is
  'Consulta gerencial de declaraciones de jornada. Respeta RLS: un empleado solo recibe los propios registros y solo los perfiles de consulta autorizados reciben los del equipo.';