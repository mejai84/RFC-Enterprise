-- RFC Enterprise: una jornada tiene entrada, salida y tramos consecutivos.
-- Conserva work_check_ins como bitácora inmutable de aperturas para las consultas
-- ya publicadas; workdays/workday_segments aportan el estado operativo.

create table if not exists public.workdays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  local_date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed', 'needs_review')),
  created_at timestamptz not null default now(),
  constraint workdays_ended_after_started check (ended_at is null or ended_at >= started_at),
  constraint workdays_employee_date_unique unique (employee_id, local_date)
);

create table if not exists public.workday_segments (
  id uuid primary key default gen_random_uuid(),
  workday_id uuid not null references public.workdays(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  segment_type text not null default 'work' check (segment_type in ('work', 'travel', 'break')),
  site_name text not null check (char_length(trim(site_name)) between 3 and 160),
  activity_description text not null check (char_length(trim(activity_description)) between 3 and 500),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  location_latitude double precision,
  location_longitude double precision,
  location_accuracy_m double precision,
  location_label text,
  location_captured_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workday_segments_ended_after_started check (ended_at is null or ended_at >= started_at),
  constraint workday_segments_location_range check (
    (location_latitude is null and location_longitude is null and location_captured_at is null)
    or (location_latitude between -90 and 90 and location_longitude between -180 and 180 and location_captured_at is not null)
  )
);

create unique index if not exists workday_segments_one_open_per_workday_idx
  on public.workday_segments (workday_id) where ended_at is null;
create index if not exists workdays_employee_date_idx on public.workdays (employee_id, local_date desc);
create index if not exists workdays_company_date_idx on public.workdays (company_id, local_date desc);
create index if not exists workday_segments_workday_time_idx on public.workday_segments (workday_id, started_at);

alter table public.workdays enable row level security;
alter table public.workday_segments enable row level security;
revoke all on public.workdays, public.workday_segments from anon, authenticated;

create policy workdays_read_own_or_review on public.workdays for select to authenticated using (
  private.can_review_work_check_ins(company_id)
  or exists (select 1 from public.employees e where e.id = workdays.employee_id and e.profile_id = (select auth.uid()))
);
create policy workday_segments_read_own_or_review on public.workday_segments for select to authenticated using (
  exists (
    select 1 from public.workdays w
    where w.id = workday_segments.workday_id
      and (private.can_review_work_check_ins(w.company_id)
        or exists (select 1 from public.employees e where e.id = w.employee_id and e.profile_id = (select auth.uid())))
  )
);
grant select on public.workdays, public.workday_segments to authenticated;

create or replace function private.workday_employee()
returns public.employees
language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
declare v_employee public.employees%rowtype;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_employee from public.employees where profile_id = auth.uid() and is_active limit 1;
  if not found then raise exception 'Tu cuenta no está vinculada a un empleado activo'; end if;
  return v_employee;
end;
$$;
revoke all on function private.workday_employee() from public, anon;

create or replace function private.validate_workday_segment(
  p_project_id uuid, p_site_name text, p_activity_description text,
  p_location_latitude double precision, p_location_longitude double precision
)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_employee public.employees%rowtype := private.workday_employee();
begin
  if char_length(trim(coalesce(p_site_name, ''))) not between 3 and 160 then raise exception 'Indica un sitio entre 3 y 160 caracteres'; end if;
  if char_length(trim(coalesce(p_activity_description, ''))) not between 3 and 500 then raise exception 'Describe la actividad entre 3 y 500 caracteres'; end if;
  if (p_location_latitude is null) <> (p_location_longitude is null) then raise exception 'La ubicación debe incluir ambas coordenadas'; end if;
  if p_location_latitude is not null and (p_location_latitude not between -90 and 90 or p_location_longitude not between -180 and 180) then raise exception 'La ubicación compartida no es válida'; end if;
  if p_project_id is not null and not exists (select 1 from public.projects p where p.id = p_project_id and p.company_id = v_employee.company_id) then raise exception 'La obra elegida no pertenece a tu empresa'; end if;
end;
$$;
revoke all on function private.validate_workday_segment(uuid, text, text, double precision, double precision) from public, anon;

create or replace function public.current_workday()
returns table (
  id uuid, local_date date, started_at timestamptz, ended_at timestamptz, status text,
  current_segment_id uuid, current_segment_type text, project_id uuid, project_label text,
  site_name text, activity_description text, segment_started_at timestamptz
)
language sql stable security invoker set search_path = public as $$
  select w.id, w.local_date, w.started_at, w.ended_at, w.status,
    s.id, s.segment_type, s.project_id,
    case when p.code is null then null else p.code || ' · ' || p.name end,
    s.site_name, s.activity_description, s.started_at
  from public.workdays w
  left join lateral (select * from public.workday_segments where workday_id = w.id and ended_at is null order by started_at desc limit 1) s on true
  left join public.projects p on p.id = s.project_id
  where w.employee_id = (select e.id from public.employees e where e.profile_id = (select auth.uid()) and e.is_active limit 1)
    and w.local_date = (now() at time zone 'America/Bogota')::date
  limit 1;
$$;
revoke all on function public.current_workday() from public, anon;
grant execute on function public.current_workday() to authenticated;

create or replace function public.start_workday(
  p_project_id uuid, p_site_name text, p_activity_description text,
  p_location_latitude double precision default null, p_location_longitude double precision default null,
  p_location_accuracy_m double precision default null, p_location_label text default null
)
returns public.workdays language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_employee public.employees%rowtype := private.workday_employee(); v_day public.workdays%rowtype; v_now timestamptz := now(); v_date date := (now() at time zone 'America/Bogota')::date;
begin
  perform private.validate_workday_segment(p_project_id, p_site_name, p_activity_description, p_location_latitude, p_location_longitude);
  update public.workdays set status = 'needs_review'
    where employee_id = v_employee.id and status = 'open' and local_date < v_date;
  if exists (select 1 from public.workdays where employee_id = v_employee.id and local_date = v_date) then raise exception 'Ya tienes una jornada registrada para hoy'; end if;
  insert into public.workdays (company_id, branch_id, employee_id, local_date, started_at) values (v_employee.company_id, v_employee.branch_id, v_employee.id, v_date, v_now) returning * into v_day;
  insert into public.workday_segments (workday_id, project_id, site_name, activity_description, started_at, location_latitude, location_longitude, location_accuracy_m, location_label, location_captured_at)
  values (v_day.id, p_project_id, trim(p_site_name), trim(p_activity_description), v_now, p_location_latitude, p_location_longitude, p_location_accuracy_m, left(trim(coalesce(p_location_label, '')),160), case when p_location_latitude is null then null else v_now end);
  insert into public.work_check_ins (company_id, branch_id, employee_id, project_id, site_name, activity_description, checked_in_at)
  values (v_employee.company_id, v_employee.branch_id, v_employee.id, p_project_id, trim(p_site_name), trim(p_activity_description), v_now);
  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, after_data) values (v_employee.company_id, auth.uid(), 'workday', v_day.id, 'started', jsonb_build_object('local_date',v_date,'site_name',trim(p_site_name),'location_shared',p_location_latitude is not null));
  return v_day;
