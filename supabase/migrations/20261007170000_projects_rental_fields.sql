-- Proyecto tipo Alquiler (ALQ-001). Segmenta los datos de alquiler sobre la
-- misma tabla `projects`, ya con el tipo y el consecutivo ALQ del dominio.

alter table public.projects
  add column if not exists rental_daily_rate numeric(14,2),
  add column if not exists rental_extension_rate numeric(14,2),
  add column if not exists rental_late_fee_per_day numeric(14,2),
  add column if not exists rental_notes text;

comment on column public.projects.rental_daily_rate is
  'Tarifa de alquiler por día del equipo asignado. Solo aplica a proyectos con type = alquiler.';
comment on column public.projects.rental_extension_rate is
  'Cargo adicional por cada día de extensión del alquiler sobre el periodo pactado.';
comment on column public.projects.rental_late_fee_per_day is
  'Cargo por día por devolución con retraso sobre la fecha comprometida.';
comment on column public.projects.rental_notes is
  'Condiciones particulares del alquiler (depósito, responsabilidad de daños, uso autorizado).';

-- La fecha de entrega es start_date y la devolución pactada se conserva en estimated_end_date;
-- la devolución real se registra en actual_end_date cuando el equipo vuelve.
comment on column public.projects.start_date is
  'Fecha de inicio de la obra, del mantenimiento o, para proyectos de alquiler, de la entrega del equipo.';
comment on column public.projects.estimated_end_date is
  'Fecha estimada de entrega o, para proyectos de alquiler, la devolución pactada del equipo.';
