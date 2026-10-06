-- Proveedores y su vinculación con el catálogo de materiales y equipos (COM-002, base de datos).
-- Esta migración no crea interfaz: deja el modelo listo para que el módulo de Compras
-- y Proveedores se construya encima sin volver a modelar.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tax_id text not null,
  legal_name text not null,
  trade_name text,
  supplier_type text not null default 'materiales'
    check (supplier_type in ('materiales','equipos','herramientas','servicios','transporte','dotacion','mixto')),
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  phone_secondary text,
  email_secondary text,
  payment_terms_days integer check (payment_terms_days is null or payment_terms_days >= 0),
  credit_limit numeric(16,2) check (credit_limit is null or credit_limit >= 0),
  requires_advance_payment boolean not null default false,
  is_preferred boolean not null default false,
  is_active boolean not null default true,
  rating smallint check (rating is null or rating between 1 and 5),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tax_id)
);

comment on table public.suppliers is
  'Proveedores por empresa. Un mismo NIT no se repite dentro de la compañía. La columna is_preferred marca al proveedor de cabecera de la empresa; no impide tener varios.';

create index if not exists suppliers_company_active_idx
  on public.suppliers (company_id, is_active, legal_name);
create index if not exists suppliers_company_name_idx
  on public.suppliers (company_id, legal_name);

-- Un producto puede tener varios proveedores; uno solo queda como preferido.
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  supplier_sku text,
  supplier_product_name text,
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  currency text not null default 'COP' check (currency = 'COP'),
  purchase_unit text,
  units_per_purchase numeric(12,3) check (units_per_purchase is null or units_per_purchase > 0),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  minimum_order_quantity numeric(14,3) check (minimum_order_quantity is null or minimum_order_quantity > 0),
  last_purchase_at timestamptz,
  is_preferred boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, item_id)
);

comment on table public.supplier_products is
  'Vincula un proveedor con un artículo del catálogo. Varios proveedores por artículo (comparación de precios) pero un solo preferido por artículo, garantizado por el índice único parcial suppliers_product_preferred_idx.';

create index if not exists supplier_products_item_idx
  on public.supplier_products (company_id, item_id, is_active);
create index if not exists supplier_products_supplier_idx
  on public.supplier_products (company_id, supplier_id, is_active);

-- Solo un proveedor preferido por artículo. Al marcar uno, el anterior queda como alterno.
create unique index if not exists suppliers_product_preferred_idx
  on public.supplier_products (company_id, item_id)
  where is_preferred;

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists suppliers_touch_updated_at on public.suppliers;
create trigger suppliers_touch_updated_at
  before update on public.suppliers
  for each row execute function private.touch_updated_at();

drop trigger if exists supplier_products_touch_updated_at on public.supplier_products;
create trigger supplier_products_touch_updated_at
  before update on public.supplier_products
  for each row execute function private.touch_updated_at();

-- Promover un proveedor a preferido del artículo: el resto queda como alterno.
create or replace function public.set_preferred_supplier_product(target_product uuid)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_company uuid;
  v_supplier uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select company_id, supplier_id into v_company, v_supplier
  from public.supplier_products
  where id = target_product
    and company_id = (select company_id from public.user_roles where user_id = auth.uid() limit 1);

  if v_company is null then raise exception 'La vinculación no existe para tu empresa'; end if;
  if not private.inventory_manager_for(v_company) then
    raise exception 'No tienes permiso para cambiar el proveedor preferido';
  end if;

  -- Se retira el título del anterior antes de promover, por el índice único parcial.
  update public.supplier_products set is_preferred = false
  where company_id = v_company
    and item_id = (select item_id from public.supplier_products where id = target_product);

  update public.supplier_products set is_preferred = true where id = target_product;

  return v_supplier;
end;
$$;

revoke all on function public.set_preferred_supplier_product(uuid) from public, anon;
grant execute on function public.set_preferred_supplier_product(uuid) to authenticated;

