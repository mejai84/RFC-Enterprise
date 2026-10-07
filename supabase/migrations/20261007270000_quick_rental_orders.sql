-- ALQ-004: un documento de alquiler puede contener varios equipos.
-- Los alquileres existentes se preservan como histórico en quick_rentals.

create table if not exists public.quick_rental_orders (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete set null, code text not null,
  customer_name text not null check (char_length(trim(customer_name)) >= 2), customer_phone text, customer_document text,
  pickup_at timestamptz not null, due_at timestamptz not null,
  status text not null default 'active' check (status in ('active','partially_returned','returned','overdue')),
  delivery_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint quick_rental_orders_period check (due_at >= pickup_at), constraint quick_rental_orders_code_unique unique (company_id, code)
);

create table if not exists public.quick_rental_order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.quick_rental_orders(id) on delete restrict,
  inventory_item_id uuid, equipment_name text not null, quantity numeric(12,3) not null default 1 check (quantity > 0),
  daily_rate numeric(14,2) not null default 0 check (daily_rate >= 0), deposit numeric(14,2) not null default 0 check (deposit >= 0),
  returned_quantity numeric(12,3) not null default 0 check (returned_quantity >= 0 and returned_quantity <= quantity), returned_at timestamptz,
  return_notes text, extra_charge numeric(14,2) not null default 0 check (extra_charge >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.quick_rental_order_attachments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.quick_rental_orders(id) on delete restrict,
  kind text not null check (kind in ('id_document','signature','other')), storage_path text not null,
  file_name text, mime_type text, uploaded_at timestamptz not null default now()
);

create index if not exists quick_rental_orders_company_status_idx on public.quick_rental_orders(company_id, status, created_at desc);
create index if not exists quick_rental_order_items_order_idx on public.quick_rental_order_items(order_id);
create index if not exists quick_rental_order_attachments_order_idx on public.quick_rental_order_attachments(order_id);
alter table public.quick_rental_orders enable row level security;
alter table public.quick_rental_order_items enable row level security;
alter table public.quick_rental_order_attachments enable row level security;
revoke all on public.quick_rental_orders, public.quick_rental_order_items, public.quick_rental_order_attachments from anon, authenticated;
grant select, insert, update on public.quick_rental_orders, public.quick_rental_order_items, public.quick_rental_order_attachments to authenticated;

create policy quick_rental_orders_member_read on public.quick_rental_orders for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = quick_rental_orders.company_id));
create policy quick_rental_orders_manager_write on public.quick_rental_orders for all to authenticated using (private.inventory_manager_for(company_id)) with check (private.inventory_manager_for(company_id));
create policy quick_rental_order_items_member_read on public.quick_rental_order_items for select to authenticated using (exists (select 1 from public.quick_rental_orders o where o.id = quick_rental_order_items.order_id and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = o.company_id)));
create policy quick_rental_order_items_manager_write on public.quick_rental_order_items for all to authenticated using (exists (select 1 from public.quick_rental_orders o where o.id = quick_rental_order_items.order_id and private.inventory_manager_for(o.company_id))) with check (exists (select 1 from public.quick_rental_orders o where o.id = quick_rental_order_items.order_id and private.inventory_manager_for(o.company_id)));
create policy quick_rental_order_attachments_member_read on public.quick_rental_order_attachments for select to authenticated using (exists (select 1 from public.quick_rental_orders o where o.id = quick_rental_order_attachments.order_id and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = o.company_id)));
create policy quick_rental_order_attachments_manager_write on public.quick_rental_order_attachments for all to authenticated
  using (exists (select 1 from public.quick_rental_orders o where o.id = quick_rental_order_attachments.order_id and private.inventory_manager_for(o.company_id)))
  with check (exists (select 1 from public.quick_rental_orders o where o.id = quick_rental_order_attachments.order_id and private.inventory_manager_for(o.company_id)));

comment on table public.quick_rental_orders is 'Cabecera de una entrega/factura de alquiler con un cliente, una firma y múltiples equipos.';
comment on table public.quick_rental_order_items is 'Líneas de equipo del alquiler; cada una admite devolución y recargo parciales.';
