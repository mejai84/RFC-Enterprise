-- RFC Enterprise: Permisos adicionales para Cotizaciones y validación de transiciones
-- Añade quotes.approve y quotes.convert, y refuerza save_quote_with_history

-- 1. Permisos nuevos
insert into public.permissions (code, name, description) values
  ('quotes.approve', 'Aprobar cotizaciones', 'Aprobar condiciones económicas cuando el negocio lo requiera'),
  ('quotes.convert', 'Convertir a obra', 'Autorizar conversión a obra cuando se cumplan los requisitos')
on conflict (code) do update set name = excluded.name, description = excluded.description;

-- 2. Asignación a roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('quotes.approve', 'quotes.convert')
where r.code in ('administrator', 'general_management', 'management', 'resident_engineer')
on conflict do nothing;

-- 3. Refuerzo de save_quote_with_history: validar permiso quotes.manage y matriz de transiciones
create or replace function public.save_quote_with_history(
  p_company_id uuid,
  p_quote jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_quote_id uuid := (p_quote->>'id')::uuid;
  v_actor text;
  v_entry jsonb;
  v_missing int;
  v_old_status text;
  v_new_status text := p_quote->>'status';
  v_has_manage_perm boolean;
  v_allowed_transitions text[] := array[
    'received', 'in_review', 'estimating', 'sent', 'awaiting_response',
    'revision_requested', 'confirmed', 'in_execution', 'work_completed',
    'billing_pending', 'closed', 'lost'
  ];
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Verificar membresía empresarial
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.company_id = p_company_id
  ) then
    raise exception 'No autorizado para esta empresa';
  end if;

  -- Verificar permiso quotes.manage
  select exists (
    select 1 from public.my_effective_permissions() where code = 'quotes.manage'
  ) into v_has_manage_perm;
  if not v_has_manage_perm then
    raise exception 'Permiso insuficiente: se requiere quotes.manage';
  end if;

  if v_quote_id is null then
    raise exception 'La cotización no tiene identificador';
  end if;

  -- Actor real de la sesión
  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Usuario')
    into v_actor
  from public.profiles p
  where p.id = auth.uid();

  -- Obtener estado anterior para validar transición
  select status into v_old_status from public.quotes where id = v_quote_id and company_id = p_company_id;

  -- Validar transición de estado si cambió
  if v_old_status is not null and v_new_status is not null and v_old_status <> v_new_status then
    if not exists (
      select 1 from public.quote_status_transitions
      where from_status = v_old_status and to_status = v_new_status
    ) then
      raise exception 'Transición de estado no permitida: % -> %', v_old_status, v_new_status;
    end if;
  end if;

  -- Insertar/actualizar cotización
  insert into public.quotes as q (
    id, company_id, code, title, client, contact_name, contact_email, contact_phone,
    email_origin, status, responsible, estimated_value, revision, cost_breakdown,
    technical_visit, technical_visits, validity_days, sent_at, delivery_time_weeks, payment_terms,
    folder_url, received_at, deadline, next_action, project_id, notes, request_body,
    created_at, updated_at
  ) values (
    v_quote_id, p_company_id, p_quote->>'code', p_quote->>'title', p_quote->>'client',
    nullif(p_quote->>'contactName', ''), nullif(p_quote->>'contactEmail', ''),
    nullif(p_quote->>'contactPhone', ''), nullif(p_quote->>'emailOrigin', ''),
    p_quote->>'status', p_quote->>'responsible',
    nullif(p_quote->>'estimatedValue', '')::numeric, coalesce((p_quote->>'revision')::int, 0),
    p_quote->'costBreakdown', p_quote->'technicalVisit', p_quote->'technicalVisits',
    nullif(p_quote->>'validityDays', '')::int, nullif(p_quote->>'sentAt', '')::timestamptz,
    nullif(p_quote->>'deliveryTimeWeeks', '')::int, nullif(p_quote->>'paymentTerms', ''),
    nullif(p_quote->>'folderUrl', ''),
    coalesce(nullif(p_quote->>'receivedAt', '')::timestamptz, now()),
    nullif(p_quote->>'deadline', '')::timestamptz,
    nullif(p_quote->>'nextAction', ''), nullif(p_quote->>'projectId', '')::uuid,
    nullif(p_quote->>'notes', ''), p_quote->>'requestBody',
    coalesce(nullif(p_quote->>'createdAt', '')::timestamptz, now()), now()
  )
  on conflict (id) do update set
    code = excluded.code, title = excluded.title, client = excluded.client,
    contact_name = excluded.contact_name, contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone, email_origin = excluded.email_origin,
    status = excluded.status, responsible = excluded.responsible,
    estimated_value = excluded.estimated_value, revision = excluded.revision,
    cost_breakdown = excluded.cost_breakdown, technical_visit = excluded.technical_visit,
    technical_visits = excluded.technical_visits,
    validity_days = excluded.validity_days, sent_at = excluded.sent_at,
    delivery_time_weeks = excluded.delivery_time_weeks, payment_terms = excluded.payment_terms,
    folder_url = excluded.folder_url, deadline = excluded.deadline,
    next_action = excluded.next_action, project_id = excluded.project_id,
    notes = excluded.notes, request_body = excluded.request_body, updated_at = now()
  where q.company_id = p_company_id;

  -- Historial: solo eventos nuevos, siempre con el actor de la sesión
  for v_entry in
    select value from jsonb_array_elements(coalesce(p_quote->'history', '[]'::jsonb))
  loop
    if nullif(v_entry->>'id', '') is null then continue; end if;
    if exists (select 1 from public.quote_history h where h.id = (v_entry->>'id')::uuid) then
      continue;
    end if;
    insert into public.quote_history (
      id, quote_id, company_id, from_status, to_status, changed_by, note, changed_at
    ) values (
      (v_entry->>'id')::uuid, v_quote_id, p_company_id,
      nullif(v_entry->>'fromStatus', ''), v_entry->>'toStatus',
      v_actor, nullif(v_entry->>'note', ''),
      coalesce(nullif(v_entry->>'changedAt', '')::timestamptz, now())
    );
  end loop;

  get diagnostics v_missing = row_count;
