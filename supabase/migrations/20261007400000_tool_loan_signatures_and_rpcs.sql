-- Prestamo y devolucion de herramientas con firma persistida (ADR-125)
--
-- Que resuelve
-- ------------
-- El Resumen fabricaba el prestamo entero en el navegador: inventaba el id, el
-- codigo y el identificador de la herramienta, y luego mostraba "registrado
-- correctamente" sin escribir nada. La devolucion hacia lo mismo. La firma que
-- se capturaba en el formulario se guardaba solo en memoria y se perdia al
-- recargar, asi que la evidencia de la entrega no existia en ninguna parte.
--
-- Aqui queda persistido de verdad, y las firmas quedan en la base junto al
-- prestamo.
--
-- Decisiones
-- ----------
-- 1. El prestamo se crea por funcion, no con un insert desde el navegador: el
--    numero consecutive se calcula con un bloqueo de aviso, igual que hace
--    create_inventory_requisition, para que dos prestamos simultaneos no saquen
--    el mismo codigo.
-- 2. La herramienta se elige del inventario por stock_id, no escribiendo el
--    nombre a mano. Es lo que permite que el trigger descuente la unidad
--    correcta; con un nombre suelto no habria forma de saber que se descontó.
-- 3. La firma se guarda como imagen en la misma fila del prestamo. Es pequena y
--    asi queda en la misma transaccion que el prestamo: o se guardan los dos, o
--    ninguno. Evita ademas depender de permisos de un almacen de archivos para
--    guardar evidencia.
-- 4. No se resta disponibilidad en el navegador. El trigger de la migracion
--    20261007290000 ya lo hace; hacerlo tambien aqui descontaria doble.
-- 5. La devolucion valida que el prestamo siga activo y avisa si ya habia
--    terminado, en vez de sobrescribir el estado sin avisar.

alter table public.inventory_tool_loans
  add column if not exists delivery_signature_data text,
  add column if not exists return_signature_data text;

comment on column public.inventory_tool_loans.delivery_signature_data is
  'Firma de quien recibe la herramienta, en imagen. Evidencia de la entrega.';
comment on column public.inventory_tool_loans.return_signature_data is
  'Firma de quien entrega la herramienta devuelta, en imagen.';

-- Prestamo de herramienta ------------------------------------------------
create or replace function public.create_tool_loan(
  target_project uuid,
  target_stock uuid,
  receiver_name text,
  target_expected_return date default null,
  loan_notes text default null,
  delivery_signature text default null
)
returns table (loan_id uuid, loan_code text)
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  target_company uuid;
  target_branch uuid;
  tool_label text;
  available_now numeric;
  next_number integer;
  loan_year smallint := extract(year from current_date)::smallint;
  created_id uuid;
begin
  select p.company_id, coalesce(s.branch_id, p.branch_id)
    into target_company, target_branch
  from public.projects p
  join public.inventory_stock s on s.id = target_stock and s.company_id = p.company_id
  where p.id = target_project;

  if not found then
    raise exception 'La herramienta o la obra no pertenecen a la misma empresa';
  end if;

  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para prestar herramientas de esta empresa';
  end if;

  if nullif(trim(receiver_name), '') is null then
    raise exception 'Indica quien recibe la herramienta';
  end if;

  select coalesce(i.name, 'herramienta'), s.quantity
    into tool_label, available_now
  from public.inventory_stock s
  left join public.inventory_items i on i.id = s.item_id
  where s.id = target_stock;

  if available_now <= 0 then
    raise exception 'No hay unidades disponibles de %', tool_label;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_company::text, 0));

  -- El consecutivo se compara como numero: como texto, '009' resultaria mayor
  -- que '010' y el prestamo 10 repetiria el codigo del 9.
  select coalesce(max((substring(code from 'PRST-[0-9]{4}-([0-9]+)'))::int), 0)
  into next_number
  from public.inventory_tool_loans
  where company_id = target_company
    and code like 'PRST-' || loan_year::text || '-%';

  loan_code := 'PRST-' || loan_year::text || '-' || lpad((next_number + 1)::text, 3, '0');

  insert into public.inventory_tool_loans (
    company_id, branch_id, project_id, stock_id, code, worker_name,
    expected_return_date, notes, delivery_signature_data
  ) values (
    target_company, target_branch, target_project, target_stock, loan_code,
    trim(receiver_name), target_expected_return,
    nullif(trim(loan_notes), ''), nullif(trim(delivery_signature), '')
  ) returning id into created_id;

  loan_id := created_id;
  return next;
end;
$function$;

comment on function public.create_tool_loan(uuid, uuid, text, date, text, text) is
  'Registra el prestamo de una herramienta con su firma de entrega. El descuento de la existencia lo aplica el trigger tool_loan_updates_stock.';

-- Devolucion de herramienta ----------------------------------------------
create or replace function public.return_tool_loan(
  target_loan uuid,
  return_notes text default null,
  return_signature text default null,
  final_status text default 'returned'
)
returns table (loan_code text, tool_name text)
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  target_company uuid;
  previous_status text;
begin
  select l.company_id, l.status, l.code
    into target_company, previous_status, loan_code
  from public.inventory_tool_loans l
  where l.id = target_loan
  for update;

  if not found then
    raise exception 'El prestamo indicado no existe';
  end if;

  if not private.inventory_manager_for(target_company) then
    raise exception 'No tienes permiso para registrar devoluciones de esta empresa';
  end if;

  if previous_status <> 'active' then
    raise exception 'Este prestamo ya estaba en estado % y no admite otra devolucion.',
      previous_status;
  end if;

  if final_status not in ('returned', 'damaged') then
    raise exception 'El estado final debe ser returned o damaged';
  end if;

  select coalesce(i.name, 'herramienta') into tool_name
  from public.inventory_stock s
  left join public.inventory_items i on i.id = s.item_id
  where s.id = (select stock_id from public.inventory_tool_loans where id = target_loan);

  update public.inventory_tool_loans
  set status = final_status,
      returned_at = now(),
      return_signature_data = nullif(trim(return_signature), ''),
      notes = nullif(
        trim(coalesce(notes, '') || coalesce(chr(10) || 'Devolucion: ' || trim(return_notes), '')),
        ''
      ),
      updated_at = now()
  where id = target_loan;

  return next;
end;
$function$;

comment on function public.return_tool_loan(uuid, text, text, text) is
  'Registra la devolucion de una herramienta con su firma. Un estado final damaged deja la unidad fuera de la bodega: no vuelve a estar disponible.';

-- Las funciones usan SECURITY DEFINER porque coordinan préstamo, custodia y
-- existencia. No quedan ejecutables por PUBLIC: solo un usuario autenticado
-- puede invocarlas y ambas validan el rol operativo dentro de la transacción.
revoke all on function public.create_tool_loan(uuid, uuid, text, date, text, text) from public, anon;
revoke all on function public.return_tool_loan(uuid, text, text, text) from public, anon;
grant execute on function public.create_tool_loan(uuid, uuid, text, date, text, text) to authenticated;
grant execute on function public.return_tool_loan(uuid, text, text, text) to authenticated;
