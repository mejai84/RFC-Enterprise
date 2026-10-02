insert into public.permissions (code, name, description) values
  ('apu.view', 'Consultar APUs', 'Consultar análisis de precios unitarios.'),
  ('apu.manage', 'Gestionar APUs', 'Crear y editar APUs y sus recursos.')
on conflict (code) do update set name = excluded.name, description = excluded.description;
