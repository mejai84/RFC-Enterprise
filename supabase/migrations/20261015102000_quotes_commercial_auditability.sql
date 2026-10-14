-- Auditabilidad de las tres mejoras de Cotizaciones.
--
-- 1. Expediente comercial: cada alta, confirmación de archivo y eliminación
--    queda en public.audit_logs, que ya usa el resto de la plataforma. No se
--    crea una bitácora paralela: se reutiliza la tabla común.
-- 2. Comparador de revisiones: cada instantánea queda auditada, así que se
--    puede demostrar cuándo y quién registró la foto de cada revisión.
-- 3. Indicadores comerciales: son de solo lectura sobre datos persistentes,
--    pero cada consulta del informe se registra con los filtros aplicados para
--    saber qué se miró y sobre qué corte.
--
-- El actor lo toma siempre auth.uid(); el navegador nunca declara quién fue.

-- ── 1 y 2. Disparadores de auditoría sobre las tablas nuevas ──────────────
create or replace function private.audit_quote_support_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_entity_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
    v_entity_id := old.id;
    v_action := 'deleted';
    v_before := to_jsonb(old);
    v_after := null;
  else
    v_company_id := new.company_id;
    v_entity_id := new.id;
    v_before := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
    v_after := to_jsonb(new);
    v_action := case when tg_op = 'INSERT' then 'created' else 'updated' end;
  end if;

  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (v_company_id, auth.uid(), 'quote_commercial_document', v_entity_id, v_action, v_before, v_after);

  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_quote_support_change() from public, anon, authenticated;

-- La instantánea se audita con su propia entidad para que el comparador se
-- pueda rastrear sin mezclarlo con el expediente comercial.
create or replace function private.audit_revision_snapshot_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    new.company_id,
    auth.uid(),
    'quote_revision_snapshot',
    new.id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke execute on function private.audit_revision_snapshot_change() from public, anon, authenticated;

drop trigger if exists quote_commercial_documents_audit on public.quote_commercial_documents;
create trigger quote_commercial_documents_audit
  after insert or update or delete on public.quote_commercial_documents
  for each row execute function private.audit_quote_support_change();

drop trigger if exists quote_revision_snapshots_audit on public.quote_revision_snapshots;
create trigger quote_revision_snapshots_audit
  after insert or update on public.quote_revision_snapshots
  for each row
  execute function private.audit_revision_snapshot_change();

-- ── 3. Registro de consulta del informe de indicadores ────────────────────
-- No modifica ninguna cotización: solo deja constancia de qué filtros se
-- aplicaron y sobre qué corte se calculó.
create or replace function public.record_quote_indicator_view(
  p_filters jsonb,
  p_quotes_in_scope integer,
  p_won integer,
  p_lost integer
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id into v_company_id
  from public.user_roles
  where user_id = auth.uid()
  limit 1;
  if v_company_id is null then raise exception 'Tu cuenta no está vinculada a una empresa'; end if;

  insert into public.audit_logs (company_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_company_id,
    auth.uid(),
    'quote_indicators_report',
    null,
    'viewed',
    jsonb_build_object(
      'filters', coalesce(p_filters, '{}'::jsonb),
      'quotes_in_scope', coalesce(p_quotes_in_scope, 0),
      'won', coalesce(p_won, 0),
      'lost', coalesce(p_lost, 0)
    )
  );
end;
$$;

revoke all on function public.record_quote_indicator_view(jsonb, integer, integer, integer) from public, anon;
grant execute on function public.record_quote_indicator_view(jsonb, integer, integer, integer) to authenticated;