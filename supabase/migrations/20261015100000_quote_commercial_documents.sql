-- Expediente comercial de la cotización.
--
-- Es un conjunto de soportes PRIVADOS y separados de los documentos técnicos
-- (procedimiento de trabajo y matriz de riesgos, que viven en
-- public.quote_technical_documents y condicionan la conversion a obra).
-- Aquí se conserva la trazabilidad comercial: qué pidió el cliente, qué planos
-- llegaron, qué correos lo respaldan, qué orden de servicio se emitió y qué
-- aprobó el cliente.
--
-- Decisiones de diseño:
--   * Un registro puede apuntar a un archivo en el bucket privado o a un enlace
--     externo (Drive, OneDrive, SharePoint). Nunca a las dos cosas a la vez.
--   * Las escrituras pasan por RPC `security definer`: el cliente nunca escribe
--     directo en la tabla, así que el RLS no puede quedar abierto por error.
--   * El actor real lo toma `auth.uid()`, no un campo enviado por el navegador.

create table if not exists public.quote_commercial_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  document_type text not null check (document_type in (
    'request_original',    -- Solicitud original del cliente
    'drawings',            -- Planos
    'email_support',       -- Correos y soportes de la solicitud
    'service_order',       -- Orden de servicio
    'client_approval'      -- Aprobación del cliente
  )),
  title text not null check (char_length(trim(title)) between 3 and 180),
  document_date date,
  responsible text not null check (char_length(trim(responsible)) between 3 and 120),
  -- Archivo en el bucket privado. NULL cuando el soporte es un enlace externo.
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or (size_bytes > 0 and size_bytes <= 26214400)),
  storage_path text unique,
  -- Enlace externo. NULL cuando el soporte es un archivo.
  external_url text check (external_url is null or external_url ~ '^https?://'),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- Registro creado por la RPC y todavía sin archivo subido.
  upload_pending boolean not null default false,
  constraint quote_commercial_documents_source_check check (
    (external_url is not null and storage_path is null) or
    (external_url is null and storage_path is not null)
  ),
  constraint quote_commercial_documents_upload_pending_check check (
    upload_pending or storage_path is not null or external_url is not null
  )
);

create index if not exists quote_commercial_documents_quote_idx
  on public.quote_commercial_documents (quote_id, document_type, document_date desc nulls last, created_at desc);
create index if not exists quote_commercial_documents_company_idx
  on public.quote_commercial_documents (company_id, created_at desc);

create or replace function private.can_manage_quote_commercial_documents(target_company uuid)
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

alter table public.quote_commercial_documents enable row level security;
revoke all on table public.quote_commercial_documents from anon, authenticated;
grant select on table public.quote_commercial_documents to authenticated;

create policy quote_commercial_documents_member_read on public.quote_commercial_documents
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = quote_commercial_documents.company_id
  ));

insert into storage.buckets (id, name, public)
values ('quote-commercial-documents', 'quote-commercial-documents', false)
on conflict (id) do update set public = false;

-- Lectura: cualquier miembro de la empresa, y solo sobre objetos que ya
-- tienen un registro del expediente asociado.
drop policy if exists "quote commercial documents read" on storage.objects;
create policy "quote commercial documents read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quote-commercial-documents'
    and exists (
      select 1
      from public.quote_commercial_documents d
      join public.user_roles ur on ur.company_id = d.company_id
      where d.storage_path = name
        and d.upload_pending = false
        and ur.user_id = (select auth.uid())
    )
  );

-- Escritura del archivo: solo el propio gestor del registro pendiente.
drop policy if exists "quote commercial documents upload prepared" on storage.objects;
create policy "quote commercial documents upload prepared"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quote-commercial-documents'
    and exists (
      select 1 from public.quote_commercial_documents d
      where d.storage_path = name
        and d.upload_pending = true
        and d.created_by = (select auth.uid())
    )
  );

drop policy if exists "quote commercial documents remove file" on storage.objects;
create policy "quote commercial documents remove file"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quote-commercial-documents'
    and exists (
      select 1 from public.quote_commercial_documents d
      where d.storage_path = name
        and private.can_manage_quote_commercial_documents(d.company_id)
    )
  );

