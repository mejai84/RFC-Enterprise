-- Procedimientos de trabajo y matrices de riesgo sujetos a revisión del cliente.
-- Los documentos son privados y se conservan por versión; una aprobación previa
-- deja de ser válida cuando el cliente solicita cambios.

create table if not exists public.quote_technical_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  document_type text not null check (document_type in ('work_procedure', 'risk_matrix')),
  version integer not null check (version > 0),
  title text not null check (char_length(trim(title)) between 3 and 180),
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  storage_path text not null unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'changes_requested', 'approved', 'superseded')),
  review_notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create unique index if not exists quote_technical_documents_version_key
  on public.quote_technical_documents (quote_id, document_type, version);
create index if not exists quote_technical_documents_quote_idx
  on public.quote_technical_documents (quote_id, document_type, version desc);

create or replace function private.can_manage_quote_technical_documents(target_company uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = target_company
      and r.code in ('administrator', 'management', 'administrative_staff', 'resident_engineer')
  );
$$;

alter table public.quote_technical_documents enable row level security;
revoke all on table public.quote_technical_documents from anon, authenticated;
grant select on table public.quote_technical_documents to authenticated;

create policy quote_technical_documents_member_read on public.quote_technical_documents
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = quote_technical_documents.company_id
 ));

insert into storage.buckets (id, name, public)
values ('quote-technical-documents', 'quote-technical-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "quote technical documents read" on storage.objects;
create policy "quote technical documents read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quote-technical-documents'
    and exists (
      select 1
      from public.quote_technical_documents d
      join public.user_roles ur on ur.company_id = d.company_id
      where d.storage_path = name and ur.user_id = (select auth.uid())
    )
  );

drop policy if exists "quote technical documents upload prepared" on storage.objects;
create policy "quote technical documents upload prepared"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quote-technical-documents'
    and exists (
      select 1
      from public.quote_technical_documents d
      where d.storage_path = name
        and d.status = 'draft'
        and d.created_by = (select auth.uid())
    )
  );

create or replace function public.prepare_quote_technical_document(
  p_quote_id uuid,
  p_document_type text,
  p_title text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.quote_technical_documents
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_next_version integer;
  v_document public.quote_technical_documents%rowtype;
  v_safe_name text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id into v_company_id from public.quotes where id = p_quote_id;
  if v_company_id is null then raise exception 'Cotización no encontrada'; end if;
  if not private.can_manage_quote_technical_documents(v_company_id) then
    raise exception 'No autorizado para gestionar documentos técnicos';
  end if;
  if p_document_type not in ('work_procedure', 'risk_matrix') then raise exception 'Tipo de documento no válido'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 180 then raise exception 'Título de documento no válido'; end if;
  if char_length(trim(coalesce(p_file_name, ''))) not between 1 and 255 then raise exception 'Nombre de archivo no válido'; end if;
  if p_mime_type not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') then raise exception 'Formato no permitido. Usa PDF, DOC o DOCX'; end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 15728640 then raise exception 'El archivo debe pesar máximo 15 MB'; end if;
  if exists (
    select 1 from public.quote_technical_documents d
    where d.quote_id = p_quote_id and d.document_type = p_document_type and d.status in ('sent', 'approved')
  ) then
    raise exception 'El cliente debe solicitar cambios antes de cargar una nueva versión';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_quote_id::text || p_document_type, 0));
  select coalesce(max(version), 0) + 1 into v_next_version
  from public.quote_technical_documents
  where quote_id = p_quote_id and document_type = p_document_type;

  update public.quote_technical_documents
  set status = 'superseded'
  where quote_id = p_quote_id and document_type = p_document_type and status in ('draft', 'changes_requested');

  v_safe_name := regexp_replace(lower(trim(p_file_name)), '[^a-z0-9._-]+', '-', 'g');
  insert into public.quote_technical_documents (
    company_id, quote_id, document_type, version, title, file_name, mime_type, size_bytes,
    storage_path, created_by
  ) values (
    v_company_id, p_quote_id, p_document_type, v_next_version, trim(p_title), trim(p_file_name), p_mime_type, p_size_bytes,
    v_company_id::text || '/' || p_quote_id::text || '/' || p_document_type || '/v' || v_next_version::text || '-' || gen_random_uuid()::text || '-' || v_safe_name,
    auth.uid()
  ) returning * into v_document;
  return v_document;
