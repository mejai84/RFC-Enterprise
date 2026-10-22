-- RPC de paginacion real para la jornada de conteo.
create or replace function public.count_lines_page(
  p_count_id uuid,
  p_search text default null,
  p_page integer default 0,
  p_page_size integer default 50
)
returns table (
  id uuid,
  stock_id uuid,
  system_quantity numeric,
  counted_quantity numeric,
  counted_location text,
  unit_cost numeric,
  notes text,
  counted_by uuid,
  counted_by_name text,
  counted_at timestamptz,
  location text,
  sku text,
  name text,
  category text,
  unit text,
  total_count bigint
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
  select * into count_row from public.physical_counts where id = p_count_id;
  if not found then raise exception 'La jornada no existe'; end if;
  if not private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id) then
    raise exception 'No autorizado para consultar esta jornada';
  end if;

  return query
  with filtered as (
    select
      line.id,
      line.stock_id,
      line.system_quantity,
      line.counted_quantity,
      line.counted_location,
      line.unit_cost,
      line.notes,
      line.counted_by,
      line.counted_by_name,
      line.counted_at,
      stock.location,
      item.sku,
      item.name,
      item.category,
      item.unit
    from public.physical_count_lines line
    join public.inventory_stock stock on stock.id = line.stock_id
    join public.inventory_items item on item.id = stock.item_id
    where line.count_id = p_count_id
      and (
        search_term is null
        or lower(coalesce(item.name, '')) like '%' || lower(search_term) || '%'
        or lower(coalesce(item.sku, '')) like '%' || lower(search_term) || '%'
        or lower(coalesce(item.category, '')) like '%' || lower(search_term) || '%'
      )
  ),
  counted as (
    select count(*)::bigint as total from filtered
  )
  select
    filtered.id,
    filtered.stock_id,
    filtered.system_quantity,
    filtered.counted_quantity,
    filtered.counted_location,
    filtered.unit_cost,
    filtered.notes,
    filtered.counted_by,
    filtered.counted_by_name,
    filtered.counted_at,
    filtered.location,
    filtered.sku,
    filtered.name,
    filtered.category,
    filtered.unit,
    counted.total
  from filtered
  cross join counted
  order by filtered.counted_at nulls first, filtered.id
  offset page_number * page_size
  limit page_size;
end;
$$;

create or replace function public.count_summary(p_count_id uuid)
returns table (
  expected_lines bigint,
  counted_lines bigint,
  pending_lines bigint,
  difference_lines bigint
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
begin
  select * into count_row from public.physical_counts where id = p_count_id;
  if not found then raise exception 'La jornada no existe'; end if;
  if not private.inventory_manager_for_branch(count_row.company_id, count_row.branch_id) then
    raise exception 'No autorizado para consultar esta jornada';
  end if;

  return query
  select
    count(*)::bigint as expected_lines,
    count(*) filter (where counted_quantity is not null)::bigint as counted_lines,
    count(*) filter (where counted_quantity is null)::bigint as pending_lines,
    count(*) filter (where counted_quantity is not null and counted_quantity <> system_quantity)::bigint as difference_lines
  from public.physical_count_lines
  where count_id = p_count_id;
end;
$$;

grant execute on function public.count_lines_page(uuid, text, integer, integer) to authenticated;
grant execute on function public.count_summary(uuid) to authenticated;