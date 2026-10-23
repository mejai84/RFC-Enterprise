-- Conteos físicos: ficha propuesta, protección de valoración inicial y RPCs privadas.
-- Los cambios de ficha permanecen dentro de la jornada hasta su conciliación autorizada.
alter table public.physical_count_lines
  add column if not exists item_data jsonb not null default '{}'::jsonb;

create or replace function public.save_physical_count_line(
  p_count_id uuid,
  p_stock_id uuid,
  p_counted_quantity numeric,
  p_counted_location text default null,
  p_unit_cost numeric default null,
  p_notes text default null,
  p_item_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  line_id uuid;
  count_row public.physical_counts%rowtype;
begin
  if p_item_data is not null and jsonb_typeof(p_item_data) <> 'object' then
    raise exception 'La ficha del artículo no es válida';
  end if;
  if p_item_data is not null
     and (nullif(trim(coalesce(p_item_data->>'name', '')), '') is null
          or nullif(trim(coalesce(p_item_data->>'unit', '')), '') is null) then
    raise exception 'La ficha requiere nombre y unidad';
  end if;

  -- La RPC original conserva sus controles de autorización, bloqueo y auditoría.
  perform public.save_physical_count_line(
    p_count_id, p_stock_id, p_counted_quantity, p_counted_location, p_unit_cost, p_notes
  );

  select * into count_row from public.physical_counts where id = p_count_id;
  select id into line_id from public.physical_count_lines
  where count_id = p_count_id and stock_id = p_stock_id;

  update public.physical_count_lines
  set item_data = coalesce(p_item_data, item_data)
  where id = line_id;

  insert into public.audit_logs(company_id, branch_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    count_row.company_id, count_row.branch_id, auth.uid(), 'physical_count_line', line_id,
    'item_data_proposed', jsonb_build_object('item_data', coalesce(p_item_data, '{}'::jsonb))
  );
end;
$$;

-- Se reemplaza la firma de lectura para incluir la ficha propuesta sin cargar toda la jornada.
drop function if exists public.count_lines_page(uuid, text, integer, integer);
create function public.count_lines_page(
  p_count_id uuid,
  p_search text default null,
  p_page integer default 0,
  p_page_size integer default 50
)
returns table (
  id uuid, stock_id uuid, system_quantity numeric, counted_quantity numeric,
  counted_location text, unit_cost numeric, notes text, counted_by uuid,
  counted_by_name text, counted_at timestamptz, item_data jsonb, location text,
  sku text, name text, category text, unit text, total_count bigint
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
  search_term text := nullif(trim(coalesce(p_search, '')), '');
  page_size integer := greatest(1, least(coalesce(p_page_size, 50), 100));
  page_number integer := greatest(0, coalesce(p_page, 0));
begin
  select * into count_row from public.physical_counts where physical_counts.id = p_count_id;
  if not found then raise exception 'La jornada no existe'; end if;
  if not private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id) then
    raise exception 'No autorizado para consultar esta jornada';
  end if;
  return query
  with filtered as (
    select line.id, line.stock_id, line.system_quantity, line.counted_quantity,
      line.counted_location, line.unit_cost, line.notes, line.counted_by,
      line.counted_by_name, line.counted_at,
      case when line.item_data = '{}'::jsonb then jsonb_build_object(
        'sku', item.sku, 'name', item.name, 'category', item.category, 'brand', item.brand,
        'unit', item.unit, 'technical_reference', item.technical_reference, 'model', item.model,
        'serial_number', item.serial_number, 'asset_condition', item.asset_condition,
        'purchase_unit', item.purchase_unit, 'units_per_purchase', item.units_per_purchase,
        'purchase_unit_cost', item.purchase_unit_cost, 'minimum_quantity', stock.minimum_quantity,
        'reorder_quantity', stock.reorder_quantity
      ) else line.item_data end as item_data,
      stock.location, item.sku, item.name, item.category, item.unit
    from public.physical_count_lines line
    join public.inventory_stock stock on stock.id = line.stock_id
    join public.inventory_items item on item.id = stock.item_id
    where line.count_id = p_count_id
      and (search_term is null or lower(coalesce(item.name, '')) like '%' || lower(search_term) || '%'
        or lower(coalesce(item.sku, '')) like '%' || lower(search_term) || '%'
        or lower(coalesce(item.category, '')) like '%' || lower(search_term) || '%')
  ), total as (select count(*)::bigint as value from filtered)
  select filtered.id, filtered.stock_id, filtered.system_quantity, filtered.counted_quantity,
    filtered.counted_location, filtered.unit_cost, filtered.notes, filtered.counted_by,
    filtered.counted_by_name, filtered.counted_at, filtered.item_data, filtered.location,
    filtered.sku, filtered.name, filtered.category, filtered.unit, total.value
  from filtered cross join total
  order by filtered.counted_at nulls first, filtered.id
  offset page_number * page_size limit page_size;
end;
$$;

-- No se puede aprobar inventario inicial positivo sin costo real confirmado.
create or replace function public.validate_initial_count_valuation()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare missing_costs bigint;
begin
  if new.status = 'approved' and old.status = 'draft' and new.count_kind = 'initial' then
    select count(*) into missing_costs from public.physical_count_lines
      where count_id = new.id and counted_quantity > 0 and coalesce(unit_cost, 0) <= 0;
    missing_costs := missing_costs + (select count(*) from public.physical_count_new_items
      where count_id = new.id and counted_quantity > 0 and coalesce(unit_cost, 0) <= 0);
    if missing_costs > 0 then
      raise exception 'Faltan % costos reales confirmados para existencias positivas', missing_costs;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists physical_counts_validate_initial_valuation on public.physical_counts;
create trigger physical_counts_validate_initial_valuation
  before update of status on public.physical_counts
  for each row execute function public.validate_initial_count_valuation();

revoke all on function public.count_lines_page(uuid, text, integer, integer) from public, anon;
revoke all on function public.count_summary(uuid) from public, anon;
revoke all on function public.save_physical_count_line(uuid, uuid, numeric, text, numeric, text, jsonb) from public, anon;
grant execute on function public.count_lines_page(uuid, text, integer, integer) to authenticated;
grant execute on function public.count_summary(uuid) to authenticated;
grant execute on function public.save_physical_count_line(uuid, uuid, numeric, text, numeric, text, jsonb) to authenticated;