end;
$$;

revoke all on function public.save_quote_with_history(uuid, jsonb) from public, anon;
grant execute on function public.save_quote_with_history(uuid, jsonb) to authenticated;

-- 4. Tabla de transiciones de estado para validación en servidor
create table if not exists public.quote_status_transitions (
  from_status text not null,
  to_status text not null,
  primary key (from_status, to_status)
);

insert into public.quote_status_transitions (from_status, to_status) values
  ('received', 'in_review'), ('received', 'lost'),
  ('in_review', 'estimating'), ('in_review', 'received'), ('in_review', 'lost'),
  ('estimating', 'sent'), ('estimating', 'revision_requested'), ('estimating', 'lost'),
  ('sent', 'awaiting_response'), ('sent', 'revision_requested'), ('sent', 'confirmed'), ('sent', 'lost'),
  ('awaiting_response', 'confirmed'), ('awaiting_response', 'revision_requested'), ('awaiting_response', 'lost'), ('awaiting_response', 'sent'),
  ('revision_requested', 'estimating'), ('revision_requested', 'sent'), ('revision_requested', 'lost'),
  ('confirmed', 'in_execution'), ('confirmed', 'lost'),
  ('in_execution', 'work_completed'), ('in_execution', 'lost'),
  ('work_completed', 'billing_pending'), ('work_completed', 'closed'),
  ('billing_pending', 'closed'),
  ('lost', 'received')
on conflict do nothing;

revoke all on table public.quote_status_transitions from public, anon;
grant select on table public.quote_status_transitions to authenticated;