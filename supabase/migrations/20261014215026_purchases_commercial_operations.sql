-- Compras desde requisiciones, seguimiento comercial y control de rentabilidad.
-- Las entradas de inventario se registran exclusivamente por inventory_movements.

create type public.purchase_order_status as enum ('draft', 'issued', 'partially_received', 'received', 'cancelled');
create type public.commercial_follow_up_kind as enum ('call', 'email', 'whatsapp', 'meeting', 'note');

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), branch_id uuid not null references public.branches(id),
  requisition_id uuid references public.inventory_requisitions(id), project_id uuid references public.projects(id), supplier_id uuid not null references public.suppliers(id),
  order_year smallint not null, order_number integer not null, code text generated always as ('OC-' || order_year::text || '-' || lpad(order_number::text, 4, '0')) stored,
  status public.purchase_order_status not null default 'draft', expected_at date, notes text, issued_at timestamptz, issued_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id) default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id, order_year, order_number)
);
create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  requisition_line_id uuid references public.inventory_requisition_lines(id), stock_id uuid not null references public.inventory_stock(id), item_id uuid not null references public.inventory_items(id),
  item_name_snapshot text not null, unit_snapshot text not null, ordered_quantity numeric(14,3) not null check (ordered_quantity > 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0), unit_price numeric(16,2) not null check (unit_price >= 0), notes text,
  created_at timestamptz not null default now(), check (received_quantity <= ordered_quantity)
);
create table public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references public.purchase_orders(id), received_at timestamptz not null default now(),
  invoice_reference text, notes text, received_by uuid not null references auth.users(id) default auth.uid(), created_at timestamptz not null default now()
);
create table public.purchase_order_receipt_lines (
  id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.purchase_order_receipts(id) on delete cascade,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id), quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(16,2) not null check (unit_cost >= 0), created_at timestamptz not null default now(), unique (receipt_id, purchase_order_line_id)
);
create table public.quote_follow_ups (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), quote_id uuid not null references public.quotes(id) on delete cascade,
  kind public.commercial_follow_up_kind not null default 'note', planned_for timestamptz, completed_at timestamptz, responsible_id uuid references auth.users(id),
  responsible_name text not null, summary text not null check (char_length(trim(summary)) >= 3), outcome text, next_action text,
  created_by uuid not null references auth.users(id) default auth.uid(), created_at timestamptz not null default now()
);
create index purchase_orders_company_status_idx on public.purchase_orders(company_id, status, created_at desc);
create index purchase_orders_requisition_idx on public.purchase_orders(requisition_id) where requisition_id is not null;
create index purchase_order_lines_order_idx on public.purchase_order_lines(purchase_order_id);
create index quote_follow_ups_quote_created_idx on public.quote_follow_ups(quote_id, created_at desc);
create index quote_follow_ups_company_pending_idx on public.quote_follow_ups(company_id, planned_for) where completed_at is null;

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_receipts enable row level security;
alter table public.purchase_order_receipt_lines enable row level security;
alter table public.quote_follow_ups enable row level security;
create policy purchase_orders_member_read on public.purchase_orders for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = purchase_orders.company_id));
create policy purchase_order_lines_member_read on public.purchase_order_lines for select to authenticated using (exists (select 1 from public.purchase_orders o join public.user_roles ur on ur.company_id = o.company_id where o.id = purchase_order_lines.purchase_order_id and ur.user_id = (select auth.uid())));
create policy purchase_order_receipts_member_read on public.purchase_order_receipts for select to authenticated using (exists (select 1 from public.purchase_orders o join public.user_roles ur on ur.company_id = o.company_id where o.id = purchase_order_receipts.purchase_order_id and ur.user_id = (select auth.uid())));
create policy purchase_order_receipt_lines_member_read on public.purchase_order_receipt_lines for select to authenticated using (exists (select 1 from public.purchase_order_receipts r join public.purchase_orders o on o.id = r.purchase_order_id join public.user_roles ur on ur.company_id = o.company_id where r.id = purchase_order_receipt_lines.receipt_id and ur.user_id = (select auth.uid())));
create policy quote_follow_ups_member_read on public.quote_follow_ups for select to authenticated using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.company_id = quote_follow_ups.company_id));

