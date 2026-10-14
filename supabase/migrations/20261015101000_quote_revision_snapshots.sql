-- Instantanea comparativa de cada revision de cotizacion.
--
-- El comparador de revisiones (R1 vs R2) es de SOLO LECTURA: no crea, no
-- edita y no revierte revisiones. Para poder comparar hace falta que exista
-- una foto de los datos comerciales de cada revision, porque hoy la tabla
-- `quotes` guarda una sola fila por cotizacion y `quotes.revision` es un
-- contador que se sobrescribe en cada nueva revision.
--
-- Decision: la foto la toma un trigger AFTER INSERT/UPDATE sobre `quotes`.
-- Asi el flujo actual de "Crear revision" NO cambia en absoluto (sigue siendo
-- el mismo RPC y el mismo boton): la instantanea es un efecto lateral de
-- guardar, nunca un paso nuevo que el usuario deba ejecutar.
--
-- Limitacion honesta: las revisiones anteriores a esta migracion no tienen
-- foto historica. El comparador lo explica en pantalla en vez de inventar
-- diferencias. Solo la revision vigente queda comparada desde el primer dia.

create table if not exists public.quote_revision_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  revision integer not null check (revision >= 0),
  snapshot jsonb not null,
  captured_at timestamptz not null default now(),
  captured_by uuid references public.profiles(id) on delete set null default auth.uid(),
  unique (quote_id, revision)
);

create index if not exists quote_revision_snapshots_quote_idx
  on public.quote_revision_snapshots (quote_id, revision);
create index if not exists quote_revision_snapshots_company_idx
  on public.quote_revision_snapshots (company_id, captured_at desc);

alter table public.quote_revision_snapshots enable row level security;
revoke all on table public.quote_revision_snapshots from anon, authenticated;
grant select on table public.quote_revision_snapshots to authenticated;

create policy quote_revision_snapshots_member_read on public.quote_revision_snapshots
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = quote_revision_snapshots.company_id
  ));

-- Forma canonica de la foto. La misma clave usa el modulo de Cotizaciones en
-- `src/modules/quotes/domain/revision-comparison.ts`; si cambia aqui, cambia alla.
create or replace function public.capture_quote_revision_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_changed boolean;
begin
  v_changed := tg_op = 'INSERT'
    or new.revision is distinct from old.revision
    or new.estimated_value is distinct from old.estimated_value
    or new.cost_breakdown is distinct from old.cost_breakdown
    or new.validity_days is distinct from old.validity_days
    or new.delivery_time_weeks is distinct from old.delivery_time_weeks
    or new.payment_terms is distinct from old.payment_terms
    or new.title is distinct from old.title
    or new.notes is distinct from old.notes
    or new.status is distinct from old.status
    or new.sent_at is distinct from old.sent_at
    or new.deadline is distinct from old.deadline
    or new.received_at is distinct from old.received_at;

  if not v_changed then
    return new;
  end if;

  insert into public.quote_revision_snapshots (company_id, quote_id, revision, snapshot)
  values (
    new.company_id,
    new.id,
    new.revision,
    jsonb_build_object(
      'estimatedValue', new.estimated_value,
      'costBreakdown', new.cost_breakdown,
      'validityDays', new.validity_days,
      'deliveryTimeWeeks', new.delivery_time_weeks,
      'paymentTerms', new.payment_terms,
      'title', new.title,
      'notes', new.notes,
      'status', new.status,
      'receivedAt', new.received_at,
      'sentAt', new.sent_at,
      'deadline', new.deadline,
      'updatedAt', new.updated_at
    )
  )
  on conflict (quote_id, revision) do update
    set snapshot = excluded.snapshot, captured_at = now();

  return new;
end;
$$;

drop trigger if exists quotes_revision_snapshot on public.quotes;
create trigger quotes_revision_snapshot
  after insert or update on public.quotes
  for each row
  execute function public.capture_quote_revision_snapshot();

-- Foto inicial de lo que ya existe hoy, para que la revision vigente de cada
-- cotizacion sea comparable desde el primer dia.
insert into public.quote_revision_snapshots (company_id, quote_id, revision, snapshot)
select
  q.company_id,
  q.id,
  q.revision,
  jsonb_build_object(
    'estimatedValue', q.estimated_value,
    'costBreakdown', q.cost_breakdown,
    'validityDays', q.validity_days,
    'deliveryTimeWeeks', q.delivery_time_weeks,
    'paymentTerms', q.payment_terms,
    'title', q.title,
    'notes', q.notes,
    'status', q.status,
    'receivedAt', q.received_at,
    'sentAt', q.sent_at,
    'deadline', q.deadline,
    'updatedAt', q.updated_at
  )
from public.quotes q
on conflict (quote_id, revision) do nothing;