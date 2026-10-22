-- RFC Enterprise: Consecutivo atómico de cotizaciones por empresa y año
-- Evita que dos usuarios generen el mismo número consecutivo.

create or replace function public.next_quote_sequence(
  p_company_id uuid,
  p_year integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_seq integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.company_id = p_company_id
  ) then
    raise exception 'No autorizado para esta empresa';
  end if;

  -- Lock transaccional por empresa+año para evitar duplicados
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text || p_year::text, 0));

  select coalesce(max(
    case
      when code ~ '^COT-(\d+)-(\d{4})' then (regexp_match(code, '^COT-(\d+)-(\d{4})'))[1]::int
      when code ~ '^COT-(\d{4})-(\d+)' then (regexp_match(code, '^COT-(\d{4})-(\d+)'))[2]::int
      else 0
    end
  ), 0)
  into v_max_seq
  from public.quotes
  where company_id = p_company_id
    and (
      (code ~ '^COT-(\d+)-(\d{4})' and (regexp_match(code, '^COT-(\d+)-(\d{4})'))[2]::int = p_year)
      or (code ~ '^COT-(\d{4})-(\d+)' and (regexp_match(code, '^COT-(\d{4})-(\d+)'))[1]::int = p_year)
    );

  return v_max_seq + 1;
end;
$$;

revoke all on function public.next_quote_sequence(uuid, integer) from public, anon;
grant execute on function public.next_quote_sequence(uuid, integer) to authenticated;