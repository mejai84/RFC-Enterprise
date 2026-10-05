-- ─── Alquiler rápido: persistencia empresarial, adjuntos y facturación ──────
-- Tabla principal de alquileres rápidos
create table public.quick_rentals (
  id             uuid        primary key default gen_random_uuid(),
  company_id     uuid        not null references public.companies(id) on delete restrict,
  branch_id      uuid        references public.branches(id) on delete set null,
  code           text        not null,
  equipment_id   uuid,
  equipment_name text        not null,
  customer_name      text    not null,
  customer_phone     text    not null,
  customer_document  text    not null,
  pickup_at      timestamptz not null,
  due_at         timestamptz not null,
  returned_at    timestamptz,
  daily_rate     numeric(14,2) not null default 0 check (daily_rate >= 0),
  deposit        numeric(14,2) not null default 0 check (deposit >= 0),
  extra_charge   numeric(14,2)           default 0 check (extra_charge >= 0),
  status         text        not null default 'active'
                   check (status in ('active', 'overdue', 'returned')),
  delivery_notes text,
  return_notes   text,
  created_by     uuid        references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, code)
);

-- Adjuntos del alquiler (cedula, fotos del equipo, firma)
create table public.quick_rental_attachments (
  id          uuid  primary key default gen_random_uuid(),
  rental_id   uuid  not null references public.quick_rentals(id) on delete cascade,
  company_id  uuid  not null references public.companies(id)     on delete restrict,
  kind        text  not null check (kind in ('id_document', 'equipment_photo', 'signature', 'other')),
  storage_path text not null,
  file_name   text,
  mime_type   text,
  uploaded_by uuid  references public.profiles(id) on delete set null default auth.uid(),
  uploaded_at timestamptz not null default now()
);

create index on public.quick_rentals (company_id, status);
create index on public.quick_rentals (company_id, pickup_at desc);
create index on public.quick_rental_attachments (rental_id);

create or replace function public.set_quick_rentals_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger quick_rentals_updated_at
  before update on public.quick_rentals
  for each row execute function public.set_quick_rentals_updated_at();

alter table public.quick_rentals            enable row level security;
alter table public.quick_rental_attachments enable row level security;

create or replace function public.my_company_id()
returns uuid language sql stable security definer as $$
  select company_id from public.profiles where id = auth.uid() limit 1;
$$;

create policy "Empresa puede ver sus alquileres"
  on public.quick_rentals for select
  using (company_id = public.my_company_id());

create policy "Empresa puede crear alquileres"
  on public.quick_rentals for insert
  with check (company_id = public.my_company_id());

create policy "Empresa puede actualizar sus alquileres"
  on public.quick_rentals for update
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

create policy "Empresa puede ver adjuntos de sus alquileres"
  on public.quick_rental_attachments for select
  using (company_id = public.my_company_id());

create policy "Empresa puede adjuntar archivos"
  on public.quick_rental_attachments for insert
  with check (company_id = public.my_company_id());

create policy "Empresa puede eliminar adjuntos propios"
  on public.quick_rental_attachments for delete
  using (company_id = public.my_company_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rental-attachments',
  'rental-attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','image/gif']
)
on conflict (id) do nothing;

create policy "Autenticado puede subir adjuntos alquiler"
  on storage.objects for insert
  with check (bucket_id = 'rental-attachments' and auth.role() = 'authenticated');

create policy "Autenticado puede leer adjuntos alquiler"
  on storage.objects for select
  using (bucket_id = 'rental-attachments' and auth.role() = 'authenticated');

create policy "Autenticado puede eliminar adjuntos alquiler"
  on storage.objects for delete
  using (bucket_id = 'rental-attachments' and auth.role() = 'authenticated');
