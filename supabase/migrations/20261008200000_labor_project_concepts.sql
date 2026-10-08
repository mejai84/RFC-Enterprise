-- Mano de obra por obra: valor diario real y conceptos por cotización.
--
-- Problema que corrige: `labor_rate_entries.total_daily_rate` solo suman cuatro
-- columnas base (salario + transporte + alimentación + no salarial), sin
-- provisiones ni extras. El APU usaba ese número, así que la mano de obra
-- quedaba subestimada entre 32% y 49%. Aquí se recalcula con el mismo modelo
-- que usa la hoja de cálculo del cliente.
--
-- Los conceptos por obra (hotel, hidratación, médico, trabajo en altura, espacio
-- confinado, alimentación, transporte, otros) NO viven en la tabla salarial: son
-- estimaciones del dueño y valen solo para la cotización que los guarda.

/* ─────────────────────────────────────────────────────────────
 * 1. Columnas del proyecto en la cotización
 * ───────────────────────────────────────────────────────────── */

alter table public.quotes add column if not exists labor_project_snapshot jsonb;
alter table public.quotes add column if not exists labor_project_days integer;
alter table public.quotes add column if not exists labor_project_start date;
alter table public.quotes add column if not exists labor_project_end date;

comment on column public.quotes.labor_project_snapshot is
  'Copia congelada del calculo de mano de obra de esta obra: conceptos estimados, dias y resultados por cargo. No afecta otras cotizaciones.';
comment on column public.quotes.labor_project_days is
  'Dias de la obra usados en el calculo. Se sacan del plazo y se pueden cambiar a mano.';

create index if not exists quotes_labor_project_idx
  on public.quotes (company_id)
  where labor_project_snapshot is not null;

/* ─────────────────────────────────────────────────────────────
 * 2. Recalcular el valor diario real de cada cargo
 * ───────────────────────────────────────────────────────────── */

-- Columnas que guardan el desglose, para que el panel pueda mostrarlo.
alter table public.labor_rate_entries
  add column if not exists provision_daily numeric(14,2) not null default 0;
alter table public.labor_rate_entries
  add column if not exists extra_hours_daily numeric(14,2) not null default 0;

comment on column public.labor_rate_entries.provision_daily is
  'Valor diario provisionado: cesantias, interes, prima, vacaciones, riesgo, ICBF, SENA, caja, EPS y pension.';
comment on column public.labor_rate_entries.extra_hours_daily is
  'Valor de las horas extra diurnas y dominicales del mes.';

-- Fórmula de la hoja oficial de OCENSA, celda por celda:
--   base            = salario dia + auxilio de transporte
--   provisionado    = base + cesantias + interes + prima + vacaciones
--                     + riesgo + icbf + sena + caja + eps + pension
--   hora ordinaria  = salario dia / 7      (la hoja usa 7, no 8)
--   extra diurna    = hora * 1.25 * 56
--   dominical       = hora * 2.90 * 14
--   sub total       = provisionado + extras + alimentacion + no salarial
--   salud y pension = 8% de (base * dias + extras)
--   subtotal hoja   = sub total - salud y pension
--   valor dia       = (subtotal hoja + conceptos + dotacion) / dias
create or replace function private.recompute_labor_daily_rate()
returns void language sql as $$
  with dias as (select 240::numeric as d),
  base as (
    select e.id,
      (e.daily_basic_salary + e.transport_allowance) as b,
      e.daily_basic_salary as salario,
      e.food_allowance as alimentacion,
      e.non_salary_allowance as no_salarial
    from public.labor_rate_entries e
  ),
  -- La base imponible de salud y pensión es el subtotal base del bloque 1.
  provision as (
    select b.id, b.salario, b.alimentacion, b.no_salarial, b.b as subtotal_base,
      b.b * 0.0834 as cesantias,
      b.b * 0.0834 * 12.0 / 360.0 as interes,
      b.b * 0.0834 as prima,
      b.b * 0.0417 as vacaciones,
      b.b * 0.0696 as riesgo,
      b.b * 0.03 as icbf,
      b.b * 0.02 as sena,
      b.b * 0.04 as caja,
      b.b * 0.125 as eps,
      b.b * 0.16 as pension
    from base b
  ),
  horas as (
    select p.id,
      p.salario / 7.0 as hora_ordinaria,
      (p.salario / 7.0) * 1.25 * 56.0 as extra_diurna,
      (p.salario / 7.0) * 2.90 * 14.0 as dominical
    from provision p
  ),
  totales as (
    select p.id,
      p.cesantias + p.interes + p.prima + p.vacaciones + p.riesgo
        + p.icbf + p.sena + p.caja + p.eps + p.pension as provisiones,
      h.hora_ordinaria, h.extra_diurna, h.dominical,
      p.alimentacion, p.no_salarial,
      p.subtotal_base as base_dia
    from provision p join horas h on h.id = p.id
  )
  update public.labor_rate_entries e
  set
    provision_daily = t.provisiones,
    extra_hours_daily = (t.extra_diurna + t.dominical),
    total_daily_rate = round((
      (t.base_dia + t.provisiones) * d.d
      + t.extra_diurna + t.dominical
      + (t.alimentacion + t.no_salarial) * d.d
      - ((t.base_dia * d.d + t.extra_diurna + t.dominical) * 0.08)
    ) / d.d, 2),
    updated_at = now()
  from totales t, dias d
  where e.id = t.id;
