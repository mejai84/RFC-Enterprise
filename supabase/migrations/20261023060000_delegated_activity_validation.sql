-- Registro delegado auditable de actividades.
-- El compañero nunca suplanta al trabajador: deja una novedad provisional que
-- debe ser confirmada por el beneficiario o validada por un responsable.

create table if not exists public.delegated_activity_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  beneficiary_employee_id uuid not null references public.employees(id) on delete restrict,
  reported_by_user_id uuid not null references auth.users(id) on delete restrict,
  reported_by_employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  site_name text not null check (char_length(trim(site_name)) between 3 and 160),
  activity_description text not null check (char_length(trim(activity_description)) between 3 and 500),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  status text not null default 'pending_validation'
    check (status in ('pending_validation', 'confirmed_by_worker', 'verified_by_supervisor', 'rejected')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(trim(review_note)) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delegated_activity_reports_review_state check (
    (status = 'pending_validation' and reviewed_at is null and reviewed_by_user_id is null)
    or (status <> 'pending_validation' and reviewed_at is not null and reviewed_by_user_id is not null)
  )
);

create index if not exists delegated_activity_reports_company_status_created_idx
  on public.delegated_activity_reports (company_id, status, created_at desc);
create index if not exists delegated_activity_reports_beneficiary_status_created_idx
  on public.delegated_activity_reports (beneficiary_employee_id, status, created_at desc);

alter table public.delegated_activity_reports enable row level security;
revoke all on public.delegated_activity_reports from anon, authenticated;

insert into public.permissions (code, name, description) values
  ('attendance.delegated.request', 'Reportar actividad por un compañero', 'Crear una novedad provisional para otro trabajador, identificando al autor.'),
  ('attendance.team.review', 'Validar actividades delegadas', 'Confirmar o rechazar novedades delegadas de la empresa.')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any (
  case r.code
    when 'field_worker' then array['attendance.delegated.request']
    when 'foreman' then array['attendance.delegated.request', 'attendance.team.review']
    when 'warehouse_lead' then array['attendance.delegated.request', 'attendance.team.review']
    when 'resident_engineer' then array['attendance.delegated.request', 'attendance.team.review']
    when 'management' then array['attendance.delegated.request', 'attendance.team.review']
    when 'general_management' then array['attendance.delegated.request', 'attendance.team.review']
    when 'administrator' then array['attendance.delegated.request', 'attendance.team.review']
    else array[]::text[]
  end
)
on conflict do nothing;

-- La consulta de jornadas usa ahora una capacidad, no una lista rígida de roles.
create or replace function private.can_review_work_check_ins(target_company uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.profile_id = (select auth.uid()) and e.company_id = target_company and e.is_active
  ) and exists (
    select 1 from public.my_effective_permissions() where code = 'attendance.team.review'
  );
$$;

create or replace function public.create_delegated_activity_report(
  p_beneficiary_employee_id uuid, p_project_id uuid, p_site_name text,
  p_activity_description text, p_reason text
)
returns public.delegated_activity_reports
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor public.employees%rowtype; v_beneficiary public.employees%rowtype; v_report public.delegated_activity_reports%rowtype;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.my_effective_permissions() where code = 'attendance.delegated.request') then
    raise exception 'Permiso insuficiente para registrar una actividad por un compañero';
  end if;
  select * into v_actor from public.employees where profile_id = auth.uid() and is_active limit 1;
  if not found then raise exception 'Tu cuenta no está vinculada a un empleado activo'; end if;
  select * into v_beneficiary from public.employees where id = p_beneficiary_employee_id and company_id = v_actor.company_id and is_active;
  if not found then raise exception 'El compañero seleccionado no existe, no está activo o no pertenece a tu empresa'; end if;
  if v_beneficiary.id = v_actor.id then raise exception 'Para registrar tu propia actividad usa tu jornada'; end if;
  if char_length(trim(coalesce(p_site_name, ''))) not between 3 and 160 then raise exception 'Indica un sitio entre 3 y 160 caracteres'; end if;
  if char_length(trim(coalesce(p_activity_description, ''))) not between 3 and 500 then raise exception 'Describe la actividad entre 3 y 500 caracteres'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then raise exception 'Indica el motivo del registro delegado'; end if;
  if p_project_id is not null and not exists (select 1 from public.projects p where p.id = p_project_id and p.company_id = v_actor.company_id) then raise exception 'La obra elegida no pertenece a tu empresa'; end if;
  insert into public.delegated_activity_reports (company_id, branch_id, beneficiary_employee_id, reported_by_user_id, reported_by_employee_id, project_id, site_name, activity_description, reason)
  values (v_actor.company_id, v_beneficiary.branch_id, v_beneficiary.id, auth.uid(), v_actor.id, p_project_id, trim(p_site_name), trim(p_activity_description), trim(p_reason))
  returning * into v_report;
  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, after_data)
  values (v_actor.company_id, auth.uid(), 'delegated_activity_report', v_report.id, 'created', jsonb_build_object('beneficiary_employee_id', v_beneficiary.id, 'reported_by_employee_id', v_actor.id, 'status', v_report.status));
  return v_report;