end;
$$;

create or replace function public.review_quote_technical_documents(
  p_quote_id uuid,
  p_action text,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_previous_status text;
  v_next_status text;
  v_actor text;
  v_document_count integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id, status into v_company_id, v_previous_status from public.quotes where id = p_quote_id for update;
  if v_company_id is null then raise exception 'Cotización no encontrada'; end if;
  if not private.can_manage_quote_technical_documents(v_company_id) then raise exception 'No autorizado para revisar documentos técnicos'; end if;
  if p_action not in ('sent', 'changes_requested', 'approved') then raise exception 'Acción de revisión no válida'; end if;
  if p_action = 'changes_requested' and char_length(trim(coalesce(p_notes, ''))) < 3 then raise exception 'Describe las observaciones solicitadas por el cliente'; end if;

  select count(*) into v_document_count
  from (
    select distinct on (document_type) document_type, status
    from public.quote_technical_documents
    where quote_id = p_quote_id and document_type in ('work_procedure', 'risk_matrix')
    order by document_type, version desc
  ) current_documents;
  if v_document_count <> 2 then raise exception 'Carga el procedimiento y la matriz de riesgos antes de continuar'; end if;

  if p_action = 'sent' and exists (
    select 1 from (
      select distinct on (document_type) status from public.quote_technical_documents where quote_id = p_quote_id order by document_type, version desc
    ) d where d.status <> 'draft'
  ) then raise exception 'Solo se pueden enviar versiones en borrador'; end if;
  if p_action = 'approved' and exists (
    select 1 from (
      select distinct on (document_type) status from public.quote_technical_documents where quote_id = p_quote_id order by document_type, version desc
    ) d where d.status <> 'sent'
  ) then raise exception 'Solo se pueden aprobar documentos enviados al cliente'; end if;
  if p_action = 'changes_requested' and exists (
    select 1 from (
      select distinct on (document_type) status from public.quote_technical_documents where quote_id = p_quote_id order by document_type, version desc
    ) d where d.status not in ('sent', 'approved')
  ) then raise exception 'Solo se pueden solicitar cambios sobre documentos enviados'; end if;

  update public.quote_technical_documents d
  set status = p_action,
      review_notes = nullif(trim(coalesce(p_notes, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where d.quote_id = p_quote_id
    and d.id in (
      select id from (
        select distinct on (document_type) id
        from public.quote_technical_documents
        where quote_id = p_quote_id and document_type in ('work_procedure', 'risk_matrix')
        order by document_type, version desc
      ) latest
    );

  v_next_status := case p_action when 'sent' then 'sent' when 'changes_requested' then 'revision_requested' else 'confirmed' end;
  select coalesce(nullif(trim(display_name), ''), email, 'Usuario') into v_actor from public.profiles where id = auth.uid();
  update public.quotes set status = v_next_status, sent_at = case when p_action = 'sent' then coalesce(sent_at, now()) else sent_at end, updated_at = now() where id = p_quote_id;
  insert into public.quote_history (id, quote_id, company_id, from_status, to_status, changed_by, note, changed_at)
  values (gen_random_uuid(), p_quote_id, v_company_id, v_previous_status, v_next_status, coalesce(v_actor, 'Usuario'),
    case p_action
      when 'sent' then 'Procedimiento de trabajo y matriz de riesgos enviados al cliente para revisión.'
      when 'changes_requested' then 'Cliente solicitó ajustes documentales: ' || trim(p_notes)
      else 'Cliente reaprobó el procedimiento de trabajo y la matriz de riesgos vigentes.'
    end, now());
  return v_next_status;
end;
$$;

revoke all on function public.prepare_quote_technical_document(uuid, text, text, text, text, bigint) from public, anon;
revoke all on function public.review_quote_technical_documents(uuid, text, text) from public, anon;
grant execute on function public.prepare_quote_technical_document(uuid, text, text, text, text, bigint) to authenticated;
grant execute on function public.review_quote_technical_documents(uuid, text, text) to authenticated;