$$;

-- El valor diario ahora incluye todo. Antes solo sumaba las cuatro columnas base.
select private.recompute_labor_daily_rate();

/* ─────────────────────────────────────────────────────────────
 * 3. Conceptos por obra (catálogo)
 * ───────────────────────────────────────────────────────────── */

create table if not exists public.labor_project_concepts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  label text not null,
  -- 'libre'  = el dueño escribe el total del periodo
  -- 'regla'  = el dueño escribe la tarifa por dia y el total sale de los dias
  mode text not null check (mode in ('libre', 'regla')),
  help_text text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

alter table public.labor_project_concepts enable row level security;

create policy labor_project_concepts_member_read on public.labor_project_concepts
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.company_id = labor_project_concepts.company_id
  ));

create policy labor_project_concepts_manager_write on public.labor_project_concepts
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_project_concepts.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ))
  with check (exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.company_id = labor_project_concepts.company_id
      and r.code in ('administrator', 'resident_engineer', 'general_management')
  ));

grant select, insert, update, delete on public.labor_project_concepts to authenticated;

create trigger labor_project_concepts_updated
  before update on public.labor_project_concepts
  for each row execute function private.set_updated_at();

insert into public.labor_project_concepts (company_id, key, label, mode, help_text, sort_order)
select c.id, v.key, v.label, v.mode, v.help_text, v.sort_order
from public.companies c cross join (values
  ('transporte',        'Transporte',        'libre', 'Pasajes o interno de la obra para estos trabajadores.', 1),
  ('hidratacion',       'Hidratacion',       'libre', 'Botella de agua o bebida por dia de trabajo.', 2),
  ('medico',            'Medico',            'libre', 'Valor del medico o examen de la obra.', 3),
  ('trabajoEnAltura',   'Trabajo en altura', 'libre', 'Expediente y equipo para trabajo en alturas.', 4),
  ('espacioConfinado',  'Espacio confinado', 'libre', 'Certificado y equipo para espacios confinados.', 5),
  ('hotel',             'Hotel',             'regla', 'Tarifa por dia de alojamiento. Aplica a capataz y conductor, y a las excepciones.', 6),
  ('alimentacion',      'Alimentacion',      'regla', 'Tarifa por dia de alimentacion. Aplica a capataz y conductor, y a las excepciones.', 7),
  ('otros',             'Otros',             'libre', 'Cualquier otro concepto de la obra.', 8)
) as v(key, label, mode, help_text, sort_order)
on conflict (company_id, key) do nothing;

/* ─────────────────────────────────────────────────────────────
 * 4. Guardar el proyecto junto con la cotización
 * ───────────────────────────────────────────────────────────── */

