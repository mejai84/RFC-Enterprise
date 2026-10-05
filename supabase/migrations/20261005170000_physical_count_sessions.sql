-- Jornadas de conteo periódicas: conserva la carga inicial y permite
-- conciliar diferencias posteriores con movimientos auditables.
create or replace function public.approve_physical_count(target_count uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  count_row public.physical_counts%rowtype;
  line_row record;
  movement_kind public.inventory_movement_type;
begin
  select * into count_row
  from public.physical_counts
  where id = target_count
  for update;

  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if not private.inventory_manager_for(count_row.company_id) then
    raise exception 'No autorizado para conciliar conteos';
  end if;
  if count_row.status <> 'draft' then
    raise exception 'La jornada ya fue procesada';
  end if;

  for line_row in
    select * from public.physical_count_lines where count_id = target_count
  loop
    if line_row.counted_quantity = line_row.system_quantity then
      continue;
    end if;

    movement_kind := case
      when line_row.counted_quantity > line_row.system_quantity then 'adjustment_in'
      else 'adjustment_out'
    end;

    insert into public.inventory_movements(
      stock_id, company_id, branch_id, movement_type, quantity, reference,
      notes, count_session_id, unit_cost
    )
    select
      stock.id,
      stock.company_id,
      stock.branch_id,
      movement_kind,
      abs(line_row.counted_quantity - line_row.system_quantity),
      'CONTEO-' || to_char(now(), 'YYYYMMDD'),
      'Ajuste por conteo físico: ' || count_row.reason,
      target_count,
      coalesce(line_row.unit_cost, stock.unit_cost, 0)
    from public.inventory_stock stock
    where stock.id = line_row.stock_id;

    update public.inventory_stock
    set location = coalesce(nullif(trim(line_row.counted_location), ''), location),
        updated_at = now()
    where id = line_row.stock_id;
  end loop;

  update public.physical_counts
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = target_count;
end;
$$;

revoke all on function public.approve_physical_count(uuid) from public, anon;
grant execute on function public.approve_physical_count(uuid) to authenticated;

create index if not exists physical_counts_company_branch_status_created_idx
  on public.physical_counts (company_id, branch_id, status, created_at desc);