end;
$$;

create or replace function public.change_workday_segment(
  p_segment_type text, p_project_id uuid, p_site_name text, p_activity_description text,
  p_location_latitude double precision default null, p_location_longitude double precision default null,
  p_location_accuracy_m double precision default null, p_location_label text default null
)
returns public.workday_segments language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_employee public.employees%rowtype := private.workday_employee(); v_day public.workdays%rowtype; v_segment public.workday_segments%rowtype; v_now timestamptz := now();
begin
  if p_segment_type not in ('work','travel','break') then raise exception 'El tipo de tramo no es válido'; end if;
  perform private.validate_workday_segment(p_project_id, p_site_name, p_activity_description, p_location_latitude, p_location_longitude);
  select * into v_day from public.workdays where employee_id = v_employee.id and local_date = (v_now at time zone 'America/Bogota')::date for update;
  if not found or v_day.status <> 'open' then raise exception 'Inicia tu jornada antes de cambiar de actividad'; end if;
  update public.workday_segments set ended_at = v_now where workday_id = v_day.id and ended_at is null;
  insert into public.workday_segments (workday_id, project_id, segment_type, site_name, activity_description, started_at, location_latitude, location_longitude, location_accuracy_m, location_label, location_captured_at)
  values (v_day.id, p_project_id, p_segment_type, trim(p_site_name), trim(p_activity_description), v_now, p_location_latitude, p_location_longitude, p_location_accuracy_m, left(trim(coalesce(p_location_label, '')),160), case when p_location_latitude is null then null else v_now end) returning * into v_segment;
  insert into public.work_check_ins (company_id, branch_id, employee_id, project_id, site_name, activity_description, checked_in_at)
  values (v_employee.company_id, v_employee.branch_id, v_employee.id, p_project_id, trim(p_site_name), trim(p_activity_description), v_now);
  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, after_data) values (v_employee.company_id, auth.uid(), 'workday_segment', v_segment.id, 'opened', jsonb_build_object('workday_id',v_day.id,'type',p_segment_type,'site_name',trim(p_site_name),'location_shared',p_location_latitude is not null));
  return v_segment;
end;
$$;

create or replace function public.finish_workday(
  p_location_latitude double precision default null, p_location_longitude double precision default null,
  p_location_accuracy_m double precision default null, p_location_label text default null
)
returns public.workdays language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_employee public.employees%rowtype := private.workday_employee(); v_day public.workdays%rowtype; v_now timestamptz := now();
begin
  if (p_location_latitude is null) <> (p_location_longitude is null) then raise exception 'La ubicación debe incluir ambas coordenadas'; end if;
  if p_location_latitude is not null and (p_location_latitude not between -90 and 90 or p_location_longitude not between -180 and 180) then raise exception 'La ubicación compartida no es válida'; end if;
  select * into v_day from public.workdays where employee_id = v_employee.id and local_date = (v_now at time zone 'America/Bogota')::date for update;
  if not found or v_day.status <> 'open' then raise exception 'No tienes una jornada abierta para finalizar'; end if;
  update public.workday_segments set ended_at = v_now,
    location_latitude = coalesce(p_location_latitude, location_latitude), location_longitude = coalesce(p_location_longitude, location_longitude), location_accuracy_m = coalesce(p_location_accuracy_m, location_accuracy_m), location_label = coalesce(left(trim(coalesce(p_location_label, '')),160), location_label), location_captured_at = case when p_location_latitude is null then location_captured_at else v_now end
    where workday_id = v_day.id and ended_at is null;
  update public.workdays set ended_at = v_now, status = 'closed' where id = v_day.id returning * into v_day;
  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, after_data) values (v_employee.company_id, auth.uid(), 'workday', v_day.id, 'finished', jsonb_build_object('ended_at',v_now,'location_shared',p_location_latitude is not null));
  return v_day;
end;
$$;

revoke all on function public.start_workday(uuid,text,text,double precision,double precision,double precision,text), public.change_workday_segment(text,uuid,text,text,double precision,double precision,double precision,text), public.finish_workday(double precision,double precision,double precision,text) from public, anon;
grant execute on function public.start_workday(uuid,text,text,double precision,double precision,double precision,text), public.change_workday_segment(text,uuid,text,text,double precision,double precision,double precision,text), public.finish_workday(double precision,double precision,double precision,text) to authenticated;
