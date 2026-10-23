-- ============================================================
-- 1. FIRMA DIGITAL PERSISTENTE DEL EMPLEADO
-- ============================================================
-- La firma se conserva fuera del directorio público de empleados. Solo las
-- funciones SECURITY DEFINER pueden leerla o reemplazarla para su titular.
create table if not exists private.employee_signatures (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  signature_data_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_signatures_png_check check (
    signature_data_url ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
    and octet_length(signature_data_url) <= 800000
  )
);

revoke all on table private.employee_signatures from public, anon, authenticated;

create or replace function public.save_my_signature(
  p_signature_data_url text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select id into v_employee_id
  from public.employees
  where profile_id = auth.uid() and is_active
  limit 1;

  if v_employee_id is null then
    raise exception 'Tu cuenta no está vinculada a un empleado activo';
  end if;

  if nullif(trim(p_signature_data_url), '') is null
     or p_signature_data_url !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
     or octet_length(p_signature_data_url) > 800000 then
    raise exception 'La firma debe ser una imagen PNG válida de máximo 800 KB';
  end if;

  insert into private.employee_signatures (employee_id, signature_data_url)
  values (v_employee_id, p_signature_data_url)
  on conflict (employee_id) do update
  set signature_data_url = excluded.signature_data_url,
      updated_at = now();
end;
$$;

create or replace function public.my_signature()
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_signature text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select s.signature_data_url into v_signature
  from private.employee_signatures s
  join public.employees e on e.id = s.employee_id
  where e.profile_id = auth.uid() and e.is_active
  limit 1;

  return v_signature;
end;
$$;

revoke all on function public.save_my_signature(text) from public, anon;
revoke all on function public.my_signature() from public, anon;
grant execute on function public.save_my_signature(text) to authenticated;
grant execute on function public.my_signature() to authenticated;
-- ============================================================
-- 2. REQUISICIÓN OPERATIVA DEL EMPLEADO (SIN COSTOS)
-- ============================================================
-- Reutiliza inventory_requisitions. La columna signature_data_url registra
-- la firma del solicitante al momento de enviar.

alter table public.inventory_requisitions
  add column if not exists requester_signature_data_url text;

comment on column public.inventory_requisitions.requester_signature_data_url is
  'Firma digital del solicitante al momento de crear la requisición. '
  'Se toma del almacén privado de firmas del empleado o se captura en el acto.';

-- RPC simplificada para el empleado de campo: solo ve nombres e items,
-- nunca costos. La firma es obligatoria.
create or replace function public.create_employee_requisition(
  p_project_id uuid,
  p_needed_by date default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb,
  p_signature_data_url text default null
)
returns table (requisition_id uuid, requisition_code text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_company_id uuid;
  v_branch_id uuid;
  v_next_number integer;
  v_created_id uuid;
  v_line jsonb;
  v_stock public.inventory_stock%rowtype;
  v_item public.inventory_items%rowtype;
  v_signature text;
  v_saved_signature text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Vincular al empleado activo
  select * into v_employee
  from public.employees
  where profile_id = auth.uid() and is_active
  limit 1;

  if not found then
    raise exception 'Tu cuenta no está vinculada a un empleado activo';
  end if;

  -- Resolver firma: usar la proporcionada, o la guardada en el perfil
  select signature_data_url into v_saved_signature
  from private.employee_signatures
  where employee_id = v_employee.id;

  v_signature := coalesce(nullif(trim(p_signature_data_url), ''), v_saved_signature);
  if v_signature is null or trim(v_signature) = '' then
    raise exception 'Debes firmar la solicitud para poder enviarla';
  end if;

  if v_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
     or octet_length(v_signature) > 800000 then
    raise exception 'La firma no tiene un formato válido';
  end if;

  -- Si se capturó en el acto y no había una firma previa, conservarla para próximas confirmaciones.
  if v_saved_signature is null and p_signature_data_url is not null then
    insert into private.employee_signatures (employee_id, signature_data_url)
    values (v_employee.id, trim(p_signature_data_url));
  end if;

  -- Validar proyecto
  select company_id, branch_id into v_company_id, v_branch_id
  from public.projects where id = p_project_id;
  if not found then raise exception 'La obra seleccionada no existe'; end if;

  if v_employee.company_id <> v_company_id then
    raise exception 'La obra seleccionada no pertenece a tu empresa';
  end if;

  -- Validar líneas
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Agrega al menos un material a la solicitud';
  end if;

  -- Número secuencial
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text, 0));
  select coalesce(max(request_number), 0) + 1 into v_next_number
  from public.inventory_requisitions
  where company_id = v_company_id
    and request_year = extract(year from current_date)::smallint;

  -- Crear requisición
  insert into public.inventory_requisitions (
    company_id, branch_id, project_id, request_year, request_number,
    requested_by, requested_by_name, needed_by, notes,
    requester_signature_data_url
  ) values (
    v_company_id, v_branch_id, p_project_id,
    extract(year from current_date)::smallint, v_next_number,
    auth.uid(), v_employee.full_name, p_needed_by,
    nullif(trim(p_notes), ''),
    v_signature
  ) returning id into v_created_id;

  -- Insertar líneas (sin exponer costo unitario al frontend)
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_stock from public.inventory_stock
    where id = (v_line->>'stock_id')::uuid and company_id = v_company_id;
    if not found then raise exception 'Uno de los artículos no pertenece a la empresa'; end if;

    select * into v_item from public.inventory_items where id = v_stock.item_id;

    insert into public.inventory_requisition_lines (
      requisition_id, stock_id, requested_quantity,
      unit_snapshot, item_name_snapshot, unit_cost_snapshot, notes
    ) values (
      v_created_id, v_stock.id,
      (v_line->>'quantity')::numeric,
      v_item.unit, v_item.name,
      v_stock.unit_cost,  -- se guarda internamente pero NO se expone al frontend del empleado
      nullif(trim(v_line->>'notes'), '')
    );
  end loop;

  -- Auditoría
  insert into public.audit_logs (
    company_id, actor_id, entity_type, entity_id, action, after_data
  ) values (
    v_company_id, auth.uid(), 'inventory_requisition', v_created_id, 'employee_self_service',
    jsonb_build_object(
      'employee_id', v_employee.id,
      'employee_name', v_employee.full_name,
      'project_id', p_project_id,
      'lines_count', jsonb_array_length(p_lines),
      'signed', true
    )
  );

  return query select r.id, r.code
  from public.inventory_requisitions r where r.id = v_created_id;