create or replace function public.create_purchase_order_from_requisition(target_requisition uuid, target_supplier uuid, target_expected_at date default null, target_notes text default null, order_lines jsonb default '[]'::jsonb)
returns table (purchase_order_id uuid, purchase_order_code text)
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare req public.inventory_requisitions%rowtype; supplier public.suppliers%rowtype; next_number integer; created_id uuid; line jsonb; req_line public.inventory_requisition_lines%rowtype; stock public.inventory_stock%rowtype; item public.inventory_items%rowtype;
begin
  select * into req from public.inventory_requisitions where id = target_requisition for update;
  if not found then raise exception 'La requisicion seleccionada no existe'; end if;
  if not private.inventory_manager_for(req.company_id) then raise exception 'No tienes permiso para crear ordenes de compra'; end if;
  if req.status in ('dispatched', 'cancelled', 'rejected') then raise exception 'La requisicion % no admite compras en estado %', req.code, req.status; end if;
  if jsonb_typeof(order_lines) <> 'array' or jsonb_array_length(order_lines) = 0 then raise exception 'Selecciona al menos una linea para comprar'; end if;
  select * into supplier from public.suppliers where id = target_supplier and company_id = req.company_id and is_active;
  if not found then raise exception 'El proveedor no pertenece a esta empresa o no esta activo'; end if;
  perform pg_advisory_xact_lock(hashtextextended(req.company_id::text, 0));
  select coalesce(max(order_number), 0) + 1 into next_number from public.purchase_orders where company_id = req.company_id and order_year = extract(year from current_date)::smallint;
  insert into public.purchase_orders(company_id, branch_id, requisition_id, project_id, supplier_id, order_year, order_number, expected_at, notes)
  values (req.company_id, req.branch_id, req.id, req.project_id, supplier.id, extract(year from current_date)::smallint, next_number, target_expected_at, nullif(trim(target_notes), '')) returning id, code into created_id, purchase_order_code;
  for line in select value from jsonb_array_elements(order_lines) loop
    select * into req_line from public.inventory_requisition_lines where id = (line->>'requisition_line_id')::uuid and requisition_id = req.id;
    if not found then raise exception 'Una linea no pertenece a la requisicion'; end if;
    select * into stock from public.inventory_stock where id = req_line.stock_id and company_id = req.company_id;
    select * into item from public.inventory_items where id = stock.item_id;
    if (line->>'quantity')::numeric <= 0 then raise exception 'La cantidad comprada debe ser mayor que cero'; end if;
    insert into public.purchase_order_lines(purchase_order_id, requisition_line_id, stock_id, item_id, item_name_snapshot, unit_snapshot, ordered_quantity, unit_price, notes)
    values (created_id, req_line.id, stock.id, item.id, item.name, item.unit, (line->>'quantity')::numeric, coalesce((line->>'unit_price')::numeric, 0), nullif(trim(line->>'notes'), ''));
  end loop;
  purchase_order_id := created_id; return next;
end; $$;

