-- Márgenes de ganancia por rubro del APU.
-- Antes no existía dónde guardarlos: al cambiar un porcentaje y guardar, el valor
-- se perdía porque solo vivía en el navegador y al recargar volvía al valor por defecto.

alter table public.apu_analyses
  add column if not exists category_margins jsonb;

comment on column public.apu_analyses.category_margins is
  'Porcentaje de ganancia por rubro (materials, equipment, labor, transport). Objeto parcial: solo se guardan los rubros que se personalizaron. Si es null o no trae un rubro, se aplica el valor por defecto del sistema.';

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'apu_analyses_touch_updated_at'
  ) then
    create trigger apu_analyses_touch_updated_at
      before update on public.apu_analyses
      for each row execute function private.touch_updated_at();
  end if;
end $$;

comment on trigger apu_analyses_touch_updated_at on public.apu_analyses is
  'Mantiene updated_at al día cuando se cambian los márgenes, para que el orden del listado refleje el cambio.';
