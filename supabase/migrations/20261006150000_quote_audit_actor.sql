-- Auditoría de cotizaciones: el responsable del cambio lo determina Supabase Auth,
-- nunca el navegador. Cualquier empleado autenticado de la empresa queda registrado.
-- Lista de visitas técnicas: la cotización puede tener varias.
alter table public.quotes add column if not exists technical_visits jsonb;

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
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.company_id = p_company_id
  ) then
    raise exception 'No autorizado para esta empresa';
  end if;
  if v_quote_id is null then
    raise exception 'La cotización no tiene identificador';
  end if;

  -- Actor real de la sesión, no el valor enviado por el cliente.
  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Usuario')
    into v_actor
  from public.profiles p
  where p.id = auth.uid();

  insert into public.quotes as q (
    id, company_id, code, title, client, contact_name, contact_email, contact_phone,
    email_origin, status, responsible, estimated_value, revision, cost_breakdown,
    technical_visit, technical_visits, validity_days, sent_at, delivery_time_weeks, payment_terms,
    folder_url, received_at, deadline, next_action, project_id, notes,
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
    nullif(p_quote->>'notes', ''),
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
    notes = excluded.notes, updated_at = now()
  where q.company_id = p_company_id;

  -- Historial: solo los eventos nuevos, siempre con el actor de la sesión.
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