-- Registra un soporte del expediente. Devuelve la fila preparada para que el
-- navegador suba el archivo justo a esa ruta.
create or replace function public.register_quote_commercial_document(
  p_quote_id uuid,
  p_document_type text,
  p_title text,
  p_document_date date,
  p_responsible text,
  p_external_url text default null,
  p_file_name text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_notes text default null
)
returns public.quote_commercial_documents
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_row public.quote_commercial_documents%rowtype;
  v_url text := nullif(trim(coalesce(p_external_url, '')), '');
  v_file text := nullif(trim(coalesce(p_file_name, '')), '');
  v_mime text := nullif(trim(coalesce(p_mime_type, '')), '');
  v_safe_name text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select company_id into v_company_id from public.quotes where id = p_quote_id;
  if v_company_id is null then raise exception 'Cotización no encontrada'; end if;
  if not private.can_manage_quote_commercial_documents(v_company_id) then
    raise exception 'No autorizado para gestionar el expediente comercial';
  end if;

  if p_document_type not in ('request_original', 'drawings', 'email_support', 'service_order', 'client_approval') then
    raise exception 'Tipo de soporte no válido';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 180 then
    raise exception 'El nombre del soporte debe tener entre 3 y 180 caracteres';
  end if;
  if char_length(trim(coalesce(p_responsible, ''))) not between 3 and 120 then
    raise exception 'El responsable debe tener entre 3 y 120 caracteres';
  end if;

  -- Exactamente una fuente: archivo o enlace. Nunca las dos, nunca ninguna.
  if (v_url is not null) = (v_file is not null) then
    raise exception 'Adjunta un archivo o registra un enlace externo, no ambos';
  end if;

  if v_url is not null then
    if v_url !~ '^https?://' then raise exception 'El enlace debe comenzar con http:// o https://'; end if;
    if char_length(v_url) > 500 then raise exception 'El enlace es demasiado largo'; end if;
    v_mime := null;
  else
    if v_mime not in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/webp'
    ) then
      raise exception 'Formato no permitido. Usa PDF, Word, Excel o imagen (PNG, JPG, WEBP)';
    end if;
    if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 26214400 then
      raise exception 'El archivo debe pesar máximo 25 MB';
    end if;
    v_url := null;
  end if;

  v_safe_name := regexp_replace(lower(v_file), '[^a-z0-9._-]+', '-', 'g');

  insert into public.quote_commercial_documents (
    company_id, quote_id, document_type, title, document_date, responsible,
    file_name, mime_type, size_bytes, storage_path, external_url, notes, created_by, upload_pending
  ) values (
    v_company_id, p_quote_id, p_document_type, trim(p_title), p_document_date, trim(p_responsible),
    v_file, v_mime, case when v_file is null then null else p_size_bytes end,
    case when v_file is null then null else
      v_company_id::text || '/' || p_quote_id::text || '/expediente/' || p_document_type || '/' || gen_random_uuid()::text || '-' || v_safe_name
    end,
    v_url, nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), v_file is not null
  ) returning * into v_row;

  return v_row;
end;
$$;

-- Cierra el registro una vez subido el archivo: a partir de aquí el objeto ya
-- cumple la política de lectura y el soporte aparece en el expediente.
create or replace function public.finalize_quote_commercial_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_storage_path text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id, storage_path into v_company_id, v_storage_path
  from public.quote_commercial_documents
  where id = p_document_id and created_by = auth.uid()
  for update;
  if v_company_id is null then raise exception 'Soporte no encontrado'; end if;
  if not private.can_manage_quote_commercial_documents(v_company_id) then
    raise exception 'No autorizado para gestionar el expediente comercial';
  end if;
  if v_storage_path is null or not exists (
    select 1 from storage.objects
    where bucket_id = 'quote-commercial-documents' and name = v_storage_path
  ) then
    raise exception 'El archivo aun no esta disponible en el almacenamiento';
  end if;

  update public.quote_commercial_documents
  set upload_pending = false
  where id = p_document_id;
end;
$$;

-- Elimina un soporte del expediente y su archivo asociado.
create or replace function public.delete_quote_commercial_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_company_id uuid;
  v_path text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select company_id, storage_path into v_company_id, v_path
  from public.quote_commercial_documents
  where id = p_document_id;
  if v_company_id is null then raise exception 'Soporte no encontrado'; end if;
  if not private.can_manage_quote_commercial_documents(v_company_id) then
    raise exception 'No autorizado para gestionar el expediente comercial';
  end if;

  delete from storage.objects
  where bucket_id = 'quote-commercial-documents' and name = v_path and v_path is not null;

  delete from public.quote_commercial_documents where id = p_document_id;
end;
$$;

revoke all on function public.register_quote_commercial_document(uuid, text, text, date, text, text, text, text, bigint, text) from public, anon;
revoke all on function public.finalize_quote_commercial_document(uuid) from public, anon;
revoke all on function public.delete_quote_commercial_document(uuid) from public, anon;
grant execute on function public.register_quote_commercial_document(uuid, text, text, date, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.finalize_quote_commercial_document(uuid) to authenticated;
grant execute on function public.delete_quote_commercial_document(uuid) to authenticated;