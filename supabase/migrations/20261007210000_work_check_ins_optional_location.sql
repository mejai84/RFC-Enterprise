-- RFC Enterprise: ubicación declarada voluntariamente por el employee (ADR-110).
-- Amendment de ADR-108: ya no se prohibe la ubicación, se prohibe el rastreo.
-- La ubicación es opcional, se lee una sola vez a petición del propio empleado y
-- solo entra por esta RPC. Nunca hay lectura automática ni seguimiento continuo.

alter table public.work_check_ins
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_label text,
  add column if not exists location_captured_at timestamptz;

comment on column public.work_check_ins.location_latitude is
  'Punto declarado voluntariamente por el empleado al pulsar el boton de ubicacion. Nulo si no se compartio.';
comment on column public.work_check_ins.location_label is
  'Nombre legible del punto, resuelto de forma opcional. La empresa no lo exige.';
comment on column public.work_check_ins.location_captured_at is
  'Momento en que el empleado compartio su ubicacion. Es el del servidor, no el del navegador.';

alter table public.work_check_ins
  drop constraint if exists work_check_ins_location_range;
alter table public.work_check_ins
  add constraint work_check_ins_location_range check (
    (location_latitude is null and location_longitude is null and location_captured_at is null)
    or (
      location_latitude between -90 and 90
      and location_longitude between -180 and 180
      and location_captured_at is not null
    )
  );

-- La firma anterior de tres argumentos se retira para que no exista una via que
-- permita escribir sin los parametros de ubicacion.
drop function if exists public.register_work_check_in(uuid, text, text);

create or replace function public.register_work_check_in(
  p_project_id uuid,
  p_site_name text,
  p_activity_description text,
  p_location_latitude double precision default null,
  p_location_longitude double precision default null,
  p_location_accuracy_m double precision default null,
  p_location_label text default null
)
returns public.work_check_ins
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_result public.work_check_ins%rowtype;
  v_has_location boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_employee
  from public.employees
  where profile_id = auth.uid() and is_active
  limit 1;

  if not found then
    raise exception 'Tu cuenta no está vinculada a un empleado activo';
  end if;

  if char_length(trim(coalesce(p_site_name, ''))) not between 3 and 160 then
    raise exception 'Indica un sitio entre 3 y 160 caracteres';
  end if;
  if char_length(trim(coalesce(p_activity_description, ''))) not between 3 and 500 then
    raise exception 'Describe la actividad entre 3 y 500 caracteres';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.company_id = v_employee.company_id
  ) then
    raise exception 'La obra elegida no pertenece a tu empresa';
  end if;

  -- La ubicacion es todo o nada: nunca queda media coordenada.
  v_has_location := p_location_latitude is not null and p_location_longitude is not null;

  if v_has_location then
    if p_location_latitude < -90 or p_location_latitude > 90
       or p_location_longitude < -180 or p_location_longitude > 180 then
      raise exception 'La ubicación compartida no es válida';
    end if;
  end if;

  insert into public.work_check_ins (
    company_id, branch_id, employee_id, project_id, site_name, activity_description,
    location_latitude, location_longitude, location_accuracy_m, location_label, location_captured_at
  ) values (
    v_employee.company_id, v_employee.branch_id, v_employee.id, p_project_id,
    trim(p_site_name), trim(p_activity_description),
    case when v_has_location then p_location_latitude end,
    case when v_has_location then p_location_longitude end,
    case when v_has_location then p_location_accuracy_m end,
    case when v_has_location then left(trim(coalesce(p_location_label, '')), 160) end,
    case when v_has_location then now() end
  ) returning * into v_result;

  insert into public.audit_logs (
    company_id, actor_id, entity_type, entity_id, action, after_data
  ) values (
    v_employee.company_id, auth.uid(), 'work_check_in', v_result.id, 'created',
    jsonb_build_object(
      'employee_id', v_employee.id,
      'project_id', p_project_id,
      'site_name', v_result.site_name,
      'activity_description', v_result.activity_description,
      'checked_in_at', v_result.checked_in_at,
      -- Se deja constancia de que hubo o no ubicacion compartida. El punto exacto
      -- queda en el registro, no se duplica en la auditoria.
      'location_shared', v_has_location
    )
  );

  return v_result;
end;
$$;

revoke all on function public.register_work_check_in(uuid, text, text, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.register_work_check_in(uuid, text, text, double precision, double precision, double precision, text) to authenticated;