create or replace function public.receive_purchase_order(target_purchase_order uuid, target_invoice_reference text default null, target_notes text default null, receipt_lines jsonb default '[]'::jsonb)
returns table (receipt_id uuid, purchase_order_code text, received_lines integer)
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare purchase public.purchase_orders%rowtype; receipt uuid; line jsonb; order_line public.purchase_order_lines%rowtype; line_quantity numeric(14,3); line_cost numeric(16,2); received integer := 0;
begin
  select * into purchase from public.purchase_orders where id = target_purchase_order for update;
  if not found then raise exception 'La orden de compra no existe'; end if;
  if not private.inventory_manager_for(purchase.company_id) then raise exception 'No tienes permiso para recibir compras'; end if;
  if purchase.status = 'cancelled' then raise exception 'La orden % esta cancelada', purchase.code; end if;
  if jsonb_typeof(receipt_lines) <> 'array' or jsonb_array_length(receipt_lines) = 0 then raise exception 'Registra al menos una cantidad recibida'; end if;
  insert into public.purchase_order_receipts(purchase_order_id, invoice_reference, notes) values (purchase.id, nullif(trim(target_invoice_reference), ''), nullif(trim(target_notes), '')) returning id into receipt;
  for line in select value from jsonb_array_elements(receipt_lines) loop
    select * into order_line from public.purchase_order_lines where id = (line->>'purchase_order_line_id')::uuid and purchase_order_id = purchase.id for update;
    if not found then raise exception 'Una linea no pertenece a la orden'; end if;
    line_quantity := (line->>'quantity')::numeric; line_cost := coalesce((line->>'unit_cost')::numeric, order_line.unit_price);
    if line_quantity <= 0 or line_cost < 0 then raise exception 'La recepcion tiene cantidad o costo invalidos'; end if;
    if order_line.received_quantity + line_quantity > order_line.ordered_quantity then raise exception 'La recepcion supera lo pedido para %', order_line.item_name_snapshot; end if;
    insert into public.purchase_order_receipt_lines(receipt_id, purchase_order_line_id, quantity, unit_cost) values (receipt, order_line.id, line_quantity, line_cost);
    insert into public.inventory_movements(stock_id, company_id, branch_id, movement_type, quantity, unit_cost, reference, notes, occurred_at, created_by)
    values (order_line.stock_id, purchase.company_id, purchase.branch_id, 'entry', line_quantity, line_cost, 'COMPRA-' || purchase.code, coalesce(nullif(trim(target_notes), ''), 'Recepcion de orden ' || purchase.code), now(), auth.uid());
    update public.purchase_order_lines set received_quantity = received_quantity + line_quantity where id = order_line.id; received := received + 1;
  end loop;
  update public.purchase_orders set status = case when exists (select 1 from public.purchase_order_lines where purchase_order_id = purchase.id and received_quantity < ordered_quantity) then 'partially_received' else 'received' end, issued_at = coalesce(issued_at, now()), issued_by = coalesce(issued_by, auth.uid()), updated_at = now() where id = purchase.id;
  receipt_id := receipt; purchase_order_code := purchase.code; received_lines := received; return next;
end; $$;

create or replace function public.record_quote_follow_up(target_quote uuid, follow_up_kind public.commercial_follow_up_kind, follow_up_summary text, follow_up_planned_for timestamptz default null, follow_up_completed_at timestamptz default null, follow_up_outcome text default null, follow_up_next_action text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_company uuid; created_id uuid; actor_name text;
begin
  select company_id into target_company from public.quotes where id = target_quote for update;
  if target_company is null then raise exception 'La cotizacion no existe'; end if;
  if not exists (select 1 from public.user_roles where user_id = auth.uid() and company_id = target_company) then raise exception 'No tienes acceso a esta cotizacion'; end if;
  if char_length(trim(follow_up_summary)) < 3 then raise exception 'Describe el seguimiento comercial'; end if;
  select coalesce(display_name, email, 'Usuario') into actor_name from public.profiles where id = auth.uid();
  insert into public.quote_follow_ups(company_id, quote_id, kind, planned_for, completed_at, responsible_id, responsible_name, summary, outcome, next_action)
  values (target_company, target_quote, follow_up_kind, follow_up_planned_for, follow_up_completed_at, auth.uid(), coalesce(actor_name, 'Usuario'), trim(follow_up_summary), nullif(trim(follow_up_outcome), ''), nullif(trim(follow_up_next_action), '')) returning id into created_id;
  if nullif(trim(follow_up_next_action), '') is not null then update public.quotes set next_action = trim(follow_up_next_action), updated_at = now() where id = target_quote; end if;
  return created_id;
end; $$;

revoke all on function public.create_purchase_order_from_requisition(uuid, uuid, date, text, jsonb) from public, anon;
revoke all on function public.receive_purchase_order(uuid, text, text, jsonb) from public, anon;
revoke all on function public.record_quote_follow_up(uuid, public.commercial_follow_up_kind, text, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.create_purchase_order_from_requisition(uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function public.receive_purchase_order(uuid, text, text, jsonb) to authenticated;
grant execute on function public.record_quote_follow_up(uuid, public.commercial_follow_up_kind, text, timestamptz, timestamptz, text, text) to authenticated;