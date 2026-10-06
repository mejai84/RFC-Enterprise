-- Crea un artículo, su existencia y el movimiento de apertura como una única operación.
-- La autorización se valida con el usuario autenticado antes de ejecutar con privilegios elevados.
create or replace function public.create_inventory_item_with_opening_balance(
  p_company_id uuid,
  p_branch_id uuid,
  p_sku text,
  p_name text,
  p_category text,
  p_brand text,
  p_unit text,
  p_notes text,
  p_inventory_group text,
  p_location text,
  p_minimum_quantity numeric,
  p_unit_cost numeric,
  p_quantity numeric,
  p_purchase_unit text,
  p_units_per_purchase numeric,
  p_purchase_unit_cost numeric,
  p_technical_reference text,
  p_model text,
  p_serial_number text,
  p_acquired_at date,
  p_warranty_until date,
  p_asset_condition text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_item_id uuid;
  v_stock_id uuid;
  v_reference text;
begin
  if auth.uid() is null or not private.inventory_manager_for(p_company_id) then
    raise exception 'No autorizado para crear artículos de inventario';
  end if;

  if nullif(trim(p_name), '') is null or nullif(trim(p_unit), '') is null then
    raise exception 'El nombre y la unidad de consumo son obligatorios';
  end if;

  if p_inventory_group not in ('bodega', 'dotacion', 'trabajadores') then
    raise exception 'Grupo de inventario no válido';
  end if;

  if coalesce(p_quantity, 0) < 0 or coalesce(p_unit_cost, 0) < 0 then
    raise exception 'La cantidad y el costo no pueden ser negativos';
  end if;

  insert into public.inventory_items(
    company_id, sku, name, category, brand, unit, notes,
    technical_reference, model, serial_number, acquired_at, warranty_until,
    asset_condition, purchase_unit, units_per_purchase, purchase_unit_cost
  ) values (
    p_company_id, nullif(trim(p_sku), ''), trim(p_name), nullif(trim(p_category), ''),
    nullif(trim(p_brand), ''), trim(p_unit), nullif(trim(p_notes), ''),
    nullif(trim(p_technical_reference), ''), nullif(trim(p_model), ''),
    nullif(trim(p_serial_number), ''), p_acquired_at, p_warranty_until,
    nullif(trim(p_asset_condition), ''), nullif(trim(p_purchase_unit), ''),
    nullif(p_units_per_purchase, 0), nullif(p_purchase_unit_cost, 0)
  ) returning id into v_item_id;

  insert into public.inventory_stock(
    item_id, company_id, branch_id, inventory_group, location,
    quantity, minimum_quantity, unit_cost, valuation_status
  ) values (
    v_item_id, p_company_id, p_branch_id, p_inventory_group, nullif(trim(p_location), ''),
    0, p_minimum_quantity, coalesce(p_unit_cost, 0),
    case when coalesce(p_unit_cost, 0) = 0 then 'pending' else 'confirmed' end
  ) returning id into v_stock_id;

  if coalesce(p_quantity, 0) > 0 then
    v_reference := 'ING-APERTURA-' || to_char(now(), 'YYYYMMDD-HH24MISS');
    insert into public.inventory_movements(
      stock_id, company_id, branch_id, movement_type, quantity, reference, notes, unit_cost
    ) values (
      v_stock_id, p_company_id, p_branch_id, 'entry', p_quantity, v_reference,
      'Entrada inicial al crear artículo', coalesce(p_unit_cost, 0)
    );
  end if;

  return v_stock_id;
end;
$$;

revoke all on function public.create_inventory_item_with_opening_balance(
  uuid, uuid, text, text, text, text, text, text, text, text, numeric,
  numeric, numeric, text, numeric, numeric, text, text, text, date, date, text
) from public, anon;
grant execute on function public.create_inventory_item_with_opening_balance(
  uuid, uuid, text, text, text, text, text, text, text, text, numeric,
  numeric, numeric, text, numeric, numeric, text, text, text, date, date, text
) to authenticated;