create or replace function public.save_quote_with_history(p_company_id uuid, p_quote jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_quote_id uuid := (p_quote->>'id')::uuid;
  v_table_id uuid := nullif(p_quote->>'laborRateTableId', '')::uuid;
  v_actor text; v_entry jsonb; v_snapshot jsonb; v_previous_snapshot jsonb; v_previous_table uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.company_id = p_company_id) then raise exception 'No autorizado para esta empresa'; end if;
  if v_quote_id is null then raise exception 'La cotizacion no tiene identificador'; end if;
  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Usuario') into v_actor from public.profiles p where p.id = auth.uid();
  select q.labor_rate_table_id, q.labor_rate_snapshot into v_previous_table, v_previous_snapshot from public.quotes q where q.id = v_quote_id and q.company_id = p_company_id;
  if v_table_id is not null and v_previous_table is not distinct from v_table_id and v_previous_snapshot is not null then
    v_snapshot := v_previous_snapshot;
  elsif v_table_id is not null then
    select jsonb_build_object('id', t.id, 'name', t.name, 'version', t.version, 'clientName', t.client_name, 'activityType', t.activity_type, 'rateUnit', t.rate_unit, 'validFrom', t.valid_from, 'validTo', t.valid_to, 'entries', coalesce(jsonb_agg(jsonb_build_object('code', e.code, 'name', e.name, 'level', e.level, 'dailyBasicSalary', e.daily_basic_salary, 'transportAllowance', e.transport_allowance, 'foodAllowance', e.food_allowance, 'nonSalaryAllowance', e.non_salary_allowance, 'totalDailyRate', e.total_daily_rate) order by e.sort_order, e.name) filter (where e.id is not null), '[]'::jsonb))
      into v_snapshot from public.labor_rate_tables t left join public.labor_rate_entries e on e.labor_rate_table_id = t.id
      where t.id = v_table_id and t.company_id = p_company_id group by t.id;
    if v_snapshot is null then raise exception 'La tabla salarial seleccionada no pertenece a la empresa'; end if;
  end if;
  insert into public.quotes as q (id, company_id, code, title, client, contact_name, contact_email, contact_phone, email_origin, status, responsible, estimated_value, revision, cost_breakdown, technical_visit, technical_visits, validity_days, sent_at, delivery_time_weeks, payment_terms, folder_url, received_at, deadline, next_action, project_id, notes, request_body, labor_rate_table_id, labor_rate_snapshot, labor_project_snapshot, labor_project_days, labor_project_start, labor_project_end, created_at, updated_at)
  values (v_quote_id,p_company_id,p_quote->>'code',p_quote->>'title',p_quote->>'client',nullif(p_quote->>'contactName',''),nullif(p_quote->>'contactEmail',''),nullif(p_quote->>'contactPhone',''),nullif(p_quote->>'emailOrigin',''),p_quote->>'status',p_quote->>'responsible',nullif(p_quote->>'estimatedValue','')::numeric,coalesce((p_quote->>'revision')::int,0),p_quote->'costBreakdown',p_quote->'technicalVisit',p_quote->'technicalVisits',nullif(p_quote->>'validityDays','')::int,nullif(p_quote->>'sentAt','')::timestamptz,nullif(p_quote->>'deliveryTimeWeeks','')::int,nullif(p_quote->>'paymentTerms',''),nullif(p_quote->>'folderUrl',''),coalesce(nullif(p_quote->>'receivedAt','')::timestamptz,now()),nullif(p_quote->>'deadline','')::timestamptz,nullif(p_quote->>'nextAction',''),nullif(p_quote->>'projectId','')::uuid,nullif(p_quote->>'notes',''),p_quote->>'requestBody',v_table_id,v_snapshot,p_quote->'laborProjectSnapshot',nullif(p_quote->>'laborProjectDays','')::int,nullif(p_quote->>'laborProjectStart','')::date,nullif(p_quote->>'laborProjectEnd','')::date,coalesce(nullif(p_quote->>'createdAt','')::timestamptz,now()),now())
  on conflict (id) do update set code=excluded.code,title=excluded.title,client=excluded.client,contact_name=excluded.contact_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,email_origin=excluded.email_origin,status=excluded.status,responsible=excluded.responsible,estimated_value=excluded.estimated_value,revision=excluded.revision,cost_breakdown=excluded.cost_breakdown,technical_visit=excluded.technical_visit,technical_visits=excluded.technical_visits,validity_days=excluded.validity_days,sent_at=excluded.sent_at,delivery_time_weeks=excluded.delivery_time_weeks,payment_terms=excluded.payment_terms,folder_url=excluded.folder_url,deadline=excluded.deadline,next_action=excluded.next_action,project_id=excluded.project_id,notes=excluded.notes,request_body=excluded.request_body,labor_rate_table_id=excluded.labor_rate_table_id,labor_rate_snapshot=excluded.labor_rate_snapshot,labor_project_snapshot=excluded.labor_project_snapshot,labor_project_days=excluded.labor_project_days,labor_project_start=excluded.labor_project_start,labor_project_end=excluded.labor_project_end,updated_at=now() where q.company_id=p_company_id;
  for v_entry in select value from jsonb_array_elements(coalesce(p_quote->'history', '[]'::jsonb)) loop
    if nullif(v_entry->>'id','') is null or exists (select 1 from public.quote_history h where h.id=(v_entry->>'id')::uuid) then continue; end if;
    insert into public.quote_history (id,quote_id,company_id,from_status,to_status,changed_by,note,changed_at) values ((v_entry->>'id')::uuid,v_quote_id,p_company_id,nullif(v_entry->>'fromStatus',''),v_entry->>'toStatus',v_actor,nullif(v_entry->>'note',''),coalesce(nullif(v_entry->>'changedAt','')::timestamptz,now()));
  end loop;
end;
$$;

revoke all on function public.save_quote_with_history(uuid, jsonb) from public, anon;
grant execute on function public.save_quote_with_history(uuid, jsonb) to authenticated;