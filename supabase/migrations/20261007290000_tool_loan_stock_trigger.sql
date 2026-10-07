-- La disponibilidad de una herramienta la ajusta la base de datos (ADR-124)
--
-- Que resuelve
-- ------------
-- El prestamo de herramienta se guardaba en inventory_tool_loans, pero el -1 de
-- disponibilidad era solo un setState del navegador. La herramienta quedaba
-- marcada como disponible para siempre y se podia prestar N veces la misma
-- unidad. Al devolver o anular, el +1 tampoco llegaba a la base y, con el uso
-- repetido, la disponibilidad podia quedar por encima de la existencia real.
--
-- Con este trigger la existencia es la unica fuente de verdad: el prestamo
-- ocupa la unidad mientras esta activa y la libera cuando termina.
--
-- Decisiones
-- ----------
-- 1. Solo actua sobre el campo status. Un cambio de notas o de fecha no debe
--    mover el stock.
-- 2. Solo descuenta al entrar en 'active' y solo repone al salir de 'active'.
--    Reordenar, editar o tocar el mismo estado no altera la existencia, asi que
--    no hay doble descuento por guardar dos veces.
-- 3. Una herramienta danada ('damaged') NO se repone: un equipo roto no vuelve a
--    estar disponible para prestarse. Queda fuera de la bodega hasta que se
--    registre su baja, que es un proceso aparte.
-- 4. No se permite prestar mas unidades de las que hay. Se avisa con un mensaje
--    claro en vez de dejar la existencia en negativo.
-- 5. La reposicion nunca deja la existencia en negativo ni inventa unidades: si
--    alguien la desconto por otra via, aqui solo se sube lo que corresponde.

create or replace function private.apply_tool_loan_stock()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  loan_stock uuid;
  old_state text;
  new_state text;
  target_quantity numeric;
  tool_label text;
begin
  loan_stock := coalesce(new.stock_id, old.stock_id);
  if loan_stock is null then
    return coalesce(new, old);
  end if;

  old_state := case when tg_op in ('UPDATE', 'DELETE') then old.status else null end;
  new_state := case when tg_op in ('INSERT', 'UPDATE') then new.status else null end;

  -- Si el estado no cambia, no hay nada que ajustar.
  if new_state is not distinct from old_state then
    return coalesce(new, old);
  end if;

  -- La existencia se bloquea sola: FOR UPDATE no admite uninir por la izquierda.
  select quantity into target_quantity
  from public.inventory_stock
  where id = loan_stock
  for update;

  if not found then
    raise exception 'La herramienta prestada ya no tiene registro de existencia';
  end if;

  select coalesce(name, 'herramienta') into tool_label
  from public.inventory_items
  where id = (select item_id from public.inventory_stock where id = loan_stock);

  if new_state = 'active' then
    if target_quantity <= 0 then
      raise exception 'No hay unidades disponibles de %', tool_label;
    end if;
    update public.inventory_stock
      set quantity = greatest(quantity - 1, 0), updated_at = now()
    where id = loan_stock;
  elsif old_state = 'active' and new_state <> 'damaged' then
    update public.inventory_stock
      set quantity = greatest(quantity + 1, 0), updated_at = now()
    where id = loan_stock;
  end if;

  return coalesce(new, old);
end;
$function$;

comment on function private.apply_tool_loan_stock() is
  'Ajusta la existencia de la herramienta prestada: descuenta una unidad al quedar activa y la repone al devolverse o anularse. Una herramienta dañada no se repone.';

drop trigger if exists tool_loan_updates_stock on public.inventory_tool_loans;

create trigger tool_loan_updates_stock
  after insert or update of status or delete
  on public.inventory_tool_loans
  for each row
  execute function private.apply_tool_loan_stock();