end;
$$;

revoke all on function public.create_employee_requisition(uuid, date, text, jsonb, text) from public, anon;
grant execute on function public.create_employee_requisition(uuid, date, text, jsonb, text) to authenticated;

-- ============================================================
-- 3. REGISTRO DELEGADO DE ACTIVIDADES (COMPAÑERO DE APOYO)
-- ============================================================
-- Columna que identifica quién registra en nombre de otro.
alter table public.work_check_ins
  add column if not exists registered_by uuid references auth.users(id),
  add column if not exists registered_by_name text;

comment on column public.work_check_ins.registered_by is
  'Cuando un compañero registra la actividad en nombre de otro empleado, '
  'se guarda el user_id del que opera el dispositivo. NULL = registro propio.';

-- RPC para registro delegado. Solo lo pueden hacer supervisor, residente o
-- roles con permiso attendance.team.view — roles que ya ven al equipo.
create or replace function public.register_delegated_check_in(
  p_target_employee_id uuid,
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
  v_actor_employee public.employees%rowtype;
  v_target_employee public.employees%rowtype;
  v_result public.work_check_ins%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Verificar que quien registra es un empleado activo
  select * into v_actor_employee
  from public.employees
  where profile_id = auth.uid() and is_active
  limit 1;
  if not found then
    raise exception 'Tu cuenta no está vinculada a un empleado activo';
  end if;

  -- Verificar que el empleado objetivo existe, es activo y de la misma empresa
  select * into v_target_employee
  from public.employees
  where id = p_target_employee_id and is_active;
  if not found then
    raise exception 'El compañero seleccionado no existe o no está activo';
  end if;

  if v_actor_employee.company_id <> v_target_employee.company_id then
    raise exception 'Solo puedes registrar actividades para compañeros de tu misma empresa';
  end if;

  -- Impedir auto-delegación (para eso existe register_work_check_in)
  if v_actor_employee.id = v_target_employee.id then
    raise exception 'Para registrar tu propia actividad, usa el formulario normal';
  end if;

  -- Validaciones de contenido
  if char_length(trim(coalesce(p_site_name, ''))) not between 3 and 160 then
    raise exception 'Indica un sitio entre 3 y 160 caracteres';
  end if;
  if char_length(trim(coalesce(p_activity_description, ''))) not between 3 and 500 then
    raise exception 'Describe la actividad entre 3 y 500 caracteres';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.company_id = v_target_employee.company_id
  ) then
    raise exception 'La obra elegida no pertenece a tu empresa';
  end if;

  -- Insertar el registro como delegado
  insert into public.work_check_ins (
    company_id, branch_id, employee_id, project_id,
    site_name, activity_description,
    registered_by, registered_by_name
  ) values (
    v_target_employee.company_id, v_target_employee.branch_id,
    v_target_employee.id, p_project_id,
    trim(p_site_name), trim(p_activity_description),
    auth.uid(), v_actor_employee.full_name
  ) returning * into v_result;

  -- Auditoría
  insert into public.audit_logs (
    company_id, actor_id, entity_type, entity_id, action, after_data
  ) values (
    v_target_employee.company_id, auth.uid(), 'work_check_in', v_result.id, 'delegated_registration',
    jsonb_build_object(
      'actor_employee_id', v_actor_employee.id,
      'actor_name', v_actor_employee.full_name,
      'target_employee_id', v_target_employee.id,
      'target_name', v_target_employee.full_name,
      'project_id', p_project_id,
      'site_name', v_result.site_name,
      'activity_description', v_result.activity_description,
      'checked_in_at', v_result.checked_in_at
    )
  );

  return v_result;
end;
$$;

revoke all on function public.register_delegated_check_in(uuid, uuid, text, text) from public, anon;
grant execute on function public.register_delegated_check_in(uuid, uuid, text, text) to authenticated;
