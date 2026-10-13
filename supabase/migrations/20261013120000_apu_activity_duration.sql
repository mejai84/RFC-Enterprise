-- La duracion se congela con la version del APU: no se infiere de fechas comerciales.
alter table public.apu_versions
  add column if not exists crew_yield_per_day numeric(18, 4),
  add column if not exists crew_size integer;

alter table public.apu_versions
  add constraint apu_versions_crew_yield_per_day_positive check (crew_yield_per_day is null or crew_yield_per_day > 0) not valid,
  add constraint apu_versions_crew_size_positive check (crew_size is null or crew_size > 0) not valid;

comment on column public.apu_versions.crew_yield_per_day is 'Produccion diaria de la cuadrilla completa, en unidad de la actividad; sirve para calcular dias fisicos.';
comment on column public.apu_versions.crew_size is 'Numero de personas planeadas en la cuadrilla; es informativo y no multiplica el rendimiento declarado.';