end;
$$;

create or replace function public.review_delegated_activity_report(p_report_id uuid, p_decision text, p_review_note text default null)
returns public.delegated_activity_reports
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_report public.delegated_activity_reports%rowtype; v_reviewer public.employees%rowtype; v_is_beneficiary boolean; v_can_review boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_decision not in ('confirm', 'reject') then raise exception 'La decisión no es válida'; end if;
  if char_length(trim(coalesce(p_review_note, ''))) > 500 then raise exception 'La nota de validación no puede superar 500 caracteres'; end if;
  select * into v_report from public.delegated_activity_reports where id = p_report_id for update;
  if not found then raise exception 'La actividad delegada no existe'; end if;
  if v_report.status <> 'pending_validation' then raise exception 'La actividad ya fue validada'; end if;
  select * into v_reviewer from public.employees where profile_id = auth.uid() and is_active limit 1;
  if not found or v_reviewer.company_id <> v_report.company_id then raise exception 'Tu cuenta no está autorizada para validar esta actividad'; end if;
  v_is_beneficiary := v_reviewer.id = v_report.beneficiary_employee_id;
  v_can_review := exists (select 1 from public.my_effective_permissions() where code = 'attendance.team.review');
  if not v_is_beneficiary and not v_can_review then raise exception 'No tienes permiso para validar esta actividad'; end if;
  update public.delegated_activity_reports
  set status = case when p_decision = 'reject' then 'rejected' when v_is_beneficiary then 'confirmed_by_worker' else 'verified_by_supervisor' end,
      reviewed_by_user_id = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(p_review_note, '')), ''), updated_at = now()
  where id = v_report.id returning * into v_report;
  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, after_data)
  values (v_report.company_id, auth.uid(), 'delegated_activity_report', v_report.id, 'reviewed', jsonb_build_object('decision', p_decision, 'status', v_report.status, 'reviewer_employee_id', v_reviewer.id));
  return v_report;
end;
$$;

create or replace function public.list_delegated_activity_reports(p_limit integer default 30)
returns table (id uuid, beneficiary_employee_id uuid, beneficiary_name text, reporter_name text, project_id uuid, project_label text, site_name text, activity_description text, reason text, status text, created_at timestamptz, reviewed_at timestamptz, review_note text)
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_me public.employees%rowtype; v_can_review boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_me from public.employees where profile_id = auth.uid() and is_active limit 1;
  if not found then raise exception 'Tu cuenta no está vinculada a un empleado activo'; end if;
  v_can_review := exists (select 1 from public.my_effective_permissions() where code = 'attendance.team.review');
  return query select r.id, r.beneficiary_employee_id, beneficiary.full_name, reporter.full_name, r.project_id,
    case when p.id is null then null else p.code || ' · ' || p.name end, r.site_name, r.activity_description, r.reason, r.status, r.created_at, r.reviewed_at, r.review_note
  from public.delegated_activity_reports r
  join public.employees beneficiary on beneficiary.id = r.beneficiary_employee_id
  left join public.employees reporter on reporter.id = r.reported_by_employee_id
  left join public.projects p on p.id = r.project_id
  where r.company_id = v_me.company_id and (v_can_review or r.beneficiary_employee_id = v_me.id or r.reported_by_user_id = auth.uid())
  order by (r.status = 'pending_validation') desc, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.create_delegated_activity_report(uuid, uuid, text, text, text), public.review_delegated_activity_report(uuid, text, text), public.list_delegated_activity_reports(integer) from public, anon;
grant execute on function public.create_delegated_activity_report(uuid, uuid, text, text, text), public.review_delegated_activity_report(uuid, text, text), public.list_delegated_activity_reports(integer) to authenticated;

-- El RPC anterior dejaba una entrada definitiva sin validación. Los clientes
-- actualizados usan el flujo anterior y los desactualizados quedan bloqueados.
revoke execute on function public.register_delegated_check_in(uuid, uuid, text, text) from authenticated;
