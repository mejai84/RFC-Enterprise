-- RFC Enterprise: declaración de presencia y actividad en obra.
-- No captura GPS ni coordenadas. La hora es siempre la del servidor.

create table if not exists public.work_check_ins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  site_name text not null check (char_length(trim(site_name)) between 3 and 160),
  activity_description text not null check (char_length(trim(activity_description)) between 3 and 500),
  checked_in_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists work_check_ins_employee_time_idx
  on public.work_check_ins (employee_id, checked_in_at desc);
create index if not exists work_check_ins_company_time_idx
  on public.work_check_ins (company_id, checked_in_at desc);
create index if not exists work_check_ins_project_time_idx
  on public.work_check_ins (project_id, checked_in_at desc)
  where project_id is not null;

-- Dirección, residentes y auditoría pueden consultar la trazabilidad de la empresa.
-- `management` se incluye porque el dueño opera con ese rol y también necesita
-- la consulta gerencial; sin él, el dueño quedaría sin visibilidad.
create or replace function private.can_review_work_check_ins(target_company uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = target_company
      and r.code in ('administrator', 'resident_engineer', 'auditor', 'management')
  );
$$;

revoke all on function private.can_review_work_check_ins(uuid) from public, anon;
grant execute on function private.can_review_work_check_ins(uuid) to authenticated;

alter table public.work_check_ins enable row level security;
revoke all on table public.work_check_ins from anon, authenticated;
grant select on table public.work_check_ins to authenticated;

create policy work_check_ins_read_own_or_review on public.work_check_ins
  for select to authenticated
  using (
    private.can_review_work_check_ins(company_id)
    or exists (
      select 1 from public.employees e
      where e.id = work_check_ins.employee_id
        and e.profile_id = (select auth.uid())
    )
  );

-- La declaración es inmutable: no existe política de actualización ni de borrado,
-- el navegador no tiene esos permisos y un disparador lo impide incluso desde el
-- propio servidor. Un borrado por retención legal exigiría una migración que
-- deshabilite el disparador de forma explícita y auditada.
create or replace function private.deny_work_check_in_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Un registro de jornada no se puede modificar ni eliminar';
end;
$$;

drop trigger if exists work_check_ins_immutable on public.work_check_ins;
create trigger work_check_ins_immutable
  before update or delete on public.work_check_ins
  for each row execute function private.deny_work_check_in_mutation();

-- La inserción se hace exclusivamente por RPC: así el navegador no puede
-- elegir otra persona, empresa ni una hora distinta a la del servidor.
create or replace function public.register_work_check_in(
  p_project_id uuid,
  p_site_name text,
  p_activity_description text
)
returns public.work_check_ins
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_result public.work_check_ins%rowtype;
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

  insert into public.work_check_ins (
    company_id, branch_id, employee_id, project_id, site_name, activity_description
  ) values (
    v_employee.company_id, v_employee.branch_id, v_employee.id, p_project_id,
    trim(p_site_name), trim(p_activity_description)
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
      'checked_in_at', v_result.checked_in_at
    )
  );

  return v_result;
end;
$$;

revoke all on function public.register_work_check_in(uuid, text, text) from public, anon;
grant execute on function public.register_work_check_in(uuid, text, text) to authenticated;
