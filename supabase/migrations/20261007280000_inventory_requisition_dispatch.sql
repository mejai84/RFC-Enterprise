-- Desapacho de requisiciones en transaccion unica (ADR-123)
--
-- Que resuelve
-- ------------
-- La pantalla de Resumen aprobaba y despachaba una requisicion solo en memoria:
-- fabricaba el movimiento con un id local, descuenta el stock en el navegador y
-- abria la remision imprimible. La remision saldia en papel pero en la base de
-- datos el material nunca salia de la bodega y la requisicion se quedaba
-- esperando. Esta funcion hace que las tres cosas pasen juntas o no pase ninguna.
--
-- Decisiones
-- ----------
-- 1. Es SECURITY DEFINER porque la tabla inventory_requisitions solo tiene
--    politica de lectura: el usuario que aprueba no tiene UPDATE. La autorizacion
--    se valida aqui, dentro de la funcion.
-- 2. El descuento no se hace con un UPDATE sobre inventory_stock. Se inserta el
--    movimiento y deja que el trigger private.apply_inventory_movement haga su
--    trabajo, que es el unico camino que ya mantiene el costo promedio y bloquea
--    la fila. Escribir el stock a mano desde aqui duplicaria esa logica.
-- 3. Si una linea no tiene existencia, se aborta toda la transaccion. Es
--    intencional: no se permite despachar la mitad de una requisicion. Se avisa
--    cual linea falta y por que.
-- 4. Se bloquea la requisicion con FOR UPDATE antes de leerla, para que dos
--    personas que aprueban a la vez no generen dos remisiones del mismo material.
-- 5. Acepta 'submitted' o 'approved'. El botón de la pantalla dice "Aprobar y
--    Despachar", o sea una sola acción para la persona; exigir que primero se
--    apruebe en otro sitio hacía que ese botón nunca funcionara. Cuando la
--    requisición venia en 'submitted' se registra tambien la aprobación. Ambos
--    hechos quedan auditados por separado con su propia hora y su propia persona:
--    quien despachó sin haber aprobado queda visible igual.

create or replace function public.dispatch_inventory_requisition(
  target_requisition uuid,
  dispatch_notes text default null
)
returns table (requisition_code text, dispatched_lines integer)
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  target_company uuid;
  target_project uuid;
  current_status public.inventory_requisition_status;
  line_row record;
  line_stock public.inventory_stock%rowtype;
  line_item public.inventory_items%rowtype;
  dispatched integer := 0;
begin
  -- Bloqueo de la requisicion: evita que dos despachos simultaneos la usen dos veces.
  select r.company_id, r.project_id, r.status, r.code
    into target_company, target_project, current_status, requisition_code
  from public.inventory_requisitions r
  where r.id = target_requisition
  for update;

  if not found then
    raise exception 'La requisicion seleccionada no existe';
  end if;

  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para despachar material de esta empresa';
  end if;

  if current_status in ('dispatched', 'partially_dispatched') then
    raise exception 'La requisicion % ya fue despachada el %',
      requisition_code,
      to_char(now() at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI');
  end if;

  if current_status in ('rejected', 'cancelled') then
    raise exception 'La requisicion % esta en estado % y no se puede despachar.',
      requisition_code, current_status;
  end if;

  -- Si venia sin aprobar, esta misma operacion deja constancia de la aprobacion.
  -- Quedan auditados por separado quien aprobo y quien despacho, con su hora.
  if current_status = 'submitted' then
    update public.inventory_requisitions
    set status = 'approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now()
    where id = target_requisition;
  end if;

  if not exists (
    select 1 from public.inventory_requisition_lines
    where requisition_id = target_requisition
  ) then
    raise exception 'La requisicion % no tiene materiales que despachar', requisition_code;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_company::text, 0));

  for line_row in
    select l.stock_id, l.requested_quantity, l.item_name_snapshot
    from public.inventory_requisition_lines l
    where l.requisition_id = target_requisition
    order by l.stock_id
  loop
    select * into line_stock
    from public.inventory_stock
    where id = line_row.stock_id and company_id = target_company
    for update;

    if not found then
      raise exception 'El material % ya no tiene registro de existencia en esta empresa',
        line_row.item_name_snapshot;
    end if;

    if line_stock.quantity < line_row.requested_quantity then
      raise exception 'Stock insuficiente para %: solicitado %, disponible %',
        coalesce(line_row.item_name_snapshot, 'material'),
        line_row.requested_quantity,
        line_stock.quantity;
    end if;

    select * into line_item from public.inventory_items where id = line_stock.item_id;

    -- El descuento real lo aplica el trigger de inventory_movements.
    -- La sucursal es la de la existencia, no la de la obra: el material sale de
    -- donde esta almacenado, y el trigger exige que movimiento y existencia
    -- coincidan en empresa y sucursal.
    insert into public.inventory_movements (
      stock_id, company_id, branch_id, project_id, movement_type,
      quantity, unit_cost, reference, notes, occurred_at, created_by
    ) values (
      line_stock.id, target_company, line_stock.branch_id, target_project, 'exit',
      line_row.requested_quantity, line_stock.unit_cost,
      'VALE-' || requisition_code,
      trim('Despachado desde requisicion ' || requisition_code
           || coalesce('. ' || nullif(trim(dispatch_notes), ''), '')),
      now(), auth.uid()
    );

    dispatched := dispatched + 1;
  end loop;

  update public.inventory_requisitions
  set status = 'dispatched',
      dispatched_by = auth.uid(),
      dispatched_at = now(),
      updated_at = now()
  where id = target_requisition;

  dispatched_lines := dispatched;
  return next;
end;
$function$;

comment on function public.dispatch_inventory_requisition(uuid, text) is
  'Despacha una requisicion aprobada: genera el movimiento de salida, deja que el trigger descuente el stock y marca el estado. Todo en una transaccion; si una linea falla, no se despacha ninguna.';