-- Alta de proveedor: valida rol y unicidad del NIT dentro de la empresa.
create or replace function public.create_supplier(
  supplier_tax_id text,
  supplier_legal_name text,
  supplier_type text default 'materiales',
  supplier_trade_name text default null,
  supplier_contact_name text default null,
  supplier_email text default null,
  supplier_phone text default null,
  supplier_address text default null,
  supplier_city text default null,
  supplier_payment_terms integer default null,
  supplier_credit_limit numeric default null,
  supplier_is_preferred boolean default false,
  supplier_notes text default null
)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_company uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  v_company := (select company_id from public.user_roles where user_id = auth.uid() limit 1);
  if v_company is null then raise exception 'No tienes empresa asignada'; end if;
  if not private.inventory_manager_for(v_company) then
    raise exception 'No tienes permiso para registrar proveedores en esta empresa';
  end if;

  if nullif(trim(supplier_tax_id), '') is null then raise exception 'El NIT es obligatorio'; end if;
  if nullif(trim(supplier_legal_name), '') is null then raise exception 'La razón social es obligatoria'; end if;
  if supplier_type not in ('materiales','equipos','herramientas','servicios','transporte','dotacion','mixto') then
    raise exception 'Tipo de proveedor no válido';
  end if;
  if supplier_email is not null and supplier_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no tiene un formato válido';
  end if;
  if exists (select 1 from public.suppliers where company_id = v_company and tax_id = trim(supplier_tax_id)) then
    raise exception 'Ya existe un proveedor con el NIT % en esta empresa', trim(supplier_tax_id);
  end if;

  insert into public.suppliers (
    company_id, tax_id, legal_name, trade_name, supplier_type, contact_name,
    email, phone, address, city, payment_terms_days, credit_limit,
    is_preferred, notes, created_by
  ) values (
    v_company, trim(supplier_tax_id), trim(supplier_legal_name),
    nullif(trim(supplier_trade_name), ''), supplier_type,
    nullif(trim(supplier_contact_name), ''), nullif(trim(supplier_email), ''),
    nullif(trim(supplier_phone), ''), nullif(trim(supplier_address), ''),
    nullif(trim(supplier_city), ''), supplier_payment_terms, supplier_credit_limit,
    coalesce(supplier_is_preferred, false), nullif(trim(supplier_notes), ''), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_supplier(text, text, text, text, text, text, text, text, text, integer, numeric, boolean, text) from public, anon;
grant execute on function public.create_supplier(text, text, text, text, text, text, text, text, text, integer, numeric, boolean, text) to authenticated;

-- Vincula un proveedor con un artículo del catálogo.
create or replace function public.link_supplier_product(
  target_supplier uuid,
  target_item uuid,
  product_unit_price numeric default 0,
  product_supplier_sku text default null,
  product_supplier_name text default null,
  product_purchase_unit text default null,
  product_units_per_purchase numeric default null,
  product_lead_time_days integer default null,
  product_min_order_quantity numeric default null,
  product_is_preferred boolean default false,
  product_notes text default null
)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_company uuid;
  v_item_company uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  v_company := (select company_id from public.user_roles where user_id = auth.uid() limit 1);
  if v_company is null then raise exception 'No tienes empresa asignada'; end if;
  if not private.inventory_manager_for(v_company) then
    raise exception 'No tienes permiso para vincular proveedores en esta empresa';
  end if;

  if product_unit_price is null or product_unit_price < 0 then raise exception 'Precio inválido'; end if;

  select company_id into v_item_company from public.inventory_items where id = target_item;
  if v_item_company is null or v_item_company <> v_company then
    raise exception 'El artículo no pertenece a tu empresa';
  end if;

  if not exists (select 1 from public.suppliers where id = target_supplier and company_id = v_company) then
    raise exception 'El proveedor no pertenece a tu empresa';
  end if;

  -- Solo un preferido por artículo. Se retira el título del anterior ANTES de
  -- escribir este vínculo, porque el índice único parcial rechaza dos preferidos.
  if product_is_preferred then
    update public.supplier_products set is_preferred = false
    where company_id = v_company and item_id = target_item;
  end if;

  insert into public.supplier_products (
    company_id, supplier_id, item_id, supplier_sku, supplier_product_name,
    unit_price, purchase_unit, units_per_purchase, lead_time_days,
    minimum_order_quantity, is_preferred, notes
  ) values (
    v_company, target_supplier, target_item,
    nullif(trim(product_supplier_sku), ''), nullif(trim(product_supplier_name), ''),
    product_unit_price, nullif(trim(product_purchase_unit), ''), product_units_per_purchase,
    product_lead_time_days, product_min_order_quantity,
    coalesce(product_is_preferred, false), nullif(trim(product_notes), '')
  )
  on conflict (supplier_id, item_id) do update set
    supplier_sku = excluded.supplier_sku,
    supplier_product_name = excluded.supplier_product_name,
    unit_price = excluded.unit_price,
    purchase_unit = excluded.purchase_unit,
    units_per_purchase = excluded.units_per_purchase,
    lead_time_days = excluded.lead_time_days,
    minimum_order_quantity = excluded.minimum_order_quantity,
    is_preferred = excluded.is_preferred,
    is_active = true,
    notes = excluded.notes,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.link_supplier_product(uuid, uuid, numeric, text, text, text, numeric, integer, numeric, boolean, text) from public, anon;
grant execute on function public.link_supplier_product(uuid, uuid, numeric, text, text, text, numeric, integer, numeric, boolean, text) to authenticated;

-- Vista de lectura: quién surte qué y a qué precio, con el preferido marcado.
-- Se elimina antes de recrear porque agregar columnas requiere DROP.
drop view if exists public.item_suppliers_overview;

create view public.item_suppliers_overview
with (security_invoker = true) as
select
  sp.company_id,
  sp.item_id,
  i.name as item_name,
  i.sku as item_sku,
  i.unit as item_unit,
  i.category as item_category,
  sp.id as supplier_product_id,
  s.id as supplier_id,
  s.legal_name as supplier_legal_name,
  s.trade_name as supplier_trade_name,
  s.tax_id as supplier_tax_id,
  s.phone as supplier_phone,
  s.email as supplier_email,
  s.payment_terms_days,
  sp.supplier_sku,
  sp.supplier_product_name,
  sp.unit_price,
  sp.currency,
  sp.purchase_unit,
  sp.units_per_purchase,
  sp.lead_time_days,
  sp.minimum_order_quantity,
  sp.last_purchase_at,
  sp.is_preferred,
  sp.is_active as link_is_active,
  s.is_active as supplier_is_active
from public.supplier_products sp
join public.suppliers s on s.id = sp.supplier_id
join public.inventory_items i on i.id = sp.item_id;

comment on view public.item_suppliers_overview is
  'Lectura consolidada del surtido: cada artículo con todos sus proveedores, precio, plazo y contacto. security_invoker para que RLS de las tablas base siga aplicando.';

alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;

drop policy if exists suppliers_member_read on public.suppliers;
create policy suppliers_member_read on public.suppliers
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = suppliers.company_id
  ));

drop policy if exists suppliers_manager_write on public.suppliers;
create policy suppliers_manager_write on public.suppliers
  for all to authenticated
  using (private.inventory_manager_for(company_id))
  with check (private.inventory_manager_for(company_id));

drop policy if exists supplier_products_member_read on public.supplier_products;
create policy supplier_products_member_read on public.supplier_products
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = supplier_products.company_id
  ));

drop policy if exists supplier_products_manager_write on public.supplier_products;
create policy supplier_products_manager_write on public.supplier_products
  for all to authenticated
  using (private.inventory_manager_for(company_id))
  with check (private.inventory_manager_for(company_id));

-- Un proveedor no se elimina si está vinculado: se desactiva, conservando el historial.
create or replace function private.guard_supplier_delete()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.supplier_products where supplier_id = old.id) then
    raise exception 'El proveedor tiene productos vinculados. Desactívalo en lugar de eliminarlo para conservar el historial.';
  end if;
  return old;
end;
$$;

drop trigger if exists suppliers_guard_delete on public.suppliers;
create trigger suppliers_guard_delete
  before delete on public.suppliers
  for each row execute function private.guard_supplier_delete();
