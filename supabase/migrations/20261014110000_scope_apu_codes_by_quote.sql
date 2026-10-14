-- Un mismo código de actividad puede existir en cotizaciones distintas.
-- Los APUs archivados no bloquean una nueva importación de la misma cotización.
alter table public.apu_analyses
  drop constraint if exists apu_analyses_company_id_code_key;

create unique index if not exists apu_analyses_active_quote_code_key
  on public.apu_analyses (company_id, quote_id, code)
  where quote_id is not null and status <> 'archived';

create unique index if not exists apu_analyses_active_catalog_code_key
  on public.apu_analyses (company_id, code)
  where quote_id is null and status <> 'archived';